// Serverless Two-Way WhatsApp Webhook Listener
// Handles: Meta WhatsApp Cloud API & Twilio incoming webhooks
// Automatically responds to user replies ('Yes', 'No', 'Want to talk')
// On 'Yes', dispenses portal login credentials (Portal link, User ID = Email, Password = 123456)

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --------------------------------------------------------------------------
  // 1. GET: Webhook Verification Handshake (Meta Cloud API)
  // --------------------------------------------------------------------------
  if (req.method === "GET") {
    const mode = req.query["hub.mode"] || req.query["mode"];
    const token = req.query["hub.verify_token"] || req.query["verify_token"];
    const challenge = req.query["hub.challenge"] || req.query["challenge"];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "mauze_tahfeez_verify_token";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WhatsApp Webhook] Verification successful!");
      return res.status(200).send(challenge);
    } else {
      console.warn("[WhatsApp Webhook] Verification failed. Token mismatch.");
      return res.status(403).json({ error: "Verification token mismatch" });
    }
  }

  // --------------------------------------------------------------------------
  // 2. POST: Process Incoming Messages
  // --------------------------------------------------------------------------
  if (req.method === "POST") {
    try {
      const body = req.body || {};
      let incomingSender = "";
      let incomingText = "";

      // Check Meta Cloud API format
      if (body.object === "whatsapp_business_account" && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              const value = change.value;
              if (value && Array.isArray(value.messages) && value.messages.length > 0) {
                const msg = value.messages[0];
                incomingSender = msg.from; // e.g. "919876543210"
                if (msg.type === "text" && msg.text) {
                  incomingText = msg.text.body || "";
                } else if (msg.type === "interactive") {
                  incomingText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
                } else if (msg.type === "button") {
                  incomingText = msg.button?.text || "";
                }
              }
            }
          }
        }
      } 
      // Check Twilio format
      else if (body.From && body.Body) {
        incomingSender = String(body.From).replace("whatsapp:", "").replace("+", "");
        incomingText = body.Body;
      }
      // Check direct payload format (e.g. internal bot test)
      else if (body.phone && body.message) {
        incomingSender = String(body.phone).replace("+", "");
        incomingText = body.message;
      }

      if (!incomingSender || !incomingText) {
        // Return 200 to acknowledge status deliveries from WhatsApp
        return res.status(200).json({ status: "acknowledged", note: "No user text found in payload" });
      }

      const normalizedText = incomingText.trim().toLowerCase();
      console.log(`[WhatsApp Webhook] Incoming message from +${incomingSender}: "${incomingText}"`);

      let cleanPhone = incomingSender.replace(/[^\d]/g, "");
      let phone10 = cleanPhone.slice(-10);

      // ----------------------------------------------------------------------
      // Fetch matching application from database via Firebase Firestore REST API
      // ----------------------------------------------------------------------
      let matchedApplicant = null;
      const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || "mawaid-b929a";

      if (firebaseProjectId) {
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/admission_applications`;
          const fetchRes = await fetch(firestoreUrl);
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            const documents = data.documents || [];
            // Parse firestore fields
            for (const d of documents) {
              const fields = d.fields || {};
              const phoneVal = fields.whatsapp_number?.stringValue || "";
              const cleanDocPhone = phoneVal.replace(/[^\d]/g, "");
              if (cleanDocPhone.includes(phone10) || phone10.includes(cleanDocPhone.slice(-10))) {
                matchedApplicant = {
                  docName: d.name,
                  application_id: fields.application_id?.stringValue,
                  full_name: fields.full_name?.stringValue,
                  email: fields.email?.stringValue,
                  whatsapp_number: phoneVal,
                  program: fields.program?.stringValue,
                  status: fields.status?.stringValue
                };
                break;
              }
            }
          }
        } catch (fbErr) {
          console.warn("[WhatsApp Webhook] Firebase direct query warning:", fbErr);
        }
      }

      const applicantName = matchedApplicant?.full_name || "Mumin";
      const applicantEmail = matchedApplicant?.email || `${phone10}@tahfeez-galiakot.com`;
      const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://mauze-tahfeez.vercel.app/";

      let replyMessage = "";

      // ----------------------------------------------------------------------
      // BOT LOGIC: Branch based on user reply
      // ----------------------------------------------------------------------
      if (normalizedText === "yes" || normalizedText === "y" || normalizedText.includes("yes")) {
        replyMessage = `🌹 *Afzalus Salaam ${applicantName}*\n\nWelcome to Mauze Tahfeez Galiakot! 🌟\nYour enrollment is confirmed.\n\n📧 *User ID:* ${applicantEmail}\n🔑 *Password:* 123456\n\nRegards,\n*Mauze Tahfeez - Galiakot*\n\n💬 *Type 2 to ask something to bot*`;

        // Update Firebase Firestore document if found
        if (matchedApplicant?.docName) {
          try {
            const updateUrl = `https://firestore.googleapis.com/v1/${matchedApplicant.docName}?updateMask.fieldPaths=onboarding_confirmed&updateMask.fieldPaths=onboarding_confirmed_at`;
            await fetch(updateUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fields: {
                  onboarding_confirmed: { booleanValue: true },
                  onboarding_confirmed_at: { stringValue: new Date().toISOString() }
                }
              })
            });
          } catch (patchErr) {
            console.warn("[WhatsApp Webhook] Firebase update warning:", patchErr);
          }
        }
      } 
      else if (normalizedText === "no" || normalizedText === "n" || normalizedText.includes("no")) {
        replyMessage = `🌹 *Afzalus Salaam ${applicantName}*\n\nYour response has been recorded.\nFor any queries, please call +918107925353.\n\nRegards,\n*Mauze Tahfeez - Galiakot*\n\n💬 *Type 2 to ask something to bot*`;
      } 
      else if (normalizedText.includes("talk") || normalizedText.includes("call") || normalizedText.includes("contact")) {
        replyMessage = `🌹 *Afzalus Salaam ${applicantName}*\n\nOur team will connect with you shortly on this number.\nHelpline: +918107925353.\n\nRegards,\n*Mauze Tahfeez - Galiakot*\n\n💬 *Type 2 to ask something to bot*`;
      } 
      else {
        replyMessage = `🌹 *Afzalus Salaam ${applicantName}*\n\nTo confirm admission, please reply *Yes*, *No*, or *Want to talk*.\n\nRegards,\n*Mauze Tahfeez - Galiakot*\n\n💬 *Type 2 to ask something to bot*`;
      }

      // ----------------------------------------------------------------------
      // Outbound dispatch of reply message
      // ----------------------------------------------------------------------
      const cloudApiToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_CLOUD_API_KEY;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (cloudApiToken && phoneNumberId) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cloudApiToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: cleanPhone,
              type: "text",
              text: { preview_url: false, body: replyMessage }
            })
          });
        } catch (sendErr) {
          console.warn("[WhatsApp Webhook] Cloud API reply dispatch failed:", sendErr);
        }
      }

      // Return 200 OK
      return res.status(200).json({
        success: true,
        action: normalizedText,
        recipient: cleanPhone,
        reply: replyMessage,
        applicant: matchedApplicant ? matchedApplicant.application_id : "unmatched"
      });

    } catch (err) {
      console.error("[WhatsApp Webhook] Error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
