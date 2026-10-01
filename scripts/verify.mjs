// Dependency-free checks for index.html. Run: node scripts/verify.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'inline script present');
const script = scriptMatch[1];

const EXPECTED = {
  isr: 'https://atticus-42.github.io/isr-mastery-quiz/',
  armor: 'https://atticus-42.github.io/armor-mastery-quiz/',
  fieldartillery: 'https://atticus-42.github.io/field-artillery-mastery-quiz/',
  armyops: 'https://atticus-42.github.io/army-operations-scenario-quiz/',
  combined: 'https://atticus-42.github.io/combined-mastery-exam/'
};
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwTNNYOiebIGo46PzM3fUA9VT6XnS740D72prOPg-0OJ5Kvg4W8LVl-xJEo_gxImxqnmg/exec';

// ---------- Small fake DOM: enough for the hub's rendering code. ----------
class FakeNode {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = [];
    this.attributes = {}; this.className = ''; this.hidden = false; this.disabled = false;
    this.listeners = {}; this._text = ''; this.parentNode = null; this._id = '';
  }
  get id() { return this._id; }
  set id(v) { this._id = String(v); this.ownerDocument._ids.set(this._id, this); }
  get firstChild() { return this.children[0] || null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)); }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = value; }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { (this.listeners.click || []).forEach((fn) => fn({ type: 'click', target: this })); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  set innerHTML(_) { throw new Error('innerHTML must not be used'); }
  get innerHTML() { throw new Error('innerHTML must not be read'); }
  insertAdjacentHTML() { throw new Error('insertAdjacentHTML must not be used'); }
  // Every node in this subtree.
  all() { return [this, ...this.children.flatMap((c) => c.all())]; }
}
function makeDocument(sourceHtml) {
  const doc = { _ids: new Map() };
  doc.createElement = (tag) => new FakeNode(doc, tag);
  doc.getElementById = (id) => doc._ids.get(id) || null;
  // Pre-create every element with an id in the real markup (static cards are left out
  // when `withoutCards` is used, to test that config entries build their own cards).
  for (const m of sourceHtml.matchAll(/<(\w+)[^>]*\sid="([^"]+)"([^>]*)>/g)) {
    const node = new FakeNode(doc, m[1]);
    node.id = m[2];
    if (/\shidden(\s|>|$)/.test(m[0])) node.hidden = true;
  }
  return doc;
}

function loadContext() {
  const ctx = { console, setTimeout, clearTimeout, Promise, AbortController, Date, Math, JSON, encodeURIComponent };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return ctx;
}

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
}
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const lesson = new URL(url).searchParams.get('lesson');
    return handler(lesson, url, opts);
  };
  fn.calls = calls;
  return fn;
}

// ---------- Test runner ----------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const ctx = loadContext();
const iso = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).toISOString();
const row = (over = {}) => ({ name: 'Cruz', mode: 'easy', score: 20, total: 25, percent: 80, band: 'Proficient', finishedAt: iso(2026, 9, 1, 8, 30), ...over });

// --- Config ---
test('config has the five exams with unique keys and URLs', () => {
  const exams = ctx.EXAMS;
  assert.equal(exams.length, 5);
  assert.equal(new Set(exams.map((e) => e.key)).size, 5);
  assert.equal(new Set(exams.map((e) => e.url)).size, 5);
  for (const e of exams) {
    assert.equal(e.url, EXPECTED[e.key], `url for ${e.key}`);
    assert.equal(e.lesson, e.key);
    assert.ok(e.title && e.description, `title/description for ${e.key}`);
  }
  assert.equal(exams.find((e) => e.key === 'combined').total, 30);
  for (const k of ['isr', 'armor', 'fieldartillery', 'armyops']) assert.equal(exams.find((e) => e.key === k).total, 25);
  assert.equal(ctx.HISTORY_ENDPOINT, ENDPOINT);
});

test('static HTML cards are plain anchors matching the config (work without JS)', () => {
  for (const [key, url] of Object.entries(EXPECTED)) {
    const block = html.match(new RegExp(`<li[^>]*id="card-${key}"[\\s\\S]*?</article>`));
    assert.ok(block, `static card for ${key}`);
    assert.ok(block[0].includes(`<a class="start-link" href="${url}">Start exam`), `anchor for ${key}`);
    assert.ok(block[0].includes(`id="stats-${key}"`), `stats slot for ${key}`);
  }
  assert.ok(!/target="_blank"/.test(html), 'exams open in the same tab');
  assert.match(html, /<noscript>[^<]*<p[^>]*>JavaScript is needed to load the history\.<\/p>/);
});

test('no external URLs except the five quiz links and the history endpoint', () => {
  const allowed = new Set([...Object.values(EXPECTED), ENDPOINT]);
  const found = [...html.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi)].map((m) => m[0]);
  const bad = found.filter((u) => !allowed.has(u));
  assert.deepEqual(bad, []);
  assert.ok(!/<link\b[^>]*href=/i.test(html), 'no external stylesheets');
  assert.ok(!/<script\b[^>]*src=/i.test(html), 'no external scripts');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(!/@import|url\(/i.test(css), 'no CSS imports or url() assets');
  assert.ok(!/<(img|iframe|video|audio|source|object|embed)\b/i.test(html), 'no embedded external media');
});

test('script never uses HTML-string sinks or storage', () => {
  for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'localStorage', 'sessionStorage', 'document.cookie']) {
    assert.ok(!script.includes(sink), `script must not contain ${sink}`);
  }
});

// --- Pure functions ---
test('summarize: attempts, rounded average, top score with name, latest', () => {
  const rows = [
    row({ name: 'A', percent: 60, finishedAt: iso(2026, 9, 1, 8, 0) }),
    row({ name: 'B', percent: 92, finishedAt: iso(2026, 9, 3, 9, 0) }),
    row({ name: 'C', percent: 75, finishedAt: iso(2026, 9, 2, 10, 0) })
  ].map(ctx.normalizeRow);
  const s = ctx.summarize(rows);
  assert.equal(s.attempts, 3);
  assert.equal(s.average, 76);
  assert.equal(s.top.name, 'B');
  assert.equal(s.latest, new Date(iso(2026, 9, 3, 9, 0)).getTime());
  const empty = ctx.summarize([]);
  assert.deepEqual(JSON.parse(JSON.stringify(empty)), { attempts: 0, average: null, top: null, latest: null });
  assert.equal(ctx.summarize(null).attempts, 0);
});

test('summarize: ties keep the earliest attempt as top score', () => {
  const rows = [row({ name: 'Later', percent: 90, finishedAt: iso(2026, 9, 5, 8, 0) }), row({ name: 'Earlier', percent: 90, finishedAt: iso(2026, 9, 1, 8, 0) })].map(ctx.normalizeRow);
  assert.equal(ctx.summarize(rows).top.name, 'Earlier');
});

test('normalizeRow: computes percent, clamps, validates mode, caps name', () => {
  const r = ctx.normalizeRow({ name: '  x'.repeat(100), mode: 'HARD', score: '18', total: 25, finishedAt: 'not a date' });
  assert.equal(r.percent, 72);
  assert.equal(r.mode, 'hard');
  assert.equal(r.time, null);
  assert.ok(r.name.length <= ctx.NAME_MAX);
  assert.equal(ctx.normalizeRow({ percent: 140 }).percent, 100);
  assert.equal(ctx.normalizeRow({ percent: 50, mode: 'insane' }).mode, 'other');
  assert.equal(ctx.normalizeRow({ percent: 50 }).name, 'Anonymous');
  assert.equal(ctx.normalizeRow({ name: 'no score' }), null);
  assert.equal(ctx.normalizeRow('string'), null);
  assert.equal(ctx.normalizeRow([1, 2]), null);
  assert.equal(ctx.normalizeRow(null), null);
});

test('filterByMode: all returns a copy; specific modes filter', () => {
  const rows = ['easy', 'medium', 'hard', 'easy'].map((mode) => ctx.normalizeRow(row({ mode })));
  const all = ctx.filterByMode(rows, 'all');
  assert.equal(all.length, 4);
  assert.notEqual(all, rows);
  assert.equal(ctx.filterByMode(rows, 'easy').length, 2);
  assert.equal(ctx.filterByMode(rows, 'hard').length, 1);
  assert.equal(ctx.filterByMode(rows, 'medium').length, 1);
  assert.equal(ctx.filterByMode(null, 'easy').length, 0);
});

test('mergeRecent: newest first across lists, undated last, capped at n', () => {
  const mk = (name, t) => ({ name, time: t });
  const lists = [[mk('a', 5), mk('b', 1)], [mk('c', 9), mk('d', null)], [mk('e', 3)], null];
  assert.deepEqual([...ctx.mergeRecent(lists, 10)].map((r) => r.name), ['c', 'a', 'e', 'b', 'd']);
  assert.deepEqual([...ctx.mergeRecent(lists, 2)].map((r) => r.name), ['c', 'a']);
  assert.equal(ctx.mergeRecent(lists, 0).length, 0);
  assert.equal(ctx.mergeRecent(lists, 1e9).length, 5);
  const many = [Array.from({ length: 500 }, (_, i) => mk(String(i), i))];
  assert.equal(ctx.mergeRecent(many, 1e9).length, 100, 'hard cap');
});

test('formatDate: local YYYY-MM-DD HH:mm, dash for missing', () => {
  assert.equal(ctx.formatDate(new Date(2026, 0, 5, 7, 3).getTime()), '2026-01-05 07:03');
  assert.equal(ctx.formatDate(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31 23:59');
  assert.equal(ctx.formatDate(null), '—');
  assert.equal(ctx.formatDate(NaN), '—');
});

test('parseHistoryResponse: ok, ok:false, malformed JSON, wrong shapes, row cap', () => {
  const good = ctx.parseHistoryResponse(JSON.stringify({ ok: true, rows: [row(), { junk: true }, row({ name: 'B' })] }));
  assert.equal(good.ok, true);
  assert.equal(good.rows.length, 2, 'invalid rows dropped');
  const bad = ctx.parseHistoryResponse(JSON.stringify({ ok: false, error: 'unknown lesson' }));
  assert.deepEqual([bad.ok, bad.error, bad.rows.length], [false, 'unknown lesson', 0]);
  for (const body of ['<html>Sign in</html>', '', 'null', '42', '{"ok":true}', '{"ok":true,"rows":"x"}', '{"ok":"true","rows":[]}']) {
    const r = ctx.parseHistoryResponse(body);
    assert.equal(r.ok, false, `rejects ${JSON.stringify(body)}`);
  }
  const huge = ctx.parseHistoryResponse(JSON.stringify({ ok: true, rows: Array.from({ length: 1000 }, () => row()) }));
  assert.equal(huge.rows.length, ctx.HISTORY_LIMIT);
});

test('historyUrl: correct query and encoding', () => {
  assert.equal(ctx.historyUrl('armor'), `${ENDPOINT}?lesson=armor&mode=all&limit=200`);
  assert.ok(ctx.historyUrl('a&b=c').includes('lesson=a%26b%3Dc'));
});

// --- Fetching and error handling ---
test('fetchLesson: network failure, HTTP error, ok:false and malformed JSON never reject', async () => {
  const cases = [
    [async () => { throw new TypeError('Failed to fetch'); }, 'network error'],
    [async () => response('oops', { ok: false, status: 500 }), 'HTTP 500'],
    [async () => response({ ok: false, error: 'unknown lesson' }), 'unknown lesson'],
    [async () => response('{not json'), 'malformed response'],
    [async () => ({ ok: true, status: 200, text: async () => { throw new Error('body'); } }), 'network error']
  ];
  for (const [fn, error] of cases) {
    const r = await ctx.fetchLesson(fn, 'isr');
    assert.equal(r.ok, false);
    assert.equal(r.error, error);
  }
});

test('fetchLesson: GET without cookies to the endpoint', async () => {
  const f = fakeFetch(() => response({ ok: true, rows: [] }));
  await ctx.fetchLesson(f, 'combined');
  assert.equal(f.calls[0].url, `${ENDPOINT}?lesson=combined&mode=all&limit=200`);
  assert.equal(f.calls[0].opts.method, 'GET');
  assert.equal(f.calls[0].opts.credentials, 'omit');
  assert.equal(f.calls[0].opts.headers, undefined);
});

// --- Rendering with the fake DOM ---
const HOSTILE = '<img src=x onerror=alert(1)><script>alert(2)</script>';
function dataset() {
  return {
    isr: { ok: true, rows: [row({ name: 'Santos', mode: 'easy', percent: 88, score: 22, finishedAt: iso(2026, 9, 30, 14, 5) }), row({ name: HOSTILE, mode: 'hard', percent: 40, score: 10, band: '<b>Review</b>', finishedAt: iso(2026, 9, 29, 9, 0) })] },
    armor: { ok: true, rows: [row({ name: 'Reyes', mode: 'medium', percent: 96, score: 24, finishedAt: iso(2026, 9, 28, 10, 0) })] },
    fieldartillery: { ok: false, error: 'unknown lesson' },
    armyops: { ok: true, rows: [] },
    combined: { ok: true, rows: Array.from({ length: 12 }, (_, i) => row({ name: `C${i}`, mode: 'hard', percent: 50 + i, score: 15, total: 30, finishedAt: iso(2026, 9, 10 + i, 12, 0) })) }
  };
}
async function renderHub(data, fetchImpl) {
  const doc = makeDocument(html);
  const f = fetchImpl || fakeFetch((lesson) => response(data[lesson]));
  const hub = ctx.createHub(doc, f);
  await hub.init();
  return { doc, hub, f };
}
const rowsOf = (doc, id) => doc.getElementById(id).children;
const cellTexts = (tr) => tr.children.map((c) => c.textContent);

test('init fetches all five lessons in parallel and reveals the history UI', async () => {
  let inFlight = 0, peak = 0;
  const data = dataset();
  const f = fakeFetch(async (lesson) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return response(data[lesson]); });
  const { doc } = await renderHub(data, f);
  assert.equal(f.calls.length, 5);
  assert.equal(peak, 5, 'parallel requests');
  assert.deepEqual(f.calls.map((c) => new URL(c.url).searchParams.get('lesson')).sort(), ['armor', 'armyops', 'combined', 'fieldartillery', 'isr']);
  assert.equal(doc.getElementById('history-app').hidden, false);
  assert.equal(doc.getElementById('history-refresh').hidden, false);
});

test('summary table, card stats and per-exam error/empty states', async () => {
  const { doc } = await renderHub(dataset());
  const summary = rowsOf(doc, 'summary-body');
  assert.equal(summary.length, 5);
  const byExam = Object.fromEntries(summary.map((tr) => [tr.children[0].textContent, cellTexts(tr)]));
  assert.deepEqual(byExam['Armor Operations'], ['Armor Operations', '1', '96%', '96% (Reyes)', '2026-09-28 10:00']);
  assert.deepEqual(byExam['Field Artillery Operations'].slice(0, 2), ['Field Artillery Operations', 'Not available yet']);
  assert.equal(byExam['Army Operations'][1], '0');
  assert.match(doc.getElementById('stats-fieldartillery').textContent, /Not available yet/);
  assert.match(doc.getElementById('stats-armyops').textContent, /No attempts yet/);
  assert.match(doc.getElementById('stats-armor').textContent, /Attempts1/);
  assert.match(doc.getElementById('stats-armor').textContent, /Reyes · 96%/);
  const status = doc.getElementById('history-status');
  assert.match(status.className, /status-partial/);
  assert.match(status.textContent, /1 of 5 exams/);
  for (const tr of summary) for (const td of tr.children) assert.ok(td.getAttribute('data-label'), 'cells carry labels for the narrow layout');
});

test('recent attempts: 10 newest across exams with all columns', async () => {
  const { doc } = await renderHub(dataset());
  const recent = rowsOf(doc, 'recent-body');
  assert.equal(recent.length, 10);
  const first = cellTexts(recent[0]);
  assert.deepEqual(first, ['Santos', 'ISR Operations', 'Easy', '22 / 25', '88%', 'Proficient', '2026-09-30 14:05']);
  assert.equal(cellTexts(recent[1])[0], HOSTILE);
  assert.equal(cellTexts(recent[2])[0], 'Reyes');
  assert.equal(cellTexts(recent[3])[0], 'C11');
  assert.equal(doc.getElementById('recent-empty').hidden, true);
});

test('XSS: hostile names and bands are rendered as plain text nodes only', async () => {
  const { doc } = await renderHub(dataset());
  const nodes = doc.getElementById('recent-body').all();
  const tags = new Set(nodes.map((n) => n.tagName));
  assert.deepEqual([...tags].sort(), ['TBODY', 'TD', 'TR']);
  const hostileCell = nodes.find((n) => n.tagName === 'TD' && n.textContent === HOSTILE);
  assert.ok(hostileCell, 'hostile name present verbatim as text');
  assert.equal(hostileCell.children.length, 0);
  assert.ok(nodes.some((n) => n.textContent === '<b>Review</b>'));
  // Hostile name as top score on a card, still text only.
  const solo = { ...dataset(), isr: { ok: true, rows: [row({ name: HOSTILE, percent: 99 })] } };
  const r2 = await renderHub(solo);
  const statNodes = r2.doc.getElementById('stats-isr').all();
  assert.ok(statNodes.every((n) => ['DIV', 'DL', 'DT', 'DD'].includes(n.tagName)));
  assert.match(r2.doc.getElementById('stats-isr').textContent, /<img src=x onerror=alert\(1\)>/);
});

test('mode filter applies to cards, summary and recent tables', async () => {
  const { doc } = await renderHub(dataset());
  doc.getElementById('filter-hard').click();
  assert.equal(doc.getElementById('filter-hard').getAttribute('aria-pressed'), 'true');
  assert.equal(doc.getElementById('filter-all').getAttribute('aria-pressed'), 'false');
  const recent = rowsOf(doc, 'recent-body').map(cellTexts);
  assert.equal(recent.length, 10);
  assert.ok(recent.every((r) => r[2] === 'Hard'));
  const armor = rowsOf(doc, 'summary-body').find((tr) => tr.children[0].textContent === 'Armor Operations');
  assert.deepEqual(cellTexts(armor).slice(1), ['0', '—', '—', '—']);
  assert.match(doc.getElementById('stats-armor').textContent, /No Hard attempts yet/);
  assert.match(doc.getElementById('stats-isr').textContent, /Attempts \(Hard\)1/);
  doc.getElementById('filter-medium').click();
  assert.deepEqual(rowsOf(doc, 'recent-body').map((tr) => tr.children[0].textContent), ['Reyes']);
  doc.getElementById('filter-easy').click();
  assert.deepEqual(rowsOf(doc, 'recent-body').map((tr) => tr.children[0].textContent), ['Santos']);
  doc.getElementById('filter-all').click();
  assert.equal(rowsOf(doc, 'recent-body').length, 10);
});

test('total failure shows an error status, empty tables stay safe, Refresh recovers', async () => {
  let fail = true;
  const data = dataset();
  const f = fakeFetch(async (lesson) => { if (fail) throw new TypeError('offline'); return response(data[lesson]); });
  const { doc, hub } = await renderHub(data, f);
  const status = doc.getElementById('history-status');
  assert.match(status.className, /status-error/);
  assert.match(status.textContent, /could not be loaded/);
  assert.equal(rowsOf(doc, 'recent-body').length, 0);
  assert.equal(doc.getElementById('recent-empty').hidden, false);
  for (const e of ctx.EXAMS) assert.match(doc.getElementById(`stats-${e.key}`).textContent, /Not available yet/);
  fail = false;
  doc.getElementById('history-refresh').click();
  assert.equal(doc.getElementById('history-refresh').disabled, true, 'refresh disabled while loading');
  assert.match(status.textContent, /Loading/);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(doc.getElementById('history-refresh').disabled, false);
  assert.match(status.className, /status-partial/);
  assert.equal(rowsOf(doc, 'recent-body').length, 10);
  assert.equal(f.calls.length, 10);
  assert.ok(hub.state.results.isr.rows.length === 2);
});

test('all lessons empty shows the empty state and ready status', async () => {
  const empty = Object.fromEntries(Object.keys(EXPECTED).map((k) => [k, { ok: true, rows: [] }]));
  const { doc } = await renderHub(empty);
  assert.match(doc.getElementById('history-status').className, /status-ready/);
  assert.equal(doc.getElementById('recent-empty').hidden, false);
  assert.equal(rowsOf(doc, 'summary-body').length, 5);
});

test('a config entry without a static card gets one built from the config', async () => {
  const stripped = html.replace(/<li id="card-armyops"[\s\S]*?<\/li>\s*(?=<\/ul>)/, '');
  assert.ok(!stripped.includes('id="card-armyops"'));
  const doc = makeDocument(stripped);
  const data = dataset();
  await ctx.createHub(doc, fakeFetch((lesson) => response(data[lesson]))).init();
  const card = doc.getElementById('card-armyops');
  assert.ok(card, 'card built');
  const link = card.all().find((n) => n.tagName === 'A');
  assert.equal(link.getAttribute('href'), EXPECTED.armyops);
  assert.match(link.textContent, /^Start exam/);
  assert.match(doc.getElementById('stats-armyops').textContent, /No attempts yet/);
});

// --- Accessibility / markup sanity ---
test('markup: landmarks, headings, labelled filter group, viewport, lang', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  for (const tag of ['<header', '<main id="main"', 'aria-labelledby="exams-heading"', 'aria-labelledby="history-heading"']) assert.ok(html.includes(tag), tag);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /role="group" aria-label="Filter history by mode"/);
  assert.match(html, /<p class="eyebrow">Philippine Army · Mastery Quizzes<\/p>/);
  assert.match(html, /<h1>Choose your exam<\/h1>/);
  assert.match(html, /:focus-visible \{ outline: 3px solid var\(--color-focus\)/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /@media print/);
  assert.match(html, /<div class="hero-art" aria-hidden="true">/);
  assert.match(html, /Class score history summary/);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`ok   ${t.name}`); }
  catch (err) { console.log(`FAIL ${t.name}\n     ${err.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
