/**
 * =====================================================================
 *  TOEIC Quest: Conquer 990
 *  Google Apps Script Web App – Backend (Code.gs)
 * ---------------------------------------------------------------------
 *  Phase 2A: Skeleton
 *  Contains:
 *    - Global constants
 *    - Sheet names
 *    - Sheet header definitions
 *    - doGet()
 *    - include(filename)
 *    - sanitizeInput(value)
 *    - getSettings()
 * =====================================================================
 */


/* =====================================================================
 * 1. GLOBAL CONSTANTS
 * ===================================================================== */

/**
 * The Spreadsheet ID used as the database for this web app.
 * Replace the placeholder string below with your real Google Sheets ID.
 * The ID is the long token in the sheet URL between "/d/" and "/edit".
 */
var SPREADSHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';

/** Web app title shown in the browser tab. */
var APP_TITLE = 'TOEIC Quest: Conquer 990';

/** Default number of questions per round (used as fallback). */
var DEFAULT_QUESTIONS_PER_ROUND = 10;

/** Default per-question countdown timer in seconds (used as fallback). */
var DEFAULT_TIMER_SECONDS = 15;

/** Maximum length allowed for free-text user input (e.g. player name). */
var MAX_INPUT_LENGTH = 30;

/** Lock timeout (ms) when writing to the spreadsheet. */
var LOCK_TIMEOUT_MS = 10000;


/* =====================================================================
 * 2. SHEET NAMES
 * ===================================================================== */

var SHEETS = {
  QUESTIONS: 'Questions',
  SCORES:    'Scores',
  MISTAKES:  'Mistakes',
  SETTINGS:  'Settings'
};


/* =====================================================================
 * 3. SHEET HEADER DEFINITIONS
 * ---------------------------------------------------------------------
 *  Each array represents the header row (row 1) for that sheet.
 *  The order MUST be preserved – downstream functions rely on column
 *  positions when reading and writing rows.
 * ===================================================================== */

var HEADERS = {

  // Master question bank used by all three game modes.
  QUESTIONS: [
    'Question_ID',
    'Mode',
    'Part',
    'Category',
    'Level',
    'Passage',
    'Question_Text',
    'Choice_A',
    'Choice_B',
    'Choice_C',
    'Choice_D',
    'Correct_Answer',
    'Explanation_TH',
    'Tip',
    'Point'
  ],

  // Append-only log of every completed round.
  SCORES: [
    'Timestamp',
    'Player_Name',
    'Target_Score',
    'Mode',
    'Score',
    'Correct_Count',
    'Wrong_Count',
    'Accuracy',
    'EXP',
    'Coin',
    'Level',
    'Badge'
  ],

  // Append-only log of every wrong answer for review purposes.
  MISTAKES: [
    'Timestamp',
    'Player_Name',
    'Mode',
    'Question_ID',
    'Question_Text',
    'Selected_Answer',
    'Correct_Answer',
    'Category'
  ],

  // Key-value configuration table.
  SETTINGS: [
    'Key',
    'Value',
    'Description'
  ]
};


/* =====================================================================
 * 4. WEB APP ENTRY POINT
 * ===================================================================== */

/**
 * doGet – Google Apps Script web app entry point.
 * Renders Index.html (which itself includes Style.html and Script.html)
 * and returns the HtmlOutput to the browser.
 *
 * @param {Object} e The event parameter passed by Apps Script (unused).
 * @return {GoogleAppsScript.HTML.HtmlOutput} The rendered web app page.
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');

  // Render the template (evaluates all <?!= include(...) ?> tags).
  var output = template.evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}


/**
 * include – Helper used inside HTML templates to embed another file.
 * Usage in Index.html:
 *   <?!= include('Style'); ?>
 *   <?!= include('Script'); ?>
 *
 * @param {string} filename The HTML file name (without extension).
 * @return {string} The raw HTML content of the included file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/* =====================================================================
 * 5. INPUT SANITIZATION
 * ===================================================================== */

/**
 * sanitizeInput – Cleans an arbitrary user-supplied value before it
 * is used in logic or written to the spreadsheet.
 *
 * Rules:
 *   - Coerces non-strings to string.
 *   - Trims surrounding whitespace.
 *   - Removes ASCII control characters.
 *   - Strips angle brackets to defeat trivial HTML/script injection.
 *   - Caps length to MAX_INPUT_LENGTH characters.
 *
 * @param {*} value The raw input value.
 * @return {string} A safe, trimmed, length-bounded string.
 */
function sanitizeInput(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Coerce to string.
  var str = String(value);

  // Remove ASCII control characters (0x00–0x1F and 0x7F).
  str = str.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip angle brackets to neutralize basic HTML injection attempts.
  str = str.replace(/[<>]/g, '');

  // Collapse internal whitespace runs and trim.
  str = str.replace(/\s+/g, ' ').trim();

  // Enforce maximum length.
  if (str.length > MAX_INPUT_LENGTH) {
    str = str.substring(0, MAX_INPUT_LENGTH);
  }

  return str;
}


/* =====================================================================
 * 6. SETTINGS READER
 * ===================================================================== */

/**
 * getSettings – Reads the Settings sheet and returns a flat key/value
 * object that the client can consume. Numeric strings are converted to
 * numbers automatically. Missing settings fall back to safe defaults.
 *
 * Expected default keys:
 *   - TimerSeconds        per-question countdown in seconds
 *   - QuestionsPerRound   number of questions per round
 *   - BasePoint           points awarded for a correct answer
 *   - SpeedBonus          extra points for fast (<= 5s) correct answers
 *   - StreakBonus         extra points every 3 correct answers in a row
 *   - BadgeThreshold      accuracy ratio (0–1) required to earn the badge
 *
 * @return {Object} Settings object, e.g. { TimerSeconds: 15, ... }.
 */
function getSettings() {
  // Defaults applied when the sheet is missing or has empty cells.
  var defaults = {
    TimerSeconds:      DEFAULT_TIMER_SECONDS,
    QuestionsPerRound: DEFAULT_QUESTIONS_PER_ROUND,
    BasePoint:         10,
    SpeedBonus:        5,
    StreakBonus:       10,
    BadgeThreshold:    0.8
  };

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEETS.SETTINGS);

    // If the sheet does not exist yet, return defaults.
    if (!sheet) {
      return defaults;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return defaults;
    }

    // Read all key/value pairs (skip header row).
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

    var result = {};
    // Seed with defaults so missing keys keep working values.
    for (var key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        result[key] = defaults[key];
      }
    }

    // Overlay sheet values on top of defaults.
    for (var i = 0; i < data.length; i++) {
      var k = data[i][0];
      var v = data[i][1];

      if (k === '' || k === null || k === undefined) {
        continue;
      }

      // Convert numeric-looking strings to actual numbers.
      if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
        v = Number(v);
      }

      result[String(k)] = v;
    }

    return result;

  } catch (err) {
    // If the spreadsheet ID is not configured or access fails, fall
    // back to defaults so the front-end can still render.
    Logger.log('getSettings error: ' + err);
    return defaults;
  }
}


/* =====================================================================
 *  End of Phase 2A skeleton.
 *  Next phases will add:
 *    - setupSpreadsheet() with 30+ original sample questions
 *    - getQuestions(mode, limit)
 *    - submitGameResult(result)
 *    - saveMistakes(playerName, mistakes)
 *    - getLeaderboard()
 * ===================================================================== */
