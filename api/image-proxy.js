export default async function handler(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const targetUrl = req.query?.url || requestUrl.searchParams.get("url");

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing url query parameter" }));
    return;
  }

  try {
    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Upstream HTTP ${upstream.status}` }));
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ dataUrl }));
  } catch (error) {
    console.error("image-proxy error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error.message || "Failed to fetch image" }));
  }
}
