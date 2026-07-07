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
  isOtp?: boolean
}

interface EmailSettings {
  enabled: boolean
  from_email: string
  from_name: string
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
    const isOtp = payload.isOtp === true

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

    // Get email API key — using Resend (switch to MAILERSEND_API_KEY once available)
    const emailApiKey = Deno.env.get("MAILERSEND_API_KEY") || Deno.env.get("RESEND_API_KEY")
    if (!emailApiKey) {
      throw new Error("No email API key configured (MAILERSEND_API_KEY or RESEND_API_KEY)")
    }
    const useMailerSend = !!Deno.env.get("MAILERSEND_API_KEY")

    // Load email settings (non-fatal for OTP)
    let fromEmail = "onboarding@resend.dev"
    let fromName = "Mauze Tahfeez"
    const { data: config, error: configError } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    if (configError) {
      if (!isOtp) {
        throw new Error(`Failed to load email settings: ${configError.message}`)
      }
      console.warn("Could not load email settings (using defaults):", configError.message)
    } else if (config) {
      const emailSettings = config as EmailSettings

      // For regular emails, enforce the enabled flag
      if (!isOtp && !emailSettings.enabled) {
        throw new Error("Email notifications are disabled in the admin portal")
      }

      // Use configured from details if available
      if (emailSettings.from_email) {
        fromEmail = emailSettings.from_email
      }
      if (emailSettings.from_name) {
        fromName = emailSettings.from_name
      }
    } else if (!isOtp) {
      throw new Error("Email settings are missing. Save them in the admin portal first.")
    }

    // Build MailerLite Transactional API payload
    const mailerPayload: Record<string, unknown> = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [{ email: to }],
      subject: subject,
    }

    // Set body content
    if (html) {
      mailerPayload.html = html
    } else {
      mailerPayload.text = text
    }

    // Add PDF attachment if provided
    if (pdfBase64) {
      mailerPayload.attachments = [
        {
          filename: pdfFilename,
          content: pdfBase64,
          disposition: "attachment",
        },
      ]
    }

    // Send email — auto-selects MailerSend or Resend based on available keys
    const apiUrl = useMailerSend
      ? "https://api.mailersend.com/v1/email"
      : "https://api.resend.com/emails"

    // Resend uses a flat `from` string, MailerSend uses object
    const sendPayload = useMailerSend
      ? mailerPayload
      : { ...mailerPayload, from: `${fromName} <${fromEmail}>`, to: [to] }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(sendPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new Error(`Email API Error (${response.status}): ${errorBody.slice(0, 500)}`)
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
        id: result.id || result.message_id || null,
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
