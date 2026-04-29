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
 * 7. SPREADSHEET SETUP
 * ===================================================================== */

/**
 * setupSpreadsheet – One-time (idempotent) initialization routine.
 *
 * Run this manually from the Apps Script editor after configuring
 * SPREADSHEET_ID. It guarantees that the database is in a valid state
 * for the rest of the application:
 *
 *   1. Opens the target spreadsheet by ID.
 *   2. Creates any of the four required sheets that are missing
 *      (Questions, Scores, Mistakes, Settings).
 *   3. Writes the correct header row on each sheet (only when the
 *      sheet is brand new or has no header yet).
 *   4. Freezes the first row on every sheet.
 *   5. Auto-resizes columns so headers are readable.
 *   6. Inserts the default key/value rows into Settings (only when
 *      Settings is empty, so existing customizations are preserved).
 *
 * NOTE: Sample question seeding will be added in a later phase.
 *
 * @return {Object} A summary report describing what was created.
 */
function setupSpreadsheet() {
  // Guard against running with the placeholder ID still in place.
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PUT_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error(
      'SPREADSHEET_ID is not configured. ' +
      'Open Code.gs and set SPREADSHEET_ID to your Google Sheet ID.'
    );
  }

  // Acquire a script lock so concurrent setup attempts cannot collide.
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var report = {
      spreadsheet: ss.getName(),
      created: [],
      headersWritten: [],
      settingsInserted: 0
    };

    // Ordered list of sheets to ensure, paired with their header rows.
    var plan = [
      { name: SHEETS.QUESTIONS, headers: HEADERS.QUESTIONS },
      { name: SHEETS.SCORES,    headers: HEADERS.SCORES   },
      { name: SHEETS.MISTAKES,  headers: HEADERS.MISTAKES },
      { name: SHEETS.SETTINGS,  headers: HEADERS.SETTINGS }
    ];

    for (var i = 0; i < plan.length; i++) {
      var spec = plan[i];
      ensureSheet_(ss, spec.name, spec.headers, report);
    }

    // Seed default settings only if the Settings sheet is otherwise empty.
    var settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (settingsSheet && settingsSheet.getLastRow() < 2) {
      report.settingsInserted = insertDefaultSettings_(settingsSheet);
    }

    Logger.log('setupSpreadsheet completed: ' + JSON.stringify(report));
    return report;

  } finally {
    lock.releaseLock();
  }
}


/**
 * ensureSheet_ – Internal helper. Creates the sheet if missing and
 * writes the header row if the sheet has no data yet. Also freezes
 * row 1 and auto-resizes columns.
 *
 * @param {Spreadsheet} ss      The parent spreadsheet.
 * @param {string} name         The sheet name to ensure.
 * @param {Array<string>} headers Header labels in column order.
 * @param {Object} report       The accumulating setup report.
 * @private
 */
function ensureSheet_(ss, name, headers, report) {
  var sheet = ss.getSheetByName(name);

  // Create the sheet if it does not exist.
  if (!sheet) {
    sheet = ss.insertSheet(name);
    report.created.push(name);
  }

  // Write the header row when the sheet is empty.
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    report.headersWritten.push(name);
  }

  // Style the header row: bold, centered, light background.
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#E8EAF6');

  // Freeze the first row so headers stay visible while scrolling.
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }

  // Auto-resize all header columns for readability.
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
}


/**
 * insertDefaultSettings_ – Internal helper. Writes the default
 * configuration rows into an empty Settings sheet.
 *
 * @param {Sheet} sheet The Settings sheet (must already have headers).
 * @return {number} The number of setting rows inserted.
 * @private
 */
function insertDefaultSettings_(sheet) {
  // [Key, Value, Description] rows.
  var defaults = [
    ['TimerSeconds',      DEFAULT_TIMER_SECONDS,
      'Per-question countdown timer in seconds.'],
    ['QuestionsPerRound', DEFAULT_QUESTIONS_PER_ROUND,
      'Number of questions delivered per round.'],
    ['BasePoint',         10,
      'Points awarded for each correct answer.'],
    ['SpeedBonus',        5,
      'Bonus points for correct answers within 5 seconds.'],
    ['StreakBonus',       10,
      'Bonus points awarded every 3 correct answers in a row.'],
    ['BadgeThreshold',    0.8,
      'Accuracy ratio (0-1) required to earn the TOEIC Warrior badge.'],
    ['ExpPerRound',       20,
      'EXP awarded for completing a full round.'],
    ['CoinPerCorrect',    5,
      'Coins awarded for each correct answer.'],
    ['ExpPerLevel',       100,
      'EXP required to reach the next player level.']
  ];

  sheet.getRange(2, 1, defaults.length, 3).setValues(defaults);

  // Re-fit columns now that real values have been written.
  for (var c = 1; c <= 3; c++) {
    sheet.autoResizeColumn(c);
  }

  return defaults.length;
}


/* =====================================================================
 * 8. SAMPLE QUESTION DATA — VOCAB RUSH
 * ---------------------------------------------------------------------
 *  All questions below are ORIGINAL practice items written for this
 *  project. They are inspired by the general style of TOEIC business
 *  English vocabulary questions but do not reproduce any copyrighted
 *  content. Each row is an array whose order matches HEADERS.QUESTIONS:
 *
 *    Question_ID, Mode, Part, Category, Level, Passage, Question_Text,
 *    Choice_A, Choice_B, Choice_C, Choice_D, Correct_Answer,
 *    Explanation_TH, Tip, Point
 * ===================================================================== */

/**
 * getVocabRushSamples – Returns 10 original Vocab Rush questions.
 * The Mode field is "Vocab Rush" for every row. Passage is empty
 * because vocabulary items are stand-alone sentences.
 *
 * @return {Array<Array>} A 2D array ready to write to the Questions sheet.
 */
function getVocabRushSamples() {
  return [

    // V001 – business meeting vocabulary
    [
      'V001', 'Vocab Rush', 'Part 5', 'Business Meeting', 'Easy', '',
      'The marketing team will ______ the new campaign strategy at tomorrow\'s meeting.',
      'discuss', 'disclose', 'dismiss', 'distract',
      'A',
      'คำว่า "discuss" แปลว่า "อภิปราย/พูดคุยเรื่อง" เหมาะกับการประชุมที่ต้องพูดคุยเกี่ยวกับกลยุทธ์ ส่วน disclose = เปิดเผย, dismiss = ไล่ออก/ปฏิเสธ, distract = ทำให้เสียสมาธิ',
      'จำว่า "discuss" ตามด้วยคำนามตรง ๆ ได้เลย ไม่ต้องใส่ about',
      10
    ],

    // V002 – finance / accounting vocabulary
    [
      'V002', 'Vocab Rush', 'Part 5', 'Finance', 'Medium', '',
      'The accountant prepared a detailed ______ of last quarter\'s expenses.',
      'review', 'reception', 'refund', 'remark',
      'A',
      'คำว่า "review" หมายถึง "การตรวจสอบ/รายงานสรุป" จึงเหมาะกับการตรวจสอบค่าใช้จ่าย ส่วน reception = แผนกต้อนรับ, refund = การคืนเงิน, remark = ความคิดเห็น',
      'ในบริบทธุรกิจ "review" มักใช้กับเอกสารทางการเงิน เช่น budget review, performance review',
      10
    ],

    // V003 – HR / recruitment vocabulary
    [
      'V003', 'Vocab Rush', 'Part 5', 'Human Resources', 'Easy', '',
      'All applicants must ______ their résumés before the deadline.',
      'submit', 'subscribe', 'suggest', 'supply',
      'A',
      'คำว่า "submit" แปลว่า "ส่ง/ยื่น" ใช้กับเอกสาร ใบสมัคร หรือรายงาน ส่วน subscribe = สมัครสมาชิก, suggest = แนะนำ, supply = จัดหา',
      'จำคู่คำว่า "submit a document / application / report" เป็นวลีติดปาก',
      10
    ],

    // V004 – office / workplace vocabulary
    [
      'V004', 'Vocab Rush', 'Part 5', 'Office', 'Medium', '',
      'Please ______ Ms. Tanaka of the schedule change as soon as possible.',
      'inform', 'inflate', 'invest', 'install',
      'A',
      'คำว่า "inform" แปลว่า "แจ้งให้ทราบ" ใช้รูป inform + someone + of + something ส่วน inflate = ทำให้พอง, invest = ลงทุน, install = ติดตั้ง',
      'โครงสร้างที่ต้องจำ: inform somebody of/about something',
      10
    ],

    // V005 – logistics vocabulary
    [
      'V005', 'Vocab Rush', 'Part 5', 'Logistics', 'Medium', '',
      'The shipment is expected to ______ at the warehouse by Friday morning.',
      'arrive', 'appear', 'approve', 'arrange',
      'A',
      'คำว่า "arrive" แปลว่า "มาถึง" ใช้กับสินค้าที่ส่งมาถึงปลายทาง ส่วน appear = ปรากฏ, approve = อนุมัติ, arrange = จัดเตรียม',
      'จำว่า arrive at + สถานที่เล็ก เช่น warehouse, office และ arrive in + เมือง/ประเทศ',
      10
    ],

    // V006 – customer service vocabulary
    [
      'V006', 'Vocab Rush', 'Part 5', 'Customer Service', 'Hard', '',
      'The hotel offers a complimentary breakfast as a way to ______ guest satisfaction.',
      'enhance', 'enclose', 'endorse', 'enroll',
      'A',
      'คำว่า "enhance" แปลว่า "เพิ่ม/ยกระดับ" เหมาะกับการเพิ่มความพึงพอใจ ส่วน enclose = แนบ, endorse = สนับสนุน/รับรอง, enroll = ลงทะเบียน',
      '"enhance" มักใช้คู่กับคำที่เป็นนามธรรม เช่น quality, experience, satisfaction',
      10
    ],

    // V007 – marketing vocabulary
    [
      'V007', 'Vocab Rush', 'Part 5', 'Marketing', 'Medium', '',
      'The advertising agency launched a ______ campaign to attract younger customers.',
      'targeted', 'tangled', 'tasteless', 'temporary',
      'A',
      'คำว่า "targeted" แปลว่า "ที่มุ่งเป้าไปยังกลุ่มเฉพาะ" ส่วน tangled = พันกัน, tasteless = ไร้รสชาติ, temporary = ชั่วคราว',
      'ในการตลาดสมัยใหม่ มักเจอคำว่า targeted marketing, targeted audience',
      10
    ],

    // V008 – contract / legal vocabulary
    [
      'V008', 'Vocab Rush', 'Part 5', 'Contracts', 'Hard', '',
      'Both parties must sign the agreement before it becomes legally ______.',
      'binding', 'boring', 'building', 'bouncing',
      'A',
      'คำว่า "binding" แปลว่า "มีผลผูกพันทางกฎหมาย" จึงเหมาะกับสัญญา ส่วนตัวเลือกอื่นไม่เกี่ยวกับเรื่องสัญญาเลย',
      'จำวลี "legally binding agreement / contract" ที่มักออกข้อสอบ',
      10
    ],

    // V009 – productivity vocabulary
    [
      'V009', 'Vocab Rush', 'Part 5', 'Productivity', 'Medium', '',
      'The new software has significantly improved the team\'s ______.',
      'efficiency', 'emergency', 'entrance', 'envelope',
      'A',
      'คำว่า "efficiency" แปลว่า "ประสิทธิภาพ" จึงเข้ากับการทำงานของทีม ส่วน emergency = เหตุฉุกเฉิน, entrance = ทางเข้า, envelope = ซองจดหมาย',
      'เน้นรากศัพท์ efficient (adj.) → efficiency (n.) → efficiently (adv.)',
      10
    ],

    // V010 – travel / business trip vocabulary
    [
      'V010', 'Vocab Rush', 'Part 5', 'Business Travel', 'Easy', '',
      'Please ______ your flight at least 24 hours before departure.',
      'confirm', 'consume', 'contain', 'connect',
      'A',
      'คำว่า "confirm" แปลว่า "ยืนยัน" ใช้กับการยืนยันเที่ยวบิน การจอง หรือนัดหมาย ส่วน consume = บริโภค, contain = บรรจุ, connect = เชื่อมต่อ',
      'จำกลุ่มคำ confirm a reservation / appointment / flight ที่พบบ่อยใน TOEIC',
      10
    ]

  ];
}


/* =====================================================================
 * 9. SAMPLE QUESTION DATA — GRAMMAR SPRINT
 * ---------------------------------------------------------------------
 *  Original TOEIC Part 5 style grammar items. Each row follows the
 *  HEADERS.QUESTIONS column order. No real TOEIC content is reused.
 * ===================================================================== */

/**
 * getGrammarSprintSamples – Returns 10 original Grammar Sprint questions.
 * Mode is "Grammar Sprint" and Part is "Part 5" for every row.
 * Passage is empty because grammar items are single-sentence cloze.
 *
 * Grammar points covered:
 *   G001 subject–verb agreement
 *   G002 verb tense (present perfect)
 *   G003 preposition of time
 *   G004 relative pronoun
 *   G005 gerund vs. infinitive after verb
 *   G006 passive voice
 *   G007 comparative form
 *   G008 conditional (type 1)
 *   G009 word form (adjective vs. adverb)
 *   G010 conjunction (although vs. because)
 *
 * @return {Array<Array>} 2D array ready for Sheets insertion.
 */
function getGrammarSprintSamples() {
  return [

    // G001 – subject-verb agreement
    [
      'G001', 'Grammar Sprint', 'Part 5', 'Subject-Verb Agreement', 'Easy', '',
      'Each of the new employees ______ required to attend the orientation.',
      'is', 'are', 'were', 'have',
      'A',
      'ประธาน "Each of + นามพหูพจน์" ถือเป็นเอกพจน์เสมอ จึงต้องใช้กริยาเอกพจน์ "is" ห้ามให้คำพหูพจน์หลัง "of" หลอกให้เลือก are',
      'จำว่า Each / Every / One of + นามพหูพจน์ → กริยาเอกพจน์',
      10
    ],

    // G002 – present perfect with "since"
    [
      'G002', 'Grammar Sprint', 'Part 5', 'Verb Tense', 'Medium', '',
      'Mr. Lopez ______ for our company since 2015.',
      'has worked', 'is working', 'worked', 'will work',
      'A',
      'เมื่อมีคำว่า "since + จุดเวลา" ต้องใช้ Present Perfect (has/have + V3) เพื่อบอกว่าเริ่มทำในอดีตและยังคงทำอยู่จนถึงปัจจุบัน',
      'สังเกตคำชี้นำเวลา: since, for, already, yet, ever, never → Present Perfect',
      10
    ],

    // G003 – preposition of time
    [
      'G003', 'Grammar Sprint', 'Part 5', 'Prepositions', 'Easy', '',
      'The annual conference will be held ______ October 14th.',
      'on', 'in', 'at', 'by',
      'A',
      'ใช้ "on" กับวันที่หรือวันในสัปดาห์เสมอ ส่วน in ใช้กับเดือน/ปี และ at ใช้กับเวลาเฉพาะเจาะจง',
      'เคล็ดลับ: at เวลานาฬิกา / on วัน-วันที่ / in เดือน-ปี-ฤดูกาล',
      10
    ],

    // G004 – relative pronoun
    [
      'G004', 'Grammar Sprint', 'Part 5', 'Relative Clauses', 'Medium', '',
      'The candidate ______ we interviewed yesterday accepted the offer.',
      'whom', 'which', 'whose', 'what',
      'A',
      '"whom" ใช้แทนกรรมที่เป็นบุคคล ในประโยคนี้ผู้สมัคร (the candidate) คือกรรมของกริยา interviewed จึงต้องใช้ whom (หรือ who/that ในภาษาพูด)',
      'จำว่า whom = บุคคล (กรรม), which = สิ่งของ, whose = แสดงความเป็นเจ้าของ',
      10
    ],

    // G005 – gerund vs infinitive after verb
    [
      'G005', 'Grammar Sprint', 'Part 5', 'Gerund / Infinitive', 'Medium', '',
      'The board has decided ______ the meeting until next Monday.',
      'to postpone', 'postponing', 'postpone', 'postponed',
      'A',
      'กริยา "decide" ตามด้วย to + V1 (infinitive) เสมอ ตัวเลือก postponing ใช้กับกริยา เช่น avoid, suggest, consider เท่านั้น',
      'กลุ่มกริยาที่ตามด้วย to + V1: decide, plan, agree, hope, promise, refuse',
      10
    ],

    // G006 – passive voice
    [
      'G006', 'Grammar Sprint', 'Part 5', 'Passive Voice', 'Medium', '',
      'The report ______ by the assistant before the deadline.',
      'was completed', 'completed', 'has completing', 'is completing',
      'A',
      'รายงานเป็นสิ่งที่ "ถูก" ทำให้เสร็จ จึงต้องใช้ passive voice รูป was/were + V3 และ "before the deadline" ชี้ว่าเป็นอดีต',
      'โครงสร้าง passive: be + V3 ดูประธานว่า "ทำเอง" หรือ "ถูกกระทำ"',
      10
    ],

    // G007 – comparative form
    [
      'G007', 'Grammar Sprint', 'Part 5', 'Comparison', 'Easy', '',
      'This year\'s sales report is ______ than last year\'s.',
      'more detailed', 'detailed', 'most detailed', 'detailing',
      'A',
      'คำคุณศัพท์ที่มี 2 พยางค์ขึ้นไปจะใช้ "more + adj." ในขั้นกว่า และตามด้วย than เสมอ',
      'จำกฎ: 1 พยางค์เติม -er / 2 พยางค์ขึ้นไปใช้ more + adj. เช่น more efficient, more expensive',
      10
    ],

    // G008 – first conditional (if + present, will)
    [
      'G008', 'Grammar Sprint', 'Part 5', 'Conditionals', 'Medium', '',
      'If the client confirms the order today, we ______ the goods tomorrow.',
      'will ship', 'shipped', 'would ship', 'have shipped',
      'A',
      'ประโยคเงื่อนไขแบบที่ 1 (สิ่งที่อาจเกิดขึ้นจริง) ใช้สูตร If + Present Simple, S + will + V1 จึงต้องตอบ "will ship"',
      'แยกให้ออก: Type 1 = will, Type 2 = would, Type 3 = would have + V3',
      10
    ],

    // G009 – adjective vs adverb (word form)
    [
      'G009', 'Grammar Sprint', 'Part 5', 'Word Forms', 'Hard', '',
      'The new manager handled the negotiation ______.',
      'professionally', 'professional', 'profession', 'professionalism',
      'A',
      'ช่องว่างขยายกริยา "handled" จึงต้องใช้คำกริยาวิเศษณ์ (adverb) คือ "professionally" ส่วน professional เป็น adj. และอีกสองตัวเป็นคำนาม',
      'ดูตำแหน่ง: ขยายกริยา/คุณศัพท์ → adverb มักลงท้ายด้วย -ly',
      10
    ],

    // G010 – conjunction although vs because
    [
      'G010', 'Grammar Sprint', 'Part 5', 'Conjunctions', 'Hard', '',
      '______ the weather was bad, the outdoor event continued as planned.',
      'Although', 'Because', 'So', 'Therefore',
      'A',
      'ประโยคแสดงความขัดแย้งระหว่างสองส่วน (อากาศไม่ดี vs งานยังดำเนินต่อ) ต้องใช้คำเชื่อมแบบให้เหตุขัดแย้งคือ "Although" ส่วน Because ใช้บอกเหตุผล',
      'จำคู่: Although/Even though = แม้ว่า, Because = เพราะว่า, So/Therefore = ดังนั้น',
      10
    ]

  ];
}


/* =====================================================================
 * 10. SAMPLE QUESTION DATA — READING MISSION
 * ---------------------------------------------------------------------
 *  Original TOEIC Part 7 style reading items. Each entry pairs a short
 *  business-style passage with one comprehension question. Passages
 *  are written specifically for this project. Names of people and
 *  companies are fictional.
 * ===================================================================== */

/**
 * getReadingMissionSamples – Returns 10 original Reading Mission items.
 * Mode is "Reading Mission" and Part is "Part 7" for every row.
 * The Passage field contains the source text and Question_Text holds
 * the comprehension prompt.
 *
 * Passage formats covered:
 *   R001 internal email  – schedule change
 *   R002 office notice   – maintenance announcement
 *   R003 advertisement   – grand opening
 *   R004 memo            – policy update
 *   R005 customer email  – delivery delay
 *   R006 job posting     – position requirements
 *   R007 announcement    – company merger
 *   R008 invitation      – networking event
 *   R009 product review  – customer feedback
 *   R010 confirmation    – hotel reservation
 *
 * @return {Array<Array>} 2D array ready for Sheets insertion.
 */
function getReadingMissionSamples() {
  return [

    // R001 – internal email about a schedule change
    [
      'R001', 'Reading Mission', 'Part 7', 'Email', 'Easy',
      'From: Anna Becker, Project Manager\n' +
      'To: Design Team\n' +
      'Subject: Friday Review Postponed\n\n' +
      'Hi everyone,\n' +
      'Due to the client visit on Friday afternoon, the weekly design review will be moved from 3:00 p.m. Friday to 10:00 a.m. Monday. Please bring your updated mockups and prepare a five-minute summary of your progress. Let me know if this new time does not work for you.\n' +
      'Thanks,\nAnna',
      'Why is the meeting being rescheduled?',
      'A client will visit the office on Friday.',
      'The project manager is on vacation.',
      'The design team needs more time.',
      'The meeting room is unavailable.',
      'A',
      'ในอีเมลระบุชัดเจนว่า "Due to the client visit on Friday afternoon" ซึ่งหมายถึงเหตุผลที่ต้องเลื่อนการประชุม จึงตอบข้อ A',
      'มองหา keyword ที่บอกเหตุผล เช่น due to, because of, since เพื่อตอบคำถาม Why',
      10
    ],

    // R002 – office notice about maintenance
    [
      'R002', 'Reading Mission', 'Part 7', 'Notice', 'Easy',
      'NOTICE TO ALL STAFF\n\n' +
      'The 4th-floor elevator will be out of service from Saturday, March 9, to Sunday, March 10, for routine maintenance. During this period, please use the elevators on the east side of the building or the central staircase. We apologize for any inconvenience.\n' +
      'Building Management',
      'What should employees do during the maintenance period?',
      'Use a different elevator or the staircase.',
      'Work from home for two days.',
      'Avoid entering the 4th floor.',
      'Contact building management directly.',
      'A',
      'ประกาศบอกชัดว่า "please use the elevators on the east side of the building or the central staircase" จึงเลือกข้อ A',
      'ประกาศ (notice) มักมีคำสั่งหรือคำแนะนำตรง ๆ ให้สังเกตคำว่า please, must, should',
      10
    ],

    // R003 – advertisement for a grand opening
    [
      'R003', 'Reading Mission', 'Part 7', 'Advertisement', 'Medium',
      'GRAND OPENING – Bloom Café\n\n' +
      'Join us this Saturday, May 4, for the grand opening of Bloom Café in downtown Riverton! The first 50 customers will receive a free signature latte, and all pastries will be 20% off throughout the weekend. Open daily from 7 a.m. to 8 p.m. Bring this flyer for an additional 10% discount on your first purchase.',
      'How can a customer get an additional 10% discount?',
      'By bringing the flyer to the café.',
      'By being one of the first 50 customers.',
      'By visiting on a weekday.',
      'By ordering a signature latte.',
      'A',
      'ในโฆษณาระบุว่า "Bring this flyer for an additional 10% discount" จึงตอบข้อ A ส่วนข้อ B เป็นเงื่อนไขเพื่อรับลาเต้ฟรี ไม่ใช่ส่วนลด 10%',
      'อ่านโฆษณาให้แยก "ของแถม" กับ "ส่วนลด" ออกจากกันให้ดี เพราะข้อสอบมักหลอก',
      10
    ],

    // R004 – internal memo about a policy update
    [
      'R004', 'Reading Mission', 'Part 7', 'Memo', 'Medium',
      'MEMO\n' +
      'To: All Employees\n' +
      'From: Human Resources\n' +
      'Date: June 1\n' +
      'Subject: Updated Remote Work Policy\n\n' +
      'Starting July 1, employees may work from home up to two days per week with prior approval from their direct supervisor. Requests must be submitted at least one week in advance through the HR portal. This policy does not apply to roles that require on-site presence, such as warehouse and reception staff.',
      'According to the memo, what must employees do before working from home?',
      'Get approval from their supervisor.',
      'Inform the HR director.',
      'Update their job description.',
      'Reduce their workload.',
      'A',
      'ข้อความระบุว่า "with prior approval from their direct supervisor" และ "Requests must be submitted at least one week in advance" จึงเลือกข้อ A',
      'memo ทางการงานมักมีเงื่อนไขก่อน-หลัง สังเกตคำว่า prior, before, in advance',
      10
    ],

    // R005 – customer service email about delivery delay
    [
      'R005', 'Reading Mission', 'Part 7', 'Email', 'Medium',
      'Dear Mr. Patel,\n\n' +
      'Thank you for your recent order #88421. We regret to inform you that your shipment has been delayed by three business days due to severe weather affecting our logistics partner. Your package is now expected to arrive on Thursday, October 17. As an apology for the inconvenience, we have added a $10 store credit to your account, which can be used on your next purchase.\n' +
      'Sincerely,\nSunrise Online Store',
      'What did the company offer Mr. Patel?',
      'A $10 store credit.',
      'A full refund.',
      'A free upgrade to express shipping.',
      'A discount on a future purchase of 10%.',
      'A',
      'ในอีเมลเขียนว่า "we have added a $10 store credit to your account" จึงตอบข้อ A ไม่ใช่ส่วนลด 10% และไม่มีการคืนเงินเต็มจำนวน',
      'ข้อสอบ Part 7 มักมีตัวเลือกที่ใกล้เคียงกัน เช่น store credit vs discount จำให้แม่นว่าใช้คำไหน',
      10
    ],

    // R006 – job posting
    [
      'R006', 'Reading Mission', 'Part 7', 'Job Posting', 'Medium',
      'Position: Marketing Coordinator\n' +
      'Location: Vienna Office\n\n' +
      'Sterling Group is seeking a Marketing Coordinator to support campaign planning and content creation. The ideal candidate has at least two years of experience in digital marketing, strong written communication skills in English, and proficiency with spreadsheet software. A bachelor\'s degree in marketing or a related field is required. Knowledge of German is a plus but not required.',
      'Which qualification is NOT required for the position?',
      'Knowledge of German.',
      'A bachelor\'s degree.',
      'Two years of digital marketing experience.',
      'Strong English writing skills.',
      'A',
      'ประกาศระบุว่า "Knowledge of German is a plus but not required" จึงไม่ใช่คุณสมบัติที่ต้องมี ส่วนข้อ B, C, D เป็นคุณสมบัติที่ต้องมีทั้งหมด',
      'คำถามที่มีคำว่า NOT ต้องอ่านทุกตัวเลือก แล้วเลือกตัวเดียวที่ "ไม่ตรง" กับเนื้อหา',
      10
    ],

    // R007 – announcement about a merger
    [
      'R007', 'Reading Mission', 'Part 7', 'Announcement', 'Hard',
      'PRESS RELEASE – November 12\n\n' +
      'Northwind Logistics today announced its merger with Cedar Freight Solutions, effective January 1 of next year. The combined company will operate under the new name NorthCedar Logistics and will serve more than 40 countries across Asia and Europe. All current contracts and customer accounts will be honored without interruption, and existing staff will retain their positions during the transition period.',
      'What will happen to current customer contracts after the merger?',
      'They will continue without changes.',
      'They will be renegotiated immediately.',
      'They will be transferred to a partner company.',
      'They will be canceled and refunded.',
      'A',
      'ข้อความบอกว่า "All current contracts and customer accounts will be honored without interruption" หมายความว่าสัญญาเดิมยังมีผลตามเดิม จึงตอบข้อ A',
      'คำว่า "honored without interruption" = "ดำเนินต่อโดยไม่หยุดชะงัก" ห้ามแปลตรงตัวว่า "ให้เกียรติ"',
      10
    ],

    // R008 – invitation to a networking event
    [
      'R008', 'Reading Mission', 'Part 7', 'Invitation', 'Medium',
      'You are invited to the Annual Tech Networking Night!\n\n' +
      'Date: Friday, September 20\n' +
      'Time: 6:30 p.m. – 9:30 p.m.\n' +
      'Venue: Skyline Hotel, Grand Ballroom\n\n' +
      'Enjoy an evening of light dinner, live music, and the chance to connect with over 200 professionals from the technology industry. Admission is free, but registration is required by September 15 at events@techlink.org. Business attire is recommended.',
      'What is required to attend the event?',
      'Registering before September 15.',
      'Paying an admission fee.',
      'Bringing a business card.',
      'Working in the technology industry.',
      'A',
      'ข้อความเขียนว่า "Admission is free, but registration is required by September 15" จึงต้องลงทะเบียนล่วงหน้า ตอบข้อ A และเข้างานฟรีไม่ต้องจ่ายเงิน',
      'อ่านคำว่า "free" และ "required" แยกกันให้ชัด ค่าเข้าฟรีไม่ได้แปลว่าไม่ต้องลงทะเบียน',
      10
    ],

    // R009 – online product review
    [
      'R009', 'Reading Mission', 'Part 7', 'Review', 'Hard',
      'Customer Review – HomePro Air Purifier X3\n' +
      'Rating: 4 out of 5 stars\n\n' +
      'I bought this air purifier two months ago for my small apartment, and overall I am satisfied. The unit is quiet enough to run while I sleep, and the air feels noticeably fresher within an hour. My only complaint is that the replacement filters are quite expensive and can only be ordered directly from the manufacturer. The mobile app, however, is well-designed and easy to use.',
      'What does the reviewer dislike about the product?',
      'The cost of the replacement filters.',
      'The noise level at night.',
      'The size of the unit.',
      'The quality of the mobile app.',
      'A',
      'ผู้รีวิวบอกว่า "My only complaint is that the replacement filters are quite expensive" หมายความว่าข้อตำหนิเดียวคือไส้กรองราคาแพง ตอบข้อ A',
      'คำว่า complaint, downside, drawback มักจะเป็น keyword บอกข้อเสียในรีวิว',
      10
    ],

    // R010 – hotel reservation confirmation
    [
      'R010', 'Reading Mission', 'Part 7', 'Confirmation', 'Easy',
      'Reservation Confirmation\n\n' +
      'Guest: Ms. Hannah Liu\n' +
      'Hotel: Greenleaf Resort, Chiang Mai\n' +
      'Check-in: December 22\n' +
      'Check-out: December 26\n' +
      'Room Type: Deluxe Garden View, 1 King Bed\n' +
      'Total: $480 (taxes included)\n\n' +
      'A complimentary breakfast is served daily from 6:30 a.m. to 10:00 a.m. Free cancellation is available up to 48 hours before the check-in date.',
      'How many nights will Ms. Liu stay at the hotel?',
      'Four', 'Three', 'Five', 'Six',
      'A',
      'check-in วันที่ 22 และ check-out วันที่ 26 ธันวาคม จำนวนคืนคือ 26 - 22 = 4 คืน จึงตอบ Four',
      'การคำนวณคืนพักให้เอาวัน check-out ลบ check-in ห้ามรวมวัน check-out เป็นคืนพัก',
      10
    ]

  ];
}


/* =====================================================================
 *  End of Phase 2C-3.
 *  Next sub-phases will add:
 *    - getSampleQuestions() aggregator
 *    - insertSampleQuestionsIfEmpty_(ss)
 *    - Hook into setupSpreadsheet()
 *  Followed by:
 *    - getQuestions(mode, limit)
 *    - submitGameResult(result)
 *    - saveMistakes(playerName, mistakes)
 *    - getLeaderboard()
 * ===================================================================== */
