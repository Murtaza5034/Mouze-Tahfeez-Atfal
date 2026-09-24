import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Embedded fallback service account credentials for al-mawaid-1ihvq0 (project: mawaid-b929a)
// Ensures notifications NEVER fail even if environment variables are not configured in Vercel
const FALLBACK_SA = {
  type: "service_account",
  project_id: "al-mawaid-1ihvq0",
  private_key_id: "553461cfc5e2287b61e08875acead285099cb52d",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5WZDSOZRK7Hk3\n32Wvw3LWcBYVNn4dXYPrBs4Lcn594NFzahnLlq+zDSRMLnfozt8ehadxjXOdt+Ha\n1XMo70aIOXtKtIZF+6xvlAsIjeeJ3mAIaISBErStgVdkbv05l22AVZyR8+b4+09K\nCHpCYgAlgKCRY0EKchn9z/LKvCJ6T0Mcx1rcKXIwZk/0+ZvmMgTEhKSh1s6nJSr/\nLnoLaB72PddlSfA9rtpcVTlaRY+FiLGJ2PztooDuqBW+75VE865gyGZjx1Jwsio8\n/gpXQOs6Ga+1gRo0tmXKN7LwMg5NAqaJvfi55PeTM/OZ108AgV9tSG7nzUVaBWfD\nKQEGKu/bAgMBAAECggEAAaQiPP7bzrYGdL7Do3J8cPbG0iL6Pb/AOdg7lIgU/zaf\nP5PLfz9qCJCvy5csmTNnJuwIm82ki5Jj0CLMRWHyIsoUE/awGIhAhJ2LPuUAevqa\nhDiK+qq9Kar8X2VIwmztrdqmfa6hwKMyKNFeZgwS86/FTnsbXAm/LAa56Qx+i/GK\nIw/7bGFKHpe9Dhuh7QoxR6j93FJEpn68GtXPbAl0FRgdelHlxAw8F5leR2W67+2c\n1flIE2ePO+3mAEZWporpZyB3lOorYyVrm/1dFmLj6Wl8psy/Gwj8XqTyZckTVi4i\nxzoGl4g5x9LDqL5PiEkzc0QHUnpxwWFm+OqmIT79MQKBgQDtjtIctSzRdnSLD3am\nXahobsLzeS+LSdDm36jrBBHlsDsXjC+pzO7cXP0IrmgWwvL/0W3+dU4Vkd/VhvJq\nkCp9M+JQEju/TrZzXaSTWuFryEY7ExUEzFSPo6HA1XP9ehVfpQhQgFqSkohPiSs3\nAOpUv/GAPBnRt/JANP29o/lmDwKBgQDHvSw8myObnEKYF4Ar0JVxq5mx1wtrXNgZ\nFDcLYLIPDveoNiX1qzw2SZJZ7ciGxqCzipyCI0iKmGgbtwUT4Zlx0fNjOjXbJ61b\nv8lsQZUP4ucXO9WAA2D29bqrcpO5LAWvajdQD7Xuf1vUbpcMZBp/kXYO947LkIxB\nYVZp378FdQKBgQDn1Zfr+EwS5z15cM/kMEboFCAhqETj9Ffw2JlrMf+dXs1sf50M\nYzlAyWcPj9V5USwAyIxF5okbt87v/dCaerNcmMPmTMUOQG0CTYMNY4XWwA76G/dJ\nRXfI7nIvVKDr4Lb3LoHcvkamAGcS59TKyxPlPaUb9otkBdZfHtf6uQnttQKBgBWT\n8jt55xbggrE7mLUjC4IEL85ulOU8WnwbGvc3swS9cTPS5bbskMyslgrxDUDCJIpA\n5zeH6EZQwK59zyaesJ0DOW/20eqjFq9awL/ZNelJcf2okSALPWZwlYIAFsViZBrX\nNrKHf/gL+jew2tCT3+j4JfDn/Z0wOHa3tUYqzdAhAoGANI7OBs21Yynjv4jk4bhF\n/m54savDUHYB2R0KBmNi4+dXGO64HPbtpB9wAfAPuUsfRcxqAkleU3x4KxGoew8W\nHphjVTZ0IZvfVyCUsOA75c2CjITve0unyuOnraLCDCb9X2XiXYV6H0NpsX450AlD\nswakaPhFoqTmJbS4IAq4+l0=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@al-mawaid-1ihvq0.iam.gserviceaccount.com",
  client_id: "106371802283934637802",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40al-mawaid-1ihvq0.iam.gserviceaccount.com"
};

// Initialize Firebase Admin once using modular API
let appInstance = null;
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
    const candidates = [
      resolve(process.cwd(), 'al-mawaid-1ihvq0-firebase-adminsdk-fbsvc-553461cfc5.json'),
      resolve(process.cwd(), '../al-mawaid-1ihvq0-firebase-adminsdk-fbsvc-553461cfc5.json'),
    ];
    try {
      const currentDir = dirname(fileURLToPath(import.meta.url));
      candidates.push(resolve(currentDir, 'al-mawaid-1ihvq0-firebase-adminsdk-fbsvc-553461cfc5.json'));
      candidates.push(resolve(currentDir, '../al-mawaid-1ihvq0-firebase-adminsdk-fbsvc-553461cfc5.json'));
    } catch (_) {}

    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          const saObj = JSON.parse(readFileSync(p, 'utf8'));
          credential = cert(saObj);
          if (saObj.project_id) projectId = saObj.project_id;
          break;
        } catch (_) {}
      }
    }
  }

  if (!credential) {
    credential = cert(FALLBACK_SA);
    projectId = FALLBACK_SA.project_id;
  }

  appInstance = initializeApp({
    credential,
    projectId,
  });
} else {
  appInstance = getApps()[0];
}

const db = getFirestore(appInstance);
const messaging = getMessaging(appInstance);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function notificationUrl(data) {
  const page = data?.redirectPage || data?.redirect_page || '';
  const studentId = data?.studentId || data?.student_id || '';
  const leaveId = data?.leaveId || data?.leave_id || '';
  const params = [];
  if (page) params.push('redirectPage=' + encodeURIComponent(page));
  if (studentId) params.push('studentId=' + encodeURIComponent(studentId));
  if (leaveId) params.push('leaveId=' + encodeURIComponent(leaveId));
  return params.length ? '/?' + params.join('&') : (data?.url || '/');
}

async function tokensForUser(userId, section = 'atfal') {
  if (!userId) return [];
  const out = [];
  const col = 'user_fcm_tokens';
  const rawId = String(userId).trim();
  const rawIdLower = rawId.toLowerCase();

  // 1. Direct query by user_id
  try {
    const snap = await db.collection(col).where('user_id', '==', rawId).limit(200).get();
    snap.docs.forEach((d) => {
      const t = d.data().fcm_token;
      if (t) out.push(String(t));
    });
  } catch (_) {}

  // 2. Direct query by email
  if (rawId.includes('@')) {
    const emNorm = normalizeEmail(rawId);
    try {
      const snapEmail = await db.collection(col).where('email', '==', emNorm).limit(200).get();
      snapEmail.docs.forEach((d) => {
        const t = d.data().fcm_token;
        if (t) out.push(String(t));
      });
    } catch (_) {}

    for (const accessCol of ['user_portal_access', 'kibar_user_portal_access']) {
      try {
        const accSnap = await db.collection(accessCol).where('email', '==', emNorm).limit(5).get();
        for (const ad of accSnap.docs) {
          const resolvedUid = String(ad.data().user_id || '');
          if (resolvedUid && resolvedUid !== rawId) {
            const snapUid = await db.collection(col).where('user_id', '==', resolvedUid).limit(200).get();
            snapUid.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
          }
        }
      } catch (_) {}
    }
  }

  // 3. User Portal Access query by ITS or user_id
  for (const accessCol of ['user_portal_access', 'kibar_user_portal_access']) {
    try {
      const accSnap = await db.collection(accessCol).where('its', '==', rawId).limit(5).get();
      for (const ad of accSnap.docs) {
        const uid = String(ad.data().user_id || '');
        const em = ad.data().email ? normalizeEmail(String(ad.data().email)) : '';
        if (uid) {
          const su = await db.collection(col).where('user_id', '==', uid).limit(200).get();
          su.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
        }
        if (em) {
          const se = await db.collection(col).where('email', '==', em).limit(200).get();
          se.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
        }
      }
    } catch (_) {}
  }

  // 4. Student lookup in child_profiles & kibar_child_profiles (by doc id, student_id, its, id)
  for (const childCol of ['child_profiles', 'kibar_child_profiles']) {
    try {
      const pids = [];
      const pemails = [];

      const d1 = await db.collection(childCol).doc(rawId).get();
      if (d1.exists) {
        if (d1.data()?.parent_user_id) pids.push(String(d1.data().parent_user_id));
        if (d1.data()?.parent_email) pemails.push(String(d1.data().parent_email));
      }
      if (rawIdLower !== rawId) {
        const d2 = await db.collection(childCol).doc(rawIdLower).get();
        if (d2.exists) {
          if (d2.data()?.parent_user_id) pids.push(String(d2.data().parent_user_id));
          if (d2.data()?.parent_email) pemails.push(String(d2.data().parent_email));
        }
      }

      const rawNum = Number(rawId);
      const isNum = !isNaN(rawNum);

      const queries = [
        db.collection(childCol).where('student_id', '==', rawId).limit(5).get(),
        db.collection(childCol).where('its', '==', rawId).limit(5).get(),
        db.collection(childCol).where('id', '==', rawId).limit(5).get()
      ];
      if (isNum) {
        queries.push(db.collection(childCol).where('student_id', '==', rawNum).limit(5).get());
        queries.push(db.collection(childCol).where('its', '==', rawNum).limit(5).get());
        queries.push(db.collection(childCol).where('id', '==', rawNum).limit(5).get());
      }
      const childResults = await Promise.all(queries);
      for (const q of childResults) {
        q.docs.forEach((d) => {
          if (d.data()?.parent_user_id) pids.push(String(d.data().parent_user_id));
          if (d.data()?.parent_email) pemails.push(String(d.data().parent_email));
          if (d.data()?.user_id) pids.push(String(d.data().user_id));
        });
      }

      for (const pid of [...new Set(pids)]) {
        const snapPid = await db.collection(col).where('user_id', '==', pid).limit(200).get();
        snapPid.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
      }

      for (const pem of [...new Set(pemails)]) {
        const pemNorm = normalizeEmail(pem);
        const snapPem = await db.collection(col).where('email', '==', pemNorm).limit(200).get();
        snapPem.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
      }
    } catch (_) {}
  }

  // 5. Teacher lookup in teacher_profiles & kibar_teacher_profiles
  for (const teacherCol of ['teacher_profiles', 'kibar_teacher_profiles']) {
    try {
      const teacherUids = [];
      const teacherEmails = [];

      const td = await db.collection(teacherCol).doc(rawId).get();
      if (td.exists) {
        if (td.data()?.user_id) teacherUids.push(String(td.data().user_id));
        if (td.data()?.email) teacherEmails.push(String(td.data().email));
      }

      const rawNum = Number(rawId);
      const isNum = !isNaN(rawNum);
      const tQueries = [
        db.collection(teacherCol).where('teacher_id', '==', rawId).limit(5).get(),
        db.collection(teacherCol).where('id', '==', rawId).limit(5).get()
      ];
      if (isNum) {
        tQueries.push(db.collection(teacherCol).where('teacher_id', '==', rawNum).limit(5).get());
      }
      const tResults = await Promise.all(tQueries);
      for (const qTeacher of tResults) {
        qTeacher.docs.forEach((d) => {
          if (d.data()?.user_id) teacherUids.push(String(d.data().user_id));
          if (d.data()?.email) teacherEmails.push(String(d.data().email));
        });
      }

      for (const tuid of [...new Set(teacherUids)]) {
        const st = await db.collection(col).where('user_id', '==', tuid).limit(200).get();
        st.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
      }

      for (const tem of [...new Set(teacherEmails)]) {
        const temNorm = normalizeEmail(tem);
        const ste = await db.collection(col).where('email', '==', temNorm).limit(200).get();
        ste.docs.forEach((d) => { if (d.data().fcm_token) out.push(String(d.data().fcm_token)); });
      }
    } catch (_) {}
  }

  return [...new Set(out)];
}

async function tokensForRole(role, section = 'atfal') {
  const out = [];
  const col = 'user_fcm_tokens';
  const target = String(role || 'all').toLowerCase().trim();
  const snap = await db.collection(col).limit(500).get();

  for (const d of snap.docs) {
    const data = d.data();
    const r = String(data.user_role || '').toLowerCase().trim();
    const t = data.fcm_token;
    if (!t) continue;

    const isKibarToken = r.startsWith('kibar-');
    if (section === 'kibar' ? !isKibarToken : isKibarToken) continue;

    if (!role || target === 'all' || target === 'user') {
      out.push(String(t));
      continue;
    }

    if (
      r === target ||
      ((target === 'parents' || target === 'parent') && (r === 'parents' || r === 'parent')) ||
      (target === 'admin' && (r === 'admin' || r === 'superadmin')) ||
      (target === 'teacher' && r === 'teacher') ||
      (target === 'kibar-student' && r === 'kibar-student') ||
      (target === 'kibar-teacher' && r === 'kibar-teacher') ||
      (target === 'kibar-admin' && (r === 'kibar-admin' || r === 'admin'))
    ) {
      out.push(String(t));
    }
  }

  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// Result Live Notifier implementation
// ---------------------------------------------------------------------------
async function handleResultLiveNotifier(body) {
  const section = body.section === 'kibar' ? 'kibar' : 'atfal';
  const manual = Boolean(body.manual);
  const settingsCol = section === 'kibar' ? 'kibar_report_settings' : 'report_settings';
  const resultsCol = section === 'kibar' ? 'kibar_weekly_results' : 'weekly_results';
  const childCol = section === 'kibar' ? 'kibar_child_profiles' : 'child_profiles';

  // 1. Check settings
  const settingsSnap = await db.collection(settingsCol).limit(1).get();
  const settings = settingsSnap.empty ? {} : (settingsSnap.docs[0].data() || {});

  if (!settings.result_live_notify_enabled) {
    return { success: true, skipped: "NOTIFY_DISABLED" };
  }
  if (!settings.reports_live) {
    return { success: true, skipped: "NOT_LIVE" };
  }

  // 2. Fetch weekly results
  const resultsSnap = await db.collection(resultsCol).limit(1000).get();
  const allResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!allResults.length) return { success: true, skipped: "NO_RESULTS" };

  const weekDates = allResults.map(r => r.week_date).filter(Boolean);
  const latestWeekDate = weekDates.reduce((max, d) => (d > max ? d : max), weekDates[0] || "");

  const pending = manual
    ? allResults.filter(r => r.week_date === latestWeekDate)
    : allResults.filter(r => !r._result_notified && r.week_date === latestWeekDate);

  if (!pending.length) return { success: true, skipped: "NO_PENDING" };

  // 3. Map children
  const childrenSnap = await db.collection(childCol).limit(1000).get();
  const childMap = new Map();
  childrenSnap.docs.forEach(d => {
    const data = d.data();
    const sid = String(data.student_id || d.id || '').trim().toLowerCase();
    if (sid) childMap.set(sid, data);
  });

  let deliveredCount = 0;
  let childrenCount = 0;
  const notifiedParents = new Set();

  for (const res of pending) {
    const sid = String(res.student_id || '').trim().toLowerCase();
    const child = childMap.get(sid);
    const childName = child?.name || child?.full_name || "Your child";
    const parentTarget = child?.parent_user_id || child?.parent_email || sid;

    if (parentTarget && !notifiedParents.has(String(parentTarget))) {
      const tokens = await tokensForUser(String(parentTarget), section);
      if (tokens.length) {
        const notifTag = `${section}-result-live-${sid}-${Date.now()}`;
        const notifUrl = '/?redirectPage=Progress&studentId=' + encodeURIComponent(sid);
        const title = `Result is Live: ${childName} 🏆`;
        const messageBody = `Weekly tahfeez report card for ${childName} is now published. Tap to check progress and marks.`;

        const messages = tokens.map(token => ({
          token,
          notification: { title, body: messageBody },
          data: {
            title,
            body: messageBody,
            tag: notifTag,
            redirectPage: "Progress",
            studentId: sid,
            section,
            url: notifUrl,
            timestamp: new Date().toISOString()
          },
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
            notification: {
              title,
              body: messageBody,
              channelId: 'mauze-tahfeez-notifications',
              icon: 'ic_notification',
              color: '#C5A059',
              priority: 'max',
              defaultSound: true,
              defaultVibrateTimings: true,
              defaultLightSettings: true,
              visibility: 'public',
              tag: notifTag,
              clickAction: 'FCM_PLUGIN_ACTIVITY',
            }
          }
        }));

        try {
          const sendRes = await messaging.sendEach(messages);
          deliveredCount += sendRes.responses.filter(r => r.success).length;
          notifiedParents.add(String(parentTarget));
          childrenCount++;
        } catch (_) {}
      }
    }

    try {
      await db.collection(resultsCol).doc(res.id).update({ _result_notified: true });
    } catch (_) {}
  }

  // Also notify teachers that results are live
  try {
    const teacherTokens = await tokensForRole(section === 'kibar' ? 'kibar-teacher' : 'teacher', section);
    if (teacherTokens.length) {
      const tMessages = teacherTokens.map(token => ({
        token,
        notification: {
          title: "Weekly Results Published",
          body: "Weekly student progress reports are now live for parents."
        },
        data: {
          title: "Weekly Results Published",
          body: "Weekly student progress reports are now live for parents.",
          redirectPage: "Progress",
          section,
          url: "/?redirectPage=Progress"
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'mauze-tahfeez-notifications',
            icon: 'ic_notification',
            color: '#C5A059',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          }
        }
      }));
      await messaging.sendEach(tMessages).catch(() => {});
    }
  } catch (_) {}

  return {
    success: true,
    summary: {
      delivered: deliveredCount,
      children: childrenCount,
      parents: notifiedParents.size
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Mauze Tahfeez FCM Push Engine v2' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    // 0. Result Live Notifier action
    if (body.action === 'result-live-notifier' || body.action === 'sendResultLiveNotifier') {
      const result = await handleResultLiveNotifier(body);
      return res.status(200).json(result);
    }

    // 0.5 Direct Store Token action (reliable backup)
    if (body.action === 'store-token' && body.token) {
      const col = 'user_fcm_tokens';
      const cleanToken = String(body.token).trim();
      const userId = String(body.userId || body.user_id || '').trim();
      const email = normalizeEmail(body.email);
      const role = String(body.role || body.user_role || '').trim();

      await db.collection(col).doc(cleanToken).set({
        fcm_token: cleanToken,
        user_id: userId,
        email,
        user_role: role,
        device_info: body.deviceInfo || { platform: 'Android App', isNative: true },
        updated_at: new Date().toISOString()
      }, { merge: true });

      return res.status(200).json({ success: true, message: 'Token stored' });
    }

    const title = String(body.title || '').trim();
    const messageBody = String(body.body || '').trim();

    if (!title || !messageBody) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    const section = body.section === 'kibar' ? 'kibar' : 'atfal';
    const targetUser = body.targetUser || null;
    const targetRole = body.targetRole || null;
    const dataMap = body.data || {};

    // 1. Resolve tokens
    let tokens = [];
    if (targetUser && targetUser !== 'all') {
      tokens = await tokensForUser(targetUser, section);
    } else {
      tokens = await tokensForRole(targetRole, section);
    }

    // 2. Write to Inbox if requested
    if (!body.skipInbox) {
      const inboxCol = section === 'kibar' ? 'kibar_system_notifications' : 'system_notifications';
      await db.collection(inboxCol).add({
        title,
        body: messageBody,
        target_role: targetRole || null,
        target_user: targetUser || null,
        redirect_page: dataMap.redirectPage || notificationUrl(dataMap),
        created_at: new Date().toISOString(),
        is_read: false,
      }).catch((e) => console.warn('Inbox write note:', e.message));
    }

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        message: 'NO_TOKENS_FOUND',
        summary: { total: 0, delivered: 0, stale: 0, failed: 0 },
      });
    }

    // 3. Build FCM messages and dispatch
    const notifTag = dataMap.tag || `mauze-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const url = notificationUrl(dataMap);

    // Ensure all data fields are pure strings for FCM compatibility
    const fcmData = {
      title,
      body: messageBody,
      tag: notifTag,
      url,
      section,
      redirectPage: dataMap.redirectPage || dataMap.redirect_page || 'Inbox',
      leaveId: String(dataMap.leaveId || dataMap.leave_id || ''),
      studentId: String(dataMap.studentId || dataMap.student_id || ''),
      type: String(dataMap.type || ''),
      timestamp: String(dataMap.timestamp || new Date().toISOString())
    };

    let delivered = 0;
    let stale = 0;
    let failed = 0;
    const col = 'user_fcm_tokens';

    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      const messages = chunk.map((token) => ({
        token,
        notification: { title, body: messageBody },
        data: fcmData,
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '86400',
          },
          notification: {
            title,
            body: messageBody,
            icon: '/LOGO ATFAAL-192.png',
            badge: '/LOGO ATFAAL-192.png',
            tag: notifTag,
            renotify: true,
            requireInteraction: true,
            data: { ...fcmData, click_action: url, tag: notifTag },
          },
          fcm_options: { link: url },
        },
        android: {
          priority: 'high',
          ttl: 86400 * 1000,
          notification: {
            title,
            body: messageBody,
            channelId: 'mauze-tahfeez-notifications',
            icon: 'ic_notification',
            color: '#C5A059',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
            defaultLightSettings: true,
            visibility: 'public',
            tag: notifTag,
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: { title, body: messageBody },
              sound: 'default',
              badge: 1,
              'content-available': 1,
            },
          },
        },
      }));

      const sendRes = await messaging.sendEach(messages);
      sendRes.responses.forEach((r, idx) => {
        if (r.success) {
          delivered++;
        } else {
          const code = r.error?.code || '';
          if (/not-registered|unregistered|registration-token-not-registered/i.test(code)) {
            stale++;
            db.collection(col)
              .where('fcm_token', '==', chunk[idx])
              .get()
              .then((snap) => snap.docs.forEach((d) => d.ref.delete()))
              .catch(() => {});
          } else {
            failed++;
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      summary: { total: tokens.length, delivered, stale, failed },
    });
  } catch (err) {
    console.error('Error in send-fcm handler:', err);
    return res.status(500).json({ error: err.message });
  }
}
