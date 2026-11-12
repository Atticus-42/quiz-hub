// "Actual Exam": questions from the class's graded exams (data/actual-exams.json), served as a fourth category
// beside Easy, Medium and Hard on the matching lesson and module exam pages, and on the Comprehensive Exam
// Reviewer (comprehensive-reviewer/), which lists every graded exam as its own quiz plus a mixed set.
//
// The portal showed only each question's stem and answer key, so the build turns every item into a multiple-choice
// question: the key plus three distractors taken from the answer keys of other questions, preferring the same exam
// and a key of similar type and length, then the same module (true/false keys become two-option items). Every
// choice is seeded by the question's qid, so the same data always builds the same page. Near-duplicates of the key
// (case, plural, punctuation, an acronym or a subset of its words) and keys of questions with the same stem are never
// used as distractors. Questions cite their graded exam (source type "graded-exam"), never a lesson page.
//
// qids: "<examKey>-a-<NN>", NN being the question's number on the graded exam. Permanent; never renumbered.
// Actual-exam attempts post to the class history like the other modes: mode "actual", qids <examKey>-a-NN (apps-script/Code.gs v8).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ACTUAL_MODE = 'actual';
export const ACTUAL_LABEL = 'Actual Exam';
export const ACTUAL_NOTE = 'Questions from the class’s graded exams';
export const ACTUAL_LETTER = 'a';
export const SOURCE_TYPES = ['graded-exam'];
export const REVIEWER_SLUG = 'comprehensive-reviewer';
export const REVIEWER_TITLE = 'Comprehensive Exam Reviewer';
// The largest Actual Exam attempt on a module page and on the mixed set; lesson and single-exam pages serve all.
export const ACTUAL_DRAW = 50;
const EXAM_KEY = /^[a-z][a-z0-9]{1,23}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Text the source marked as garbled must never reach a page.
export const FORBIDDEN_TEXT = [/garbled/i, /\[ESSAY/i, /studentAnswer/i];

export function displayDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function examCitation(exam) {
  return `SOAC 52-2026 graded exam: ${exam.title}, ${displayDate(exam.date)}`;
}

// ----- Deterministic choices -----

function hash(text) {
  let h = 2166136261;
  for (const char of text) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seeded(text) {
  let a = hash(text);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ----- Near-duplicate detection -----

const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to', 'in', 'for', 'on', 'by', 'with', 'is', 'are', 'its', 'it']);
export function tokens(text) {
  return new Set(String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(word => word && !STOP.has(word))
    .map(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)));
}
function jaccard(a, b) {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  const union = a.size + b.size - shared;
  return union ? shared / union : 1;
}
// True when two answers are the same answer in different clothes: equal after case, plural and punctuation,
// one is an acronym or a subset of the other's words, or they share most of their words.
export function nearDuplicate(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  if ([...x].every(word => y.has(word)) || [...y].every(word => x.has(word))) return true;
  return jaccard(x, y) >= 0.6;
}
const sameStem = (a, b) => jaccard(tokens(a), tokens(b)) >= 0.7;

function answerClass(key) {
  if (/^(true|false)$/i.test(key.trim())) return 'tf';
  if (/^\d/.test(key.trim())) return 'number';
  const words = key.trim().split(/\s+/).length;
  return words <= 4 ? 'short' : words <= 12 ? 'medium' : 'long';
}

// ----- Loading and validation -----

export function loadActualExams(root, lessonsByKey) {
  const path = join(root, 'data', 'actual-exams.json');
  const raw = readFileSync(path, 'utf8');
  const fail = message => { throw new Error(`${path}: ${message}`); };
  if (/studentAnswer/i.test(raw)) fail('must not hold student answers');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.exams) || !data.exams.length) fail('exams must be a nonempty list');
  const keys = new Set();
  const slugs = new Set();
  for (const exam of data.exams) {
    const where = `exam ${exam.key}`;
    if (!EXAM_KEY.test(exam.key ?? '') || keys.has(exam.key) || lessonsByKey.has(exam.key)) fail(`${where}: key must be unique, 2-24 lowercase letters/digits and not a lesson key`);
    if (!SLUG.test(exam.slug ?? '') || slugs.has(exam.slug) || exam.slug === 'all') fail(`${where}: slug must be a unique URL folder name`);
    keys.add(exam.key);
    slugs.add(exam.slug);
    for (const field of ['title', 'portalTitle', 'module']) if (typeof exam[field] !== 'string' || !exam[field].trim()) fail(`${where}: ${field} must be a nonempty string`);
    if (!DATE.test(exam.date ?? '') || Number.isNaN(Date.parse(exam.date))) fail(`${where}: date must be YYYY-MM-DD`);
    if (!Array.isArray(exam.pages) || exam.pages.some(key => !lessonsByKey.has(key))) fail(`${where}: pages must list lesson or module exam keys`);
    if (!Number.isInteger(exam.itemCount) || exam.itemCount !== exam.questions.length + exam.skipped.length) fail(`${where}: itemCount must equal included plus skipped items`);
    const numbers = new Set();
    for (const item of [...exam.questions, ...exam.skipped]) {
      if (!Number.isInteger(item.n) || item.n < 1 || item.n > 9999 || numbers.has(item.n)) fail(`${where}: question numbers must be unique integers`);
      numbers.add(item.n);
    }
    for (const q of exam.questions) {
      const fields = Object.keys(q).sort().join();
      if (fields !== 'key,n,stem' && fields !== 'distractors,key,n,stem') fail(`${where} Q${q.n}: a question holds only n, stem, key and optional distractors`);
      if (typeof q.stem !== 'string' || !q.stem.trim() || typeof q.key !== 'string' || !q.key.trim()) fail(`${where} Q${q.n}: stem and key must be nonempty`);
      if (q.distractors !== undefined) {
        const list = q.distractors;
        if (!Array.isArray(list) || list.length !== 3 || list.some(d => typeof d !== 'string' || !d.trim())) fail(`${where} Q${q.n}: distractors must be three nonempty strings`);
        const all = [q.key, ...list].map(d => d.trim().toLowerCase());
        if (new Set(all).size !== 4 || list.some(d => nearDuplicate(d, q.key))) fail(`${where} Q${q.n}: distractors must differ from each other and from the key`);
      }
      for (const pattern of FORBIDDEN_TEXT) if (pattern.test(q.stem + ' ' + q.key)) fail(`${where} Q${q.n}: contains forbidden text ${pattern}`);
    }
    for (const s of exam.skipped) if (typeof s.reason !== 'string' || !s.reason.trim()) fail(`${where} Q${s.n}: a skipped item needs a reason`);
  }
  return data.exams;
}

// ----- Multiple-choice questions -----

export function actualQid(exam, n) {
  return `${exam.key}-${ACTUAL_LETTER}-${String(n).padStart(2, '0')}`;
}

export function buildActualQuestions(exams) {
  const items = exams.flatMap(exam => exam.questions.map(q => ({ exam, q, cls: answerClass(q.key) })));
  const out = new Map();
  for (const exam of exams) {
    const own = items.filter(item => item.exam === exam);
    // Balanced key positions: each letter used equally often (within one) across the exam, in a seeded order.
    const positions = shuffle(own.map((_, index) => index % 4), seeded(`${exam.key}:positions`));
    own.forEach((item, index) => {
      const qid = actualQid(exam, item.q.n);
      const random = seeded(qid);
      const key = item.q.key;
      let options;
      let answer;
      if (item.cls === 'tf') {
        options = ['True', 'False'];
        answer = /^true$/i.test(key.trim()) ? 0 : 1;
      } else if (item.q.distractors) {
        // Hand-written distractors for keys the pool cannot match well (numbers and values).
        answer = positions[index];
        options = shuffle(item.q.distractors.slice(), random);
        options.splice(answer, 0, key);
      } else {
        const keyLength = key.length;
        const candidates = [];
        const seen = [];
        for (const other of items) {
          if (other === item) continue;
          const text = other.q.key;
          if (other.cls === 'tf' || nearDuplicate(text, key) || sameStem(other.q.stem, item.q.stem)) continue;
          if (seen.some(prior => prior.toLowerCase() === text.toLowerCase())) continue;
          seen.push(text);
          const cost = Math.abs(Math.log(text.length / keyLength))
            + (other.cls === item.cls ? 0 : 1)
            + (other.exam === exam ? 0 : other.exam.module === exam.module ? 0.75 : 2.5);
          candidates.push({ text, cost });
        }
        candidates.sort((a, b) => a.cost - b.cost || a.text.localeCompare(b.text));
        // A seeded pick among the closest few, so similar keys do not always meet the same three distractors.
        const near = shuffle(candidates.slice(0, 7), random).concat(candidates.slice(7));
        const chosen = [];
        for (const candidate of near) {
          if (chosen.some(prior => nearDuplicate(prior, candidate.text))) continue;
          chosen.push(candidate.text);
          if (chosen.length === 3) break;
        }
        if (chosen.length < 3) throw new Error(`${qid}: fewer than three distinct distractors`);
        answer = positions[index];
        options = shuffle(chosen, random);
        options.splice(answer, 0, key);
      }
      out.set(qid, {
        qid,
        examKey: exam.key,
        difficulty: ACTUAL_MODE,
        category: exam.title,
        tags: [exam.title],
        prompt: item.q.stem,
        options,
        answer,
        explanation: item.q.distractors
          ? `This is the answer key recorded for question ${item.q.n} of the graded exam. The exam portal showed only the question and its key; the other choices are plausible values of the same kind, written so the item can be practised as multiple choice.`
          : `This is the answer key recorded for question ${item.q.n} of the graded exam. The exam portal showed only the question and its key; the other choices are answer keys from other questions in the class’s graded exams, added so the item can be practised as multiple choice.`,
        source: { type: 'graded-exam', exam: exam.key, title: exam.title, date: exam.date, number: item.q.n },
      });
    });
  }
  return out;
}

// One page's Actual Exam bank: questions renumbered 1..n, a repeated stem and key (the same item reused in a later
// exam) asked once.
function pageBank(list) {
  const kept = [];
  for (const question of list) {
    if (kept.some(other => other.prompt.toLowerCase() === question.prompt.toLowerCase() && other.options[other.answer].toLowerCase() === question.options[question.answer].toLowerCase())) continue;
    kept.push(question);
  }
  return kept.map((question, index) => ({ id: index + 1, ...question }));
}

function summary(exams, questions, draw) {
  return { count: questions.length, attempt: draw ? Math.min(draw, questions.length) : questions.length, exams: exams.map(exam => ({ key: exam.key, title: exam.title, date: exam.date })) };
}

// Everything the build needs: per lesson/module page, per graded exam, and the mixed set.
export function actualExamData(root, lessons) {
  const byKey = new Map(lessons.map(lesson => [lesson.key, lesson]));
  const exams = loadActualExams(root, byKey);
  const questions = buildActualQuestions(exams);
  const ofExam = exam => exam.questions.map(q => questions.get(actualQid(exam, q.n)));
  const pages = new Map();
  for (const lesson of lessons) {
    const sources = exams.filter(exam => exam.pages.includes(lesson.key));
    if (!sources.length) continue;
    const bank = pageBank(sources.flatMap(ofExam));
    // A lesson page serves its whole Actual Exam bank; a module exam page draws at most ACTUAL_DRAW.
    const moduleExam = Boolean(lesson.pool) || (lesson.prominent && lesson.order === 0);
    pages.set(lesson.key, { bank, ...summary(sources, bank, moduleExam ? ACTUAL_DRAW : 0) });
  }
  const perExam = exams.map(exam => {
    const bank = ofExam(exam).map((question, index) => ({ id: index + 1, ...question }));
    return { exam, bank, ...summary([exam], bank, 0) };
  });
  const allBank = pageBank(exams.flatMap(ofExam));
  const all = { bank: allBank, ...summary(exams, allBank, ACTUAL_DRAW), full: allBank.length };
  return { exams, questions, pages, perExam, all };
}

// Mirrors validateActualBank in the quiz engine.
export function validateActualBank(bank, examKeys) {
  if (!Array.isArray(bank)) return ['bank must be an array of questions'];
  const errors = [];
  const seen = new Set();
  bank.forEach((question, index) => {
    const at = `question ${index + 1}: `;
    if (!question || typeof question !== 'object') { errors.push(at + 'question must be an object'); return; }
    if (question.id !== index + 1) errors.push(at + `id must be integer ${index + 1}`);
    if (!EXAM_KEY.test(question.examKey ?? '') || (examKeys && !examKeys.has(question.examKey))) errors.push(at + 'examKey must name a graded exam');
    if (typeof question.qid !== 'string' || !new RegExp(`^${question.examKey}-a-[0-9]{2,4}$`).test(question.qid)) errors.push(at + 'qid must be "<examKey>-a-" followed by 2 to 4 digits');
    if (seen.has(question.qid)) errors.push(at + `qid ${question.qid} is used more than once`);
    seen.add(question.qid);
    if (question.difficulty !== ACTUAL_MODE) errors.push(at + 'difficulty must be actual');
    for (const field of ['category', 'prompt', 'explanation']) if (typeof question[field] !== 'string' || !question[field].trim()) errors.push(at + `${field} must be a nonempty string`);
    if (!Array.isArray(question.tags) || question.tags.some(tag => typeof tag !== 'string' || !tag.trim())) errors.push(at + 'tags must be an array of nonempty strings');
    const options = question.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 4 || options.some(option => typeof option !== 'string' || !option.trim())) errors.push(at + 'options must contain two to four nonempty strings');
    else if (new Set(options.map(option => option.toLowerCase())).size !== options.length) errors.push(at + 'options must be distinct');
    if (!Number.isInteger(question.answer) || !Array.isArray(options) || question.answer < 0 || question.answer >= options.length) errors.push(at + 'answer must index one of the options');
    const source = question.source;
    if (!source || !SOURCE_TYPES.includes(source.type) || source.exam !== question.examKey || typeof source.title !== 'string' || !DATE.test(source.date ?? '') || !Number.isInteger(source.number)) {
      errors.push(at + 'source must be { type: "graded-exam", exam, title, date, number }');
    } else if (question.qid !== `${source.exam}-a-${String(source.number).padStart(2, '0')}`) errors.push(at + 'qid must carry the graded exam question number');
    if (question.sourceSlides !== undefined || question.sourceAlt !== undefined) errors.push(at + 'a graded-exam question cites its exam, not lesson pages');
  });
  return errors;
}
