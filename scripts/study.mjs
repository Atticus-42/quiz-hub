import { renderOrganizations } from './unit-organizations.mjs';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderResources } from './resources.mjs';
import { loadReviewerFocus, renderReviewerFocus } from './reviewer-focus.mjs';

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
    if (doc.restricted && (doc.file || doc.web)) throw new Error('Restricted source has a public download: ' + doc.id);
    if (doc.file && (!slug.test(doc.file) || !existsSync(join(root, 'library', 'files', doc.file + '.pdf')))) {
      throw new Error('Missing PDF: ' + doc.file);
    }
    for (const key of [...doc.cited, ...doc.related]) if (!byKey.has(key)) throw new Error('Unknown lesson for ' + doc.id + ': ' + key);
    documents.push(doc);
  };
  for (const item of data.manuals) add({ kind: 'manual', cited: [], related: [], ...item });
  for (const item of data.additionalDocuments || []) add({ cited: [], related: [], ...item });
  for (const item of json(join(root, 'data', 'howto-sources.json'))) add(item);
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
      add({ id: primary[key], title, file, kind: 'lesson', edition: 'Original course source', cited: [key], related: [], ...(data.restrictedLessonSources?.includes(key) ? { restricted: true } : {}) });
    }
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
      title: doc.title, citationName: study.byKey.get(key).name, available: Boolean(doc.file), doc: doc.id, href: doc.file ? '../library/files/' + doc.file + '.pdf' : '../library/?doc=' + doc.id + '#document', exactPages: Boolean(doc.file),
      studyDoc: '../reviewer/' + key + '/',
      manuals: study.documents.filter(item => item.kind === 'manual' && item.id !== doc.id && item.cited.includes(key))
        .map(item => ({ title: item.title, available: Boolean(item.file), citationPage: item.citationPage, id: item.id, href: item.file ? '../library/files/' + item.file + '.pdf' : '../library/?doc=' + item.id + '#document' })),
    };
  }
  const reviewer = study.byKey.has(lesson.key) ? '../reviewer/' + lesson.key + '/' : '../reviewer/#' + lesson.module;
  return { reviewer, sources, byQuestion };
}

export function renderStudyPages(root, modules, lessons, study, { escapeHtml: e, scriptJson, fillTemplate, baseCss, fontPreloads, base }) {
  const focus = loadReviewerFocus(root);
  const template = readFileSync(join(root, 'src', 'study', 'template.html'), 'utf8').replace(/\r\n/g, '\n');
  const css = readFileSync(join(root, 'src', 'study', 'study.css'), 'utf8');
  const pages = {};
  const render = (path, depth, section, title, intro, body, { eyebrow, meta = '', art = '', scripts = '' }) => {
    const up = '../'.repeat(depth);
    pages[path] = fillTemplate(template, {
      BASE_CSS: baseCss(base, up + 'assets/'), STUDY_CSS: css, FONT_PRELOAD: fontPreloads(up + 'assets/'),
      CREST_HREF: up + 'assets/bandwidth-brothers-colored-400.webp', BRAND_HREF: up, HOME: up, REVIEWER_HREF: up + 'reviewer/', LIBRARY_HREF: up + 'library/',
      REVIEWER_CURRENT: section === 'reviewer' ? ' aria-current="page"' : '',
      LIBRARY_CURRENT: section === 'library' ? ' aria-current="page"' : '',
      CIPHER_HREF: up + 'codes-ciphers/', SCHEDULE_HREF: up + 'schedule/?v=day-picker-2', CLASS_HREF: up + 'class/',
      HOWTO_HREF: up + 'how-to/', APP_HREF: up + 'los-radios/',
      HOWTO_CURRENT: section === 'howto' ? ' aria-current="page"' : '', APP_CURRENT: section === 'app' ? ' aria-current="page"' : '',
      PAGE_TITLE: e(title), TITLE: e(title), INTRO: e(intro), BODY: body, SCRIPTS: scripts,
      EYEBROW: e(eyebrow), HERO_CLASS: depth === 2 ? 'lesson-hero' : 'section-hero',
      HERO_META: meta, HERO_ART: art,
    });
  };
  const documentHref = (doc, prefix = '', page) => doc.file ? prefix + 'library/files/' + doc.file + '.pdf' + (page ? '#page=' + page : '') : doc.web ? prefix + doc.web : prefix + 'library/?doc=' + doc.id + '#document';
  const docLink = (doc, prefix, page, label = doc.title) => '<a href="' + documentHref(doc, prefix, page) + '"' + (doc.file ? ' target="_blank" rel="noopener"' : '') + '>' + e(label) + '</a>' + (!doc.file && !doc.web ? ' <span class="file-missing">' + (doc.restricted ? 'Restricted · citation only' : 'PDF unavailable') + '</span>' : '');
  const groups = modules.map(module => ({
    ...module, entries: lessons.filter(lesson => lesson.module === module.id && study.byKey.has(lesson.key)),
  })).filter(group => group.entries.length);
  const groupName = group => group.id === 'supplemental' ? group.title : group.note;
  const lessonCount = count => count + (count === 1 ? ' lesson' : ' lessons');
  const indexNav = '<nav class="study-rail" aria-label="Jump to a module"><details id="module-index" open><summary class="study-eyebrow">Browse by module</summary><ul>' +
    groups.map(group => '<li><a href="#' + group.id + '"><span>' + e(group.title) + '</span><strong>' + e(groupName(group)) + '</strong></a></li>').join('') + '</ul></details></nav>';
  const sections = groups.map(group =>
    '<section id="' + group.id + '" class="reviewer-module" data-module="' + group.id + '"><div class="module-heading"><div><p class="study-eyebrow">' +
    e(group.id === 'supplemental' ? 'Course references' : group.title) + '</p><h2>' + e(groupName(group)) + '</h2></div><p class="study-chip">' +
    lessonCount(group.entries.length) + '</p></div><ul class="study-grid">' +
    group.entries.map((lesson, index) => '<li class="reviewer-card"><span class="lesson-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span><a href="' + lesson.key + '/"><span>' + e(lesson.name) +
      '</span><span class="card-arrow" aria-hidden="true">→</span></a><p>' + e(study.reviewers[lesson.key].brief) + '</p><span class="card-foot">Learn · Apply · Test yourself<span aria-hidden="true">↗</span></span></li>').join('') +
    '</ul></section>').join('');
  const finder = '<div class="study-finder" hidden><label for="reviewer-search">Find a lesson</label><input id="reviewer-search" type="search" placeholder="Try Signal Estimate or Mission Command"><p id="reviewer-count" role="status"></p></div>';
  render('reviewer/index.html', 1, 'reviewer', 'Reviewer 101', 'Know the essentials. Understand the why. Be ready for the question.',
    '<section class="study-return" id="study-return" hidden aria-label="Continue studying"></section><div class="study-layout reviewer-layout">' + finder + indexNav + '<div class="study-content">' + sections + '</div></div>', {
      eyebrow: 'The officers’ study journal / Vol. 01',
      meta: '<p class="hero-stats"><span><strong>' + study.byKey.size + '</strong> lesson guides</span><span><strong>' + groups.filter(group => group.id !== 'supplemental').length + '</strong> course modules</span></p>',
      art: '<div class="hero-plate"><img src="../assets/bandwidth-brothers-colored-400.webp" width="176" height="176" alt=""><span>Bandwidth Brothers</span><p>One frequency.<br>Shared understanding.</p><a href="../library/">Explore the library ↗</a></div>',
      scripts: '<script src="../assets/reviewer-index.js" defer></script>',
    });
  for (const [key, lesson] of study.byKey) {
    const item = study.reviewers[key];
    const docs = study.documents.filter(doc => doc.cited.includes(key) || doc.related.includes(key));
    const primaryDoc = docs.find(doc => doc.id === study.primary[key]);
    const studyDoc = docs.find(doc => doc.id === 'study-' + key);
    const page = lesson.rules.ref?.label === 'PAM 6-0102 PDF page' ? lesson.rules.ref.min : null;
    const chapterLinks = [];
    const panel = (id, title, body) => {
      const number = String(chapterLinks.length + 1).padStart(2, '0');
      chapterLinks.push('<li><a href="#' + id + '"><span>' + number + '</span><strong>' + title + '</strong></a></li>');
      return '<section id="' + id + '" class="lesson-section"><h2><span aria-hidden="true">' + number + '</span>' + title + '</h2>' + body + '</section>';
    };
    const guide = item.examGuide;
    const sourcePages = pages => '<p class="topic-source">Lesson source: ' + pages.map(n => docLink(primaryDoc, '../../', primaryDoc.file ? n : null, 'page ' + n)).join(' · ') + '</p>';
    const chapters = renderReviewerFocus(key, focus[key], panel, e, sourcePages) +
      panel('briefing', 'Quick briefing', '<p>' + e(item.brief) + '</p><p>Read with ' + docLink(primaryDoc, '../../', primaryDoc.file ? page : null) + '.</p>') +
      panel('facts', 'Know the facts', '<dl class="fact-list">' + item.facts.map(fact => '<div><dt>' + e(fact.term) + '</dt><dd>' + e(fact.detail) + '</dd></div>').join('') + '</dl>') +
      (guide ? panel('detailed-review', 'Build your understanding', guide.topics.map(topic => '<section class="review-topic"><h3>' + e(topic.title) + '</h3><p>' + e(topic.explanation) + '</p><ul>' + topic.remember.map(text => '<li>' + e(text) + '</li>').join('') + '</ul><p class="exam-trap"><strong>Watch out:</strong> ' + e(topic.trap) + '</p>' + sourcePages(topic.pages) + '</section>').join('')) : '') +
      panel('reasoning', 'Understand the reasoning', '<ul>' + item.insights.map(insight => '<li>' + e(insight) + '</li>').join('') + '</ul>') +
      panel('scenario', 'Apply it', '<p class="study-eyebrow">Fictional Philippine Army classroom exercise</p><p>' + e(item.scenario.situation) +
        '</p><p><strong>' + e(item.scenario.question) + '</strong></p><details><summary>Show the decision and reasoning</summary><p>' + e(item.scenario.analysis) + '</p></details>') +
      (item.steps.length ? panel('practice', 'How to practice', '<ol>' + item.steps.map(step => '<li>' + e(step) + '</li>').join('') + '</ol><p>Review the steps with ' + docLink(primaryDoc, '../../', primaryDoc.file ? page : null) + '.</p>') : '') +
      panel('self-check', 'Check yourself', item.checks.map(check => '<details><summary>' + e(check.question) + '</summary><p>' + e(check.answer) + '</p></details>').join('')) +
      (guide ? panel('exam-practice', 'Objective & analytical practice', '<p>Answer first, then reveal the explanation. Situations are fictional classroom exercises applying the lesson.</p>' + guide.practice.map(question => '<details class="exam-practice"><summary><span class="study-eyebrow">' + e(question.type) + '</span>' + e(question.question) + '</summary><p><strong>Answer:</strong> ' + e(question.answer) + '</p><p>' + e(question.reasoning) + '</p>' + sourcePages(question.pages) + '</details>').join('')) + panel('exam-checklist', 'Before the exam', '<ul>' + guide.checklist.map(text => '<li>' + e(text) + '</li>').join('') + '</ul>') : '') +
      panel('references', 'References', '<p>Study the assigned lesson first. Supplementary manuals provide context; they do not add examinable material unless assigned as a lesson.</p>' + '<ul>' + docs.filter(doc => doc !== studyDoc).sort((a,b) => (a === primaryDoc ? 0 : a.cited.includes(key) ? 1 : 2) - (b === primaryDoc ? 0 : b.cited.includes(key) ? 1 : 2)).map(doc => '<li>' + docLink(doc, '../../', doc === primaryDoc && doc.file ? page : doc.citationPage) +
        ' <span class="study-muted">· ' + (doc === primaryDoc ? 'Primary course source' : doc.cited.includes(key) ? 'Cited by the course' : 'Supplementary reading') + '</span></li>').join('') + '</ul>');
    const rail = '<nav class="study-rail" aria-label="Lesson sections"><p class="study-eyebrow">In this lesson</p><ul>' + chapterLinks.join('') + '</ul></nav>';
    const actions = '<div class="lesson-actions"><a href="../#' + lesson.module + '">← All reviewers</a><a class="study-cta" href="../../' +
      lesson.slug + '/">Take the practice exam</a>' + '<a href="#briefing">Start reviewing</a>' + '</div>';
    const group = groups.find(item => item.id === lesson.module);
    const order = [...study.byKey.keys()];
    const at = order.indexOf(key);
    const pagerLink = (other, label) => other ? '<a href="../' + other + '/"><small>' + label + '</small>' + e(study.byKey.get(other).name) + '</a>' : '';
    const lessonNext = '<aside class="lesson-next" aria-labelledby="lesson-next-title"><div><p class="study-eyebrow">End of reviewer · ' + e(group.id === 'supplemental' ? 'Supporting lesson' : group.title) +
      '</p><h2 id="lesson-next-title">Ready for the questions?</h2><p class="lesson-next-sub">Test what you just reviewed on the ' + e(lesson.name) + ' practice exam.</p></div>' +
      '<a class="study-cta" href="../../' + lesson.slug + '/">Take this lesson’s exam <span aria-hidden="true">→</span></a>' +
      '<nav class="lesson-pager" aria-label="Other reviewers">' + pagerLink(order[at - 1], '← Previous reviewer') + pagerLink(order[at + 1], 'Next reviewer →') + '</nav></aside>';
    render('reviewer/' + key + '/index.html', 2, 'reviewer', lesson.name, groupName(group),
      actions + '<nav class="review-jump" aria-label="Choose how to review"><a href="#exam-focus">Key points first</a><a href="#question-styles">Try exam-style questions</a><a href="#detailed-review">Read the full explanation</a></nav><div class="study-layout">' + rail + '<article class="study-content lesson-reading">' + chapters + lessonNext + '</article></div>', {
        eyebrow: 'Reviewer 101 · ' + (group.id === 'supplemental' ? 'Supporting lesson' : group.title),
        art: '<figure class="reviewer-figure">' + lesson.heroSvg + '<figcaption>Lesson at a glance</figcaption></figure>',
        scripts: '<link rel="stylesheet" href="../../assets/reviewer-focus.css"><script src="../../assets/reviewer-focus.js" defer></script><script src="../../assets/study-session.js" defer></script>',
      });
  }
  const metadata = study.documents.map(doc => ({
    ...doc, modules: [...new Set([...doc.cited, ...doc.related].map(key => study.byKey.get(key).module))], lessons: [...doc.cited, ...doc.related].map(key => ({ key, title: study.byKey.get(key).name, cited: doc.cited.includes(key) })),
  }));
  metadata.sort((a,b) => Number(!(a.file || a.web)) - Number(!(b.file || b.web)) || (a.modules[0] || '').localeCompare(b.modules[0] || '', undefined, {numeric:true}) || a.title.localeCompare(b.title));
  const rows = metadata.filter(doc => doc.file || doc.web).map(doc => '<li class="library-row" data-id="' + doc.id + '" data-modules="' + doc.modules.join(' ') + '" data-format="' + (doc.file ? 'pdf' : 'web') + '" data-available="' + Boolean(doc.file || doc.web) + '" data-kind="' + doc.kind + '"><span class="document-mark" aria-hidden="true">' + (doc.kind === 'manual' ? 'REFERENCE MANUAL' : doc.kind === 'organization' ? 'ORGANIZATION SOURCE' : 'LESSON SOURCE') + '</span><p class="study-eyebrow">' +
    e(doc.edition || (doc.kind === 'manual' ? 'Manual' : 'Lesson')) + '</p><h3><a href="' + documentHref(doc, '../') + '"' + (doc.file ? ' target="_blank" rel="noopener"' : '') + '>' + e(doc.title) +
    '<span class="card-arrow" aria-hidden="true"> →</span></a></h3><p class="library-links">' +
    e(doc.lessons.map(lesson => lesson.title).join(' · ')) + '</p><span class="study-chip ' + (doc.file ? 'available' : '') + '">' +
    (doc.file ? 'Open PDF ↗' : doc.web ? 'Read online →' : 'PDF unavailable') + '</span></li>').join('');
  const body = '<section id="document" class="study-panel document-workspace" hidden aria-labelledby="document-title">' +
    '<a class="document-back" href="./">← Back to library</a><h2 id="document-title"></h2><p id="document-meta"></p>' +
    '<p id="document-availability"></p>' +
    '<details><summary id="document-lesson-summary">Connected lessons</summary><ul id="document-lessons"></ul></details></section>' +
    '<nav class="study-actions" aria-label="Library tools"><a href="unit-organization/">Explore Unit Organization →</a></nav>' +
    '<section class="library-catalogue" aria-labelledby="catalogue-title"><p class="study-eyebrow">Catalogue</p><h2 id="catalogue-title">Find a reference</h2>' +
    '<nav class="study-actions" aria-label="Library categories"><a data-type="all" href="./">All documents</a><a data-type="lesson" href="?type=lesson">Lessons</a><a data-type="manual" href="?type=manual">Manuals</a><a data-type="organization" href="?type=organization">Organization sources</a></nav>' +
    '<div class="library-controls"><label for="library-search">Search by title, manual number or lesson</label><input id="library-search" type="search" placeholder="Try PAM 6-0102 or Zero Trust"></div>' +
    '<div class="library-filters"><label>Module<select id="library-module"><option value="all">All modules</option>' + groups.map(group => '<option value="' + group.id + '">' + e(group.title + ' · ' + groupName(group)) + '</option>').join('') + '</select></label><label>Format<select id="library-availability"><option value="all">All formats</option><option value="pdf">PDF documents</option></select></label><label>Sort by<select id="library-sort"><option value="course">Course order</option><option value="title">Title A–Z</option><option value="kind">Document type</option></select></label><button type="button" id="library-reset">Reset filters</button></div><div class="library-results-bar"><p id="library-count" role="status"></p><div class="library-view" role="group" aria-label="Document layout"><button type="button" id="library-cards" aria-pressed="true">Cards</button><button type="button" id="library-list-view" aria-pressed="false">List</button></div></div><p id="library-empty" hidden>No documents match these filters. Try a broader search or reset the filters.</p><ul class="library-list">' + rows + '</ul></section>';
  render('library/index.html', 1, 'library', 'Study Library', 'Original lessons and manuals open as PDFs.', body, {
    eyebrow: 'SOAC 52–26 · Reference desk',
    meta: '<p class="hero-stats"><span><strong>' + metadata.filter(doc => doc.file).length + '</strong> readable PDFs</span><span><strong>' +
      metadata.filter(doc => doc.kind === 'manual' && doc.file).length + '</strong> available manuals</span></p>',
    art: '<div class="hero-plate library-plate" aria-hidden="true"><div class="book-stack"><div>DOCTRINE</div><div>FIELD NOTES</div><div>MANUALS</div></div><span>Read. Connect. Understand.</span></div>',
    scripts: '<script type="application/json" id="library-data">' + scriptJson(metadata) + '</script><script type="module" src="../assets/library.js?v=catalogue-7"></script>',
  });
  renderOrganizations(root, render, e);
  renderResources(root, render, e);
  return pages;
}
