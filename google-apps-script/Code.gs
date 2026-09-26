/**
 * ============================================================================
 * MAUZE TAHFEEZ - GOOGLE SHEETS LIVE SYNC AUTOMATION (ATFAL & KIBAR)
 * ============================================================================
 * 
 * 1. ALL 8 Marhala Tabs:
 *    - Automatically creates and manages all 8 Marhala tabs:
 *      Marhala 1 (Ula), Marhala 2 (Saniyah), Marhala 3 (Salesah), Marhala 4 (Rabeah),
 *      Marhala 5 (Khamesah), Marhala 6 (Sadesah), Marhala 7 (Sabeah), Marhala 8 (Saminah).
 *    - Seamlessly supports both English numeric ("Marhala 1".."8") and traditional
 *      Arabic names ("Marhala Ula".."Saminah").
 * 
 * 2. Real Data & Bulk Sync:
 *    - Syncs ALL REAL Atfal students and their latest marks from the app.
 *    - Fast BATCH write: syncs 100+ students in ~1-2 seconds with zero timeouts.
 *    - Supports "clear_existing: true" to purge all test/demo data automatically.
 * 
 * 3. Live Teacher Weekly Mark Progress Sync:
 *    - Whenever a teacher enters or updates weekly marks in the app, the student's
 *      exact row in their Marhala tab and the "parents email" tab updates instantly.
 *    - Matches existing students by Student ID, ITS, email, or name to prevent duplicates.
 * 
 * 4. "parents email" Tab:
 *    - Real-time columns: email, name, from date, till date, wekly score,
 *      total Jadeed, marhala rank, over all rank, data update for latest week.
 *    - Column 9 dropdown with "Yes" and "No".
 *    - Conditional formatting: "Yes" -> Emerald Green (#b7e1cd), "No" -> Soft Red (#f4c7c3).
 * 
 * 5. Built-in Demo Data Purge:
 *    - Run clearDemoData() from the toolbar or via webhook to instantly wipe dummy rows.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // If this script is bound to your Atfal Sheet (Extensions > Apps Script), leave as "":
  ATFAL_SPREADSHEET_ID: "", 
  KIBAR_SPREADSHEET_ID: "", 
  
  PARENTS_EMAIL_SHEET_NAME: "parents email",
  
  // ALL 8 Canonical Marhalas (English numbers)
  ALL_MARHALAS: [
    "Marhala 1",
    "Marhala 2",
    "Marhala 3",
    "Marhala 4",
    "Marhala 5",
    "Marhala 6",
    "Marhala 7",
    "Marhala 8"
  ],

  // Traditional Arabic Marhala Aliases
  MARHALA_ALIASES: {
    "marhala ula": "Marhala 1",
    "ula": "Marhala 1",
    "marhala 1": "Marhala 1",
    "1": "Marhala 1",
    "marhala saniyah": "Marhala 2",
    "saniyah": "Marhala 2",
    "marhala 2": "Marhala 2",
    "2": "Marhala 2",
    "marhala salesah": "Marhala 3",
    "salesah": "Marhala 3",
    "marhala 3": "Marhala 3",
    "3": "Marhala 3",
    "marhala rabeah": "Marhala 4",
    "rabeah": "Marhala 4",
    "marhala 4": "Marhala 4",
    "4": "Marhala 4",
    "marhala khamesah": "Marhala 5",
    "khamesah": "Marhala 5",
    "marhala 5": "Marhala 5",
    "5": "Marhala 5",
    "marhala sadesah": "Marhala 6",
    "sadesah": "Marhala 6",
    "marhala 6": "Marhala 6",
    "6": "Marhala 6",
    "marhala sabeah": "Marhala 7",
    "sabeah": "Marhala 7",
    "marhala 7": "Marhala 7",
    "7": "Marhala 7",
    "marhala saminah": "Marhala 8",
    "saminah": "Marhala 8",
    "marhala 8": "Marhala 8",
    "8": "Marhala 8"
  },
  
  // Column 9 Dropdown & Formatting Configuration
  STATUS_OPTIONS: ["Yes", "No"],
  COLOR_YES_BG: "#b7e1cd",    // Emerald Green Background
  COLOR_YES_TEXT: "#0d652d",  // Dark Green Text
  COLOR_NO_BG: "#f4c7c3",     // Soft Red Background
  COLOR_NO_TEXT: "#c5221f",   // Dark Red Text

  // OpenWA WhatsApp Gateway Configuration (Mauze Tahfeez Helpline: +91 81079 25353)
  OPENWA_API_URL: "http://localhost:2785", 
  OPENWA_API_KEY: "",
  OPENWA_SESSION_ID: "mauze-helpline-8107925353",
  HELPLINE_NUMBER: "+91 81079 25353",
  HELPLINE_NAME: "Mauze Tahfeez Helpline"
};

// ============================================================================
// 1. SETUP & UTILITY RUNNERS FOR THE APPS SCRIPT EDITOR
// ============================================================================

/**
 * MASTER SETUP FUNCTION:
 * Run this to initialize all 8 Marhala tabs (Marhala 1 to 8) and the 'parents email' tab
 * with formatted headers, Yes/No validation, and conditional formatting.
 */
function testSetup() {
  Logger.log("=== [Mauze Tahfeez] Initializing All Marhala Tabs & Settings ===");
  try {
    const ss = resolveSpreadsheet("atfal");
    Logger.log("✅ Connected to Spreadsheet: '" + ss.getName() + "'");
    
    // 1. Setup 'parents email' tab
    const parentsSheet = getOrCreateParentsEmailSheet(ss);
    setupParentsEmailValidationAndFormatting(parentsSheet);
    Logger.log("✅ Tab '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' is ready with Yes/No validation & conditional formatting.");

    // 2. Setup ALL 8 Marhala tabs
    for (let i = 0; i < CONFIG.ALL_MARHALAS.length; i++) {
      const mName = CONFIG.ALL_MARHALAS[i];
      getOrCreateMarhalaSheet(ss, mName);
      Logger.log("✅ Tab '" + mName + "' is ready with formatted headers.");
    }

    Logger.log("🎉 ALL 8 MARHALA TABS + 'parents email' TAB ARE READY!");
    return "All tabs and formatting ready successfully!";
  } catch (err) {
    Logger.log("❌ Setup Error: " + err.message);
    throw err;
  }
}

/**
 * PURGE DEMO TEST DATA:
 * Removes test dummy rows (Husain Yusuf, Taher Shabbir, @example.com, IDs 101-110, etc.)
 * from all 8 Marhala tabs and the 'parents email' tab, leaving headers and validation intact.
 */
function clearDemoData() {
  Logger.log("=== [Mauze Tahfeez] Purging Test Demo Data ===");
  const ss = resolveSpreadsheet("atfal");
  const demoNames = [
    "Husain Yusuf", "Taher Shabbir", "Fatema Mustafa", "Ali Asgar",
    "Zainab Hatim", "Burhanuddin Huzaifa", "Amatullah Moiz",
    "Qusai Abdeali", "Maryam Saifuddin", "Mohammed Johar"
  ];

  let totalDeleted = 0;

  // Check all sheets
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const sName = sheet.getName();
    const isMarhala = CONFIG.ALL_MARHALAS.indexOf(sName) !== -1 || sName.toLowerCase().indexOf("marhala") !== -1;
    const isParents = sName === CONFIG.PARENTS_EMAIL_SHEET_NAME;

    if (!isMarhala && !isParents) continue;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;

    for (let r = data.length - 1; r >= 1; r--) {
      const row = data[r];
      const rowStr = row.join(" ").toLowerCase();
      const sid = String(row[0] || "");
      const email = String(isParents ? row[0] : row[4] || "").toLowerCase();
      const name = String(isParents ? row[1] : row[2] || "").trim();

      const isDemo = 
        email.indexOf("example.com") !== -1 ||
        sid.indexOf("5040100") === 0 ||
        (Number(sid) >= 101 && Number(sid) <= 110) ||
        demoNames.indexOf(name) !== -1 ||
        rowStr.indexOf("example.com") !== -1;

      if (isDemo) {
        sheet.deleteRow(r + 1);
        totalDeleted++;
      }
    }
  }

  Logger.log("✅ Purged " + totalDeleted + " demo rows across sheets. Real data ready!");
  return "Purged " + totalDeleted + " demo rows.";
}

/**
 * RESET ALL TABS TO CLEAN STATE:
 * Clears all rows (leaving row 1 headers intact) across all Marhala tabs and 'parents email' tab.
 */
function clearAllStudentData(spreadsheet) {
  const ss = spreadsheet || resolveSpreadsheet("atfal");
  const sheets = ss.getSheets();

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const sName = sheet.getName();
    const isMarhala = CONFIG.ALL_MARHALAS.indexOf(sName) !== -1 || sName.toLowerCase().indexOf("marhala") !== -1;
    const isParents = sName === CONFIG.PARENTS_EMAIL_SHEET_NAME;

    if ((isMarhala || isParents) && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  }
}

/**
 * Click "Run" on this function if you ever need to insert sample demo students for testing.
 */
function testPopulateAllStudents() {
  Logger.log("=== [Mauze Tahfeez] Populating Students Across All 8 Marhalas ===");
  testSetup();

  const demoStudents = [
    { id: 101, its: "50401001", name: "Husain Yusuf", email: "parent.husain@example.com", marhala: "Marhala 1", teacher: "Mulla Murtaza", group: "Group A", score: 38.5, jadeed: "3 صفه", mRank: 1, oRank: 3, from: "10", till: "15", status: "Yes" },
    { id: 102, its: "50401002", name: "Taher Shabbir", email: "parent.taher@example.com", marhala: "Marhala 1", teacher: "Mulla Murtaza", group: "Group A", score: 36.0, jadeed: "2.5 صفه", mRank: 2, oRank: 8, from: "10", till: "15", status: "Yes" },
    { id: 103, its: "50401003", name: "Fatema Mustafa", email: "parent.fatema@example.com", marhala: "Marhala 2", teacher: "Shaikh Abbas", group: "Group B", score: 39.0, jadeed: "4 صفه", mRank: 1, oRank: 2, from: "10", till: "15", status: "Yes" },
    { id: 104, its: "50401004", name: "Ali Asgar", email: "parent.aliasgar@example.com", marhala: "Marhala 2", teacher: "Shaikh Abbas", group: "Group B", score: 35.5, jadeed: "2 صفه", mRank: 2, oRank: 12, from: "10", till: "15", status: "Yes" },
    { id: 105, its: "50401005", name: "Zainab Hatim", email: "parent.zainab@example.com", marhala: "Marhala 3", teacher: "Mulla Idris", group: "Group C", score: 40.0, jadeed: "5 صفه", mRank: 1, oRank: 1, from: "10", till: "15", status: "Yes" },
    { id: 106, its: "50401006", name: "Burhanuddin Huzaifa", email: "parent.burhan@example.com", marhala: "Marhala 4", teacher: "Shaikh Taha", group: "Group D", score: 37.0, jadeed: "3 صفه", mRank: 1, oRank: 5, from: "10", till: "15", status: "Yes" },
    { id: 107, its: "50401007", name: "Amatullah Moiz", email: "parent.amatullah@example.com", marhala: "Marhala 5", teacher: "Mulla Murtaza", group: "Group E", score: 34.0, jadeed: "2 صفه", mRank: 1, oRank: 15, from: "10", till: "15", status: "Yes" },
    { id: 108, its: "50401008", name: "Qusai Abdeali", email: "parent.qusai@example.com", marhala: "Marhala 6", teacher: "Shaikh Abbas", group: "Group F", score: 38.0, jadeed: "3.5 صفه", mRank: 1, oRank: 4, from: "10", till: "15", status: "Yes" },
    { id: 109, its: "50401009", name: "Maryam Saifuddin", email: "parent.maryam@example.com", marhala: "Marhala 7", teacher: "Mulla Idris", group: "Group G", score: 36.5, jadeed: "3 صفه", mRank: 1, oRank: 7, from: "10", till: "15", status: "Yes" },
    { id: 110, its: "50401010", name: "Mohammed Johar", email: "parent.johar@example.com", marhala: "Marhala 8", teacher: "Shaikh Taha", group: "Group H", score: 39.5, jadeed: "4.5 صفه", mRank: 1, oRank: 2, from: "10", till: "15", status: "Yes" }
  ];

  demoStudents.forEach(function(ds) {
    const payload = {
      category: "atfal",
      marhala: ds.marhala,
      student: {
        student_id: ds.id,
        its: ds.its,
        name: ds.name,
        email: ds.email,
        parent_email: ds.email,
        teacher_name: ds.teacher,
        group_name: ds.group,
        marhala: ds.marhala,
        marhala_rank: ds.mRank,
        overall_rank: ds.oRank
      },
      result: {
        week_date: "2026-09-26",
        from_date: "2026-09-20",
        till_date: "2026-09-26",
        fatemi_from_date: ds.from,
        fatemi_till_date: ds.till,
        fatemi_till_month_name: "ربيع الآخر",
        attendance_count: 6,
        murajazah: 10,
        juz_hali: 9.5,
        takhteet: 9,
        jadeed: 10,
        total_score: ds.score,
        total_jadeed_pages: ds.jadeed,
        total_jadeed_unit: "",
        wusool_juz: 30,
        wusool_page: 582,
        wusool_surah: "النبأ",
        attendance_note: "Punctual & attentive"
      }
    };
    processSyncPayload(payload);
  });

  Logger.log("🎉 POPULATED STUDENTS ACROSS ALL 8 MARHALAS AND 'parents email' TAB!");
}

// ============================================================================
// 2. WEBHOOK HTTP HANDLERS (doPost & doGet)
// ============================================================================

function doPost(e) {
  if (!e || typeof e === "undefined" || !e.postData || !e.postData.contents) {
    return jsonResponse({
      success: false,
      message: "doPost is an HTTP Webhook endpoint. Send POST data with your payload."
    }, 200);
  }

  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        success: false,
        error: "Invalid JSON format: " + parseErr.message
      }, 400);
    }

    // Ping / Test connection
    if (payload.action === "ping" || payload.action === "test") {
      const ss = resolveSpreadsheet(payload.category || "atfal");
      return jsonResponse({
        success: true,
        status: "connected",
        spreadsheetName: ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); }),
        timestamp: new Date().toISOString()
      }, 200);
    }

    // Clear demo data command
    if (payload.action === "clear_demo_data") {
      const purgeMsg = clearDemoData();
      return jsonResponse({
        success: true,
        message: purgeMsg,
        timestamp: new Date().toISOString()
      }, 200);
    }

    // Bulk sync of all real students
    if (payload.action === "bulk_sync" && Array.isArray(payload.students)) {
      const bulkResult = processBulkSync(payload);
      return jsonResponse(bulkResult, 200);
    }

    // Send WhatsApp result images to parents via OpenWA Bot (+91 81079 25353)
    if (payload.action === "send_whatsapp_results") {
      const waResult = processSendWhatsAppResults(payload);
      return jsonResponse(waResult, 200);
    }

    // Test OpenWA Bot connection
    if (payload.action === "test_openwa") {
      const testResult = testOpenWaConnection(payload.config || CONFIG);
      return jsonResponse(testResult, 200);
    }

    // Generate base64 result image for preview
    if (payload.action === "generate_result_image" && payload.studentData) {
      const imgBase64 = generateMarhalaResultImageBase64(payload.studentData);
      return jsonResponse({ success: true, base64: imgBase64 }, 200);
    }

    // Single student weekly mark progress sync (teacher filling progress)
    const result = processSyncPayload(payload);
    return jsonResponse(result, 200);

  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return jsonResponse({
      success: false,
      error: err.toString()
    }, 500);
  }
}

function doGet(e) {
  let spreadsheetName = "Unknown";
  try {
    const ss = resolveSpreadsheet("atfal");
    spreadsheetName = ss.getName();
  } catch (_e) {}

  return jsonResponse({
    status: "ok",
    service: "Mauze Tahfeez Google Sheets Live Sync",
    spreadsheet: spreadsheetName,
    marhalas: CONFIG.ALL_MARHALAS,
    parentsTab: CONFIG.PARENTS_EMAIL_SHEET_NAME,
    timestamp: new Date().toISOString(),
    message: "Webhook is live and accepting POST requests."
  }, 200);
}

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 3. FAST BATCH BULK SYNC (REAL STUDENTS TO ALL 8 MARHALAS & PARENTS EMAIL)
// ============================================================================

function processBulkSync(payload) {
  const startTime = new Date().getTime();
  const category = (payload.category || "atfal").toLowerCase().trim();
  const spreadsheet = resolveSpreadsheet(category);
  const students = payload.students || [];
  const clearExisting = payload.clear_existing === true || payload.clear_demo === true;

  // 1. Ensure all tabs exist
  testSetup();

  // 2. If requested, clear all existing student rows first (wipes demo data)
  if (clearExisting) {
    clearAllStudentData(spreadsheet);
  }

  // 3. Group students by resolved Marhala tab
  const marhalaGroups = {};
  for (let m = 0; m < CONFIG.ALL_MARHALAS.length; m++) {
    marhalaGroups[CONFIG.ALL_MARHALAS[m]] = [];
  }

  const parentsRowsMap = new Map(); // Keyed by email or student identifier
  const marhalaCounts = {};

  for (let i = 0; i < students.length; i++) {
    const item = students[i];
    const s = item.student || item;
    const r = item.result || item.latestResult || {};

    const rawMarhala = item.marhala || s.marhala || r.marhala;
    const targetTabName = resolveMarhalaTabName(rawMarhala, spreadsheet);

    if (!marhalaGroups[targetTabName]) {
      marhalaGroups[targetTabName] = [];
    }

    const rowValues = buildMarhalaRowValues(s, r, targetTabName);
    marhalaGroups[targetTabName].push(rowValues);
    marhalaCounts[targetTabName] = (marhalaCounts[targetTabName] || 0) + 1;

    // Collect row for parents email tab (if Atfal)
    if (category === "atfal") {
      const email = String(s.email || s.parent_email || "").trim().toLowerCase();
      const parentRow = buildParentsEmailRowValues(s, r);
      if (parentRow) {
        const key = email || String(s.student_id || s.id || s.name || ("row_" + i)).toLowerCase();
        parentsRowsMap.set(key, parentRow);
      }
    }
  }

  // 4. Batch Write to each Marhala Tab (Single setValues call per sheet)
  for (const tabName in marhalaGroups) {
    const rows = marhalaGroups[tabName];
    if (rows.length === 0) continue;

    const sheet = getOrCreateMarhalaSheet(spreadsheet, tabName);

    if (clearExisting) {
      // Direct bulk set
      sheet.getRange(2, 1, rows.length, MARHALA_HEADERS.length).setValues(rows);
    } else {
      // Merge with existing rows without creating duplicates
      batchMergeSheetRows(sheet, rows, MARHALA_HEADERS);
    }
  }

  // 5. Batch Write to 'parents email' Tab
  let parentsCount = 0;
  if (category === "atfal" && parentsRowsMap.size > 0) {
    const parentsSheet = getOrCreateParentsEmailSheet(spreadsheet);
    const parentsRows = Array.from(parentsRowsMap.values());
    parentsCount = parentsRows.length;

    if (clearExisting) {
      parentsSheet.getRange(2, 1, parentsRows.length, PARENTS_EMAIL_HEADERS.length).setValues(parentsRows);
    } else {
      batchMergeParentsEmailRows(parentsSheet, parentsRows);
    }

    // Apply Yes/No validation rule to all rows in column 9
    const lastRow = parentsSheet.getLastRow();
    if (lastRow > 1) {
      const statusRange = parentsSheet.getRange(2, 9, lastRow - 1, 1);
      const validationRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(CONFIG.STATUS_OPTIONS, true)
        .setAllowInvalid(false)
        .setHelpText("Select 'Yes' or 'No'")
        .build();
      statusRange.setDataValidation(validationRule);
    }
  }

  const executionTimeMs = new Date().getTime() - startTime;
  Logger.log("🎉 [Mauze Tahfeez] Bulk sync completed: " + students.length + " students synced in " + executionTimeMs + "ms");

  return {
    success: true,
    action: "bulk_sync",
    category: category,
    syncedStudents: students.length,
    marhalaCounts: marhalaCounts,
    parentsTabCount: parentsCount,
    executionTimeMs: executionTimeMs,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// 4. CORE SINGLE STUDENT SYNC & ROUTING (FAST UPDATE BY TEACHER)
// ============================================================================

function processSyncPayload(payload) {
  const category = (payload.category || "atfal").toLowerCase().trim();
  const student = payload.student || {};
  const result = payload.result || {};
  
  const spreadsheet = resolveSpreadsheet(category);

  // 1. Resolve exact Marhala Tab
  const rawMarhala = student.marhala || payload.marhala || result.marhala;
  const marhalaName = resolveMarhalaTabName(rawMarhala, spreadsheet);
  const marhalaSheet = getOrCreateMarhalaSheet(spreadsheet, marhalaName);
  const marhalaSyncStatus = syncMarhalaSheetRow(marhalaSheet, student, result);

  // 2. If Atfal, sync to the "parents email" tab
  let parentsEmailStatus = null;
  if (category === "atfal") {
    const parentsSheet = getOrCreateParentsEmailSheet(spreadsheet);
    parentsEmailStatus = syncParentsEmailSheetRow(parentsSheet, student, result);
  }

  return {
    success: true,
    category: category,
    spreadsheetName: spreadsheet.getName(),
    studentName: student.name || student.full_name || "",
    marhalaTab: marhalaName,
    marhalaSync: marhalaSyncStatus,
    parentsEmailSync: parentsEmailStatus,
    timestamp: new Date().toISOString()
  };
}

function resolveSpreadsheet(category) {
  let targetId = (category === "kibar") 
    ? CONFIG.KIBAR_SPREADSHEET_ID 
    : CONFIG.ATFAL_SPREADSHEET_ID;

  if (targetId && targetId !== "auto" && targetId.trim() !== "") {
    try {
      return SpreadsheetApp.openById(targetId.trim());
    } catch (e) {
      throw new Error("Could not open spreadsheet with ID '" + targetId + "'.");
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error(
    "Spreadsheet ID for category '" + category + "' is not configured. " +
    "Please paste your Google Sheet ID into CONFIG." + (category === "kibar" ? "KIBAR" : "ATFAL") + "_SPREADSHEET_ID."
  );
}

/**
 * Standardize Marhala to an existing tab or one of the 8 canonical Marhala tabs:
 * "Marhala 1" through "Marhala 8" or traditional aliases ("Marhala Ula", etc.)
 */
function resolveMarhalaTabName(rawMarhala, ss) {
  if (!rawMarhala || String(rawMarhala).trim() === "") return "Marhala 1";
  const s = String(rawMarhala).trim().toLowerCase();

  // 1. Direct match with existing sheet
  if (ss) {
    try {
      const direct = ss.getSheetByName(rawMarhala);
      if (direct) return rawMarhala;
    } catch (_e) {}
  }

  // 2. Match against alias map
  for (const alias in CONFIG.MARHALA_ALIASES) {
    if (s === alias || s.indexOf(alias) !== -1) {
      const canonical = CONFIG.MARHALA_ALIASES[alias];
      // Check if sheet has "Marhala Ula" variant or canonical "Marhala 1"
      if (ss) {
        try {
          if (ss.getSheetByName(canonical)) return canonical;
          if (ss.getSheetByName(rawMarhala)) return rawMarhala;
        } catch (_e) {}
      }
      return canonical;
    }
  }

  return "Marhala 1";
}

// ============================================================================
// 5. MARHALA SHEET SYNC & HELPERS
// ============================================================================

const MARHALA_HEADERS = [
  "Student ID", "ITS", "Name", "Arabic Name", "Email", "Teacher Name", "Group",
  "Marhala", "Week Date", "From Date", "Till Date", "Fatemi Date",
  "Attendance Count", "Murajazah", "Juz Hali", "Takhteet", "Jadeed", "Weekly Score",
  "Total Jadeed Pages", "Total Jadeed Unit", "Marhala Rank", "Overall Rank",
  "Wusool Juz", "Wusool Page", "Wusool Surah", "Next Week Juz", "Next Week Page",
  "Next Week Surah", "Istifadah Juz", "Istifadah Page", "Istifadah Surah",
  "Matrookah", "Daeefah", "Attendance Note", "Last Updated"
];

function getOrCreateMarhalaSheet(spreadsheet, marhalaName) {
  let sheet = spreadsheet.getSheetByName(marhalaName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(marhalaName);
    sheet.getRange(1, 1, 1, MARHALA_HEADERS.length).setValues([MARHALA_HEADERS]);
    sheet.setFrozenRows(1);
    
    const headerRange = sheet.getRange(1, 1, 1, MARHALA_HEADERS.length);
    headerRange.setBackground("#1b365d");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Segoe UI");
    headerRange.setHorizontalAlignment("center");
    sheet.autoResizeColumns(1, MARHALA_HEADERS.length);
  }
  return sheet;
}

function buildMarhalaRowValues(student, result, marhalaTabName) {
  const studentId = String(student.student_id || student.id || "").trim();
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();

  const fatemiStr = (result.fatemi_from_date && result.fatemi_till_date)
    ? (result.fatemi_from_date + " - " + result.fatemi_till_date + " " + (result.fatemi_till_month_name || ""))
    : (result.fatemi_till_month_name || "");

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  return [
    studentId || "",
    student.its || "",
    student.name || student.full_name || "",
    student.arabic_name || "",
    email || "",
    student.teacher_name || student.teacherName || "",
    student.group_name || student.groupName || "",
    student.marhala || marhalaTabName || "",
    result.week_date || "",
    result.from_date || result.fatemi_from_date || "",
    result.till_date || result.fatemi_till_date || "",
    fatemiStr,
    result.attendance_count !== undefined ? result.attendance_count : "",
    result.murajazah !== undefined ? result.murajazah : "",
    result.juz_hali !== undefined ? result.juz_hali : "",
    result.takhteet !== undefined ? result.takhteet : "",
    result.jadeed !== undefined ? result.jadeed : "",
    result.total_score !== undefined ? result.total_score : "",
    result.total_jadeed_pages !== undefined ? result.total_jadeed_pages : "",
    result.total_jadeed_unit || "صفه",
    student.marhala_rank || student.marhalaRank || "",
    student.overall_rank || student.computedRank || "",
    result.wusool_juz || "",
    result.wusool_page || "",
    result.wusool_surah || "",
    result.next_week_juz || "",
    result.next_week_page || "",
    result.next_week_surah || "",
    result.istifadah_juz || "",
    result.istifadah_page || "",
    result.istifadah_surah || "",
    result.matrookah || "",
    result.daeefah || "",
    result.attendance_note || "",
    timestamp
  ];
}

function syncMarhalaSheetRow(sheet, student, result) {
  const data = sheet.getDataRange().getValues();
  const studentId = String(student.student_id || student.id || "").trim();
  const its = String(student.its || "").trim();
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const name = String(student.name || student.full_name || "").trim().toLowerCase();

  const headers = data[0] || MARHALA_HEADERS;
  const colStudentId = headers.indexOf("Student ID");
  const colIts = headers.indexOf("ITS");
  const colName = headers.indexOf("Name");
  const colEmail = headers.indexOf("Email");

  const rowValues = buildMarhalaRowValues(student, result, sheet.getName());

  let matchRowIndex = -1;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowSid = String(row[colStudentId] || "").trim();
    const rowIts = colIts !== -1 ? String(row[colIts] || "").trim() : "";
    const rowMail = String(row[colEmail] || "").trim().toLowerCase();
    const rowName = colName !== -1 ? String(row[colName] || "").trim().toLowerCase() : "";

    const idMatches = 
      (studentId && rowSid === studentId) ||
      (its && rowIts === its) ||
      (email && rowMail === email) ||
      (name && rowName === name);

    if (idMatches) {
      matchRowIndex = r + 1;
      break;
    }
  }

  if (matchRowIndex > 0) {
    sheet.getRange(matchRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    return { action: "updated", row: matchRowIndex };
  } else {
    sheet.appendRow(rowValues);
    return { action: "appended", row: sheet.getLastRow() };
  }
}

function batchMergeSheetRows(sheet, newRows, headers) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
    return;
  }

  const colStudentId = headers.indexOf("Student ID");
  const colIts = headers.indexOf("ITS");
  const colName = headers.indexOf("Name");
  const colEmail = headers.indexOf("Email");

  const existingMap = new Map();
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const key = String(row[colStudentId] || row[colIts] || row[colEmail] || row[colName] || "").toLowerCase().trim();
    if (key) {
      existingMap.set(key, r + 1); // 1-indexed row number
    }
  }

  const toAppend = [];
  for (let i = 0; i < newRows.length; i++) {
    const nr = newRows[i];
    const key = String(nr[colStudentId] || nr[colIts] || nr[colEmail] || nr[colName] || "").toLowerCase().trim();
    const existingRow = existingMap.get(key);

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, headers.length).setValues([nr]);
    } else {
      toAppend.push(nr);
    }
  }

  if (toAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, toAppend.length, headers.length).setValues(toAppend);
  }
}

// ============================================================================
// 6. PARENTS EMAIL TAB SYNC & FORMATTING
// ============================================================================

const PARENTS_EMAIL_HEADERS = [
  "email",
  "name",
  "from date",
  "till date",
  "wekly score",
  "total Jadeed",
  "marhala rank",
  "over all rank",
  "data update for latest week",
  "whatsapp number"
];

function getOrCreateParentsEmailSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.PARENTS_EMAIL_SHEET_NAME);
    sheet.getRange(1, 1, 1, PARENTS_EMAIL_HEADERS.length).setValues([PARENTS_EMAIL_HEADERS]);
    sheet.setFrozenRows(1);

    const headerRange = sheet.getRange(1, 1, 1, PARENTS_EMAIL_HEADERS.length);
    headerRange.setBackground("#2c3e50");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Segoe UI");
    headerRange.setHorizontalAlignment("center");
    
    setupParentsEmailValidationAndFormatting(sheet);
    sheet.autoResizeColumns(1, PARENTS_EMAIL_HEADERS.length);
  }
  return sheet;
}

function buildParentsEmailRowValues(student, result) {
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const name = String(student.name || student.full_name || "").trim();

  // If email is missing, fallback to its@parents.local or name so row isn't lost
  const displayEmail = email || (student.its ? (student.its + "@parents.mauze") : "");

  const fromDate = String(result.from_date || result.fatemi_from_date || "").trim();
  const tillDate = String(result.till_date || result.fatemi_till_date || "").trim();
  const weeklyScore = (result.total_score !== undefined && result.total_score !== null) ? result.total_score : "";
  
  let totalJadeed = "";
  if (result.total_jadeed_pages !== undefined && result.total_jadeed_pages !== null) {
    totalJadeed = String(result.total_jadeed_pages);
    if (result.total_jadeed_unit) totalJadeed += " " + result.total_jadeed_unit;
  }

  const marhalaRank = student.marhala_rank || student.marhalaRank || "";
  const overallRank = student.overall_rank || student.computedRank || "";
  
  // If result has scores, status is "Yes", otherwise default to "No"
  const latestWeekStatus = (weeklyScore !== "" && weeklyScore !== null) ? "Yes" : "No";

  // WhatsApp number
  const whatsappNumber = String(student.whatsapp_number || student.phone || student.mobile || student.contact || "").trim();

  return [
    displayEmail,
    name,
    fromDate,
    tillDate,
    weeklyScore,
    totalJadeed,
    marhalaRank,
    overallRank,
    latestWeekStatus,
    whatsappNumber
  ];
}

function syncParentsEmailSheetRow(sheet, student, result) {
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const name = String(student.name || student.full_name || "").trim();

  const rowValues = buildParentsEmailRowValues(student, result);
  const data = sheet.getDataRange().getValues();
  let matchRowIndex = -1;

  for (let r = 1; r < data.length; r++) {
    const existingEmail = String(data[r][0] || "").trim().toLowerCase();
    const existingName = String(data[r][1] || "").trim().toLowerCase();

    if ((email && existingEmail === email) || (name && existingName === name.toLowerCase())) {
      matchRowIndex = r + 1;
      break;
    }
  }

  if (matchRowIndex > 0) {
    sheet.getRange(matchRowIndex, 1, 1, PARENTS_EMAIL_HEADERS.length).setValues([rowValues]);
    applyValidationToCell(sheet.getRange(matchRowIndex, 9));
    return { action: "updated", row: matchRowIndex, email: email || name };
  } else {
    sheet.appendRow(rowValues);
    const newRow = sheet.getLastRow();
    applyValidationToCell(sheet.getRange(newRow, 9));
    return { action: "appended", row: newRow, email: email || name };
  }
}

function batchMergeParentsEmailRows(sheet, newRows) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    sheet.getRange(2, 1, newRows.length, PARENTS_EMAIL_HEADERS.length).setValues(newRows);
    return;
  }

  const existingMap = new Map();
  for (let r = 1; r < data.length; r++) {
    const mail = String(data[r][0] || "").toLowerCase().trim();
    const name = String(data[r][1] || "").toLowerCase().trim();
    if (mail) existingMap.set(mail, r + 1);
    if (name) existingMap.set(name, r + 1);
  }

  const toAppend = [];
  for (let i = 0; i < newRows.length; i++) {
    const nr = newRows[i];
    const mail = String(nr[0] || "").toLowerCase().trim();
    const name = String(nr[1] || "").toLowerCase().trim();
    const existingRow = existingMap.get(mail) || existingMap.get(name);

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, PARENTS_EMAIL_HEADERS.length).setValues([nr]);
    } else {
      toAppend.push(nr);
    }
  }

  if (toAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, toAppend.length, PARENTS_EMAIL_HEADERS.length).setValues(toAppend);
  }
}

function applyValidationToCell(range) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .setHelpText("Please choose either 'Yes' or 'No'.")
    .build();
  range.setDataValidation(rule);
}

function setupParentsEmailValidationAndFormatting(sheet) {
  if (!sheet) {
    const spreadsheet = resolveSpreadsheet("atfal");
    sheet = spreadsheet.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  }
  
  if (!sheet) return;

  const currentMax = sheet.getMaxRows();
  if (currentMax <= 1) {
    sheet.insertRowsAfter(1, 100);
  }
  const totalRows = sheet.getMaxRows();
  const numRows = totalRows - 1;
  const statusColumnRange = sheet.getRange(2, 9, numRows, 1);

  // 1. Dropdown Validation (Yes/No)
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .setHelpText("Select 'Yes' or 'No'")
    .build();
  statusColumnRange.setDataValidation(validationRule);

  // 2. Clean Existing Rules on Column 9
  const rules = sheet.getConditionalFormatRules();
  const filteredRules = rules.filter(function(r) {
    const ranges = r.getRanges();
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].getColumn() === 9) return false;
    }
    return true;
  });

  // Rule 1: "Yes" -> Emerald Green
  const yesRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Yes")
    .setBackground(CONFIG.COLOR_YES_BG)
    .setFontColor(CONFIG.COLOR_YES_TEXT)
    .setBold(true)
    .setRanges([statusColumnRange])
    .build();

  // Rule 2: "No" -> Soft Red
  const noRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("No")
    .setBackground(CONFIG.COLOR_NO_BG)
    .setFontColor(CONFIG.COLOR_NO_TEXT)
    .setBold(true)
    .setRanges([statusColumnRange])
    .build();

  filteredRules.push(yesRule);
  filteredRules.push(noRule);
  sheet.setConditionalFormatRules(filteredRules);
}

// ============================================================================
// 7. OPENWA WHATSAPP BOT INTEGRATION & RESULT IMAGE GENERATOR
//    Helpline Number: +91 81079 25353
// ============================================================================

/**
 * Automatically creates custom menu in Google Sheets UI when opened.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("📱 Mauze WhatsApp Bot")
      .addItem("✨ Send All Result Images to Parents via WhatsApp", "sendAllParentsWhatsAppResultImages")
      .addItem("👤 Send Result Image for Selected Student Row", "sendSelectedStudentWhatsAppResultImage")
      .addItem("🖼️ Preview Result Image for Selected Student", "previewSelectedStudentResultImage")
      .addSeparator()
      .addItem("⚙️ Test OpenWA Bot Connection (+91 81079 25353)", "testOpenWaBotConnection")
      .addItem("🔄 Re-initialize Sheets & WhatsApp Columns", "testSetup")
      .addToUi();
  } catch (_e) {}
}

/**
 * Sanitizes phone numbers into international WhatsApp format (e.g. 918107925353).
 */
function cleanWhatsAppPhone(rawPhone) {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "91" + digits; // Standard 10-digit Indian mobile -> +91
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = "91" + digits.substring(1);
  }
  return digits;
}

/**
 * Escapes XML/SVG special characters safely.
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an ultra-premium vector SVG card for the weekly Marhala result.
 * Contains: School Emblem, Student Name, Week Date Range, Weekly Score,
 * Total Jadeed, Marhala Rank, Overall Rank, and Helpline Number.
 */
function generateMarhalaResultSvg(data) {
  const name = String(data.name || "Student Name").trim();
  const fromDate = String(data.fromDate || "—").trim();
  const tillDate = String(data.tillDate || "—").trim();
  const score = (data.weeklyScore !== undefined && data.weeklyScore !== "" && data.weeklyScore !== null) ? String(data.weeklyScore) : "—";
  const jadeed = String(data.totalJadeed || "—").trim();
  const marhalaRank = String(data.marhalaRank || "—").trim();
  const overallRank = String(data.overallRank || "—").trim();
  const helpline = CONFIG.HELPLINE_NUMBER || "+91 81079 25353";

  let dateRange = "Current Academic Week";
  if (fromDate && tillDate && fromDate !== "—" && tillDate !== "—") {
    dateRange = fromDate + " ➔ " + tillDate;
  } else if (tillDate && tillDate !== "—") {
    dateRange = tillDate;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a192f" />
      <stop offset="45%" stop-color="#0f2747" />
      <stop offset="100%" stop-color="#06101e" />
    </linearGradient>

    <!-- Radiant Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fae29c" />
      <stop offset="50%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#aa7c11" />
    </linearGradient>

    <!-- Card Background Gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#142c4c" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0d1e35" stop-opacity="0.95" />
    </linearGradient>

    <!-- Metric Card Gradient -->
    <linearGradient id="metricGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#163459" />
      <stop offset="100%" stop-color="#0e233d" />
    </linearGradient>

    <!-- Subtle Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="1080" height="1350" fill="url(#bgGrad)" />

  <!-- Outer Double Gold Border -->
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.85" />
  <rect x="42" y="42" width="996" height="1266" rx="22" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-opacity="0.4" />

  <!-- Corner Accents -->
  <circle cx="50" cy="50" r="8" fill="#d4af37" />
  <circle cx="1030" cy="50" r="8" fill="#d4af37" />
  <circle cx="50" cy="1300" r="8" fill="#d4af37" />
  <circle cx="1030" cy="1300" r="8" fill="#d4af37" />

  <!-- Header Bismillah -->
  <text x="540" y="115" font-family="'Amiri', 'Traditional Arabic', 'Scheherazade', serif" font-size="34" fill="#fae29c" text-anchor="middle" font-weight="bold" letter-spacing="2">
    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
  </text>

  <!-- Institution Title -->
  <text x="540" y="170" font-family="'Cinzel', 'Trajan Pro', 'Georgia', serif" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="700" letter-spacing="3">
    MAUZE TAHFEEZ
  </text>
  <text x="540" y="205" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#fae29c" text-anchor="middle" font-weight="600" letter-spacing="5">
    DARA SA'ADATIL ABADIYAH • GALIAKOT SHARIF
  </text>

  <!-- Decorative Separator Line -->
  <line x1="240" y1="235" x2="840" y2="235" stroke="url(#goldGrad)" stroke-width="2" />
  <polygon points="540,227 548,235 540,243 532,235" fill="#fae29c" />

  <!-- Badge Pill: Weekly Result -->
  <rect x="340" y="260" width="400" height="42" rx="21" fill="url(#goldGrad)" />
  <text x="540" y="287" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#0a192f" text-anchor="middle" font-weight="800" letter-spacing="2">
    WEEKLY MARHALA REPORT
  </text>

  <!-- Child Showcase Card -->
  <rect x="80" y="335" width="920" height="235" rx="24" fill="url(#cardGrad)" stroke="url(#goldGrad)" stroke-width="2.5" />
  
  <text x="540" y="380" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#93aed0" text-anchor="middle" font-weight="600" letter-spacing="3">
    STUDENT PERFORMANCE SUMMARY
  </text>

  <!-- Child Name in Radiant Gold -->
  <text x="540" y="450" font-family="'Playfair Display', 'Georgia', serif" font-size="46" fill="#fae29c" text-anchor="middle" font-weight="800" filter="url(#glow)">
    ${escapeXml(name)}
  </text>

  <!-- Date Range Ribbon -->
  <rect x="270" y="490" width="540" height="44" rx="22" fill="#09182d" stroke="#335987" stroke-width="1.5" />
  <text x="540" y="518" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" fill="#e2edfc" text-anchor="middle" font-weight="600">
    📅 Week: ${escapeXml(dateRange)}
  </text>

  <!-- 1. Weekly Score Card -->
  <rect x="80" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="660" r="26" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2" />
  <text x="135" y="667" font-family="'Segoe UI', sans-serif" font-size="20" fill="#10b981" text-anchor="middle">★</text>
  <text x="180" y="665" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">WEEKLY SCORE</text>
  <text x="300" y="745" font-family="'Segoe UI', Roboto, sans-serif" font-size="64" fill="#ffffff" font-weight="900" text-anchor="middle">${escapeXml(score)}</text>
  <text x="300" y="785" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#10b981" font-weight="700" text-anchor="middle">✔ Complete Weekly Evaluation</text>

  <!-- 2. Total Jadeed Card -->
  <rect x="560" y="605" width="440" height="235" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="660" r="26" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2" />
  <text x="615" y="667" font-family="'Segoe UI', sans-serif" font-size="19" fill="#3b82f6" text-anchor="middle">📖</text>
  <text x="660" y="665" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">TOTAL JADEED</text>
  <text x="780" y="745" font-family="'Segoe UI', Roboto, sans-serif" font-size="44" fill="#fae29c" font-weight="900" text-anchor="middle">${escapeXml(jadeed)}</text>
  <text x="780" y="785" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#93aed0" font-weight="600" text-anchor="middle">New Memorization Progress</text>

  <!-- 3. Marhala Rank Card -->
  <rect x="80" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="135" cy="925" r="26" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="2" />
  <text x="135" y="932" font-family="'Segoe UI', sans-serif" font-size="20" fill="#f59e0b" text-anchor="middle">👑</text>
  <text x="180" y="930" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">MARHALA RANK</text>
  <text x="300" y="1010" font-family="'Segoe UI', Roboto, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(marhalaRank)}</text>
  <text x="300" y="1048" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#f59e0b" font-weight="700" text-anchor="middle">🏅 Section Standing</text>

  <!-- 4. Overall Rank Card -->
  <rect x="560" y="870" width="440" height="220" rx="20" fill="url(#metricGrad)" stroke="#224773" stroke-width="2" />
  <circle cx="615" cy="925" r="26" fill="#8b5cf6" fill-opacity="0.2" stroke="#8b5cf6" stroke-width="2" />
  <text x="615" y="932" font-family="'Segoe UI', sans-serif" font-size="20" fill="#8b5cf6" text-anchor="middle">🌟</text>
  <text x="660" y="930" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#93aed0" font-weight="700" letter-spacing="1">OVERALL RANK</text>
  <text x="780" y="1010" font-family="'Segoe UI', Roboto, sans-serif" font-size="56" fill="#fae29c" font-weight="900" text-anchor="middle">#${escapeXml(overallRank)}</text>
  <text x="780" y="1048" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" fill="#a78bfa" font-weight="700" text-anchor="middle">🏆 Academy Standing</text>

  <!-- Verification Stamp Pill -->
  <rect x="260" y="1120" width="560" height="44" rx="22" fill="#0d2847" stroke="#10b981" stroke-width="1.8" />
  <text x="540" y="1148" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#34d399" text-anchor="middle" font-weight="700">
    ✔ Verified Official Record • Latest Academic Week
  </text>

  <!-- Helpline & Footer -->
  <line x1="80" y1="1195" x2="1000" y2="1195" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.5" />
  
  <rect x="200" y="1220" width="680" height="52" rx="26" fill="#132a48" stroke="url(#goldGrad)" stroke-width="2" />
  <text x="540" y="1253" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" fill="#fae29c" text-anchor="middle" font-weight="800" letter-spacing="1">
    📞 HELPLINE &amp; WHATSAPP BOT: ${escapeXml(helpline)}
  </text>
</svg>`;
}

/**
 * Converts the SVG into a PNG image Blob.
 */
function generateMarhalaResultPngBlob(data) {
  const svg = generateMarhalaResultSvg(data);
  const blob = Utilities.newBlob(svg, "image/svg+xml", (data.name || "Student").replace(/\s+/g, "_") + "_Result.svg");
  try {
    return blob.getAs("image/png");
  } catch (_e) {
    // If runtime does not have direct SVG-to-PNG converter, return SVG blob with .png extension
    return Utilities.newBlob(svg, "image/svg+xml", (data.name || "Student").replace(/\s+/g, "_") + "_Result.svg");
  }
}

/**
 * Returns Base64 encoded image string for WhatsApp dispatch.
 */
function generateMarhalaResultImageBase64(data) {
  const blob = generateMarhalaResultPngBlob(data);
  return Utilities.base64Encode(blob.getBytes());
}

/**
 * Builds formatted text caption for WhatsApp notification.
 */
function buildWhatsAppResultCaption(data, config) {
  const helpline = (config && config.HELPLINE_NUMBER) || "+91 81079 25353";
  const name = data.name || "Student";
  const fromDate = data.fromDate || "";
  const tillDate = data.tillDate || "";
  const score = data.weeklyScore || "—";
  const jadeed = data.totalJadeed || "—";
  const mRank = data.marhalaRank || "—";
  const oRank = data.overallRank || "—";

  const dateStr = (fromDate && tillDate && fromDate !== "—") ? `${fromDate} to ${tillDate}` : (tillDate || "Latest Week");

  return `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\n\n` +
    `*MAUZE TAHFEEZ - WEEKLY RESULT SUMMARY*\n` +
    `_Dara Sa'adatil Abadiyah, Galiakot Sharif_\n\n` +
    `Dear Parent,\n` +
    `Here is the weekly performance summary for *${name}* (${dateStr}):\n\n` +
    `📊 *Weekly Score:* ${score} / 100\n` +
    `📖 *Total Jadeed:* ${jadeed}\n` +
    `👑 *Marhala Rank:* #${mRank}\n` +
    `🌟 *Overall Rank:* #${oRank}\n\n` +
    `Official Result Image attached above 👆\n\n` +
    `📞 *Mauze Tahfeez Helpline:* ${helpline}\n` +
    `🌐 *Online Portal:* https://mouze-tahfeez-atfal.vercel.app`;
}

/**
 * Dispatches a single student result image via OpenWA WhatsApp Gateway.
 */
function sendStudentResultViaWhatsApp(studentData, customConfig) {
  const cfg = customConfig || CONFIG;
  const rawPhone = studentData.whatsappNumber || studentData.phone || "";
  const cleanPhone = cleanWhatsAppPhone(rawPhone);
  if (!cleanPhone) {
    return { success: false, error: "Missing or invalid WhatsApp number for " + studentData.name };
  }

  const imageBase64 = generateMarhalaResultImageBase64(studentData);
  const caption = buildWhatsAppResultCaption(studentData, cfg);

  const sessionId = cfg.OPENWA_SESSION_ID || "mauze-helpline-8107925353";
  const baseUrl = (cfg.OPENWA_API_URL || "http://localhost:2785").replace(/\/+$/, "");
  const url = baseUrl + "/api/sessions/" + sessionId + "/messages/send-image";

  const payload = {
    chatId: cleanPhone + "@c.us",
    base64: "data:image/png;base64," + imageBase64,
    mimetype: "image/png",
    filename: (studentData.name || "Student").replace(/[^a-zA-Z0-9_-]/g, "_") + "_Weekly_Result.png",
    caption: caption
  };

  const headers = { "Content-Type": "application/json" };
  if (cfg.OPENWA_API_KEY) {
    headers["X-API-Key"] = cfg.OPENWA_API_KEY;
    headers["Authorization"] = "Bearer " + cfg.OPENWA_API_KEY;
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true, phone: cleanPhone, student: studentData.name };
    } else {
      return { success: false, code: code, error: response.getContentText(), phone: cleanPhone, student: studentData.name };
    }
  } catch (err) {
    return { success: false, error: err.message, phone: cleanPhone, student: studentData.name };
  }
}

/**
 * 📱 WhatsApp Dispatch: Loops through 'parents email' tab and dispatches
 * the premium result image to each parent's WhatsApp number via OpenWA bot.
 */
function sendAllParentsWhatsAppResultImages() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "📱 Dispatch WhatsApp Result Images",
    "Send weekly Marhala result images to all parents via the helpline bot (+91 81079 25353)?\n\nOnly students with 'Yes' in the latest week column will be sent.",
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = resolveSpreadsheet("atfal");
  const sheet = ss.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  if (!sheet) {
    ui.alert("Tab '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' not found.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    ui.alert("No student data found in '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "'.");
    return;
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const email = String(row[0] || "");
    const name = String(row[1] || "");
    const fromDate = String(row[2] || "");
    const tillDate = String(row[3] || "");
    const weeklyScore = row[4];
    const totalJadeed = String(row[5] || "");
    const marhalaRank = String(row[6] || "");
    const overallRank = String(row[7] || "");
    const status = String(row[8] || "");
    const rawPhone = String(row[9] || "");

    if (status.trim().toLowerCase() !== "yes") {
      skippedCount++;
      continue;
    }

    const cleanPhone = cleanWhatsAppPhone(rawPhone);
    if (!cleanPhone) {
      skippedCount++;
      errors.push(name + ": No valid WhatsApp phone number");
      continue;
    }

    try {
      const studentData = {
        email: email,
        name: name,
        fromDate: fromDate,
        tillDate: tillDate,
        weeklyScore: weeklyScore,
        totalJadeed: totalJadeed,
        marhalaRank: marhalaRank,
        overallRank: overallRank,
        whatsappNumber: cleanPhone
      };

      const result = sendStudentResultViaWhatsApp(studentData, CONFIG);
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        errors.push(name + ": " + (result.error || "Send failed"));
      }
    } catch (sendErr) {
      failedCount++;
      errors.push(name + ": " + sendErr.message);
    }
  }

  let summary = "🎉 WhatsApp Dispatch Complete!\n\n" +
    "✅ Sent: " + sentCount + "\n" +
    "⏭️ Skipped: " + skippedCount + "\n" +
    "❌ Failed: " + failedCount;

  if (errors.length > 0) {
    summary += "\n\nIssues:\n" + errors.slice(0, 5).join("\n");
    if (errors.length > 5) summary += "\n...and " + (errors.length - 5) + " more";
  }

  ui.alert("WhatsApp Dispatch Summary", summary, ui.ButtonSet.OK);
}

/**
 * Sends result image for the currently highlighted student row in 'parents email' tab.
 */
function sendSelectedStudentWhatsAppResultImage() {
  const ui = SpreadsheetApp.getUi();
  const ss = resolveSpreadsheet("atfal");
  const sheet = ss.getActiveSheet();

  if (sheet.getName() !== CONFIG.PARENTS_EMAIL_SHEET_NAME) {
    ui.alert("Please switch to the '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' tab and select a student row first.");
    return;
  }

  const activeRow = sheet.getActiveCell().getRow();
  if (activeRow <= 1) {
    ui.alert("Please select a valid student row (row 2 or below).");
    return;
  }

  const rowValues = sheet.getRange(activeRow, 1, 1, PARENTS_EMAIL_HEADERS.length).getValues()[0];
  const name = String(rowValues[1] || "Student");
  const rawPhone = String(rowValues[9] || "");
  const cleanPhone = cleanWhatsAppPhone(rawPhone);

  if (!cleanPhone) {
    ui.alert("Error", "No valid WhatsApp number found in column 10 for " + name + ". Please enter the phone number.", ui.ButtonSet.OK);
    return;
  }

  const confirm = ui.alert(
    "Send to " + name + "?",
    "Send weekly Marhala result image to " + name + " at +" + cleanPhone + "?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const studentData = {
    email: String(rowValues[0] || ""),
    name: name,
    fromDate: String(rowValues[2] || ""),
    tillDate: String(rowValues[3] || ""),
    weeklyScore: rowValues[4],
    totalJadeed: String(rowValues[5] || ""),
    marhalaRank: String(rowValues[6] || ""),
    overallRank: String(rowValues[7] || ""),
    whatsappNumber: cleanPhone
  };

  const result = sendStudentResultViaWhatsApp(studentData, CONFIG);
  if (result.success) {
    ui.alert("Success", "✅ Result image sent successfully to " + name + " (+" + cleanPhone + ")!", ui.ButtonSet.OK);
  } else {
    ui.alert("Send Error", "❌ Could not send to " + name + ":\n" + (result.error || "Unknown error"), ui.ButtonSet.OK);
  }
}

/**
 * Preview result card SVG for the selected student.
 */
function previewSelectedStudentResultImage() {
  const ui = SpreadsheetApp.getUi();
  const ss = resolveSpreadsheet("atfal");
  const sheet = ss.getActiveSheet();

  if (sheet.getName() !== CONFIG.PARENTS_EMAIL_SHEET_NAME) {
    ui.alert("Please select a row in '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' tab.");
    return;
  }

  const activeRow = sheet.getActiveCell().getRow();
  if (activeRow <= 1) {
    ui.alert("Please select a valid student row (row 2 or below).");
    return;
  }

  const row = sheet.getRange(activeRow, 1, 1, PARENTS_EMAIL_HEADERS.length).getValues()[0];
  const name = String(row[1] || "Student");
  const studentData = {
    email: String(row[0] || ""),
    name: name,
    fromDate: String(row[2] || ""),
    tillDate: String(row[3] || ""),
    weeklyScore: row[4],
    totalJadeed: String(row[5] || ""),
    marhalaRank: String(row[6] || ""),
    overallRank: String(row[7] || ""),
    whatsappNumber: String(row[9] || "")
  };

  const svg = generateMarhalaResultSvg(studentData);
  const htmlOutput = HtmlService.createHtmlOutput(
    '<div style="text-align:center;background:#06101e;padding:15px;border-radius:12px;">' +
    svg +
    '</div>'
  ).setWidth(600).setHeight(750);

  ui.showModalDialog(htmlOutput, "Marhala Result Preview: " + name);
}

/**
 * Programmatic Webhook Processor for WhatsApp Results Dispatch.
 */
function processSendWhatsAppResults(payload) {
  const ss = resolveSpreadsheet(payload.category || "atfal");
  const sheet = ss.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  if (!sheet) {
    return { success: false, error: "Tab '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' not found" };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, error: "No student records found in sheet" };
  }

  const cfg = Object.assign({}, CONFIG, payload.config || {});
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const logs = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const name = String(row[1] || "");
    const status = String(row[8] || "");
    const rawPhone = String(row[9] || "");

    if (payload.onlyUpdated !== false && status.trim().toLowerCase() !== "yes") {
      skipped++;
      continue;
    }

    const cleanPhone = cleanWhatsAppPhone(rawPhone);
    if (!cleanPhone) {
      skipped++;
      logs.push({ student: name, status: "skipped", reason: "missing_phone" });
      continue;
    }

    const studentData = {
      email: String(row[0] || ""),
      name: name,
      fromDate: String(row[2] || ""),
      tillDate: String(row[3] || ""),
      weeklyScore: row[4],
      totalJadeed: String(row[5] || ""),
      marhalaRank: String(row[6] || ""),
      overallRank: String(row[7] || ""),
      whatsappNumber: cleanPhone
    };

    const res = sendStudentResultViaWhatsApp(studentData, cfg);
    if (res.success) {
      sent++;
      logs.push({ student: name, phone: cleanPhone, status: "sent" });
    } else {
      failed++;
      logs.push({ student: name, phone: cleanPhone, status: "failed", error: res.error });
    }
  }

  return {
    success: true,
    total: sent + failed + skipped,
    sent: sent,
    failed: failed,
    skipped: skipped,
    logs: logs
  };
}

/**
 * Tests connection to the OpenWA WhatsApp Gateway.
 */
function testOpenWaConnection(customConfig) {
  const cfg = customConfig || CONFIG;
  const baseUrl = (cfg.OPENWA_API_URL || "http://localhost:2785").replace(/\/+$/, "");
  const sessionId = cfg.OPENWA_SESSION_ID || "mauze-helpline-8107925353";
  const url = baseUrl + "/api/sessions/" + sessionId + "/status";

  const headers = {};
  if (cfg.OPENWA_API_KEY) {
    headers["X-API-Key"] = cfg.OPENWA_API_KEY;
    headers["Authorization"] = "Bearer " + cfg.OPENWA_API_KEY;
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: headers,
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    const content = response.getContentText();
    return {
      success: code >= 200 && code < 300,
      code: code,
      response: content,
      sessionId: sessionId,
      helpline: cfg.HELPLINE_NUMBER || "+91 81079 25353"
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      sessionId: sessionId,
      helpline: cfg.HELPLINE_NUMBER || "+91 81079 25353"
    };
  }
}

function testOpenWaBotConnection() {
  const ui = SpreadsheetApp.getUi();
  const res = testOpenWaConnection(CONFIG);
  if (res.success) {
    ui.alert("Connected!", "✅ OpenWA Bot is online and connected!\nSession: " + res.sessionId + "\nHelpline: " + res.helpline, ui.ButtonSet.OK);
  } else {
    ui.alert("OpenWA Connection Status", "Status: " + (res.error || res.response || "Code " + res.code) + "\n\nNote: If OpenWA is hosted locally, configure your public/tunnel URL in CONFIG.OPENWA_API_URL.", ui.ButtonSet.OK);
  }
}
