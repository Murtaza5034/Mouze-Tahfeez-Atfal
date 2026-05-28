import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface EmailPayload {
  to: string
  subject: string
  html?: string
  text?: string
  pdfBase64?: string
  pdfFilename?: string
  studentName?: string
}

interface EmailSettings {
  enabled: boolean
  from_email: string
  subject_template: string
  message_template: string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Partial<EmailPayload & { to: string }>
    const to = (payload.to || "").trim()
    const subject = (payload.subject || "").trim()
    const html = payload.html || ""
    const text = payload.text || ""
    const pdfBase64 = payload.pdfBase64 || ""
    const pdfFilename = payload.pdfFilename || "progress-report.pdf"

    if (!to) {
      throw new Error("Missing recipient email address")
    }

    if (!subject) {
      throw new Error("Missing email subject")
    }

    if (!html && !text) {
      throw new Error("Missing email body (html or text)")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase service credentials are missing")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Load email settings
    const { data: config, error: configError } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    if (configError) {
      throw new Error(`Failed to load email settings: ${configError.message}`)
    }

    if (!config) {
      throw new Error("Email settings are missing. Save them in the admin portal first.")
    }

    const emailSettings = config as EmailSettings

    if (!emailSettings.enabled) {
      throw new Error("Email notifications are disabled in the admin portal")
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }

    const fromEmail = emailSettings.from_email || "onboarding@resend.dev"

    // Build Resend API request payload
    const resendPayload: Record<string, unknown> = {
      from: fromEmail,
      to: [to],
      subject: subject,
    }

    // Set body content
    if (html) {
      resendPayload.html = html
    } else {
      resendPayload.text = text
    }

    // Add PDF attachment if provided
    if (pdfBase64) {
      resendPayload.attachments = [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ]
    }

    // Send email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new Error(`Resend API Error (${response.status}): ${errorBody.slice(0, 400)}`)
    }

    const result = await response.json().catch(() => ({}))

    // Log success to email_logs
    const { error: logError } = await supabase.from("email_logs").insert([
      {
        student_name: payload.studentName || null,
        parent_email: to,
        subject: subject,
        status: "sent",
      },
    ])

    if (logError) {
      console.warn("Failed to log email:", logError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: result.id || null,
        to,
        subject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Email send error:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
