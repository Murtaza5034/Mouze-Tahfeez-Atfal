/**
 * ============================================================================
 * MAUZE TAHFEEZ - GOOGLE SHEETS LIVE SYNC AUTOMATION
 * ============================================================================
 * 
 * Instructions:
 * 1. Put your Google Sheet ID(s) in CONFIG below.
 * 2. In the toolbar function dropdown, select "testSetup" and click "Run".
 * 3. Deploy as Web App: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 */

// ============================================================================
// CONFIGURATION: Set your Google Spreadsheet IDs here
// ============================================================================
const CONFIG = {
  // If this script is created inside your Atfal Sheet (Extensions > Apps Script),
  // leave ATFAL_SPREADSHEET_ID as "" and it will auto-detect the active sheet.
  // Otherwise, paste the 44-character Sheet ID from your Google Sheet URL:
  // (e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit)
  ATFAL_SPREADSHEET_ID: "", 
  KIBAR_SPREADSHEET_ID: "", 
  
  PARENTS_EMAIL_SHEET_NAME: "parents email",
  
  // Status dropdown options for Column 9
  STATUS_OPTIONS: ["Yes", "No"],
  
  // Colors for Conditional Formatting (Green for Yes, Red for No)
  COLOR_YES_BG: "#b7e1cd",    // Soft Mint / Emerald Green
  COLOR_YES_TEXT: "#0d652d",  // Dark Forest Green
  COLOR_NO_BG: "#f4c7c3",     // Soft Rose / Light Red
  COLOR_NO_TEXT: "#c5221f"    // Dark Rich Red
};

// ============================================================================
// 1. SAFE RUNNERS FOR THE APPS SCRIPT EDITOR (TOP OF FILE)
// (Selected by default when you click "Run" in the toolbar)
// ============================================================================

/**
 * Click "Run" on this function in the toolbar to initialize tabs,
 * set up headers, apply dropdown validation, and configure conditional formatting.
 */
function testSetup() {
  Logger.log("=== [Mauze Tahfeez] Running Sheet Setup ===");
  try {
    const ss = resolveSpreadsheet("atfal");
    Logger.log("✅ Successfully connected to spreadsheet: '" + ss.getName() + "'");
    
    // Setup or get 'parents email' tab
    const parentsSheet = getOrCreateParentsEmailSheet(ss);
    Logger.log("✅ Tab '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' is ready.");
    
    // Apply validation & formatting
    setupParentsEmailValidationAndFormatting(parentsSheet);
    Logger.log("✅ Applied Yes/No dropdown validation and Yes(Green)/No(Red) conditional formatting to Column 9.");

    // Setup default Marhala 1 tab
    getOrCreateMarhalaSheet(ss, "Marhala 1");
    Logger.log("✅ Tab 'Marhala 1' is ready with formatted headers.");

    Logger.log("🎉 ALL SETTINGS APPLIED SUCCESSFULLY! You can now Deploy as Web App.");
    return "Setup completed successfully!";
  } catch (err) {
    Logger.log("❌ Setup Error: " + err.message);
    if (err.message.indexOf("Spreadsheet ID") !== -1) {
      Logger.log("👉 TIP: If this is a standalone script, paste your Google Sheet ID in CONFIG.ATFAL_SPREADSHEET_ID at line 25.");
    }
    throw err;
  }
}

/**
 * Click "Run" on this function to simulate an incoming mark progress update from the app
 */
function testMockSync() {
  Logger.log("=== [Mauze Tahfeez] Simulating Test Mark Progress Push ===");
  const mockPayload = {
    category: "atfal",
    marhala: "Marhala 1",
    student: {
      student_id: 101,
      name: "Husain Yusuf Test",
      arabic_name: "حسين يوسف",
      email: "test.parent@example.com",
      parent_email: "test.parent@example.com",
      its: "50401234",
      teacher_name: "Mulla Murtaza",
      group_name: "Group Alif",
      marhala: "Marhala 1",
      marhala_rank: 1,
      overall_rank: 3
    },
    result: {
      week_date: "2026-09-26",
      from_date: "2026-09-20",
      till_date: "2026-09-26",
      fatemi_from_date: 10,
      fatemi_till_date: 15,
      fatemi_till_month_name: "ربيع الآخر",
      attendance_count: 6,
      murajazah: 10,
      juz_hali: 9.5,
      takhteet: 9,
      jadeed: 10,
      total_score: 38.5,
      total_jadeed_pages: 3,
      total_jadeed_unit: "صفه",
      wusool_juz: 30,
      wusool_page: 582,
      wusool_surah: "النبأ",
      attendance_note: "Mumtaz performance!"
    }
  };

  const res = processSyncPayload(mockPayload);
  Logger.log("✅ Mock sync completed successfully!");
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

// ============================================================================
// 2. WEBHOOK HTTP HANDLERS (doPost & doGet)
// ============================================================================

/**
 * Main Webhook endpoint to accept JSON payloads from Mauze Tahfeez App.
 * NOTE: When clicked via the editor's manual "Run" button without HTTP data,
 * this function safely logs helpful guidance instead of throwing an error.
 */
function doPost(e) {
  // If clicked manually from Apps Script Editor
  if (!e || typeof e === "undefined" || !e.postData || !e.postData.contents) {
    Logger.log("⚠️ 'doPost' was run manually from the editor without HTTP POST data.");
    Logger.log("👉 To test your sheet from the editor, select 'testSetup' or 'testMockSync' from the toolbar dropdown above and click 'Run'.");
    return jsonResponse({
      success: false,
      message: "doPost is an HTTP Webhook endpoint. To test in editor, run testSetup() or testMockSync()."
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

/**
 * Health check endpoint for testing deployment in browser
 */
function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Mauze Tahfeez Google Sheets Live Sync",
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
// 3. CORE SYNC & ROUTING LOGIC
// ============================================================================

function processSyncPayload(payload) {
  const category = (payload.category || "atfal").toLowerCase().trim();
  const student = payload.student || {};
  const result = payload.result || {};
  
  // 1. Resolve Target Spreadsheet (Atfal vs Kibar)
  const spreadsheet = resolveSpreadsheet(category);

  // 2. Resolve Marhala Tab & Update
  const marhalaName = resolveMarhalaTabName(student.marhala || payload.marhala || result.marhala);
  const marhalaSheet = getOrCreateMarhalaSheet(spreadsheet, marhalaName);
  const marhalaSyncStatus = syncMarhalaSheetRow(marhalaSheet, student, result);

  // 3. If Atfal, sync to the "parents email" tab
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
      throw new Error("Could not open spreadsheet with ID '" + targetId + "'. Check that the ID is correct and permissions are granted.");
    }
  }

  // Fallback to active spreadsheet if container-bound (opened from Extensions > Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error(
    "Spreadsheet ID for category '" + category + "' is not configured. " +
    "Please paste your Google Sheet ID into CONFIG." + (category === "kibar" ? "KIBAR" : "ATFAL") + "_SPREADSHEET_ID at line 25 of Code.gs."
  );
}

function resolveMarhalaTabName(rawMarhala) {
  if (!rawMarhala || String(rawMarhala).trim() === "") return "Marhala 1";
  return String(rawMarhala).trim();
}

// ============================================================================
// 4. MARHALA SHEET SYNC
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
// 5. PARENTS EMAIL TAB SYNC
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
  const latestWeekStatus = "Yes"; // Automatically set to Yes upon automated sync

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
// 6. CONDITIONAL FORMATTING & VALIDATION SETUP
// ============================================================================

function applyValidationToCell(range) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .setHelpText("Please choose either 'Yes' or 'No'.")
    .build();
  range.setDataValidation(rule);
}

/**
 * Applies dropdown validation (Yes/No) and Yes(Green)/No(Red) conditional formatting
 * safely respecting actual sheet row count.
 */
function setupParentsEmailValidationAndFormatting(sheet) {
  if (!sheet) {
    const spreadsheet = resolveSpreadsheet("atfal");
    sheet = spreadsheet.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  }
  
  if (!sheet) {
    Logger.log("Sheet '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' not found.");
    return;
  }

  // Ensure sheet has at least 100 rows so getRange never goes out of bounds
  const currentMax = sheet.getMaxRows();
  if (currentMax <= 1) {
    sheet.insertRowsAfter(1, 100);
  }
  const totalRows = sheet.getMaxRows();
  const numRows = totalRows - 1; // All rows below header row 1
  const statusColumnRange = sheet.getRange(2, 9, numRows, 1); // Column 9 (I2:I)

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

  Logger.log("✅ Successfully configured Data Validation and Conditional Formatting on '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "'.");
}
