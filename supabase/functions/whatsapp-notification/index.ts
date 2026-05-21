import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface WhatsAppPayload {
  phone: string
  message: string
  studentName?: string
}

interface WhatsAppConfig {
  enabled: boolean
  provider: string
  api_url?: string | null
  api_token?: string | null
  account_sid?: string | null
  from_number?: string | null
  message_template?: string | null
}

const normalizePhone = (phone: string) => (phone || "").replace(/\D/g, "")

const textResponse = async (response: Response) => {
  try {
    return await response.text()
  } catch {
    return ""
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Partial<WhatsAppPayload>
    const phone = normalizePhone(payload.phone || "")
    const message = (payload.message || "").trim()

    if (!phone) {
      throw new Error("Missing or invalid phone number")
    }

    if (!message) {
      throw new Error("Missing WhatsApp message body")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase service credentials are missing")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: config, error } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load WhatsApp settings: ${error.message}`)
    }

    if (!config) {
      throw new Error("WhatsApp settings are missing. Save them in the admin portal first.")
    }

    const whatsappConfig = config as WhatsAppConfig

    if (!whatsappConfig.enabled || whatsappConfig.provider === "none") {
      throw new Error("WhatsApp notifications are disabled in the admin portal")
    }

    if (whatsappConfig.provider === "mock") {
      console.log("[MOCK WHATSAPP]", { phone, message, studentName: payload.studentName })
      return new Response(
        JSON.stringify({
          success: true,
          provider: "mock",
          simulated: true,
          phone,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (whatsappConfig.provider === "meta") {
      if (!whatsappConfig.from_number || !whatsappConfig.api_token) {
        throw new Error("Meta API config incomplete: phone number ID or access token is missing")
      }

      const response = await fetch(`https://graph.facebook.com/v20.0/${whatsappConfig.from_number}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappConfig.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      })

      if (!response.ok) {
        const details = await textResponse(response)
        throw new Error(`Meta Cloud API Error (${response.status}): ${details.slice(0, 400)}`)
      }

      const result = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          success: true,
          provider: "meta",
          phone,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (whatsappConfig.provider === "twilio") {
      if (!whatsappConfig.account_sid || !whatsappConfig.api_token || !whatsappConfig.from_number) {
        throw new Error("Twilio config incomplete: Account SID, Auth Token, or From Number is missing")
      }

      const twilioFrom = whatsappConfig.from_number.startsWith("whatsapp:")
        ? whatsappConfig.from_number
        : `whatsapp:${whatsappConfig.from_number}`
      const twilioTo = `whatsapp:${phone.startsWith("+") ? phone : `+${phone}`}`

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${whatsappConfig.account_sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${whatsappConfig.account_sid}:${whatsappConfig.api_token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: twilioTo,
          From: twilioFrom,
          Body: message,
        }).toString(),
      })

      if (!response.ok) {
        const details = await textResponse(response)
        throw new Error(`Twilio Error (${response.status}): ${details.slice(0, 400)}`)
      }

      const result = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          success: true,
          provider: "twilio",
          phone,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (whatsappConfig.provider === "custom") {
      if (!whatsappConfig.api_url) {
        throw new Error("Custom gateway config incomplete: API URL is missing")
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (whatsappConfig.api_token) {
        headers.Authorization = `Bearer ${whatsappConfig.api_token}`
      }

      const response = await fetch(whatsappConfig.api_url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: phone,
          phone,
          number: phone,
          message,
          body: message,
          msg: message,
          token: whatsappConfig.api_token,
        }),
      })

      if (!response.ok) {
        const details = await textResponse(response)
        throw new Error(`Custom Gateway Error (${response.status}): ${details.slice(0, 400)}`)
      }

      const result = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          success: true,
          provider: "custom",
          phone,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (whatsappConfig.provider === "ultramsg") {
      if (!whatsappConfig.api_url || !whatsappConfig.api_token) {
        throw new Error("UltraMsg config incomplete: API URL or token is missing")
      }

      const response = await fetch(whatsappConfig.api_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: whatsappConfig.api_token,
          to: phone,
          body: message,
        }).toString(),
      })

      if (!response.ok) {
        const details = await textResponse(response)
        throw new Error(`UltraMsg Error (${response.status}): ${details.slice(0, 400)}`)
      }

      const result = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          success: true,
          provider: "ultramsg",
          phone,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    throw new Error(`Unsupported WhatsApp provider: ${whatsappConfig.provider}`)
  } catch (error) {
    console.error("WhatsApp notification error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown WhatsApp notification error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
