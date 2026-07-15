import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "npm:google-auth-library@9.6.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Play Android Publisher API base URL (for metadata/JSON requests)
const PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
// Google Play media upload base URL (required for binary file uploads like AAB)
const PLAY_UPLOAD_BASE = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3'

const PLAY_TRACKS = ['internal', 'alpha', 'beta', 'production'] as const
type PlayTrack = typeof PLAY_TRACKS[number]

/**
 * Safely sanitizes and parses a potentially malformed or multi-line JSON string.
 */
function parseServiceAccountKey(rawKey: string): Record<string, unknown> {
  let cleaned = rawKey.trim();

  // Strip enclosing quotes (single, double, or backticks) if present
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  // Scan the string character-by-character to find raw newlines inside double-quoted string values,
  // and convert them to escaped \n to keep JSON.parse happy.
  let sanitized = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      sanitized += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      sanitized += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      sanitized += char;
      continue;
    }

    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\n') {
        sanitized += '\\n';
      }
      continue;
    }

    sanitized += char;
  }

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // If that failed, check if the quotes might be escaped double quotes (e.g. CLI escaping)
    try {
      const unescaped = sanitized.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return JSON.parse(unescaped);
    } catch {
      throw new Error(`GOOGLE_PLAY_SERVICE_ACCOUNT_KEY is not valid JSON. Parse error: ${err.message}. Please verify the key formatting.`);
    }
  }
}

/**
 * Generate a Google OAuth2 access token using the service account JSON key.
 */
async function getPlayAccessToken(): Promise<{ token: string; clientEmail: string }> {
  const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY')
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY environment variable is not set. Please add it via Supabase Secrets.')
  }

  const credentials = parseServiceAccountKey(serviceAccountJson)
  const clientEmail = String(credentials.client_email || 'unknown')

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token?.token) {
    throw new Error('Failed to generate Google Play access token. Check your service account key.')
  }
  return { token: token.token, clientEmail }
}

/**
 * Delete an abandoned edit so it doesn't accumulate.
 */
async function deleteEdit(accessToken: string, packageName: string, editId: string) {
  try {
    await fetch(`${PLAY_API_BASE}/applications/${packageName}/edits/${editId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // Best-effort cleanup — don't throw
  }
}

/**
 * Upload an AAB file to Google Play and release it on the specified track.
 */
async function deployToPlayStore(
  accessToken: string,
  clientEmail: string,
  packageName: string,
  track: PlayTrack,
  aabBytes: Uint8Array,
  versionName: string,
  versionCode: number,
  releaseNotes: string,
  onStage: (stage: string) => void
) {
  // Step 1: Create a new edit
  onStage('Creating Play Store edit…')
  console.log('Creating edit...')
  const editRes = await fetch(`${PLAY_API_BASE}/applications/${packageName}/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!editRes.ok) {
    const err = await editRes.text()
    throw new Error(`Failed to create edit: ${editRes.status} — ${err}. (Package Name: "${packageName}", Service Account Email: "${clientEmail}". Please verify this service account email has Release permissions for this package in the Google Play Console.)`)
  }

  const edit = await editRes.json()
  const editId: string = edit.id
  console.log(`Edit created: ${editId}`)

  try {
    // Step 2: Upload the AAB bundle (must use the /upload/ media endpoint, not the regular API base)
    onStage('Uploading bundle to Google Play…')
    console.log(`Uploading AAB bundle (${(aabBytes.length / (1024 * 1024)).toFixed(1)} MB)...`)
    const uploadUrl = `${PLAY_UPLOAD_BASE}/applications/${packageName}/edits/${editId}/bundles?uploadType=media`
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: aabBytes,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Failed to upload AAB: ${uploadRes.status} — ${err}`)
    }

    const bundle = await uploadRes.json()
    const bundleVersionCode: number = bundle.versionCode
    console.log(`AAB uploaded. Version code: ${bundleVersionCode}`)

    // Step 3: Assign the bundle to the requested track
    onStage('Assigning to track…')
    console.log(`Assigning to track: ${track}...`)
    const trackUrl = `${PLAY_API_BASE}/applications/${packageName}/edits/${editId}/tracks/${track}`
    const trackPayload = {
      track,
      releases: [
        {
          name: versionName,
          versionCodes: [bundleVersionCode],
          releaseNotes: releaseNotes
            ? [{ language: 'en-US', text: releaseNotes }]
            : [],
          status: 'completed',
        },
      ],
    }

    const trackRes = await fetch(trackUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trackPayload),
    })

    if (!trackRes.ok) {
      const err = await trackRes.text()
      throw new Error(`Failed to assign to track: ${trackRes.status} — ${err}`)
    }

    console.log(`Assigned to track "${track}" successfully.`)

    // Step 4: Commit the edit
    onStage('Committing release…')
    console.log('Committing edit...')
    const commitUrl = `${PLAY_API_BASE}/applications/${packageName}/edits/${editId}:commit`
    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!commitRes.ok) {
      const err = await commitRes.text()
      throw new Error(`Failed to commit edit: ${commitRes.status} — ${err}`)
    }

    const commitResult = await commitRes.json()
    console.log('Edit committed successfully.')

    return {
      editId,
      bundleVersionCode,
      commitResult,
    }
  } catch (deployError) {
    // Clean up the abandoned edit
    console.log(`Cleaning up edit ${editId}...`)
    await deleteEdit(accessToken, packageName, editId)
    throw deployError
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }
    const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || 'com.mauzetahfeez.myapp'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized — please log in again.')
    }

    // Parse the multipart form data (AAB file + metadata)
    const contentType = req.headers.get('Content-Type') || ''
    if (!contentType.includes('multipart/form-data')) {
      throw new Error('Content-Type must be multipart/form-data')
    }

    const formData = await req.formData()
    const aabFile = formData.get('aab') as File | null
    const track = formData.get('track') as string | null
    const versionName = formData.get('versionName') as string | null
    const versionCodeStr = formData.get('versionCode') as string | null
    const releaseNotes = (formData.get('releaseNotes') as string) || ''

    if (!aabFile) throw new Error('AAB file is required')
    if (!track || !PLAY_TRACKS.includes(track as PlayTrack)) {
      throw new Error(`Track must be one of: ${PLAY_TRACKS.join(', ')}`)
    }
    if (!versionName?.trim()) throw new Error('Version name is required')
    if (!versionCodeStr) throw new Error('Version code is required')

    const versionCode = parseInt(versionCodeStr, 10)
    if (isNaN(versionCode) || versionCode < 1) {
      throw new Error('Version code must be a positive integer')
    }

    // Validate file is actually an AAB
    if (!aabFile.name.endsWith('.aab')) {
      throw new Error('File must be an .aab file')
    }

    const fileSizeMB = (aabFile.size / (1024 * 1024)).toFixed(1)
    console.log(`Deploying: ${aabFile.name} (${fileSizeMB} MB), track=${track}, version=${versionName} (${versionCode})`)

    // Insert a pending release record
    const { data: releaseRecord, error: insertError } = await supabase
      .from('app_releases')
      .insert({
        version_name: versionName.trim(),
        version_code: versionCode,
        track,
        release_notes: releaseNotes.trim(),
        aab_file_name: aabFile.name,
        aab_file_size: aabFile.size,
        status: 'deploying',
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create release record: ${insertError.message}`)
    }

    const releaseId = releaseRecord.id

    try {
      // Get Google Play access token
      console.log('Getting Google Play access token...')
      const { token: accessToken, clientEmail } = await getPlayAccessToken()

      // Read AAB bytes
      const aabBytes = new Uint8Array(await aabFile.arrayBuffer())

      // Deploy to Google Play
      const { editId, bundleVersionCode } = await deployToPlayStore(
        accessToken,
        clientEmail,
        packageName,
        track as PlayTrack,
        aabBytes,
        versionName.trim(),
        versionCode,
        releaseNotes.trim(),
        (stage) => console.log(stage)
      )

      // Mark as live
      await supabase
        .from('app_releases')
        .update({
          status: 'live',
          edit_id: editId,
          bundle_version_code: bundleVersionCode,
        })
        .eq('id', releaseId)

      return new Response(
        JSON.stringify({
          success: true,
          message: `App v${versionName.trim()} deployed to ${track} track successfully!`,
          release: {
            id: releaseId,
            versionName: versionName.trim(),
            versionCode,
            track,
            editId,
            bundleVersionCode,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (deployError) {
      // Mark as failed
      await supabase
        .from('app_releases')
        .update({
          status: 'failed',
          error_message: deployError.message,
        })
        .eq('id', releaseId)

      throw deployError
    }

  } catch (error) {
    console.error('Deploy error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
