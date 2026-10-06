// apps-script/Code.gs (version 7) in a sandbox: fake SpreadsheetApp, LockService and ContentService.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../build.mjs';
import { test, plain, loadCodeGs, FakeSheet } from './harness.mjs';

const OLD_HEADERS = ['Received', 'Name', 'Mode', 'Score', 'Total', 'Percent', 'Band', 'Finished'];
const TABS = { isr: 'History', armor: 'Armor History', fieldartillery: 'Field Artillery History', armyops: 'Army Operations History', signal: 'Signal Support History', signaljoint: 'Signal Joint Operations History', coalition: 'Signal Coalition Operations History', combined: 'Combined Exam History' };

export async function codeGsSuite() {
  const source = readFileSync(join(ROOT, 'apps-script', 'Code.gs'), 'utf8');
  const T = (name, run) => test(`[Code.gs] ${name}`, run);
  const ids = (lesson, mode, letter, from, n) => Array.from({ length: n }, (_, i) => `${lesson}:${mode}:${lesson}-${letter}-${String(from + i).padStart(2, '0')}`);
  const attempt = over => ({ lesson: 'armor', name: 'Maria Santos', mode: 'easy', score: 20, total: 25, percent: 80, band: 'Proficient', finishedAt: '2026-10-01T08:00:00.000Z', ...over });

  await T('declares version 7 and keeps every lesson key and tab name', () => {
    const gs = loadCodeGs(source);
    assert.equal(gs.context.VERSION, 7);
    assert.deepEqual(plain(gs.context.LESSONS), TABS);
    for (const [key, tab] of Object.entries(TABS)) assert.equal(gs.context.tabFor(key), tab);
    assert.equal(gs.context.tabFor(undefined), 'History', 'a request without a lesson is the first quiz');
    assert.equal(gs.context.tabFor('gunnery'), null);
  });

  await T('old payloads (no asked/missed; fixed totals 25 and 30, or no total at all) are stored exactly as before', () => {
    const gs = loadCodeGs(source);
    for (const lesson of Object.keys(TABS)) {
      const total = lesson === 'combined' ? 30 : 25;
      assert.deepEqual(gs.post(attempt({ lesson, total, score: total - 5 })), { ok: true }, lesson);
    }
    assert.deepEqual(gs.post({ name: 'No Lesson', mode: 'hard', score: 25, band: 'Mastery' }), { ok: true }, 'the oldest pages sent no lesson and no total');
    assert.deepEqual(gs.post({ lesson: 'combined', name: 'Sgt. Reyes', mode: 'hard', score: 30, band: 'Mastery' }), { ok: true }, 'a missing combined total means 30');
    assert.deepEqual(gs.post({ lesson: 'combined', name: 'Sgt. Reyes', mode: 'hard', score: 31, band: 'Mastery' }), { ok: false, error: 'invalid score' });
    assert.deepEqual(gs.post({ lesson: 'armor', name: 'Sgt. Reyes', mode: 'hard', score: 26 }), { ok: false, error: 'invalid score' }, 'a missing lesson total means 25');
    const history = gs.sheets.get('History');
    assert.deepEqual(history.rows[0], [...OLD_HEADERS, 'Missed']);
    assert.equal(history.rows.length, 3);
    assert.deepEqual(history.rows[2].slice(1, 7), ['No Lesson', 'hard', 25, 25, 100, 'Mastery']);
    assert.equal(history.rows[2][8], '', 'no Missed ids without a list');
    assert.equal(gs.sheets.has('Item Analysis'), false, 'old payloads touch no item counters');
    const rows = gs.get({ lesson: 'combined', mode: 'all' }).rows;
    assert.deepEqual(rows.map(row => [row.score, row.total, row.percent]), [[30, 30, 100], [25, 30, 83]]);
    assert.equal(gs.lock.waits, gs.lock.releases, 'the lock is always released');
  });

  await T('totals come from the client: any integer 1-500, score <= total; everything else is rejected', () => {
    const gs = loadCodeGs(source);
    for (const total of [1, 7, 40, 100, 500]) assert.deepEqual(gs.post(attempt({ total, score: total })), { ok: true }, `total ${total}`);
    for (const total of [0, -1, 501, 2.5, 'x', {}, [1, 2]]) assert.deepEqual(gs.post(attempt({ total })), { ok: false, error: 'invalid total' }, `total ${JSON.stringify(total)}`);
    assert.deepEqual(gs.post(attempt({ total: 7, score: 8 })), { ok: false, error: 'invalid score' });
    assert.deepEqual(gs.post(attempt({ score: -1 })), { ok: false, error: 'invalid score' });
    assert.deepEqual(gs.post(attempt({ score: 1.5 })), { ok: false, error: 'invalid score' });
    assert.deepEqual(gs.post(attempt({ lesson: 'gunnery' })), { ok: false, error: 'unknown lesson' });
    assert.deepEqual(gs.post(attempt({ mode: 'expert' })), { ok: false, error: 'invalid mode' });
    assert.deepEqual(gs.post(attempt({ name: 'J' })), { ok: false, error: 'name must be 2-40 characters' });
    assert.deepEqual(gs.post('{not json'), { ok: false, error: 'could not save' });
    const rows = gs.sheets.get('Armor History').rows;
    assert.deepEqual(rows.slice(1).map(row => [row[3], row[4], row[5]]), [[1, 1, 100], [7, 7, 100], [40, 40, 100], [100, 100, 100], [500, 500, 100]]);
    gs.post(attempt({ name: '=HYPERLINK("x")' }));
    assert.equal(gs.sheets.get('Armor History').rows.at(-1)[1], 'HYPERLINK("x")', 'formula triggers are stripped');
  });

  await T('a new payload stores the Missed ids on the attempt row and counts every asked and missed question in Item Analysis', () => {
    const gs = loadCodeGs(source);
    const asked = ids('armor', 'easy', 'e', 1, 25);
    const missed = [asked[3], asked[10], asked[11], asked[20], asked[24]];
    assert.deepEqual(gs.post(attempt({ asked, missed })), { ok: true });
    const row = gs.sheets.get('Armor History').rows[1];
    assert.equal(row[8], missed.join(','));
    const items = gs.sheets.get('Item Analysis');
    assert.deepEqual(items.rows[0], ['QID', 'Lesson', 'Mode', 'Asked', 'Missed', 'Miss rate', 'Last updated']);
    assert.equal(items.frozen, 1);
    assert.equal(items.rows.length, 26);
    const find = qid => items.rows.find(item => item[0] === qid);
    assert.deepEqual(find(asked[3]).slice(0, 6), [asked[3], 'armor', 'easy', 1, 1, 1]);
    assert.deepEqual(find(asked[0]).slice(0, 6), [asked[0], 'armor', 'easy', 1, 0, 0]);
    assert.ok(find(asked[0])[6] instanceof Date || typeof find(asked[0])[6] === 'object', 'last updated is a date');
    // A second attempt on the same questions increments in place; new questions are appended.
    const second = [...asked.slice(0, 24), 'armor:easy:armor-e-26'];
    assert.deepEqual(gs.post(attempt({ asked: second, missed: [asked[3], 'armor:easy:armor-e-26'], score: 23 })), { ok: true });
    assert.equal(items.rows.length, 27);
    assert.deepEqual(find(asked[3]).slice(3, 6), [2, 2, 1]);
    assert.deepEqual(find(asked[10]).slice(3, 6), [2, 1, 0.5]);
    assert.deepEqual(find(asked[24]).slice(3, 6), [1, 1, 1], 'not asked again: unchanged');
    assert.deepEqual(find('armor:easy:armor-e-26').slice(0, 6), ['armor:easy:armor-e-26', 'armor', 'easy', 1, 1, 1]);
    // A pool exam reports the source lessons' ids.
    const pool = [...ids('isr', 'hard', 'h', 1, 2), ...ids('armyops', 'hard', 'h', 5, 1)];
    assert.deepEqual(gs.post(attempt({ lesson: 'combined', mode: 'hard', total: 3, score: 2, asked: pool, missed: [pool[2]] })), { ok: true });
    assert.deepEqual(find(pool[2]).slice(0, 5), [pool[2], 'armyops', 'hard', 1, 1]);
    assert.equal(gs.sheets.get('Combined Exam History').rows[1][8], pool[2]);
    assert.equal(gs.lock.waits, 3);
    assert.equal(gs.lock.releases, 3);
  });

  await T('inconsistent or malformed id lists are ignored (the attempt is still stored, no counter moves)', () => {
    const asked = ids('signal', 'medium', 'm', 1, 5);
    const bad = [
      { asked, missed: [asked[0], asked[1]], score: 4 },                    // missed count != total - score
      { asked: asked.slice(0, 4), missed: [asked[0]], score: 4 },           // asked count != total
      { asked: [...asked.slice(0, 4), asked[0]], missed: [asked[0]], score: 4 }, // duplicate
      { asked: [...asked.slice(0, 4), 'signal:medium:signal-e-01'], missed: [asked[0]], score: 4 }, // qid letter does not match the mode
      { asked: [...asked.slice(0, 4), 'signal:easy:signal-e-01'], missed: [asked[0]], score: 4 }, // other mode
      { asked: [...asked.slice(0, 4), 'gunnery:medium:gunnery-m-01'], missed: [asked[0]], score: 4 }, // unknown lesson
      { asked: [...asked.slice(0, 4), '=cmd()'], missed: [asked[0]], score: 4 },
      { asked: [...asked.slice(0, 4), 'signal:medium:armor-m-01'], missed: [asked[0]], score: 4 }, // qid of another lesson
      { asked, missed: ['signal:medium:signal-m-99'], score: 4 },           // missed but not asked
      { asked, missed: 'signal:medium:signal-m-01', score: 4 },
      { asked: 'x', missed: [], score: 5 },
      { asked: [...asked.slice(0, 4), `signal:medium:signal-m-${'1'.repeat(70)}`], missed: [asked[0]], score: 4 },
    ];
    for (const extra of bad) {
      const gs = loadCodeGs(source);
      assert.deepEqual(gs.post(attempt({ lesson: 'signal', mode: 'medium', total: 5, ...extra })), { ok: true }, JSON.stringify(extra).slice(0, 90));
      const rows = gs.sheets.get('Signal Support History').rows;
      assert.equal(rows.length, 2, 'the attempt is stored');
      const itemRows = gs.sheets.get('Item Analysis')?.rows ?? [];
      assert.equal(itemRows.length, 0, `no item counters for ${JSON.stringify(extra).slice(0, 60)}`);
      assert.equal(rows[1][8], '');
    }
  });

  await T('a tab created before version 7 gets the Missed header added once; existing rows are untouched', () => {
    const old = new FakeSheet('Armor History', [OLD_HEADERS, [new Date('2026-09-01'), 'Old Timer', 'easy', 10, 25, 40, 'Needs review', new Date('2026-09-01')]]);
    const gs = loadCodeGs(source, { sheets: new Map([['Armor History', old]]) });
    assert.deepEqual(gs.get({ lesson: 'armor' }).rows.map(row => row.name), ['Old Timer'], 'reading an old tab works');
    assert.deepEqual(old.rows[0], [...OLD_HEADERS, 'Missed'], 'the header is upgraded');
    assert.deepEqual(old.rows[1].slice(0, 8).map(String), [new Date('2026-09-01'), 'Old Timer', 'easy', 10, 25, 40, 'Needs review', new Date('2026-09-01')].map(String));
    gs.post(attempt({ asked: ids('armor', 'easy', 'e', 1, 25), missed: ids('armor', 'easy', 'e', 1, 5) }));
    gs.post(attempt());
    assert.deepEqual(old.rows[0], [...OLD_HEADERS, 'Missed'], 'added only once');
    assert.equal(old.rows.length, 4);
    assert.equal(old.rows[2][8], ids('armor', 'easy', 'e', 1, 5).join(','));
    assert.deepEqual(gs.get({ lesson: 'armor', mode: 'all' }).rows.map(row => row.name), ['Maria Santos', 'Maria Santos', 'Old Timer'], 'history reads are unchanged by the new column');
    const custom = new FakeSheet('History', [['Date', 'Who', 'Mode', 'Score', 'Total', 'Percent', 'Band', 'Finished']]);
    const other = loadCodeGs(source, { sheets: new Map([['History', custom]]) });
    other.post(attempt({ lesson: 'isr' }));
    assert.equal(custom.rows[0].length, 8, 'a tab with different headers is never relabelled');
  });

  await T('GET ?action=items returns validated counters for one lesson or all; unknown actions and lessons are refused', () => {
    const gs = loadCodeGs(source);
    assert.deepEqual(gs.get({ action: 'items', lesson: 'all' }), { ok: true, kind: 'items', version: 7, rows: [] }, 'no tab yet: no rows');
    gs.post(attempt({ asked: ids('armor', 'easy', 'e', 1, 25), missed: ids('armor', 'easy', 'e', 1, 5) }));
    gs.post(attempt({ lesson: 'isr', mode: 'hard', total: 2, score: 1, asked: ids('isr', 'hard', 'h', 1, 2), missed: ids('isr', 'hard', 'h', 2, 1) }));
    gs.sheets.get('Item Analysis').appendRow(['=junk()', 'isr', 'hard', 3, 3, 1, new Date()]);
    const all = gs.get({ action: 'items', lesson: 'all' });
    assert.equal(all.rows.length, 27, 'malformed rows in the sheet are skipped');
    const isr = gs.get({ action: 'items', lesson: 'isr' });
    assert.deepEqual(isr.rows, [{ qid: 'isr:hard:isr-h-01', lesson: 'isr', mode: 'hard', asked: 1, missed: 0 }, { qid: 'isr:hard:isr-h-02', lesson: 'isr', mode: 'hard', asked: 1, missed: 1 }]);
    assert.deepEqual(gs.get({ action: 'items', lesson: 'ARMOR' }).rows.length, 25);
    assert.deepEqual(gs.get({ action: 'items', lesson: 'gunnery' }), { ok: false, error: 'unknown lesson' });
    assert.deepEqual(gs.get({ action: 'delete' }), { ok: false, error: 'unknown action' });
    assert.equal(gs.get({ action: 'history', lesson: 'armor' }).rows.length, 1, 'action=history is the default GET');
    assert.deepEqual(gs.get({}).rows.map(row => row.mode), ['hard'], 'no lesson: the first quiz tab (ISR)');
  });

  await T('a lock timeout saves nothing and reports "could not save"; the lock is never left held', () => {
    const gs = loadCodeGs(source, { lockFails: true });
    assert.deepEqual(gs.post(attempt({ asked: ids('armor', 'easy', 'e', 1, 25), missed: ids('armor', 'easy', 'e', 1, 5) })), { ok: false, error: 'could not save' });
    assert.equal(gs.sheets.size, 0);
  });
}
