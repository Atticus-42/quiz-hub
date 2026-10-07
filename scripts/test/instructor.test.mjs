// The instructor's question analysis page (instructor/index.html) and the class page (class/index.html).
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, MODES, CLASS_FORBIDDEN, loadClass } from '../build.mjs';
import { test, plain, findAll, isShown, hasClass, parseHtml, appScripts, runPage, withEndpoint, fakeFetch, TEST_ENDPOINT, loadCodeGs, withoutFontPreloads } from './harness.mjs';

export async function instructorSuite({ lessons }) {
  const T = (name, run) => test(`[instructor] ${name}`, run);
  const builtHtml = readFileSync(join(ROOT, 'instructor', 'index.html'), 'utf8');
  const configured = withEndpoint(builtHtml, TEST_ENDPOINT);
  const armor = lessons.find(lesson => lesson.key === 'armor');
  const id = (lesson, mode, question) => `${lesson.key}:${mode}:${question.qid}`;

  function load(body, { html = configured, fail = false, status = 200 } = {}) {
    const fetch = fakeFetch(() => { if (fail) throw new Error('offline'); return { status, body }; });
    const page = runPage(html, { fetch });
    const api = page.window.__instructor;
    assert.ok(api, 'the page exposes globalThis.__instructor');
    return { ...page, api, fetch, byId: name => page.document.getElementById(name) };
  }
  const itemsBody = rows => ({ ok: true, kind: 'items', version: 7, rows });
  const rowsOf = page => page.byId('items-body').children;

  await T('Figure PFT 1 on the class page: files exist, srcset 800w/1600w, lazy 16:9, alt and caption', () => {
    const classHtml = readFileSync(join(ROOT, 'class', 'index.html'), 'utf8');
    const fig = classHtml.match(/<figure class="pft-figure"[^>]*>([\s\S]*?)<\/figure>/);
    assert.ok(fig, 'PFT figure present');
    const img = fig[1].match(/<img[^>]*>/)[0];
    for (const f of ['pft-1-800.jpg', 'pft-1-1600.jpg']) assert.ok(existsSync(join(ROOT, 'assets', f)), `${f} exists`);
    assert.ok(!existsSync(join(ROOT, 'assets', 'pft-1-2000.jpg')), 'no 2000 variant');
    assert.match(img, /srcset="\.\.\/assets\/pft-1-800\.jpg(\?v=\d+)? 800w, \.\.\/assets\/pft-1-1600\.jpg(\?v=\d+)? 1600w"/);
    assert.match(img, /sizes="100vw"/); assert.match(img, /width="1600"/); assert.match(img, /height="900"/);
    assert.match(img, /loading="lazy"/); assert.match(img, /decoding="async"/);
    assert.match(img, /alt="Bandwidth Brothers, SOAC 52 - 2026, in PT uniform at the Signal School emblem"/);
    assert.match(fig[1], /<figcaption>FIGURE PFT 1 /);
    assert.ok(classHtml.indexOf('id="roster-table"') < classHtml.indexOf('class="pft-figure"'), 'after the roster');
  });

  await T('loads ?action=items&lesson=all from the endpoint only (GET, no cookies) and shows every bank question with its counts', async () => {
    const a = armor.banks.easy;
    const page = load(itemsBody([
      { qid: id(armor, 'easy', a[0]), lesson: 'armor', mode: 'easy', asked: 10, missed: 7 },
      { qid: id(armor, 'easy', a[1]), lesson: 'armor', mode: 'easy', asked: 4, missed: 3 },
      { qid: id(armor, 'easy', a[2]), lesson: 'armor', mode: 'easy', asked: 9, missed: 1 },
      { qid: 'armor:easy:armor-e-99', lesson: 'armor', mode: 'easy', asked: 2, missed: 2 },
    ]));
    await page.api.whenSettled();
    assert.equal(page.fetch.calls.length, 1);
    assert.equal(page.fetch.calls[0].url, `${TEST_ENDPOINT}?action=items&lesson=all`);
    assert.equal(page.fetch.calls[0].method, 'GET');
    assert.equal(page.fetch.calls[0].init.credentials, 'omit');
    const state = page.api.getState();
    assert.equal(state.status, 'ready');
    assert.equal(state.module, 'module-2');
    const module2 = lessons.filter(lesson => lesson.module === 'module-2' && !lesson.pool);
    const expected = module2.reduce((sum, lesson) => sum + MODES.reduce((s, mode) => s + lesson.banks[mode].length, 0), 0) + 1;
    assert.equal(rowsOf(page).length, expected, 'every Module 2 bank question plus the one no longer in a bank');
    const first = rowsOf(page).find(row => row.children[3].textContent === '10');
    assert.equal(rowsOf(page)[0].children[5].textContent, '100%', 'sorted by miss rate, highest first');
    assert.match(first.children[0].textContent, new RegExp(a[0].prompt.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.deepEqual(first.children.slice(1).map(cell => cell.textContent), ['Armor Operations · Easy', a[0].category, '10', '7', '70%', 'Review this question'], 'flagged at >= 60% with >= 5 asks');
    const second = rowsOf(page).find(row => row.children[0].textContent.includes('no longer in the bank'));
    assert.ok(second, 'a counted question missing from the banks is listed by its id');
    const lowAsks = rowsOf(page).find(row => row.children[3].textContent === '4');
    assert.equal(lowAsks.children[5].textContent, '75%');
    assert.equal(lowAsks.children[6].textContent, '—', 'fewer than 5 asks are never flagged');
    assert.match(page.byId('status').textContent, /flagged for review/);
    const most = findAll(page.byId('most-missed'), node => node.localName === 'li');
    assert.equal(most.length, 4);
    assert.match(most[0].textContent, /missed 7 of 10 \(70%\)/);
    assert.ok(isShown(page.byId('items-card')) && isShown(page.byId('most-missed-card')));
  });

  await T('questions are truncated with a full, expandable view of the prompt, options and correct answer', async () => {
    const q = armor.banks.hard.find(item => item.prompt.length > 120) ?? armor.banks.hard[0];
    const page = load(itemsBody([{ qid: id(armor, 'hard', q), asked: 6, missed: 1 }]));
    await page.api.whenSettled();
    page.api.setLesson('armor');
    page.api.setMode('hard');
    const row = rowsOf(page).find(item => item.children[0].textContent.includes(q.prompt));
    const details = findAll(row, node => node.localName === 'details')[0];
    const summary = findAll(details, node => node.localName === 'summary')[0].textContent;
    assert.ok(summary.length <= 110 && (q.prompt.length <= 110 || summary.endsWith('…')), summary);
    const options = findAll(details, node => node.localName === 'li').map(node => node.textContent);
    assert.equal(options.length, 4);
    assert.equal(options[q.answer], `${'ABCD'[q.answer]}. ${q.options[q.answer]} (correct answer)`);
    assert.equal(rowsOf(page).length, armor.banks.hard.length, 'filtered to Armor Hard');
  });

  await T('module, lesson and mode chips filter; column headings sort both ways with aria-sort', async () => {
    const page = load(itemsBody([]));
    await page.api.whenSettled();
    const total = lesson => MODES.reduce((sum, mode) => sum + lesson.banks[mode].length, 0);
    page.byId('module-module-3').click();
    const signal = lessons.find(lesson => lesson.key === 'signal');
    assert.equal(rowsOf(page).length, lessons.filter(lesson => lesson.module === 'module-3' && !lesson.pool).reduce((s, l) => s + total(l), 0));
    assert.equal(page.byId('module-module-3').getAttribute('aria-pressed'), 'true');
    page.byId('lesson-signal').click();
    page.byId('mode-medium').click();
    assert.equal(rowsOf(page).length, signal.banks.medium.length);
    assert.equal(page.byId('mode-medium').getAttribute('aria-pressed'), 'true');
    page.byId('sort-question').click();
    assert.equal(page.byId('sort-question').parentNode.getAttribute('aria-sort'), 'ascending');
    const prompts = rowsOf(page).map(row => findAll(row, node => node.localName === 'p' && hasClass(node, 'question-full'))[0].textContent.toLowerCase());
    assert.deepEqual(prompts, [...prompts].sort());
    page.byId('sort-question').click();
    assert.equal(page.byId('sort-question').parentNode.getAttribute('aria-sort'), 'descending');
    assert.equal(page.byId('sort-rate').parentNode.getAttribute('aria-sort'), 'none');
    assert.equal(page.api.setModule('module-9'), false);
    assert.equal(page.api.setLesson('isr'), false, 'a lesson of another module is refused');
    assert.match(page.byId('pool-note').textContent, /Module 3 Exam attempts count towards each question’s own lesson and difficulty/);
    page.byId('module-module-2').click();
    assert.match(page.byId('pool-note').textContent, /Combined Exam attempts count towards each question’s own lesson and difficulty/);
  });

  await T('remote data is untrusted: bad qids and counts are dropped, missed never exceeds asked, hostile text stays text', () => {
    const { api } = load(itemsBody([]));
    assert.equal(api.cleanItemRow({ qid: '<img src=x onerror=alert(1)>', asked: 1, missed: 0 }), null);
    assert.equal(api.cleanItemRow({ qid: 'armor:easy:armor-e-01', asked: -1, missed: 0 }), null);
    assert.equal(api.cleanItemRow({ qid: 'armor:easy:armor-e-01', asked: 1.5, missed: 0 }), null);
    assert.deepEqual(plain(api.cleanItemRow({ qid: 'armor:easy:armor-e-01', asked: '3', missed: 9 })), { qid: 'armor:easy:armor-e-01', lesson: 'armor', mode: 'easy', asked: 3, missed: 3 });
    assert.equal(api.parseItemsResponse(null).status, 'error');
    assert.equal(api.parseItemsResponse({ ok: true, kind: 'items', rows: 'x' }).status, 'error');
    assert.equal(plain(api.parseItemsResponse(itemsBody([{ qid: 'x' }, { qid: 'isr:hard:isr-h-02', asked: 2, missed: 1 }]))).rows.length, 1);
    const code = appScripts(parseHtml(builtHtml)).map(script => script.textContent).join('\n');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|localStorage|sessionStorage|document\.cookie/);
    assert.equal(code.match(/\bfetch\w*\(/g)?.length, 1, 'one network call site');
  });

  await T('before the script is redeployed (v6 answers) or without an endpoint the page says "not available yet", never breaks', async () => {
    const v6History = load({ ok: true, rows: [{ name: 'Cruz', mode: 'easy', score: 20, total: 25 }] });
    await v6History.api.whenSettled();
    assert.equal(v6History.api.getState().status, 'unavailable');
    assert.match(v6History.byId('status').textContent, /not available yet.*version 7/);
    assert.equal(isShown(v6History.byId('items-card')), false);
    const v6Unknown = load({ ok: false, error: 'unknown lesson' });
    await v6Unknown.api.whenSettled();
    assert.equal(v6Unknown.api.getState().status, 'unavailable');
    const offline = load(null, { fail: true });
    await offline.api.whenSettled();
    assert.equal(offline.api.getState().status, 'error');
    assert.match(offline.byId('status').textContent, /Could not load/);
    const http = load({}, { status: 500 });
    await http.api.whenSettled();
    assert.equal(http.api.getState().status, 'error');
    const none = load(itemsBody([]), { html: withEndpoint(builtHtml, '') });
    await none.api.whenSettled();
    assert.equal(none.fetch.calls.length, 0, 'no request without an endpoint');
    assert.equal(none.api.getState().status, 'not-configured');
    assert.equal(none.byId('refresh').disabled, true);
  });

  await T('round trip with apps-script/Code.gs: counts recorded by POSTs are what the page shows', async () => {
    const gs = loadCodeGs(readFileSync(join(ROOT, 'apps-script', 'Code.gs'), 'utf8'));
    const bank = armor.banks.medium;
    for (let round = 0; round < 5; round++) {
      const asked = bank.map(question => id(armor, 'medium', question));
      const missed = asked.slice(0, 3 + (round % 2));
      assert.deepEqual(gs.post({ lesson: 'armor', name: 'Cadet One', mode: 'medium', score: asked.length - missed.length, total: asked.length, band: 'Proficient', asked, missed }), { ok: true });
    }
    const fetch = fakeFetch(call => ({ body: gs.get(Object.fromEntries(new URL(call.url).searchParams)) }));
    const page = runPage(configured, { fetch });
    await page.window.__instructor.whenSettled();
    page.window.__instructor.setLesson('armor');
    page.window.__instructor.setMode('medium');
    const rows = page.document.getElementById('items-body').children;
    assert.equal(rows[0].children[3].textContent, '5');
    assert.equal(rows[0].children[4].textContent, '5');
    assert.equal(rows[0].children[6].textContent, 'Review this question');
    assert.equal(rows.filter(row => row.children[6].textContent === 'Review this question').length, 3);
  });

  await T('the page links back to the hub, uses only the endpoint, is not indexed, and embeds every lesson question once', () => {
    assert.match(builtHtml, /<meta name="robots" content="noindex">/);
    assert.deepEqual([...withoutFontPreloads(builtHtml).matchAll(/\bhref="([^"]*)"/g)].map(m => m[1]), ['../']);
    const urls = [...builtHtml.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0]);
    assert.ok(urls.every(url => url.startsWith('https://script.google.com/')), urls.join(' '));
    const data = JSON.parse(builtHtml.match(/<script type="application\/json" id="item-data">([\s\S]*?)<\/script>/)[1]);
    const count = lessons.filter(lesson => !lesson.pool).reduce((sum, lesson) => sum + MODES.reduce((s, mode) => s + lesson.banks[mode].length, 0), 0);
    assert.equal(Object.keys(data.questions).length, count);
    assert.ok(Object.keys(data.questions).every(key => /^[a-z][a-z0-9]{1,23}:(easy|medium|hard):[a-z][a-z0-9]{1,23}-[emh]-[0-9]{2,4}$/.test(key)));
  });
}

export async function classSuite() {
  const T = (name, run) => test(`[class] ${name}`, run);
  const html = readFileSync(join(ROOT, 'class', 'index.html'), 'utf8');
  const data = loadClass();

  await T('data integrity: 26 members numbered 1-26, every organization member is on the roster, positions unique, only the approved fields', () => {
    assert.equal(data.roster.length, 26);
    assert.deepEqual(data.roster.map(member => member.nr), Array.from({ length: 26 }, (_, index) => index + 1));
    for (const member of data.roster) assert.deepEqual(Object.keys(member).sort(), ['commission', 'name', 'nr', 'rank']);
    for (const entry of data.organization) {
      assert.deepEqual(Object.keys(entry).sort(), ['member', 'position']);
      assert.ok(data.roster.some(member => member.nr === entry.member), `${entry.position}: member ${entry.member} is on the roster`);
    }
    assert.equal(new Set(data.organization.map(entry => entry.position)).size, data.organization.length);
    assert.equal(data.organization[0].position, 'Class Leader');
    assert.match(data.organization[1].position, /Ex-O/);
    assert.equal(data.name, 'Bandwidth Brothers');
    assert.equal(data.class, 'SOAC 52 - 2026');
  });

  await T('data integrity: the training directorate lists the 7 roles in order, each member with a public-safe profile, no private data', () => {
    const dir = data.directorate;
    assert.deepEqual(Object.keys(dir).sort(), ['caption', 'roles', 'title']);
    assert.equal(dir.caption, "Signal School, ITG, ETC, PA · Camp O'Donnell, Capas, Tarlac · 3rd Training Period CY 2026");
    assert.equal(dir.title, 'Signal Officer Advance Course CL 52-26 — Training Directorate');
    assert.deepEqual(dir.roles.map(entry => entry.role), ['Class Adviser', 'Course/Program Director', 'Course NCO', 'Asst Course NCO', 'Module NCO', 'Program NCO', 'Psychomotor NCO']);
    assert.deepEqual(dir.roles.map(entry => entry.members.length), [1, 1, 1, 1, 2, 2, 2]);
    assert.equal(new Set(dir.roles.map(entry => entry.role)).size, dir.roles.length);
    for (const entry of dir.roles) {
      assert.deepEqual(Object.keys(entry).sort(), ['members', 'role']);
      for (const member of entry.members) {
        assert.deepEqual(Object.keys(member).sort(), ['civilian', 'duties', 'name', 'office', 'rank', 'schooling']);
        assert.ok(member.office === null || (typeof member.office === 'string' && member.office.trim() !== ''));
        for (const key of ['duties', 'schooling', 'civilian']) assert.ok(Array.isArray(member[key]) && member[key].every(item => typeof item === 'string' && item.trim() !== ''), `${member.name} ${key}`);
        assert.match(member.rank, /^(MAJ|CPT|TSg|SSg|Sgt|Cpl|PFC)$/);
        assert.ok(member.name.trim().length > 3);
      }
    }
    assert.deepEqual(dir.roles[0].members.map(m => `${m.rank} ${m.name}`), ['MAJ Fritz F. Perez']);
    assert.deepEqual(dir.roles[1].members.map(m => `${m.rank} ${m.name}`), ['CPT Kevyn A. Tejada']);
    const members = dir.roles.flatMap(entry => entry.members);
    assert.equal(members.length, 10);
    assert.ok(members.every(m => m.duties.length || m.name === 'Jerica M. Putian'));
    assert.deepEqual(members.filter(m => !m.office && !m.duties.length && !m.schooling.length && !m.civilian.length).map(m => m.name), ['Jerica M. Putian']);
    assert.ok(members.some(m => m.name === 'Arnel A. Callo Jr.' && m.rank === 'Sgt'), 'corrected name');
    assert.doesNotMatch(JSON.stringify(dir), /Amel/);
    for (const word of ['Burauen', 'Llnera', 'Binondo', 'Cabanatuan', 'Tuguegarao', 'Fairview', 'Dipaculao']) assert.doesNotMatch(JSON.stringify(dir), new RegExp(word, 'i'), word);
    const text = JSON.stringify(dir);
    assert.doesNotMatch(text, /\d{6}/, 'no serial numbers');
    assert.doesNotMatch(text, /\bO-/, 'no O- serials');
    assert.doesNotMatch(text, /\(SC\)/, 'no branch/serial suffixes');
    assert.doesNotMatch(JSON.stringify(dir.roles.map(entry => [entry.role, entry.members.map(m => [m.rank, m.name])])), /@|\+63|\d/, 'no contact details or digits in roles, ranks and names');
    assert.doesNotMatch(text, /@|\+63/, 'no contact details');
  });

  await T('data integrity: the school leadership lists the command group and the departments, rank + name + position only', () => {
    const lead = data.leadership;
    assert.deepEqual(Object.keys(lead).sort(), ['caption', 'command', 'departments', 'title']);
    assert.equal(lead.title, 'Signal School leadership');
    assert.equal(lead.caption, "Signal School, ITG, ETC, PA · Camp O'Donnell, Capas, Tarlac");
    const line = entry => [entry.position, entry.rank, entry.name].join(' | ');
    assert.deepEqual(lead.command.map(line), [
      'Commandant | COL | Percival R. Alcanar (GSC)',
      'Assistant Commandant | MAJ | Jun D. Pandi',
      'Sergeant Major | MSg | Renato I. Paduit Jr.',
      'First Sergeant | TSg | Onofre M. Diculin Jr.',
    ]);
    assert.deepEqual(lead.departments.map(line), [
      'Head, Academic Department and Chief, Advance Branch | CPT | Kevyn A. Tejada',
      'Chief, Non-Academic Branch | MAJ | Artemio B. Fulgosino Jr.',
      'Chief, Admin Branch | MAJ | Fritz F. Perez',
      'Branch Chief, Operations Branch | MAJ | Joseph A. Galapia',
      'Branch Chief, Basic Branch | 1LT | Michael Edward G. Viray',
      'Chief, Log Section | MAJ | Ar-Jay S. Salan',
    ]);
    for (const entry of [...lead.command, ...lead.departments]) assert.deepEqual(Object.keys(entry).sort(), ['name', 'position', 'rank']);
    const text = JSON.stringify(lead);
    assert.doesNotMatch(text, /\bO-/, 'no O- serials');
    assert.doesNotMatch(text, /\d{6}/, 'no serial numbers');
    assert.doesNotMatch(text, /\(SC\)/, 'no branch/serial suffixes');
    assert.doesNotMatch(text, /@|\+63/, 'no contact details');
    for (const word of ['Camarines', 'Pangasinan', 'Taguig', 'Isabela', 'Cabagan', 'Previous']) assert.doesNotMatch(text, new RegExp(word, 'i'), word);
  });

  await T('the school leadership renders first (section 01) and the later sections are renumbered', () => {
    const doc = runPage(html).document;
    assert.match(html, /<span class="sect-num" aria-hidden="true">01<\/span><h2 id="lead-heading">School leadership<\/h2>/);
    assert.match(html, /aria-hidden="true">02<\/span><h2 id="dir-heading">Training directorate<\/h2>/);
    assert.match(html, /aria-hidden="true">03<\/span><h2 id="org-heading">/);
    assert.match(html, /aria-hidden="true">04<\/span><h2 id="roster-heading">/);
    assert.ok(html.indexOf('id="lead-heading"') < html.indexOf('id="dir-heading"'));
    assert.equal(doc.getElementById('lead-caption').textContent, data.leadership.caption);
    for (const [id, list] of [['lead-command', data.leadership.command], ['lead-depts', data.leadership.departments]]) {
      const cards = doc.getElementById(id).children;
      assert.deepEqual(cards.map(card => [card.children[0].textContent, card.children[1].textContent]), list.map(entry => [entry.position, `${entry.rank} ${entry.name}`]));
    }
    assert.ok(hasClass(doc.getElementById('lead-command').children[0], 'is-lead'));
    assert.doesNotMatch(doc.body.textContent, /\d{6}|\bO-\d|\(SC\)/);
  });

  await T('the build rejects a malformed leadership', () => {
    const dir = mkdtempSync(join(tmpdir(), 'class-'));
    mkdirSync(join(dir, 'data'));
    const write = leadership => writeFileSync(join(dir, 'data', 'class.json'), JSON.stringify({ ...data, leadership }));
    write(data.leadership);
    assert.doesNotThrow(() => loadClass(dir));
    const one = { position: 'P', rank: 'MAJ', name: 'X Y' };
    const bad = [
      undefined,
      { ...data.leadership, extra: 1 },
      { ...data.leadership, title: '' },
      { ...data.leadership, caption: '' },
      { ...data.leadership, command: [] },
      { ...data.leadership, departments: 'x' },
      { ...data.leadership, command: [{ ...one, serial: 'x' }] },
      { ...data.leadership, command: [{ position: 'P', rank: 'MAJ' }] },
      { ...data.leadership, command: [one, one] },
      { ...data.leadership, command: [{ ...one, name: 'X Y O-13527' }] },
      { ...data.leadership, command: [{ ...one, name: 'X Y 850075' }] },
      { ...data.leadership, command: [{ ...one, name: 'X Y (SC)' }] },
    ];
    for (const leadership of bad) { write(leadership); assert.throws(() => loadClass(dir), /class\.json/); }
    rmSync(dir, { recursive: true, force: true });
  });

  await T('the training directorate renders (section 02, before the organization), with the adviser and director emphasised', () => {
    const doc = runPage(html).document;
    assert.match(html, /<span class="sect-num" aria-hidden="true">02<\/span><h2 id="dir-heading">Training directorate<\/h2>/);
    assert.ok(html.indexOf('id="dir-heading"') < html.indexOf('id="org-heading"'));
    assert.equal(doc.getElementById('dir-title').textContent, data.directorate.title);
    const rows = doc.getElementById('dir-list').children;
    assert.equal(rows.length, 7);
    rows.forEach((row, index) => {
      const entry = data.directorate.roles[index];
      assert.equal(row.children[0].textContent, entry.role);
      assert.deepEqual(row.children[1].children.map(item => findAll(item, node => hasClass(node, 'dir-who'))[0].textContent), entry.members.map(member => `${member.rank} ${member.name}`));
      row.children[1].children.forEach((item, at) => {
        const member = entry.members[at];
        const details = findAll(item, node => node.localName === 'details');
        const count = member.schooling.length + member.civilian.length;
        assert.equal(details.length, count ? 1 : 0, `${member.name} details`);
        if (count) {
          assert.equal(details[0].getAttribute('open'), null, 'collapsed by default');
          assert.equal(findAll(details[0], node => node.localName === 'summary')[0].textContent, `Schooling & training (${count})`);
        } else assert.equal(findAll(item, node => node.localName === 'p').length, 0, 'name only');
      });
      assert.equal(hasClass(row, 'is-lead'), index < 2, `${entry.role} emphasis`);
    });
    assert.equal(doc.getElementById('dir-caption').textContent, data.directorate.caption);
    assert.ok(html.includes("make('details', 'dir-quals')"));
    assert.ok(html.includes('beforeprint'));
    const pageText = doc.body.textContent;
    assert.doesNotMatch(pageText, /\d{6}|\bO-\d|\(SC\)/);
  });

  await T('the build rejects a malformed directorate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'class-'));
    mkdirSync(join(dir, 'data'));
    const write = directorate => writeFileSync(join(dir, 'data', 'class.json'), JSON.stringify({ ...data, directorate }));
    write(data.directorate);
    assert.doesNotThrow(() => loadClass(dir));
    const bad = [
      undefined,
      { ...data.directorate, extra: 1 },
      { title: '', roles: data.directorate.roles },
      { title: 't', roles: [] },
      { title: 't', roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y', serial: 'O-123456' }] }] },
      { title: 't', roles: [{ role: 'A', members: [] }] },
      { title: 't', roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y' }] }, { role: 'A', members: [{ rank: 'CPT', name: 'Z W' }] }] },
      { title: 't', roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y (SC)' }] }] },
      { title: 't', roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X 850075' }] }] },
      { ...data.directorate, caption: '' },
      { ...data.directorate, roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y', office: 'O', duties: [''], schooling: [], civilian: [] }] }] },
      { ...data.directorate, roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y', office: 'O', duties: ['d'], schooling: 'x', civilian: [] }] }] },
      { ...data.directorate, roles: [{ role: 'A', members: [{ rank: 'MAJ', name: 'X Y', office: 'O', duties: ['d'], schooling: [], civilian: [], serial: 'x' }] }] },
    ];
    for (const directorate of bad) { write(directorate); assert.throws(() => loadClass(dir), /class\.json/); }
    rmSync(dir, { recursive: true, force: true });
  });

  await T('the built page never contains an e-mail sign, +63 phone prefix, O-<digits> serial number or long digit run', () => {
    // Stylesheets legitimately hold @media and @font-face rules; everything else (text, data, markup) never has an @.
    assert.doesNotMatch(html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ''), /@/);
    assert.doesNotMatch(html, /\+63/);
    assert.doesNotMatch(html, /\bO-\d/);
    for (const pattern of CLASS_FORBIDDEN) assert.doesNotMatch(JSON.stringify(data), pattern);
    assert.doesNotMatch(html, /\(SC\)/);
  });

  await T('renders the organization (Class Leader and Ex-O first and emphasised), the roster table and the captioned photo with textContent', () => {
    const page = runPage(html);
    const doc = page.document;
    assert.equal(doc.getElementById('class-title').textContent, 'Bandwidth Brothers');
    assert.equal(doc.getElementById('class-subtitle').textContent, 'SOAC 52 - 2026');
    assert.match(html, /<title>Bandwidth Brothers · SOAC 52 - 2026<\/title>/);
    const leads = doc.getElementById('org-leads').children;
    assert.deepEqual(leads.map(card => card.children[0].textContent), ['Class Leader', 'Executive Officer (Ex-O)']);
    assert.ok(leads.every(card => hasClass(card, 'is-lead')));
    const byNr = Object.fromEntries(data.roster.map(member => [member.nr, member]));
    assert.equal(leads[0].children[1].textContent, `${byNr[6].rank} ${byNr[6].name}`);
    const others = doc.getElementById('org-grid').children;
    assert.equal(others.length, data.organization.length - 2);
    assert.ok(others.every(card => !hasClass(card, 'is-lead')));
    others.forEach((card, index) => {
      const entry = data.organization[index + 2];
      assert.deepEqual(card.children.map(node => node.textContent), [entry.position, `${byNr[entry.member].rank} ${byNr[entry.member].name}`]);
    });
    const headers = findAll(doc.getElementById('roster-table'), node => node.localName === 'th' && node.parentNode.parentNode.localName === 'thead').map(node => node.textContent);
    assert.deepEqual(headers, ['Nr', 'Rank', 'Name', 'Commissioning source']);
    const rows = doc.getElementById('roster-body').children;
    assert.equal(rows.length, 26);
    assert.deepEqual(rows[16].children.map(cell => cell.textContent), ['17', '1LT', 'Eric Jan B. Intoy', 'PMA CL 22']);
    assert.equal(doc.getElementById('roster-caption').textContent, 'All 26 members of Bandwidth Brothers, SOAC 52 - 2026, in roster order.');
    const figure = html.match(/<figure class="class-photo">([\s\S]*?)<\/figure>/);
    assert.equal(figure[1].match(/<figcaption>([^<]*)<\/figcaption>/)[1], 'SOAC 52 - 2026');
    assert.match(figure[1], /srcset="\.\.\/assets\/class-photo-800\.jpg 800w, \.\.\/assets\/class-photo-1600\.jpg 1600w"/);
    assert.deepEqual(page.consoleErrors, []);
    const code = appScripts(parseHtml(html)).map(script => script.textContent).join('\n');
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|fetch\(|localStorage/);
  });

  await T('looks like the hub (banner, contour map, figure), is printable and fluid down to 375px without sideways scrolling', () => {
    assert.match(html, /<div class="topo" aria-hidden="true">\s*<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"/);
    assert.match(html, /<div class="banner">/);
    assert.match(html, /<style media="print">[\s\S]*\.topo, \.banner, \.hub-link \{ display: none !important; \}/);
    assert.match(html, /grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 14rem\), 1fr\)\)/, 'cards reflow to one column on phones');
    assert.match(html, /\.table-wrap \{ max-width: 100%; overflow-x: auto; \}/);
    assert.match(html, /body \{[^}]*overflow-wrap: anywhere;/);
      assert.deepEqual([...withoutFontPreloads(html).matchAll(/\bhref="([^"]*)"/g)].map(m => m[1]), ['../', '../schedule/?v=day-picker-2']);
      assert.match(html, /<a class="hub-link" id="schedule-link" href="\.\.\/schedule\/\?v=day-picker-2">This week's schedule /);
    assert.doesNotMatch(html, /https?:\/\//);
  });
}
