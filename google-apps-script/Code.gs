/**
 * ============================================================================
 * MAUZE TAHFEEZ - GOOGLE SHEETS LIVE SYNC AUTOMATION
 * ============================================================================
 * 
 * Features:
 * 1. Categorization: Routes incoming data to Atfal or Kibar spreadsheets.
 * 2. Marhala Routing: Automatically updates or appends the student's result
 *    in their designated "Marhala" tab (e.g. Marhala 1, Marhala 2, Marhala Ula, etc.).
 * 3. Parents Email Tab: Automatically updates the "parents email" tab in Atfal
 *    with columns: email, name, from date, till date, wekly score, total Jadeed,
 *    marhala rank, over all rank, and data update for latest week ("Yes").
 * 4. Data Validation & Conditional Formatting:
 *    - Column 9 dropdown with "Yes" and "No".
 *    - Green background for "Yes", Red background for "No".
 */

// ============================================================================
// CONFIGURATION: Set your Spreadsheet IDs below
// ============================================================================
const CONFIG = {
  // If running as a Container-Bound Script inside the Atfal sheet, leave as "" or "auto"
  // If running standalone or across two sheets, paste the 44-character Google Sheet ID from URL:
  // e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
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
// WEBHOOK HTTP HANDLERS (doPost & doGet)
// ============================================================================

/**
 * Main Webhook endpoint to accept JSON payloads from Mauze Tahfeez App
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        error: "Empty request body received."
      }, 400);
    }

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
      error: err.toString(),
      stack: err.stack
    }, 500);
  }
}

/**
 * Health check endpoint for testing deployment
 */
function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Mauze Tahfeez Google Sheets Live Sync",
    timestamp: new Date().toISOString(),
    message: "Webhook is active and ready to accept POST requests."
  });
}

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// CORE SYNC LOGIC
// ============================================================================

/**
 * Process the incoming student mark progress payload
 */
function processSyncPayload(payload) {
  const category = (payload.category || "atfal").toLowerCase().trim();
  const student = payload.student || {};
  const result = payload.result || {};
  
  // 1. Resolve Target Spreadsheet (Atfal vs Kibar)
  const spreadsheet = getSpreadsheetForCategory(category);
  if (!spreadsheet) {
    throw new Error("Unable to open spreadsheet for category: " + category + ". Please verify Spreadsheet IDs in CONFIG.");
  }

  // 2. Resolve Marhala Tab & Update
  const marhalaName = resolveMarhalaTabName(student.marhala || payload.marhala || result.marhala);
  const marhalaSheet = getOrCreateMarhalaSheet(spreadsheet, marhalaName);
  const marhalaSyncStatus = syncMarhalaSheetRow(marhalaSheet, student, result);

  // 3. If Atfal, sync to the "parents email" tab
  let parentsEmailStatus = null;
  if (category === "atfal") {
    const atfalSpreadsheet = (category === "atfal") ? spreadsheet : getSpreadsheetForCategory("atfal");
    if (atfalSpreadsheet) {
      const parentsSheet = getOrCreateParentsEmailSheet(atfalSpreadsheet);
      parentsEmailStatus = syncParentsEmailSheetRow(parentsSheet, student, result);
    }
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

/**
 * Get the Spreadsheet object based on category
 */
function getSpreadsheetForCategory(category) {
  let targetId = (category === "kibar") 
    ? CONFIG.KIBAR_SPREADSHEET_ID 
    : CONFIG.ATFAL_SPREADSHEET_ID;

  if (targetId && targetId !== "auto" && targetId.trim() !== "") {
    return SpreadsheetApp.openById(targetId.trim());
  }

  // Fallback to active spreadsheet if bound
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // Not container-bound
  }

  throw new Error(
    "Spreadsheet ID for '" + category + "' is not set in CONFIG. " +
    "Please open Code.gs and paste the Google Sheet ID."
  );
}

/**
 * Standardize Marhala tab names (e.g. "Marhala 1", "Marhala Ula", etc.)
 */
function resolveMarhalaTabName(rawMarhala) {
  if (!rawMarhala || String(rawMarhala).trim() === "") {
    return "Marhala 1";
  }
  const clean = String(rawMarhala).trim();
  // Ensure friendly format
  return clean;
}

// ============================================================================
// 1. MARHALA SHEET SYNC
// ============================================================================

const MARHALA_HEADERS = [
  "Student ID",
  "ITS",
  "Name",
  "Arabic Name",
  "Email",
  "Teacher Name",
  "Group",
  "Marhala",
  "Week Date",
  "From Date",
  "Till Date",
  "Fatemi Date",
  "Attendance Count",
  "Murajazah",
  "Juz Hali",
  "Takhteet",
  "Jadeed",
  "Weekly Score",
  "Total Jadeed Pages",
  "Total Jadeed Unit",
  "Marhala Rank",
  "Overall Rank",
  "Wusool Juz",
  "Wusool Page",
  "Wusool Surah",
  "Next Week Juz",
  "Next Week Page",
  "Next Week Surah",
  "Istifadah Juz",
  "Istifadah Page",
  "Istifadah Surah",
  "Matrookah",
  "Daeefah",
  "Attendance Note",
  "Last Updated"
];

/**
 * Ensure Marhala tab exists with clean, locked headers
 */
function getOrCreateMarhalaSheet(spreadsheet, marhalaName) {
  let sheet = spreadsheet.getSheetByName(marhalaName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(marhalaName);
    
    // Set headers
    sheet.getRange(1, 1, 1, MARHALA_HEADERS.length).setValues([MARHALA_HEADERS]);
    sheet.setFrozenRows(1);
    
    // Style headers
    const headerRange = sheet.getRange(1, 1, 1, MARHALA_HEADERS.length);
    headerRange.setBackground("#1b365d"); // Royal Navy Blue
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Segoe UI");
    headerRange.setHorizontalAlignment("center");
    sheet.autoResizeColumns(1, MARHALA_HEADERS.length);
  }
  return sheet;
}

/**
 * Upsert student row into their Marhala tab
 */
function syncMarhalaSheetRow(sheet, student, result) {
  const data = sheet.getDataRange().getValues();
  const studentId = String(student.student_id || student.id || "").trim();
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const weekDate = String(result.week_date || result.till_date || "").trim();

  // Find column indices
  const headers = data[0] || MARHALA_HEADERS;
  const colStudentId = headers.indexOf("Student ID");
  const colEmail = headers.indexOf("Email");
  const colWeekDate = headers.indexOf("Week Date");
  const colFromDate = headers.indexOf("From Date");

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

  // Search existing row matching (StudentId OR Email) AND WeekDate
  let matchRowIndex = -1;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowSid = String(row[colStudentId] || "").trim();
    const rowMail = String(row[colEmail] || "").trim().toLowerCase();
    const rowWeek = String(row[colWeekDate] || "").trim();

    const idMatches = (studentId && rowSid === studentId) || (email && rowMail === email);
    const weekMatches = (!weekDate || !rowWeek || rowWeek === weekDate);

    if (idMatches && weekMatches) {
      matchRowIndex = r + 1; // 1-indexed
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
// 2. PARENTS EMAIL TAB SYNC & FORMATTING
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

/**
 * Ensure the "parents email" tab exists with exact headings, validation, and styling
 */
function getOrCreateParentsEmailSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.PARENTS_EMAIL_SHEET_NAME);
    sheet.getRange(1, 1, 1, PARENTS_EMAIL_HEADERS.length).setValues([PARENTS_EMAIL_HEADERS]);
    sheet.setFrozenRows(1);

    // Header styling
    const headerRange = sheet.getRange(1, 1, 1, PARENTS_EMAIL_HEADERS.length);
    headerRange.setBackground("#2c3e50");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Segoe UI");
    headerRange.setHorizontalAlignment("center");
    
    // Apply validation & conditional formatting immediately
    setupParentsEmailValidationAndFormatting(sheet);
    sheet.autoResizeColumns(1, PARENTS_EMAIL_HEADERS.length);
  }
  return sheet;
}

/**
 * Find matching email in "parents email" tab and update columns 1 through 9.
 * If not found, appends a new row.
 */
function syncParentsEmailSheetRow(sheet, student, result) {
  const email = String(student.email || student.parent_email || "").trim().toLowerCase();
  const name = String(student.name || student.full_name || "").trim();

  // If no email is provided, skip or fallback to student identifier
  if (!email) {
    return { action: "skipped", reason: "No email address found for student: " + name };
  }

  const fromDate = String(result.from_date || result.fatemi_from_date || "").trim();
  const tillDate = String(result.till_date || result.fatemi_till_date || "").trim();
  const weeklyScore = result.total_score !== undefined ? result.total_score : "";
  
  // Format total Jadeed (e.g. "3 صفه" or "3")
  let totalJadeed = "";
  if (result.total_jadeed_pages !== undefined && result.total_jadeed_pages !== null) {
    totalJadeed = String(result.total_jadeed_pages);
    if (result.total_jadeed_unit) {
      totalJadeed += " " + result.total_jadeed_unit;
    }
  }

  const marhalaRank = student.marhala_rank || student.marhalaRank || "";
  const overallRank = student.overall_rank || student.computedRank || "";
  const latestWeekStatus = "Yes"; // Automatically set to Yes upon automated push

  const rowValues = [
    email,              // Col 1: email (unique identifier)
    name,               // Col 2: name
    fromDate,           // Col 3: from date
    tillDate,           // Col 4: till date
    weeklyScore,        // Col 5: wekly score
    totalJadeed,        // Col 6: total Jadeed
    marhalaRank,        // Col 7: marhala rank
    overallRank,        // Col 8: over all rank
    latestWeekStatus    // Col 9: data update for latest week
  ];

  const data = sheet.getDataRange().getValues();
  let matchRowIndex = -1;

  // Scan column 1 (email) starting from row 2
  for (let r = 1; r < data.length; r++) {
    const existingEmail = String(data[r][0] || "").trim().toLowerCase();
    if (existingEmail === email) {
      matchRowIndex = r + 1; // 1-indexed
      break;
    }
  }

  if (matchRowIndex > 0) {
    // Update existing row
    sheet.getRange(matchRowIndex, 1, 1, 9).setValues([rowValues]);
    // Ensure dropdown validation is applied to this cell
    applyValidationToCell(sheet.getRange(matchRowIndex, 9));
    return { action: "updated", row: matchRowIndex, email: email };
  } else {
    // Append new row
    sheet.appendRow(rowValues);
    const newRow = sheet.getLastRow();
    applyValidationToCell(sheet.getRange(newRow, 9));
    return { action: "appended", row: newRow, email: email };
  }
}

// ============================================================================
// 3. CONDITIONAL FORMATTING & DATA VALIDATION SETUP (TASK ITEM 4)
// ============================================================================

/**
 * Applies dropdown validation (Yes/No) to a specific cell
 */
function applyValidationToCell(range) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .setHelpText("Please choose either 'Yes' or 'No'.")
    .build();
  range.setDataValidation(rule);
}

/**
 * MASTER SETUP FUNCTION:
 * Run this function manually from the Apps Script Editor (or it runs automatically)
 * to configure Data Validation and Conditional Formatting on Column 9 ("data update for latest week").
 */
function setupParentsEmailValidationAndFormatting(sheet) {
  if (!sheet) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet() || getSpreadsheetForCategory("atfal");
    sheet = spreadsheet.getSheetByName(CONFIG.PARENTS_EMAIL_SHEET_NAME);
  }
  
  if (!sheet) {
    Logger.log("Sheet '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "' not found.");
    return;
  }

  const maxRows = Math.max(sheet.getMaxRows(), 500);
  const statusColumnRange = sheet.getRange(2, 9, maxRows - 1, 1); // Column 9 (I2:I)

  // 1. Data Validation (Yes/No Dropdown)
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .setHelpText("Select 'Yes' or 'No'")
    .build();
  statusColumnRange.setDataValidation(validationRule);

  // 2. Conditional Formatting (Green for Yes, Red for No)
  // Retrieve existing rules to avoid duplicate rules
  const rules = sheet.getConditionalFormatRules();
  const filteredRules = rules.filter(function(r) {
    // Remove old rules applied to column 9
    const ranges = r.getRanges();
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].getColumn() === 9) return false;
    }
    return true;
  });

  // Rule 1: "Yes" -> Emerald Green Background
  const yesRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Yes")
    .setBackground(CONFIG.COLOR_YES_BG)
    .setFontColor(CONFIG.COLOR_YES_TEXT)
    .setBold(true)
    .setRanges([statusColumnRange])
    .build();

  // Rule 2: "No" -> Rose / Light Red Background
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

  Logger.log("Successfully applied Data Validation and Conditional Formatting to '" + CONFIG.PARENTS_EMAIL_SHEET_NAME + "'!");
}

/**
 * Standalone runner for testing or initializing the sheet formatting
 */
function runManualSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || getSpreadsheetForCategory("atfal");
  const sheet = getOrCreateParentsEmailSheet(ss);
  setupParentsEmailValidationAndFormatting(sheet);
}
