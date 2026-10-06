// Builds the whole site from lessons/ and src/:
//   index.html                 the hub (src/hub/template.html; MODULES generated from lessons/*/lesson.json)
//   <slug>/index.html          one quiz page per lesson or pool exam (src/engine/template.html)
//   instructor/index.html      the instructor's question analysis (src/instructor/template.html)
//   class/index.html           the class page (src/class/template.html, data/class.json)
//   schedule/index.html        this week's training schedule (src/schedule/template.html, data/schedule.json)
//
//   node scripts/build.mjs                         build into the repository (what GitHub Pages serves)
//   node scripts/build.mjs --out DIR --endpoint ""  build a copy elsewhere, e.g. a local preview with class
//                                                  history switched off (no request ever reaches the sheet)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const MODES = ['easy', 'medium', 'hard'];
export const MODE_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const MODE_LETTERS = { easy: 'e', medium: 'm', hard: 'h' };
// The Google Apps Script web app behind the shared class history (apps-script/Code.gs). The only
// network address any page contacts; written into every page by the build.
export const HISTORY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwTNNYOiebIGo46PzM3fUA9VT6XnS740D72prOPg-0OJ5Kvg4W8LVl-xJEo_gxImxqnmg/exec';
// A lesson bank holds 1..MAX_BANK_SIZE (50) questions per difficulty (owner rule). A lesson attempt serves the whole
// bank, so MAX_ATTEMPT_SIZE equals the bank cap; a pool exam draws its own count (see POOL_MIN_ATTEMPT).
export const MAX_BANK_SIZE = 50;
export const MAX_ATTEMPT_SIZE = 50;
// A pool (combined) exam asks POOL_MIN_ATTEMPT..POOL_MAX_ATTEMPT questions per attempt (owner rule).
export const POOL_MIN_ATTEMPT = 50;
export const POOL_MAX_ATTEMPT = 69;
export const LESSON_KEY_PATTERN = /^[a-z][a-z0-9]{1,23}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['assets', 'src', 'lessons', 'scripts', 'apps-script', 'instructor', 'class', 'data', 'schedule']);
// Art expectations checked by the tests when a lesson.json gives none (a lesson may also ship no hero.css).
const DEFAULT_ART = { groups: [], nested: {}, labels: [], classes: [], stilled: [], staticPattern: '\\.hero-art' };

const DEFAULT_TEXT = {
  studyWarningLead: 'This mock examination is a practice aid only.',
  studyWarningBody: 'It cannot replace studying the complete {lessonName} lesson, and repeated attempts are not a substitute for that study.',
  studyConfirm: 'I understand that I must study the complete lesson and not rely only on this mock examination.',
  resultsReminder: 'This score is practice feedback only. Study the complete lesson; do not rely only on this mock examination.',
  modeDescPrefix: '{attempt} questions per attempt.',
  topicNoun: 'Topic',
  topicsHeading: 'Topic analysis',
  topicsCaption: 'Correct answers by primary topic. A topic is a strength at 75% or higher and a gap below 75%; the line on each bar marks 75%.',
  gapsHeading: 'Gaps to review in the lesson',
  strengthsEmpty: 'No topic reached 75% in this attempt.',
  gapsEmpty: 'No gaps in this attempt. Keep studying the complete lesson.',
  bands: [
    'Consistent command of the lesson at this difficulty.',
    'Solid understanding. Restudy the topics listed as gaps.',
    'Partial understanding. Restudy the lesson before retaking.',
    'Study the complete lesson again before another attempt.',
  ],
};
const DEFAULT_LEDE = 'A practice aid for the {lessonName} lesson: {total} situational questions across Easy, Medium, and Hard.';

// ---------------------------------------------------------------------------
// Question validation (mirrored error-for-error by validateQuestion/validateBank in the engine).
// rules: { key, categoryOrder, ref: { label, min, max, required } | null, pool: { lessons: [{ key, name }], count } | null }
// ---------------------------------------------------------------------------

// The terms a question teaches: its tags and its topic (category), each once. Mirrors the engine.
export function questionTerms(question) {
  const terms = [];
  for (const term of [...(Array.isArray(question.tags) ? question.tags : []), question.category]) {
    if (typeof term === 'string' && term.trim() && !terms.includes(term)) terms.push(term);
  }
  return terms;
}

// Number of questions in a deterministic greedy set cover of every term (most new terms first, then bank order).
// Used by the tests and by the pool exam's per-lesson shares; mirrors coverLength in the engine.
export function coverSize(bank) {
  const lists = bank.map(questionTerms);
  const uncovered = new Set(lists.flat());
  const taken = new Set();
  let picks = 0;
  for (;;) {
    let best = -1;
    let bestGain = 0;
    lists.forEach((terms, index) => {
      if (taken.has(index)) return;
      const gain = terms.filter(term => uncovered.has(term)).length;
      if (gain > bestGain) { best = index; bestGain = gain; }
    });
    if (best === -1) return picks;
    taken.add(best);
    picks++;
    lists[best].forEach(term => uncovered.delete(term));
  }
}

// A lesson attempt serves the whole bank of the mode (at most 50). Mirrors attemptLength in the engine.
export function attemptLength(bank) {
  return Math.min(MAX_ATTEMPT_SIZE, bank.length);
}

export function poolQuotas(count, lessons) {
  const base = Math.floor(count / lessons);
  const extra = count % lessons;
  return Array.from({ length: lessons }, (_, index) => (index < extra ? base + 1 : base));
}

function qidPrefix(owner, mode) {
  return `${LESSON_KEY_PATTERN.test(owner) ? owner : '<lesson>'}-${MODE_LETTERS[mode]}-`;
}

export function validateQuestion(question, expectedDifficulty, expectedId, rules) {
  if (question === null || typeof question !== 'object' || Array.isArray(question)) {
    return ['question must be an object'];
  }
  const errors = [];
  if (!Number.isInteger(question.id) || question.id !== expectedId) {
    errors.push(`id must be integer ${expectedId}`);
  }
  const owner = rules.pool ? question.lessonKey : rules.key;
  if (rules.pool) {
    const source = rules.pool.lessons.find(lesson => lesson.key === question.lessonKey);
    if (!source) errors.push('lessonKey must name one of the pool lessons');
    else if (question.lesson !== source.name || question.category !== source.name) errors.push('lesson and category must both name the source lesson');
  }
  const prefix = qidPrefix(owner, expectedDifficulty);
  if (typeof question.qid !== 'string' || !question.qid.startsWith(prefix) || !/^[0-9]{2,4}$/.test(question.qid.slice(prefix.length))) {
    errors.push(`qid must be "${prefix}" followed by 2 to 4 digits`);
  }
  if (question.difficulty !== expectedDifficulty) {
    errors.push(`difficulty must be ${expectedDifficulty}`);
  }
  for (const field of ['category', 'prompt', 'explanation']) {
    if (typeof question[field] !== 'string' || !question[field].trim()) {
      errors.push(`${field} must be a nonempty string`);
    }
  }
  if (!rules.pool && typeof question.category === 'string' && question.category.trim() && !rules.categoryOrder.includes(question.category)) {
    errors.push('category must be one of the lesson topics');
  }
  if (!Array.isArray(question.tags) || question.tags.some(tag => typeof tag !== 'string' || !tag.trim())) {
    errors.push('tags must be an array of nonempty strings');
  }
  if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => typeof option !== 'string' || !option.trim())) {
    errors.push('options must contain four nonempty strings');
  }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
    errors.push('answer must be an integer from 0 to 3');
  }
  if (rules.ref) {
    if (rules.ref.required || question.sourceSlides !== undefined) {
      if (!Array.isArray(question.sourceSlides) || question.sourceSlides.length === 0 || question.sourceSlides.some(slide => !Number.isInteger(slide) || slide < rules.ref.min || slide > rules.ref.max)) {
        errors.push(`sourceSlides${rules.ref.required ? '' : ', when present,'} must contain integers from ${rules.ref.min} to ${rules.ref.max}`);
      }
    }
  } else if (question.sourceSlides !== undefined) {
    errors.push('sourceSlides must be absent in a pool exam (the reference is in the explanation)');
  }
  return errors;
}

export function validateBank(bank, mode, rules) {
  if (!Array.isArray(bank)) return ['bank must be an array of questions'];
  const errors = [];
  if (bank.length < 1) errors.push('bank must contain at least 1 question');
  if (!rules.pool && bank.length > MAX_BANK_SIZE) errors.push(`bank must contain at most ${MAX_BANK_SIZE} questions (found ${bank.length})`);
  const seen = new Set();
  bank.forEach((question, index) => {
    for (const error of validateQuestion(question, mode, index + 1, rules)) errors.push(`question ${index + 1}: ${error}`);
    if (question !== null && typeof question === 'object' && typeof question.qid === 'string') {
      if (seen.has(question.qid)) errors.push(`question ${index + 1}: qid ${question.qid} is used more than once`);
      seen.add(question.qid);
    }
  });
  if (rules.pool) {
    const need = poolQuotas(rules.pool.count, rules.pool.lessons.length)[0];
    for (const lesson of rules.pool.lessons) {
      const found = bank.filter(question => question && question.lessonKey === lesson.key).length;
      if (found < need) errors.push(`bank must contain at least ${need} ${lesson.name} questions (found ${found})`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path}: ${error.code === 'ENOENT' ? 'file is missing' : error.message}`);
  }
}

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match));
}

export function checkLessonConfig(config, dir) {
  const fail = message => { throw new Error(`${join(dir, 'lesson.json')}: ${message}`); };
  if (!LESSON_KEY_PATTERN.test(config.key ?? '')) fail('key must be 2-24 lowercase letters or digits, starting with a letter');
  if (config.key !== dir.split(/[\\/]/).at(-1)) fail(`key "${config.key}" must match the folder name`);
  if (!SLUG_PATTERN.test(config.slug ?? '') || RESERVED_SLUGS.has(config.slug)) fail('slug must be a lowercase URL folder name and not a reserved folder');
  if (config.historyLesson !== config.key) fail('historyLesson must equal key (it names the history tab in apps-script/Code.gs)');
  for (const field of ['module', 'name', 'title', 'eyebrow', 'hubDescription']) {
    if (typeof config[field] !== 'string' || !config[field].trim()) fail(`${field} must be a nonempty string`);
  }
  if (!Number.isInteger(config.order)) fail('order must be an integer');
  if (config.pool) {
    if (!Array.isArray(config.pool.lessons) || config.pool.lessons.length < 2) fail('pool.lessons must list at least two lesson keys');
    if (!Number.isInteger(config.pool.count)) fail('pool.count must be an integer');
    const min = config.module === 'module-3' ? 45 : POOL_MIN_ATTEMPT;
    const max = config.module === 'module-3' ? 50 : POOL_MAX_ATTEMPT;
    if (config.pool.count < min || config.pool.count > max) fail(`pool.count (the attempt length) must be from ${min} to ${max}`);
    if (typeof config.lede !== 'string') fail('a pool exam needs its own lede');
  } else {
    if (typeof config.lessonName !== 'string' || !config.lessonName.trim()) fail('lessonName must be a nonempty string');
    if (!Array.isArray(config.categoryOrder) || !config.categoryOrder.length || config.categoryOrder.some(item => typeof item !== 'string' || !item.trim())) fail('categoryOrder must list the lesson topics');
    if (new Set(config.categoryOrder).size !== config.categoryOrder.length) fail('categoryOrder has duplicates');
    const ref = config.sourceRef;
    if (!ref || typeof ref.label !== 'string' || typeof ref.plural !== 'string' || !Number.isInteger(ref.min) || !Number.isInteger(ref.max) || ref.min > ref.max || typeof ref.required !== 'boolean') {
      fail('sourceRef must be { label, plural, min, max, required }');
    }
  }
  for (const [name, value] of Object.entries(config.palette ?? {})) {
    if (!/^--[a-z0-9-]+$/.test(name) || !/^[#a-z0-9(),.\s%-]+$/i.test(String(value))) fail(`palette entry ${name} is not a plain CSS custom property`);
  }
}

function lessonRules(config, lessonsByKey) {
  if (config.pool) {
    return {
      key: config.key,
      categoryOrder: config.pool.lessons.map(key => lessonsByKey.get(key).name),
      ref: null,
      pool: { count: config.pool.count, lessons: config.pool.lessons.map(key => ({ key, name: lessonsByKey.get(key).name })) },
    };
  }
  return { key: config.key, categoryOrder: config.categoryOrder, ref: { ...config.sourceRef }, pool: null };
}

function reference(source, slides) {
  if (!Array.isArray(slides) || !slides.length) return '';
  const unit = slides.length === 1 ? source.sourceRef.label : source.sourceRef.plural;
  return ` (${source.name}, ${unit} ${slides.join(', ')})`;
}

// A pool exam's bank for one difficulty: every question of that difficulty from each source lesson, in lesson
// order, renumbered 1..n. `category` and `lesson` become the lesson name so the results analysis reports by
// lesson; slide/page numbers only make sense inside their own lesson, so sourceSlides becomes a reference at
// the end of the explanation, e.g. "(Armor Operations, page 31)". qid and option order stay as authored.
export function buildPoolBank(config, lessonsByKey, mode) {
  const merged = [];
  for (const key of config.pool.lessons) {
    const source = lessonsByKey.get(key);
    for (const item of source.banks[mode]) {
      merged.push({
        id: merged.length + 1,
        qid: item.qid,
        lessonKey: key,
        difficulty: mode,
        category: source.name,
        lesson: source.name,
        tags: item.tags,
        prompt: item.prompt,
        options: item.options,
        answer: item.answer,
        explanation: item.explanation.trim() + reference(source, item.sourceSlides),
      });
    }
  }
  return merged;
}

// Reads every lessons/<key>/lesson.json (and its banks), validates them and returns the lessons in hub order.
export function loadLessons(root = ROOT) {
  const lessonsDir = join(root, 'lessons');
  const modules = readJson(join(lessonsDir, 'modules.json'));
  if (!Array.isArray(modules) || !modules.length || modules.some(module => !/^module-\d+$/.test(module.id ?? '') || typeof module.title !== 'string')) {
    throw new Error(`${join(lessonsDir, 'modules.json')}: must list modules as { id: "module-N", title, note? }`);
  }
  const lessons = [];
  for (const entry of readdirSync(lessonsDir, { withFileTypes: true })) {
    // Folders starting with "_" (for example lessons/_template) are documentation, not lessons.
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = join(lessonsDir, entry.name);
    const config = readJson(join(dir, 'lesson.json'));
    checkLessonConfig(config, dir);
    if (!modules.some(module => module.id === config.module)) throw new Error(`${join(dir, 'lesson.json')}: module ${config.module} is not in lessons/modules.json`);
    if (!existsSync(join(dir, 'hero.svg'))) throw new Error(`${join(dir, 'hero.svg')}: file is missing`);
    config.dir = dir;
    config.heroSvg = readFileSync(join(dir, 'hero.svg'), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    if (!/^<svg\b[^>]*\baria-hidden="true"[^>]*\bfocusable="false"/.test(config.heroSvg) || /<script\b|\son\w+=|<foreignObject\b|href=/i.test(config.heroSvg)) {
      throw new Error(`${join(dir, 'hero.svg')}: must be one decorative <svg viewBox=... aria-hidden="true" focusable="false"> without scripts, handlers or links`);
    }
    // hero.css (optional) animates the artwork and must stop it under prefers-reduced-motion.
    config.heroCss = existsSync(join(dir, 'hero.css')) ? readFileSync(join(dir, 'hero.css'), 'utf8').replace(/\r\n/g, '\n').trimEnd() : '/* (no artwork animation) */';
    config.art = { ...DEFAULT_ART, ...(config.art ?? {}) };
    if (!config.pool) {
      config.banks = {};
      for (const mode of MODES) config.banks[mode] = readJson(join(dir, `${mode}.json`));
    }
    lessons.push(config);
  }
  const byKey = new Map();
  const slugs = new Set();
  for (const lesson of lessons) {
    if (byKey.has(lesson.key)) throw new Error(`lesson key ${lesson.key} is used twice`);
    if (slugs.has(lesson.slug)) throw new Error(`slug ${lesson.slug} is used twice`);
    byKey.set(lesson.key, lesson);
    slugs.add(lesson.slug);
  }
  for (const lesson of lessons) {
    if (!lesson.pool) continue;
    for (const key of lesson.pool.lessons) {
      const source = byKey.get(key);
      if (!source || source.pool) throw new Error(`${join(lesson.dir, 'lesson.json')}: pool lesson ${key} is not a lesson quiz`);
    }
  }
  // Lesson banks first, so a pool exam is built from validated source banks.
  const ordered = [...lessons].sort((a, b) => Number(Boolean(a.pool)) - Number(Boolean(b.pool)));
  const allQids = new Map();
  for (const lesson of ordered) {
    lesson.rules = lessonRules(lesson, byKey);
    if (lesson.pool) {
      lesson.banks = {};
      for (const mode of MODES) lesson.banks[mode] = buildPoolBank(lesson, byKey, mode);
    }
    for (const mode of MODES) {
      const errors = validateBank(lesson.banks[mode], mode, lesson.rules);
      if (errors.length) throw new Error(`${join(lesson.dir, lesson.pool ? `(pool ${mode})` : `${mode}.json`)}: ${errors.join('; ')}`);
      if (!lesson.pool) {
        for (const question of lesson.banks[mode]) {
          if (allQids.has(question.qid)) throw new Error(`qid ${question.qid} is used in ${allQids.get(question.qid)} and ${lesson.key} ${mode}`);
          allQids.set(question.qid, `${lesson.key} ${mode}`);
        }
      }
    }
    lesson.counts = Object.fromEntries(MODES.map(mode => [mode, lesson.pool ? lesson.pool.count : lesson.banks[mode].length]));
    // Bank sizes, and the questions an attempt asks (a pool exam always asks its fixed count).
    lesson.bankSizes = Object.fromEntries(MODES.map(mode => [mode, lesson.banks[mode].length]));
    lesson.attempts = Object.fromEntries(MODES.map(mode => [mode, lesson.pool ? lesson.pool.count : attemptLength(lesson.banks[mode])]));
    lesson.text = { ...DEFAULT_TEXT, ...(lesson.text ?? {}) };
  }
  const moduleOrder = new Map(modules.map((module, index) => [module.id, index]));
  lessons.sort((a, b) => moduleOrder.get(a.module) - moduleOrder.get(b.module) || a.order - b.order || a.key.localeCompare(b.key));
  return { modules, lessons, byKey };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// JSON for an inline <script type="application/json">: "<" is escaped so no text can close the element.
export function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

// Replaces every {{NAME}} exactly once (a function replacer keeps "$&"-style text in authored content literal).
export function fillTemplate(template, values) {
  let html = template;
  for (const [name, value] of Object.entries(values)) {
    const placeholder = `{{${name}}}`;
    if (html.split(placeholder).length !== 2) throw new Error(`${placeholder} must occur exactly once in the template`);
    html = html.replace(placeholder, () => String(value));
  }
  const left = html.match(/\{\{[A-Z_]+\}\}/);
  if (left) throw new Error(`${left[0]} was not filled`);
  return html;
}

const indent = (text, spaces) => text.split('\n').map(line => (line ? ' '.repeat(spaces) + line : line)).join('\n');

export function quizTotal(lesson) {
  return MODES.reduce((sum, mode) => sum + lesson.counts[mode], 0);
}

export function lessonText(lesson) {
  // {count} is the attempt length of a pool exam; a lesson's per-mode count is filled in per button later.
  const values = { lessonName: lesson.lessonName ?? lesson.name, total: quizTotal(lesson), ...(lesson.pool ? { count: lesson.pool.count } : {}) };
  const text = {};
  for (const [name, value] of Object.entries(lesson.text)) text[name] = Array.isArray(value) ? value.map(item => fill(item, values)) : fill(value, values);
  return { ...text, lede: fill(lesson.lede ?? DEFAULT_LEDE, values) };
}

// The runtime configuration the engine reads from <script id="quiz-config">.
export function quizConfig(lesson) {
  const text = lessonText(lesson);
  return {
    key: lesson.key,
    module: lesson.module,
    title: lesson.title,
    categoryOrder: lesson.rules.categoryOrder,
    sourceRef: lesson.rules.ref ? { label: lesson.rules.ref.label, min: lesson.rules.ref.min, max: lesson.rules.ref.max, required: lesson.rules.ref.required } : null,
    pool: lesson.rules.pool,
    text: {
      topicNoun: text.topicNoun,
      strengthsEmpty: text.strengthsEmpty,
      gapsEmpty: text.gapsEmpty,
      bands: text.bands,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared design system (src/shared/base.css), written into every page's single <style>
// ---------------------------------------------------------------------------

// The self-hosted fonts every page preloads: the two faces used most (body text and headings).
export const PRELOADED_FONTS = ['IBMPlexSansCondensed-Regular-Latin1.woff2', 'IBMPlexSansCondensed-SemiBold-Latin1.woff2'];

// `assets` is the page's relative path to the assets/ folder ('assets/' at the root, '../assets/' one folder down).
export function baseCss(css, assets) {
  return css.replace(/\r\n/g, '\n').trimEnd().replaceAll('__ASSETS__', assets);
}

export function fontPreloads(assets) {
  return PRELOADED_FONTS.map(file => `<link rel="preload" href="${assets}fonts/${file}" as="font" type="font/woff2" crossorigin>`).join('\n  ');
}

// "module-2" -> "02": the module number as the manual prints it.
export function moduleNumber(id) {
  return String(Number(String(id).replace(/^module-/, '')) || 0).padStart(2, '0');
}

// The masthead's reference lines and meta table for one quiz page.
function mastheadParts(lesson) {
  const mod = moduleNumber(lesson.module);
  const counts = MODES.map(mode => lesson.attempts[mode]);
  const banks = MODES.map(mode => lesson.bankSizes[mode]);
  const ref = lesson.rules.ref;
  const reference = lesson.pool
    ? `${lesson.pool.lessons.length} lessons · ${lesson.pool.count} per attempt`
    : `${ref.plural} ${ref.min}–${ref.max}`;
  const rows = [
    ['Questions', lesson.pool ? `${lesson.pool.count} per attempt` : counts.join(' · '), lesson.pool ? '' : `per attempt · Easy · Medium · Hard (banks of ${banks.join(' · ')})`],
    [lesson.pool ? 'Lessons' : 'Topics', String(lesson.rules.categoryOrder.length), ''],
    ['Source', lesson.pool ? 'Module lessons' : reference, ''],
  ];
  return {
    LESSON_REF: escapeHtml(`Module ${mod} · ${lesson.pool ? 'Comprehensive' : `Lesson ${String(lesson.order).padStart(2, '0')}`}`),
    SOURCE_LINE: escapeHtml(`Ref. ${reference}`),
    MASTHEAD_META: rows.map(([term, value, note]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}${note ? ` <span class="meta-note">${escapeHtml(note)}</span>` : ''}</dd></div>`).join('\n          '),
  };
}

export function renderQuizPage(template, contours, lesson, { endpoint = HISTORY_ENDPOINT, base = '' } = {}) {
  const text = lessonText(lesson);
  const palette = Object.entries(lesson.palette ?? {}).map(([name, value]) => `${name}: ${value};`);
  const modePrefix = mode => escapeHtml(fill(text.modeDescPrefix, { bank: lesson.bankSizes[mode], attempt: lesson.attempts[mode] }));
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    ...mastheadParts(lesson),
    PAGE_TITLE: escapeHtml(lesson.title),
    PALETTE_CSS: palette.length ? `    :root { ${palette.join(' ')} }` : '    /* (none) */',
    HERO_CSS: indent(lesson.heroCss, 4),
    CONTOURS: contours.trim(),
    EYEBROW: escapeHtml(lesson.eyebrow),
    H1: escapeHtml(lesson.title),
    LEDE: escapeHtml(text.lede),
    HUB_HREF: `../#${lesson.module}`,
    HERO_SVG: indent(lesson.heroSvg, 8),
    STUDY_WARNING_LEAD: escapeHtml(text.studyWarningLead),
    STUDY_WARNING_BODY: escapeHtml(text.studyWarningBody),
    STUDY_CONFIRM: escapeHtml(text.studyConfirm),
    MODE_PREFIX_EASY: modePrefix('easy'),
    MODE_PREFIX_MEDIUM: modePrefix('medium'),
    MODE_PREFIX_HARD: modePrefix('hard'),
    RESULTS_REMINDER: escapeHtml(text.resultsReminder),
    TOPICS_HEADING: escapeHtml(text.topicsHeading),
    TOPICS_CAPTION: escapeHtml(text.topicsCaption),
    TOPIC_NOUN: escapeHtml(text.topicNoun),
    GAPS_HEADING: escapeHtml(text.gapsHeading),
    CONFIG: scriptJson(quizConfig(lesson)),
    EASY_QUESTIONS: scriptJson(lesson.banks.easy),
    MEDIUM_QUESTIONS: scriptJson(lesson.banks.medium),
    HARD_QUESTIONS: scriptJson(lesson.banks.hard),
    HISTORY_ENDPOINT: endpoint,
  });
}

// "50 questions per attempt", or "41–50 questions per attempt" when the difficulties differ.
export function countLabel(lesson) {
  if (lesson.pool) return `${lesson.pool.count} questions`;
  const counts = MODES.map(mode => lesson.attempts[mode]);
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  return low === high ? `${low} questions per attempt` : `${low}–${high} questions per attempt`;
}

function joinNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// The hub's MODULES config: one entry per module, one exam per lesson.json, in hub order.
export function hubModules(modules, lessons) {
  return modules.map(module => {
    const exams = lessons.filter(lesson => lesson.module === module.id).sort((a, b) => Number(Boolean(b.prominent)) - Number(Boolean(a.prominent)) || a.order - b.order);
    const quizzes = exams.filter(exam => !exam.pool);
    const pools = exams.filter(exam => exam.pool);
    const description = pools.length
      ? `${quizzes.map(exam => exam.name).join(', ')} and the ${pools.map(exam => exam.name).join(' and the ')}`
      : joinNames(quizzes.map(exam => exam.name));
    const meta = `${quizzes.length} lesson${quizzes.length === 1 ? '' : 's'}${pools.map(exam => ` + ${exam.name}`).join('')}`;
    const entry = {
      id: module.id,
      title: module.title,
      meta,
      description,
      exams: exams.map(exam => {
        const values = { count: exam.pool ? exam.pool.count : '' };
        const item = {
          key: exam.key,
          lesson: exam.historyLesson,
          title: exam.name,
          description: fill(exam.hubDescription, values),
          url: `${exam.slug}/`,
          kicker: exam.hubKicker ?? (exam.pool ? 'Comprehensive' : 'Lesson quiz'),
          tags: (exam.hubTags ?? [{ text: countLabel(exam) }]).map(tag => ({ text: fill(tag.text, values), comprehensive: Boolean(tag.comprehensive) })).concat([{ text: 'Easy · Medium · Hard', comprehensive: false }]),
        };
        if (exam.prominent) item.prominent = true;
        return item;
      }),
    };
    if (module.note) entry.note = module.note;
    return entry;
  });
}

function hubModuleCard(module) {
  const id = module.id;
  const describedBy = [`pick-meta-${id}`, `pick-desc-${id}`, ...(module.note ? [`pick-note-${id}`] : []), `overview-${id}`].join(' ');
  const number = moduleNumber(id);
  return [
    '        <li>',
    `          <a class="module-card" id="pick-${id}" href="#${id}" aria-labelledby="pick-title-${id}" aria-describedby="${describedBy}">`,
    `            <span class="vol-head" aria-hidden="true"><span>Philippine Army</span><span>Vol. ${number}</span></span>`,
    `            <span class="vol-num" aria-hidden="true">${number}</span>`,
    `            <span class="card-kicker" id="pick-meta-${id}">${escapeHtml(module.meta)}</span>`,
    `            <span class="module-title" id="pick-title-${id}">${escapeHtml(module.title)}</span>`,
    `            <span class="card-desc" id="pick-desc-${id}">${escapeHtml(module.description)}</span>`,
    ...(module.note ? [`            <span class="tag module-note" id="pick-note-${id}">${escapeHtml(module.note)}</span>`] : []),
    `            <span class="module-overview" id="overview-${id}"></span>`,
    `            <span class="module-cta"><span class="cta-choose">Choose ${escapeHtml(module.title)}</span><span class="cta-selected">Selected</span> <span class="arrow" aria-hidden="true"></span></span>`,
    '          </a>',
    '        </li>',
  ].join('\n');
}

// One exam as a numbered contents line: "02.1  ISR Operations ........ 30 / 30 / 26" (questions per attempt).
function hubExamCard(exam, source, moduleId) {
  const number = `${moduleNumber(moduleId)}.${source ? source.order : 0}`;
  const counts = !source ? '' : source.pool ? `${source.pool.count} / attempt` : MODES.map(mode => source.attempts[mode]).join(' / ');
  return [
    `        <li${exam.prominent ? ' class="is-prominent"' : ''} id="card-${exam.key}" data-key="${exam.key}">`,
    `          <article class="exam-card" aria-labelledby="title-${exam.key}">`,
    `            <p class="toc-num" aria-hidden="true">${number}</p>`,
    '            <div class="toc-main">',
    `              <p class="card-kicker">${escapeHtml(exam.kicker)}</p>`,
    `              <div class="toc-line"><h3 class="card-title" id="title-${exam.key}">${escapeHtml(exam.title)}</h3><span class="toc-leader" aria-hidden="true"></span><span class="toc-counts" aria-hidden="true">${escapeHtml(counts)}</span></div>`,
    `              <p class="card-desc">${escapeHtml(exam.description)}</p>`,
    '              <ul class="card-meta">',
    ...exam.tags.map(tag => `                <li class="tag${tag.comprehensive ? ' tag-comprehensive' : ''}">${escapeHtml(tag.text)}</li>`),
    '              </ul>',
    '            </div>',
    `            <div class="card-stats" id="stats-${exam.key}" aria-live="polite"></div>`,
    `            <a class="start-link" href="${escapeHtml(exam.url)}">Start exam<span class="sr-only">: ${escapeHtml(exam.title)}</span> <span class="arrow" aria-hidden="true"></span></a>`,
    '          </article>',
    '        </li>',
  ].join('\n');
}

function hubPanel(module, byKey) {
  const id = module.id;
  const pools = module.exams.filter(exam => exam.prominent);
  const intro = `Each exam opens in this tab. Lesson quizzes have Easy, Medium and Hard modes${pools.length ? `; the ${pools.map(exam => `${exam.title} has ${exam.tags.find(tag => /questions$/.test(tag.text))?.text ?? 'a fixed number of questions'}`).join('; the ')}` : ''}.${module.note ? ` ${module.note.replace(/^More lessons coming$/, `More ${module.title} lessons are coming`)}.` : ''}`;
  return [
    `    <section class="exam-panel" id="${id}" aria-labelledby="exams-heading-${id}">`,
    '      <div class="sect-head section-head">',
    `        <h2 id="exams-heading-${id}" tabindex="-1"><span class="step-num">Step 2</span> Choose your exam <span class="heading-module">· ${escapeHtml(module.title)}</span></h2>`,
    `        <a class="change-module" id="change-${id}" href="#choose-module">Change module</a>`,
    '      </div>',
    '      <div class="sect-body">',
    `      <p class="section-intro">${escapeHtml(intro)}</p>`,
    '      <p class="toc-head" aria-hidden="true"><span>No.</span><span class="toc-head-main"><span>Exam</span><span>Questions · Easy / Medium / Hard</span></span><span>Class record</span></p>',
    `      <ul class="exam-grid" id="exam-grid-${id}">`,
    ...module.exams.map(exam => hubExamCard(exam, byKey.get(exam.key), id)),
    '      </ul>',
    '      </div>',
    '    </section>',
  ].join('\n');
}

export function renderHub(template, contours, modules, lessons, { endpoint = HISTORY_ENDPOINT, base = '' } = {}) {
  const config = hubModules(modules, lessons);
  const quizzes = lessons.filter(lesson => !lesson.pool);
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, 'assets/'),
    FONT_PRELOAD: fontPreloads('assets/'),
    HUB_META: [
      ['Modules', String(config.length)],
      ['Exams', String(lessons.length)],
      ['Questions', quizzes.reduce((sum, lesson) => sum + quizTotal(lesson), 0).toLocaleString('en-US')],
      ['Modes', 'Easy · Medium · Hard'],
    ].map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('\n            '),
    CONTOURS: contours.trim(),
    MODULE_CARDS: config.map(hubModuleCard).join('\n'),
    EXAM_PANELS: config.map(module => hubPanel(module, new Map(lessons.map(lesson => [lesson.key, lesson])))).join('\n\n'),
    MODULES: JSON.stringify(config, null, 2).replaceAll('<', '\\u003c').split('\n').join('\n    '),
    HISTORY_ENDPOINT: endpoint,
  });
}

// Question text for the instructor page, keyed by the stable item id <lessonKey>:<mode>:<qid>.
export function instructorData(modules, lessons) {
  const questions = {};
  for (const lesson of lessons) {
    if (lesson.pool) continue;
    for (const mode of MODES) {
      for (const question of lesson.banks[mode]) {
        questions[`${lesson.key}:${mode}:${question.qid}`] = {
          lesson: lesson.key,
          mode,
          category: question.category,
          prompt: question.prompt,
          options: question.options,
          answer: question.answer,
        };
      }
    }
  }
  return {
    modules: modules.map(module => ({
      id: module.id,
      title: module.title,
      lessons: lessons.filter(lesson => lesson.module === module.id && !lesson.pool).sort((a, b) => a.order - b.order).map(lesson => ({ key: lesson.key, name: lesson.name })),
      pools: lessons.filter(lesson => lesson.module === module.id && lesson.pool).map(lesson => ({ key: lesson.key, name: lesson.name, lessons: lesson.pool.lessons })),
    })).filter(module => module.lessons.length),
    questions,
  };
}

export function renderInstructor(template, contours, modules, lessons, { endpoint = HISTORY_ENDPOINT, base = '' } = {}) {
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    CONTOURS: contours.trim(),
    ITEM_DATA: scriptJson(instructorData(modules, lessons)),
    HISTORY_ENDPOINT: endpoint,
  });
}

// ---------------------------------------------------------------------------
// Class page (data/class.json is the approved public-safe subset; only these fields are allowed)
// ---------------------------------------------------------------------------

// Patterns that must never appear on the class page: e-mail, Philippine phone numbers, AFP serial numbers.
export const CLASS_FORBIDDEN = [/@/, /\+63/, /\bO-\d/, /\d{5,}/, /\(SC\)/];

export function loadClass(root = ROOT) {
  const path = join(root, 'data', 'class.json');
  const data = readJson(path);
  const fail = message => { throw new Error(`${path}: ${message}`); };
  const text = value => typeof value === 'string' && value.trim() !== '';
  const allowed = (object, keys) => Object.keys(object).every(key => keys.includes(key));
  if (!data || typeof data !== 'object' || !allowed(data, ['class', 'name', 'note', 'leadership', 'directorate', 'organization', 'roster'])) fail('only class, name, note, leadership, directorate, organization and roster are allowed');
  if (!text(data.class) || (data.name !== undefined && !text(data.name)) || (data.note !== undefined && typeof data.note !== 'string')) fail('class (and name, note) must be text');
  if (!Array.isArray(data.roster) || !data.roster.length) fail('roster must list the members');
  data.roster.forEach((member, index) => {
    if (!member || !allowed(member, ['nr', 'rank', 'name', 'commission']) || member.nr !== index + 1 || !text(member.rank) || !text(member.name) || !text(member.commission)) {
      fail(`roster entry ${index + 1} must be exactly { nr: ${index + 1}, rank, name, commission }`);
    }
  });
  const lead = data.leadership;
  if (!lead || typeof lead !== 'object' || !allowed(lead, ['title', 'caption', 'command', 'departments']) || !text(lead.title) || !text(lead.caption)) fail('leadership must be exactly { title, caption, command: [...], departments: [...] }');
  for (const [key, min, max] of [['command', 1, 6], ['departments', 1, 12]]) {
    const list = lead[key];
    if (!Array.isArray(list) || list.length < min || list.length > max) fail(`leadership ${key} must list ${min} to ${max} entries`);
    const seen = new Set();
    list.forEach(entry => {
      if (!entry || !allowed(entry, ['position', 'rank', 'name']) || !text(entry.position) || !text(entry.rank) || !text(entry.name) || entry.position.length > 80 || entry.name.length > 60 || entry.rank.length > 6) fail(`leadership ${key}: every entry must be exactly { position, rank, name } of short texts`);
      if (seen.has(entry.position)) fail(`leadership position ${entry.position} is listed twice`);
      seen.add(entry.position);
    });
  }
  const dir = data.directorate;
  if (!dir || typeof dir !== 'object' || !allowed(dir, ['title', 'caption', 'roles']) || !text(dir.title) || !text(dir.caption) || !Array.isArray(dir.roles) || !dir.roles.length) fail('directorate must be exactly { title, caption, roles: [{ role, members: [{ rank, name, office, duties, schooling, civilian }] }] }');
  const roles = new Set();
  dir.roles.forEach((entry, index) => {
    if (!entry || !allowed(entry, ['role', 'members']) || !text(entry.role) || !Array.isArray(entry.members) || !entry.members.length) fail(`directorate role ${index + 1} must be { role, members: [...] }`);
    if (roles.has(entry.role)) fail(`directorate role ${entry.role} is listed twice`);
    roles.add(entry.role);
    entry.members.forEach(member => {
      if (!member || !allowed(member, ['rank', 'name', 'office', 'duties', 'schooling', 'civilian']) || !text(member.rank) || !text(member.name)) fail(`directorate role ${entry.role}: every member must be exactly { rank, name, office, duties, schooling, civilian }`);
      if (!(member.office === null || (text(member.office) && member.office.length <= 60))) fail(`directorate member ${member.name}: office must be null or text of at most 60 characters`);
      for (const [key, max] of [['duties', 6], ['schooling', 20], ['civilian', 6]]) {
        const list = member[key];
        if (!Array.isArray(list) || list.length > max || !list.every(item => text(item) && item.length <= 120)) fail(`directorate member ${member.name}: ${key} must be a list of at most ${max} non-empty texts of at most 120 characters`);
      }
    });
  });
  if (!Array.isArray(data.organization)) fail('organization must be a list');
  const positions = new Set();
  data.organization.forEach((entry, index) => {
    if (!entry || !allowed(entry, ['position', 'member']) || !text(entry.position) || !Number.isInteger(entry.member) || entry.member < 1 || entry.member > data.roster.length) {
      fail(`organization entry ${index + 1} must be { position, member } with member a roster Nr`);
    }
    if (positions.has(entry.position)) fail(`position ${entry.position} is listed twice`);
    positions.add(entry.position);
  });
  const serialized = JSON.stringify(data);
  for (const pattern of CLASS_FORBIDDEN) if (pattern.test(serialized)) fail(`contains text that looks like private data (${pattern})`);
  return data;
}

export function renderClass(template, contours, data, { base = '' } = {}) {
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    CONTOURS: contours.trim(),
    CLASS_COUNT: String(data.roster.length),
    CLASS_DATA: scriptJson(data),
  });
}

// ---------------------------------------------------------------------------
// Weekly training schedule (data/schedule.json, this week's copy of the schedule; archived in data/schedules/)
// ---------------------------------------------------------------------------

export const SCHEDULE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SCHEDULE_KINDS = ['lecture', 'exam', 'routine'];
// The schedule is public: no e-mail, +63 phone, O-<digits> serial, 6-digit service number (or any longer digit run).
export const SCHEDULE_FORBIDDEN = [/@/, /\+63/, /\bO-\d/, /\d{5,}/, /\(SC\)/];
// A scheduled subject links to the quiz of the lesson it names (lesson key: pattern on the activity text).
export const SCHEDULE_QUIZ_MATCH = {
  isr: /\bISR\b/i,
  armor: /\bArmor\b/i,
  fieldartillery: /\bField Artillery\b/i,
  armyops: /\bArmy Operations\b/i,
  signal: /\bSignal Support in Combined Arms Operations\b/i,
  signaljoint: /\bSignal Support in Joint Operations\b/i,
  coalition: /\bCoalition Operations\b/i,
};
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:([01]\d|2[0-3])([0-5]\d)(?:-([01]\d|2[0-3])([0-5]\d))?)?$/;

function parseDate(text) {
  const match = DATE_PATTERN.exec(text ?? '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === text ? date : null;
}

// "0830-1100" -> { start: 510, end: 660 }; "2130" -> { start: 1290, end: null }; "" (not printed) -> null.
export function parseScheduleTime(text) {
  const match = TIME_PATTERN.exec(text ?? 'x');
  if (!match) throw new Error(`time "${text}" must be HHMM, HHMM-HHMM or empty`);
  if (!match[1]) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = match[3] ? Number(match[3]) * 60 + Number(match[4]) : null;
  if (end !== null && end <= start) throw new Error(`time "${text}" must end after it starts`);
  return { start, end };
}

export function scheduleQuiz(activity, lessons) {
  for (const [key, pattern] of Object.entries(SCHEDULE_QUIZ_MATCH)) {
    const lesson = lessons.find(item => item.key === key && !item.pool);
    if (lesson && pattern.test(activity)) return { key, name: lesson.name, url: `../${lesson.slug}/` };
  }
  return null;
}

export function loadSchedule(root = ROOT, file = join(root, 'data', 'schedule.json')) {
  const data = readJson(file);
  const fail = message => { throw new Error(`${file}: ${message}`); };
  const text = (value, max = 120) => typeof value === 'string' && value.trim() !== '' && value === value.trim() && value.length <= max;
  const allowed = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
  if (!allowed(data, ['course', 'unit', 'week', 'students', 'prepared', 'days', 'menuNotice'])) fail('only course, unit, week, students, prepared, days and menuNotice are allowed');
  if (data.menuNotice !== undefined && !text(data.menuNotice, 300)) fail('menuNotice must be a short text');
  if (!text(data.course, 40) || !text(data.unit)) fail('course and unit must be short texts');
  if (data.students !== undefined && (!Number.isInteger(data.students) || data.students < 1 || data.students > 200)) fail('students must be a whole number');
  if (data.prepared !== undefined && !parseDate(data.prepared)) fail('prepared must be a YYYY-MM-DD date');
  const week = data.week;
  if (!allowed(week, ['number', 'of', 'start', 'end']) || !Number.isInteger(week.number) || !Number.isInteger(week.of) || week.number < 1 || week.number > week.of) fail('week must be { number, of, start, end } with 1 <= number <= of');
  const start = parseDate(week.start);
  const end = parseDate(week.end);
  if (!start || !end || end < start || (end - start) / 86400000 > 6) fail('week start and end must be YYYY-MM-DD dates at most 7 days apart');
  if (!Array.isArray(data.days) || data.days.length !== (end - start) / 86400000 + 1) fail('days must list every date from week start to week end');
  data.days.forEach((day, index) => {
    const expected = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    if (!allowed(day, ['date', 'day', 'blocks']) || day.date !== expected) fail(`day ${index + 1} must be { date: "${expected}", day, blocks }`);
    if (day.day !== SCHEDULE_DAYS[parseDate(day.date).getUTCDay()]) fail(`${day.date} is a ${SCHEDULE_DAYS[parseDate(day.date).getUTCDay()]}, not "${day.day}"`);
    if (!Array.isArray(day.blocks) || !day.blocks.length || day.blocks.length > 40) fail(`${day.date}: blocks must list 1 to 40 time blocks`);
    day.blocks.forEach((block, at) => {
      const where = `${day.date} block ${at + 1}`;
      if (!allowed(block, ['time', 'activity', 'kind', 'periods', 'class', 'instructor', 'uniform', 'venue', 'remarks', 'menu'])) fail(`${where}: only time, activity, kind, periods, class, instructor, uniform, venue, remarks and menu are allowed`);
      if (block.menu !== undefined && (!['Morning Mess', 'Noon Mess', 'Evening Mess'].includes(block.activity) || !Array.isArray(block.menu) || !block.menu.length || block.menu.length > 12 || !block.menu.every(item => text(item)))) fail(`${where}: menu must list 1 to 12 short texts at a mess period`);
      if (typeof block.time !== 'string') fail(`${where}: time must be text ("" when the schedule prints none)`);
      try { parseScheduleTime(block.time); } catch (error) { fail(`${where}: ${error.message}`); }
      if (!text(block.activity)) fail(`${where}: activity must be a nonempty text`);
      if (!SCHEDULE_KINDS.includes(block.kind)) fail(`${where}: kind must be one of ${SCHEDULE_KINDS.join(', ')}`);
      if (block.periods !== undefined && (!Number.isInteger(block.periods) || block.periods < 1 || block.periods > 12)) fail(`${where}: periods must be a whole number from 1 to 12`);
      for (const key of ['class', 'uniform', 'remarks']) if (block[key] !== undefined && !text(block[key])) fail(`${where}: ${key}, when present, must be a nonempty text`);
      if (!text(block.instructor, 80)) fail(`${where}: instructor must be rank + name (or a duty title) of at most 80 characters`);
      if (!(block.venue === null || text(block.venue, 80))) fail(`${where}: venue must be null or a short text`);
    });
  });
  const serialized = JSON.stringify(data);
  for (const pattern of SCHEDULE_FORBIDDEN) if (pattern.test(serialized)) fail(`contains text that looks like private data (${pattern})`);
  return data;
}

// "2026-10-05" -> "05 Oct 2026" (the schedule's own style).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function scheduleDate(text, { year = true } = {}) {
  const [y, m, d] = text.split('-');
  return `${d} ${MONTHS[Number(m) - 1]}${year ? ` ${y}` : ''}`;
}

export function scheduleRange(week) {
  const [ys, ms] = week.start.split('-');
  const [ye, me] = week.end.split('-');
  if (ys === ye && ms === me) return `${week.start.slice(8)}–${scheduleDate(week.end)}`;
  return `${scheduleDate(week.start, { year: ys !== ye })} – ${scheduleDate(week.end)}`;
}

export function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
}
const KIND_LABELS = { lecture: 'Lecture', exam: 'Exam', routine: 'Routine' };

function scheduleBlock(block, lessons) {
  const span = parseScheduleTime(block.time);
  const timeText = block.time ? block.time.replace('-', '–') : '—';
  const attrs = span ? ` data-start="${span.start}"${span.end !== null ? ` data-end="${span.end}"` : ''}` : '';
  const quiz = scheduleQuiz(block.activity, lessons);
  const uniform = block.uniform ? `<span class="sr-only">Uniform: </span><span class="uniform">${escapeHtml(block.uniform)}</span>` : '';
  const extra = [block.class ? `For ${escapeHtml(block.class)}` : '', block.periods ? `${block.periods} period${block.periods === 1 ? '' : 's'}` : ''].filter(Boolean);
  return [
    `            <li class="blk is-${block.kind}"${attrs}>`,
    `              <p class="blk-time"><span class="sr-only">${block.time ? 'Time' : 'Time not printed'}: </span><span class="mono">${escapeHtml(timeText)}</span>${block.kind !== 'routine' ? ` <span class="blk-kind">${KIND_LABELS[block.kind]}</span>` : ''}<span class="blk-flag" aria-hidden="true"></span></p>`,
    `              <p class="blk-title">${escapeHtml(block.activity)}</p>`,
    ...(quiz ? [`              <p class="blk-quiz"><a href="${quiz.url}" data-quiz="${quiz.key}">Practice quiz<span class="sr-only">: ${escapeHtml(quiz.name)}</span> <span aria-hidden="true">&#8594;</span></a></p>`] : []),
    `              <p class="blk-meta blk-who"><span class="sr-only">Instructor: </span>${escapeHtml(block.instructor)}</p>`,
    `              <p class="blk-meta blk-where">${block.venue ? `<span class="sr-only">Venue: </span>${escapeHtml(block.venue)}` : ''}${block.venue && uniform ? '<span class="sep" aria-hidden="true"> · </span>' : ''}${uniform}</p>`,
    ...(extra.length ? [`              <p class="blk-meta blk-extra">${extra.join(' · ')}</p>`] : []),
    ...(block.remarks ? [`              <p class="blk-meta blk-remarks">${escapeHtml(block.remarks)}</p>`] : []),
    ...(block.menu ? [`              <p class="blk-menu"><strong>Menu</strong><br>${block.menu.map(escapeHtml).join(' · ')}</p>`] : []),
    '            </li>',
  ].join('\n');
}

export function renderSchedule(template, contours, data, lessons, { base = '' } = {}) {
  const academic = data.days.flatMap(day => day.blocks).filter(block => block.kind !== 'routine').length;
  const days = data.days.map(day => [
    `        <section class="day" id="day-${day.date}" data-date="${day.date}" aria-labelledby="day-h-${day.date}"${day.date !== data.days[0].date ? ' hidden' : ''}>`,
    `          <h2 class="day-head" id="day-h-${day.date}"><span class="day-name">${escapeHtml(day.day)}</span> <span class="day-date mono">${escapeHtml(scheduleDate(day.date, { year: false }))}</span><span class="day-today" hidden> · Today</span></h2>`,
    '          <ol class="blocks">',
    ...day.blocks.map(block => scheduleBlock(block, lessons)),
    '          </ol>',
    '        </section>',
  ].join('\n')).join('\n');
  const dayNav = data.days.map(day => `<li><a href="#day-${day.date}" data-date="${day.date}"><span>${escapeHtml(day.day.slice(0, 3))}</span> <span class="mono">${escapeHtml(day.date.slice(8))}</span></a></li>`).join('\n          ');
  const week = data.week;
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    CONTOURS: contours.trim(),
    WEEK_LABEL: escapeHtml(`${ordinal(week.number)} week of ${week.of}`),
    WEEK_RANGE: escapeHtml(scheduleRange(week)),
    COURSE: escapeHtml(data.course),
    UNIT: escapeHtml(data.unit),
    SCHEDULE_META: [
      ['Week', `${week.number} of ${week.of}`],
      ['Dates', scheduleRange(week)],
      ['Academic blocks', String(academic)],
      ...(data.students ? [['Students', String(data.students)]] : []),
    ].map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('\n          '),
    PREPARED: escapeHtml([data.prepared ? `Schedule prepared ${scheduleDate(data.prepared)}.` : '', data.menuNotice || ''].filter(Boolean).join(' ')),
    DAY_NAV: dayNav,
    DAYS: days,
    SCHEDULE_DATA: scriptJson({ start: week.start, end: week.end, range: scheduleRange(week), days: data.days.map(day => day.date) }),
  });
}

// Builds every page; returns { path: html } for the files written.
export function build({ root = ROOT, out = root, endpoint = HISTORY_ENDPOINT, write = true } = {}) {
  const { modules, lessons } = loadLessons(root);
  const contours = readFileSync(join(root, 'src', 'engine', 'contours.svg'), 'utf8');
  const base = readFileSync(join(root, 'src', 'shared', 'base.css'), 'utf8');
  const engine = readFileSync(join(root, 'src', 'engine', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
  const pages = {};
  for (const lesson of lessons) pages[`${lesson.slug}/index.html`] = renderQuizPage(engine, contours, lesson, { endpoint, base });
  pages['index.html'] = renderHub(readFileSync(join(root, 'src', 'hub', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, modules, lessons, { endpoint, base });
  pages['class/index.html'] = renderClass(readFileSync(join(root, 'src', 'class', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, loadClass(root), { base });
  pages['schedule/index.html'] = renderSchedule(readFileSync(join(root, 'src', 'schedule', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, loadSchedule(root), lessons, { base });
  pages['instructor/index.html'] = renderInstructor(readFileSync(join(root, 'src', 'instructor', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, modules, lessons, { endpoint, base });
  if (write) {
    for (const [path, html] of Object.entries(pages)) {
      mkdirSync(dirname(join(out, path)), { recursive: true });
      writeFileSync(join(out, path), html);
    }
  }
  return pages;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const [flag, inline] = argv[index].split(/=(.*)/s);
    const value = inline !== undefined ? inline : argv[++index];
    if (flag === '--out') options.out = resolve(value);
    else if (flag === '--endpoint') options.endpoint = value ?? '';
    else throw new Error(`unknown option ${flag}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const pages = build(options);
    console.log(`Built ${Object.keys(pages).length} pages${options.out ? ` into ${options.out}` : ''}: ${Object.keys(pages).join(', ')}`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
