// "Site index": one collapsible, text-only list of every section and sub-page, injected into every generated page.
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
// The stylesheet lives in assets/site-index.css.

export function buildSiteIndex({ modules, lessons, study, pages }) {
  const titleOf = path => plain((pages[path].match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, path])[1]);
  const examRe = /^module-\d+-exam$/;
  const howTo = Object.keys(pages).filter(path => /^how-to\/[^/]+\/index\.html$/.test(path)).sort();
  const weeks = Object.keys(pages).filter(path => /^schedule-\d{4}-\d{2}-\d{2}\/index\.html$/.test(path)).sort();
  const active = weeks.find(path => {
    const page = pages[path];
    return pages['schedule/index.html'].startsWith(page.slice(0, page.lastIndexOf('</body>')));
  });
  const range = path => (pages[path].match(/<title>Weekly training schedule · (.*?) · SOAC/) || [, path.slice(9, 19)])[1];
  const exams = lessons.filter(lesson => examRe.test(lesson.slug));
  const byModule = modules.map(module => ({ module, items: lessons.filter(lesson => lesson.module === module.id && !examRe.test(lesson.slug)) })).filter(group => group.items.length);

  return up => {
    const a = (href, text, cls = '') => '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + up + href + '">' + esc(text) + '</a>';
    const li = (...links) => '<li>' + links.join('') + '</li>';
    const col = (title, body) => '<div><h2>' + esc(title) + '</h2>' + body + '</div>';
    const parts = [];
    parts.push(col('Practice exams', '<ul>' + li(a('', 'Exam hub (all modules)', 'main')) +
      exams.map(lesson => li(a(lesson.slug + '/', lesson.name, 'main'), study.byKey.has(lesson.key) ? a('reviewer/' + lesson.key + '/', 'Reviewer') : '')).join('') + '</ul>'));
    parts.push(col('Comprehensive Exam Reviewer', '<ul>' + li(a('comprehensive-reviewer/', 'Actual Exam: all graded exams', 'main')) + li(a('comprehensive-reviewer/all/', 'All graded exams, mixed', 'main')) + '</ul>'));
    parts.push(col('Reviewer', '<ul>' + li(a('reviewer/', 'All Reviewer lessons', 'main')) + '</ul>' +
      byModule.map(({ module, items }) => '<p class="mod">' + esc(module.title + (module.note ? ' · ' + module.note : '')) + '</p><ul>' +
        items.map(lesson => li(a(lesson.slug + '/', lesson.name + ' quiz', 'main'), study.byKey.has(lesson.key) ? a('reviewer/' + lesson.key + '/', 'Reviewer') : '')).join('') + '</ul>').join('')));
    parts.push(col('Library', '<ul>' + li(a('library/', 'Library: lessons, manuals, sources', 'main')) + li(a('library/unit-organization/', 'Unit Organization', 'main')) + '</ul>'));
    parts.push(col('How To guides', '<ul>' + li(a('how-to/', 'All How To guides', 'main')) + howTo.map(path => li(a(path.replace(/index\.html$/, ''), titleOf(path), 'main'))).join('') + '</ul>'));
    parts.push(col('Radio and codes', '<ul>' + li(a('los-radios/', 'LOS Radios', 'main')) + li(a('codes-ciphers/', 'Codes & Ciphers', 'main')) + '</ul>'));
    parts.push(col('Schedule, class, instructor', '<ul>' + li(a('schedule/?v=day-picker-2', 'Weekly schedule (current week)', 'main')) +
      weeks.filter(path => path !== active).map(path => li(a(path.replace(/index\.html$/, ''), 'Week of ' + range(path), 'main'))).join('') +
      li(a('class/', 'Our class', 'main')) + li(a('instructor/', 'Instructor view', 'main')) + '</ul>'));
    return '<nav class="site-index" aria-label="Site index"><details><summary>Site index <small>Find anything</small></summary><div class="site-index-grid">' + parts.join('') + '</div></details></nav>';
  };
}

// Non-exam pages for the hub's quick finder (title, one line, kind label, URL relative to the site root).
export function siteSearchPages({ lessons, study, pages }) {
  const titleOf = path => plain((pages[path].match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, path])[1]);
  const out = [];
  for (const lesson of lessons) {
    if (!study.byKey.has(lesson.key)) continue;
    out.push({ t: lesson.name + ' Reviewer', d: study.reviewers[lesson.key].brief, k: 'Reviewer', u: 'reviewer/' + lesson.key + '/' });
  }
  out.push({ t: 'Comprehensive Exam Reviewer', d: 'Actual Exam: questions from the class’s graded exams, each exam as a quiz plus a mixed set', k: 'Reviewer', u: 'comprehensive-reviewer/' });
  out.push({ t: 'Library: lessons, manuals and sources', d: 'Original lesson PDFs, field manuals, citations and reference documents', k: 'Library', u: 'library/' });
  out.push({ t: 'Unit Organization', d: 'Unit organization charts, formations, roles and personnel counts with sources', k: 'Library', u: 'library/unit-organization/' });
  for (const path of Object.keys(pages).filter(p => /^how-to\/[^/]+\/index\.html$/.test(p)).sort()) out.push({ t: titleOf(path), d: 'Step-by-step radio and field how-to guide', k: 'How To', u: path.replace(/index\.html$/, '') });
  out.push({ t: 'How To guides', d: 'All step-by-step radio and field guides', k: 'How To', u: 'how-to/' });
  out.push({ t: 'LOS Radios', d: 'Line-of-sight radio planning and link tools', k: 'Tool', u: 'los-radios/' });
  out.push({ t: 'Codes & Ciphers', d: 'Cipher desk: encode, decode and practise handout ciphers', k: 'Tool', u: 'codes-ciphers/' });
  out.push({ t: 'Weekly schedule', d: 'Training timetable, venues, uniforms and menus by week', k: 'Class', u: 'schedule/?v=day-picker-2' });
  out.push({ t: 'Our class', d: 'Class organization and roster', k: 'Class', u: 'class/' });
  out.push({ t: 'Instructor view', d: 'Question analysis for instructors', k: 'Class', u: 'instructor/' });
  return out;
}
