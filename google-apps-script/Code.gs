/**
 * ============================================================================
 * MAUZE TAHFEEZ - GOOGLE SHEETS LIVE SYNC AUTOMATION
 * ============================================================================
 * 
 * 1. Categorization: Routes to Atfal or Kibar spreadsheets.
 * 2. ALL 8 Marhala Tabs: Marhala 1, Marhala 2, Marhala 3, Marhala 4,
 *    Marhala 5, Marhala 6, Marhala 7, and Marhala 8 created in one single sheet.
 * 3. Parents Email Tab: Automatically updates the "parents email" tab with:
 *    email, name, from date, till date, wekly score, total Jadeed,
 *    marhala rank, over all rank, and data update for latest week ("Yes" / "No").
 * 4. Conditional Formatting & Validation:
 *    - Column 9 dropdown with "Yes" and "No".
 *    - Green background for "Yes", Red background for "No".
 * 5. Bulk Sync: Seamlessly receives and lists ALL students from the app into
 *    their respective Marhala tabs and the "parents email" tab.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // If created inside your Atfal Sheet (Extensions > Apps Script), leave as ""
  // Otherwise, paste the 44-character Sheet ID from URL:
  ATFAL_SPREADSHEET_ID: "", 
  KIBAR_SPREADSHEET_ID: "", 
  
  PARENTS_EMAIL_SHEET_NAME: "parents email",
  
  // ALL 8 Canonical Marhalas
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
  
  // Column 9 Dropdown & Formatting Configuration
  STATUS_OPTIONS: ["Yes", "No"],
  COLOR_YES_BG: "#b7e1cd",    // Emerald Green Background
  COLOR_YES_TEXT: "#0d652d",  // Dark Green Text
  COLOR_NO_BG: "#f4c7c3",     // Light Red Background
  COLOR_NO_TEXT: "#c5221f"    // Dark Red Text
};

// ============================================================================
// 1. SAFE RUNNERS FOR THE APPS SCRIPT EDITOR (TOP OF FILE)
// ============================================================================

/**
 * MASTER SETUP FUNCTION:
 * Run this to create ALL 8 Marhala tabs (Marhala 1 to 8), the 'parents email' tab,
 * apply Yes/No validation, and configure Yes(Green)/No(Red) conditional formatting.
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

    Logger.log("🎉 ALL 8 MARHALA TABS + 'parents email' TAB CREATED SUCCESSFULLY!");
    return "All tabs and formatting created successfully!";
  } catch (err) {
    Logger.log("❌ Setup Error: " + err.message);
    throw err;
  }
}

/**
 * Click "Run" on this function to populate sample students across ALL 8 Marhalas
 * and into the 'parents email' tab to preview the complete system.
 */
function testPopulateAllStudents() {
  Logger.log("=== [Mauze Tahfeez] Populating Students Across All 8 Marhalas ===");
  const ss = resolveSpreadsheet("atfal");
  
  // Create all tabs first
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
    Logger.log("⚠️ 'doPost' was run manually from the editor without HTTP POST data.");
    Logger.log("👉 To test your sheet, select 'testSetup' or 'testPopulateAllStudents' from the toolbar dropdown above and click 'Run'.");
    return jsonResponse({
      success: false,
      message: "doPost is an HTTP Webhook endpoint. To initialize, run testSetup() or testPopulateAllStudents()."
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

    // Check for bulk sync of all students
    if (payload.action === "bulk_sync" && Array.isArray(payload.students)) {
      const bulkResult = processBulkSync(payload);
      return jsonResponse(bulkResult, 200);
    }

    // Single student sync
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
  return jsonResponse({
    status: "ok",
    service: "Mauze Tahfeez Google Sheets Live Sync",
    marhalas: CONFIG.ALL_MARHALAS,
    timestamp: new Date().toISOString(),
    message: "Webhook is active and ready to accept POST requests."
  }, 200);
}

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 3. BULK SYNC LOGIC (LIST ALL STUDENTS PROPERLY)
// ============================================================================

function processBulkSync(payload) {
  const category = (payload.category || "atfal").toLowerCase().trim();
  const spreadsheet = resolveSpreadsheet(category);
  const students = payload.students || [];

  // Ensure all tabs exist
  testSetup();

  let syncedCount = 0;
  for (let i = 0; i < students.length; i++) {
    const item = students[i];
    const sPayload = {
      category: category,
      marhala: item.marhala || item.student?.marhala,
      student: item.student || item,
      result: item.result || item.latestResult || {}
    };
    processSyncPayload(sPayload);
    syncedCount++;
  }

  return {
    success: true,
    action: "bulk_sync",
    category: category,
    syncedCount: syncedCount,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// 4. CORE SYNC & ROUTING LOGIC
// ============================================================================

function processSyncPayload(payload) {
  const category = (payload.category || "atfal").toLowerCase().trim();
  const student = payload.student || {};
  const result = payload.result || {};
  
  const spreadsheet = resolveSpreadsheet(category);

  // 1. Resolve exact Marhala Tab (e.g. Marhala 1, Marhala 2, etc.)
  const marhalaName = resolveMarhalaTabName(student.marhala || payload.marhala || result.marhala);
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
    "Please paste your Google Sheet ID into CONFIG." + (category === "kibar" ? "KIBAR" : "ATFAL") + "_SPREADSHEET_ID at line 28."
  );
}

/**
 * Standardize Marhala to one of the 8 canonical Marhala tabs:
 * "Marhala 1" through "Marhala 8"
 */
function resolveMarhalaTabName(rawMarhala) {
  if (!rawMarhala || String(rawMarhala).trim() === "") return "Marhala 1";
  const s = String(rawMarhala).trim().toLowerCase();

  // Handle numbers or Arabic names
  if (s.includes("ula") || s === "marhala 1" || s === "1" || s.endsWith(" 1")) return "Marhala 1";
  if (s.includes("saniyah") || s === "marhala 2" || s === "2" || s.endsWith(" 2")) return "Marhala 2";
  if (s.includes("salesah") || s === "marhala 3" || s === "3" || s.endsWith(" 3")) return "Marhala 3";
  if (s.includes("rabeah") || s === "marhala 4" || s === "4" || s.endsWith(" 4")) return "Marhala 4";
  if (s.includes("khamesah") || s === "marhala 5" || s === "5" || s.endsWith(" 5")) return "Marhala 5";
  if (s.includes("sadesah") || s === "marhala 6" || s === "6" || s.endsWith(" 6")) return "Marhala 6";
  if (s.includes("sabeah") || s === "marhala 7" || s === "7" || s.endsWith(" 7")) return "Marhala 7";
  if (s.includes("saminah") || s === "marhala 8" || s === "8" || s.endsWith(" 8")) return "Marhala 8";

  // Check if an existing sheet matches directly
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getSheetByName(rawMarhala)) return rawMarhala;
  } catch (e) {}

  return "Marhala 1";
}

// ============================================================================
// 5. MARHALA SHEET SYNC
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

function syncMarhalaSheetRow(sheet, student, result) {
  const data = sheet.getDataRange().getValues();
  const studentId = String(student.student_id || student.id || "").trim();
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const weekDate = String(result.week_date || result.till_date || "").trim();

  const headers = data[0] || MARHALA_HEADERS;
  const colStudentId = headers.indexOf("Student ID");
  const colEmail = headers.indexOf("Email");
  const colWeekDate = headers.indexOf("Week Date");

  const rowValues = [
    studentId || "",
    student.its || "",
    student.name || student.full_name || "",
    student.arabic_name || "",
    email || "",
    student.teacher_name || student.teacherName || "",
    student.group_name || student.groupName || "",
    student.marhala || sheet.getName(),
    result.week_date || "",
    result.from_date || result.fatemi_from_date || "",
    result.till_date || result.fatemi_till_date || "",
    (result.fatemi_from_date && result.fatemi_till_date) 
      ? (result.fatemi_from_date + " - " + result.fatemi_till_date + " " + (result.fatemi_till_month_name || ""))
      : (result.fatemi_till_month_name || ""),
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
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
  ];

  let matchRowIndex = -1;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowSid = String(row[colStudentId] || "").trim();
    const rowMail = String(row[colEmail] || "").trim().toLowerCase();
    const rowWeek = String(row[colWeekDate] || "").trim();

    const idMatches = (studentId && rowSid === studentId) || (email && rowMail === email);
    const weekMatches = (!weekDate || !rowWeek || rowWeek === weekDate);

    if (idMatches && weekMatches) {
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

// ============================================================================
// 6. PARENTS EMAIL TAB SYNC
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

function syncParentsEmailSheetRow(sheet, student, result) {
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const name = String(student.name || student.full_name || "").trim();

  if (!email) {
    return { action: "skipped", reason: "No email address found for student: " + name };
  }

  const fromDate = String(result.from_date || result.fatemi_from_date || "").trim();
  const tillDate = String(result.till_date || result.fatemi_till_date || "").trim();
  const weeklyScore = result.total_score !== undefined ? result.total_score : "";
  
  let totalJadeed = "";
  if (result.total_jadeed_pages !== undefined && result.total_jadeed_pages !== null) {
    totalJadeed = String(result.total_jadeed_pages);
    if (result.total_jadeed_unit) totalJadeed += " " + result.total_jadeed_unit;
  }

  const marhalaRank = student.marhala_rank || student.marhalaRank || "";
  const overallRank = student.overall_rank || student.computedRank || "";
  
  // If result has scores, status is "Yes", otherwise default to "No"
  const latestWeekStatus = (weeklyScore !== "" && weeklyScore !== null) ? "Yes" : "No";

  const rowValues = [
    email,
    name,
    fromDate,
    tillDate,
    weeklyScore,
    totalJadeed,
    marhalaRank,
    overallRank,
    latestWeekStatus
  ];

  const data = sheet.getDataRange().getValues();
  let matchRowIndex = -1;

  for (let r = 1; r < data.length; r++) {
    const existingEmail = String(data[r][0] || "").trim().toLowerCase();
    if (existingEmail === email) {
      matchRowIndex = r + 1;
      break;
    }
  }

  if (matchRowIndex > 0) {
    sheet.getRange(matchRowIndex, 1, 1, 9).setValues([rowValues]);
    applyValidationToCell(sheet.getRange(matchRowIndex, 9));
    return { action: "updated", row: matchRowIndex, email: email };
  } else {
    sheet.appendRow(rowValues);
    const newRow = sheet.getLastRow();
    applyValidationToCell(sheet.getRange(newRow, 9));
    return { action: "appended", row: newRow, email: email };
  }
}

// ============================================================================
// 7. CONDITIONAL FORMATTING & VALIDATION SETUP
// ============================================================================

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
