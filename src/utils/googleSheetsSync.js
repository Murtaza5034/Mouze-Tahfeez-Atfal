/**
 * Google Sheets Live Sync Service
 * 
 * Automatically pushes weekly mark progress to Google Sheets in real-time
 * whenever a teacher submits or auto-saves progress.
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
 * Sync student mark progress payload to Google Sheets Web App
 * 
 * @param {Object} params
 * @param {Object} params.student - The student object from schoolData.students
 * @param {Object} params.result - The weekly result payload being saved
 * @param {boolean} params.isKibar - Whether this is Kibar or Atfal
 * @param {number|string} [params.marhalaRank] - Calculated Marhala rank
 * @param {number|string} [params.overallRank] - Overall computed rank
 * @param {string} [params.webhookUrl] - Optional webhook URL override
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
    // If webhook is not configured, silently skip without error
    return { skipped: true, reason: "Webhook URL not configured" };
  }

  try {
    const category = isKibar ? "kibar" : "atfal";
    const resolvedMarhala = getStudentMarhala(student, result) || "Marhala 1";
    
    // Resolve email (check parent_email, email, user_id/user_email)
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

    // Google Apps Script Web Apps require 'no-cors' mode with 'text/plain' body
    // to bypass preflight OPTIONS CORS restrictions from browsers and PWAs
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
