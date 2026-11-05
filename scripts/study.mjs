import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function loadStudy(root, lessons) {
  const directory = join(root, 'data', 'reviewers');
  const reviewers = {};
  for (const file of readdirSync(directory).filter(name => name.endsWith('.json'))) {
    for (const [key, reviewer] of Object.entries(json(join(directory, file)))) {
      if (reviewers[key]) throw new Error('Duplicate reviewer: ' + key);
      reviewers[key] = reviewer;
    }
  }
  const data = json(join(root, 'data', 'library.json'));
  const byKey = new Map(lessons.filter(lesson => reviewers[lesson.key] && !lesson.pool && !(lesson.prominent && lesson.order === 0)).map(lesson => [lesson.key, lesson]));
  const documents = [];
  const primary = {};
  const add = doc => {
    if (!slug.test(doc.id) || documents.some(item => item.id === doc.id)) throw new Error('Invalid or duplicate document ID: ' + doc.id);
    if (doc.file && (!slug.test(doc.file) || !existsSync(join(root, 'library', 'files', doc.file + '.pdf')))) {
      throw new Error('Missing PDF: ' + doc.file);
    }
    for (const key of [...doc.cited, ...doc.related]) if (!byKey.has(key)) throw new Error('Unknown lesson for ' + doc.id + ': ' + key);
    documents.push(doc);
  };
  for (const item of data.manuals) add({ kind: 'manual', cited: [], related: [], ...item });
  for (const [key, lesson] of byKey) {
    const reviewer = reviewers[key];
    const source = data.lessonSources[key];
    if (!reviewer || !source) throw new Error('Missing study material: ' + key);
    if (!reviewer.brief || reviewer.facts.length < 4 || !reviewer.insights.length || !reviewer.scenario?.analysis || !Array.isArray(reviewer.steps) || reviewer.checks.length < 2) {
      throw new Error('Incomplete reviewer: ' + key);
    }
    const [title, file, manual] = source;
    if (manual) {
      if (!documents.some(doc => doc.id === manual && doc.cited.includes(key))) throw new Error('Invalid primary manual: ' + key);
      primary[key] = manual;
    } else {
      primary[key] = 'source-' + key;
      add({ id: primary[key], title, file, kind: 'lesson', edition: 'Original course source', cited: [key], related: [] });
    }
    add({ id: 'study-' + key, title: lesson.name + ' · Reviewer 101', file: 'reviewer-' + lesson.slug,
      kind: 'lesson', edition: 'Study edition', cited: [key], related: [] });
  }
  for (const key of Object.keys(reviewers)) if (!byKey.has(key)) throw new Error('Unknown reviewer: ' + key);
  return { reviewers, documents, primary, byKey };
}

export function studyQuizLinks(root, lesson, study) {
  const selected = new Set(lesson.pool?.lessons ?? [lesson.key]);
  const hybrid = join(root, 'lessons', lesson.key, 'coverage.json');
  const byQuestion = {};
  if (lesson.prominent && lesson.order === 0 && !lesson.pool && existsSync(hybrid)) {
    for (const row of Object.values(json(hybrid)).flat()) {
      const sources = [...new Set([row.primaryLesson, ...row.supportQids.map(qid => qid.split('-')[0])])];
      byQuestion[row.qid] = sources;
      sources.forEach(key => selected.add(key));
    }
  }
  const sources = {};
  for (const key of selected) {
    if (!study.byKey.has(key)) continue;
    const doc = study.documents.find(item => item.id === study.primary[key]);
    sources[key] = {
      title: doc.title, doc: doc.id, exactPages: Boolean(doc.file),
      studyDoc: 'study-' + key,
      manuals: study.documents.filter(item => item.kind === 'manual' && item.id !== doc.id && item.cited.includes(key))
        .map(item => ({ title: item.title, id: item.id })),
    };
  }
  const reviewer = study.byKey.has(lesson.key) ? '../reviewer/' + lesson.key + '/' : '../reviewer/#' + lesson.module;
  return { reviewer, sources, byQuestion };
}

export function renderStudyPages(root, modules, lessons, study, { escapeHtml: e, scriptJson, fillTemplate, baseCss, fontPreloads, base }) {
  const template = readFileSync(join(root, 'src', 'study', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
  const css = readFileSync(join(root, 'src', 'study', 'study.css'), 'utf8');
  const pages = {};
  const render = (path, depth, section, title, intro, body, scripts = '') => {
    const up = '../'.repeat(depth);
    pages[path] = fillTemplate(template, {
      BASE_CSS: baseCss(base, up + 'assets/'), STUDY_CSS: css, FONT_PRELOAD: fontPreloads(up + 'assets/'),
      HOME: up, REVIEWER_HREF: up + 'reviewer/', LIBRARY_HREF: up + 'library/',
      REVIEWER_CURRENT: section === 'reviewer' ? ' aria-current="page"' : '',
      LIBRARY_CURRENT: section === 'library' ? ' aria-current="page"' : '',
      PAGE_TITLE: e(title), TITLE: e(title), INTRO: e(intro), BODY: body, SCRIPTS: scripts,
    });
  };
  const docLink = (doc, prefix, page) => '<a href="' + prefix + 'library/?doc=' + doc.id + (page ? '&amp;page=' + page : '') + '">' + e(doc.title) + '</a>';
  const sections = modules.map(module => {
    const entries = lessons.filter(lesson => lesson.module === module.id && study.byKey.has(lesson.key));
    return entries.length ? '<section id="' + module.id + '" class="study-panel"><h2>' + e(module.title + ' · ' + module.note) +
      '</h2><ul class="study-grid">' + entries.map(lesson => '<li><a href="' + lesson.key + '/">' + e(lesson.name) + '</a><p>' +
        e(study.reviewers[lesson.key].brief) + '</p></li>').join('') + '</ul></section>' : '';
  });
  render('reviewer/index.html', 1, 'reviewer', 'Reviewer 101', 'Start with a quick briefing, then practice making a decision and explain it in your own words.', sections.join(''));
  for (const [key, lesson] of study.byKey) {
    const item = study.reviewers[key];
    const docs = study.documents.filter(doc => doc.cited.includes(key) || doc.related.includes(key));
    const primaryDoc = docs.find(doc => doc.id === study.primary[key]);
    const studyDoc = docs.find(doc => doc.id === 'study-' + key);
    const page = lesson.rules.ref?.label === 'PAM 6-0102 PDF page' ? lesson.rules.ref.min : null;
    const panel = (title, body, extra = '') => '<section class="study-panel" ' + extra + '><h2>' + title + '</h2>' + body + '</section>';
    const body =
      '<p class="study-actions"><a href="../#' + lesson.module + '">All reviewers</a><a href="../../' + lesson.slug + '/">Take the practice exam</a>' + docLink(studyDoc, '../../') + '</p>' +
      panel('Quick briefing', '<p>' + e(item.brief) + '</p><p>Read with ' + docLink(primaryDoc, '../../', primaryDoc.file ? page : null) + '.</p>') +
      panel('Know the facts', '<dl class="fact-list">' + item.facts.map(fact => '<div><dt>' + e(fact.term) + '</dt><dd>' + e(fact.detail) + '</dd></div>').join('') + '</dl>') +
      panel('Understand the reasoning', '<ul>' + item.insights.map(insight => '<li>' + e(insight) + '</li>').join('') + '</ul>') +
      panel('Apply it', '<p class="study-eyebrow">Fictional Philippine Army classroom exercise</p><p>' + e(item.scenario.situation) +
        '</p><p><strong>' + e(item.scenario.question) + '</strong></p><details><summary>Show the decision and reasoning</summary><p>' + e(item.scenario.analysis) + '</p></details>') +
      (item.steps.length ? panel('How to practice', '<ol>' + item.steps.map(step => '<li>' + e(step) + '</li>').join('') + '</ol><p>Review the steps with ' + docLink(primaryDoc, '../../', primaryDoc.file ? page : null) + '.</p>') : '') +
      panel('Check yourself', item.checks.map(check => '<details><summary>' + e(check.question) + '</summary><p>' + e(check.answer) + '</p></details>').join('')) +
      panel('References', '<ul>' + docs.filter(doc => doc !== studyDoc).map(doc => '<li>' + docLink(doc, '../../', doc === primaryDoc && doc.file ? page : null) +
        ' <span class="study-muted">· ' + (doc === primaryDoc ? 'Primary course source' : doc.cited.includes(key) ? 'Cited by the course' : 'Related reading') + '</span></li>').join('') + '</ul>');
    render('reviewer/' + key + '/index.html', 2, 'reviewer', lesson.name, 'Reviewer 101 · ' + (modules.find(module => module.id === lesson.module)?.title ?? 'Supporting Lessons'), body);
  }
  const metadata = study.documents.map(doc => ({
    ...doc, lessons: [...doc.cited, ...doc.related].map(key => ({ key, title: study.byKey.get(key).name, cited: doc.cited.includes(key) })),
  }));
  const rows = metadata.map(doc => '<li class="library-row" data-kind="' + doc.kind + '"><h3><a href="?doc=' + doc.id + '#document">' + e(doc.title) + '</a></h3><p>' +
    e([doc.kind === 'manual' ? 'Manual' : 'Lesson', doc.edition, doc.file ? 'PDF available' : 'Citation record'].filter(Boolean).join(' · ')) + '</p>' +
    '<p>' + e(doc.lessons.map(lesson => lesson.title).join(' · ')) + '</p></li>').join('');
  const body = '<section id="document" class="study-panel" hidden aria-labelledby="document-title">' +
    '<p class="study-eyebrow">Library document</p><h2 id="document-title"></h2><p id="document-meta"></p>' +
    '<div id="reader" hidden><div class="reader-controls" aria-label="PDF controls"><button id="pdf-prev" type="button">Previous</button>' +
    '<label for="pdf-page">PDF page</label><input id="pdf-page" type="number" min="1" value="1"><span id="pdf-total"></span>' +
    '<button id="pdf-next" type="button">Next</button><label for="pdf-zoom">Zoom</label><select id="pdf-zoom">' +
    '<option value="1">Fit width</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select>' +
    '<a id="pdf-file">Open PDF file</a></div><p id="pdf-status" role="status"></p><div id="pdf-surface"><canvas id="pdf-canvas" aria-label="Current PDF page"></canvas></div></div>' +
    '<details><summary id="document-lesson-summary">Connected lessons</summary><ul id="document-lessons"></ul></details></section>' +
    '<section class="study-panel" aria-labelledby="catalogue-title"><h2 id="catalogue-title">Browse the library</h2>' +
    '<nav class="study-actions" aria-label="Library categories"><a href="./">All documents</a><a href="?type=lesson">Lessons</a><a href="?type=manual">Manuals</a></nav>' +
    '<div class="library-controls"><label for="library-search">Search by title, manual number or lesson</label><input id="library-search" type="search">' +
    '<label for="library-type">Show</label><select id="library-type"><option value="all">All documents</option><option value="lesson">Lessons</option><option value="manual">Manuals</option></select></div>' +
    '<p id="library-count" role="status"></p><ul class="library-list">' + rows + '</ul></section>';
  render('library/index.html', 1, 'library', 'Study Library', 'Read lesson study editions, course sources and manuals directly on Quiz Hub.', body,
    '<script type="application/json" id="library-data">' + scriptJson(metadata) + '</script><script type="module" src="../assets/library.js"></script>');
  return pages;
}
