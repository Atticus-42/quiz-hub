// The hub page (index.html): ported from the hub's own verifier. Its small fake DOM pre-creates every element
// that has an id in the real markup, then runs the page script in node:vm (no network).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ROOT as root, HISTORY_ENDPOINT as ENDPOINT } from '../build.mjs';
import { test as runTest, withoutFontPreloads, cssUrls, isLocalAsset } from './harness.mjs';

export async function hubSuite({ lessons }) {
const html = readFileSync(join(root, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'inline script present');
const script = scriptMatch[1];

// The six exams of the original hub keep their keys and order; each now lives in a folder of this site.
const EXPECTED = Object.fromEntries(lessons.map(lesson => [lesson.key, `${lesson.slug}/`]));
for (const [key, url] of Object.entries({ isr: 'isr/', armor: 'armor/', fieldartillery: 'field-artillery/', armyops: 'army-operations/', combined: 'combined/', signal: 'signal-support/', signaljoint: 'joint-signal/' })) {
  assert.equal(EXPECTED[key], url, `${key} is served at /quiz-hub/${url}`);
}
const MODULE_EXAMS = {};
for (const lesson of [...lessons].sort((a, b) => Number(Boolean(b.prominent)) - Number(Boolean(a.prominent)) || a.order - b.order)) (MODULE_EXAMS[lesson.module] ||= []).push(lesson.key);
const EXAM_COUNT = lessons.length;
const MODULE_2 = MODULE_EXAMS['module-2'];
const MODULE_3 = MODULE_EXAMS['module-3'];

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
  click(init = {}) {
    const ev = { type: 'click', target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    (this.listeners.click || []).forEach((fn) => fn(ev));
    return ev;
  }
  focus() { this.ownerDocument.activeElement = this; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  set innerHTML(_) { throw new Error('innerHTML must not be used'); }
  get innerHTML() { throw new Error('innerHTML must not be read'); }
  insertAdjacentHTML() { throw new Error('insertAdjacentHTML must not be used'); }
  // Every node in this subtree.
  all() { return [this, ...this.children.flatMap((c) => c.all())]; }
}
function makeDocument(sourceHtml) {
  const doc = { _ids: new Map(), activeElement: null };
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

// Fake window: location.hash, history.pushState and hashchange/popstate listeners.
function makeWindow(hash = '') {
  const listeners = {};
  const win = {
    location: { hash, pathname: '/quiz-hub/', search: '' },
    pushes: [],
    history: { pushState(_s, _t, url) { win.pushes.push(url); win.location.hash = String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : ''; } },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatch(type) { (listeners[type] || []).forEach((fn) => fn({ type })); },
    // Simulates back/forward: the browser changes the hash, then fires hashchange and popstate.
    navigate(newHash) { win.location.hash = newHash; win.dispatch('hashchange'); win.dispatch('popstate'); }
  };
  return win;
}

function loadContext() {
  const ctx = { console, setTimeout, clearTimeout, Promise, AbortController, Date, Math, JSON, encodeURIComponent, decodeURIComponent };
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
test('MODULES config is generated from lessons/*/lesson.json: unique ids, keys and URLs, exact URLs', () => {
  const modules = ctx.MODULES;
  assert.deepEqual([...modules].map((m) => m.id), ['module-2', 'module-3']);
  assert.equal(new Set(modules.map((m) => m.id)).size, modules.length);
  for (const m of modules) {
    assert.ok(m.title && m.description, `title/description for ${m.id}`);
    assert.deepEqual([...m.exams].map((e) => e.key), MODULE_EXAMS[m.id], `exams of ${m.id}`);
  }
  assert.equal(modules[0].title, 'Module 2');
  assert.equal(modules[0].description, 'ISR Operations, Armor Operations, Field Artillery Operations, Army Operations and the Combined Exam');
  assert.equal(modules[1].title, 'Module 3');
  assert.ok(modules[1].description.startsWith('Signal Support in Combined Arms Operations'));
  assert.equal(modules[1].note, 'More lessons coming');
  const exams = ctx.EXAMS;
  assert.equal(exams.length, EXAM_COUNT, 'EXAMS is the flat list of all module exams');
  assert.equal(new Set(exams.map((e) => e.key)).size, EXAM_COUNT);
  assert.equal(new Set(exams.map((e) => e.lesson)).size, EXAM_COUNT);
  assert.equal(new Set(exams.map((e) => e.url)).size, EXAM_COUNT);
  assert.deepEqual(MODULE_2.slice(0, 5), ['combined', 'isr', 'armor', 'fieldartillery', 'armyops']);
  assert.deepEqual(MODULE_3, ['signal', 'signaljoint']);
  for (const e of exams) {
    assert.equal(e.url, EXPECTED[e.key], `url for ${e.key}`);
    assert.equal(e.lesson, e.key);
    assert.ok(e.title && e.description, `title/description for ${e.key}`);
    assert.ok(MODULE_EXAMS[e.module].includes(e.key), `module back-reference for ${e.key}`);
  }
  assert.deepEqual([...exams.find((e) => e.key === 'combined').tags].map((tag) => tag.text), ['All four lessons', '60 questions', 'Easy · Medium · Hard']);
  assert.deepEqual([...exams.filter((e) => e.prominent).map((e) => e.key)], ['combined']);
  for (const lesson of lessons.filter((item) => !item.pool)) {
    const counts = ['easy', 'medium', 'hard'].map((mode) => lesson.attempts[mode]);
    const label = Math.min(...counts) === Math.max(...counts) ? `${counts[0]} questions per attempt` : `${Math.min(...counts)}–${Math.max(...counts)} questions per attempt`;
    assert.equal(exams.find((e) => e.key === lesson.key).tags[0].text, label, `${lesson.key} states its attempt length`);
  }
  assert.equal(exams.find((e) => e.key === 'signal').title, 'Signal Support in Combined Arms Operations');
  assert.equal(exams.find((e) => e.key === 'signaljoint').title, 'Signal Support in Joint Operations');
  assert.equal(exams.find((e) => e.key === 'signaljoint').url, 'joint-signal/');
  assert.equal(ctx.HISTORY_ENDPOINT, ENDPOINT);
});

test('moduleFromHash: known ids only, everything else means the chooser', () => {
  assert.equal(ctx.moduleFromHash('#module-2'), 'module-2');
  assert.equal(ctx.moduleFromHash('#module-3'), 'module-3');
  assert.equal(ctx.moduleFromHash('#MODULE-3'), 'module-3');
  for (const h of ['', '#', '#module-9', '#choose-module', '#%E0%A4%A', '#<script>', null, undefined, 42]) assert.equal(ctx.moduleFromHash(h), null, String(h));
});

test('static HTML cards are plain anchors matching the config (work without JS)', () => {
  for (const [key, url] of Object.entries(EXPECTED)) {
    const block = html.match(new RegExp(`<li[^>]*id="card-${key}"[\\s\\S]*?</article>`));
    assert.ok(block, `static card for ${key}`);
    assert.ok(block[0].includes(`<a class="start-link" href="${url}">Start exam`), `anchor for ${key}`);
    assert.ok(block[0].includes(`id="stats-${key}"`), `stats slot for ${key}`);
  }
  // Each static card sits in its own module's panel.
  for (const [id, keys] of Object.entries(MODULE_EXAMS)) {
    const panel = html.match(new RegExp(`<section class="exam-panel" id="${id}"[\\s\\S]*?</section>`))[0];
    for (const k of keys) assert.ok(panel.includes(`id="card-${k}"`), `card-${k} in ${id}`);
    assert.equal((panel.match(/class="start-link"/g) || []).length, keys.length, `only ${id} exams in its panel`);
  }
  assert.match(html, /<li class="is-prominent" id="card-combined"/);
  assert.ok(!/target="_blank"/.test(html), 'exams open in the same tab');
  assert.match(html, /<li class="tag tag-comprehensive">All four lessons<\/li>/);
  assert.match(html, /<noscript>[^<]*<p[^>]*>JavaScript is needed to load the history\.<\/p>/);
});

test('no external URLs except the history endpoint; quiz, class and instructor links are relative', () => {
  const allowed = new Set([ENDPOINT]);
  const found = [...html.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi)].map((m) => m[0]);
  const bad = found.filter((u) => !allowed.has(u));
  assert.deepEqual(bad, []);
  assert.ok(!/<link\b[^>]*href=/i.test(withoutFontPreloads(html)), 'no external stylesheets (only same-origin font preloads)');
  assert.ok(!/<script\b[^>]*src=/i.test(html), 'no external scripts');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(!/@import/i.test(css), 'no CSS imports');
  for (const target of cssUrls(css)) assert.ok(isLocalAsset(target) && !target.startsWith('../') && existsSync(join(root, target)), `url(${target}) must be a same-origin assets/ file on disk`);
  const hrefs = [...withoutFontPreloads(html).matchAll(/\bhref="([^"]*)"/g)].map((m) => m[1]);
    const allowedHref = new Set([...Object.values(EXPECTED), 'class/', 'schedule/?v=day-picker-2', 'instructor/', '#main', '#choose-module', ...Object.keys(MODULE_EXAMS).map((id) => `#${id}`)]);
  assert.deepEqual(hrefs.filter((href) => !allowedHref.has(href)), [], 'every link is a quiz folder, the class or instructor page, or an in-page fragment');
  const nonAsset = html.replace(/<(?:img|source)\b[^>]*>/gi, (tag) => (/\b(?:src|srcset)="(?:assets\/[\w-]+\.jpg(?: [\w.]+)?(?:, )?)+"/.test(tag) && !/\/\/|https?:/i.test(tag) ? '' : tag));
  assert.ok(!/<(img|iframe|video|audio|source|object|embed)\b/i.test(nonAsset), 'no embedded media except same-origin assets/ images');
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
    combined: { ok: true, rows: Array.from({ length: 12 }, (_, i) => row({ name: `C${i}`, mode: 'hard', percent: 50 + i, score: 15, total: 30, finishedAt: iso(2026, 9, 10 + i, 12, 0) })) },
    // The deployed sheet script does not know these lessons yet.
    signal: { ok: false, error: 'unknown lesson' },
    signaljoint: { ok: false, error: 'unknown lesson' }
  };
}
// Renders the hub with Module 2 selected unless another hash is given ('' = chooser only).
async function renderHub(data, fetchImpl, hash = '#module-2') {
  const doc = makeDocument(html);
  const f = fetchImpl || fakeFetch((lesson) => response(data[lesson]));
  const win = makeWindow(hash);
  const hub = ctx.createHub(doc, f, win);
  await hub.init();
  return { doc, hub, f, win };
}
const rowsOf = (doc, id) => doc.getElementById(id).children;
const cellTexts = (tr) => tr.children.map((c) => c.textContent);
const lessonsOf = (calls) => calls.map((c) => new URL(c.url).searchParams.get('lesson'));
const tick = () => new Promise((r) => setTimeout(r, 20));

test('init fetches the selected module first, then the rest for the overview, all in parallel', async () => {
  let inFlight = 0, peak = 0;
  const data = dataset();
  const f = fakeFetch(async (lesson) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return response(data[lesson]); });
  const { doc } = await renderHub(data, f);
  assert.equal(f.calls.length, EXAM_COUNT, 'each lesson fetched once');
  assert.equal(peak, EXAM_COUNT, 'parallel requests');
  assert.deepEqual(lessonsOf(f.calls).slice(0, MODULE_2.length).sort(), [...MODULE_2].sort());
  assert.deepEqual(lessonsOf(f.calls).slice(MODULE_2.length), MODULE_3);
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
  await tick();
  assert.equal(doc.getElementById('history-refresh').disabled, false);
  assert.match(status.className, /status-partial/);
  assert.equal(rowsOf(doc, 'recent-body').length, 10);
  assert.equal(f.calls.length, EXAM_COUNT + MODULE_2.length, 'Refresh reloads only the selected module');
  assert.ok(hub.state.results.isr.rows.length === 2);
});

test('all lessons empty shows the empty state and ready status', async () => {
  const empty = Object.fromEntries(Object.keys(EXPECTED).map((k) => [k, { ok: true, rows: [] }]));
  const { doc } = await renderHub(empty);
  assert.match(doc.getElementById('history-status').className, /status-ready/);
  assert.equal(doc.getElementById('recent-empty').hidden, false);
  assert.equal(rowsOf(doc, 'summary-body').length, 5);
  assert.equal(doc.getElementById('overview-module-2').textContent, '0 class attempts');
});

test('a config entry without a static card gets one built from the config', async () => {
  const stripped = html.replace(/<li id="card-armyops"[\s\S]*?<\/li>\s*(?=<\/ul>)/, '');
  assert.ok(!stripped.includes('id="card-armyops"'));
  const doc = makeDocument(stripped);
  const data = dataset();
  await ctx.createHub(doc, fakeFetch((lesson) => response(data[lesson])), makeWindow('#module-2')).init();
  assert.ok(doc.getElementById('exam-grid-module-2').children.some((li) => li.id === 'card-armyops'), 'built inside its module grid');
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
  for (const tag of ['<header', '<main id="main"', 'aria-labelledby="modules-heading"', 'aria-labelledby="exams-heading-module-2"', 'aria-labelledby="exams-heading-module-3"', 'aria-labelledby="history-heading"']) assert.ok(html.includes(tag), tag);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /role="group" aria-label="Filter history by mode"/);
  assert.match(html, /<p class="eyebrow">Philippine Army · Mastery Quizzes<\/p>/);
  assert.match(html, /<h1>Choose your module, then your exam<\/h1>/);
  assert.match(html, /<h2 id="modules-heading" tabindex="-1">.*Choose your module<\/h2>/);
  for (const id of ['module-2', 'module-3']) {
    assert.match(html, new RegExp(`<a class="module-card" id="pick-${id}" href="#${id}" aria-labelledby="pick-title-${id}" aria-describedby="[^"]*overview-${id}"`), `module card ${id}`);
    assert.match(html, new RegExp(`<h2 id="exams-heading-${id}" tabindex="-1">.*Choose your exam`), `step 2 heading ${id}`);
    assert.match(html, new RegExp(`<a class="change-module" id="change-${id}" href="#choose-module">Change module</a>`));
  }
  assert.match(html, /<span class="tag module-note" id="pick-note-module-3">More lessons coming<\/span>/);
  assert.match(html, /<p id="route-announcer" class="sr-only" role="status" aria-live="polite"><\/p>/);
  assert.match(html, /:focus-visible \{ outline: 3px solid var\(--color-focus\)/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /@media print/);
  assert.match(html, /<div class="hero-art" aria-hidden="true">/);
  assert.match(html, /Class score history summary/);
});

test('topographic contours: decorative, fixed, sliced, quiet, in the margins only, themed by CSS variables, hidden in print', () => {
  const layer = html.match(/<div class="topo" aria-hidden="true">\s*<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g class="contours"[^>]*>([\s\S]*?)<\/g><\/svg>\s*<\/div>/);
  assert.ok(layer, 'inline contour layer');
  const paths = layer[1].match(/<path\b/g) || [];
  assert.ok(paths.length >= 10, 'contour paths inlined');
  assert.ok(/<path\b[^>]*class="major"/.test(layer[1]), 'index contours present');
  assert.ok(!/<(script|a|foreignObject|image|use)\b|\son\w+=/i.test(layer[1]), 'only plain paths in the fragment');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.topo \{[^}]*position: fixed;[^}]*pointer-events: none;/);
  for (const name of ['--topo-minor-opacity', '--topo-major-opacity']) {
    const value = Number(css.match(new RegExp(`${name}: ([0-9.]+);`))?.[1]);
    assert.ok(value > 0 && value <= 0.2, `${name} is quiet (${value})`);
  }
  assert.match(css, /\.topo \{[^}]*mask-image: linear-gradient\(90deg/, 'masked to the margins');
  assert.match(css, /stroke: var\(--topo-line\); stroke-opacity: var\(--topo-minor-opacity\)/);
  assert.match(css, /path\.major \{ stroke: var\(--topo-line-major\); stroke-opacity: var\(--topo-major-opacity\)/);
  assert.match(css, /@media print \{[\s\S]*\.topo[^{]*\{ display: none !important; \}/);
  assert.match(css, /\.hero, main \{ position: relative; z-index: 1; \}/);
  // Cards and tables keep solid surfaces over the map.
  for (const sel of ['.exam-card {', '.module-card {', '.history-card {']) assert.match(css.slice(css.indexOf(sel)), /^[^}]*background: var\(--color-surface\)/, sel);
});

test('Bandwidth Brothers banner sits above the hero with srcset, dimensions, priority and alt text', () => {
  const m = html.match(/<div class="banner">\s*<picture>([\s\S]*?)<\/picture>\s*<\/div>/);
  assert.ok(m, 'banner picture markup');
  assert.ok(html.indexOf('<div class="banner">') < html.indexOf('<header'), 'banner precedes the hero');
  assert.match(m[1], /<source media="\(max-width: 800px\)" srcset="assets\/banner-800\.jpg 1x, assets\/banner-1600\.jpg 2x">/);
  const img = m[1].match(/<img\b[^>]*>/)[0];
  assert.match(img, /\bsrcset="assets\/banner-1600\.jpg 1x"/);
  assert.match(img, /\bwidth="1600"/); assert.match(img, /\bheight="900"/);
  assert.match(img, /\bfetchpriority="high"/);
  assert.match(img, /\balt="Bandwidth Brothers banner"/);
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.banner img \{[^}]*height: auto;[^}]*aspect-ratio: 1127 \/ 291; object-fit: cover; object-position: 50% 62%; max-height: none;/, 'the approved banner frame preserves the title and soldiers on desktop and phones');
});

test('Class photo is a lazy, captioned figure with exact caption and alt text', () => {
  const m = html.match(/<figure class="class-photo">([\s\S]*?)<\/figure>/);
  assert.ok(m, 'class photo figure');
  const img = m[1].match(/<img\b[^>]*>/)[0];
  assert.match(img, /\bsrcset="assets\/class-photo-800\.jpg 800w, assets\/class-photo-1600\.jpg 1600w"/);
  assert.match(img, /\bwidth="1600"/); assert.match(img, /\bheight="1200"/);
  assert.match(img, /\bloading="lazy"/); assert.match(img, /\bdecoding="async"/);
  assert.match(img, /\balt="SOAC 52 - 2026 class group photo"/);
  assert.equal(m[1].match(/<figcaption>([\s\S]*?)<\/figcaption>/)[1], 'SOAC 52 - 2026');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.class-photo \{[^}]*max-width: var\(--page-max\);/);
});

test('Photo srcsets reference the four asset files, and they exist on disk', () => {
  const found = new Set([...html.matchAll(/\b(?:src|srcset)="([^"]*)"/g)].flatMap(x => x[1].split(',').map(p => p.trim().split(/\s+/)[0])).filter(p => /\.jpg$/.test(p)));
  assert.deepEqual([...found].sort(), ['assets/banner-1600.jpg', 'assets/banner-800.jpg', 'assets/class-photo-1600.jpg', 'assets/class-photo-800.jpg']);
  for (const f of found) assert.ok(existsSync(join(root, f)), f + ' must exist');
});

test('Banner and photo are hidden in print', () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /@media print \{[\s\S]*\.banner, \.class-photo[^{]*\{ display: none !important; \}/);
});

test('no hash: only the module chooser, with per-module overviews from all six lessons', async () => {
  const { doc, f } = await renderHub(dataset(), null, '');
  assert.deepEqual(lessonsOf(f.calls).sort(), Object.keys(EXPECTED).sort());
  assert.equal(doc.getElementById('module-2').hidden, true);
  assert.equal(doc.getElementById('module-3').hidden, true);
  assert.equal(doc.getElementById('history-section').hidden, true);
  assert.equal(doc.getElementById('pick-module-2').getAttribute('aria-current'), 'false');
  assert.equal(doc.getElementById('pick-module-3').getAttribute('aria-current'), 'false');
  assert.equal(rowsOf(doc, 'summary-body').length, 0);
  // isr 2 + armor 1 + armyops 0 + combined 12; Field Artillery is not available yet.
  assert.equal(doc.getElementById('overview-module-2').textContent, '15 class attempts · some exams not available yet');
  assert.equal(doc.getElementById('overview-module-3').textContent, 'Class history: Not available yet');
  assert.match(doc.getElementById('overview-module-3').className, /stat-error/);
  assert.equal(doc.activeElement, null, 'focus is not moved on load');
});

test('hash on load selects the module: its panel, aria-current, scoped tables, no focus steal', async () => {
  const data = { ...dataset(), signal: { ok: true, rows: [row({ name: 'Lim', mode: 'medium', percent: 84, score: 21, finishedAt: iso(2026, 10, 1, 9, 0) })] }, signaljoint: { ok: true, rows: [] } };
  const { doc } = await renderHub(data, null, '#module-3');
  assert.equal(doc.getElementById('module-3').hidden, false);
  assert.equal(doc.getElementById('module-2').hidden, true);
  assert.equal(doc.getElementById('history-section').hidden, false);
  assert.equal(doc.getElementById('pick-module-3').getAttribute('aria-current'), 'true');
  assert.equal(doc.getElementById('pick-module-2').getAttribute('aria-current'), 'false');
  assert.equal(doc.getElementById('history-module-label').textContent, ' · Module 3');
  assert.deepEqual(rowsOf(doc, 'summary-body').map((tr) => tr.children[0].textContent), ['Signal Support in Combined Arms Operations', 'Signal Support in Joint Operations']);
  assert.deepEqual(rowsOf(doc, 'recent-body').map(cellTexts), [['Lim', 'Signal Support in Combined Arms Operations', 'Medium', '21 / 25', '84%', 'Proficient', '2026-10-01 09:00']]);
  assert.equal(doc.getElementById('overview-module-3').textContent, '1 class attempt');
  assert.match(doc.getElementById('history-status').className, /status-ready/);
  assert.equal(doc.activeElement, null);
  assert.equal(doc.getElementById('route-announcer').textContent, '');
});

test('choosing a module by click: hash, focus to the exam heading, announcement; Change module returns', async () => {
  const { doc, win } = await renderHub(dataset(), null, '');
  const ev = doc.getElementById('pick-module-2').click();
  assert.equal(ev.defaultPrevented, true);
  assert.equal(win.location.hash, '#module-2');
  assert.deepEqual(win.pushes, ['/quiz-hub/#module-2'], 'one history entry, shareable URL');
  assert.equal(doc.getElementById('module-2').hidden, false);
  assert.equal(doc.getElementById('module-3').hidden, true);
  assert.equal(doc.getElementById('pick-module-2').getAttribute('aria-current'), 'true');
  assert.equal(doc.activeElement, doc.getElementById('exams-heading-module-2'));
  assert.equal(doc.getElementById('route-announcer').textContent, 'Module 2 selected. Choose your exam: 5 exams available.');
  assert.equal(rowsOf(doc, 'summary-body').length, 5);
  win.dispatch('hashchange'); // the browser's own event for the same hash is a no-op
  assert.equal(doc.activeElement, doc.getElementById('exams-heading-module-2'));

  const back = doc.getElementById('change-module-2').click();
  assert.equal(back.defaultPrevented, true);
  assert.deepEqual(win.pushes, ['/quiz-hub/#module-2', '/quiz-hub/'], 'hash removed without a reload');
  assert.equal(win.location.hash, '');
  assert.equal(doc.getElementById('module-2').hidden, true);
  assert.equal(doc.getElementById('history-section').hidden, true);
  assert.equal(doc.getElementById('pick-module-2').getAttribute('aria-current'), 'false');
  assert.equal(doc.activeElement, doc.getElementById('modules-heading'));
  assert.equal(doc.getElementById('route-announcer').textContent, 'Choose your module.');

  doc.getElementById('pick-module-3').click();
  assert.equal(doc.activeElement, doc.getElementById('exams-heading-module-3'));
  assert.equal(doc.getElementById('route-announcer').textContent, 'Module 3 selected. Choose your exam: 2 exams available.');
  // Ctrl/Cmd-click keeps the browser default (open in a new tab).
  const mod = doc.getElementById('pick-module-2').click({ ctrlKey: true });
  assert.equal(mod.defaultPrevented, false);
  assert.equal(win.location.hash, '#module-3');
});

test('back/forward (hashchange/popstate) and unknown hashes', async () => {
  const { doc, win } = await renderHub(dataset(), null, '#module-2');
  win.navigate('#module-3');
  assert.equal(doc.getElementById('module-3').hidden, false);
  assert.equal(doc.getElementById('module-2').hidden, true);
  assert.equal(doc.activeElement, doc.getElementById('exams-heading-module-3'));
  win.navigate('');
  assert.equal(doc.getElementById('module-3').hidden, true);
  assert.equal(doc.getElementById('history-section').hidden, true);
  assert.equal(doc.activeElement, doc.getElementById('modules-heading'));
  win.navigate('#module-2');
  assert.equal(doc.getElementById('module-2').hidden, false);
  win.navigate('#module-99');
  assert.equal(doc.getElementById('module-2').hidden, true, 'unknown hash shows the chooser');
});

test('history is scoped to the selected module: tables, filter and Refresh fetch only its lessons', async () => {
  const data = dataset();
  const { doc, f, win } = await renderHub(data, null, '#module-3');
  assert.equal(f.calls.length, EXAM_COUNT);
  assert.equal(lessonsOf(f.calls)[0], 'signal', 'selected module requested first');
  doc.getElementById('history-refresh').click();
  await tick();
  assert.deepEqual(lessonsOf(f.calls.slice(EXAM_COUNT)), MODULE_3, 'Refresh on Module 3 fetches only its lessons');
  assert.deepEqual(rowsOf(doc, 'summary-body').map((tr) => cellTexts(tr).slice(0, 2)), [['Signal Support in Combined Arms Operations', 'Not available yet'], ['Signal Support in Joint Operations', 'Not available yet']]);
  assert.equal(rowsOf(doc, 'recent-body').length, 0);
  // Switching modules reuses the cached lessons, then Refresh fetches just Module 2's five.
  win.navigate('#module-2');
  await tick();
  assert.equal(f.calls.length, EXAM_COUNT + MODULE_3.length, 'no refetch on switch');
  assert.equal(rowsOf(doc, 'summary-body').length, 5);
  assert.ok(rowsOf(doc, 'recent-body').every((tr) => tr.children[1].textContent !== 'Signal Support in Combined Arms Operations'));
  doc.getElementById('history-refresh').click();
  await tick();
  assert.deepEqual(lessonsOf(f.calls.slice(EXAM_COUNT + MODULE_3.length)).sort(), [...MODULE_2].sort());
  doc.getElementById('filter-hard').click();
  assert.ok(rowsOf(doc, 'recent-body').map(cellTexts).every((r) => r[2] === 'Hard'));
});

test('"unknown lesson" for a whole module shows Not available yet, never a page error', async () => {
  const { doc } = await renderHub(dataset(), null, '#module-3');
  const status = doc.getElementById('history-status');
  assert.match(status.className, /status-partial/);
  assert.equal(status.textContent, 'Class history is not available yet for Module 3.');
  assert.match(doc.getElementById('stats-signal').textContent, /Not available yet/);
  assert.equal(doc.getElementById('recent-empty').hidden, false);
  assert.equal(doc.getElementById('history-refresh').disabled, false);
  // Module 2 is unaffected by Module 3's missing lesson.
  assert.match(doc.getElementById('overview-module-2').textContent, /^15 class attempts/);
  // A request that throws inside the overview does not break the page either.
  const f = fakeFetch(async (lesson) => { if (lesson === 'signal') throw new TypeError('offline'); return response(dataset()[lesson]); });
  const r = await renderHub(dataset(), f, '');
  assert.equal(r.doc.getElementById('overview-module-3').textContent, 'Class history: Not available yet');
});

test('footer and header link discreetly to the class page and the instructor view; an empty endpoint never fetches', async () => {
  assert.match(html, /<a class="hero-link" id="class-link" href="class\/">Our class: Bandwidth Brothers<\/a>/);
    assert.match(html, /<p class="hero-nav"><a class="hero-link" id="schedule-link" href="schedule\/\?v=day-picker-2">This week's schedule<\/a>/, 'the header links to this week\'s schedule first');
  const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/);
  assert.ok(footer, 'a footer follows the class photo');
  assert.ok(html.indexOf('<figure class="class-photo">') < html.indexOf('<footer class="site-footer">'), 'the footer links sit right below the class photo');
  assert.match(footer[1], /<a class="footer-link footer-class" id="class-photo-link" href="class\/">Meet the class: Bandwidth Brothers/);
  assert.match(footer[1], /<a class="footer-link" id="instructor-link" href="instructor\/">Instructor view<\/a>/);
  assert.match(html, /@media print \{[\s\S]*\.site-footer \{ display: none !important; \}|\.site-footer[^{]*\{ display: none !important; \}/);
  const ctxOff = vm.createContext({ console, setTimeout, clearTimeout, Promise, AbortController, Date, Math, JSON, encodeURIComponent, decodeURIComponent });
  vm.runInContext(script.replace(/var HISTORY_ENDPOINT = '[^']*';/, "var HISTORY_ENDPOINT = '';"), ctxOff);
  const result = await ctxOff.fetchLesson(() => { throw new Error('fetch must not be called'); }, 'isr');
  assert.deepEqual([result.ok, result.unavailable], [false, true]);
});

for (const t of tests) await runTest(`[hub] ${t.name}`, t.fn);
}
