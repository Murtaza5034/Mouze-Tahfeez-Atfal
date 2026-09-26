/**
 * Google Sheets Live Sync Service
 * 
 * Automatically pushes weekly mark progress to Google Sheets in real-time
 * whenever a teacher submits or auto-saves progress.
 * Also supports bulk syncing all students into all 8 Marhala tabs.
 */

import { getStudentMarhala } from "./marhalaRanking";

// Global webhook URL resolver:
// 1. LocalStorage override (configured by admin in-app)
// 2. Window global variable
// 3. Vite environment variable
export function getGoogleSheetsWebhookUrl() {
  if (typeof window !== "undefined") {
    const local = window.localStorage?.getItem("mauze_google_sheets_webhook_url");
    if (local && local.trim() !== "") return local.trim();
    if (window.GOOGLE_SHEETS_WEBHOOK_URL && window.GOOGLE_SHEETS_WEBHOOK_URL.trim() !== "") {
      return window.GOOGLE_SHEETS_WEBHOOK_URL.trim();
    }
  }
  return import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || "";
}

export function setGoogleSheetsWebhookUrl(url) {
  if (typeof window !== "undefined" && window.localStorage) {
    if (url) {
      window.localStorage.setItem("mauze_google_sheets_webhook_url", url.trim());
    } else {
      window.localStorage.removeItem("mauze_google_sheets_webhook_url");
    }
  }
}

/**
 * Sync individual student mark progress payload to Google Sheets Web App
 */
export async function syncStudentResultToGoogleSheets({
  student,
  result,
  isKibar = false,
  marhalaRank = "",
  overallRank = "",
  webhookUrl = ""
}) {
  const url = webhookUrl || getGoogleSheetsWebhookUrl();
  if (!url) {
    return { skipped: true, reason: "Webhook URL not configured" };
  }

  try {
    const category = isKibar ? "kibar" : "atfal";
    const resolvedMarhala = getStudentMarhala(student, result) || "Marhala 1";
    
    const email = (
      student?.parent_email ||
      student?.email ||
      student?.user_email ||
      ""
    ).trim();

    const payload = {
      category,
      marhala: resolvedMarhala,
      student: {
        student_id: student?.student_id || result?.student_id || "",
        id: student?.id || "",
        its: student?.its || "",
        name: student?.name || student?.full_name || "",
        arabic_name: student?.arabic_name || "",
        email: email,
        parent_email: email,
        teacher_name: student?.teacherName || student?.teacher_name || "",
        group_name: student?.groupName || student?.group_name || "",
        marhala: resolvedMarhala,
        marhala_rank: marhalaRank || student?.marhalaRank || "",
        overall_rank: overallRank || student?.computedRank || result?.computedRank || ""
      },
      result: {
        week_date: result?.week_date || "",
        from_date: result?.from_date || "",
        till_date: result?.till_date || result?.week_date || "",
        fatemi_from_date: result?.fatemi_from_date || null,
        fatemi_till_date: result?.fatemi_till_date || null,
        fatemi_till_month_name: result?.fatemi_till_month_name || "",
        attendance_count: result?.attendance_count !== undefined ? result.attendance_count : "",
        murajazah: result?.murajazah !== undefined ? result.murajazah : 0,
        juz_hali: result?.juz_hali !== undefined ? result.juz_hali : 0,
        takhteet: result?.takhteet !== undefined ? result.takhteet : 0,
        jadeed: result?.jadeed !== undefined ? result.jadeed : 0,
        total_score: result?.total_score !== undefined ? result.total_score : 0,
        total_jadeed_pages: result?.total_jadeed_pages || 0,
        total_jadeed_unit: result?.total_jadeed_unit || "صفه",
        wusool_juz: result?.wusool_juz || "",
        wusool_page: result?.wusool_page || "",
        wusool_surah: result?.wusool_surah || "",
        next_week_juz: result?.next_week_juz || "",
        next_week_page: result?.next_week_page || "",
        next_week_surah: result?.next_week_surah || "",
        istifadah_juz: result?.istifadah_juz || "",
        istifadah_page: result?.istifadah_page || "",
        istifadah_surah: result?.istifadah_surah || "",
        matrookah: result?.matrookah || "",
        daeefah: result?.daeefah || "",
        attendance_note: result?.attendance_note || ""
      }
    };

    fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).catch((fetchErr) => {
      console.warn("[GoogleSheetsSync] Background sync notification:", fetchErr);
    });

    return { success: true, queued: true };

  } catch (err) {
    console.error("[GoogleSheetsSync] Error preparing sync payload:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Bulk sync all active students and their latest marks to Google Sheets.
 * Lists each student in their respective Marhala tab and in the "parents email" tab.
 */
export async function syncAllStudentsToGoogleSheets({
  students = [],
  isKibar = false,
  webhookUrl = ""
}) {
  const url = webhookUrl || getGoogleSheetsWebhookUrl();
  if (!url) {
    return { skipped: true, reason: "Webhook URL not configured" };
  }

  const category = isKibar ? "kibar" : "atfal";
  const packagedStudents = (students || []).map((s) => {
    const res = s.latestResult || {};
    const resolvedMarhala = getStudentMarhala(s, res) || "Marhala 1";
    const email = (s.parent_email || s.email || s.user_email || "").trim();

    return {
      marhala: resolvedMarhala,
      student: {
        student_id: s.student_id || s.id || "",
        id: s.id || "",
        its: s.its || "",
        name: s.name || s.full_name || "",
        arabic_name: s.arabic_name || "",
        email: email,
        parent_email: email,
        teacher_name: s.teacherName || s.teacher_name || "",
        group_name: s.groupName || s.group_name || "",
        marhala: resolvedMarhala,
        marhala_rank: s.marhalaRank || "",
        overall_rank: s.computedRank || res.computedRank || ""
      },
      result: {
        week_date: res.week_date || "",
        from_date: res.from_date || "",
        till_date: res.till_date || res.week_date || "",
        fatemi_from_date: res.fatemi_from_date || null,
        fatemi_till_date: res.fatemi_till_date || null,
        fatemi_till_month_name: res.fatemi_till_month_name || "",
        attendance_count: res.attendance_count !== undefined ? res.attendance_count : "",
        murajazah: res.murajazah !== undefined ? res.murajazah : 0,
        juz_hali: res.juz_hali !== undefined ? res.juz_hali : 0,
        takhteet: res.takhteet !== undefined ? res.takhteet : 0,
        jadeed: res.jadeed !== undefined ? res.jadeed : 0,
        total_score: res.total_score !== undefined ? res.total_score : 0,
        total_jadeed_pages: res.total_jadeed_pages || 0,
        total_jadeed_unit: res.total_jadeed_unit || "صفه",
        wusool_juz: res.wusool_juz || s.hifz?.juz || s.juz || "",
        wusool_page: res.wusool_page || "",
        wusool_surah: res.wusool_surah || s.hifz?.surat || s.surat || "",
        next_week_juz: res.next_week_juz || "",
        next_week_page: res.next_week_page || "",
        next_week_surah: res.next_week_surah || "",
        istifadah_juz: res.istifadah_juz || "",
        istifadah_page: res.istifadah_page || "",
        istifadah_surah: res.istifadah_surah || "",
        matrookah: res.matrookah || "",
        daeefah: res.daeefah || "",
        attendance_note: res.attendance_note || ""
      }
    };
  });

  const payload = {
    action: "bulk_sync",
    category,
    students: packagedStudents
  };

  try {
    fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).catch((fetchErr) => {
      console.warn("[GoogleSheetsSync] Bulk sync error:", fetchErr);
    });

    return { success: true, count: packagedStudents.length };
  } catch (err) {
    console.error("[GoogleSheetsSync] Failed to bulk sync students:", err);
    return { success: false, error: err.message };
  }
}
