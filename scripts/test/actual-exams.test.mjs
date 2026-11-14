// Actual Exam: the class's graded exams as a fourth category and as the Comprehensive Exam Reviewer.
//   node --test scripts/test/actual-exams.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, loadLessons, MODES } from '../build.mjs';
import { ACTUAL_DRAW, REVIEWER_SLUG, actualExamData, buildActualQuestions, loadActualExams, nearDuplicate, tokens, validateActualBank, FORBIDDEN_TEXT } from '../actual-exams.mjs';
import { runPage, findAll, hasClass, withEndpoint, fakeFetch, TEST_ENDPOINT, FakeStorage, plain, seededRandom } from './harness.mjs';

const { lessons } = loadLessons();
const byKey = new Map(lessons.map(lesson => [lesson.key, lesson]));
const data = actualExamData(ROOT, lessons);
const raw = readFileSync(join(ROOT, 'data', 'actual-exams.json'), 'utf8');
const source = JSON.parse(raw);
const pages = build({ write: false });
const examKeys = new Set(data.exams.map(exam => exam.key));
const ok = { body: { ok: true, rows: [] } };

function start(html, { fetch, storage, button = 'mode-actual' } = {}) {
  const app = runPage(html, { fetch, globals: storage ? { localStorage: storage } : {} });
  const api = app.window.__quiz;
  const input = app.document.getElementById('student-name');
  input.value = 'Juan Dela Cruz';
  input.dispatchEvent({ type: 'input', target: input });
  input.dispatchEvent({ type: 'blur', target: input });
  app.document.getElementById('study-confirm').click();
  const node = app.document.getElementById(button);
  assert.ok(node, `#${button} exists`);
  assert.equal(node.disabled, false, `#${button} is enabled by the gate`);
  node.click();
  return { app, api };
}
function answerAll(api, correct = () => true) {
  const total = api.getState().attempt.questions.length;
  for (let i = 0; i < total; i++) {
    api.goToQuestion(i);
    const question = api.getState().attempt.questions[i];
    api.selectAnswer(correct(i) ? question.answer : (question.answer + 1) % question.options.length);
    api.checkAnswer();
  }
  api.finishQuiz();
}

test('data: 15 graded exams, no student answers or scores, essays and the garbled EW item left out with reasons', () => {
  assert.equal(source.exams.length, 15);
  assert.doesNotMatch(raw, /studentAnswer|PASSED|DID NOT PASS|score \d/i);
  for (const exam of source.exams) for (const q of exam.questions) {
    const fields = Object.keys(q).sort().join();
    assert.ok(fields === 'key,n,stem' || fields === 'distractors,key,n,stem', `${exam.key} Q${q.n} fields ${fields}`);
    if (q.distractors) assert.ok(!q.distractors.includes(q.key) && q.distractors.length === 3, `${exam.key} Q${q.n} distractors`);
    for (const pattern of FORBIDDEN_TEXT) assert.doesNotMatch(q.stem + q.key, pattern, `${exam.key} Q${q.n}`);
  }
  const diag = source.exams.find(exam => exam.key === 'gradeddiag');
  assert.deepEqual(diag.skipped.map(item => item.n), [71, 72, 73]);
  assert.deepEqual(source.exams.find(exam => exam.key === 'gradedew').skipped.map(item => item.n), [26]);
  assert.equal(source.exams.reduce((sum, exam) => sum + exam.itemCount, 0), 538);
  assert.equal(data.questions.size, 534);
  assert.ok(source.exams.find(exam => exam.key === 'gradedartillery').questions[0].stem.endsWith('"Defeated" according to the slide?'));
});

test('schema: every generated question validates, cites its graded exam and keeps the key verbatim among its options', () => {
  for (const view of [...data.perExam, data.all, ...data.pages.values()]) assert.deepEqual(validateActualBank(view.bank, examKeys), []);
  for (const exam of data.exams) for (const q of exam.questions) {
    const item = data.questions.get(`${exam.key}-a-${String(q.n).padStart(2, '0')}`);
    assert.ok(item, `${exam.key} Q${q.n}`);
    assert.equal(item.prompt, q.stem);
    assert.equal(item.options[item.answer], q.key, `${item.qid}: the key is the answer`);
    assert.equal(item.options.filter(option => option === q.key).length, 1);
    assert.equal(item.options.length, /^(true|false)$/i.test(q.key) ? 2 : 4);
    assert.deepEqual(item.source, { type: 'graded-exam', exam: exam.key, title: exam.title, date: exam.date, number: q.n });
    assert.equal(item.sourceSlides, undefined);
    for (const option of item.options) if (option !== q.key) assert.ok(!nearDuplicate(option, q.key), `${item.qid}: "${option}" is a near-duplicate of the key`);
  }
  assert.ok(nearDuplicate('Signal Intelligence', 'Signals Intelligence'));
  assert.ok(nearDuplicate('SIGINT', 'Signals Intelligence (SIGINT)'));
  assert.ok(nearDuplicate('Army Core Values', 'Army values (or Leader Attributes/Core Values)'));
  assert.ok(!nearDuplicate('Implied Task', 'Specified Task'));
  assert.deepEqual([...tokens('Armies, armour!')], ['armie', 'armour']);
  assert.deepEqual(validateActualBank([{ ...data.all.bank[0], source: { ...data.all.bank[0].source, type: 'pam-page' } }], examKeys).length, 1, 'only known source types');
});

test('choices: seeded and reproducible, letters balanced within each exam, distractors from the same exam first', () => {
  const again = buildActualQuestions(loadActualExams(ROOT, byKey));
  assert.deepEqual([...again.values()], [...data.questions.values()]);
  for (const { exam, bank } of data.perExam) {
    const letters = [0, 1, 2, 3].map(index => bank.filter(item => item.answer === index).length);
    assert.ok(Math.max(...letters) - Math.min(...letters) <= 1, `${exam.key}: letters ${letters}`);
    const ownKeys = new Set(exam.questions.map(q => q.key));
    const own = bank.flatMap(item => item.options.filter((_, index) => index !== item.answer)).filter(option => ownKeys.has(option)).length;
    assert.ok(own / (bank.length * 3) > 0.6, `${exam.key}: most distractors come from the same exam (${own})`);
  }
});

test('placement: lesson and module pages carry their graded exams; qids follow <examKey>-a-NN', () => {
  const expected = {
    coalition: ['gradedcoalition'], signaljoint: ['gradedjoint'], signal: ['gradedcombined'], isr: ['gradedisr'], fieldartillery: ['gradedartillery'],
    armyops: ['gradedarmyops'], leadershipattributes: ['gradedmla'], modulethree: ['gradedssi', 'gradedcoalition', 'gradedjoint', 'gradedcombined'],
    combined: ['gradedma2', 'gradedisr', 'gradedartillery', 'gradedarmyops'], moduleone: ['gradedma1', 'gradedmla'], modulefive: ['gradedc2'], modulesix: ['gradedew'], moduleseven: ['gradedcyber'], moduleeight: ['gradedsigplan'],
  };
  assert.deepEqual(Object.fromEntries([...data.pages].map(([key, page]) => [key, page.exams.map(exam => exam.key)])), expected);
  for (const [key, page] of data.pages) {
    const lesson = byKey.get(key);
    const moduleExam = Boolean(lesson.pool) || (lesson.prominent && lesson.order === 0);
    assert.equal(page.attempt, moduleExam ? Math.min(ACTUAL_DRAW, page.count) : page.count, key);
    for (const item of page.bank) assert.match(item.qid, /^[a-z][a-z0-9]{1,23}-a-\d{2,4}$/);
  }
  const ids = [...data.questions.keys()];
  assert.equal(new Set(ids).size, ids.length);
  const lessonQids = new Set(lessons.filter(lesson => !lesson.pool).flatMap(lesson => MODES.flatMap(mode => lesson.banks[mode].map(item => item.qid))));
  assert.ok(ids.every(id => !lessonQids.has(id)));
});

test('built lesson page: Actual Exam is a labelled category apart from Easy/Medium/Hard and posts as mode actual', async () => {
  const html = withEndpoint(pages['isr/index.html'], TEST_ENDPOINT);
  assert.match(html, /<section id="actual-block" class="actual-block" aria-labelledby="actual-heading">/);
  assert.match(html, /<span class="actual-badge">Actual Exam<\/span> <span>Questions from the class’s graded exams<\/span>/);
  assert.ok(html.indexOf('id="mode-hard"') < html.indexOf('id="mode-actual"'));
  const fetch = fakeFetch(() => ok);
  const storage = new FakeStorage();
  const { app, api } = start(html, { fetch, storage });
  const state = plain(api.getState());
  assert.equal(state.attempt.mode, 'actual');
  assert.equal(state.attempt.questions.length, data.pages.get('isr').count);
  assert.equal(app.document.getElementById('quiz-heading').textContent, 'Actual Exam review');
  assert.match(app.document.getElementById('question-category').textContent, /^Actual Exam · Exam on ISR Operations · question \d+$/);
  api.selectAnswer(state.attempt.questions[0].answer);
  api.checkAnswer();
  const refs = findAll(app.document.getElementById('answer-feedback'), node => hasClass(node, 'source-ref')).map(node => node.textContent);
  assert.match(refs.join(' '), /^SOAC 52-2026 graded exam: Exam on ISR Operations, 1 October 2026 · question \d+$/);
  assert.equal(findAll(app.document.getElementById('answer-feedback'), node => hasClass(node, 'library-reference')).length, 0, 'no fake PDF page links');
  answerAll(api, index => index % 3 !== 0);
  await api.whenSettled();
  const after = plain(api.getState());
  assert.equal(after.view, 'results');
  assert.equal(after.submission.status, 'saved');
  const posts = fetch.calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.ok(posts[0].url.startsWith(TEST_ENDPOINT));
  const body = JSON.parse(posts[0].body);
  const total = data.pages.get('isr').count;
  assert.deepEqual(Object.keys(body).sort(), ['asked', 'band', 'finishedAt', 'lesson', 'missed', 'mode', 'name', 'percent', 'score', 'total']);
  assert.equal(body.lesson, 'isr');
  assert.equal(body.mode, 'actual');
  assert.equal(body.total, total);
  assert.equal(body.asked.length, total);
  assert.equal(body.score, total - body.missed.length);
  assert.ok(body.asked.every(id => /^graded[a-z0-9]+:actual:graded[a-z0-9]+-a-\d{2,4}$/.test(id) && id.split(':')[0] === id.split(':')[2].replace(/-a-\d+$/, '')), 'item ids are <examKey>:actual:<examKey>-a-NN');
  assert.ok(body.missed.length > 0 && body.missed.every(id => body.asked.includes(id)));
  assert.doesNotMatch(posts[0].body, /"selected"|"responses"|"answer"/);
  assert.match(app.document.getElementById('history-save-message').textContent, /Saved to the class history/);
  assert.ok(Object.keys(storage.entries()).includes('mastery-quiz:progress:gradedisr:actual'), 'device progress is keyed by graded exam');
  assert.equal(api.retryMissed(), true);
  assert.equal(plain(api.getState()).attempt.practice, true);
  answerAll(api);
  await api.whenSettled();
  assert.equal(fetch.calls.filter(call => call.method === 'POST').length, 1, 'practice retries are not posted');
});

test('built module page: draws at most 50, retake keeps the size, Easy still posts normally', async () => {
  const html = withEndpoint(pages['module-3-exam/index.html'], TEST_ENDPOINT);
  const fetch = fakeFetch(() => ok);
  const { api } = start(html, { fetch });
  api.setRandom(seededRandom(7));
  assert.equal(api.getState().attempt.questions.length, ACTUAL_DRAW);
  answerAll(api);
  assert.equal(api.retakeQuiz(), true);
  assert.equal(api.getState().attempt.questions.length, ACTUAL_DRAW);
  await api.whenSettled();
  assert.equal(fetch.calls.filter(call => call.method === 'POST').length, 1, 'the actual attempt posted once');
  api.resetToDifficulty();
  api.startQuiz('easy');
  answerAll(api);
  await api.whenSettled();
  const posts = fetch.calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 2);
  assert.equal(JSON.parse(posts[0].body).mode, 'actual');
  assert.equal(JSON.parse(posts[1].body).mode, 'easy');
});

test('pages without graded exams have no Actual Exam category; Easy/Medium/Hard banks are unchanged', () => {
  const html = pages['armor/index.html'];
  assert.doesNotMatch(html, /id="actual-block"|id="mode-actual"/);
  assert.match(html, /<script type="application\/json" id="questions-actual">\[\]<\/script>/);
  const { window } = runPage(withEndpoint(html, ''));
  assert.equal(window.__quiz.getState().available, true);
  assert.equal(window.__quiz.actualConfig, null);
});

test('Comprehensive Exam Reviewer: index lists all 14 exams and the mixed set; each page is takeable and makes no request', async () => {
  const index = pages[`${REVIEWER_SLUG}/index.html`];
  assert.ok(index);
  for (const exam of data.exams) assert.ok(index.includes(`href="${exam.slug}/"`), exam.slug);
  assert.ok(index.includes('href="all/"'));
  assert.match(index, /aria-label="Site sections"[\s\S]*?<a href="\.\.\/comprehensive-reviewer\/" aria-current="page"><span>Exam Reviewer<\/span><\/a>/);
  assert.match(pages['index.html'], /<a href="comprehensive-reviewer\/"><span>Exam Reviewer<\/span><\/a>/);
  for (const path of [...data.exams.map(exam => `${REVIEWER_SLUG}/${exam.slug}/index.html`), `${REVIEWER_SLUG}/all/index.html`]) {
    const html = pages[path];
    assert.ok(html, path);
    assert.match(html, /var HISTORY_ENDPOINT = 'https:\/\/script\.google\.com\/macros\/s\/[^']+\/exec';/, `${path} carries the real history endpoint`);
    assert.doesNotMatch(html, /studentAnswer|Juan|PASSED/);
    assert.match(html, /href="\.\.\/\.\.\/assets\/banner-1600\.jpg"|src="\.\.\/\.\.\/assets\/banner-1600\.jpg"/);
    assert.doesNotMatch(html, /(?:src|href)="\.\.\/assets\//, `${path}: asset paths reach the site root`);
    assert.match(html, /<a id="hub-link" class="hub-link" href="\.\.\/">/);
  }
  const fetch = fakeFetch(() => ok);
  const coalitionPath = `${REVIEWER_SLUG}/signal-support-coalition-operations/index.html`;
  const one = start(withEndpoint(pages[coalitionPath], TEST_ENDPOINT), { fetch });
  assert.equal(one.api.getState().attempt.questions.length, 13);
  assert.equal(one.app.document.getElementById('mode-list').hidden, true, 'no difficulty buttons');
  assert.equal(one.app.document.getElementById('btn-history').hidden, false, 'the score history is available');
  answerAll(one.api);
  await one.api.whenSettled();
  assert.equal(one.api.getState().submission.status, 'saved');
  const post = fetch.calls.find(call => call.method === 'POST');
  const body = JSON.parse(post.body);
  assert.equal(body.lesson, 'gradedcoalition');
  assert.equal(body.mode, 'actual');
  assert.equal(body.total, 13);
  assert.equal(body.score, 13);
  assert.ok(body.asked.every(id => /^gradedcoalition:actual:gradedcoalition-a-\d{2}$/.test(id)));
  const mixed = start(withEndpoint(pages[`${REVIEWER_SLUG}/all/index.html`], TEST_ENDPOINT), { fetch, button: 'mode-actual-all' });
  assert.equal(mixed.api.getState().attempt.questions.length, data.all.full);
  answerAll(mixed.api);
  await mixed.api.whenSettled();
  const mixedBody = JSON.parse(fetch.calls.filter(call => call.method === 'POST').at(-1).body);
  assert.equal(mixedBody.lesson, 'gradedall');
  assert.equal(mixedBody.total, data.all.full);
  assert.equal(new Set(mixedBody.asked).size, data.all.full);
  assert.ok(mixedBody.asked.every(id => examKeys.has(id.split(':')[0])), 'every item id names its graded exam');
  mixed.api.resetToDifficulty();
  mixed.app.document.getElementById('mode-actual').click();
  assert.equal(mixed.api.getState().attempt.questions.length, ACTUAL_DRAW);
  assert.equal(mixed.api.startQuiz('easy'), false, 'no difficulty attempts on reviewer pages');
});

test('score history filters: reviewer pages show All + Actual Exam only; lesson pages add Actual Exam; others unchanged', async () => {
  const filters = (html) => {
    const fetch = fakeFetch(() => ({ body: { ok: true, rows: [
      { name: 'Ana Reyes', mode: 'actual', score: 9, total: 10, percent: 90, band: 'Mastery', finishedAt: '2026-11-01T08:00:00.000Z' },
      { name: 'Ben Cruz', mode: 'easy', score: 5, total: 10, percent: 50, band: 'Developing', finishedAt: '2026-11-02T08:00:00.000Z' },
    ] } }));
    const app = runPage(withEndpoint(html, TEST_ENDPOINT), { fetch });
    const visible = ['all', 'easy', 'medium', 'hard', 'actual'].filter(f => !app.document.getElementById(`history-filter-${f}`).hidden);
    return { app, fetch, visible };
  };
  const reviewer = filters(pages[`${REVIEWER_SLUG}/isr-operations/index.html`]);
  assert.deepEqual(reviewer.visible, ['all', 'actual']);
  const lesson = filters(pages['isr/index.html']);
  assert.deepEqual(lesson.visible, ['all', 'easy', 'medium', 'hard', 'actual']);
  assert.deepEqual(filters(pages['armor/index.html']).visible, ['all', 'easy', 'medium', 'hard']);
  await lesson.app.window.__quiz.whenSettled();
  const rows = () => findAll(lesson.app.document.getElementById('history-body'), node => hasClass(node, 'history-row')).map(row => row.textContent);
  assert.equal(rows().length, 2);
  lesson.app.document.getElementById('history-filter-actual').click();
  await lesson.app.window.__quiz.whenSettled();
  assert.ok(lesson.fetch.calls.at(-1).url.includes('mode=actual'));
  assert.deepEqual(rows().map(text => /Ana Reyes/.test(text)), [true]);
  assert.match(rows()[0], /Actual Exam/, 'mode label');
});

test('build freshness: the committed reviewer pages and lesson pages match a fresh build', () => {
  for (const path of Object.keys(pages).filter(path => path.startsWith(REVIEWER_SLUG + '/') || path === 'isr/index.html')) {
    assert.equal(readFileSync(join(ROOT, path), 'utf8'), pages[path], `${path} is stale: run node scripts/build.mjs`);
  }
});
