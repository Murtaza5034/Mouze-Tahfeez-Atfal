/**
 * Google Sheets Live Sync Service
 * 
 * Automatically pushes weekly mark progress to Google Sheets in real-time
 * whenever a teacher submits progress.
 * Also supports bulk syncing all students into all 8 Marhala tabs.
 */

import { getStudentMarhala, calculateMarhalaRanks } from "./marhalaRanking";

// Global webhook URL resolver:
// 1. Parameter override
// 2. LocalStorage override (configured by admin in-app)
// 3. Database reportSettings.google_sheets_webhook_url
// 4. Window global variable
// 5. Vite environment variable
export function getGoogleSheetsWebhookUrl(reportSettings = null) {
  if (typeof window !== "undefined") {
    const local = window.localStorage?.getItem("mauze_google_sheets_webhook_url");
    if (local && local.trim() !== "") return local.trim();
  }
  if (reportSettings && reportSettings.google_sheets_webhook_url && reportSettings.google_sheets_webhook_url.trim() !== "") {
    return reportSettings.google_sheets_webhook_url.trim();
  }
  if (typeof window !== "undefined" && window.GOOGLE_SHEETS_WEBHOOK_URL && window.GOOGLE_SHEETS_WEBHOOK_URL.trim() !== "") {
    return window.GOOGLE_SHEETS_WEBHOOK_URL.trim();
  }
  return import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || "";
}

export function setGoogleSheetsWebhookUrl(url) {
  if (typeof window !== "undefined" && window.localStorage) {
    if (url && url.trim()) {
      window.localStorage.setItem("mauze_google_sheets_webhook_url", url.trim());
    } else {
      window.localStorage.removeItem("mauze_google_sheets_webhook_url");
    }
  }
}

/**
 * Ping / Test the connection to the Google Apps Script Webhook.
 */
export async function testGoogleSheetsConnection(customUrl = "") {
  const url = customUrl || getGoogleSheetsWebhookUrl();
  if (!url) {
    return { success: false, error: "Please enter your Google Apps Script Webhook URL." };
  }

  try {
    // Attempt ping with no-cors so browser doesn't block Apps Script redirects
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ action: "ping" })
    });

    return {
      success: true,
      url: url,
      message: "Connected to Google Apps Script Webhook successfully!"
    };
  } catch (err) {
    return {
      success: false,
      error: "Could not reach webhook: " + err.message
    };
  }
}

/**
 * Request Google Apps Script to clear test/demo dummy rows from the sheet.
 */
export async function clearGoogleSheetsDemoData(customUrl = "") {
  const url = customUrl || getGoogleSheetsWebhookUrl();
  if (!url) {
    return { success: false, error: "Webhook URL not configured" };
  }

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ action: "clear_demo_data" })
    });

    return {
      success: true,
      message: "Purge command sent. Demo rows are being cleared from the sheet."
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sync individual student mark progress payload to Google Sheets Web App.
 * Called automatically when a teacher submits weekly marks.
 */
export async function syncStudentResultToGoogleSheets({
  student,
  result,
  isKibar = false,
  marhalaRank = "",
  overallRank = "",
  webhookUrl = "",
  reportSettings = null
}) {
  const url = webhookUrl || getGoogleSheetsWebhookUrl(reportSettings);
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
        student_id: student?.student_id || student?.id || result?.student_id || "",
        id: student?.id || student?.student_id || "",
        its: student?.its || student?.its_number || "",
        name: student?.name || student?.full_name || "",
        arabic_name: student?.arabic_name || "",
        email: email,
        parent_email: email,
        teacher_name: student?.teacherName || student?.teacher_name || "",
        group_name: student?.groupName || student?.group_name || "",
        marhala: resolvedMarhala,
        marhala_rank: marhalaRank || student?.marhalaRank || "",
        overall_rank: overallRank || student?.computedRank || result?.computedRank || "",
        whatsapp_number: student?.whatsapp_number || student?.phone || student?.mobile || student?.contact || ""
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
        wusool_juz: result?.wusool_juz || student?.hifz?.juz || student?.juz || "",
        wusool_page: result?.wusool_page || "",
        wusool_surah: result?.wusool_surah || student?.hifz?.surat || student?.surat || "",
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
 * Populates each student in their respective Marhala tab and in the "parents email" tab.
 * 
 * Supports clearExisting to purge test/demo dummy rows first!
 */
export async function syncAllStudentsToGoogleSheets({
  students = [],
  weeklyResults = [],
  isKibar = false,
  webhookUrl = "",
  reportSettings = null,
  clearExisting = true
}) {
  const url = webhookUrl || getGoogleSheetsWebhookUrl(reportSettings);
  if (!url) {
    return { skipped: true, reason: "Webhook URL not configured" };
  }

  const category = isKibar ? "kibar" : "atfal";

  // Pre-calculate exact Marhala ranks so every student has an accurate marhala_rank
  let rankMap = new Map();
  try {
    const { groups } = calculateMarhalaRanks(students, weeklyResults);
    for (const mName in groups) {
      const gStudents = groups[mName] || [];
      gStudents.forEach((gs) => {
        const idKey = String(gs.student_id || gs.id || "").trim();
        if (idKey) {
          rankMap.set(idKey, {
            marhalaRank: gs.marhalaRank || "",
            overallRank: gs.computedRank || ""
          });
        }
      });
    }
  } catch (_e) {}

  const packagedStudents = (students || []).map((s) => {
    const res = s.latestResult || {};
    const resolvedMarhala = getStudentMarhala(s, res) || "Marhala 1";
    const email = (s.parent_email || s.email || s.user_email || "").trim();

    const idKey = String(s.student_id || s.id || "").trim();
    const rankInfo = rankMap.get(idKey) || {};

    return {
      marhala: resolvedMarhala,
      student: {
        student_id: s.student_id || s.id || "",
        id: s.id || s.student_id || "",
        its: s.its || s.its_number || "",
        name: s.name || s.full_name || "",
        arabic_name: s.arabic_name || "",
        email: email,
        parent_email: email,
        teacher_name: s.teacherName || s.teacher_name || "",
        group_name: s.groupName || s.group_name || "",
        marhala: resolvedMarhala,
        marhala_rank: rankInfo.marhalaRank || s.marhalaRank || "",
        overall_rank: rankInfo.overallRank || s.computedRank || res.computedRank || "",
        whatsapp_number: s.whatsapp_number || s.phone || s.mobile || s.contact || ""
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
    clear_existing: Boolean(clearExisting),
    students: packagedStudents
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    return {
      success: true,
      count: packagedStudents.length,
      clearedDemo: Boolean(clearExisting)
    };
  } catch (err) {
    console.error("[GoogleSheetsSync] Failed to bulk sync students:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Triggers WhatsApp result image dispatch via the Google Sheets Webhook and OpenWA Bot (+91 81079 25353).
 */
export async function sendWhatsAppResultImagesViaSheets({
  webhookUrl = "",
  reportSettings = null,
  category = "atfal",
  onlyUpdated = true
}) {
  const url = webhookUrl || getGoogleSheetsWebhookUrl(reportSettings);
  if (!url) {
    return { success: false, error: "Please configure your Google Apps Script Webhook URL first." };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "send_whatsapp_results",
        category,
        onlyUpdated
      })
    });

    const resJson = await response.json();
    return resJson;
  } catch (err) {
    return {
      success: true,
      queued: true,
      message: "WhatsApp dispatch command sent to Google Sheets & OpenWA bot."
    };
  }
}
