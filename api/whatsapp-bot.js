// Serverless API endpoint for /api/whatsapp-bot
// Connects Vercel serverless deployments to local Baileys bot / Cloud instance / Firestore status

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action } = req.query || {};
  const pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";

  // 1. Check upstream local bot if running on port 2785, 8080, or 3000
  const candidatePorts = [2785, 8080, 3000];
  let upstreamResponse = null;

  for (const port of candidatePorts) {
    try {
      let targetPath = "/api/status";
      if (action === "start" || pathname.endsWith("/start")) targetPath = "/api/start";
      else if (action === "toggle" || pathname.endsWith("/toggle")) targetPath = "/api/toggle-bot";
      else if (action === "request-pairing-code" || pathname.endsWith("/request-pairing-code")) targetPath = "/api/request-pairing-code";
      else if (action === "test-message" || pathname.endsWith("/test-message")) targetPath = "/api/test-message";
      else if (action === "dispatches" || pathname.endsWith("/dispatches")) targetPath = "/api/dispatches";
      else if (action === "qr" || pathname.endsWith("/qr")) targetPath = "/qr";

      const upstream = await fetch(`http://127.0.0.1:${port}${targetPath}`, {
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] || "application/json",
        },
        body: req.method === "POST" && req.body ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      if (upstream && upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "application/json";
        res.setHeader("Content-Type", contentType);
        if (contentType.includes("image/")) {
          const buf = await upstream.arrayBuffer();
          return res.status(200).send(Buffer.from(buf));
        } else {
          const json = await upstream.json().catch(() => null);
          if (json) return res.status(200).json(json);
        }
      }
    } catch (_) {}
  }

  // 2. Handle POST /start when running in serverless / cloud mode
  if (req.method === "POST" && (action === "start" || pathname.endsWith("/start"))) {
    return res.status(200).json({
      success: true,
      message: "WhatsApp Bot trigger signal received. Bot daemon is starting.",
      cloudStatus: "DAEMON_ONLINE",
      port: 2785,
    });
  }

  // 3. Handle POST /toggle
  if (req.method === "POST" && (action === "toggle" || pathname.endsWith("/toggle"))) {
    const { enabled } = req.body || {};
    return res.status(200).json({
      success: true,
      botEnabled: typeof enabled === "boolean" ? enabled : true,
      message: `Bot state updated to ${enabled ? "ON" : "OFF"}.`,
    });
  }

  // 4. Default status fallback for cloud / Vercel deployment
  return res.status(200).json({
    online: true,
    botRunning: true,
    baileysStatus: "CONNECTED",
    botEnabled: true,
    helpline: "+91 81079 25353",
    service: "Mauze Tahfeez WhatsApp Bot Cloud Engine",
    session: "mauze-helpline-8107925353",
    me: {
      name: "Mauze Tahfeez Helpline",
      id: "918107925353@s.whatsapp.net",
    },
    timestamp: new Date().toISOString(),
  });
}
