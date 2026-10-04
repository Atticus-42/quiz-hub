// The quiz engine test suite, run once for every lesson quiz and pool exam (lessons/*/lesson.json).
// Ported from the per-repository verifiers; the lesson's own facts (key, counts, text, art) come from its config.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MODES, ROOT, validateBank, quizTotal, lessonText } from '../build.mjs';
import {
  test, plain, seededRandom, normalize, findAll, isShown, hasClass, parseHtml, appScripts, runPage,
  withEndpoint, fakeFetch, TEST_ENDPOINT, ENDPOINT_PATTERN, stylesheetText, parseCss, REDUCED_MOTION_MEDIA, hasMotion,
  keyEvent, loadCodeGs, FakeStorage, withoutFontPreloads, cssUrls, isLocalAsset,
} from './harness.mjs';

const LETTERS = ['A', 'B', 'C', 'D'];
const MODE_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const BANDS = [[90, 'Mastery'], [75, 'Proficient'], [60, 'Developing'], [0, 'Needs review']];
const bandFor = percent => BANDS.find(([min]) => percent >= min)[1];
const okHistory = rows => ({ body: { ok: true, rows } });
const fireEvent = (node, type) => node.dispatchEvent({ type, target: node, defaultPrevented: false, preventDefault() {} });
const NATIVE_RADIO_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

export async function engineSuite(lesson) {
  const T = (name, run) => test(`[${lesson.key}] ${name}`, run);
  const pagePath = join(ROOT, lesson.slug, 'index.html');
  const builtHtml = readFileSync(pagePath, 'utf8');
  const baseHtml = withEndpoint(builtHtml, '');
  const configuredHtml = withEndpoint(builtHtml, TEST_ENDPOINT);
  const banks = lesson.banks;
  const pool = lesson.rules.pool;
  const ref = lesson.rules.ref;
  const text = lessonText(lesson);
  const count = mode => lesson.counts[mode];
  const KEY_TOTAL = count('medium');
  const hubHref = `../#${lesson.module}`;
  const itemIdOf = (question, mode) => `${pool ? question.lessonKey : lesson.key}:${mode}:${question.qid}`;

  function loadApp(html = baseHtml, options = {}) {
    const page = runPage(html, options);
    const api = page.window.__quiz;
    assert.ok(api, 'the page must expose globalThis.__quiz');
    return { ...page, api };
  }
  const settle = app => app.api.whenSettled();
  function byId(app, id) {
    const node = app.document.getElementById(id);
    assert.ok(node, `the page must contain #${id}`);
    return node;
  }
  function attemptOf(app) {
    const { attempt } = plain(app.api.getState());
    assert.ok(attempt, 'an attempt must be active');
    return attempt;
  }
  const modeButtons = app => MODES.map(mode => byId(app, `mode-${mode}`));
  const radios = app => findAll(byId(app, 'question-area'), node => node.localName === 'input' && node.type === 'radio');
  function enterName(app, name) {
    const input = byId(app, 'student-name');
    input.value = name;
    fireEvent(input, 'input');
    fireEvent(input, 'blur');
  }
  function startConfirmed(app, mode = 'easy', name = 'Juan Dela Cruz') {
    enterName(app, name);
    byId(app, 'study-confirm').click();
    byId(app, `mode-${mode}`).click();
    assert.equal(plain(app.api.getState()).view, 'quiz', `${mode} must start after confirmation`);
  }
  // Answers every remaining question through the real controls; chooseCorrect(index) decides each answer.
  function completeAttemptFrom(app, start, chooseCorrect = () => true) {
    const total = attemptOf(app).questions.length;
    for (let index = start; index < total; index++) {
      const attempt = attemptOf(app);
      assert.equal(attempt.current, index);
      const question = attempt.questions[index];
      const choice = chooseCorrect(index) ? question.answer : (question.answer + 1) % 4;
      radios(app)[choice].click();
      byId(app, 'btn-check').click();
      if (index < total - 1) byId(app, 'btn-next').click();
    }
  }
  const completeAttempt = (app, chooseCorrect) => completeAttemptFrom(app, 0, chooseCorrect);
  function replaceBank(html, mode, content) {
    const pattern = new RegExp(`(<script type="application/json" id="questions-${mode}">)[\\s\\S]*?(</script>)`);
    assert.match(html, pattern);
    return html.replace(pattern, (_, open, close) => `${open}${content}${close}`);
  }
  const press = (app, key, options) => {
    const event = keyEvent(app.document, key, options);
    app.document.dispatchEvent(event);
    return event;
  };
  // Every fifth question (0, 5, 10, ...) answered wrongly: the expected score for an attempt of n questions.
  const everyFifthWrong = index => index % 5 !== 0;
  const scoreEveryFifth = n => n - Math.ceil(n / 5);
  const percentOf = (score, n) => Math.round((score / n) * 100);

  // Checks one pool draw: the right number of distinct questions of the mode, the shares per lesson, content intact.
  function assertBalancedDraw(questions, mode, label) {
    assert.equal(questions.length, pool.count, `${label}: ${pool.count} questions`);
    assert.ok(questions.every(item => item.difficulty === mode), `${label}: mixed difficulties`);
    assert.equal(new Set(questions.map(item => item.id)).size, pool.count, `${label}: no duplicate questions`);
    const counts = pool.lessons.map(source => questions.filter(item => item.lessonKey === source.key).length);
    assert.deepEqual([...counts].sort((a, b) => a - b), plain(lesson.poolQuotas).sort((a, b) => a - b), `${label}: lesson counts ${counts.join('/')}`);
    assert.deepEqual(questions, questions.map(item => banks[mode].find(source => source.id === item.id)), `${label}: authored question and choice order must be preserved`);
    return counts;
  }

  await T('the built page exposes the quiz engine through globalThis.__quiz and opens on the landing view', () => {
    const { api } = loadApp();
    for (const name of ['validateBanks', 'shuffleQuestions', 'sampleQuestions', 'createAttempt', 'createPracticeAttempt', 'itemId', 'setStudyConfirmed', 'startQuiz', 'selectAnswer', 'checkAnswer', 'goToQuestion', 'finishQuiz', 'retakeQuiz', 'retryMissed', 'resetToDifficulty', 'masteryBand', 'getState', 'getBanks', 'setRandom']) {
      assert.equal(typeof api[name], 'function', `${name} must be exposed`);
    }
    assert.equal(api.lessonKey, lesson.key);
    const state = plain(api.getState());
    assert.equal(state.available, true, state.errors.join('; '));
    assert.equal(state.view, 'landing');
    assert.equal(builtHtml.match(/<title>([^<]*)<\/title>/)[1], lesson.title);
    assert.match(builtHtml, new RegExp(`<h1>${lesson.title}</h1>`));
  });

  await T('study warning shows the exact confirmation text and all mode buttons start disabled; mode buttons state the attempt length', () => {
    const app = loadApp();
    const checkbox = byId(app, 'study-confirm');
    assert.equal(checkbox.localName, 'input');
    assert.equal(checkbox.type, 'checkbox');
    assert.equal(checkbox.checked, false);
    const label = findAll(app.document.root, node => node.localName === 'label' && (node.htmlFor === 'study-confirm' || node.children.includes(checkbox)))[0];
    assert.ok(label, 'the checkbox must have a label');
    assert.equal(label.textContent.replace(/\s+/g, ' ').trim(), text.studyConfirm);
    const warning = byId(app, 'study-warning').textContent.replace(/\s+/g, ' ');
    assert.ok(warning.includes(text.studyWarningLead) && warning.includes(text.studyWarningBody), 'the warning text comes from the lesson');
    if (pool) for (const source of pool.lessons) assert.ok(warning.includes(source.name), `the warning names ${source.name}`);
    else assert.ok(warning.includes(`complete ${lesson.lessonName} lesson`), 'the warning names the lesson');
    assert.ok(isShown(byId(app, 'view-landing')));
    for (const mode of MODES) {
      const button = byId(app, `mode-${mode}`);
      assert.equal(button.localName, 'button');
      assert.equal(button.disabled, true, `${button.id} must start disabled`);
      assert.match(button.textContent, new RegExp(`\\b${count(mode)} questions\\b`), `${button.id} states its attempt length`);
    }
    assert.ok(builtHtml.includes(`${quizTotal(lesson)} situational questions`) || pool, 'the lede counts the questions');
  });

  await T('mode buttons need both a valid name and the study confirmation; unchecking disables them again', () => {
    const app = loadApp();
    const checkbox = byId(app, 'study-confirm');
    byId(app, 'mode-easy').click();
    assert.equal(plain(app.api.getState()).view, 'landing', 'a disabled button must not start the quiz');
    assert.equal(app.api.startQuiz('easy'), false, 'startQuiz must refuse before confirmation');
    assert.equal(isShown(byId(app, 'view-quiz')), false);
    checkbox.click();
    assert.equal(plain(app.api.getState()).studyConfirmed, true);
    for (const button of modeButtons(app)) assert.equal(button.disabled, true, `${button.id} stays disabled without a name`);
    assert.equal(app.api.startQuiz('easy'), false, 'startQuiz must refuse without a name');
    assert.match(byId(app, 'mode-hint').textContent, /enter your name/i);
    enterName(app, 'Juan Dela Cruz');
    for (const button of modeButtons(app)) assert.equal(button.disabled, false, `${button.id} must enable`);
    checkbox.click();
    assert.equal(plain(app.api.getState()).studyConfirmed, false);
    for (const button of modeButtons(app)) assert.equal(button.disabled, true, `${button.id} must disable again`);
    assert.equal(app.api.startQuiz('medium'), false);
    app.api.setStudyConfirmed(true);
    assert.equal(checkbox.checked, true, 'setStudyConfirmed keeps the checkbox in sync');
    for (const button of modeButtons(app)) assert.equal(button.disabled, false);
    app.api.setStudyConfirmed(false);
    assert.equal(checkbox.checked, false);
    for (const button of modeButtons(app)) assert.equal(button.disabled, true);
  });

  await T(pool ? `each difficulty serves ${pool.count} questions of its own pool, balanced ${plain(lesson.poolQuotas).join('/')} across the source lessons` : 'each difficulty asks every question of its own bank, and only those', () => {
    for (const mode of MODES) {
      const app = loadApp();
      startConfirmed(app, mode);
      const attempt = attemptOf(app);
      assert.equal(attempt.mode, mode);
      assert.equal(attempt.practice, false);
      if (pool) {
        assertBalancedDraw(attempt.questions, mode, mode);
      } else {
        assert.equal(attempt.questions.length, count(mode));
        assert.ok(attempt.questions.every(item => item.difficulty === mode), `${mode} attempt mixed difficulties`);
        assert.deepEqual(attempt.questions.map(item => item.id).sort((a, b) => a - b), Array.from({ length: count(mode) }, (_, index) => index + 1));
        assert.deepEqual(attempt.questions, attempt.questions.map(item => banks[mode].find(source => source.id === item.id)), 'authored question and choice order must be preserved');
      }
      assert.equal(attempt.responses.length, count(mode));
      assert.equal(byId(app, 'quiz-progress').getAttribute('max'), String(count(mode)));
      assert.match(byId(app, 'quiz-status').textContent, new RegExp(`Question 1 of ${count(mode)}\\. 0 of ${count(mode)} answers checked`));
      assert.equal(byId(app, 'question-prompt').textContent, attempt.questions[0].prompt);
      assert.equal(byId(app, 'question-category').textContent, `${text.topicNoun}: ${attempt.questions[0].category}`);
    }
  });

  await T('starting a quiz renders the first question as a fieldset with four radio choices and moves focus to it', () => {
    const app = loadApp();
    startConfirmed(app, 'hard');
    const attempt = attemptOf(app);
    assert.ok(isShown(byId(app, 'view-quiz')));
    assert.equal(isShown(byId(app, 'view-landing')), false);
    assert.equal(app.document.activeElement?.id, 'question-heading');
    assert.equal(byId(app, 'question-heading').textContent, `Question 1 of ${count('hard')}`);
    assert.equal(isShown(byId(app, 'quiz-practice-note')), false, 'a full attempt is not labelled as practice');
    const legend = byId(app, 'question-prompt');
    assert.equal(legend.localName, 'legend');
    assert.equal(legend.parentNode.localName, 'fieldset');
    const choices = radios(app);
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices.map(choice => choice.name)).size, 1);
    choices.forEach((choice, index) => {
      const label = findAll(app.document.root, node => node.localName === 'label' && (node.htmlFor === choice.id || node.children.includes(choice)))[0];
      assert.ok(label, `choice ${index} must be labelled`);
      assert.ok(label.textContent.includes(attempt.questions[0].options[index]));
      assert.ok(label.textContent.includes(`${LETTERS[index]}.`));
    });
    const status = byId(app, 'quiz-status');
    assert.ok(status.getAttribute('role') === 'status' || status.getAttribute('aria-live'), 'quiz status must be a live region');
    assert.equal(byId(app, 'quiz-progress').localName, 'progress');
  });

  await T('Fisher-Yates shuffle matches a hand-checked order and copies the source; createAttempt uses the injected random', () => {
    const { api } = loadApp();
    const source = ['a', 'b', 'c', 'd', 'e'];
    const draws = [0.1, 0.9, 0.5, 0.0];
    // i=4: j=0 -> e b c d a; i=3: j=3 -> unchanged; i=2: j=1 -> e c b d a; i=1: j=0 -> c e b d a
    const shuffled = api.shuffleQuestions(source, () => draws.shift());
    assert.deepEqual(plain(shuffled), ['c', 'e', 'b', 'd', 'a']);
    assert.deepEqual(source, ['a', 'b', 'c', 'd', 'e'], 'source must not be mutated');
    assert.notEqual(shuffled, source);
    assert.equal(draws.length, 0, 'exactly n-1 random draws');
    assert.deepEqual([...plain(api.shuffleQuestions(source))].sort(), source);
    const attempt = plain(api.createAttempt('medium', banks, seededRandom(3)));
    assert.equal(attempt.mode, 'medium');
    const expected = pool ? api.sampleQuestions(banks.medium, seededRandom(3)) : api.shuffleQuestions(banks.medium, seededRandom(3));
    assert.deepEqual(attempt.questions, plain(expected));
    if (pool) assert.notDeepEqual(attempt.questions, plain(api.sampleQuestions(banks.medium, seededRandom(4))), 'a different random draws a different attempt');
    assert.equal(attempt.current, 0);
    assert.ok(attempt.responses.length === count('medium') && attempt.responses.every(response => response.selected === null && response.checked === false));
  });

  await T('source banks stay unchanged while three retakes each reshuffle (or redraw) the same difficulty', () => {
    const app = loadApp();
    const snapshot = JSON.stringify(app.api.getBanks());
    assert.equal(snapshot, JSON.stringify(banks));
    app.api.setRandom(seededRandom(7));
    startConfirmed(app, 'medium');
    let previousOrder = attemptOf(app).questions.map(item => item.id);
    for (let retake = 1; retake <= 3; retake++) {
      completeAttempt(app);
      byId(app, 'btn-finish').click();
      assert.equal(plain(app.api.getState()).view, 'results');
      byId(app, 'btn-retake').click();
      const attempt = attemptOf(app);
      assert.equal(attempt.mode, 'medium', `retake ${retake} keeps the difficulty`);
      assert.ok(attempt.responses.every(response => response.selected === null && !response.checked), `retake ${retake} starts clean`);
      const order = attempt.questions.map(item => item.id);
      assert.notDeepEqual(order, previousOrder, `retake ${retake} must reshuffle`);
      if (pool) {
        assert.notDeepEqual([...order].sort((a, b) => a - b), [...previousOrder].sort((a, b) => a - b), `retake ${retake} must draw a different selection`);
        assertBalancedDraw(attempt.questions, 'medium', `retake ${retake}`);
      }
      assert.equal(JSON.stringify(app.api.getBanks()), snapshot, `source banks changed after retake ${retake}`);
      assert.equal(app.document.activeElement?.id, 'question-heading');
      previousOrder = order;
    }
  });

  await T('question order and recorded answers stay stable during navigation', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    const order = attemptOf(app).questions.map(item => item.id);
    for (let index = 0; index < 5; index++) {
      radios(app)[index % 4].click();
      byId(app, 'btn-check').click();
      byId(app, 'btn-next').click();
    }
    assert.equal(attemptOf(app).current, 5);
    assert.equal(app.api.goToQuestion(7), false, 'cannot skip past the first unchecked question');
    assert.equal(app.api.goToQuestion(-1), false);
    assert.equal(app.api.goToQuestion(1), true);
    assert.equal(app.document.activeElement?.id, 'question-heading');
    assert.equal(radios(app)[1].checked, true, 'recorded answer shows on revisit');
    assert.ok(radios(app).every(choice => choice.disabled), 'revisited checked question stays locked');
    assert.ok(isShown(byId(app, 'answer-feedback')), 'feedback stays reviewable');
    byId(app, 'btn-prev').click();
    assert.equal(attemptOf(app).current, 0);
    assert.equal(isShown(byId(app, 'btn-prev')), false, 'no previous button on question 1');
    assert.equal(app.api.goToQuestion(5), true);
    const attempt = attemptOf(app);
    assert.deepEqual(attempt.questions.map(item => item.id), order);
    assert.deepEqual(attempt.responses.slice(0, 5).map(response => [response.selected, response.checked]), [[0, true], [1, true], [2, true], [3, true], [0, true]]);
    assert.deepEqual([attempt.responses[5].selected, attempt.responses[5].checked], [null, false]);
  });

  await T('Check answer with no selection shows a validation message and does not advance', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    const validation = byId(app, 'validation-message');
    assert.equal(isShown(validation), false);
    byId(app, 'btn-check').click();
    assert.equal(app.api.checkAnswer(), false);
    const attempt = attemptOf(app);
    assert.equal(attempt.current, 0);
    assert.equal(attempt.responses[0].checked, false);
    assert.ok(isShown(validation));
    assert.match(validation.textContent, /select an answer/i);
    assert.ok(validation.getAttribute('role') === 'alert' || validation.getAttribute('aria-live'));
    assert.equal(app.document.activeElement?.id, 'validation-message');
    assert.equal(isShown(byId(app, 'btn-next')), false);
    assert.equal(isShown(byId(app, 'answer-feedback')), false);
    radios(app)[2].click();
    assert.equal(isShown(validation), false, 'selecting clears the validation message');
  });

  await T('checked answers lock and cannot be changed', () => {
    const app = loadApp();
    startConfirmed(app, 'hard');
    const question = attemptOf(app).questions[0];
    const wrong = (question.answer + 1) % 4;
    radios(app)[wrong].click();
    assert.equal(app.api.checkAnswer(), true);
    assert.equal(app.api.selectAnswer(question.answer), false);
    radios(app)[question.answer].click();
    assert.equal(app.api.checkAnswer(), false, 'a checked answer cannot be checked again');
    const response = attemptOf(app).responses[0];
    assert.deepEqual([response.selected, response.checked], [wrong, true]);
    assert.ok(radios(app).every(choice => choice.disabled));
    assert.equal(radios(app)[wrong].checked, true);
    assert.equal(isShown(byId(app, 'btn-check')), false);
  });

  await T('checking reveals the correct answer, the explanation and the lesson reference, and focuses the feedback', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    const [first, second] = attemptOf(app).questions;
    const wrong = (first.answer + 3) % 4;
    radios(app)[wrong].click();
    byId(app, 'btn-check').click();
    const feedback = byId(app, 'answer-feedback');
    assert.ok(isShown(feedback));
    assert.equal(app.document.activeElement?.id, 'answer-feedback');
    const feedbackText = feedback.textContent;
    assert.match(feedbackText, /Incorrect/);
    assert.ok(feedbackText.includes(`Correct answer: ${LETTERS[first.answer]}. ${first.options[first.answer]}`), feedbackText);
    assert.ok(feedbackText.includes(`Your answer: ${LETTERS[wrong]}. ${first.options[wrong]}`), feedbackText);
    assert.ok(feedbackText.includes(first.explanation));
    const refs = findAll(feedback, node => hasClass(node, 'source-ref')).map(node => node.textContent);
    if (ref && Array.isArray(first.sourceSlides)) assert.deepEqual(refs, [`Lesson reference: ${ref.label} ${first.sourceSlides.join(', ')}`]);
    else assert.deepEqual(refs, [], 'no reference line without sourceSlides');
    assert.doesNotMatch(feedbackText, /undefined/);
    const labels = findAll(byId(app, 'question-area'), node => node.localName === 'label');
    assert.ok(labels[first.answer].classList.contains('option-correct'));
    assert.ok(labels[wrong].classList.contains('option-incorrect'));
    assert.match(labels[first.answer].textContent, /Correct answer/, 'correctness is not conveyed by color alone');
    assert.equal(plain(app.api.getState()).attempt.current, 0, 'checking does not advance by itself');
    byId(app, 'btn-next').click();
    radios(app)[second.answer].click();
    byId(app, 'btn-check').click();
    assert.match(byId(app, 'answer-feedback').textContent, /^\s*Correct\./);
    assert.ok(byId(app, 'answer-feedback').textContent.includes(second.explanation));
  });

  await T('validateBanks accepts the embedded banks and mirrors the build validator error-for-error', () => {
    const { api } = loadApp();
    assert.deepEqual(plain(api.validateBanks(banks)), { valid: true, errors: [] });
    const easy = banks.easy;
    const base = easy[0];
    const without = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));
    const mutations = [
      { ...base, id: 1.5 },
      { ...base, difficulty: 'hard' },
      { ...base, options: base.options.slice(0, 3) },
      { ...base, answer: 4 },
      { ...base, tags: [''] },
      { ...base, prompt: '  ' },
      { ...base, category: 7 },
      { ...base, explanation: undefined },
      { ...base, qid: 'x' },
      { ...base, qid: base.qid.replace(/-e-/, '-m-') },
      { ...base, qid: `${base.qid}12345` },
      without(base, 'qid'),
      null,
      [],
    ];
    if (pool) {
      mutations.push({ ...base, sourceSlides: [12] }, { ...base, lessonKey: 'gunnery' }, { ...base, lesson: 'Gunnery' }, { ...base, category: pool.lessons[1].name }, without(base, 'lesson'));
    } else {
      mutations.push({ ...base, category: 'Not a lesson topic' }, { ...base, sourceSlides: [ref.min - 1] }, { ...base, sourceSlides: [ref.max + 1] }, { ...base, sourceSlides: [] }, { ...base, sourceSlides: null }, { ...base, sourceSlides: [String(ref.min)] });
      if (ref.required) mutations.push(without(base, 'sourceSlides'));
    }
    for (const mutated of mutations) {
      const bank = [mutated, ...easy.slice(1)];
      const result = plain(api.validateBanks({ ...banks, easy: bank }));
      assert.equal(result.valid, false, JSON.stringify(mutated)?.slice(0, 80));
      assert.deepEqual(result.errors, validateBank(bank, 'easy', lesson.rules).map(error => `easy ${error}`));
    }
    if (!pool && !ref.required) {
      for (const accepted of [{ ...base, sourceSlides: [ref.min] }, without(base, 'sourceSlides')]) {
        assert.deepEqual(plain(api.validateBanks({ ...banks, easy: [accepted, ...easy.slice(1)] })), { valid: true, errors: [] }, 'an optional reference may be present or absent');
      }
    }
    const duplicate = [easy[0], { ...easy[1], qid: easy[0].qid }, ...easy.slice(2)];
    const dup = plain(api.validateBanks({ ...banks, easy: duplicate }));
    assert.deepEqual(dup.errors, [`easy question 2: qid ${easy[0].qid} is used more than once`]);
    assert.deepEqual(dup.errors, validateBank(duplicate, 'easy', lesson.rules).map(error => `easy ${error}`));
    const empty = plain(api.validateBanks({ ...banks, medium: [] }));
    assert.equal(empty.valid, false);
    assert.ok(empty.errors.includes('medium bank must contain at least 1 question'), empty.errors.join('; '));
    if (pool) {
      const relabelled = easy.map((item, index) => (index === easy.findIndex(question => question.lessonKey === pool.lessons[1].key) ? { ...item, lessonKey: pool.lessons[0].key, lesson: pool.lessons[0].name, category: pool.lessons[0].name, qid: item.qid.replace(/^[a-z0-9]+-/, `${pool.lessons[0].key}-`) } : item));
      const lopsided = plain(api.validateBanks({ ...banks, easy: relabelled }));
      assert.deepEqual(lopsided.errors, validateBank(relabelled, 'easy', lesson.rules).map(error => `easy ${error}`));
      const thin = easy.filter(item => item.lessonKey !== pool.lessons[2].key || Number(item.qid.slice(-2)) <= lesson.poolQuotas[0] - 1).map((item, index) => ({ ...item, id: index + 1 }));
      const short = plain(api.validateBanks({ ...banks, easy: thin }));
      assert.ok(short.errors.some(error => error.includes(`at least ${lesson.poolQuotas[0]} ${pool.lessons[2].name} questions`)), short.errors.join('; '));
    } else {
      const big = Array.from({ length: 501 }, (_, index) => ({ ...easy[index % easy.length], id: index + 1, qid: `${lesson.key}-e-${String(index + 1).padStart(3, '0')}` }));
      const tooBig = plain(api.validateBanks({ ...banks, easy: big }));
      assert.deepEqual(tooBig.errors, ['easy bank must contain at most 500 questions (found 501)']);
    }
    const missing = plain(api.validateBanks({ easy: banks.easy, medium: banks.medium }));
    assert.deepEqual(missing.errors, ['hard bank must be an array of questions']);
  });

  await T('malformed or missing startup data shows the unavailable state and blocks every quiz start', () => {
    const brokenAnswer = plain(banks.hard);
    brokenAnswer[3].answer = 4;
    const variants = {
      'unparseable Easy JSON': replaceBank(baseHtml, 'easy', '{not json'),
      'empty Medium bank': replaceBank(baseHtml, 'medium', '[]'),
      'Hard answer index out of range': replaceBank(baseHtml, 'hard', JSON.stringify(brokenAnswer)),
      'missing Easy bank element': baseHtml.replace(/<script type="application\/json" id="questions-easy">[\s\S]*?<\/script>/, ''),
      'broken lesson configuration': baseHtml.replace(/(<script type="application\/json" id="quiz-config">)[\s\S]*?(<\/script>)/, '$1{"key":1}$2'),
    };
    for (const [name, html] of Object.entries(variants)) {
      const app = loadApp(html);
      const state = plain(app.api.getState());
      assert.equal(state.available, false, name);
      assert.ok(state.errors.length > 0, `${name}: errors must be recorded`);
      assert.ok(isShown(byId(app, 'view-unavailable')), `${name}: unavailable view must show`);
      assert.match(byId(app, 'view-unavailable').textContent, /unavailable/i);
      assert.equal(isShown(byId(app, 'view-landing')), false, `${name}: landing must hide`);
      assert.equal(app.document.activeElement?.id, 'unavailable-heading', `${name}: focus must move to the unavailable heading`);
      assert.equal(byId(app, 'study-confirm').disabled, true, name);
      assert.equal(byId(app, 'student-name').disabled, true, `${name}: the name field is disabled too`);
      assert.equal(app.api.setStudentName('Juan Dela Cruz'), false, name);
      app.api.setStudyConfirmed(true);
      byId(app, 'study-confirm').click();
      for (const button of modeButtons(app)) assert.equal(button.disabled, true, `${name}: ${button.id}`);
      for (const mode of MODES) assert.equal(app.api.startQuiz(mode), false, `${name}: ${mode}`);
      assert.equal(isShown(byId(app, 'view-quiz')), false, name);
      assert.equal(plain(app.api.getState()).attempt, null, name);
      assert.ok(app.consoleErrors.some(line => line.startsWith(name === 'broken lesson configuration' ? 'Quiz is unavailable' : `${lesson.title} is unavailable`)), `${name}: the console explains why`);
    }
    assert.equal(isShown(byId(loadApp(), 'view-unavailable')), false, 'valid data must not show the unavailable state');
  });

  await T('mastery bands use the documented 90/75/60 thresholds and the lesson’s band descriptions', () => {
    const { api } = loadApp();
    const cases = [[100, 'Mastery'], [90, 'Mastery'], [89, 'Proficient'], [75, 'Proficient'], [74, 'Developing'], [60, 'Developing'], [59, 'Needs review'], [0, 'Needs review']];
    for (const [percentage, band] of cases) assert.equal(api.masteryBand(percentage).name, band, `${percentage}%`);
    assert.deepEqual([100, 80, 65, 10].map(percentage => api.masteryBand(percentage).description), text.bands);
  });

  await T('all checked answers produce scored results with topic analysis, full review and actions', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    assert.equal(app.api.finishQuiz(), false, 'results are unavailable before every item is checked');
    assert.equal(isShown(byId(app, 'view-results')), false);
    completeAttempt(app, everyFifthWrong);
    const attempt = attemptOf(app);
    const n = attempt.questions.length;
    const score = scoreEveryFifth(n);
    assert.ok(isShown(byId(app, 'btn-finish')));
    byId(app, 'btn-finish').click();
    assert.ok(isShown(byId(app, 'view-results')));
    assert.equal(isShown(byId(app, 'view-quiz')), false);
    assert.equal(app.document.activeElement?.id, 'results-heading');
    assert.equal(byId(app, 'results-heading').textContent, 'Easy examination results');
    assert.equal(isShown(byId(app, 'results-practice-note')), false);
    const summary = byId(app, 'results-summary').textContent;
    assert.ok(summary.includes(`${score} of ${n} correct`), summary);
    assert.ok(summary.includes(`${percentOf(score, n)}%`));
    assert.ok(summary.includes(bandFor(percentOf(score, n))));
    const expected = new Map();
    attempt.questions.forEach((item, index) => {
      const entry = expected.get(item.category) ?? { correct: 0, total: 0 };
      entry.total++;
      if (everyFifthWrong(index)) entry.correct++;
      expected.set(item.category, entry);
    });
    const rows = findAll(byId(app, 'results-categories-body'), node => node.localName === 'tr');
    assert.equal(rows.length, expected.size);
    const order = lesson.rules.categoryOrder.filter(name => expected.has(name));
    assert.deepEqual(rows.map(row => row.children[0].textContent.trim()), order, 'rows follow the lesson topic order');
    for (const row of rows) {
      const [category, countText, status] = row.children.map(cell => cell.textContent.trim());
      const entry = expected.get(category);
      assert.ok(entry, `unexpected category row ${category}`);
      assert.ok(countText.startsWith(`${entry.correct} of ${entry.total}`), `${category}: ${countText}`);
      assert.equal(status, entry.correct / entry.total >= 0.75 ? 'Strength' : 'Gap');
    }
    const strengths = findAll(byId(app, 'results-strengths'), node => node.localName === 'li').map(node => node.textContent);
    const gaps = findAll(byId(app, 'results-gaps'), node => node.localName === 'li').map(node => node.textContent);
    for (const [category, entry] of expected) {
      const list = entry.correct / entry.total >= 0.75 ? strengths : gaps;
      assert.equal(list.filter(item => item.startsWith(`${category}: `)).length, 1, `${category} must be listed once in the right list`);
    }
    const reviewItems = byId(app, 'results-review').children;
    assert.equal(reviewItems.length, n);
    reviewItems.forEach((item, index) => {
      const question = attempt.questions[index];
      const selected = attempt.responses[index].selected;
      const reviewText = item.textContent;
      assert.ok(reviewText.includes(question.prompt), `review ${index + 1} prompt`);
      assert.ok(reviewText.includes(`${text.topicNoun}: ${question.category}`), `review ${index + 1} topic`);
      assert.ok(reviewText.includes(`Your answer: ${LETTERS[selected]}. ${question.options[selected]}`), `review ${index + 1} answer`);
      assert.ok(reviewText.includes(`Correct answer: ${LETTERS[question.answer]}. ${question.options[question.answer]}`), `review ${index + 1} key`);
      assert.ok(reviewText.includes(question.explanation), `review ${index + 1} explanation`);
      assert.match(reviewText, everyFifthWrong(index) ? /Correct/ : /Incorrect/);
    });
    byId(app, 'btn-print').click();
    assert.equal(app.printCalls.length, 1, 'print/save calls window.print');
    byId(app, 'btn-choose').click();
    assert.ok(isShown(byId(app, 'view-landing')));
    assert.equal(isShown(byId(app, 'view-results')), false);
    assert.equal(plain(app.api.getState()).attempt, null);
    assert.equal(app.document.activeElement?.id, 'difficulty-heading');
    for (const button of modeButtons(app)) assert.equal(button.disabled, false, 'confirmation carries over to difficulty choice');
    byId(app, 'mode-hard').click();
    assert.equal(attemptOf(app).mode, 'hard');
  });

  await T('the lesson wording appears on the results page (topic heading, caption, column, gaps, reminder, empty lists)', () => {
    const app = loadApp();
    startConfirmed(app, 'medium');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    assert.equal(byId(app, 'topics-heading').textContent, text.topicsHeading);
    const table = byId(app, 'results-categories');
    assert.equal(findAll(table, node => node.localName === 'caption')[0].textContent, text.topicsCaption);
    assert.equal(findAll(table, node => node.localName === 'th')[0].textContent, text.topicNoun);
    assert.ok(byId(app, 'view-results').textContent.includes(text.gapsHeading));
    assert.ok(byId(app, 'view-results').textContent.includes(text.resultsReminder));
    assert.deepEqual(findAll(byId(app, 'results-gaps'), node => node.localName === 'li').map(node => node.textContent), [text.gapsEmpty]);
    const lost = loadApp();
    startConfirmed(lost, 'medium');
    completeAttempt(lost, () => false);
    byId(lost, 'btn-finish').click();
    assert.deepEqual(findAll(byId(lost, 'results-strengths'), node => node.localName === 'li').map(node => node.textContent), [text.strengthsEmpty]);
  });

  await T('the app keeps answers in memory only: its one network call goes to HISTORY_ENDPOINT, with no storage, cookies or HTML parsing', () => {
    const document = parseHtml(builtHtml);
    const code = appScripts(document).map(script => script.textContent).join('\n');
    assert.ok(code.length > 0, 'the page must contain the app script');
    assert.equal(code.match(/\bfetch\s*\(/g)?.length, 1, 'exactly one fetch call site');
    assert.match(code, /function historyRequest\(url, init\) \{\s*if \(!ENDPOINT \|\| url\.indexOf\(ENDPOINT\) !== 0\) return Promise\.reject/, 'the fetch wrapper must refuse any URL outside HISTORY_ENDPOINT');
    assert.doesNotMatch(code, /XMLHttpRequest|WebSocket|EventSource|sendBeacon|sessionStorage|indexedDB|document\.cookie|serviceWorker|\bimport\s*\(|new Audio\b/);
    assert.equal(code.match(/localStorage/g)?.length, 1, 'device storage is reached in exactly one place');
    assert.match(code, /function deviceStorage\(\) \{\s*try \{\s*var storage = window\.localStorage;/, 'that place is guarded by try/catch');
    const storageCalls = code.match(/storage\.(?:getItem|setItem|removeItem)\(/g) ?? [];
    assert.equal(storageCalls.length, 3, 'one read, one write, one removal');
    assert.doesNotMatch(code, /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/, 'remote strings must never be parsed as HTML');
    assert.doesNotMatch(code, /\breplaceChildren\b/, 'the app avoids the Safari 14+ replaceChildren API');
    assert.equal(builtHtml.split('var HISTORY_ENDPOINT =').length - 1, 1, 'HISTORY_ENDPOINT is declared exactly once');
    const endpoint = builtHtml.match(ENDPOINT_PATTERN)[1];
    assert.ok(endpoint === '' || /^https:\/\/[^\s'"<>\\]+$/.test(endpoint), 'HISTORY_ENDPOINT must be empty or an https URL');
    // The self-hosted font preloads are same-origin assets too (checked in the design suite).
    const withoutAssetImages = withoutFontPreloads(builtHtml).replace(/<(?:img|source)\b[^>]*>/gi, tag => {
      const urls = [...tag.matchAll(/\b(?:src|srcset)="([^"]*)"/gi)].flatMap(m => m[1].split(',').map(u => u.trim().split(/\s+/)[0]));
      return urls.length && urls.every(u => /^\.\.\/assets\/[\w.-]+\.jpg$/.test(u)) ? '' : tag;
    });
    assert.doesNotMatch(withoutAssetImages, /<link\b|<img\b|<source\b|<iframe\b|<audio\b|\bsrc\s*=|\bsrcset\s*=|@import|url\(\s*['"]?(?:https?:)?\/\//i, 'only same-origin ../assets/ images are allowed');
    assert.doesNotMatch(builtHtml, /\.(?:mp3|wav|ogg|m4a)\b/i, 'sounds are synthesised, never loaded');
  });

  await T('names are trimmed, 2-40 characters, need a letter or number, and invalid names are rejected with a visible message', () => {
    const { api } = loadApp();
    const valid = (raw, name) => {
      const result = plain(api.validateName(raw));
      assert.equal(result.valid, true, `${JSON.stringify(raw)} should be valid: ${result.message}`);
      assert.equal(result.name, name);
    };
    const invalid = (raw, pattern) => {
      const result = plain(api.validateName(raw));
      assert.equal(result.valid, false, `${JSON.stringify(raw)} should be rejected`);
      assert.equal(result.name, '');
      assert.match(result.message, pattern);
    };
    valid('  Ana  ', 'Ana');
    valid('Pvt.  Juan\tDela Cruz', 'Pvt. Juan Dela Cruz');
    valid('A\u0000B', 'A B');
    valid('x'.repeat(40), 'x'.repeat(40));
    valid('=Cruz', 'Cruz');
    valid('Ñiño', 'Ñiño');
    invalid('', /enter your name/i);
    invalid('   ', /enter your name/i);
    invalid('J', /at least 2/);
    invalid(' J\u0007 ', /at least 2/);
    invalid('x'.repeat(41), /40 characters or fewer/);
    invalid('...', /letter or number/);
    invalid(null, /enter your name/i);
    const app = loadApp();
    const input = byId(app, 'student-name');
    const label = findAll(app.document.root, node => node.localName === 'label' && node.htmlFor === 'student-name')[0];
    assert.ok(label && /name/i.test(label.textContent), 'the name field has a visible label');
    const message = byId(app, 'student-name-message');
    assert.equal(isShown(message), false, 'no error before the student types');
    byId(app, 'study-confirm').click();
    enterName(app, 'J');
    assert.ok(isShown(message));
    assert.match(message.textContent, /at least 2/);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.ok((input.getAttribute('aria-describedby') ?? '').includes('student-name-message'));
    for (const button of modeButtons(app)) assert.equal(button.disabled, true, 'invalid names keep the modes locked');
    assert.equal(app.api.startQuiz('easy'), false);
    enterName(app, '   ');
    assert.match(message.textContent, /enter your name/i, 'leaving the field empty explains what is needed');
    enterName(app, '  Maria Santos ');
    assert.equal(isShown(message), false);
    assert.equal(input.getAttribute('aria-invalid'), 'false');
    for (const button of modeButtons(app)) assert.equal(button.disabled, false);
    assert.equal(plain(app.api.getState()).studentName, 'Maria Santos');
    byId(app, 'mode-medium').click();
    assert.match(byId(app, 'quiz-student').textContent, /Maria Santos/, 'the name shows on the quiz screen');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    assert.match(byId(app, 'results-summary').textContent, /Maria Santos/, 'the name shows on the results screen');
  });

  await T('finishing an attempt submits exactly one record: the summary, the actual total, and the asked/missed question ids, never the answers', async () => {
    const fetch = fakeFetch(call => (call.method === 'POST' ? { body: { ok: true } } : okHistory([])));
    const app = loadApp(configuredHtml, { fetch });
    await settle(app);
    startConfirmed(app, 'easy', 'Maria Santos');
    completeAttempt(app, everyFifthWrong);
    const attempt = attemptOf(app);
    const n = attempt.questions.length;
    assert.equal(fetch.calls.filter(call => call.method === 'POST').length, 0, 'nothing is sent before the attempt finishes');
    const before = Date.now();
    byId(app, 'btn-finish').click();
    assert.ok(isShown(byId(app, 'view-results')), 'results show without waiting for the network');
    await settle(app);
    const posts = fetch.calls.filter(call => call.method === 'POST');
    assert.equal(posts.length, 1, 'one submission per finished attempt');
    const [post] = posts;
    assert.equal(post.url, TEST_ENDPOINT);
    assert.equal(post.headers['Content-Type'], 'text/plain;charset=utf-8', 'text/plain avoids a CORS preflight');
    const payload = JSON.parse(post.body);
    assert.deepEqual(Object.keys(payload).sort(), ['asked', 'band', 'finishedAt', 'lesson', 'missed', 'mode', 'name', 'percent', 'score', 'total']);
    const score = scoreEveryFifth(n);
    assert.deepEqual({ ...payload, finishedAt: undefined, asked: undefined, missed: undefined }, { lesson: lesson.key, name: 'Maria Santos', mode: 'easy', score, total: n, percent: percentOf(score, n), band: bandFor(percentOf(score, n)), finishedAt: undefined, asked: undefined, missed: undefined });
    assert.equal(n, count('easy'), 'the total is the actual number of questions');
    assert.deepEqual(payload.asked, attempt.questions.map(question => itemIdOf(question, 'easy')), 'asked lists every question, in the order asked');
    assert.deepEqual(payload.missed, attempt.questions.filter((_, index) => !everyFifthWrong(index)).map(question => itemIdOf(question, 'easy')));
    assert.ok(payload.asked.every(id => /^[a-z][a-z0-9]{1,23}:easy:[a-z][a-z0-9]{1,23}-e-[0-9]{2,4}$/.test(id)), 'ids are <lessonKey>:<mode>:<qid>');
    if (pool) assert.ok(payload.asked.every(id => pool.lessons.some(source => id.startsWith(`${source.key}:`))), 'a pool exam reports the source lesson ids');
    assert.doesNotMatch(post.body, /"selected"|"responses"|"answer"/, 'the chosen answers are never sent');
    assert.match(payload.finishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Date.parse(payload.finishedAt) >= before - 1000 && Date.parse(payload.finishedAt) <= Date.now() + 1000);
    for (const call of fetch.calls) {
      assert.ok(call.url.startsWith(TEST_ENDPOINT), `request to ${call.url} is outside HISTORY_ENDPOINT`);
      assert.ok(!call.url.includes('Maria'), 'names never travel in URLs');
    }
    const gets = fetch.calls.filter(call => call.method === 'GET');
    assert.ok(gets.length >= 2, 'history loads at start and refreshes after saving');
    assert.equal(gets[0].url, `${TEST_ENDPOINT}?lesson=${lesson.key}&mode=all&limit=100`);
    assert.match(byId(app, 'history-save-message').textContent, /Saved to the class history/);
    assert.equal(isShown(byId(app, 'btn-history-retry')), false);
    byId(app, 'btn-retake').click();
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    await settle(app);
    const second = JSON.parse(fetch.calls.filter(call => call.method === 'POST')[1].body);
    assert.deepEqual(second.missed, [], 'a perfect attempt misses nothing');
    assert.equal(second.asked.length, n);
  });

  await T('not-configured history shows the setup message and never calls fetch', async () => {
    const fetch = fakeFetch(() => { throw new Error('fetch must not be called'); });
    const app = loadApp(baseHtml, { fetch });
    await settle(app);
    assert.equal(plain(app.api.getState()).historyConfigured, false);
    assert.ok(isShown(byId(app, 'history-panel')), 'the history section is on the landing view');
    const status = byId(app, 'history-status').textContent;
    assert.match(status, /not set up/i);
    assert.match(status, /apps-script\/SETUP\.md/);
    assert.equal(isShown(byId(app, 'history-table-wrap')), false);
    assert.ok(MODES.every(mode => byId(app, `history-filter-${mode}`).disabled));
    startConfirmed(app, 'hard');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    await settle(app);
    assert.ok(isShown(byId(app, 'view-results')));
    assert.match(byId(app, 'history-save-message').textContent, /not set up/i);
    assert.equal(isShown(byId(app, 'btn-history-retry')), false);
    byId(app, 'btn-history').click();
    assert.equal(app.document.activeElement?.id, 'history-heading', 'the results button jumps to the history section');
    byId(app, 'btn-choose').click();
    await settle(app);
    assert.equal(fetch.calls.length, 0, 'no network access without an endpoint');
  });

  await T('a failed history save still shows the results and offers a retry that resends the same record', async () => {
    const outcomes = [() => { throw new Error('offline'); }, () => ({ body: { ok: false, error: 'invalid score' } }), () => ({ status: 500, body: {} }), () => ({ body: { ok: true } })];
    const fetch = fakeFetch(call => (call.method === 'POST' ? outcomes.shift()() : okHistory([])));
    const app = loadApp(configuredHtml, { fetch });
    startConfirmed(app, 'medium');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    await settle(app);
    assert.ok(isShown(byId(app, 'view-results')), 'results stay visible');
    assert.equal(app.document.activeElement?.id, 'results-heading');
    assert.ok(byId(app, 'results-summary').textContent.includes(`${count('medium')} of ${count('medium')} correct`));
    const message = byId(app, 'history-save-message');
    const retry = byId(app, 'btn-history-retry');
    for (let attempt = 1; attempt <= 2; attempt++) {
      assert.match(message.textContent, /could not save to class history/i, `failure ${attempt}`);
      assert.ok(isShown(retry), 'a retry button is offered');
      retry.click();
      await settle(app);
    }
    assert.match(message.textContent, /could not save to class history/i, 'HTTP errors count as failures');
    retry.click();
    await settle(app);
    assert.match(message.textContent, /Saved to the class history/);
    assert.equal(isShown(retry), false);
    const bodies = fetch.calls.filter(call => call.method === 'POST').map(call => call.body);
    assert.equal(bodies.length, 4);
    assert.equal(new Set(bodies).size, 1, 'retries resend the identical record');
  });

  await T('class history renders remote rows as text, newest first, marks the current student and filters by mode', async () => {
    const hostile = '<img src=x onerror=alert(1)></td><script>alert(2)</script>';
    const rows = [
      { name: 'Old Timer', mode: 'easy', score: 10, total: 25, percent: 40, band: 'Needs review', finishedAt: '2026-09-01T08:00:00.000Z' },
      { name: hostile, mode: 'medium', score: 18, total: 25, percent: 72, band: '<b>Developing</b>', finishedAt: '2026-09-29T08:00:00.000Z' },
      { name: 'Maria Santos', mode: 'hard', score: 23, total: 25, percent: 92, band: 'Mastery', finishedAt: '2026-09-30T08:00:00.000Z' },
      { name: 'maria santos', mode: 'medium', score: 20, total: 25, percent: 80, band: 'Proficient', finishedAt: '2026-09-15T08:00:00.000Z' },
      { name: 'Bogus Mode', mode: 'expert', score: 1, total: 25, percent: 4, band: 'x', finishedAt: '2026-09-30T09:00:00.000Z' },
      'not a row',
    ];
    let mode = 'all';
    let fail = false;
    const fetch = fakeFetch(call => {
      if (fail) throw new Error('offline');
      mode = new URL(call.url).searchParams.get('mode');
      return okHistory(mode === 'hard' ? [] : rows);
    });
    const app = loadApp(configuredHtml, { fetch });
    enterName(app, 'MARIA SANTOS');
    await settle(app);
    const body = byId(app, 'history-body');
    const rendered = () => body.children.map(row => row.children.map(cell => cell.textContent.trim()));
    assert.ok(isShown(byId(app, 'history-table-wrap')));
    const headers = findAll(byId(app, 'history-table'), node => node.localName === 'th').map(node => node.textContent.trim());
    assert.deepEqual(headers, ['Name', 'Mode', 'Score', '%', 'Band', 'Date']);
    assert.deepEqual(rendered().map(cells => cells[0]), ['Maria Santos You', hostile, 'maria santos You', 'Old Timer'], 'newest first; invalid rows dropped');
    assert.deepEqual(rendered()[0].slice(1, 5), ['Hard', '23/25', '92%', 'Mastery']);
    assert.match(rendered()[0][5], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.equal(findAll(body, node => ['img', 'script', 'b'].includes(node.localName)).length, 0, 'remote markup is never parsed');
    const hostileText = findAll(body, node => hasClass(node, 'history-name-text')).map(node => node.textContent);
    assert.ok(hostileText.includes(hostile), 'the hostile name is shown literally');
    assert.equal(rendered()[1][4], '<b>Developing</b>');
    const selfRows = body.children.filter(row => row.classList.contains('history-row-self'));
    assert.equal(selfRows.length, 2, 'the current student rows are highlighted case-insensitively');
    assert.ok(selfRows.every(row => findAll(row, node => hasClass(node, 'tag-you') && node.textContent === 'You').length === 1), 'highlighting is not colour alone');
    assert.equal(byId(app, 'history-filter-all').getAttribute('aria-pressed'), 'true');
    byId(app, 'history-filter-medium').click();
    await settle(app);
    assert.equal(mode, 'medium', 'the filter is sent to the sheet');
    assert.equal(fetch.calls.at(-1).url, `${TEST_ENDPOINT}?lesson=${lesson.key}&mode=medium&limit=100`);
    assert.deepEqual(rendered().map(cells => cells[1]), ['Medium', 'Medium'], 'only Medium rows are shown');
    assert.equal(byId(app, 'history-filter-medium').getAttribute('aria-pressed'), 'true');
    assert.equal(byId(app, 'history-filter-all').getAttribute('aria-pressed'), 'false');
    assert.match(byId(app, 'history-status').textContent, /2 most recent Medium attempts/);
    byId(app, 'history-filter-hard').click();
    await settle(app);
    assert.equal(isShown(byId(app, 'history-table-wrap')), false);
    assert.match(byId(app, 'history-status').textContent, /No Hard attempts have been recorded yet/);
    fail = true;
    byId(app, 'btn-history-refresh').click();
    assert.match(byId(app, 'history-status').textContent, /Loading/);
    await settle(app);
    assert.match(byId(app, 'history-status').textContent, /Could not load the class history/);
    assert.equal(isShown(byId(app, 'history-table-wrap')), false);
  });

  await T('the payload is accepted by apps-script/Code.gs: the attempt row (with Missed) and the item counters round-trip', async () => {
    const sheet = loadCodeGs(readFileSync(join(ROOT, 'apps-script', 'Code.gs'), 'utf8'));
    const fetch = fakeFetch(request => (request.method === 'POST' ? { body: sheet.post(request.body) } : okHistory([])));
    const app = loadApp(configuredHtml, { fetch });
    startConfirmed(app, 'hard', 'Sgt. Reyes');
    completeAttempt(app, everyFifthWrong);
    const attempt = attemptOf(app);
    const n = attempt.questions.length;
    byId(app, 'btn-finish').click();
    await settle(app);
    assert.match(byId(app, 'history-save-message').textContent, /Saved/, 'the sheet accepted the client payload');
    const score = scoreEveryFifth(n);
    const reply = sheet.get({ lesson: lesson.key, mode: 'hard', limit: '5' });
    assert.equal(reply.ok, true);
    assert.equal(reply.rows.length, 1);
    assert.deepEqual({ ...reply.rows[0], finishedAt: undefined }, { name: 'Sgt. Reyes', mode: 'hard', score, total: n, percent: percentOf(score, n), band: bandFor(percentOf(score, n)), finishedAt: undefined });
    assert.equal(sheet.get({ lesson: lesson.key, mode: 'easy' }).rows.length, 0);
    const missedIds = attempt.questions.filter((_, index) => !everyFifthWrong(index)).map(question => itemIdOf(question, 'hard'));
    const tab = [...sheet.sheets.values()].find(item => item.name !== 'Item Analysis');
    assert.equal(tab.rows[1][8], missedIds.join(','), 'the attempt row lists the missed question ids');
    const items = sheet.get({ action: 'items', lesson: 'all' });
    assert.equal(items.ok, true);
    assert.equal(items.kind, 'items');
    assert.equal(items.rows.length, n, 'one item row per question asked');
    for (const row of items.rows) assert.deepEqual([row.asked, row.missed], [1, missedIds.includes(row.qid) ? 1 : 0], row.qid);
    app.api.setRandom(seededRandom(5));
    byId(app, 'btn-retake').click();
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    await settle(app);
    const newest = sheet.get({ lesson: lesson.key, mode: 'hard', limit: '1' }).rows[0];
    assert.deepEqual([newest.score, newest.total, newest.percent, newest.band], [n, n, 100, 'Mastery'], 'a perfect attempt of any length is accepted');
    const again = sheet.get({ action: 'items', lesson: 'all' }).rows;
    assert.equal(again.reduce((sum, row) => sum + row.asked, 0), 2 * n, 'every question asked in both attempts is counted');
    assert.equal(again.reduce((sum, row) => sum + row.missed, 0), missedIds.length, 'the perfect retake adds no misses');
  });

  await T('Retry my mistakes: results offer "Retry the N questions I missed" only after a miss; M or the button starts a labelled practice with exactly those questions, reshuffled, options unchanged', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    startConfirmed(app, 'easy');
    const wrong = new Set([1, 4, 6]);
    completeAttempt(app, index => !wrong.has(index));
    const attempt = attemptOf(app);
    byId(app, 'btn-finish').click();
    const button = byId(app, 'btn-retry-missed');
    assert.ok(isShown(button));
    assert.equal(button.textContent, 'Retry the 3 questions I missed');
    assert.equal(button.getAttribute('aria-keyshortcuts'), 'M');
    assert.ok(isShown(byId(app, 'hint-retry-missed')), 'the keyboard hint mentions M');
    const missed = attempt.questions.filter((_, index) => wrong.has(index));
    app.api.setRandom(seededRandom(9));
    const expected = plain(app.api.shuffleQuestions(missed, seededRandom(9)));
    cues.length = 0;
    assert.equal(press(app, 'm').defaultPrevented, true, 'M is handled on the results page');
    const practice = attemptOf(app);
    assert.equal(plain(app.api.getState()).view, 'quiz');
    assert.equal(practice.practice, true);
    assert.equal(practice.mode, 'easy');
    assert.deepEqual(practice.questions, expected, 'only the missed questions, reshuffled');
    assert.ok(practice.questions.every(question => JSON.stringify(question) === JSON.stringify(banks.easy.find(item => item.qid === question.qid && item.id === question.id))), 'answer choices keep their authored order');
    assert.ok(practice.responses.every(response => response.selected === null && !response.checked));
    assert.equal(byId(app, 'quiz-heading').textContent, 'Practice: retrying missed questions (Easy)');
    assert.ok(isShown(byId(app, 'quiz-practice-note')));
    assert.match(byId(app, 'quiz-practice-note').textContent, /Practice: retrying missed questions\. Practice attempts are not saved to the class history\./);
    assert.equal(byId(app, 'quiz-progress').getAttribute('max'), '3');
    assert.equal(byId(app, 'question-heading').textContent, 'Question 1 of 3');
    assert.equal(app.document.activeElement?.id, 'question-heading');
    assert.ok(app.document.body.classList.contains('theme-easy'));
    assert.deepEqual(cues, ['start']);
    assert.equal(press(app, 'm').defaultPrevented, false, 'M does nothing during a quiz');
    const perfect = loadApp();
    startConfirmed(perfect, 'hard');
    completeAttempt(perfect);
    byId(perfect, 'btn-finish').click();
    assert.equal(isShown(byId(perfect, 'btn-retry-missed')), false, 'nothing to retry after a perfect attempt');
    assert.equal(isShown(byId(perfect, 'hint-retry-missed')), false);
    assert.equal(press(perfect, 'm').defaultPrevented, false);
    assert.equal(perfect.api.retryMissed(), false);
    const single = loadApp();
    startConfirmed(single, 'medium');
    completeAttempt(single, index => index !== 0);
    byId(single, 'btn-finish').click();
    assert.equal(byId(single, 'btn-retry-missed').textContent, 'Retry the 1 question I missed');
    byId(single, 'btn-retry-missed').click();
    assert.equal(attemptOf(single).questions.length, 1);
  });

  await T('Retry my mistakes: a practice attempt has its own results, is never sent to the class history, can be retried again, and R returns to a full attempt', async () => {
    const fetch = fakeFetch(call => (call.method === 'POST' ? { body: { ok: true } } : okHistory([])));
    const app = loadApp(configuredHtml, { fetch });
    await settle(app);
    startConfirmed(app, 'medium', 'Maria Santos');
    completeAttempt(app, index => ![0, 2, 3].includes(index));
    byId(app, 'btn-finish').click();
    await settle(app);
    const posts = () => fetch.calls.filter(call => call.method === 'POST').length;
    assert.equal(posts(), 1);
    const getsBefore = fetch.calls.length;
    byId(app, 'btn-retry-missed').click();
    completeAttempt(app, index => index !== 0);
    byId(app, 'btn-finish').click();
    await settle(app);
    const state = plain(app.api.getState());
    assert.equal(state.view, 'results');
    assert.equal(state.results.practice, true);
    assert.equal(state.results.total, 3);
    assert.equal(state.results.score, 2);
    assert.equal(byId(app, 'results-heading').textContent, 'Practice results (Medium)');
    assert.ok(isShown(byId(app, 'results-practice-note')));
    assert.match(byId(app, 'results-summary').textContent, /2 of 3 correct/);
    assert.match(byId(app, 'results-summary').textContent, /Medium · practice retry/);
    assert.match(byId(app, 'history-save-message').textContent, /Practice attempts are not saved to the class history/);
    assert.equal(posts(), 1, 'the practice attempt was not sent');
    assert.equal(fetch.calls.length, getsBefore, 'no network request at all for a practice attempt');
    assert.equal(byId(app, 'results-review').children.length, 3, 'the review covers the practice questions only');
    assert.equal(byId(app, 'btn-retry-missed').textContent, 'Retry the 1 question I missed');
    const stillMissed = state.attempt.questions[0].qid;
    press(app, 'M');
    assert.deepEqual(attemptOf(app).questions.map(question => question.qid), [stillMissed], 'a second retry asks what the practice missed');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    assert.equal(isShown(byId(app, 'btn-retry-missed')), false);
    assert.ok(press(app, 'r').defaultPrevented, 'R retakes the whole difficulty');
    const full = attemptOf(app);
    assert.equal(full.practice, false);
    assert.equal(full.questions.length, count('medium'));
    assert.equal(byId(app, 'quiz-heading').textContent, 'Medium examination');
    assert.equal(isShown(byId(app, 'quiz-practice-note')), false);
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    await settle(app);
    assert.equal(posts(), 2, 'a full retake is saved again');
    assert.equal(isShown(byId(app, 'results-practice-note')), false);
    byId(app, 'btn-retry-missed').click();
    assert.equal(plain(app.api.getState()).view, 'results', 'the hidden retry button does nothing after a perfect attempt');
    press(app, 'c');
    assert.equal(plain(app.api.getState()).view, 'landing');
  });

  await T('createPracticeAttempt reshuffles a copy with the injected random and never touches the banks', () => {
    const { api } = loadApp();
    const questions = banks.hard.slice(0, 6);
    const practice = plain(api.createPracticeAttempt('hard', questions, seededRandom(21)));
    assert.equal(practice.practice, true);
    assert.deepEqual(practice.questions, plain(api.shuffleQuestions(questions, seededRandom(21))));
    assert.equal(practice.responses.length, 6);
    assert.throws(() => api.createPracticeAttempt('expert', questions), /Unknown difficulty/);
    assert.equal(JSON.stringify(api.getBanks()), JSON.stringify(banks));
    assert.equal(api.itemId(banks.hard[0], 'hard'), itemIdOf(banks.hard[0], 'hard'));
  });

  if (!pool) {
    await T('a bank of any size from 1 to 100 sets the attempt length, progress, results and the history total', async () => {
      for (const size of [1, 7]) {
        const fetch = fakeFetch(call => (call.method === 'POST' ? { body: { ok: true } } : okHistory([])));
        const app = loadApp(replaceBank(configuredHtml, 'easy', JSON.stringify(banks.easy.slice(0, size))), { fetch });
        assert.equal(plain(app.api.getState()).available, true, `a ${size}-question bank is valid`);
        startConfirmed(app, 'easy');
        assert.equal(byId(app, 'quiz-progress').getAttribute('max'), String(size));
        assert.equal(byId(app, 'question-heading').textContent, `Question 1 of ${size}`);
        completeAttempt(app);
        byId(app, 'btn-finish').click();
        await settle(app);
        assert.ok(byId(app, 'results-summary').textContent.includes(`${size} of ${size} correct`));
        const payload = JSON.parse(fetch.calls.find(call => call.method === 'POST').body);
        assert.equal(payload.total, size);
        assert.equal(payload.asked.length, size);
      }
    });
  }

  await T('sound effects: a visible toggle (on by default) and cues for select, correct, incorrect, start, error and finish', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    const toggle = byId(app, 'btn-sound');
    assert.equal(toggle.localName, 'button');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true', 'sound is on by default');
    assert.match(toggle.textContent, /Sound effects/);
    assert.match(byId(app, 'sound-state').textContent, /On/);
    assert.equal(plain(app.api.getState()).soundEnabled, true);
    startConfirmed(app, 'easy');
    assert.deepEqual(cues, ['start']);
    const [first, second, third] = attemptOf(app).questions;
    byId(app, 'btn-check').click();
    assert.equal(cues.at(-1), 'error', 'a validation error has a soft cue');
    radios(app)[(first.answer + 1) % 4].click();
    assert.equal(cues.at(-1), 'select');
    byId(app, 'btn-check').click();
    assert.equal(cues.at(-1), 'incorrect');
    byId(app, 'btn-next').click();
    radios(app)[second.answer].click();
    byId(app, 'btn-check').click();
    assert.equal(cues.at(-1), 'correct');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.match(byId(app, 'sound-state').textContent, /Off/);
    assert.equal(plain(app.api.getState()).soundEnabled, false);
    const muted = cues.length;
    byId(app, 'btn-next').click();
    radios(app)[third.answer].click();
    byId(app, 'btn-check').click();
    assert.equal(cues.length, muted, 'no cue plays while sound is off');
    assert.match(byId(app, 'answer-feedback').textContent, /^\s*Correct\./, 'visual feedback does not depend on sound');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    byId(app, 'btn-next').click();
    completeAttemptFrom(app, 3);
    byId(app, 'btn-finish').click();
    const n = count('easy');
    assert.equal(cues.at(-1), { Mastery: 'finish-mastery', Proficient: 'finish-proficient', Developing: 'finish-developing' }[bandFor(percentOf(n - 1, n))] ?? 'finish-review', 'the finish cue follows the mastery band');
    app.api.setSoundPlayer(() => { throw new Error('audio device lost'); });
    byId(app, 'btn-retake').click();
    assert.equal(plain(app.api.getState()).view, 'quiz', 'a failing audio stack never blocks the quiz');
    app.api.setSoundPlayer(null);
    assert.equal(app.api.selectAnswer(0), true, 'the default Web Audio player is a no-op without AudioContext');
  });

  // ----- Visual system -----

  await T('hero artwork is an aria-hidden inline SVG with the lesson’s animated groups and labels', () => {
    const document = parseHtml(builtHtml);
    const svgs = findAll(document.root, node => node.localName === 'svg');
    assert.ok(svgs.length > 0, 'the page must contain inline SVG artwork');
    for (const svg of svgs) {
      assert.equal(svg.getAttribute('aria-hidden'), 'true', 'decorative SVG must be aria-hidden');
      assert.equal(svg.getAttribute('focusable'), 'false', 'decorative SVG must not take focus');
      assert.ok(svg.getAttribute('viewbox'), 'SVG must scale through a viewBox');
    }
    const art = lesson.art;
    const groups = {};
    for (const id of art.groups) {
      const node = document.getElementById(id);
      assert.ok(node, `SVG group #${id} is required`);
      assert.equal(node.localName, 'g', `#${id} must be an SVG <g> group`);
      assert.ok(svgs.some(svg => findAll(svg, child => child === node).length), `#${id} must sit inside an aria-hidden SVG`);
      groups[id] = node;
    }
    for (const [parent, children] of Object.entries(art.nested ?? {})) {
      for (const id of children) assert.ok(findAll(groups[parent], node => node === groups[id]).length, `#${id} must be part of #${parent}`);
    }
    const hero = document.getElementById('hero-art');
    assert.ok(hero, 'the landing hero must contain the art');
    assert.equal(hero.getAttribute('aria-hidden'), 'true');
    const heroText = hero.textContent.replace(/\s+/g, ' ');
    for (const label of art.labels) assert.ok(heroText.includes(label), `decorative label ${label} belongs inside the aria-hidden art`);
    for (const name of art.classes) assert.ok(findAll(hero, node => hasClass(node, name)).length, `.${name} must be drawn`);
    if (art.forbidden) assert.doesNotMatch(heroText, new RegExp(art.forbidden), 'the art is not a copy of another lesson picture');
  });

  await T('Easy, Medium and Hard theme classes are styled and follow the active attempt', () => {
    const { rules } = parseCss(stylesheetText(builtHtml));
    for (const mode of MODES) {
      assert.ok(rules.some(rule => rule.selectors.some(selector => selector.includes(`.theme-${mode}`))), `CSS must style .theme-${mode}`);
    }
    const themeClasses = app => MODES.filter(mode => app.document.body.classList.contains(`theme-${mode}`));
    for (const mode of MODES) {
      const app = loadApp();
      assert.ok(app.document.body, 'the page must have a <body>');
      assert.deepEqual(themeClasses(app), [], 'no theme before a mode starts');
      assert.equal(app.document.body.getAttribute('data-view'), 'landing');
      startConfirmed(app, mode);
      assert.deepEqual(themeClasses(app), [mode], `${mode} applies only theme-${mode}`);
      assert.equal(app.document.body.getAttribute('data-view'), 'quiz');
      assert.match(byId(app, 'quiz-heading').textContent, new RegExp(mode, 'i'), 'the difficulty is named in text, not by colour alone');
      completeAttempt(app);
      byId(app, 'btn-finish').click();
      assert.deepEqual(themeClasses(app), [mode], 'results keep the attempt theme');
      assert.equal(app.document.body.getAttribute('data-view'), 'results');
      byId(app, 'btn-retake').click();
      assert.deepEqual(themeClasses(app), [mode], 'retake keeps the same theme');
      completeAttempt(app);
      byId(app, 'btn-finish').click();
      byId(app, 'btn-choose').click();
      assert.deepEqual(themeClasses(app), [], 'choosing another difficulty clears the theme');
      assert.equal(app.document.body.getAttribute('data-view'), 'landing');
      const next = MODES[(MODES.indexOf(mode) + 1) % 3];
      byId(app, `mode-${next}`).click();
      assert.deepEqual(themeClasses(app), [next], 'switching difficulty swaps the theme');
    }
    const broken = loadApp(replaceBank(baseHtml, 'easy', '{not json'));
    assert.deepEqual(themeClasses(broken), []);
    assert.equal(broken.document.body.getAttribute('data-view'), 'unavailable');
  });

  await T('focus stays visible: a :focus-visible outline exists and no rule removes outlines; hover never replaces feedback styling', () => {
    const { rules } = parseCss(stylesheetText(builtHtml));
    const focusRules = rules.filter(rule => !rule.media && rule.selectors.some(selector => selector.includes(':focus-visible')));
    assert.ok(focusRules.length, 'a :focus-visible rule is required');
    assert.ok(focusRules.some(rule => {
      const outline = rule.declarations.get('outline') ?? '';
      const width = Number((outline.match(/(\d+(?:\.\d+)?)px/) ?? [])[1] ?? 0);
      return width >= 2 && /solid/.test(outline);
    }), 'focus outline must be solid and at least 2px wide');
    for (const rule of rules) {
      const outline = rule.declarations.get('outline');
      assert.ok(outline === undefined || !/^(none|0)\b/.test(outline), `outline removed by ${rule.selectors.join(', ')}`);
    }
    const hover = rules.flatMap(rule => rule.selectors.filter(selector => selector.includes('.option:hover') && rule.declarations.has('border-color')));
    assert.ok(hover.length, 'options need a hover accent');
    for (const selector of hover) {
      assert.match(selector, /:not\(\.option-correct\)/, 'hover must preserve correct answer border');
      assert.match(selector, /:not\(\.option-incorrect\)/, 'hover must preserve incorrect answer border');
    }
  });

  await T('narrow screens up to 760px stack the hero and controls with 44px targets and wrapping text', () => {
    const { rules } = parseCss(stylesheetText(builtHtml));
    const mobile = rules.filter(rule => rule.media && /max-width:\s*760px/.test(rule.media));
    assert.ok(mobile.length, 'a @media (max-width: 760px) block is required');
    const stacks = selectorPattern => mobile.some(rule => rule.selectors.some(selector => selectorPattern.test(selector))
      && (/^1fr$/.test(rule.declarations.get('grid-template-columns') ?? '') || rule.declarations.get('flex-direction') === 'column'));
    assert.ok(stacks(/\.hero-inner\b/), 'the hero must stack into one column');
    assert.ok(stacks(/\.quiz-actions\b/) && stacks(/\.results-actions\b/), 'action buttons must stack');
    const base = selector => rules.find(rule => !rule.media && rule.selectors.includes(selector));
    for (const selector of ['button', '.option', '.study-confirm', '.hub-link']) {
      assert.equal(base(selector)?.declarations.get('min-height'), '44px', `${selector} keeps a 44px minimum target`);
    }
    assert.equal(base('body')?.declarations.get('overflow-wrap'), 'anywhere', 'long answers must wrap');
    const art = rules.find(rule => !rule.media && rule.selectors.includes('.hero-art svg'));
    assert.ok(art && art.declarations.get('max-width') === '100%', 'hero SVG must never exceed its column');
    const terrain = rules.find(rule => !rule.media && rule.selectors.includes('.terrain'));
    assert.ok(terrain && terrain.declarations.get('position') === 'fixed' && terrain.declarations.get('overflow') === 'hidden' && terrain.declarations.get('pointer-events') === 'none', 'the decorative map layer must not affect layout width or input');
  });

  await T('prefers-reduced-motion: reduce sets animation and transition to none on every motion-bearing element and keeps the static art', () => {
    const { rules, keyframes } = parseCss(stylesheetText(builtHtml));
    const reduced = rules.filter(rule => rule.media && REDUCED_MOTION_MEDIA.test(rule.media));
    assert.ok(reduced.length, 'a @media (prefers-reduced-motion: reduce) block is required');
    const stilled = new Set(reduced
      .filter(rule => /^none\b/.test(rule.declarations.get('animation') ?? '') && /^none\b/.test(rule.declarations.get('transition') ?? ''))
      .flatMap(rule => rule.selectors));
    for (const selector of [...lesson.art.stilled, '.view', '.feedback', 'button', '.option']) {
      assert.ok(stilled.has(selector), `reduced motion must set animation: none and transition: none on ${selector}`);
    }
    const moving = rules.filter(rule => !(rule.media && REDUCED_MOTION_MEDIA.test(rule.media))
      && (hasMotion(rule.declarations.get('animation')) || hasMotion(rule.declarations.get('animation-name')) || hasMotion(rule.declarations.get('transition'))));
    if (lesson.art.stilled.length) assert.ok(moving.length >= 6, 'the artwork must actually be animated');
    for (const rule of moving) {
      for (const selector of rule.selectors) assert.ok(stilled.has(selector), `animated selector ${selector} is not stopped under reduced motion`);
      const name = (rule.declarations.get('animation') ?? rule.declarations.get('animation-name') ?? '').split(/\s+/).find(token => keyframes.has(token));
      if (hasMotion(rule.declarations.get('animation')) || rule.declarations.has('animation-name')) assert.ok(name, `${rule.selectors.join(', ')} uses an undefined @keyframes`);
    }
    const staticArt = new RegExp(lesson.art.staticPattern);
    for (const rule of reduced) {
      for (const selector of rule.selectors) {
        if (staticArt.test(selector)) {
          assert.notEqual(rule.declarations.get('display'), 'none', `static artwork ${selector} must stay visible`);
          assert.notEqual(rule.declarations.get('visibility'), 'hidden', `static artwork ${selector} must stay visible`);
        }
      }
    }
  });

  await T('no external URLs other than the history endpoint; links are in-page fragments or the relative hub link; self-hosted fonts with system fallbacks', () => {
    assert.doesNotMatch(baseHtml, /https?:\/\//i, 'no absolute URLs outside HISTORY_ENDPOINT (inline SVG needs no xmlns)');
    assert.doesNotMatch(builtHtml, /data:[a-z]+\//i, 'no data: URIs');
    const urls = [...builtHtml.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi)].map(m => m[0]);
    assert.deepEqual(urls.filter(u => !u.startsWith('https://script.google.com/')), []);
    const css = stylesheetText(builtHtml);
    assert.match(css, /@font-face/, 'the self-hosted fonts are declared');
    for (const target of cssUrls(css)) {
      assert.ok(target.startsWith('#') || (isLocalAsset(target) && target.startsWith('../') && existsSync(resolve(dirname(pagePath), target))), `stylesheet url(${target}) must be an inline fragment or a same-origin ../assets/ file on disk`);
    }
    const preloads = [...builtHtml.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
    assert.ok(preloads.length >= 2 && preloads.every(tag => /^<link rel="preload" href="\.\.\/assets\/fonts\/[\w-]+\.woff2" as="font" type="font\/woff2" crossorigin>$/.test(tag)), 'only font preloads, same-origin');
    for (const [, target] of withoutFontPreloads(builtHtml).matchAll(/\bhref\s*=\s*"([^"]*)"/gi)) {
      assert.ok(target.startsWith('#') || target === hubHref, `href ${target} must be an in-page fragment or the quiz hub`);
    }
    const { rules } = parseCss(css);
    const bodyFont = rules.find(rule => !rule.media && rule.selectors.includes('body'))?.declarations.get('font-family') ?? '';
    const stack = bodyFont.startsWith('var(') ? (rules.find(rule => !rule.media && rule.selectors.includes(':root') && rule.declarations.has('--font-sans'))?.declarations.get('--font-sans') ?? '') : bodyFont;
    assert.match(stack, /^"IBM Plex Sans Condensed"/, 'body text is set in IBM Plex Sans Condensed');
    assert.match(stack, /system-ui/, 'with a system font stack behind it');
  });

  await T(`the header links back to the hub's ${lesson.module} section as an "All quizzes" link`, () => {
    const app = loadApp();
    const link = byId(app, 'hub-link');
    assert.equal(link.localName, 'a');
    assert.equal(link.getAttribute('href'), hubHref);
    assert.equal(link.textContent.replace(/\s+/g, ' ').trim(), '← All quizzes');
    assert.ok(findAll(app.document.root, node => node.localName === 'header' && findAll(node, child => child === link).length).length, 'the link sits in the page header');
    assert.deepEqual(findAll(app.document.root, node => node.localName === 'a').map(node => node.getAttribute('href')), [hubHref], 'the hub link is the only link');
    assert.ok(existsSync(join(resolve(dirname(pagePath), '..'), 'index.html')), 'the hub page exists one folder up');
  });

  await T('Bandwidth Brothers banner and the class photo use the shared ../assets images (on disk), landing view only, hidden in print', () => {
    const m = builtHtml.match(/<div class="banner">\s*<picture>([\s\S]*?)<\/picture>\s*<\/div>/);
    assert.ok(m, 'banner picture markup');
    assert.ok(builtHtml.indexOf('<div class="banner">') < builtHtml.indexOf('<header'), 'banner precedes the hero');
    assert.match(m[1], /<source media="\(max-width: 800px\)" srcset="\.\.\/assets\/banner-800\.jpg 1x, \.\.\/assets\/banner-1600\.jpg 2x">/);
    const img = m[1].match(/<img\b[^>]*>/)[0];
    assert.match(img, /\bsrcset="\.\.\/assets\/banner-1600\.jpg 1x"/);
    assert.match(img, /\bwidth="1600"/); assert.match(img, /\bheight="900"/);
    assert.match(img, /\bfetchpriority="high"/);
    assert.match(img, /\balt="Bandwidth Brothers banner"/);
    const photo = builtHtml.match(/<figure class="class-photo">([\s\S]*?)<\/figure>/);
    assert.ok(photo, 'class photo figure');
    const photoImg = photo[1].match(/<img\b[^>]*>/)[0];
    assert.match(photoImg, /\bsrcset="\.\.\/assets\/class-photo-800\.jpg 800w, \.\.\/assets\/class-photo-1600\.jpg 1600w"/);
    assert.match(photoImg, /\bwidth="1600"/); assert.match(photoImg, /\bheight="1200"/);
    assert.match(photoImg, /\bloading="lazy"/); assert.match(photoImg, /\bdecoding="async"/);
    assert.match(photoImg, /\balt="SOAC 52 - 2026 class group photo"/);
    assert.equal(photo[1].match(/<figcaption>([\s\S]*?)<\/figcaption>/)[1], 'SOAC 52 - 2026');
    const found = new Set([...builtHtml.matchAll(/\b(?:src|srcset)="([^"]*)"/g)].flatMap(x => x[1].split(',').map(p => p.trim().split(/\s+/)[0])).filter(p => /\.jpg$/.test(p)));
    assert.deepEqual([...found].sort(), ['../assets/banner-1600.jpg', '../assets/banner-800.jpg', '../assets/class-photo-1600.jpg', '../assets/class-photo-800.jpg']);
    for (const file of found) assert.ok(existsSync(resolve(dirname(pagePath), file)), `${file} must exist`);
    const css = builtHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
    // Plate I keeps the approved title-and-soldiers frame on all screen sizes.
    assert.match(css, /\.banner img \{[^}]*height: auto;[^}]*aspect-ratio: 1127 \/ 291; object-fit: cover; object-position: 50% 62%; max-height: none;/);
    assert.match(css, /\.class-photo \{[^}]*max-width: var\(--page-max\);/);
    assert.match(css, /@media print \{[\s\S]*\.banner, \.class-photo[^{]*\{ display: none !important; \}/);
    assert.match(css, /body:not\(\[data-view="landing"\]\) \.banner, body:not\(\[data-view="landing"\]\) \.class-photo \{ display: none; \}/);
    assert.ok(/<body data-view="landing">/.test(builtHtml), 'body starts on the landing view');
  });

  await T('the topographic contours are sliced, decorative, quiet, confined to the margins and themed by CSS variables', () => {
    const layer = builtHtml.match(/<div class="terrain" aria-hidden="true">\s*<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g class="contours"[^>]*>([\s\S]*?)<\/g><\/svg>\s*<\/div>/);
    assert.ok(layer, 'inline contour layer');
    const paths = layer[1].match(/<path\b[^>]*>/g) || [];
    assert.ok(paths.length >= 20, 'contour paths inlined');
    assert.ok(paths.some(path => /class="major"/.test(path)) && paths.some(path => !/class=/.test(path)), 'minor and index contours are both drawn');
    assert.ok(paths.every(path => !/\b(?:stroke|style)=/.test(path)), 'stroke colours come from CSS variables');
    assert.ok(!/<(script|a|foreignObject|image|use)\b|\son\w+=/i.test(layer[1]), 'only plain paths');
    assert.ok(Buffer.byteLength(layer[0]) < 20000, `the contour layer stays light (${Buffer.byteLength(layer[0])} bytes)`);
    const css = stylesheetText(builtHtml);
    // Paper first: the contours are faint (<= 0.2) and masked to the page margins and the masthead band.
    for (const name of ['--topo-minor-opacity', '--topo-major-opacity']) {
      const value = Number(css.match(new RegExp(`${name}: ([0-9.]+);`))?.[1]);
      assert.ok(value > 0 && value <= 0.2, `${name} is quiet (${value})`);
    }
    assert.match(css, /\.terrain, \.topo \{[^}]*mask-image: linear-gradient\(90deg, #000 0, #000 calc\(50% - var\(--page-max\) \/ 2/, 'the contours are masked out of the content column');
    assert.match(css, /stroke: var\(--topo-line\); stroke-opacity: var\(--topo-minor-opacity\)/);
    assert.match(css, /path\.major \{ stroke: var\(--topo-line-major\); stroke-opacity: var\(--topo-major-opacity\)/);
    assert.match(css, /@media print \{[\s\S]*\.terrain,/);
    const { rules } = parseCss(css);
    assert.equal(rules.find(rule => !rule.media && rule.selectors.includes('.terrain'))?.declarations.get('z-index'), '-1', 'the map sits behind every content surface');
    for (const selector of ['.app', '.feedback', '.review-item']) {
      assert.match(rules.find(rule => !rule.media && rule.selectors.includes(selector))?.declarations.get('background') ?? '', /var\(--color-surface\)/, `${selector} stays an opaque surface over the map`);
    }
    const roots = rules.filter(rule => !rule.media && rule.selectors.includes(':root'));
    for (const [name, value] of Object.entries(lesson.palette ?? {})) {
      assert.ok(roots.some(rule => rule.declarations.get(name) === value), `the lesson palette sets ${name}`);
    }
  });

  // ----- Device-local progress (this browser only) -----

  const progressKey = (lessonKey, mode) => `mastery-quiz:progress:${lessonKey}:${mode}`;
  const ownKeys = pool ? pool.lessons.map(source => source.key) : [lesson.key];
  const lessonOf = question => (pool ? question.lessonKey : lesson.key);

  await T('device progress: questions this device has not seen come first, then those last missed, then the rest, each group shuffled', () => {
    const bank = banks.easy;
    const storage = new FakeStorage();
    const flags = {};
    // For each source lesson: its first 5 questions answered correctly before, the next 3 missed, the rest unseen.
    for (const key of ownKeys) {
      const own = bank.filter(question => lessonOf(question) === key);
      const record = {};
      own.slice(0, 5).forEach(question => { record[question.qid] = 's'; });
      own.slice(5, 8).forEach(question => { record[question.qid] = 'm'; });
      if (!pool) {
        // A pool exam needs most of a lesson seen before the priority shows within its share.
      } else {
        own.slice(8, own.length - 2).forEach(question => { record[question.qid] = 's'; });
      }
      flags[key] = record;
      storage.setItem(progressKey(key, 'easy'), JSON.stringify(record));
    }
    storage.setItem(progressKey(ownKeys[0], 'easy') + 'x', 'ignored');
    const app = loadApp(baseHtml, { globals: { localStorage: storage } });
    app.api.setRandom(seededRandom(4));
    startConfirmed(app, 'easy');
    const questions = attemptOf(app).questions;
    const flag = question => flags[lessonOf(question)]?.[question.qid] ?? '';
    if (!pool) {
      const random = seededRandom(4);
      const groups = ['', 'm', 's'].map(value => bank.filter(question => flag(question) === value));
      const expected = groups.flatMap(group => plain(app.api.shuffleQuestions(group, random)));
      assert.deepEqual(questions.map(question => question.qid), expected.map(question => question.qid), 'unseen, then missed, then seen; each group shuffled with the injected random');
      assert.equal(questions.length, bank.length, 'every question of the bank is still asked');
      assert.deepEqual(plain(app.api.prioritize(bank, plain(app.api.loadProgress('easy')), seededRandom(4))).map(question => question.qid), expected.map(question => question.qid));
    } else {
      assertBalancedDraw(questions, 'easy', 'prioritised draw');
      for (const key of ownKeys) {
        const own = bank.filter(question => lessonOf(question) === key);
        const priority = own.filter(question => flag(question) !== 's');
        const drawn = questions.filter(question => question.lessonKey === key);
        assert.equal(priority.length, 5, 'two unseen and three missed per lesson');
        for (const question of priority) assert.ok(drawn.some(item => item.qid === question.qid), `${key}: unseen and missed questions are drawn before seen ones (${question.qid})`);
      }
    }
  });

  await T('device progress: every checked answer (practice included) records only the qid and s/m; nothing else is stored', () => {
    const storage = new FakeStorage();
    const app = loadApp(baseHtml, { globals: { localStorage: storage } });
    assert.ok(isShown(byId(app, 'device-progress')), 'the reset link shows when storage works');
    startConfirmed(app, 'medium', 'Maria Santos');
    completeAttempt(app, index => index !== 0 && index !== 2);
    const attempt = attemptOf(app);
    byId(app, 'btn-finish').click();
    const stored = storage.entries();
    assert.ok(Object.keys(stored).every(key => ownKeys.some(own => key === progressKey(own, 'medium'))), Object.keys(stored).join(', '));
    const merged = Object.assign({}, ...Object.values(stored).map(value => JSON.parse(value)));
    assert.equal(Object.keys(merged).length, attempt.questions.length, 'one flag per question asked');
    attempt.questions.forEach((question, index) => assert.equal(merged[question.qid], index === 0 || index === 2 ? 'm' : 's', question.qid));
    assert.ok(Object.values(merged).every(value => value === 's' || value === 'm'));
    assert.ok(!JSON.stringify(stored).includes('Maria'), 'no name is stored');
    assert.doesNotMatch(JSON.stringify(stored), /"selected"|"answer"|"score"/);
    press(app, 'm');
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    const after = Object.assign({}, ...Object.values(storage.entries()).map(value => JSON.parse(value)));
    assert.equal(after[attempt.questions[0].qid], 's', 'a practice retry answered correctly clears the miss');
    assert.equal(after[attempt.questions[2].qid], 's');
    // The next full attempt starts with the questions this device has not seen (none left) then the missed (none).
    byId(app, 'btn-retake').click();
    assert.equal(attemptOf(app).questions.length, count('medium'), 'a full attempt still asks the whole bank');
  });

  await T('device progress: without storage, with failing storage or corrupted data the quiz falls back to a plain shuffle; the reset link hides without storage', async () => {
    const expectedOrder = random => plain(pool ? loadApp().api.sampleQuestions(banks.hard, random) : loadApp().api.shuffleQuestions(banks.hard, random)).map(question => question.qid);
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
    const variants = {
      'no localStorage': {},
      'localStorage getter throws': { setup: sandbox => Object.defineProperty(sandbox, 'localStorage', { get() { throw new Error('SecurityError'); } }) },
      'every call throws': { globals: { localStorage: throwing } },
      'corrupted data': { globals: { localStorage: new FakeStorage(Object.fromEntries(ownKeys.map(key => [progressKey(key, 'hard'), '{not json']))) } },
      'wrong shapes': { globals: { localStorage: new FakeStorage(Object.fromEntries(ownKeys.map(key => [progressKey(key, 'hard'), JSON.stringify({ '<img>': 's', [banks.hard[0].qid]: 'x', constructor: 'm' })]))) } },
    };
    for (const [name, options] of Object.entries(variants)) {
      const app = loadApp(baseHtml, options);
      app.api.setRandom(seededRandom(8));
      startConfirmed(app, 'hard');
      assert.deepEqual(attemptOf(app).questions.map(question => question.qid), expectedOrder(seededRandom(8)), `${name}: a plain shuffle`);
      completeAttempt(app, index => index !== 1);
      byId(app, 'btn-finish').click();
      assert.equal(plain(app.api.getState()).view, 'results', `${name}: the quiz still finishes`);
      press(app, 'm');
      assert.equal(attemptOf(app).practice, true, `${name}: practice still works`);
      assert.deepEqual(app.consoleErrors, [], name);
      const hidden = byId(app, 'device-progress').hidden;
      assert.equal(hidden, name === 'no localStorage' || name === 'localStorage getter throws', `${name}: reset link visibility`);
    }
  });

  await T('device progress: "Reset my progress on this device" clears this quiz’s record for every difficulty and nothing else', () => {
    const entries = { 'mastery-quiz:progress:otherlesson:easy': '{"otherlesson-e-01":"s"}', unrelated: 'keep' };
    for (const key of ownKeys) for (const mode of MODES) entries[progressKey(key, mode)] = JSON.stringify({ [banks[mode].find(question => lessonOf(question) === key).qid]: 's' });
    const storage = new FakeStorage(entries);
    const app = loadApp(baseHtml, { globals: { localStorage: storage } });
    const button = byId(app, 'btn-reset-progress');
    assert.equal(button.localName, 'button');
    assert.equal(button.textContent, 'Reset my progress on this device');
    assert.ok(findAll(byId(app, 'view-landing'), node => node === button).length, 'the link is on the landing view');
    button.click();
    assert.deepEqual(storage.entries(), { 'mastery-quiz:progress:otherlesson:easy': '{"otherlesson-e-01":"s"}', unrelated: 'keep' });
    assert.match(byId(app, 'reset-progress-status').textContent, /reset/i);
    assert.equal(byId(app, 'reset-progress-status').getAttribute('role'), 'status');
    app.api.setRandom(seededRandom(2));
    startConfirmed(app, 'easy');
    const expected = plain(pool ? app.api.sampleQuestions(banks.easy, seededRandom(2)) : app.api.shuffleQuestions(banks.easy, seededRandom(2)));
    assert.deepEqual(attemptOf(app).questions.map(question => question.qid), expected.map(question => question.qid), 'after a reset every question counts as new');
  });

  // ----- Keyboard -----

  // Answers every question with the keyboard only: a letter or digit, Enter to check, Enter to go on (or finish).
  function completeAttemptByKeyboard(app, chooseCorrect = () => true) {
    const total = attemptOf(app).questions.length;
    for (let index = 0; index < total; index++) {
      const attempt = attemptOf(app);
      assert.equal(attempt.current, index);
      const question = attempt.questions[index];
      const choice = chooseCorrect(index) ? question.answer : (question.answer + 1) % 4;
      const key = index % 3 === 0 ? String(choice + 1) : index % 3 === 1 ? LETTERS[choice] : LETTERS[choice].toLowerCase();
      assert.ok(press(app, key).defaultPrevented, `${key} is handled on question ${index + 1}`);
      assert.ok(press(app, 'Enter').defaultPrevented, `Enter checks question ${index + 1}`);
      assert.equal(attemptOf(app).responses[index].checked, true);
      assert.ok(press(app, 'Enter').defaultPrevented, `Enter moves on from question ${index + 1}`);
    }
  }
  // Simulates a browser for one key press: the keydown is dispatched exactly once and, only if no handler
  // called preventDefault, the browser's own radio-group arrow move follows (focus, check, change event).
  function pressWithNativeRadio(app, key, options) {
    const event = press(app, key, options);
    const target = event.target;
    const step = NATIVE_RADIO_STEP[key];
    if (!event.defaultPrevented && step && target?.localName === 'input' && target.type === 'radio') {
      const group = radios(app).filter(radio => !radio.disabled);
      const at = group.indexOf(target);
      if (at !== -1) {
        const next = group[(at + step + group.length) % group.length];
        next.focus();
        next.click();
      }
    }
    return event;
  }
  function assertSelected(app, expected, message) {
    const response = attemptOf(app).responses[attemptOf(app).current];
    assert.equal(response.selected, expected, `${message}: option ${LETTERS[expected]} is selected`);
    assert.equal(response.checked, false, `${message}: nothing is submitted`);
    assert.deepEqual(radios(app).map(radio => radio.checked), [0, 1, 2, 3].map(index => index === expected), `${message}: only radio ${LETTERS[expected]} is checked`);
    assert.equal(app.document.activeElement, radios(app)[expected], `${message}: focus is on radio ${LETTERS[expected]}`);
    assert.match(radios(app)[expected].parentNode.getAttribute('class'), /option-selected/);
  }
  function stubScroll(app, { reducedMotion = false } = {}) {
    const calls = [];
    app.window.scrollBy = (...args) => { calls.push(typeof args[0] === 'object' ? { ...args[0] } : { left: args[0], top: args[1] }); };
    app.window.matchMedia = query => ({ media: query, matches: reducedMotion && /prefers-reduced-motion:\s*reduce/.test(query) });
    return calls;
  }
  function watchChanges(app) {
    const changes = [];
    radios(app).forEach((radio, index) => radio.addEventListener('change', () => changes.push(index)));
    return changes;
  }

  await T('keyboard hint sits under the quiz controls with <kbd> keys, a full shortcut list exists (with M), and both hide in print and on touch screens', () => {
    const app = loadApp();
    const quiz = byId(app, 'view-quiz');
    const hint = byId(app, 'keyboard-hint');
    const actions = quiz.children.find(node => node.getAttribute('class') === 'quiz-actions');
    assert.equal(hint.parentNode, quiz, 'the hint belongs to the quiz view');
    assert.ok(quiz.children.indexOf(hint) > quiz.children.indexOf(actions), 'the hint follows the question controls');
    const hintKeys = findAll(hint, node => node.localName === 'kbd').map(node => node.textContent);
    assert.deepEqual(hintKeys, ['→', 'A', 'D', 'Enter', '←', '↑', '↓', '?'], 'hint shows → / A–D, Enter, ←, ↑ ↓ and ?, each in its own <kbd>');
    assert.match(hint.textContent.replace(/\s+/g, ' '), /^Keyboard: → or A–D choose · Enter check \/ next · ← previous · ↑ ↓ scroll · \? help$/);
    const resultsHint = byId(app, 'results-keyboard-hint');
    assert.ok(findAll(byId(app, 'view-results'), node => node === resultsHint).length, 'results view has its own hint');
    assert.deepEqual(findAll(resultsHint, node => node.localName === 'kbd').map(node => node.textContent), ['R', 'C', 'M', '?']);
    const help = byId(app, 'keyboard-help');
    assert.equal(help.localName, 'details');
    assert.equal(findAll(help, node => node.localName === 'summary')[0]?.textContent, 'Keyboard shortcuts');
    const helpKeys = findAll(help, node => node.localName === 'kbd').map(node => node.textContent);
    for (const key of ['→', 'A', 'D', '1', '4', 'Enter', '←', '↑', '↓', 'N', 'Page Down', 'P', 'Page Up', 'R', 'C', 'M', 'S', '?', 'H']) assert.ok(helpKeys.includes(key), `help lists ${key}`);
    const helpText = help.textContent.replace(/\s+/g, ' ');
    assert.match(helpText, /→ ?Select the next answer: A, B, C, D, then back to A \(with nothing chosen yet, A\); it is not checked until you press Enter/);
    assert.match(helpText, /← ?Previous question \(your answers stay as they are\)/);
    assert.match(helpText, /↑ ↓ ?Scroll the page \(they never change your answer\)/);
    assert.match(helpText, /N or Page Down ?Also: next question/);
    assert.match(helpText, /P or Page Up ?Also: previous question/);
    assert.match(helpText, /M ?On the results page: retry only the questions you missed \(practice, not saved to the class history\)/);
    assert.equal(isShown(help), false, 'no shortcut list in the landing view');
    startConfirmed(app);
    assert.ok(isShown(help) && isShown(hint), 'hint and list show in the quiz view');
    for (const [id, keys] of [['btn-check', 'Enter'], ['btn-next', 'Enter N'], ['btn-prev', 'ArrowLeft P'], ['btn-finish', 'Enter'], ['btn-retake', 'R'], ['btn-choose', 'C'], ['btn-retry-missed', 'M'], ['btn-sound', 'S']]) {
      assert.equal(byId(app, id).getAttribute('aria-keyshortcuts'), keys, `${id} advertises its shortcut`);
    }
    const { rules } = parseCss(stylesheetText(builtHtml));
    const hides = (media, selector) => rules.some(rule => rule.media && media.test(rule.media) && rule.selectors.includes(selector) && /^none\b/.test(rule.declarations.get('display') ?? ''));
    for (const selector of ['.keyboard-hint', '.keyboard-help']) {
      assert.ok(hides(/^@media print$/, selector), `${selector} is hidden in print`);
      assert.ok(hides(/hover:\s*none\) and \(pointer:\s*coarse/, selector), `${selector} is hidden on touch screens`);
    }
    assert.ok(rules.some(rule => !rule.media && rule.selectors.includes('.keyboard-hint .hint-item') && rule.declarations.get('white-space') === 'nowrap'), 'hint items wrap as whole units at 375px');
    assert.ok(rules.some(rule => !rule.media && rule.selectors.includes('kbd')), '<kbd> is styled');
  });

  await T('keyboard: A-D and 1-4 select that option, focus its radio, never check it, and are ignored once checked', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    startConfirmed(app, 'easy');
    cues.length = 0;
    for (const [key, index] of [['b', 1], ['D', 3], ['1', 0], ['3', 2], ['A', 0], ['4', 3], ['c', 2]]) {
      const event = press(app, key);
      assert.equal(event.defaultPrevented, true, `${key} is handled`);
      const response = attemptOf(app).responses[0];
      assert.equal(response.selected, index, `${key} selects option ${index}`);
      assert.equal(response.checked, false, `${key} never checks the answer`);
      assert.ok(radios(app)[index].checked, `${key} checks radio ${index}`);
      assert.equal(app.document.activeElement, radios(app)[index], 'focus moves to the selected radio');
      assert.match(radios(app)[index].parentNode.getAttribute('class'), /option-selected/);
    }
    assert.deepEqual(cues, Array(7).fill('select'), 'one select tick per change, as when clicking');
    assert.equal(press(app, 'C').defaultPrevented, true);
    assert.equal(cues.length, 7, 're-choosing the selected option is silent, like clicking a checked radio');
    for (const key of ['e', '5', '0', 'x', ' ', 'm']) {
      assert.equal(press(app, key).defaultPrevented, false, `${JSON.stringify(key)} is not a quiz shortcut`);
    }
    assert.equal(attemptOf(app).responses[0].selected, 2);
    assert.equal(isShown(byId(app, 'answer-feedback')), false, 'nothing is submitted by choosing');
    press(app, 'Enter');
    assert.equal(attemptOf(app).responses[0].checked, true);
    for (const key of ['a', 'B', '4']) {
      assert.equal(press(app, key).defaultPrevented, false, `${key} is ignored once the answer is checked`);
      assert.equal(attemptOf(app).responses[0].selected, 2, 'a checked answer cannot change');
    }
  });

  await T('keyboard: shortcuts stay off in the landing view, while typing, with Ctrl/Alt/Meta, on key repeat and after another handler', () => {
    const app = loadApp();
    const nameInput = byId(app, 'student-name');
    nameInput.focus();
    for (const key of ['a', '1', 'Enter', 's', '?', 'h', 'n', 'r', 'c', 'm', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageDown']) {
      assert.equal(press(app, key).defaultPrevented, false, `${key} does nothing in the landing view`);
    }
    assert.equal(plain(app.api.getState()).soundEnabled, true);
    assert.equal(byId(app, 'keyboard-help').open, false);
    assert.equal(plain(app.api.getState()).view, 'landing');
    startConfirmed(app, 'medium');
    const textarea = app.document.createElement('textarea');
    const editable = app.document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const select = app.document.createElement('select');
    for (const target of [nameInput, textarea, editable, select]) {
      for (const key of ['a', '2', 'Enter', 's', '?', 'n', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
        assert.equal(press(app, key, { target }).defaultPrevented, false, `${key} in a ${target.localName} is left to typing`);
      }
    }
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
      for (const key of ['a', '2', 'Enter', 's', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
        assert.equal(press(app, key, { [modifier]: true }).defaultPrevented, false, `${modifier}+${key} is left alone`);
      }
    }
    for (const key of ['b', '2', 'Enter', 's', '?', 'ArrowLeft', 'n', 'p', 'PageUp']) {
      assert.equal(press(app, key, { repeat: true }).defaultPrevented, false, `a held ${key} does not repeat`);
    }
    app.document.dispatchEvent(keyEvent(app.document, 'b', { defaultPrevented: true }));
    const state = plain(app.api.getState());
    assert.equal(state.attempt.responses[0].selected, null, 'none of those keys chose an answer');
    assert.equal(state.soundEnabled, true);
    assert.equal(byId(app, 'keyboard-help').open, false);
    assert.ok(press(app, 'b', { shiftKey: true }).defaultPrevented, 'Shift is allowed (B and b both choose)');
    assert.equal(attemptOf(app).responses[0].selected, 1);
  });

  await T('keyboard: Enter checks, then moves on; with nothing chosen it shows the same validation as the button; native Enter on buttons is not doubled', () => {
    const clicked = loadApp();
    startConfirmed(clicked, 'hard');
    byId(clicked, 'btn-check').click();
    const buttonMessage = byId(clicked, 'validation-message').textContent;
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    startConfirmed(app, 'hard');
    assert.ok(press(app, 'Enter').defaultPrevented);
    assert.ok(isShown(byId(app, 'validation-message')));
    assert.equal(byId(app, 'validation-message').textContent, buttonMessage, 'same message as the Check answer button');
    assert.match(buttonMessage, /Select an answer before pressing Check answer/);
    assert.equal(app.document.activeElement?.id, 'validation-message');
    assert.equal(cues.at(-1), 'error');
    assert.equal(attemptOf(app).current, 0, 'no advance without an answer');
    assert.equal(attemptOf(app).responses[0].checked, false);
    const [first] = attemptOf(app).questions;
    press(app, LETTERS[first.answer]);
    assert.equal(isShown(byId(app, 'validation-message')), false, 'choosing clears the message');
    for (const id of ['btn-check', 'btn-prev']) {
      assert.equal(press(app, 'Enter', { target: byId(app, id) }).defaultPrevented, false, `Enter on #${id} is native`);
    }
    const summary = findAll(byId(app, 'keyboard-help'), node => node.localName === 'summary')[0];
    assert.equal(press(app, 'Enter', { target: summary }).defaultPrevented, false, 'Enter on the summary toggles natively');
    assert.equal(press(app, 'Enter', { target: app.document.createElement('a') }).defaultPrevented, false, 'Enter on a link is native');
    assert.equal(attemptOf(app).responses[0].checked, false, 'none of those checked the answer');
    assert.ok(press(app, 'Enter').defaultPrevented, 'Enter on the focused radio checks');
    assert.equal(attemptOf(app).responses[0].checked, true);
    assert.equal(cues.at(-1), 'correct');
    assert.equal(app.document.activeElement?.id, 'answer-feedback', 'focus lands on the feedback');
    assert.match(byId(app, 'answer-feedback').textContent, /^\s*Correct\./);
    assert.match(byId(app, 'quiz-status').textContent, new RegExp(`1 of ${count('hard')} answers checked`), 'the live status announces progress');
    assert.ok(press(app, 'Enter').defaultPrevented, 'Enter again moves on');
    assert.equal(attemptOf(app).current, 1);
    assert.equal(app.document.activeElement?.id, 'question-heading', 'focus moves to the new question heading');
    assert.equal(byId(app, 'question-heading').textContent, `Question 2 of ${count('hard')}`);
  });

  await T('keyboard: → cycles A, B, C, D, A from nothing selected, selects without checking, focuses the radio, and does nothing once checked', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    const scrolls = stubScroll(app);
    startConfirmed(app, 'easy');
    cues.length = 0;
    assert.equal(attemptOf(app).responses[0].selected, null);
    for (const expected of [0, 1, 2, 3, 0]) {
      assert.equal(press(app, 'ArrowRight').defaultPrevented, true, '→ is handled');
      assertSelected(app, expected, '→');
    }
    assert.deepEqual(cues, Array(5).fill('select'), 'one select tick per → press');
    assert.equal(attemptOf(app).current, 0, '→ never leaves the question');
    assert.equal(isShown(byId(app, 'answer-feedback')), false, '→ never submits');
    assert.ok(isShown(byId(app, 'btn-check')), 'Check answer is still waiting');
    assert.deepEqual(scrolls, [], '→ does not scroll');
    assert.ok(press(app, 'ArrowRight', { repeat: true }).defaultPrevented, 'holding → keeps cycling');
    assertSelected(app, 1, 'held →');
    assert.ok(press(app, 'Enter').defaultPrevented);
    assert.equal(attemptOf(app).responses[0].checked, true);
    const tally = cues.length;
    for (const target of [app.document.activeElement, app.document.body, byId(app, 'question-heading'), byId(app, 'btn-next')]) {
      assert.equal(press(app, 'ArrowRight', { target }).defaultPrevented, false, `→ on ${target.id || target.localName} does nothing once checked`);
      assert.equal(attemptOf(app).current, 0, '→ never navigates');
      assert.equal(attemptOf(app).responses[0].selected, 1, 'a checked answer cannot change');
    }
    assert.equal(cues.length, tally, 'no sound either');
  });

  await T('keyboard: one → press changes the selection exactly once, whatever has focus, and suppresses the native radio arrow move', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    startConfirmed(app, 'hard');
    const changes = watchChanges(app);
    cues.length = 0;
    const targets = [
      () => app.document.body,
      () => byId(app, 'btn-check'),
      () => byId(app, 'btn-sound'),
      () => byId(app, 'question-heading'),
      () => app.document.activeElement,
      () => radios(app)[(attemptOf(app).responses[0].selected + 2) % 4],
    ];
    let expected = null;
    for (let round = 0; round < 12; round++) {
      const target = targets[round % targets.length]();
      expected = expected === null ? 0 : (expected + 1) % 4;
      const before = cues.length;
      const event = pressWithNativeRadio(app, 'ArrowRight', { target });
      assert.equal(event.defaultPrevented, true, `→ on ${target.id || target.localName} is handled and the native move is suppressed`);
      assertSelected(app, expected, `→ on ${target.id || target.localName}`);
      assert.equal(cues.length - before, 1, '→ changes the selection exactly once');
    }
    assert.deepEqual(changes, [], 'the native radio-group move never ran on top of the shortcut');
    const before = attemptOf(app).responses[0].selected;
    const event = pressWithNativeRadio(app, 'ArrowRight', { ctrlKey: true, target: radios(app)[before] });
    assert.equal(event.defaultPrevented, false);
    assert.equal(attemptOf(app).responses[0].selected, (before + 1) % 4, 'exactly one step, from the browser alone');
    assert.deepEqual(changes, [(before + 1) % 4]);
  });

  await T('keyboard: ← goes to the previous question (also after Check), focuses the heading, never changes an answer, does nothing on question 1 and ignores key repeat', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    const changes = watchChanges(app);
    for (const target of [app.document.body, byId(app, 'question-heading')]) {
      assert.equal(press(app, 'ArrowLeft', { target }).defaultPrevented, false, `← on ${target.id || target.localName} does nothing on question 1`);
      assert.equal(attemptOf(app).current, 0);
    }
    press(app, 'b');
    let event = pressWithNativeRadio(app, 'ArrowLeft');
    assert.equal(event.defaultPrevented, true, '← on a focused answer on question 1 still blocks the native radio move');
    assert.equal(attemptOf(app).current, 0);
    assertSelected(app, 1, '← on question 1');
    assert.deepEqual(changes, [], 'the selection never moved');
    press(app, 'Enter');
    press(app, 'Enter');
    assert.equal(attemptOf(app).current, 1);
    press(app, 'ArrowRight');
    press(app, 'ArrowRight');
    assert.equal(attemptOf(app).responses[1].selected, 1);
    event = pressWithNativeRadio(app, 'ArrowLeft');
    assert.equal(event.defaultPrevented, true, '← goes back from an unchecked question, even with an answer focused');
    assert.equal(attemptOf(app).current, 0);
    assert.equal(app.document.activeElement?.id, 'question-heading', 'focus moves to the heading, as with Previous question');
    assert.equal(attemptOf(app).responses[1].selected, 1, 'the unchecked answer on question 2 was kept');
    assert.equal(attemptOf(app).responses[0].selected, 1, 'the checked answer on question 1 is unchanged');
    assert.equal(press(app, 'ArrowRight').defaultPrevented, false, '→ never navigates, even from a checked question');
    assert.equal(attemptOf(app).current, 0);
    assert.ok(press(app, 'n').defaultPrevented);
    assert.equal(attemptOf(app).current, 1);
    press(app, 'Enter');
    assert.equal(attemptOf(app).responses[1].checked, true);
    assert.ok(press(app, 'ArrowLeft').defaultPrevented, '← goes back after Check too');
    assert.equal(attemptOf(app).current, 0);
    assert.equal(app.document.activeElement?.id, 'question-heading');
    press(app, 'Enter');
    press(app, 'Enter');
    assert.equal(attemptOf(app).current, 2);
    assert.equal(press(app, 'ArrowLeft', { repeat: true }).defaultPrevented, false, 'a held ← does not skip questions');
    assert.equal(attemptOf(app).current, 2);
    press(app, 'a');
    event = pressWithNativeRadio(app, 'ArrowLeft', { repeat: true });
    assert.equal(event.defaultPrevented, true, 'a held ← on a focused answer still blocks the native radio move');
    assert.equal(attemptOf(app).current, 2);
    assertSelected(app, 0, 'held ← on question 3');
    for (const expected of [1, 0]) {
      assert.ok(press(app, 'ArrowLeft').defaultPrevented);
      assert.equal(attemptOf(app).current, expected);
    }
    assert.equal(press(app, 'ArrowLeft').defaultPrevented, false, 'no wrap-around before question 1');
    assert.equal(attemptOf(app).current, 0);
    assert.deepEqual(attemptOf(app).responses.slice(0, 3).map(response => response.selected), [1, 1, 0], '← never changed an answer');
    const done = loadApp();
    startConfirmed(done, 'easy');
    completeAttempt(done);
    const last = count('easy') - 1;
    assert.equal(attemptOf(done).current, last);
    assert.equal(press(done, 'ArrowRight', { target: done.document.body }).defaultPrevented, false, '→ never moves past the last question');
    assert.equal(attemptOf(done).current, last);
    assert.ok(press(done, 'ArrowLeft', { target: done.document.body }).defaultPrevented);
    assert.equal(attemptOf(done).current, last - 1);
  });

  await T('keyboard: ↑/↓ only scroll the page: native off a radio, a manual ±80px scroll on a focused answer; never a change of answer or question', () => {
    const app = loadApp();
    const scrolls = stubScroll(app);
    startConfirmed(app, 'medium');
    const changes = watchChanges(app);
    for (const target of [app.document.body, byId(app, 'question-heading'), byId(app, 'btn-check'), byId(app, 'btn-sound')]) {
      for (const key of ['ArrowDown', 'ArrowUp']) {
        assert.equal(press(app, key, { target }).defaultPrevented, false, `${key} on ${target.id || target.localName} is left to the browser's own scrolling`);
      }
    }
    assert.deepEqual(scrolls, [], 'native scrolling needs no help');
    assert.equal(attemptOf(app).responses[0].selected, null, '↑/↓ never choose an answer');
    assert.equal(attemptOf(app).current, 0);
    press(app, 'c');
    for (const [key, top, options] of [['ArrowDown', 80], ['ArrowUp', -80], ['ArrowDown', 80, { repeat: true }], ['ArrowUp', -80, { repeat: true }]]) {
      const event = pressWithNativeRadio(app, key, options);
      assert.equal(event.defaultPrevented, true, `${key} on a focused answer cancels the native radio move`);
      assert.deepEqual(scrolls.at(-1), { top, left: 0, behavior: 'smooth' }, `${key} scrolls the window by ${top}px`);
      assertSelected(app, 2, `${key} on a focused answer`);
      assert.equal(attemptOf(app).current, 0);
    }
    assert.equal(scrolls.length, 4, 'one scroll per press, held keys included');
    assert.deepEqual(changes, [], 'the selection never moved');
    press(app, 'Enter');
    assert.equal(attemptOf(app).responses[0].checked, true);
    for (const key of ['ArrowDown', 'ArrowUp']) {
      assert.equal(press(app, key, { target: app.document.body }).defaultPrevented, false, `${key} does not navigate after Check`);
      assert.equal(attemptOf(app).current, 0);
      assert.equal(attemptOf(app).responses[0].selected, 2);
    }
    const calm = loadApp();
    const calmScrolls = stubScroll(calm, { reducedMotion: true });
    startConfirmed(calm, 'easy');
    press(calm, 'a');
    assert.ok(press(calm, 'ArrowDown').defaultPrevented);
    assert.deepEqual(calmScrolls, [{ top: 80, left: 0, behavior: 'auto' }], 'prefers-reduced-motion: an instant scroll');
    const bare = loadApp();
    startConfirmed(bare, 'easy');
    press(bare, 'd');
    assert.ok(press(bare, 'ArrowUp').defaultPrevented, 'without window.scrollBy the radio still does not move');
    assertSelected(bare, 3, '↑ without scrollBy');
    assert.deepEqual(bare.consoleErrors, []);
  });

  await T('keyboard: N/P and Page Down/Page Up stay quiet aliases for next / previous question (no skip, no wrap)', () => {
    const app = loadApp();
    startConfirmed(app, 'easy');
    for (const key of ['p', 'P', 'PageUp', 'n', 'N', 'PageDown']) {
      assert.equal(press(app, key).defaultPrevented, false, `${key} cannot leave an unchecked question 1`);
      assert.equal(attemptOf(app).current, 0);
    }
    press(app, 'a');
    press(app, 'Enter');
    for (const [key, expected] of [['N', 1], ['p', 0], ['PageDown', 1], ['PageUp', 0], ['n', 1]]) {
      assert.ok(press(app, key).defaultPrevented, `${key} navigates`);
      assert.equal(attemptOf(app).current, expected);
      assert.equal(app.document.activeElement?.id, 'question-heading');
    }
    for (const key of ['n', 'N', 'PageDown']) {
      assert.equal(press(app, key).defaultPrevented, false, `${key} cannot skip the unchecked question 2`);
      assert.equal(attemptOf(app).current, 1);
    }
    press(app, 'b');
    assert.ok(press(app, 'P', { target: radios(app)[1] }).defaultPrevented, 'P still goes back from a focused answer');
    assert.equal(attemptOf(app).current, 0);
    assert.equal(attemptOf(app).responses[1].selected, 1);
    const done = loadApp();
    startConfirmed(done, 'easy');
    completeAttempt(done);
    for (const key of ['n', 'PageDown']) {
      assert.equal(press(done, key, { target: done.document.body }).defaultPrevented, false, `${key}: no wrap-around past the last question`);
      assert.equal(attemptOf(done).current, count('easy') - 1);
    }
    done.api.goToQuestion(0);
    for (const key of ['p', 'PageUp']) {
      assert.equal(press(done, key).defaultPrevented, false, `${key}: no wrap-around before the first question`);
      assert.equal(attemptOf(done).current, 0);
    }
  });

  await T('keyboard: a full run choosing with → only (Enter to check and go on) scores like clicking', () => {
    const app = loadApp();
    app.api.setRandom(seededRandom(5));
    startConfirmed(app, 'medium');
    for (let index = 0; index < KEY_TOTAL; index++) {
      const answer = attemptOf(app).questions[index].answer;
      for (let step = 0; step <= answer; step++) press(app, 'ArrowRight');
      assert.equal(attemptOf(app).responses[index].selected, answer);
      press(app, 'Enter');
      press(app, 'Enter');
    }
    const state = plain(app.api.getState());
    assert.equal(state.view, 'results');
    assert.equal(state.results.score, KEY_TOTAL);
  });

  await T('keyboard: a full run by keyboard alone matches clicking, including results, sound cues and the history submission', async () => {
    const wrong = new Set([2, 7, 8, 19]);
    const run = async useKeyboard => {
      const fetch = fakeFetch(call => (call.method === 'POST' ? { body: { ok: true } } : okHistory([])));
      const app = loadApp(configuredHtml, { fetch });
      await settle(app);
      const cues = [];
      app.api.setSoundPlayer(cue => cues.push(cue));
      app.api.setRandom(seededRandom(11));
      startConfirmed(app, 'medium', 'Maria Santos');
      if (useKeyboard) {
        completeAttemptByKeyboard(app, index => !wrong.has(index));
      } else {
        completeAttempt(app, index => !wrong.has(index));
        byId(app, 'btn-finish').click();
      }
      await settle(app);
      const posts = fetch.calls.filter(call => call.method === 'POST');
      assert.equal(posts.length, 1, 'one history submission');
      return { app, cues, payload: { ...JSON.parse(posts[0].body), finishedAt: undefined }, state: plain(app.api.getState()) };
    };
    const clicked = await run(false);
    const keyed = await run(true);
    assert.equal(keyed.state.view, 'results', 'the final Enter shows the results');
    assert.equal(keyed.app.document.activeElement?.id, 'results-heading');
    assert.deepEqual(keyed.state.results, clicked.state.results, 'same scored results');
    assert.deepEqual(keyed.state.attempt, clicked.state.attempt, 'same recorded answers');
    assert.deepEqual(keyed.payload, clicked.payload, 'same history payload');
    const misses = [...wrong].filter(index => index < KEY_TOTAL).length;
    const score = KEY_TOTAL - misses;
    assert.deepEqual({ ...keyed.payload, asked: undefined, missed: undefined }, { lesson: lesson.key, name: 'Maria Santos', mode: 'medium', score, total: KEY_TOTAL, percent: percentOf(score, KEY_TOTAL), band: bandFor(percentOf(score, KEY_TOTAL)), finishedAt: undefined, asked: undefined, missed: undefined });
    assert.equal(keyed.payload.missed.length, misses);
    assert.deepEqual(keyed.cues, clicked.cues, 'same cues in the same order: start, select, correct/incorrect, finish');
    assert.equal(keyed.cues.filter(cue => cue === 'select').length, KEY_TOTAL);
    assert.match(keyed.app.document.getElementById('history-save-message').textContent, /Saved to the class history/);
  });

  await T('keyboard: R retakes and C chooses another difficulty on results; S toggles sound; ? and H toggle the shortcut list', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    startConfirmed(app, 'hard');
    const toggle = byId(app, 'btn-sound');
    assert.ok(press(app, 's').defaultPrevented);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.match(byId(app, 'sound-state').textContent, /Off/);
    assert.equal(plain(app.api.getState()).soundEnabled, false);
    const muted = cues.length;
    press(app, 'a');
    assert.equal(cues.length, muted, 'S really mutes the cues');
    assert.ok(press(app, 'S').defaultPrevented);
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.match(byId(app, 'sound-state').textContent, /On/);
    const help = byId(app, 'keyboard-help');
    assert.ok(press(app, '?', { shiftKey: true }).defaultPrevented);
    assert.equal(help.open, true, '? opens the list');
    assert.ok(press(app, '?', { shiftKey: true }).defaultPrevented);
    assert.equal(help.open, false, '? closes it again');
    press(app, 'h');
    assert.equal(help.open, true);
    press(app, 'H');
    assert.equal(help.open, false);
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    assert.equal(plain(app.api.getState()).view, 'results');
    assert.ok(isShown(help), 'the shortcut list is available on the results page');
    press(app, '?');
    assert.equal(help.open, true);
    press(app, '?');
    for (const key of ['a', '1', 'n', 'p', 'm', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp']) {
      assert.equal(press(app, key).defaultPrevented, false, `${key} does nothing on this results page`);
    }
    assert.equal(plain(app.api.getState()).view, 'results');
    const before = attemptOf(app).questions.map(item => item.id);
    assert.ok(press(app, 'R').defaultPrevented, 'R retakes');
    let state = plain(app.api.getState());
    assert.equal(state.view, 'quiz');
    assert.equal(state.attempt.mode, 'hard', 'same difficulty');
    assert.ok(state.attempt.responses.every(response => response.selected === null && !response.checked), 'a clean attempt');
    assert.ok(state.attempt.questions.length === count('hard') && before.length === count('hard'));
    assert.equal(app.document.activeElement?.id, 'question-heading');
    assert.equal(cues.at(-1), 'start');
    assert.equal(press(app, 'r').defaultPrevented, false, 'R does nothing during the quiz');
    assert.equal(press(app, 'c').defaultPrevented, true, 'C is option C during the quiz');
    assert.equal(attemptOf(app).responses[0].selected, 2);
    completeAttempt(app);
    byId(app, 'btn-finish').click();
    assert.ok(press(app, 'c').defaultPrevented, 'C chooses another difficulty');
    state = plain(app.api.getState());
    assert.equal(state.view, 'landing');
    assert.equal(state.attempt, null);
    assert.equal(app.document.activeElement?.id, 'difficulty-heading');
    assert.equal(isShown(help), false);
    assert.equal(press(app, 's').defaultPrevented, false, 'S is off in the landing view so the name field can be typed in');
  });

  await T('keyboard: exactly one keydown listener, never re-registered by retakes, practice retries or resets', () => {
    const app = loadApp();
    const cues = [];
    app.api.setSoundPlayer(cue => cues.push(cue));
    assert.equal(app.document.listenerCount('keydown'), 1, 'one document keydown listener');
    for (let round = 0; round < 3; round++) {
      if (round === 0) startConfirmed(app, MODES[round]); else byId(app, `mode-${MODES[round]}`).click();
      completeAttempt(app, index => index !== 1);
      byId(app, 'btn-finish').click();
      press(app, 'm');
      completeAttempt(app);
      byId(app, 'btn-finish').click();
      byId(app, 'btn-retake').click();
      completeAttemptByKeyboard(app);
      press(app, 'c');
      assert.equal(app.document.listenerCount('keydown'), 1, `still one listener after round ${round + 1}`);
    }
    assert.equal(findAll(app.document.root, node => (node.listeners.get('keydown') ?? []).length > 0).length, 0, 'no per-element keydown listeners');
    byId(app, 'mode-easy').click();
    cues.length = 0;
    press(app, 'a');
    assert.deepEqual(cues, ['select'], 'one key press acts once');
    press(app, 'Enter');
    assert.equal(cues.length, 2, 'one check per Enter');
    press(app, 'Enter');
    assert.equal(attemptOf(app).current, 1, 'one advance per Enter');
  });
}
