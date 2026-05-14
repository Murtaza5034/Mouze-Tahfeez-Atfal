import { Buffer } from "node:buffer";

const TARGET_ORIGIN = "https://www.elearningquran.com";
const TARGET_ORIGIN_ALIASES = [
  "https://www.elearningquran.com",
  "https://elearningquran.com",
  "https://teachers.elearningquran.com",
  "https://admins.elearningquran.com",
];
const PROXY_PREFIX = "/portal";

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined);
    });

    req.on("error", reject);
  });
}

function rewriteLocation(location) {
  if (!location) return location;

  try {
    const resolved = new URL(location, TARGET_ORIGIN);
    if (TARGET_ORIGIN_ALIASES.includes(resolved.origin)) {
      return `${PROXY_PREFIX}${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
    return location;
  } catch {
    return location;
  }
}

function rewriteSetCookie(cookie) {
  let rewritten = cookie.replace(/;\s*Domain=[^;]+/i, "");
  if (/;\s*Path=/i.test(rewritten)) {
    rewritten = rewritten.replace(/;\s*Path=[^;]+/i, "; Path=/");
  } else {
    rewritten += "; Path=/";
  }
  return rewritten;
}

function rewriteHtml(html) {
  const proxyBase = `${PROXY_PREFIX}/`;

  let output = html;
  for (const origin of TARGET_ORIGIN_ALIASES) {
    output = output.replaceAll(`${origin}/`, proxyBase);
  }

  output = output.replace(/(href|src|action)=([\"'])\/(?!\/)/gi, `$1=$2${proxyBase}`);

  return output;
}

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const rawPath = requestUrl.searchParams.get("path") || "Login.aspx";
    requestUrl.searchParams.delete("path");

    const targetUrl = new URL(rawPath.replace(/^\/+/, ""), TARGET_ORIGIN);
    for (const [key, value] of requestUrl.searchParams.entries()) {
      targetUrl.searchParams.append(key, value);
    }

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (["host", "connection", "content-length"].includes(lower)) continue;
      if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      } else if (typeof value === "string") {
        headers[key] = value;
      }
    }

    const method = (req.method || "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    res.statusCode = upstream.status;

    const setCookies = upstream.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      res.setHeader("Set-Cookie", setCookies.map(rewriteSetCookie));
    }

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if ([
        "content-length",
        "content-encoding",
        "transfer-encoding",
        "connection",
        "set-cookie",
        "x-frame-options",
        "content-security-policy",
        "content-security-policy-report-only",
      ].includes(lower)) {
        return;
      }

      if (lower === "location") {
        res.setHeader("Location", rewriteLocation(value));
        return;
      }

      res.setHeader(key, value);
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (upstream.status >= 300 && upstream.status < 400) {
      res.end();
      return;
    }

    if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
      const html = await upstream.text();
      res.end(rewriteHtml(html));
      return;
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.end(bytes);
  } catch (error) {
    console.error("Portal proxy error:", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Unable to load eLearning portal.");
  }
}
