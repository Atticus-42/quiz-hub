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

test('data: 14 graded exams, no student answers or scores, essays and the garbled EW item left out with reasons', () => {
  assert.equal(source.exams.length, 14);
  assert.doesNotMatch(raw, /studentAnswer|PASSED|DID NOT PASS|score \d/i);
  for (const exam of source.exams) for (const q of exam.questions) {
    assert.deepEqual(Object.keys(q).sort(), ['key', 'n', 'stem']);
    for (const pattern of FORBIDDEN_TEXT) assert.doesNotMatch(q.stem + q.key, pattern, `${exam.key} Q${q.n}`);
  }
  const diag = source.exams.find(exam => exam.key === 'gradeddiag');
  assert.deepEqual(diag.skipped.map(item => item.n), [71, 72, 73]);
  assert.deepEqual(source.exams.find(exam => exam.key === 'gradedew').skipped.map(item => item.n), [26]);
  assert.equal(source.exams.reduce((sum, exam) => sum + exam.itemCount, 0), 488);
  assert.equal(data.questions.size, 484);
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
    combined: ['gradedma2', 'gradedisr', 'gradedartillery', 'gradedarmyops'], moduleone: ['gradedma1', 'gradedmla'], modulefive: ['gradedc2'], modulesix: ['gradedew'], moduleseven: ['gradedcyber'],
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

test('built lesson page: Actual Exam is a labelled category apart from Easy/Medium/Hard and is never posted', async () => {
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
  assert.equal(after.submission.status, 'actual');
  assert.equal(after.submission.payload, null);
  assert.ok(fetch.calls.every(call => call.method === 'GET'), 'no POST to the class history');
  assert.ok(fetch.calls.every(call => !/mode=actual/.test(call.url)), 'the endpoint never sees the actual mode');
  assert.match(app.document.getElementById('history-save-message').textContent, /Actual Exam attempts are not saved/);
  assert.ok(Object.keys(storage.entries()).includes('mastery-quiz:progress:gradedisr:actual'), 'device progress is keyed by graded exam');
  assert.equal(api.retryMissed(), true);
  assert.equal(plain(api.getState()).attempt.practice, true);
  answerAll(api);
  await api.whenSettled();
  assert.ok(fetch.calls.every(call => call.method === 'GET'));
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
  assert.ok(fetch.calls.every(call => call.method === 'GET'));
  api.resetToDifficulty();
  api.startQuiz('easy');
  answerAll(api);
  await api.whenSettled();
  const posts = fetch.calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(JSON.parse(posts[0].body).mode, 'easy');
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
    assert.doesNotMatch(html, /script\.google\.com/, `${path} never contacts the history endpoint`);
    assert.doesNotMatch(html, /studentAnswer|Juan|PASSED/);
    assert.match(html, /href="\.\.\/\.\.\/assets\/banner-1600\.jpg"|src="\.\.\/\.\.\/assets\/banner-1600\.jpg"/);
    assert.doesNotMatch(html, /(?:src|href)="\.\.\/assets\//, `${path}: asset paths reach the site root`);
    assert.match(html, /<a id="hub-link" class="hub-link" href="\.\.\/">/);
  }
  const fetch = fakeFetch(() => { throw new Error('no request expected'); });
  const one = start(pages[`${REVIEWER_SLUG}/coalition/index.html`] ?? pages[`${REVIEWER_SLUG}/signal-support-coalition-operations/index.html`], { fetch });
  assert.equal(one.api.getState().attempt.questions.length, 13);
  assert.equal(one.app.document.getElementById('mode-list').hidden, true, 'no difficulty buttons');
  assert.equal(one.app.document.getElementById('btn-history').hidden, true);
  answerAll(one.api);
  await one.api.whenSettled();
  assert.equal(one.api.getState().submission.status, 'actual');
  const mixed = start(pages[`${REVIEWER_SLUG}/all/index.html`], { fetch, button: 'mode-actual-all' });
  assert.equal(mixed.api.getState().attempt.questions.length, data.all.full);
  mixed.api.resetToDifficulty();
  mixed.app.document.getElementById('mode-actual').click();
  assert.equal(mixed.api.getState().attempt.questions.length, ACTUAL_DRAW);
  assert.equal(fetch.calls.length, 0);
  assert.equal(mixed.api.startQuiz('easy'), false, 'no difficulty attempts on reviewer pages');
});

test('build freshness: the committed reviewer pages and lesson pages match a fresh build', () => {
  for (const path of Object.keys(pages).filter(path => path.startsWith(REVIEWER_SLUG + '/') || path === 'isr/index.html')) {
    assert.equal(readFileSync(join(ROOT, path), 'utf8'), pages[path], `${path} is stale: run node scripts/build.mjs`);
  }
});
