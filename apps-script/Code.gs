// Class score history and question analysis for the quiz sites (version 7).
// Deploy as a Web app (Execute as: Me, Who has access: Anyone); see SETUP.md.
// One spreadsheet serves every quiz: each lesson has its own history tab (see LESSONS), and the
// 'Item Analysis' tab counts how often each question was asked and missed.
//
// POST (Content-Type text/plain) body:
//   {"lesson","name","mode","score","total","percent","band","finishedAt"[, "asked": [qid...], "missed": [qid...]]}
//   total is the number of questions in the attempt (1-500). asked/missed hold stable question ids
//   "<lessonKey>:<mode>:<qid>" (never the answers chosen); pages older than version 7 send neither, and
//   their attempts are still stored.
// GET ?lesson=isr|armor|fieldartillery|armyops|signal|signaljoint|combined&mode=all|easy|medium|hard&limit=100
//   -> {"ok":true,"rows":[...newest first]}
// GET ?action=items&lesson=<key>|all
//   -> {"ok":true,"kind":"items","version":7,"rows":[{qid,lesson,mode,asked,missed}, ...]}
// A request without "lesson" is treated as the first lesson ('isr'), so the oldest quiz pages keep working.

var VERSION = 7;
var LESSONS = {
  isr: 'History',        // first quiz: ISR Operations (original tab name kept)
  armor: 'Armor History',                  // Fundamentals of Armor Operations quiz
  fieldartillery: 'Field Artillery History', // Field Artillery Operations quiz
  armyops: 'Army Operations History',        // Introduction to Army Operations quiz
  signal: 'Signal Support History',          // Signal Support in Combined Arms Operations quiz (Module 3)
  signaljoint: 'Signal Joint Operations History', // Signal Support in Joint Operations quiz (Module 3)
  coalition: 'Signal Coalition Operations History', // Signal Support in Coalition Operations quiz (Module 3)
  combined: 'Combined Exam History',         // Module 2 pool exam
  modulethree: 'Module 3 Exam History'       // 45 questions, 15 each from the three Module 3 lessons
};
// Only for pages from before version 7 that send no total: their attempt length was fixed.
var LEGACY_TOTALS = { combined: 30 };
var LEGACY_DEFAULT_TOTAL = 25;
var MAX_TOTAL = 500;                     // sanity cap on questions per attempt (attempts serve a whole bank)
var DEFAULT_LESSON = 'isr';
var HEADERS = ['Received', 'Name', 'Mode', 'Score', 'Total', 'Percent', 'Band', 'Finished', 'Missed'];
var LEGACY_HEADER_COUNT = 8;               // history tabs created before version 7 have no 'Missed' column
var ITEM_TAB = 'Item Analysis';
var ITEM_HEADERS = ['QID', 'Lesson', 'Mode', 'Asked', 'Missed', 'Miss rate', 'Last updated'];
var QID_PATTERN = /^([a-z][a-z0-9]{1,23}):(easy|medium|hard):([a-z][a-z0-9]{1,23}-[emh]-[0-9]{2,4})$/;
var MISSED_CELL_MAX = 4000;                // characters kept in an attempt row's 'Missed' cell
var MODES = ['easy', 'medium', 'hard'];
var BANDS = ['Mastery', 'Proficient', 'Developing', 'Needs review'];
var MAX_LIMIT = 200;

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var tab = tabFor(data.lesson);
    if (!tab) return reply({ ok: false, error: 'unknown lesson' });
    var name = cleanName(data.name);
    var mode = String(data.mode || '').toLowerCase();
    var total = totalFor(data);
    var score = Number(data.score);
    if (name.length < 2 || name.length > 40) return reply({ ok: false, error: 'name must be 2-40 characters' });
    if (MODES.indexOf(mode) === -1) return reply({ ok: false, error: 'invalid mode' });
    if (!isInteger(total) || total < 1 || total > MAX_TOTAL) return reply({ ok: false, error: 'invalid total' });
    if (!isInteger(score) || score < 0 || score > total) return reply({ ok: false, error: 'invalid score' });
    var percent = Math.round((score / total) * 100);
    var band = BANDS.indexOf(data.band) === -1 ? '' : data.band;
    var finished = new Date(data.finishedAt);
    if (isNaN(finished.getTime())) finished = new Date();
    var items = itemsFor(data, mode, total, score);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var now = new Date();
      sheet(tab).appendRow([now, name, mode, score, total, percent, band, finished, items ? missedCell(items.missed) : '']);
      if (items) recordItems(items, now);
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true });
  } catch (error) {
    return reply({ ok: false, error: 'could not save' });
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'history').toLowerCase();
  if (action === 'items') return reply(itemRows(params.lesson));
  if (action !== 'history') return reply({ ok: false, error: 'unknown action' });
  var tab = tabFor(params.lesson);
  if (!tab) return reply({ ok: false, error: 'unknown lesson' });
  var mode = String(params.mode || 'all').toLowerCase();
  var limit = Math.min(Math.max(parseInt(params.limit, 10) || 100, 1), MAX_LIMIT);
  var values = sheet(tab).getDataRange().getValues().slice(1);
  var rows = [];
  for (var i = values.length - 1; i >= 0 && rows.length < limit; i--) {
    var v = values[i];
    if (mode !== 'all' && v[2] !== mode) continue;
    rows.push({
      name: String(v[1]),
      mode: String(v[2]),
      score: Number(v[3]),
      total: Number(v[4]),
      percent: Number(v[5]),
      band: String(v[6]),
      finishedAt: toIso(v[7] || v[0])
    });
  }
  return reply({ ok: true, rows: rows });
}

// The attempt length the page reports (1-500). Pages from before version 7 always sent the fixed total of
// their quiz, so a missing total falls back to that.
function totalFor(data) {
  if (data.total === undefined || data.total === null || data.total === '') {
    var key = String(data.lesson || DEFAULT_LESSON).toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEGACY_TOTALS, key) ? LEGACY_TOTALS[key] : LEGACY_DEFAULT_TOTAL;
  }
  return Number(data.total);
}

// Validated question ids of one attempt, or null to store the attempt alone. Item counts are only kept when
// the lists are exactly consistent with the attempt: total distinct, well-formed ids of this mode and of known
// lessons, and total - score of them missed. Anything else (an old page, a malformed list) is ignored.
function itemsFor(data, mode, total, score) {
  if (!Array.isArray(data.asked) || !Array.isArray(data.missed)) return null;
  if (data.asked.length !== total || data.missed.length !== total - score) return null;
  var asked = {};
  for (var i = 0; i < data.asked.length; i++) {
    var qid = validQid(data.asked[i], mode);
    if (!qid || asked[qid]) return null;
    asked[qid] = true;
  }
  var missed = {};
  for (var j = 0; j < data.missed.length; j++) {
    var miss = validQid(data.missed[j], mode);
    if (!miss || !asked[miss] || missed[miss]) return null;
    missed[miss] = true;
  }
  return { asked: data.asked.slice(), missed: data.missed.slice(), missedSet: missed };
}

function validQid(value, mode) {
  if (typeof value !== 'string' || value.length > 64) return null;
  var match = QID_PATTERN.exec(value);
  if (!match || match[2] !== mode || !Object.prototype.hasOwnProperty.call(LESSONS, match[1])) return null;
  // The qid itself is <lessonKey>-<e|m|h>-NN: it must name the same lesson and difficulty.
  if (match[3].indexOf(match[1] + '-' + mode.charAt(0) + '-') !== 0) return null;
  return value;
}

function missedCell(missed) {
  var text = missed.join(',');
  return text.length > MISSED_CELL_MAX ? text.slice(0, text.lastIndexOf(',', MISSED_CELL_MAX)) + ',…' : text;
}

// Adds one to Asked for every question of the attempt and one to Missed for every question answered wrongly.
// Runs under the script lock taken in doPost, so concurrent attempts never lose a count.
function recordItems(items, now) {
  var target = itemSheet();
  var last = target.getLastRow();
  var index = {};
  if (last > 1) {
    var values = target.getRange(2, 1, last - 1, 5).getValues();
    for (var i = 0; i < values.length; i++) {
      index[String(values[i][0])] = { row: i + 2, asked: Number(values[i][3]) || 0, missed: Number(values[i][4]) || 0 };
    }
  }
  var added = [];
  for (var k = 0; k < items.asked.length; k++) {
    var qid = items.asked[k];
    var hit = items.missedSet[qid] ? 1 : 0;
    var entry = index[qid];
    if (entry) {
      entry.asked += 1;
      entry.missed += hit;
      target.getRange(entry.row, 4, 1, 4).setValues([[entry.asked, entry.missed, missRate(entry.missed, entry.asked), now]]);
    } else {
      var parts = qid.split(':');
      added.push([qid, parts[0], parts[1], 1, hit, missRate(hit, 1), now]);
    }
  }
  if (added.length) target.getRange(target.getLastRow() + 1, 1, added.length, ITEM_HEADERS.length).setValues(added);
}

function missRate(missed, asked) {
  return asked > 0 ? Math.round((missed / asked) * 1000) / 1000 : 0;
}

function itemRows(lesson) {
  var key = String(lesson || 'all').toLowerCase();
  if (key !== 'all' && !Object.prototype.hasOwnProperty.call(LESSONS, key)) return { ok: false, error: 'unknown lesson' };
  var target = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ITEM_TAB);
  var rows = [];
  if (target && target.getLastRow() > 1) {
    var values = target.getRange(2, 1, target.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      var match = QID_PATTERN.exec(String(v[0]));
      if (!match || (key !== 'all' && match[1] !== key)) continue;
      rows.push({ qid: String(v[0]), lesson: match[1], mode: match[2], asked: Number(v[3]) || 0, missed: Number(v[4]) || 0 });
    }
  }
  return { ok: true, kind: 'items', version: VERSION, rows: rows };
}

// Only lessons listed in LESSONS are accepted, so callers cannot create arbitrary tabs.
function tabFor(lesson) {
  var key = String(lesson || DEFAULT_LESSON).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LESSONS, key) ? LESSONS[key] : null;
}

// A history tab, created with headers when missing. A tab made before version 7 (8 headers) gets the
// 'Missed' header added once; its existing rows are never touched.
function sheet(name) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var target = book.getSheetByName(name) || book.insertSheet(name);
  if (target.getLastRow() === 0) {
    target.appendRow(HEADERS);
    target.setFrozenRows(1);
  } else if (target.getLastColumn() === LEGACY_HEADER_COUNT) {
    var head = target.getRange(1, 1, 1, LEGACY_HEADER_COUNT).getValues()[0];
    if (head.join('|') === HEADERS.slice(0, LEGACY_HEADER_COUNT).join('|')) target.getRange(1, HEADERS.length).setValue(HEADERS[HEADERS.length - 1]);
  }
  return target;
}

function itemSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var target = book.getSheetByName(ITEM_TAB) || book.insertSheet(ITEM_TAB);
  if (target.getLastRow() === 0) {
    target.appendRow(ITEM_HEADERS);
    target.setFrozenRows(1);
  }
  return target;
}

// Strips control characters and a leading formula trigger so names cannot run as spreadsheet formulas.
function cleanName(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, 40);
}

function isInteger(n) {
  return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
}

function toIso(value) {
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
