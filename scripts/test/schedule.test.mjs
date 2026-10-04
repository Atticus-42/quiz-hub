// The weekly training schedule (schedule/index.html from data/schedule.json): data integrity and privacy, the
// strict validation in the build, rendering, today / Now / Next with an injected clock, and the quiz links.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, SCHEDULE_FORBIDDEN, loadSchedule, parseScheduleTime, scheduleQuiz, scheduleRange, ordinal } from '../build.mjs';
import { test, runPage, findAll, hasClass, appScripts, parseHtml, withoutFontPreloads } from './harness.mjs';

const RANKS = ['COL', 'LTC', 'MAJ', 'CPT', '1LT', '2LT', 'MSg', 'TSg', 'SSg', 'Sgt', 'Cpl', 'PFC', 'Pvt'];
const DUTY_TITLES = ['NAB Personnel', 'FSgt', 'Duty Tac NCO', 'Organic Pers & Students', 'Guest Instructor PS', 'Module NCO', 'Training Directorate',
  'Detailed Inspector', 'Class Adviser', 'Syndicate Leader', 'Operations Officer'];

export async function scheduleSuite({ lessons }) {
  const T = (name, run) => test(`[schedule] ${name}`, run);
  const html = readFileSync(join(ROOT, 'schedule', 'index.html'), 'utf8');
  const data = loadSchedule();
  const blocks = data.days.flatMap(day => day.blocks.map(block => ({ ...block, date: day.date })));
  const load = (now, extra = {}) => runPage(html, { globals: { __SCHEDULE_NOW: now, ...extra } });
  const byClass = (root, name) => findAll(root, node => hasClass(node, name));
  const dayBlocks = (doc, date) => findAll(doc.getElementById(`day-${date}`), node => node.localName === 'li');
  const titleOf = node => byClass(node, 'blk-title')[0].textContent;

  await T('data integrity: week 3 of 12, Monday 05 to Sunday 11 Oct 2026, every block transcribed from the PDF', () => {
    assert.equal(data.course, 'SOAC CL 52-26');
    assert.deepEqual(data.week, { number: 3, of: 12, start: '2026-10-05', end: '2026-10-11' });
    assert.equal(data.students, 26);
    assert.equal(data.prepared, '2026-09-30');
    assert.equal(scheduleRange(data.week), '05–11 Oct 2026');
    assert.deepEqual(data.days.map(day => `${day.day} ${day.date}`), ['Monday 2026-10-05', 'Tuesday 2026-10-06', 'Wednesday 2026-10-07', 'Thursday 2026-10-08', 'Friday 2026-10-09', 'Saturday 2026-10-10', 'Sunday 2026-10-11']);
    assert.deepEqual(data.days.map(day => day.blocks.length), [16, 16, 17, 16, 14, 13, 12]);
    assert.equal(blocks.filter(block => block.kind === 'lecture').length, 10, 'the green (academic) rows');
    assert.equal(blocks.filter(block => block.kind === 'exam').length, 5, 'the yellow (exam) rows');
    assert.deepEqual(blocks.filter(block => block.kind === 'exam').map(block => block.activity), [
      'Topic exam on Signal Support in Joint Operations', 'Topic exam on Signal Support in Coalition Operations', 'MODULE ASSESSMENT 4',
      'Topic exam on C4ISTAR Sensors Integration', 'Topic exam on C4ISTAR Weapon System Integration',
    ]);
    assert.deepEqual(data.days[0].blocks[7], { time: '1300-1500', activity: 'Lecture on Signal Support in Coalition Operations', kind: 'lecture', class: 'SOAC CL 52-26', instructor: 'MAJ PANDI/MAJ GALAPIA', uniform: 'SGOU', venue: 'RM 307, Mabini Hall' });
    assert.deepEqual(data.days[2].blocks[5], { time: '0900-1100', activity: 'C2 Applications (PA BMS/ATAK)', kind: 'lecture', periods: 3, class: 'SOAC CL 52-26', instructor: '1LT VIRAY/MAJ FULGOSINO', uniform: 'PHILARPAT', venue: 'RM 307, Mabini Hall' });
    assert.deepEqual(data.days[6].blocks[2], { time: '0700-1100', activity: 'Sunday Religious Services', kind: 'routine', instructor: 'Duty Tac NCO', uniform: 'PHILARPAT/ Civ Attire', venue: 'ETC Chapel/ Respective Chapel' });
    assert.ok(data.days.every(day => day.blocks.at(-1).activity === 'TAPS' && day.blocks.at(-1).time === '2200'), 'every day ends with TAPS at 2200');
    for (const block of blocks.filter(item => item.kind === 'lecture' && item.class === 'SOAC CL 52-26' && item.date !== '2026-10-05')) assert.ok([2, 3].includes(block.periods), `${block.date} ${block.time} periods`);
  });

  await T('this week is archived in data/schedules/ under its dates, identical to data/schedule.json', () => {
    const name = `${data.week.start}_${data.week.end}.json`;
    assert.ok(readdirSync(join(ROOT, 'data', 'schedules')).includes(name), name);
    assert.deepEqual(JSON.parse(readFileSync(join(ROOT, 'data', 'schedules', name), 'utf8')), data);
    for (const file of readdirSync(join(ROOT, 'data', 'schedules'))) {
      assert.match(file, /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/, `${file} is named by its dates`);
      const archived = loadSchedule(ROOT, join(ROOT, 'data', 'schedules', file));
      assert.equal(file, `${archived.week.start}_${archived.week.end}.json`, `${file} matches its own week`);
    }
  });

  await T('privacy: instructors are rank + name or a duty title only; no serials, service numbers, phones or e-mail in the data', () => {
    for (const block of blocks) {
      for (const part of block.instructor.split('/').map(item => item.trim())) {
        const person = new RegExp(`^(?:${RANKS.join('|')}) [A-Za-z][A-Za-z.' -]*$`).test(part);
        assert.ok(person || DUTY_TITLES.includes(part), `${block.date} ${block.time}: "${part}" is a rank + name or a duty title`);
      }
    }
    const text = JSON.stringify(data);
    for (const pattern of SCHEDULE_FORBIDDEN) assert.doesNotMatch(text, pattern);
    assert.doesNotMatch(text, /\bO-\d/, 'no O-<digits> serial numbers');
    assert.doesNotMatch(text, /\d{6}/, 'no 6-digit service numbers');
    assert.doesNotMatch(text, /\+63|\b09\d{9}\b|\b09\d{2}[ -]\d{3}[ -]\d{4}\b/, 'no phone numbers');
    assert.doesNotMatch(text, /@/, 'no e-mail');
    // The signature block (names, branch designations) is not published.
    for (const word of ['KEVYN', 'PERCIVAL', 'ARTEMIO', 'TEJADA', 'ALCANAR', 'Commandant', 'PREPARED BY', 'APPROVED']) assert.doesNotMatch(text, new RegExp(word, 'i'), word);
  });

  await T('privacy: the built page has no @ outside <style>, no +63, no O-<digits> serial, no 6-digit number, no (SC)', () => {
    assert.doesNotMatch(html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ''), /@/);
    assert.doesNotMatch(html, /\+63/);
    assert.doesNotMatch(html, /\bO-\d/);
    assert.doesNotMatch(html, /\d{6}/);
    assert.doesNotMatch(html, /\(SC\)/);
    assert.doesNotMatch(load('2026-10-05T09:00').document.body.textContent, /\d{6}|\bO-\d|\+63|@/);
  });

  await T('the build rejects a malformed schedule or one with private data, with a clear schedule.json message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schedule-'));
    mkdirSync(join(dir, 'data'));
    const write = value => writeFileSync(join(dir, 'data', 'schedule.json'), JSON.stringify(value));
    const clone = () => JSON.parse(JSON.stringify(data));
    const withBlock = change => { const copy = clone(); Object.assign(copy.days[1].blocks[5], change); return copy; };
    write(data);
    assert.doesNotThrow(() => loadSchedule(dir));
    const bad = [
      { ...clone(), extra: 1 },
      { ...clone(), course: '' },
      { ...clone(), week: { ...data.week, number: 13 } },
      { ...clone(), week: { ...data.week, start: '2026-10-06' } },
      { ...clone(), week: { ...data.week, end: '2026-10-31' } },
      { ...clone(), days: clone().days.slice(0, 6) },
      (() => { const copy = clone(); copy.days[0].day = 'Tuesday'; return copy; })(),
      (() => { const copy = clone(); copy.days[0].blocks = []; return copy; })(),
      withBlock({ time: '0830-0800' }),
      withBlock({ time: '2460' }),
      withBlock({ time: '8:30-11:00' }),
      withBlock({ kind: 'party' }),
      withBlock({ activity: ' ' }),
      withBlock({ periods: 0 }),
      withBlock({ venue: '' }),
      withBlock({ serial: 'x' }),
      withBlock({ instructor: 'MAJ PEREZ O-12345' }),
      withBlock({ instructor: 'MAJ PEREZ 850075' }),
      withBlock({ instructor: 'MAJ PEREZ (SC) PA' }),
      withBlock({ remarks: 'Call +63 917 000 0000' }),
      withBlock({ remarks: 'perez' + String.fromCharCode(64) + 'example.com' }),
    ];
    for (const value of bad) { write(value); assert.throws(() => loadSchedule(dir), /schedule\.json/); }
    rmSync(dir, { recursive: true, force: true });
    assert.deepEqual(parseScheduleTime('0830-1100'), { start: 510, end: 660 });
    assert.deepEqual(parseScheduleTime('2200'), { start: 1320, end: null });
    assert.equal(parseScheduleTime(''), null);
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });

  await T('renders the week header, seven day sections in order and every block (time, activity, instructor, venue, uniform)', () => {
    assert.match(html, /<title>Weekly training schedule · SOAC 52 - 2026 · Bandwidth Brothers<\/title>/);
    const doc = load('2026-10-01T08:00').document;
    assert.equal(doc.getElementById('schedule-title').textContent, 'Weekly training schedule');
    assert.equal(doc.getElementById('schedule-subtitle').textContent, 'SOAC 52 - 2026 · Bandwidth Brothers');
    assert.equal(doc.getElementById('schedule-week').textContent.split('.')[0], '3rd week of 12, 05–11 Oct 2026');
    assert.match(html, /<dt>Week<\/dt><dd>3 of 12<\/dd>/);
    assert.match(html, /<dt>Academic blocks<\/dt><dd>15<\/dd>/);
    const sections = findAll(doc.getElementById('week'), node => node.localName === 'section');
    assert.deepEqual(sections.map(node => node.getAttribute('data-date')), data.days.map(day => day.date));
    assert.deepEqual(sections.map(node => byClass(node, 'day-name')[0].textContent), data.days.map(day => day.day));
    assert.equal(byClass(sections[0], 'day-date')[0].textContent, '05 Oct');
    data.days.forEach(day => {
      const items = dayBlocks(doc, day.date);
      assert.equal(items.length, day.blocks.length, day.date);
      items.forEach((item, index) => {
        const block = day.blocks[index];
        assert.equal(titleOf(item), block.activity);
        assert.ok(hasClass(item, `is-${block.kind}`), `${day.date} ${block.time} kind`);
        assert.equal(byClass(item, 'mono')[0].textContent, block.time ? block.time.replace('-', '–') : '—');
        assert.equal(byClass(item, 'blk-who')[0].textContent, `Instructor: ${block.instructor}`);
        const where = byClass(item, 'blk-where')[0].textContent;
        if (block.venue) assert.ok(where.includes(block.venue), `${day.date} ${block.time} venue`);
        assert.ok(where.endsWith(`Uniform: ${block.uniform}`), `${day.date} ${block.time} uniform`);
      });
    });
    assert.deepEqual(findAll(doc.getElementById('week'), node => node.localName === 'a' && node.getAttribute('data-date')).length, 0);
    const nav = findAll(doc.root, node => node.localName === 'a' && node.getAttribute('data-date'));
    assert.deepEqual(nav.map(link => link.getAttribute('href')), data.days.map(day => `#day-${day.date}`));
  });

  await T('layout: one selected day on screen, all days in landscape print, no external links', () => {
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.match(css, /\.week \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/, 'one column by default (phones)');
    assert.match(css, /\.day-head \{\s*position: sticky; top: 0;/);
    assert.match(css, /@page \{ size: A4 landscape; margin: 7mm; \}/);
    assert.match(css, /@media print \{[\s\S]*\.week \{ grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
    assert.match(css, /@media print \{[\s\S]*\.day\[hidden\] \{ display: block !important; \}/);
    assert.match(css, /@media print \{[\s\S]*\.now-next, \.week-nav, \.legend, \.blk-quiz/);
    assert.match(css, /\.blk, \.blk\.is-now \{[^}]*break-inside: avoid;/, 'a block never splits across columns or pages');
    const hrefs = [...withoutFontPreloads(html).matchAll(/\bhref="([^"]*)"/g)].map(m => m[1]);
    assert.deepEqual(hrefs.filter(href => !href.startsWith('#')), ['../', '../class/', '../joint-signal/']);
    assert.doesNotMatch(html, /https?:\/\//);
    const code = appScripts(parseHtml(html)).map(script => script.textContent).join('\n');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|fetch\(|XMLHttpRequest|localStorage|sendBeacon/);
  });

  await T('day picker: today or Monday opens alone; clicking another day replaces it; Go to today restores today', () => {
    const page = load('2026-10-07T08:15');
    const doc = page.document;
    const visible = () => data.days.filter(day => !doc.getElementById(`day-${day.date}`).hidden).map(day => day.date);
    const nav = findAll(doc.root, node => node.localName === 'a' && node.getAttribute('data-date'));
    assert.deepEqual(visible(), ['2026-10-07']);
    nav[4].click();
    assert.deepEqual(visible(), ['2026-10-09']);
    assert.equal(nav[4].getAttribute('aria-expanded'), 'true');
    assert.equal(nav[2].getAttribute('aria-expanded'), 'false');
    page.window.__schedule.update(new Date('2026-10-07T09:00'));
    assert.deepEqual(visible(), ['2026-10-09'], 'clock refresh keeps the chosen day');
    doc.getElementById('nn-jump').click();
    assert.deepEqual(visible(), ['2026-10-07']);
    const before = load('2026-10-04T12:00').document;
    assert.deepEqual(data.days.filter(day => !before.getElementById(`day-${day.date}`).hidden).map(day => day.date), ['2026-10-05']);
    const deep = load('2026-10-05T12:00', { location: { hash: '#day-2026-10-10' } }).document;
    assert.deepEqual(data.days.filter(day => !deep.getElementById(`day-${day.date}`).hidden).map(day => day.date), ['2026-10-10']);
  });

  await T('today: Monday 13:10 highlights Monday, marks the two 1300 blocks as Now and Sports Activities as Next', () => {
    const page = load('2026-10-05T13:10:00');
    const doc = page.document;
    const monday = doc.getElementById('day-2026-10-05');
    assert.ok(hasClass(monday, 'is-today'));
    assert.equal(byClass(monday, 'day-today')[0].hidden, false);
    for (const day of data.days.slice(1)) {
      assert.ok(!hasClass(doc.getElementById(`day-${day.date}`), 'is-today'), day.date);
      assert.equal(byClass(doc.getElementById(`day-${day.date}`), 'day-today')[0].hidden, true);
    }
    const nav = findAll(doc.root, node => node.localName === 'a' && node.getAttribute('data-date'));
    assert.deepEqual(nav.map(link => link.getAttribute('aria-current')), ['date', null, null, null, null, null, null]);
    const items = dayBlocks(doc, '2026-10-05');
    assert.deepEqual(items.filter(item => hasClass(item, 'is-now')).map(titleOf), ['Topic exam on Signal Support in Joint Operations', 'Lecture on Signal Support in Coalition Operations']);
    assert.deepEqual(items.filter(item => hasClass(item, 'is-next')).map(titleOf), ['Sports Activities']);
    assert.ok(items.slice(0, 6).every(item => hasClass(item, 'is-past')), 'the morning is past');
    assert.equal(byClass(items[6], 'blk-flag')[0].textContent, 'Now');
    assert.equal(byClass(items[8], 'blk-flag')[0].textContent, 'Next');
    assert.equal(doc.getElementById('now-next').hidden, false);
    assert.equal(doc.getElementById('nn-head').textContent, 'Today · Monday 05 Oct · 1310');
    assert.match(doc.getElementById('nn-now-list').textContent, /^1300–1330 Topic exam on Signal Support in Joint OperationsMabini Hall · SGOU1300–1500 Lecture on Signal Support in Coalition Operations/);
    assert.match(doc.getElementById('nn-next-list').textContent, /^1500–1700 Sports Activities/);
    assert.equal(doc.getElementById('nn-jump').getAttribute('href'), '#day-2026-10-05');
    assert.deepEqual(page.consoleErrors, []);
  });

  await T('today: the injected clock moves the highlight (overlaps, single times, after TAPS, last night, before and after the week)', () => {
    const api = load('2026-10-08T12:00').window.__schedule;
    const titles = list => Array.from(list ?? [], block => block.title);
    let s = api.initial;
    assert.equal(s.today, '2026-10-08');
    assert.deepEqual(titles(s.now), ['Noon Mess']);
    assert.deepEqual(titles(s.next), ['Cont’n lecture on Signal Propagation (Mobile Apps/RF Clouds)']);
    s = api.update(new Date('2026-10-06T21:45'));
    assert.deepEqual(titles(s.now), [], 'a single time (2130) is never Now');
    assert.deepEqual(titles(s.next), ['TAPS']);
    s = api.update(new Date('2026-10-05T21:15'));
    assert.deepEqual(titles(s.now), ['Evening Formation']);
    assert.deepEqual(titles(s.next), ['Singing of Signal Corps Hym', 'TATTOO'], 'both 2130 items are next');
    s = api.update(new Date('2026-10-09T22:30'));
    assert.deepEqual(titles(s.next), []);
    assert.deepEqual(titles(s.tomorrow), ['Reveille & Physical Conditioning']);
    const doc = load('2026-10-09T22:30').document;
    assert.match(doc.getElementById('nn-next-list').textContent, /^Tomorrow 0430–0530 Reveille & Physical Conditioning/);
    assert.equal(doc.getElementById('nn-now-list').textContent, 'Nothing scheduled right now.');
    const sunday = load('2026-10-11T23:00').document;
    assert.equal(sunday.getElementById('nn-next-list').textContent, 'Nothing more this week.');
    const before = load('2026-10-04T18:00').document;
    assert.equal(before.getElementById('nn-head').textContent, 'This week has not started');
    assert.equal(before.getElementById('nn-now').hidden, true);
    assert.match(before.getElementById('nn-next-list').textContent, /^Monday 05 Oct, 0430–0530 Reveille/);
    assert.equal(findAll(before.getElementById('week'), node => hasClass(node, 'is-today') || hasClass(node, 'is-now') || hasClass(node, 'is-next')).length, 0);
    const after = load('2026-10-12T07:00').document;
    assert.equal(after.getElementById('nn-head').textContent, 'This schedule has ended');
    assert.equal(after.getElementById('nn-next-list').textContent, 'It covered 05–11 Oct 2026. The next week’s schedule will replace it here.');
    // A preview link can set the clock too, and the date is the viewer's local date (not UTC).
    const viaQuery = runPage(html, { globals: { location: { search: '?now=2026-10-07T08:15' } } }).window.__schedule.initial;
    assert.equal(viaQuery.today, '2026-10-07');
    assert.deepEqual(titles(viaQuery.now), ['MODULE ASSESSMENT 4']);
    assert.equal(api.localDate(new Date(2026, 9, 5, 0, 5)), '2026-10-05');
    assert.equal(api.localDate(new Date(2026, 9, 11, 23, 59)), '2026-10-11');
    // Without an injected clock the page uses the real date and still renders without errors.
    const live = runPage(html);
    assert.deepEqual(live.consoleErrors, []);
    assert.equal(live.document.getElementById('now-next').hidden, false);
  });

  await T('quiz links: a subject that names a quiz lesson links to that quiz; look-alikes (C4ISTAR, Coalition Operations) do not', () => {
    const doc = load('2026-10-05T08:00').document;
    const links = findAll(doc.getElementById('week'), node => node.localName === 'a');
    assert.deepEqual(links.map(link => [link.getAttribute('href'), link.getAttribute('data-quiz'), titleOf(link.parentNode.parentNode)]), [
      ['../joint-signal/', 'signaljoint', 'Topic exam on Signal Support in Joint Operations'],
    ]);
    assert.equal(links[0].textContent, 'Practice quiz: Signal Support in Joint Operations →');
    for (const link of links) assert.ok(existsSync(join(ROOT, 'schedule', link.getAttribute('href'), 'index.html')), `${link.getAttribute('href')} is a built quiz page`);
    const expected = {
      'Lecture on ISR Operations': 'isr', 'Topic exam on Armor Operations': 'armor', 'Field Artillery Operations (cont’n)': 'fieldartillery',
      'Introduction to Army Operations': 'armyops', 'Signal Support in Combined Arms Operations': 'signal', 'Topic exam on Signal Support in Joint Operations': 'signaljoint',
    };
    for (const [activity, key] of Object.entries(expected)) {
      const quiz = scheduleQuiz(activity, lessons);
      assert.equal(quiz?.key, key, activity);
      assert.equal(quiz.url, `../${lessons.find(lesson => lesson.key === key).slug}/`);
    }
    for (const activity of ['Lecture on C4ISTAR Sensors Integration', 'Lecture on Signal Support in Coalition Operations', 'C2 Applications (PA BMS/ATAK)', 'Lecture on Fundamentals of Protection', 'Rock March']) {
      assert.equal(scheduleQuiz(activity, lessons), null, activity);
    }
  });

  await T('the README explains how to update the weekly schedule', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    assert.match(readme, /^## Updating the weekly schedule$/m);
    const section = readme.split(/^## Updating the weekly schedule$/m)[1].split(/^## /m)[0];
    assert.match(section, /data\/schedule\.json/);
    assert.match(section, /data\/schedules\//);
    assert.match(section, /node scripts\/build\.mjs/);
  });
}
