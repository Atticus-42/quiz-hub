// Builds the whole site from lessons/ and src/:
//   index.html                 the hub (src/hub/template.html; MODULES generated from lessons/*/lesson.json)
//   <slug>/index.html          one quiz page per lesson or pool exam (src/engine/template.html)
//   instructor/index.html      the instructor's question analysis (src/instructor/template.html)
//   class/index.html           the class page (src/class/template.html, data/class.json)
//   gallery/index.html         the photo gallery (src/gallery/template.html, data/gallery.json)
//   schedule/index.html        this week's training schedule (src/schedule/template.html, data/schedule.json)
//
//   node scripts/build.mjs                         build into the repository (what GitHub Pages serves)
//   node scripts/build.mjs --out DIR --endpoint ""  build a copy elsewhere, e.g. a local preview with class
//                                                  history switched off (no request ever reaches the sheet)
import { buildSiteIndex, siteSearchPages } from './site-index.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStudy, renderStudyPages, studyQuizLinks } from './study.mjs';
import { ACTUAL_LABEL, ACTUAL_NOTE, REVIEWER_SLUG, REVIEWER_TITLE, actualExamData, displayDate, examCitation } from './actual-exams.mjs';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const MODES = ['easy', 'medium', 'hard'];
export const MODE_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const MODE_LETTERS = { easy: 'e', medium: 'm', hard: 'h' };
// The Google Apps Script web app behind the shared class history (apps-script/Code.gs). The only
// network address any page contacts; written into every page by the build.
export const HISTORY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwTNNYOiebIGo46PzM3fUA9VT6XnS740D72prOPg-0OJ5Kvg4W8LVl-xJEo_gxImxqnmg/exec';
// Full exams contain 20–35 questions. Short mistake-retry rounds are not new full exams.
export const MIN_BANK_SIZE = 20;
export const MAX_BANK_SIZE = 35;
export const MAX_ATTEMPT_SIZE = 35;
// A pool (combined) exam asks POOL_MIN_ATTEMPT..POOL_MAX_ATTEMPT questions per attempt (owner rule).
export const POOL_MIN_ATTEMPT = 20;
export const POOL_MAX_ATTEMPT = 35;
export const LESSON_KEY_PATTERN = /^[a-z][a-z0-9]{1,23}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['assets', 'src', 'lessons', 'scripts', 'apps-script', 'instructor', 'class', 'data', 'schedule', 'codes-ciphers', 'comprehensive-reviewer', 'gallery']);
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
  const hasAlt = question.sourceAlt !== undefined;
  if (hasAlt) {
    const alt = rules.alt;
    const shape = question.sourceAlt;
    if (!rules.ref || !alt) {
      errors.push('sourceAlt is not enabled for this lesson (declare sourceAlt in lesson.json)');
    } else if (shape === null || typeof shape !== 'object' || Array.isArray(shape) || shape.ref !== alt.ref
      || !Array.isArray(shape.pages) || shape.pages.length === 0 || shape.pages.some(page => !Number.isInteger(page) || page < alt.min || page > alt.max)) {
      errors.push(`sourceAlt must be { ref: "${alt.ref}", pages: [integers from ${alt.min} to ${alt.max}] }`);
    }
  }
  if (rules.ref) {
    // A question needs at least one of sourceSlides (the lesson's primary reference) or sourceAlt (a secondary one).
    // With sourceAlt, sourceSlides may be omitted or empty when the primary reference does not hold the content.
    const altOnly = hasAlt && rules.alt && (question.sourceSlides === undefined || (Array.isArray(question.sourceSlides) && question.sourceSlides.length === 0));
    if (!altOnly && (rules.ref.required || question.sourceSlides !== undefined)) {
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
  const minimum = rules.pool ? 1 : MIN_BANK_SIZE;
  if (bank.length < minimum) errors.push(`bank must contain at least ${minimum} question${minimum === 1 ? '' : 's'}`);
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
    const min = POOL_MIN_ATTEMPT;
    const max = POOL_MAX_ATTEMPT;
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
    const alt = config.sourceAlt;
    if (alt !== undefined && (alt === null || typeof alt !== 'object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(alt.ref ?? '') || typeof alt.label !== 'string' || !alt.label.trim() || !Number.isInteger(alt.min) || !Number.isInteger(alt.max) || alt.min < 1 || alt.min > alt.max)) {
      fail('sourceAlt must be { ref: <library document id>, label, min, max } (page numbers start at 1)');
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
      alt: null,
      pool: { count: config.pool.count, lessons: config.pool.lessons.map(key => ({ key, name: lessonsByKey.get(key).name })) },
    };
  }
  return { key: config.key, categoryOrder: config.categoryOrder, ref: { ...config.sourceRef }, alt: config.sourceAlt ? { ...config.sourceAlt } : null, pool: null };
}

function reference(source, slides, alt) {
  const parts = [];
  if (Array.isArray(slides) && slides.length) parts.push(`${slides.length === 1 ? source.sourceRef.label : source.sourceRef.plural} ${slides.join(', ')}`);
  if (alt && source.sourceAlt) parts.push(`${source.sourceAlt.label} · ${alt.pages.length === 1 ? 'page' : 'pages'} ${alt.pages.join(', ')}`);
  return parts.length ? ` (${source.name}, ${parts.join('; ')})` : '';
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
        explanation: item.explanation.trim() + reference(source, item.sourceSlides, item.sourceAlt),
      });
    }
  }
  return merged;
}

// Resolves a lesson's secondary reference against the Library: the document must exist with a PDF, and the
// page range must fit inside that PDF. Adds the title and the link target the quiz page needs.
function resolveAlt(root, lesson, alt) {
  const where = join(lesson.dir, 'lesson.json');
  const library = readJson(join(root, 'data', 'library.json'));
  const doc = [...library.manuals, ...(library.additionalDocuments ?? [])].find(item => item.id === alt.ref);
  if (!doc || !doc.file) throw new Error(`${where}: sourceAlt.ref "${alt.ref}" is not a Library document with a PDF`);
  const pdf = join(root, 'library', 'files', `${doc.file}.pdf`);
  if (!existsSync(pdf)) throw new Error(`${where}: sourceAlt PDF is missing: ${pdf}`);
  const count = pdfPageCount(readFileSync(pdf));
  if (count && alt.max > count) throw new Error(`${where}: sourceAlt.max ${alt.max} is beyond the ${count}-page PDF ${doc.file}`);
  return { ...alt, title: doc.title, href: `../library/files/${doc.file}.pdf` };
}

export function pdfPageCount(buffer) {
  const text = buffer.toString('latin1');
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map(match => Number(match[1]));
  return counts.length ? Math.max(...counts) : (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

// Reads every lessons/<key>/lesson.json (and its banks), validates them and returns the lessons in hub order.
export function loadLessons(root = ROOT) {
  const lessonsDir = join(root, 'lessons');
  const modules = readJson(join(lessonsDir, 'modules.json'));
  if (!Array.isArray(modules) || !modules.length || modules.some(module => !/^(module-\d+|supplemental)$/.test(module.id ?? '') || typeof module.title !== 'string')) {
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
    if (lesson.rules.alt) lesson.rules.alt = resolveAlt(root, lesson, lesson.rules.alt);
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
    sourceAlt: lesson.rules.alt ? { ref: lesson.rules.alt.ref, label: lesson.rules.alt.label, min: lesson.rules.alt.min, max: lesson.rules.alt.max, title: lesson.rules.alt.title, href: lesson.rules.alt.href } : null,
    pool: lesson.rules.pool,
    actual: lesson.actual ? { count: lesson.actual.count, attempt: lesson.actual.attempt, ...(lesson.actual.full ? { full: lesson.actual.full } : {}) } : null,
    ...(lesson.actualOnly ? { actualOnly: true } : {}),
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
  const moduleExam = lesson.prominent && lesson.order === 0;
  const counts = MODES.map(mode => lesson.attempts[mode]);
  const banks = MODES.map(mode => lesson.bankSizes[mode]);
  const ref = lesson.rules.ref;
  const reference = lesson.pool
    ? `${lesson.pool.lessons.length} lessons · ${lesson.pool.count} per attempt`
    : moduleExam ? `${lesson.rules.categoryOrder.length} lessons · references in explanations` : `${ref.plural} ${ref.min}–${ref.max}`;
  const rows = [
    ['Questions', lesson.pool ? `${lesson.pool.count} per attempt` : counts.join(' · '), lesson.pool ? '' : `per attempt · Easy · Medium · Hard (banks of ${banks.join(' · ')})`],
    [lesson.pool || moduleExam ? 'Lessons' : 'Topics', String(lesson.rules.categoryOrder.length), ''],
    ['Source', lesson.pool || moduleExam ? 'Module lessons' : reference, ''],
  ];
  return {
    LESSON_REF: escapeHtml(`Module ${mod} · ${lesson.pool ? 'Comprehensive' : moduleExam ? 'Module examination' : `Lesson ${String(lesson.order).padStart(2, '0')}`}`),
    SOURCE_LINE: escapeHtml(`Ref. ${reference}`),
    MASTHEAD_META: rows.map(([term, value, note]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}${note ? ` <span class="meta-note">${escapeHtml(note)}</span>` : ''}</dd></div>`).join('\n          '),
  };
}

export function renderQuizPage(template, contours, lesson, { endpoint = HISTORY_ENDPOINT, base = '', study = { reviewer: '../reviewer/', sources: {}, byQuestion: {} } } = {}) {
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
    STUDY_HREF: escapeHtml(study.reviewer),
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
    STUDY_LINKS: scriptJson(study),
    EASY_QUESTIONS: scriptJson(lesson.banks.easy),
    MEDIUM_QUESTIONS: scriptJson(lesson.banks.medium),
    HARD_QUESTIONS: scriptJson(lesson.banks.hard),
    ACTUAL_QUESTIONS: scriptJson(lesson.actual ? lesson.actual.bank : []),
    ACTUAL_SECTION: actualSection(lesson.actual),
    DIFFICULTY_HEADING: 'Choose a difficulty',
    MODE_LIST_HIDDEN: '',
    PRIVACY_NOTE: escapeHtml(PRIVACY_NOTE + (lesson.actual ? ' Actual Exam attempts are sent to the class history the same way, labelled Actual Exam.' : '')),
    HISTORY_ENDPOINT: endpoint,
  });
}

const PRIVACY_NOTE = "No login and no tracking. Your answers stay in this browser tab and are cleared when you refresh or close it. When your instructor has set up the class history, finishing an attempt sends your name, difficulty, score, percentage, mastery band and finish time to the class history sheet, together with the reference codes of the questions you were asked and of those you missed (for the instructor's question analysis). The answers you chose are never sent, and practice retries of missed questions are not sent at all. To put questions you have not seen yet first, then those you missed, this browser remembers which questions it has shown you and which were missed (question codes only, no name); that record never leaves this device.";
const ACTUAL_PRIVACY_NOTE = 'No login and no tracking. Your answers stay in this browser tab and are cleared when you refresh or close it. When your instructor has set up the class history, finishing an attempt sends your name, score, percentage, mastery band and finish time to the class history sheet, together with the reference codes of the questions you were asked and of those you missed (for the instructor’s question analysis). The answers you chose are never sent, and practice retries of missed questions are not sent at all. To put questions you have not seen yet first, then those you missed, this browser remembers which questions it has shown you and which were missed (question codes only, no name); that record never leaves this device.';

// The Actual Exam category on a quiz page: set apart from Easy, Medium and Hard, with the graded exams it draws on.
// `all` (the reviewer's mixed set) adds a second button for the full set.
export function actualSection(actual, { all = false } = {}) {
  if (!actual) return '';
  const names = actual.exams.map(exam => `${exam.title} (${displayDate(exam.date)})`);
  const from = names.length === 1 ? `the graded ${names[0]}` : `${names.length} graded exams: ${names.join('; ')}`;
  const per = actual.attempt === actual.count ? `${actual.count} questions per attempt` : `${actual.attempt} questions per attempt, drawn from ${actual.count}`;
  const button = (id, label, desc) => [
    `            <button type="button" id="${id}" class="mode-button mode-actual" disabled aria-describedby="mode-hint actual-note">`,
    `              <span class="mode-name"><span class="actual-mark" aria-hidden="true">✓</span>${escapeHtml(label)}</span>`,
    `              <span class="mode-desc">${escapeHtml(desc)}</span>`,
    '              <span class="mode-go" aria-hidden="true">Begin →</span>',
    '            </button>',
  ];
  return [
    '          <section id="actual-block" class="actual-block" aria-labelledby="actual-heading">',
    `            <h3 id="actual-heading" class="actual-heading"><span class="actual-badge">${escapeHtml(ACTUAL_LABEL)}</span> <span>${escapeHtml(ACTUAL_NOTE)}</span></h3>`,
    `            <p id="actual-note" class="actual-note">${escapeHtml(`A separate category from Easy, Medium and Hard: ${actual.count} questions from ${from}. Each keeps the exam's question and answer key; the other choices are answer keys of other graded-exam questions. Unseen questions come first. Saved to the class history as Actual Exam attempts.`)}</p>`,
    '            <div class="mode-list actual-list" role="group" aria-labelledby="actual-heading">',
    ...button('mode-actual', all ? 'Mixed set' : ACTUAL_LABEL, `${per}.${all ? ' Questions from all graded exams, unseen first.' : ''}`),
    ...(all && actual.full ? button('mode-actual-all', 'Full set', `All ${actual.full} questions from every graded exam in one sitting.`) : []),
    '            </div>',
    '          </section>',
  ].join('\n');
}

// One Comprehensive Exam Reviewer quiz page (comprehensive-reviewer/<slug>/): the quiz engine with only the Actual
// Exam category and no difficulty banks. Attempts post to the shared class history under the page key (mode 'actual').
export function renderActualPage(template, contours, page, { base = '', endpoint = HISTORY_ENDPOINT } = {}) {
  const { key, title, eyebrow, lede, actual, categoryOrder, warning, meta, ref, all = false } = page;
  const config = {
    key, module: 'module-1', title, categoryOrder, sourceRef: null, sourceAlt: null, pool: null,
    actual: { count: actual.count, attempt: actual.attempt, ...(actual.full ? { full: actual.full } : {}) }, actualOnly: true,
    text: { topicNoun: 'Exam', strengthsEmpty: 'No exam reached 75% in this attempt.', gapsEmpty: 'No gaps in this attempt. Keep reviewing.', bands: DEFAULT_TEXT.bands.map(band => band.replace('the lesson', 'these lessons').replace('the complete lesson', 'the lessons')) },
  };
  const html = fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    LESSON_REF: escapeHtml(ref),
    SOURCE_LINE: escapeHtml(meta.source),
    MASTHEAD_META: meta.rows.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('\n          '),
    PAGE_TITLE: escapeHtml(`${title} · ${REVIEWER_TITLE}`),
    PALETTE_CSS: '    :root { --lesson-accent: #a8431a; }',
    HERO_CSS: '    /* (no artwork animation) */',
    CONTOURS: contours.trim(),
    EYEBROW: escapeHtml(eyebrow),
    H1: escapeHtml(title),
    LEDE: escapeHtml(lede),
    HUB_HREF: '__REVIEWER_INDEX__',
    STUDY_HREF: '../reviewer/',
    HERO_SVG: indent(page.heroSvg, 8),
    STUDY_WARNING_LEAD: escapeHtml('These are questions from the class’s graded exams.'),
    STUDY_WARNING_BODY: escapeHtml(warning),
    STUDY_CONFIRM: escapeHtml('I understand that this reviewer supports, and does not replace, studying the complete lessons.'),
    MODE_PREFIX_EASY: '', MODE_PREFIX_MEDIUM: '', MODE_PREFIX_HARD: '',
    RESULTS_REMINDER: escapeHtml('This score is practice feedback only. Restudy the lessons behind the questions you missed.'),
    TOPICS_HEADING: 'Exam analysis',
    TOPICS_CAPTION: escapeHtml('Correct answers by graded exam. An exam is a strength at 75% or higher and a gap below 75%; the line on each bar marks 75%.'),
    TOPIC_NOUN: 'Exam',
    GAPS_HEADING: 'Gaps to review',
    CONFIG: scriptJson(config),
    STUDY_LINKS: scriptJson({ reviewer: '../reviewer/', sources: {}, byQuestion: {} }),
    EASY_QUESTIONS: '[]', MEDIUM_QUESTIONS: '[]', HARD_QUESTIONS: '[]',
    ACTUAL_QUESTIONS: scriptJson(actual.bank),
    ACTUAL_SECTION: actualSection(actual, { all }),
    DIFFICULTY_HEADING: 'Choose an attempt',
    MODE_LIST_HIDDEN: ' hidden',
    PRIVACY_NOTE: escapeHtml(ACTUAL_PRIVACY_NOTE),
    HISTORY_ENDPOINT: endpoint,
  });
  // These pages sit one folder deeper than a lesson quiz.
  return html.replace(/\.\.\/(assets|library|reviewer)\//g, '../../$1/').replace(/\.\.\/#/g, '../../#')
    .replace('__REVIEWER_INDEX__', '../').replace('</span> All quizzes</a>', '</span> All graded exams</a>');
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

// The numeral on a module's index tab: "01"…"08", "S" for the supporting lessons.
function hubModuleNumeral(id) {
  return /^module-\d+$/.test(id) ? moduleNumber(id) : 'S';
}

// Step 1: one compact index tab per module. The subject (modules.json note) is the visible name; the
// accessible name stays "Module N <subject>", the lesson list and class attempts describe it.
function hubModuleCard(module) {
  const id = module.id;
  const describedBy = [`pick-meta-${id}`, `pick-desc-${id}`, `overview-${id}`].join(' ');
  return [
    `        <li data-module="${id}">`,
    `          <a class="module-card" id="pick-${id}" href="#${id}" aria-labelledby="pick-title-${id}" aria-describedby="${describedBy}">`,
    `            <span class="vol-num" aria-hidden="true">${hubModuleNumeral(id)}</span>`,
    `            <span class="module-title" id="pick-title-${id}"><span class="module-label">${escapeHtml(module.title)}</span>${module.note ? ` <span class="module-subject" id="pick-note-${id}">${escapeHtml(module.note)}</span>` : ''}</span>`,
    `            <span class="card-kicker" id="pick-meta-${id}">${escapeHtml(module.meta)}</span>`,
    `            <span class="card-desc" id="pick-desc-${id}">${escapeHtml(module.description)}</span>`,
    `            <span class="module-foot"><span class="module-overview" id="overview-${id}"></span><span class="module-cta" aria-hidden="true"><span class="cta-choose">${module.exams.length} exam${module.exams.length === 1 ? '' : 's'}</span><span class="cta-selected">Selected</span><span class="arrow"></span></span></span>`,
    `            <span class="module-progress" data-progress-module="${id}" aria-hidden="true"><span></span></span>`,
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
    ...(source && source.actual ? [`                <li class="tag tag-actual">${escapeHtml(ACTUAL_LABEL)}</li>`] : []),
    ...(source && !source.pool ? [`                <li class="tag tag-progress" data-progress-exam="${exam.key}" hidden></li>`] : []),
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
  const intro = `Each exam opens in this tab. Lesson quizzes have Easy, Medium and Hard modes${pools.length ? `; the ${pools.map(exam => `${exam.title} has ${exam.tags.find(tag => /questions$/.test(tag.text))?.text ?? 'a fixed number of questions'}`).join('; the ')}` : ''}.`;
  return [
    `    <section class="exam-panel" id="${id}" aria-labelledby="exams-heading-${id}">`,
    '      <div class="sect-head section-head">',
    `        <h2 id="exams-heading-${id}" tabindex="-1"><span class="step-num">Step 2</span> Choose your exam <span class="heading-module">· ${escapeHtml(module.title)}${module.note ? ` <span class="heading-subject">${escapeHtml(module.note)}</span>` : ''}</span></h2>`,
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

// The hub's "Today" card: every published date -> its schedule page and the lecture/exam blocks of that day
// (routine blocks left out), plus the activities that span it. Mirrors the week pages build() writes. A
// missing or invalid schedule leaves the card on its plain "this week's schedule" link.
export function hubToday(root, lessons) {
  try {
    const active = loadSchedule(root, join(root, 'data', 'schedule.json'), { allDays: true });
    const dir = join(root, 'data', 'schedules');
    const upcoming = (existsSync(dir) ? readdirSync(dir) : []).filter(name => /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) > active.week.start)
      .map(name => loadSchedule(root, join(dir, name), { allDays: true })).sort((a, b) => a.week.start.localeCompare(b.week.start));
    const activitiesPath = join(root, 'data', 'schedule-activities.json');
    const activities = existsSync(activitiesPath) ? readJson(activitiesPath) : [];
    const plainName = name => name.replace(/\s*\([^)]*\)\s*/g, ' ').trim().toLowerCase();
    const quizFor = activity => {
      const text = activity.toLowerCase();
      const hit = lessons.filter(lesson => !lesson.pool).find(lesson => (SCHEDULE_QUIZ_MATCH[lesson.key]?.test(activity)) || text.includes(plainName(lesson.name)));
      return hit ? hit.slug + '/' : '';
    };
    const days = {};
    // Each timetable's page shows its first seven days (as build() renders it); [time, activity, exam?, quiz folder].
    for (const table of [active, ...upcoming]) {
      for (const day of table.days.slice(0, 7)) {
        days[day.date] = { p: `schedule-${table.week.start}/`, b: day.blocks.filter(block => block.kind !== 'routine').map(block => [block.time, block.activity, block.kind === 'exam' ? 1 : 0, quizFor(block.activity)]) };
      }
    }
    // After the last timetable, build() writes activity-only week pages (Monday to Sunday) up to the last activity.
    const last = addDays(upcoming.length ? upcoming.at(-1).week.start : active.week.start, 6);
    const lastActivity = activities.reduce((latest, entry) => ((entry.end ?? entry.start) > latest ? (entry.end ?? entry.start) : latest), last);
    const lastPage = addDays(mondayOf(lastActivity), 6);
    for (let date = addDays(last, 1); date <= lastPage; date = addDays(date, 1)) days[date] = { p: `schedule-${mondayOf(date)}/`, b: [] };
    const events = activities.map(entry => [entry.start, entry.end ?? entry.start, entry.title, entry.when]);
    return { days, events };
  } catch {
    return { days: {}, events: [] };
  }
}
function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

// Client data for the hub's progressive enhancements: device progress (bank sizes per mode), quick search.
export function hubClientData(config, modules, lessons, today) {
  const byKey = new Map(lessons.map(lesson => [lesson.key, lesson]));
  const subject = new Map(modules.map(module => [module.id, module.note || '']));
  return {
    modules: config.map(module => ({ id: module.id, n: hubModuleNumeral(module.id), t: module.title, s: subject.get(module.id) || '' })),
    exams: config.flatMap(module => module.exams.map(exam => {
      const lesson = byKey.get(exam.key);
      const terms = lesson && !lesson.pool ? [...new Set(MODES.flatMap(mode => lesson.banks[mode].map(question => question.category)))].join(' · ') : '';
      return {
        k: exam.key, m: module.id, t: exam.title, u: exam.url, d: exam.description, c: terms,
        ...(lesson && lesson.pool ? { pool: lesson.pool.lessons } : { b: MODES.map(mode => lesson ? lesson.banks[mode].length : 0) }),
      };
    })),
    today,
  };
}

export function renderHub(template, contours, modules, lessons, { endpoint = HISTORY_ENDPOINT, base = '', root = ROOT } = {}) {
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
    MODULE_JUMP: config.map(module => `<li><a href="#${module.id}" aria-label="${escapeHtml(module.title + (module.note ? `: ${module.note}` : ''))}">${hubModuleNumeral(module.id)}</a></li>`).join(''),
    EXAM_PANELS: config.map(module => hubPanel(module, new Map(lessons.map(lesson => [lesson.key, lesson])))).join('\n\n'),
    MODULES: JSON.stringify(config).replaceAll('<', '\\u003c'),
    HUB_DATA: scriptJson(hubClientData(config, modules, lessons, hubToday(root, lessons))),
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
// Gallery page (data/gallery.json: add a photo by adding an entry, newest first)
// ---------------------------------------------------------------------------

export function loadGallery(root = ROOT) {
  const path = join(root, 'data', 'gallery.json');
  const data = readJson(path);
  const fail = message => { throw new Error(`${path}: ${message}`); };
  const text = value => typeof value === 'string' && value.trim() !== '';
  const allowed = (object, keys) => Object.keys(object).every(key => keys.includes(key));
  if (!data || typeof data !== 'object' || !allowed(data, ['title', 'intro', 'photos']) || !text(data.title) || !text(data.intro)) fail('only title, intro and photos are allowed; title and intro must be text');
  if (!Array.isArray(data.photos) || !data.photos.length) fail('photos must list at least one photo');
  const ids = new Set();
  data.photos.forEach((photo, index) => {
    const where = `photo ${index + 1}`;
    const video = photo && photo.type === 'video';
    if (!photo || !allowed(photo, video ? ['id', 'type', 'src', 'poster', 'width', 'height', 'alt', 'caption', 'muted', 'loop'] : ['id', 'src800', 'src1600', 'width', 'height', 'alt', 'caption'])) fail(`${where}: photos allow id, src800, src1600, width, height, alt, caption; videos (type "video") allow id, src, poster, width, height, alt, caption, muted, loop`);
    if (!text(photo.id) || !/^[a-z0-9-]+$/.test(photo.id) || ids.has(photo.id)) fail(`${where}: id must be a unique lowercase slug`);
    ids.add(photo.id);
    if (video) {
      if (!text(photo.src) || !/^assets\/[\w./-]+\.mp4(\?v=\w+)?$/.test(photo.src)) fail(`${where}: src must be an assets/ mp4 path`);
      if (!text(photo.poster) || !/^assets\/[\w./-]+\.jpg(\?v=\w+)?$/.test(photo.poster)) fail(`${where}: poster must be an assets/ jpg path`);
    } else {
      for (const key of ['src800', 'src1600']) {
        if (!text(photo[key]) || !/^assets\/[\w./-]+\.jpg(\?v=\w+)?$/.test(photo[key])) fail(`${where}: ${key} must be an assets/ jpg path (scripts/test/gallery.test.mjs checks the file exists)`);
      }
    }
    if (!Number.isInteger(photo.width) || !Number.isInteger(photo.height) || photo.width < 1 || photo.height < 1) fail(`${where}: width and height must be positive integers`);
    if (!text(photo.alt) || !text(photo.caption)) fail(`${where}: alt and caption must be text`);
  });
  return data;
}

export function renderGallery(template, contours, data, { base = '' } = {}) {
  const items = data.photos.map(photo => {
    const media = photo.type === 'video'
      ? `          <video class="gallery-video" controls${photo.muted ? ' muted' : ''}${photo.loop ? ' loop' : ''} preload="none" playsinline poster="../${escapeHtml(photo.poster)}" width="${photo.width}" height="${photo.height}" style="--ratio: ${photo.width} / ${photo.height}" aria-label="${escapeHtml(photo.alt)}">
            <source src="../${escapeHtml(photo.src)}" type="video/mp4">
            <a href="../${escapeHtml(photo.src)}">Download the video</a>
          </video>`
      : [
        `          <a class="gallery-open" href="../${escapeHtml(photo.src1600)}" data-caption="${escapeHtml(photo.caption)}">`,
        `            <img src="../${escapeHtml(photo.src800)}" srcset="../${escapeHtml(photo.src800)} 800w, ../${escapeHtml(photo.src1600)} 1600w" sizes="(min-width: 760px) 48vw, 100vw" width="${photo.width}" height="${photo.height}" style="--ratio: ${photo.width} / ${photo.height}" loading="lazy" decoding="async" alt="${escapeHtml(photo.alt)}">`,
        '          </a>',
      ].join('\n');
    return [
      '      <li class="gallery-item">',
      `        <figure class="gallery-figure" id="photo-${photo.id}">`,
      media,
      `          <figcaption>${escapeHtml(photo.caption)}</figcaption>`,
      '        </figure>',
      '      </li>',
    ].join('\n');
  }).join('\n');
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    CONTOURS: contours.trim(),
    GALLERY_INTRO: escapeHtml(data.intro),
    GALLERY_COUNT: String(data.photos.filter(photo => photo.type !== 'video').length),
    GALLERY_VIDEO_COUNT: String(data.photos.filter(photo => photo.type === 'video').length),
    GALLERY_ITEMS: items,
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

export function loadSchedule(root = ROOT, file = join(root, 'data', 'schedule.json'), { allDays = false } = {}) {
  const data = readJson(file);
  const fail = message => { throw new Error(`${file}: ${message}`); };
  const text = (value, max = 120) => typeof value === 'string' && value.trim() !== '' && value === value.trim() && value.length <= max;
  const allowed = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
  if (!allowed(data, ['course', 'unit', 'week', 'students', 'prepared', 'days', 'menuNotice', 'notice'])) fail('only course, unit, week, students, prepared, days, menuNotice and notice are allowed');
  if (data.menuNotice !== undefined && !text(data.menuNotice, 300)) fail('menuNotice must be a short text');
  if (data.notice !== undefined && !text(data.notice, 300)) fail('notice must be a short text');
  if (!text(data.course, 40) || !text(data.unit)) fail('course and unit must be short texts');
  if (data.students !== undefined && (!Number.isInteger(data.students) || data.students < 1 || data.students > 200)) fail('students must be a whole number');
  if (data.prepared !== undefined && !parseDate(data.prepared)) fail('prepared must be a YYYY-MM-DD date');
  const week = data.week;
  if (!allowed(week, ['number', 'of', 'start', 'end']) || !Number.isInteger(week.number) || !Number.isInteger(week.of) || week.number < 1 || week.number > week.of) fail('week must be { number, of, start, end } with 1 <= number <= of');
  const start = parseDate(week.start);
  const end = parseDate(week.end);
  const feedLength = start && end ? (end - start) / 86400000 + 1 : 0;
  if (!start || !end || end < start || feedLength > 28) fail('week dates must cover consecutive published dates, up to 28 days');
  const weekLength = Math.min(feedLength, 7);
  if (!Array.isArray(data.days) || data.days.length !== feedLength) fail('days must list every date in the published feed');
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
  return allDays ? data : { ...data, week: {...week, end: new Date(start.getTime()+(weekLength-1)*86400000).toISOString().slice(0,10)}, days: data.days.slice(0, weekLength) };
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

export function renderSchedule(template, contours, data, lessons, { base = '', activities = [], weeks = [] } = {}) {
  const activitiesByDate = new Map();
  for (const activity of activities) {
    if (!activity.start) continue;
    const start = parseDate(activity.start);
    const end = parseDate(activity.end ?? activity.start);
    if (!start || !end || end < start || end - start > 31 * 86400000) {
      throw new Error(`Invalid calendar dates for ${activity.title}`);
    }
    for (let day = start.getTime(); day <= end.getTime(); day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10);
      if (!activitiesByDate.has(date)) activitiesByDate.set(date, []);
      activitiesByDate.get(date).push(activity);
    }
  }
  const calendarDates = [...activitiesByDate.keys()].sort();
  const { week } = data;
  const activityOnly = week.number === undefined;
  const renderActivities = (entries, linkDates = false) => entries.map(({ when, title, detail, start }) => {
    const target = weeks.find(item => start >= item.start && start <= item.end);
    const path = target && target.start !== week.start ? `../schedule-${target.start}/` : '';
    const date = linkDates && start
      ? `<a href="${path}#day-${escapeHtml(start)}">${escapeHtml(when)}</a>`
      : escapeHtml(when);
    return [
      '<li>',
      `  <p class="label activity-date">${date}</p>`,
      `  <p class="activity-title">${escapeHtml(title)}</p>`,
      ...(detail ? [`  <p class="activity-detail">${escapeHtml(detail)}</p>`] : []),
      '</li>',
    ].join('\n');
  }).join('\n');
  const activitySection = activities.length ? [
    '<section class="schedule-activities" aria-labelledby="schedule-activities-title">',
    '  <h2 id="schedule-activities-title">Upcoming activities</h2>',
    `  <ul role="list">\n${renderActivities(activities, true)}\n  </ul>`,
    '</section>',
  ].join('\n    ') : '';
  const dayActivities = date => activitiesByDate.has(date)
    ? `<div class="schedule-activities day-activities"><p class="label">Activities for this date</p><ul role="list">${renderActivities(activitiesByDate.get(date))}</ul></div>`
    : '';
  const academic = data.days.flatMap(day => day.blocks).filter(block => block.kind !== 'routine').length;
  const days = data.days.map(day => [
    `        <section class="day" id="day-${day.date}" data-date="${day.date}" aria-labelledby="day-h-${day.date}"${day.date !== data.days[0].date ? ' hidden' : ''}>`,
    `          <h2 class="day-head" id="day-h-${day.date}"><span class="day-name">${escapeHtml(day.day)}</span> <span class="day-date mono">${escapeHtml(scheduleDate(day.date, { year: false }))}</span><span class="day-today" hidden> · Today</span></h2>`,
    ...(activitiesByDate.has(day.date) ? [dayActivities(day.date)] : []),
    ...(day.blocks.length ? [
      '          <ol class="blocks">',
      ...day.blocks.map(block => scheduleBlock(block, lessons)),
      '          </ol>',
    ] : [`          <p class="note">${activitiesByDate.has(day.date)
      ? 'No hourly timetable has been published for this date.'
      : 'No activities have been published for this date.'}</p>`]),
    '        </section>',
  ].join('\n')).join('\n');
  const dayNav = data.days.map(day => `<li><a href="#day-${day.date}" data-date="${day.date}"><span>${escapeHtml(day.day.slice(0, 3))}</span> <span class="mono">${escapeHtml(day.date.slice(8))}</span></a></li>`).join('\n          ');
  return fillTemplate(template, {
    BASE_CSS: baseCss(base, '../assets/'),
    FONT_PRELOAD: fontPreloads('../assets/'),
    CONTOURS: contours.trim(),
    WEEK_LABEL: activityOnly ? 'Activity calendar' : escapeHtml(`${ordinal(week.number)} week of ${week.of}`),
    WEEK_RANGE: escapeHtml(scheduleRange(week)),
    WEEK_DESCRIPTION: activityOnly
      ? 'Select a day to see its published activities.'
      : 'Lectures and exams are shaded; a subject with a mock exam on this site links to its quiz.',
    COURSE: escapeHtml(data.course),
    UNIT: escapeHtml(data.unit),
    SCHEDULE_META: [
      ...(activityOnly ? [] : [['Week', `${week.number} of ${week.of}`]]),
      ['Dates', scheduleRange(week)],
      ...(activityOnly ? [] : [['Academic blocks', String(academic)]]),
      ...(data.students ? [['Students', String(data.students)]] : []),
    ].map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('\n          '),
    PREPARED: escapeHtml([data.notice || '', data.prepared ? `Schedule prepared ${scheduleDate(data.prepared)}.` : '', data.menuNotice || ''].filter(Boolean).join(' ')),
    ACTIVITIES: activitySection,
    CALENDAR_DATES: calendarDates.map(date => `<option value="${date}">${escapeHtml(scheduleDate(date))}</option>`).join('\n'),
    DAY_NAV: dayNav,
    DAYS: days,
    SCHEDULE_DATA: scriptJson({ start: week.start, end: week.end, range: scheduleRange(week), days: data.days.map(day => day.date), weeks, activityOnly }),
  });
}

function activityScheduleWeeks(timetables, activities) {
  const lastWeek = timetables.at(-1);
  const lastDate = activities.reduce((latest, entry) => {
    const end = entry.end ?? entry.start;
    return end > latest ? end : latest;
  }, lastWeek.week.end);
  const weeks = [];
  const { course, unit } = lastWeek;
  const monday = parseDate(lastWeek.week.start);
  monday.setUTCDate(monday.getUTCDate() + 7);
  for (; monday.toISOString().slice(0, 10) <= lastDate; monday.setUTCDate(monday.getUTCDate() + 7)) {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(monday.getTime());
      date.setUTCDate(date.getUTCDate() + offset);
      return { date: date.toISOString().slice(0, 10), day: SCHEDULE_DAYS[date.getUTCDay()], blocks: [] };
    });
    weeks.push({ course, unit, week: { start: days[0].date, end: days[6].date }, days });
  }
  return weeks;
}

// Builds every page; returns { path: html } for the files written.
export function build({ root = ROOT, out = root, endpoint = HISTORY_ENDPOINT, write = true } = {}) {
  const { modules, lessons } = loadLessons(root);
  const contours = readFileSync(join(root, 'src', 'engine', 'contours.svg'), 'utf8');
  const base = readFileSync(join(root, 'src', 'shared', 'base.css'), 'utf8');
  const engine = readFileSync(join(root, 'src', 'engine', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
  const study = loadStudy(root, lessons);
  const actual = actualExamData(root, lessons);
  for (const lesson of lessons) lesson.actual = actual.pages.get(lesson.key) ?? null;
  const pages = {};
  Object.assign(pages, renderActualPages(root, engine, contours, actual, lessons, { base, endpoint }));
  for (const lesson of lessons) pages[`${lesson.slug}/index.html`] = renderQuizPage(engine, contours, lesson, { endpoint, base, study: studyQuizLinks(root, lesson, study) });
  pages['index.html'] = renderHub(readFileSync(join(root, 'src', 'hub', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, modules, lessons, { endpoint, base, root });
  pages['class/index.html'] = renderClass(readFileSync(join(root, 'src', 'class', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, loadClass(root), { base });
  pages['gallery/index.html'] = renderGallery(readFileSync(join(root, 'src', 'gallery', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, loadGallery(root), { base });
  const scheduleTemplate = readFileSync(join(root, 'src', 'schedule', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
  const activities = readJson(join(root, 'data', 'schedule-activities.json'));
  const activeSchedule = loadSchedule(root);
  // The public feed includes upcoming dates for the bot; the main page keeps the active week.
  const upcoming = readdirSync(join(root, 'data', 'schedules')).filter(name => /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0,10) > activeSchedule.week.start)
    .map(name => loadSchedule(root, join(root, 'data', 'schedules', name))).sort((a,b) => a.week.start.localeCompare(b.week.start));
  const timetables = [activeSchedule, ...upcoming];
  const weekPages = [...timetables, ...activityScheduleWeeks(timetables, activities)];
  const weeks = weekPages.map(({ week: { start, end } }) => ({ start, end }));
  const renderWeek = data => {
    const links = weekPages.map(({ week }) => {
      const href = week.start === activeSchedule.week.start ? `../schedule/?week=${week.start}` : `../schedule-${week.start}/`;
      return `<a href="${href}"${week.start === data.week.start ? ' aria-current="page"' : ''}>${escapeHtml(scheduleRange(week))}</a>`;
    }).join('');
    const range = escapeHtml(scheduleRange(data.week));
    return renderSchedule(scheduleTemplate, contours, data, lessons, { base, activities, weeks })
      .replace(/<title>[^<]*<\/title>/, `<title>Weekly training schedule · ${range} · SOAC 52 - 2026 · Bandwidth Brothers</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Bandwidth Brothers, SOAC 52 - 2026: training schedule for ${range}, with times, instructors, venues, uniforms and menus.">`)
      .replace('<nav class="week-nav"', `<nav class="schedule-weeks" aria-label="Available weeks">${links}</nav><nav class="week-nav"`);
  };
  for (const data of weekPages) pages[`schedule-${data.week.start}/index.html`] = renderWeek(data);
  const rollover = `<script>(function(){if(!window.location||location.hash||new URLSearchParams(location.search).get('week')==='${activeSchedule.week.start}')return;const weeks=${scriptJson(weeks.slice(1))};const today=(window.__SCHEDULE_NOW||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).slice(0,10);const week=weeks.find(w=>today>=w.start&&today<=w.end);if(week)location.replace('../schedule-'+week.start+'/'+location.search+'#day-'+today);})();</script>`;
  pages['schedule/index.html'] = pages[`schedule-${activeSchedule.week.start}/index.html`].replace('</body>', rollover + '</body>');
  pages['instructor/index.html'] = renderInstructor(readFileSync(join(root, 'src', 'instructor', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), contours, modules, lessons, { endpoint, base });
  pages['codes-ciphers/index.html'] = fillTemplate(readFileSync(join(root, 'src', 'cipher', 'template.html'), 'utf8').replace(/\r\n/g, '\n'), {
    BASE_CSS: baseCss(base, '../assets/'), FONT_PRELOAD: fontPreloads('../assets/'),
    DESK_CSS: readFileSync(join(root, 'src', 'cipher', 'desk.css'), 'utf8').replace(/\r\n/g, '\n'),
    ENGINE: readFileSync(join(root, 'src', 'cipher', 'engine.mjs'), 'utf8').replace(/\r\n/g, '\n'),
    UI: readFileSync(join(root, 'src', 'cipher', 'ui.js'), 'utf8').replace(/\r\n/g, '\n'),
    SCAN_PARSER: readFileSync(join(root, 'src', 'cipher', 'scan-parser.mjs'), 'utf8').replace(/\r\n/g, '\n'),
    SCAN_UI: readFileSync(join(root, 'src', 'cipher', 'scan-ui.js'), 'utf8').replace(/\r\n/g, '\n'),
  });
  Object.assign(pages, renderStudyPages(root, modules, lessons, study, { escapeHtml, scriptJson, fillTemplate, baseCss, fontPreloads, base, extra: render => renderReviewerIndex(render, actual, lessons) }));
  const siteIndex = buildSiteIndex({ modules, lessons, study, pages });
  // The hub's quick finder also lists the study pages, tools and guides.
  pages['index.html'] = pages['index.html'].replace(/(<script type="application\/json" id="hub-data">)([\s\S]*?)(<\/script>)/, (all, open, json, close) => {
    const hub = JSON.parse(json);
    hub.pages = siteSearchPages({ lessons, study, pages });
    return open + scriptJson(hub) + close;
  });
  // Give every generated section the same per-visit crest selection.
  for (const [path, source] of Object.entries(pages)) {
    const up = '../'.repeat(path.split('/').length - 1);
    const favicon = ({reviewer:'anime',library:'bronze','how-to':'jungle','los-radios':'neon','codes-ciphers':'red',schedule:'philippines',class:'comic',gallery:'comic',instructor:'realistic'})[path.split('/')[0]] || 'colored';
    let html = source.replace('</head>', '<link rel="stylesheet" href="' + up + 'assets/identity.css">\n</head>');
    html = html.replace('</head>', '<link rel="stylesheet" href="' + up + 'assets/ui-polish.css">\n</head>');
    html = html.replace('</head>', '<link rel="icon" type="image/png" href="' + up + 'assets/favicons/crest-' + favicon + '.png">\n</head>');
    if (!source.includes('class="study-masthead"')) {
      const ribbon = '<div class="identity-ribbon" role="region" aria-label="Class identity"><a href="' + (up || './') + '" class="identity-home"><img data-class-crest src="' + up + 'assets/bandwidth-brothers-colored-400.webp" width="48" height="48" alt="Bandwidth Brothers crest"><span>Bandwidth Brothers<small>SOAC 52–26</small></span></a><span class="identity-edition">The crest collection <span data-crest-label>Original</span></span></div>';
      const skip = /(<a class="skip-link"[^>]*>[^<]*<\/a>)/;
      html = skip.test(html) ? html.replace(skip, '$1' + ribbon) : html.replace(/(<body[^>]*>)/, '$1' + ribbon);
    }
    html = withShareMetadata(html, path, up);
    html = html.replace('</head>', '<link rel="stylesheet" href="' + up + 'assets/site-index.css">\n</head>');
    html = html.replace('</body>', () => siteIndex(up, path) + '\n</body>');
    html = html.replace('</body>', '<aside class="domain-seal" aria-label="Site signature"><img class="domain-sigil" src="' + up + 'assets/domain-void-hand-320.webp" width="160" height="221" alt="" loading="lazy" decoding="async"><span><small>WITHIN THE DOMAIN EXPANSION OF</small><strong>1LT INTOY, &#39;22</strong><em data-domain-quote>“You see, but you do not observe.”</em><cite data-domain-attribution>— Sherlock Holmes · A Scandal in Bohemia · Arthur Conan Doyle</cite></span></aside>\n</body>');
    pages[path] = html.replace('</body>', '<script src="' + up + 'assets/identity.js" defer></script>\n</body>');
  }
  // The instructor page fetches its question text from this sibling file (kept out of the 1 MB page).
  pages['instructor/items.json'] = JSON.stringify(instructorData(modules, lessons)) + '\n';
  if (write) {
    for (const [path, html] of Object.entries(pages)) {
      mkdirSync(dirname(join(out, path)), { recursive: true });
      writeFileSync(join(out, path), html);
    }
  }
  return pages;
}

// The Comprehensive Exam Reviewer's quiz pages: one per graded exam and the mixed set.
function renderActualPages(root, engine, contours, actual, lessons, { base, endpoint }) {
  const heroSvg = readFileSync(join(root, 'src', 'actual', 'hero.svg'), 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const byKey = new Map(lessons.map(lesson => [lesson.key, lesson]));
  const pages = {};
  const warning = 'Each question keeps the exam’s stem and answer key. The portal showed no answer choices, so the other choices are answer keys of other graded-exam questions. Study the complete lessons as well.';
  actual.perExam.forEach(({ exam, bank, count, attempt, exams }, index) => {
    const number = String(index + 1).padStart(2, '0');
    const also = exam.pages.map(key => byKey.get(key).name);
    const skipped = exam.skipped.length ? ` ${exam.skipped.length} of ${exam.itemCount} items are left out (${exam.skipped.map(item => `question ${item.n}`).join(', ')}): see the reviewer index.` : '';
    pages[`${REVIEWER_SLUG}/${exam.slug}/index.html`] = renderActualPage(engine, contours, {
      key: exam.key, title: exam.title, heroSvg, warning, all: false,
      eyebrow: `${REVIEWER_TITLE} · Graded exam ${number}`,
      lede: `${count} questions from the class’s graded ${exam.title}, ${displayDate(exam.date)}, as multiple choice.${also.length ? ` They also appear as the Actual Exam category on ${also.join(' and ')}.` : ''}${skipped}`,
      actual: { bank, count, attempt, exams }, categoryOrder: [exam.title],
      ref: `${REVIEWER_TITLE} · Exam ${number}`,
      meta: { source: `Ref. ${examCitation(exam)}`, rows: [['Questions', `${count} per attempt`], ['Exam date', displayDate(exam.date)], ['Source', 'Graded exam (stem and key)']] },
    }, { base, endpoint });
  });
  const all = actual.all;
  pages[`${REVIEWER_SLUG}/all/index.html`] = renderActualPage(engine, contours, {
    key: 'gradedall', title: 'All graded exams, mixed', heroSvg, warning, all: true,
    eyebrow: `${REVIEWER_TITLE} · Mixed set`,
    lede: `${all.count} questions from all ${actual.exams.length} graded exams, mixed: take ${all.attempt} at a time (questions you have not seen come first) or the full set at once.`,
    actual: all, categoryOrder: actual.exams.map(exam => exam.title),
    ref: `${REVIEWER_TITLE} · Mixed set`,
    meta: { source: 'Ref. SOAC 52-2026 graded exams', rows: [['Questions', `${all.attempt} per attempt · full set ${all.full}`], ['Exams', String(actual.exams.length)], ['Source', 'Graded exams (stem and key)']] },
  }, { base, endpoint });
  return pages;
}

// comprehensive-reviewer/: every graded exam as its own quiz, the mixed set, and where each exam appears.
function renderReviewerIndex(render, actual, lessons) {
  const byKey = new Map(lessons.map(lesson => [lesson.key, lesson]));
  const e = escapeHtml;
  const total = actual.exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  const skipped = actual.exams.flatMap(exam => exam.skipped.map(item => ({ exam, ...item })));
  const card = (exam, index) => {
    const pages = exam.pages.map(key => byKey.get(key));
    return '<li class="graded-card"><p class="graded-num" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</p><div class="graded-main"><h3 id="graded-' + exam.key + '">' + e(exam.title) + '</h3>' +
      '<p class="graded-meta"><span>' + e(displayDate(exam.date)) + '</span><span>' + exam.questions.length + (exam.skipped.length ? ' of ' + exam.itemCount : '') + ' questions</span></p>' +
      (pages.length ? '<p class="graded-also">Also the Actual Exam category on ' + pages.map(lesson => '<a href="../' + lesson.slug + '/">' + e(lesson.name) + '</a>').join(', ') + '.</p>' : '<p class="graded-also">Mixed topics: available here and in the mixed set.</p>') +
      '<a class="study-cta graded-start" href="' + exam.slug + '/" aria-describedby="graded-' + exam.key + '">Take this exam <span aria-hidden="true">→</span></a></div></li>';
  };
  const body = '<div class="graded-layout">' +
    '<section class="graded-mixed" aria-labelledby="mixed-heading"><p class="actual-badge">Actual Exam</p><h2 id="mixed-heading">All graded exams, mixed</h2><p>' + actual.all.count + ' questions from all ' + actual.exams.length + ' exams (a question repeated in a later exam is asked once). Take ' + actual.all.attempt + ' at a time, unseen questions first, or the full set in one sitting.</p><a class="study-cta graded-start" href="all/">Start the mixed set <span aria-hidden="true">→</span></a></section>' +
    '<section class="reviewer-module" aria-labelledby="graded-heading"><div class="module-heading"><div><p class="study-eyebrow">' + e(ACTUAL_NOTE) + '</p><h2 id="graded-heading">The graded exams</h2></div><p class="study-chip">' + actual.exams.length + ' exams · ' + total + ' questions</p></div>' +
    '<ol class="graded-list">' + actual.exams.map(card).join('') + '</ol></section>' +
    '<section class="reviewer-module graded-notes" aria-labelledby="notes-heading"><h2 id="notes-heading">How these questions were prepared</h2><ul>' +
    '<li>The exam portal’s review screen showed each question and its answer key, but not the answer choices. Here every item is multiple choice: the key plus three other answer keys from the same exam where possible (similar type and length), otherwise from the same module. True/false items keep two choices.</li>' +
    '<li>Questions and keys are as recorded, except quote marks and apostrophes the export had garbled, which are restored. No student answers, names or scores are kept.</li>' +
    '<li>Each question cites its graded exam, not a lesson page. Actual Exam attempts are saved to the class history as Actual Exam.</li>' +
    '<li>Left out (' + skipped.length + '): ' + skipped.map(item => e(item.exam.title + ', question ' + item.n + ': ' + item.reason)).join(' ') + '</li>' +
    '</ul></section></div>';
  render(REVIEWER_SLUG + '/index.html', 1, 'exam-reviewer', REVIEWER_TITLE, 'Practise with the questions from our real, graded exams before the Comprehensive Exam.', body, {
    eyebrow: 'Actual Exam · SOAC 52-2026',
    meta: '<p class="hero-stats"><span><strong>' + actual.exams.length + '</strong> graded exams</span><span><strong>' + total + '</strong> questions</span></p>',
  });
}

const SITE_URL = 'https://atticus-42.github.io/quiz-hub/';
// Every page gets a description (when its template has none) and share-preview tags, so links posted in chat show a card.
function withShareMetadata(html, path, up) {
  if (html.includes('<meta name="robots" content="noindex">')) return html;
  const plain = value => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const clip = (value, max) => {
    if (value.length <= max) return value;
    return value.slice(0, max).replace(/&[#a-z0-9]*$/i, '').replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '') + '…';
  };
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Bandwidth Brothers';
  let description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!description) {
    const lede = (html.match(/<p class="(?:hero-lede|lede)">([\s\S]*?)<\/p>/) || [])[1];
    description = lede ? clip(plain(lede).replace(/"/g, '&quot;'), 155) : `${title}: Bandwidth Brothers, SOAC 52 - 2026 practice quizzes, reviewers and study tools.`;
    html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n  <meta name="description" content="${description}">`);
  }
  const dir = path.replace(/index\.html$/, '');
  const tags = [
    ['property', 'og:site_name', 'Bandwidth Brothers · SOAC 52 - 2026'], ['property', 'og:type', 'website'],
    ['property', 'og:title', title], ['property', 'og:description', description], ['property', 'og:url', SITE_URL + dir],
    ['property', 'og:image', SITE_URL + 'assets/banner-1600.jpg'], ['property', 'og:image:width', '1600'], ['property', 'og:image:height', '900'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'theme-color', '#2e3418'],
  ].map(([attr, key, value]) => `<meta ${attr}="${key}" content="${value}">`).join('\n  ');
  return html.replace('</head>', `  ${tags}\n</head>`);
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
