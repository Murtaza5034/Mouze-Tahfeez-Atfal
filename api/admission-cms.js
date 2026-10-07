import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

function getAdminDb() {
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

  const db = getAdminDb();
  const docRef = db.collection("admission_cms_settings").doc("1");

  if (req.method === "GET") {
    try {
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(200).json({ success: true, data: null });
      }
      return res.status(200).json({ success: true, data: snap.data() });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    try {
      const body = req.body || {};
      const payload = {
        ...body,
        id: 1,
        updated_at: new Date().toISOString()
      };
      await docRef.set(payload, { merge: true });
      return res.status(200).json({ success: true, data: payload });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
