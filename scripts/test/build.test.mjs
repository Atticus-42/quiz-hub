// The build: template filling, validators, lesson loading, generated pages, and every question bank.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ROOT, MODES, HISTORY_ENDPOINT, build, fillTemplate, scriptJson, escapeHtml, validateQuestion, validateBank, poolQuotas, countLabel, attemptLength, checkLessonConfig, questionTerms,
} from '../build.mjs';
import { test, normalize } from './harness.mjs';

const LETTER = { easy: 'e', medium: 'm', hard: 'h' };

export async function buildSuite({ lessons, modules }) {
  const T = (name, run) => test(`[build] ${name}`, run);
  const rules = { key: 'armor', categoryOrder: ['Fire support', 'Tank Operations'], ref: { label: 'page', min: 13, max: 83, required: true }, pool: null };
  const question = { id: 1, qid: 'armor-e-01', difficulty: 'easy', category: 'Fire support', prompt: 'Which fire support choice fits the situation?', options: ['First', 'Second', 'Third', 'Fourth'], answer: 2, explanation: 'The third choice fits the stated constraints.', tags: ['planning'], sourceSlides: [13] };

  await T('fillTemplate replaces each placeholder exactly once, keeps "$&"-style text literal, and rejects duplicates or leftovers', () => {
    assert.equal(fillTemplate('<a>{{X}}</a><b>{{Y}}</b>', { X: '1', Y: '2' }), '<a>1</a><b>2</b>');
    for (const token of ['$&', '$`', "$'", '$$']) assert.equal(fillTemplate('{{X}}', { X: `Literal ${token} text` }), `Literal ${token} text`);
    assert.throws(() => fillTemplate('{{X}}{{X}}', { X: '1' }), /\{\{X\}\} must occur exactly once/);
    assert.throws(() => fillTemplate('{{X}}', { Y: '1' }), /\{\{Y\}\} must occur exactly once/);
    assert.throws(() => fillTemplate('{{X}}{{Z}}', { X: '1' }), /\{\{Z\}\} was not filled/);
  });

  await T('embedded JSON cannot close its script element, and authored text is HTML-escaped', () => {
    const json = scriptJson([{ ...question, prompt: '</script><script>alert(1)</script>' }]);
    assert.equal(json.includes('</script>'), false);
    assert.match(json, /\\u003c\/script>/);
    assert.equal(JSON.parse(json)[0].prompt, '</script><script>alert(1)</script>');
    assert.equal(escapeHtml('<b a="x">&</b>'), '&lt;b a=&quot;x&quot;&gt;&amp;&lt;/b&gt;');
  });

  await T('validateQuestion accepts a complete question and names every malformed field', () => {
    assert.deepEqual(validateQuestion(question, 'easy', 1, rules), []);
    const errors = validateQuestion({ ...question, id: 1.5, qid: 'isr-e-01', difficulty: 'hard', category: 'Gunnery', options: ['Only one'], answer: 4, sourceSlides: [14, '15'] }, 'easy', 1, rules);
    for (const field of ['id', 'qid', 'difficulty', 'category', 'options', 'answer', 'sourceSlides']) {
      assert.ok(errors.some(error => error.includes(field)), `missing ${field} error: ${errors.join('; ')}`);
    }
    assert.deepEqual(validateQuestion(null, 'easy', 1, rules), ['question must be an object']);
    const optional = { ...rules, ref: { ...rules.ref, required: false } };
    const { sourceSlides, ...noRef } = question;
    assert.deepEqual(validateQuestion(noRef, 'easy', 1, optional), [], 'an optional reference may be absent');
    for (const value of [[], null, 13, '13', [13, '14'], [1.5], [12], [84], [{}]]) {
      const found = validateQuestion({ ...question, sourceSlides: value }, 'easy', 1, optional);
      assert.deepEqual(found, ['sourceSlides, when present, must contain integers from 13 to 83'], JSON.stringify(value));
    }
    assert.deepEqual(validateQuestion({ ...question, qid: 'armor-e-1' }, 'easy', 1, rules), ['qid must be "armor-e-" followed by 2 to 4 digits']);
  });

  await T('validateBank: 1 to 50 questions, sequential ids, unique qids; pool banks need every lesson’s largest share', () => {
    assert.deepEqual(validateBank([question], 'easy', rules), []);
    assert.deepEqual(validateBank([], 'easy', rules), ['bank must contain at least 1 question']);
    assert.deepEqual(validateBank('x', 'easy', rules), ['bank must be an array of questions']);
    assert.deepEqual(validateBank([question, { ...question, id: 2 }], 'easy', rules), ['question 2: qid armor-e-01 is used more than once']);
    assert.deepEqual(validateBank([question, { ...question, id: 3, qid: 'armor-e-02' }], 'easy', rules), ['question 2: id must be integer 2']);
    const many = Array.from({ length: 51 }, (_, index) => ({ ...question, id: index + 1, qid: `armor-e-${String(index + 1).padStart(3, '0')}` }));
    assert.deepEqual(validateBank(many, 'easy', rules), ['bank must contain at most 50 questions (found 51)']);
    assert.deepEqual(validateBank(many.slice(0, 50), 'easy', rules), []);
    assert.deepEqual(poolQuotas(60, 4), [15, 15, 15, 15]);
    assert.deepEqual(poolQuotas(30, 5), [6, 6, 6, 6, 6]);
    assert.deepEqual(poolQuotas(10, 3), [4, 3, 3]);
  });

  await T('a pool exam attempt length must be from 50 to 69 questions', () => {
    const combined = JSON.parse(readFileSync(join(ROOT, 'lessons', 'combined', 'lesson.json'), 'utf8'));
    for (const count of [50, 60, 69]) checkLessonConfig({ ...combined, pool: { ...combined.pool, count } }, 'lessons/combined');
    for (const count of [30, 49, 70, 500]) assert.throws(() => checkLessonConfig({ ...combined, pool: { ...combined.pool, count } }, 'lessons/combined'), /from 50 to 69/);
  });

  await T('every lesson folder loads: unique keys, slugs and qids; modules exist; the combined exam is a pool of the four Module 2 lessons', () => {
    assert.deepEqual(lessons.map(lesson => lesson.key), ['combined', 'isr', 'armor', 'fieldartillery', 'armyops', 'signal', 'signaljoint', 'coalition']);
    assert.deepEqual(lessons.map(lesson => lesson.slug), ['combined', 'isr', 'armor', 'field-artillery', 'army-operations', 'signal-support', 'joint-signal', 'coalition-signal']);
    assert.deepEqual(modules.map(module => module.id), ['module-2', 'module-3']);
    const combined = lessons.find(lesson => lesson.key === 'combined');
    assert.deepEqual(combined.pool, { lessons: ['isr', 'armor', 'fieldartillery', 'armyops'], count: 60 });
    assert.deepEqual(combined.rules.pool.lessons.map(lesson => lesson.name), ['ISR Operations', 'Armor Operations', 'Field Artillery Operations', 'Army Operations']);
    const qids = lessons.filter(lesson => !lesson.pool).flatMap(lesson => MODES.flatMap(mode => lesson.banks[mode].map(item => item.qid)));
    assert.equal(new Set(qids).size, qids.length, 'qids are unique across every lesson');
    for (const lesson of lessons) assert.equal(lesson.historyLesson, lesson.key);
  });

  await T('every committed page is a fresh build (run node scripts/build.mjs), with the real endpoint written once per page', () => {
    const pages = build({ write: false });
    const expectedPages = ['index.html', 'class/index.html', 'schedule/index.html', 'instructor/index.html', ...lessons.map(lesson => `${lesson.slug}/index.html`)];
    assert.deepEqual(Object.keys(pages).sort(), expectedPages.sort());
    for (const slug of ['isr', 'armor', 'field-artillery', 'army-operations', 'signal-support', 'joint-signal', 'coalition-signal', 'combined']) assert.ok(expectedPages.includes(`${slug}/index.html`), slug);
    for (const [path, html] of Object.entries(pages)) {
      assert.equal(readFileSync(join(ROOT, path), 'utf8'), html, `${path} is stale: run node scripts/build.mjs`);
      if (path === 'class/index.html' || path === 'schedule/index.html') assert.ok(!html.includes('HISTORY_ENDPOINT') && !html.includes('script.google.com'), `${path} never contacts the history endpoint`);
      else assert.equal(html.split(`var HISTORY_ENDPOINT = '${HISTORY_ENDPOINT}';`).length - 1, 1, `${path} declares the endpoint once`);
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, `${path} has no unfilled placeholder`);
    }
    const preview = build({ write: false, endpoint: '' });
    for (const [path, html] of Object.entries(preview)) assert.ok(!html.includes('script.google.com'), `${path}: --endpoint "" removes the endpoint`);
  });

  await T('the build CLI fails with a clear message when a bank file is missing or a question is invalid, and writes nothing', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'quiz-build-'));
    try {
      for (const dir of ['scripts', 'src', 'lessons', 'data']) cpSync(join(ROOT, dir), join(fixture, dir), { recursive: true });
      rmSync(join(fixture, 'lessons', 'armor', 'easy.json'));
      let result = spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs')], { encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /armor[\\/]easy\.json: file is missing/);
      cpSync(join(ROOT, 'lessons', 'armor', 'easy.json'), join(fixture, 'lessons', 'armor', 'easy.json'));
      const bank = JSON.parse(readFileSync(join(fixture, 'lessons', 'signal', 'hard.json'), 'utf8'));
      bank[4].answer = 7;
      writeFileSync(join(fixture, 'lessons', 'signal', 'hard.json'), JSON.stringify(bank));
      result = spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs')], { encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /signal[\\/]hard\.json: question 5: answer must be an integer from 0 to 3/);
      assert.throws(() => readFileSync(join(fixture, 'index.html')), /ENOENT/, 'nothing was written');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  await T('appending a question is a plain append + rebuild: a new question with the next id and qid builds, the counts follow', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'quiz-append-'));
    try {
      for (const dir of ['scripts', 'src', 'lessons', 'data']) cpSync(join(ROOT, dir), join(fixture, dir), { recursive: true });
      const path = join(fixture, 'lessons', 'armor', 'medium.json');
      const bank = JSON.parse(readFileSync(path, 'utf8'));
      const readBank = mode => JSON.parse(readFileSync(join(fixture, 'lessons', 'armor', `${mode}.json`), 'utf8'));
      const sizes = MODES.map(mode => readBank(mode).length);
      sizes[MODES.indexOf('medium')]++;
      bank.push({ ...bank[0], id: bank.length + 1, qid: `armor-m-${bank.length + 1}`, prompt: 'A brand new appended prompt about armor movement?' });
      writeFileSync(path, JSON.stringify(bank, null, 2));
      const attempts = MODES.map(mode => attemptLength(readBank(mode)));
      const result = spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs')], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const html = readFileSync(join(fixture, 'armor', 'index.html'), 'utf8');
      assert.ok(html.includes(`${attempts[1]} questions per attempt. Compare, diagnose`), 'the medium mode states its attempt length and the new bank size');
      assert.ok(html.includes(`${sizes.reduce((sum, size) => sum + size, 0)} situational questions`), 'the lede states the new total');
      const hub = readFileSync(join(fixture, 'index.html'), 'utf8');
      const low = Math.min(...attempts);
      const high = Math.max(...attempts);
      assert.ok(hub.includes(low === high ? `${low} questions per attempt` : `${low}–${high} questions per attempt`), 'the hub card states the attempt length');
      const combined = readFileSync(join(fixture, 'combined', 'index.html'), 'utf8');
      assert.ok(combined.includes('A brand new appended prompt about armor movement?'), 'the pool exam picks up the new question');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  await T('a new lesson is just dropped in: lessons/_template + hero.svg + three banks builds a page, a hub card and an instructor entry', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'quiz-slot-'));
    try {
      for (const dir of ['scripts', 'src', 'lessons', 'data']) cpSync(join(ROOT, dir), join(fixture, dir), { recursive: true });
      const dir = join(fixture, 'lessons', 'signaljoint');
      rmSync(dir, { recursive: true, force: true });
      cpSync(join(ROOT, 'lessons', '_template'), dir, { recursive: true });
      const config = JSON.parse(readFileSync(join(dir, 'lesson.json'), 'utf8'));
      config.categoryOrder = ['Test topic'];
      writeFileSync(join(dir, 'lesson.json'), JSON.stringify(config));
      writeFileSync(join(dir, 'hero.svg'), '<svg viewBox="0 0 480 250" aria-hidden="true" focusable="false"><path d="M0 0H10"/></svg>');
      for (const mode of MODES) {
        // Placeholder fixtures only (never real content): enough to exercise the build.
        const bank = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, difficulty: mode, category: 'Test topic', tags: ['t'], prompt: `Fixture ${mode} ${index}?`, options: ['w', 'x', 'y', 'z'], answer: index, explanation: 'Fixture.', sourceSlides: [1] }));
        writeFileSync(join(dir, `${mode}.json`), JSON.stringify(bank));
      }
      let result = spawnSync(process.execPath, [join(fixture, 'scripts', 'assign-qids.mjs'), 'signaljoint'], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(readFileSync(join(dir, 'hard.json'), 'utf8'))[3].qid, 'signaljoint-h-04');
      result = spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs')], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const page = readFileSync(join(fixture, 'joint-signal', 'index.html'), 'utf8');
      assert.match(page, /<title>Signal Support in Joint Operations Mastery Quiz<\/title>/);
      assert.match(page, /href="\.\.\/#module-3"/);
      const hub = readFileSync(join(fixture, 'index.html'), 'utf8');
      const panel = hub.match(/<section class="exam-panel" id="module-3"[\s\S]*?<\/section>/)[0];
      assert.ok(panel.indexOf('id="card-signal"') < panel.indexOf('id="card-signaljoint"'), 'second Module 3 lesson after Signal Support');
      assert.match(panel, /<a class="start-link" href="joint-signal\/">/);
      assert.match(hub, /3 lessons<\/span>/);
      assert.match(readFileSync(join(fixture, 'instructor', 'index.html'), 'utf8'), /signaljoint:hard:signaljoint-h-04/);
      assert.match(readFileSync(join(ROOT, 'apps-script', 'Code.gs'), 'utf8'), /signaljoint: 'Signal Joint Operations History'/, 'the sheet already knows the lesson');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  for (const lesson of lessons.filter(item => !item.pool)) {
    const share = lesson.maxKeyLongestShare ?? 0.35;
    for (const mode of MODES) {
      const bank = lesson.banks[mode];
      await T(`${lesson.key} ${mode}: valid bank, qids ${lesson.key}-${LETTER[mode]}-NN, four distinct options, every topic present`, () => {
        assert.deepEqual(validateBank(bank, mode, lesson.rules), []);
        bank.forEach((item, index) => {
          assert.ok(item.tags.length > 0, `${index + 1} needs tags`);
          assert.equal(new Set(item.options.map(normalize)).size, 4, `${index + 1} needs four distinct options`);
        });
        const used = new Set(bank.map(item => item.category));
        for (const category of lesson.categoryOrder) assert.ok(used.has(category), `no ${category} question`);
        assert.ok(bank.length >= lesson.categoryOrder.length);
      });
      await T(`${lesson.key} ${mode}: answer letters balanced (±1 around ${bank.length}/4, max − min ≤ 1) and the key is the unique longest option in at most ${Math.round(share * 100)}%`, () => {
        const counts = [0, 0, 0, 0];
        let longest = 0;
        for (const item of bank) {
          counts[item.answer]++;
          const lengths = item.options.map(option => option.length);
          if (lengths[item.answer] === Math.max(...lengths) && lengths.filter(length => length === lengths[item.answer]).length === 1) longest++;
        }
        const even = bank.length / 4;
        assert.ok(counts.every(count => count >= Math.ceil(even - 1) && count <= Math.floor(even + 1)), counts.join('/'));
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `answer letters differ by at most one: ${counts.join('/')}`);
        assert.ok(longest <= share * bank.length, `key is the unique longest option in ${longest}/${bank.length} items`);
      });
    }
    await T(`${lesson.key}: every prompt is unique across the three banks`, () => {
      const seen = new Map();
      for (const mode of MODES) {
        for (const item of lesson.banks[mode]) {
          const key = normalize(item.prompt);
          assert.ok(!seen.has(key), `Duplicate prompt: ${seen.get(key)} and ${mode} ${item.id}`);
          seen.set(key, `${mode} ${item.id}`);
        }
      }
    });
  }

  await T('every lesson bank has at most 50 questions, and the three modes together cover every tag and topic of the lesson', () => {
    for (const lesson of lessons.filter(item => !item.pool)) {
      for (const mode of MODES) assert.ok(lesson.banks[mode].length >= 1 && lesson.banks[mode].length <= 50, `${lesson.key} ${mode} holds ${lesson.banks[mode].length}`);
      const all = MODES.flatMap(mode => lesson.banks[mode]);
      const terms = new Set(all.flatMap(question => questionTerms(question)));
      for (const category of lesson.rules.categoryOrder) {
        assert.ok(terms.has(category), `${lesson.key}: the union has no ${category} question`);
        for (const mode of MODES) assert.ok(lesson.banks[mode].some(question => question.category === category), `${lesson.key} ${mode}: no ${category} question`);
      }
      // Union coverage: every term is taught by some question of some mode (a tag is never an orphan of a removed question).
      for (const term of terms) assert.ok(all.some(question => questionTerms(question).includes(term)), `${lesson.key}: ${term}`);
    }
  });

  await T('retired qids are never in a bank again; coverage.md rows still point at existing items', () => {
    for (const lesson of lessons.filter(item => !item.pool)) {
      const dir = join(ROOT, 'lessons', lesson.key);
      const retiredPath = join(dir, 'retired.json');
      if (existsSync(retiredPath)) {
        const retired = JSON.parse(readFileSync(retiredPath, 'utf8'));
        const inBanks = new Set(MODES.flatMap(mode => lesson.banks[mode].map(question => question.qid)));
        for (const qid of retired) assert.ok(!inBanks.has(qid), `${lesson.key}: retired ${qid} is back in a bank`);
      }
      const coveragePath = join(dir, 'coverage.md');
      if (!existsSync(coveragePath)) continue;
      const letters = { E: 'easy', M: 'medium', H: 'hard' };
      for (const line of readFileSync(coveragePath, 'utf8').split(/\r?\n/)) {
        const row = line.match(/^\| (.+?) \| ((?:[EMH]\d+ \([SO]\)(?:, )?)+) \|$/);
        if (!row) continue;
        for (const [, letter, number] of row[2].matchAll(/([EMH])(\d+) \([SO]\)/g)) assert.ok(Number(number) >= 1 && Number(number) <= lesson.banks[letters[letter]].length, `${lesson.key} coverage.md: ${letter}${number} is not in the bank (${row[1]})`);
      }
    }
  });

  await T('hub card tags state each lesson’s questions per attempt (the whole bank, at most 50)', () => {
    for (const lesson of lessons) {
      const label = countLabel(lesson);
      if (lesson.pool) assert.equal(label, '60 questions');
      else {
        const counts = MODES.map(mode => lesson.attempts[mode]);
        counts.forEach((value, index) => assert.equal(value, attemptLength(lesson.banks[MODES[index]]), 'a lesson attempt is the whole bank'));
        assert.ok(counts.every((value, index) => value >= 1 && value <= 50 && value === lesson.banks[MODES[index]].length));
        const low = Math.min(...counts);
        const high = Math.max(...counts);
        assert.equal(label, low === high ? `${low} questions per attempt` : `${low}–${high} questions per attempt`);
      }
    }
  });
}
