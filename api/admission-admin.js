import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const FALLBACK_SA = {
  type: "service_account",
  project_id: "mawaid-b929a",
  private_key_id: "d7380d0a557b5d54dd660ed6d8e66d38096158bd",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxD80HG/JO2fbC\nMhrM5Jh8NZzzeOc7qhJBdzE0kGBMaFyTzhd5l1+tA/chu4Q5ug46Y+VaP0DYk8xA\nsjoeVZ40UFoQj93YlEGYnOKYeXqFSVq/93RGLE2dfDBioPKq9F/ha9rXk7JpwMrA\nfKA6u4NPe9GLyJJupqrTzk/9hqDA2makDD5MFom8vtNB8QAi/i5fOAtIu+d1HHPB\nR4E3ndewrS8DR42EZOqi8hMwWNf8CY0mNmu5t3++ZQHs/oo3aTMwCo5+PSljJB8n\nkoA2kNDuRx42+hWQCr1QvdNJ0IMoRwUTItPh1KlfCanWtFHBT6RENkz2WIPIUzEM\nJX1C8HVnAgMBAAECggEALq973+P+f8v4xDtx1ZRwoE+Ckq/OSG0PYzOKRdHLklny\nDwbIKcc/8t6YyswmkRH9rmeokaMb9f8CXAyiRl1M2X5WQQet9u0gXpz/IjTlmT8+\nLl+QyO/lhyC3oUnOskS9AzLtAOpwoHG1BAvYM6Q9ezeqiLDZ61MGt9IuRSq6OB7t\nZ1tlj4rl5frDrKCs+MtwhjJbupwRjcehDDtQisRdLROQHe224Axqsy7aHaJqbXzo\nf943QxDsp5v4MytnU/3wJpEAKPJrEY3lkr0XxbNhkGr7dAV9HGQQ+NufM109j9Gv\nhGyRNwVK1YSGGkPxqGtaMjBZTs2eFtm8OYOB7kugAQKBgQDkEG176HDGGR7ocol/\nEqxaareaPRidn9h7I1Jke9rqVvgV5loge97YuJRHvTBfOO2zbRd0DpHdlByvpYpn\nsgE2fkLkgxosPHI4wceh0Lm21ie71gaqHsTrs+zOmGoTy8OBoEkVTRXos/57o2Xg\nPWoi3Au8rdZMXEYOo+WWrB66IQKBgQDGwA2AVLUXTNv7SxK9Xi4iY93OPvWY24eL\nSSbwFJPgSsNcpX4vMyRAYXRab2q5ACfZxVjvlx1XX0BD1SX+gB0Fopeuz7h/7855\n00OaFvqMw40xkFgkxxAM6toktT7WCr9BsuiYILzULpvWg8ALZ/huAZwrysbEJ+ff\nwG5tb76OhwKBgARYr815u5R67BTgAfDTCUfb2s3stihi4HxQSwSxO5XVvHqmXjda\nRP/6XJEVcPOPoTAXNyg2Et+XMAjE7eNWCCHivCGgwgHv0Pl17/kMgk2SvUUeKhhZ\n58TaM/wn+XWRH5O720i1pGI/8+ylS46/fONXMD4TTg88fvVOeFSryRYhAoGARBCJ\njyVzTyN3QrwXEtsqGYTx9SwCl/K2nLDUsOubKPjxpszWRfvRsmqtmjsF5Y10GFRJ\nfOPXnJB2RcS9WkctqTxhjfB9UvMhVv9O63prG8HsnMi+Jvo1OPdE9cVMW6kajrli\nhpbPlCrSG8jLABz/K01J2oV7RLoV4r7YEopuTAkCgYEA09xPGq/rMy4NGoWH6kvk\nHfssacZjp8d8GtiyUB/Lhdpwncu8ojaoyWvobMDfT0s/tpGrUQfh4YO9RaPPSG8r\nL0YJhS0ELiXRCnI8Hm1De/uQa0ghJPd6Z9YKswlgMf7x7sndUfE9j9SEhrg/CGor\nmc3Evj91L2C/7cQLX31YorU=\n-----END PRIVATE KEY-----\n",
  client_email: "mauze-tahfeez-592@mawaid-b929a.iam.gserviceaccount.com",
  client_id: "108581398070585913551",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/mauze-tahfeez-592%40mawaid-b929a.iam.gserviceaccount.com"
};

const CACHE_FILE = path.join("/tmp", "admission_applications_cache.json");

function readDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(content) || [];
    }
  } catch (_) {}
  return [];
}

export function writeDiskCache(record) {
  try {
    const list = readDiskCache();
    const idx = list.findIndex(r => r.application_id === record.application_id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(list), "utf8");
  } catch (_) {}
}

export function getAdminDb() {
  if (!getApps().length) {
    let credential = null;
    let projectId = FALLBACK_SA.project_id;
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (saEnv) {
      try {
        const saObj = JSON.parse(saEnv);
        credential = cert(saObj);
        if (saObj.project_id) projectId = saObj.project_id;
      } catch (_) {}
    }
    if (!credential) {
      credential = cert(FALLBACK_SA);
    }
    initializeApp({ credential, projectId });
  }
  return getFirestore();
}

export default async function handler(req, res) {
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

  // GET: Fetch applications with multi-tier fallback (Admin SDK -> REST API -> Local Cache)
  if (req.method === "GET") {
    let applications = [];
    let success = false;

    // 1. Try Firebase Admin SDK
    try {
      const db = getAdminDb();
      const snap = await db.collection("admission_applications").get();
      snap.forEach((doc) => {
        applications.push({ id: doc.id, ...doc.data() });
      });
      success = true;
    } catch (grpcErr) {
      console.warn("Admin SDK get note (falling back to REST/cache):", grpcErr.message);
    }

    // 2. Try Firestore REST API
    if (!success || applications.length === 0) {
      try {
        const restUrl = "https://firestore.googleapis.com/v1/projects/mawaid-b929a/databases/(default)/documents/admission_applications";
        const rRes = await fetch(restUrl);
        if (rRes.ok) {
          const rJson = await rRes.json();
          const docs = rJson.documents || [];
          docs.forEach((d) => {
            const f = d.fields || {};
            const parsed = {
              id: d.name.split("/").pop(),
              application_id: f.application_id?.stringValue,
              full_name: f.full_name?.stringValue,
              its_number: f.its_number?.stringValue,
              gender: f.gender?.stringValue,
              age: f.age?.integerValue ? parseInt(f.age.integerValue, 10) : null,
              jamaat: f.jamaat?.stringValue,
              email: f.email?.stringValue,
              whatsapp_number: f.whatsapp_number?.stringValue,
              program: f.program?.stringValue,
              status: f.status?.stringValue || "pending",
              last_achieved_sanad: f.last_achieved_sanad?.stringValue,
              venue_and_time: f.venue_and_time?.stringValue,
              dob: f.dob?.stringValue,
              hifz_till: f.hifz_till?.stringValue,
              created_at: f.created_at?.stringValue,
              submitted_at: f.submitted_at?.stringValue
            };
            if (parsed.application_id) applications.push(parsed);
          });
          if (applications.length > 0) success = true;
        }
      } catch (_) {}
    }

    // 3. Fallback to Disk Cache merge
    const cached = readDiskCache();
    const map = new Map();
    applications.forEach(a => map.set(a.application_id || a.id, a));
    cached.forEach(c => {
      if (!map.has(c.application_id || c.id)) {
        map.set(c.application_id || c.id, c);
      }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => {
      const da = new Date(b.created_at || b.submitted_at || 0).getTime();
      const dbTime = new Date(a.created_at || a.submitted_at || 0).getTime();
      return da - dbTime;
    });

    return res.status(200).json({ success: true, data: merged });
  }

  // PATCH / POST: Update application status or record
  if (req.method === "PATCH" || req.method === "POST" || req.method === "PUT") {
    try {
      let body = req.body || {};
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (_) {}
      }

      const appId = body.applicationId || body.application_id || body.id;
      if (!appId) {
        return res.status(400).json({ success: false, error: "Missing applicationId" });
      }

      const timestamp = new Date().toISOString();
      let updatedRecord = { ...body, updated_at: timestamp };

      if (body.action === "update_status" || body.newStatus) {
        const newStatus = body.newStatus || body.status;
        const newLog = {
          id: `log_${Date.now()}`,
          action: newStatus,
          timestamp,
          actor: body.adminUser || "Admin",
          note: body.adminNote || `Status updated to ${newStatus}`
        };
        updatedRecord = {
          ...updatedRecord,
          status: newStatus,
          last_action_by: body.adminUser || "Admin"
        };
      } else if (body.action === "exit") {
        updatedRecord = {
          ...updatedRecord,
          status: "exited",
          last_action_by: body.adminUser || "Admin"
        };
      } else if (body.action === "resume") {
        updatedRecord = {
          ...updatedRecord,
          status: "approved",
          last_action_by: body.adminUser || "Admin"
        };
      }

      // Update disk cache
      writeDiskCache({ application_id: appId, ...updatedRecord });

      // Update Firestore
      try {
        const db = getAdminDb();
        await db.collection("admission_applications").doc(appId).set(updatedRecord, { merge: true });
      } catch (dbErr) {
        console.warn("Firestore update note:", dbErr.message);
      }

      return res.status(200).json({ success: true, data: updatedRecord });
    } catch (err) {
      console.error("Error updating application:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
