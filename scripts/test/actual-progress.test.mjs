import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../build.mjs';
import { runPage, withEndpoint, FakeStorage, seededRandom } from './harness.mjs';

const pages = build({ write: false });
const mixed = 'comprehensive-reviewer/all/index.html';
let now = 1000;
function open(path, storage) {
  const app = runPage(withEndpoint(pages[path], ''), { globals: {
    localStorage: storage, Date: class extends Date { static now() { return now; } },
  } });
  const api = app.window.__quiz;
  api.setStudentName('Juan Dela Cruz');
  api.setStudyConfirmed(true);
  api.setRandom(seededRandom(17));
  assert.equal(api.startQuiz('actual'), true);
  return { app, api };
}
function answer(api) {
  const q = api.getState().attempt.questions[0];
  assert.equal(api.selectAnswer(q.answer), true);
}
const ids = api => Array.from(api.getState().attempt.questions, q => q.qid);

test('several 50-question sets survive reload and abandonment; unseen precede oldest repeats', () => {
  const storage = new FakeStorage();
  const taken = new Map();
  let total;
  for (let round = 0; round < 12; round++) {
    now = 1000 + round;
    const { api, app } = open('module-3-exam/index.html', storage);
    const bank = api.getActualBank();
    total = bank.length;
    const unseen = bank.filter(q => !taken.has(q.qid));
    const picked = ids(api);
    assert.equal(picked.length, 50);
    assert.equal(new Set(picked).size, 50);
    const fresh = picked.filter(qid => !taken.has(qid));
    assert.equal(fresh.length, Math.min(50, unseen.length), 'no repeats while 50 unseen remain');
    assert.deepEqual(picked.slice(0, fresh.length), fresh, 'unseen come before repeats');
    const repeats = picked.slice(fresh.length);
    const oldest = Array.from(bank.filter(q => taken.has(q.qid)), q => taken.get(q.qid)).sort((a, b) => a - b).slice(0, repeats.length);
    assert.deepEqual(repeats.map(qid => taken.get(qid)), oldest, 'fill from least recently seen');
    if (unseen.length < 50) assert.match(app.document.getElementById('quiz-status').textContent, /repeats|seen all/i);
    // Selecting even one answer activates this set; no Check, Finish, or unload is required.
    answer(api);
    picked.forEach(qid => taken.set(qid, now));
  }
  assert.equal(taken.size, total);
});

test('an untouched draw stays unseen; an answered exam set shares progress with mixed and lesson/module pages', () => {
  const storage = new FakeStorage();
  now = 5000;
  const exam = open('comprehensive-reviewer/isr-operations/index.html', storage);
  assert.equal(Object.keys(exam.api.loadProgress('actual').gradedisr).length, 0);
  answer(exam.api);
  const examIds = ids(exam.api);
  assert.equal(exam.api.checkAnswer(), true);
  for (const path of [mixed, 'isr/index.html', 'combined/index.html']) {
    const { api } = open(path, storage);
    const progress = api.loadProgress('actual');
    assert.ok(examIds.every(qid => progress.gradedisr[qid]), `${path} reads the exam owner's progress`);
    const unseen = api.getActualBank().filter(q => !examIds.includes(q.qid));
    const actual = api.getState().attempt.questions.filter(q => q.source.type === 'graded-exam');
    assert.equal(actual.filter(q => !examIds.includes(q.qid)).length, Math.min(path === mixed ? 30 : 50, unseen.length));
  }
  assert.equal(exam.api.resetProgress(), true);
  assert.deepEqual(Object.keys(open(mixed, storage).api.loadProgress('actual').gradedisr), []);
});

test('legacy actual s/m records remain seen; new answer times update immediately', () => {
  const storage = new FakeStorage();
  const initial = open(mixed, storage);
  const bank = initial.api.getActualBank();
  for (const q of bank) {
    const key = `mastery-quiz:progress:${q.examKey}:actual`;
    const record = JSON.parse(storage.getItem(key) || '{}');
    record[q.qid] = 'm';
    storage.setItem(key, JSON.stringify(record));
  }
  now = 9000;
  const { api } = open(mixed, storage);
  answer(api);
  const first = new Set(ids(api));
  const next = open(mixed, storage);
  assert.ok(ids(next.api).every(qid => !first.has(qid)), 'older legacy entries precede the just-answered set');
});

test('reviewer topic rotation survives reload and covers all topics within ceil(topics/20) sets', () => {
  const storage = new FakeStorage();
  const reached = new Set();
  const taken = new Set();
  const initial = open(mixed, storage);
  const topics = initial.api.actualConfig.reviewer.lessons;
  const untouched = ids(initial.api);
  assert.deepEqual(ids(open(mixed, storage).api), untouched, 'untouched draw does not advance rotation');
  for (let round = 0; round < Math.ceil(topics.length / 20); round++) {
    const { api } = open(mixed, storage);
    const reviewer = api.getState().attempt.questions.filter(q => q.source.type === 'reviewer-bank');
    assert.equal(reviewer.length, 20);
    assert.equal(new Set(reviewer.map(q => q.lessonKey)).size, 20);
    reviewer.forEach(q => { reached.add(q.lessonKey); assert.ok(!taken.has(q.qid)); taken.add(q.qid); });
    answer(api);
  }
  assert.deepEqual([...reached].sort(), Array.from(topics, l => l.key).sort());
});

test('reviewer unseen-first shares lesson difficulty progress in both directions', () => {
  const storage = new FakeStorage();
  const initial = open(mixed, storage);
  const reviewer = initial.api.actualConfig.reviewer;
  const topic = reviewer.lessons[0];
  const own = reviewer.bank.filter(q => q.lessonKey === topic.key);
  for (const mode of ['easy', 'medium', 'hard']) {
    storage.setItem(`mastery-quiz:progress:${topic.key}:${mode}`, JSON.stringify(Object.fromEntries(own.filter(q => q.difficulty === mode).map(q => [q.qid, 's']))));
  }
  const fresh = own.find(q => q.difficulty === 'medium');
  const key = `mastery-quiz:progress:${topic.key}:medium`;
  const record = JSON.parse(storage.getItem(key));
  delete record[fresh.qid];
  storage.setItem(key, JSON.stringify(record));
  const { api } = open(mixed, storage);
  assert.ok(ids(api).includes(fresh.qid), 'lesson-seen items yield to the unseen medium item');
  answer(api);
  assert.equal(JSON.parse(storage.getItem(key))[fresh.qid], 's', 'activated mixed set writes the lesson record');
  const app = runPage(withEndpoint(pages['armor/index.html'], ''), { globals: { localStorage: storage } });
  const armor = api.getState().attempt.questions.find(q => q.lessonKey === 'armor');
  assert.ok(armor);
  assert.equal(app.window.__quiz.loadProgress(armor.difficulty).armor[armor.qid], 's');
});

test('each later answer refreshes recency before finishing an unfinished set', () => {
  const storage = new FakeStorage();
  now = 10000;
  const { api } = open('comprehensive-reviewer/isr-operations/index.html', storage);
  answer(api);
  assert.equal(api.checkAnswer(), true);
  assert.equal(api.goToQuestion(1), true);
  now = 10001;
  const question = api.getState().attempt.questions[1];
  api.selectAnswer(question.answer);
  const progress = api.loadProgress('actual');
  assert.equal(progress.gradedisr[question.qid], 10001);
  const bank = api.getActualBank();
  const next = api.createAttempt('actual', { actual: bank }, seededRandom(2), progress, 1);
  assert.notEqual(next.questions[0].qid, question.qid, 'the newly answered question is newer than the rest');
});
