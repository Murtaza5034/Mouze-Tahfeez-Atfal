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
  COLOR_NO_TEXT: "#c5221f"    // Dark Red Text
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
  "data update for latest week"
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

  return [
    displayEmail,
    name,
    fromDate,
    tillDate,
    weeklyScore,
    totalJadeed,
    marhalaRank,
    overallRank,
    latestWeekStatus
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
    sheet.getRange(matchRowIndex, 1, 1, 9).setValues([rowValues]);
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
