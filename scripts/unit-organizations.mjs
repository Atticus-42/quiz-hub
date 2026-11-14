import { renderOrganizationCharts } from './organization-charts.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const TOE_EDITION = 'DND-approved PA TO 2019';

export function loadOrganizations(root) {
  const groups = JSON.parse(readFileSync(join(root, 'data/unit-organizations.json'), 'utf8'));
  const library = JSON.parse(readFileSync(join(root, 'data/library.json'), 'utf8'));
  const allowed = new Set(library.manuals.filter(d => !d.restricted && d.file).map(d => d.file));
  for (const [key, value] of Object.entries(library.lessonSources)) {
    if (!(library.restrictedLessonSources || []).includes(key) && value[1]) allowed.add(value[1]);
  }
  for (const doc of library.additionalDocuments || []) if (!doc.restricted && doc.file) allowed.add(doc.file);
  const ids = new Set();
  for (const group of groups) {
    if (!/^[a-z0-9-]+$/.test(group.id) || ids.has(group.id)) throw new Error('Invalid organization ID');
    ids.add(group.id);
    if (!group.sources?.length) throw new Error('Organization lacks evidence');
    for (const source of group.sources) {
      if (source.toe) {
        // Text-only citation of the DND-approved PA Table of Organization 2019. The TOE files themselves are never published.
        if (source.edition !== TOE_EDITION || !source.label || !source.locator || source.file) throw new Error('Invalid TOE citation');
        // Excerpt PDFs (organization charts and manning sheets only, no Table of Equipment) live outside the Library, under library/unit-organization/sources.
        if (!/^sources\/[a-z0-9-]+\.pdf$/.test(source.pdf || '') || !existsSync(join(root, 'library/unit-organization', source.pdf)) || !Number.isInteger(source.pdfPage) || source.pdfPage < 1) throw new Error('Unavailable TOE excerpt: ' + group.id);
        continue;
      }
      if (!allowed.has(source.file) || !existsSync(join(root, 'library/files', source.file + '.pdf')) || !Number.isInteger(source.page) || source.page < 1) throw new Error('Unavailable organization source: ' + source.file);
    }
    if (group.roles && (!group.sources[group.rolesSource] || group.sources[group.rolesSource].toe)) throw new Error('Roles lack validated source');
    const check = node => {
      if (node.chart !== undefined && (!/^[a-z0-9-]+$/.test(node.chart) || !groups.some(other => other.id === node.chart))) throw new Error('Unknown linked chart: ' + node.title);
      if (!node.title) throw new Error('Unnamed organization node');
      for (const key of ['personnel', 'officers', 'ep', 'civilians', 'quantity']) if (node[key] !== undefined && (!Number.isInteger(node[key]) || node[key] < 0)) throw new Error('Invalid count');
      if (node.officers !== undefined && node.ep !== undefined && node.personnel !== node.officers + node.ep) throw new Error('Inconsistent personnel split');
      // Dual-designated figures (positions printed in parentheses): integers, or null when the table cannot be read, never 0 for unknown. They cite a sheet and are never added to totals.
      const dualKeys = ['dualPersonnel', 'dualOfficers', 'dualEp', 'dualCivilians'];
      if (dualKeys.some(key => node[key] !== undefined)) {
        for (const key of dualKeys) if (node[key] !== undefined && node[key] !== null && (!Number.isInteger(node[key]) || node[key] < 0)) throw new Error('Invalid dual-designated count: ' + node.title);
        if (node.dualPersonnel === undefined || node.dualOfficers === undefined || node.dualEp === undefined || typeof node.dualSource !== 'string' || !node.dualSource.trim()) throw new Error('Dual-designated figures need personnel, officers, EP and a source: ' + node.title);
        if (node.dualPersonnel !== null && node.dualOfficers !== null && node.dualEp !== null && node.dualPersonnel !== node.dualOfficers + node.dualEp + (node.dualCivilians || 0)) throw new Error('Inconsistent dual-designated split: ' + node.title);
      }
      (node.children || []).forEach(check);
    };
    check(group.tree);
  }
  return groups;
}

const num = value => Number(value).toLocaleString('en-US');
const noun = (value, one, many) => `${num(value)} ${value === 1 ? one : many}`;
const paren = value => value === null || value === undefined ? '(—)' : `(${num(value)})`;
const dualNoun = (value, one, many) => `${paren(value)} ${value === 1 ? one : many}`;


// Everything the detail panel needs, as plain data. Node paths match the data-node attributes printed by organization-charts.mjs.
export function organizationPanelData(groups) {
  const parentOf = {};
  const walk = (group, node, path, out) => {
    const entry = { t: node.title };
    for (const [key, field] of [['q', 'quantity'], ['p', 'personnel'], ['o', 'officers'], ['e', 'ep'], ['c', 'civilians'], ['rel', 'relation'], ['role', 'role'], ['basis', 'countBasis'], ['grade', 'grade'], ['chart', 'chart']]) if (node[field] !== undefined) entry[key] = node[field];
    if (node.dualPersonnel !== undefined) entry.dual = { p: node.dualPersonnel, o: node.dualOfficers, e: node.dualEp, c: node.dualCivilians || 0, src: node.dualSource };
    if (node.dualDesignation) entry.dd = 1;
    if (node.children?.length) entry.kids = node.children.map((_, i) => path + '.' + i);
    out[path] = entry;
    if (node.chart && !parentOf[node.chart]) parentOf[node.chart] = group.id;
    (node.children || []).forEach((child, i) => walk(group, child, path + '.' + i, out));
  };
  const data = { groups: {}, parent: parentOf };
  for (const group of groups) {
    const nodes = {};
    walk(group, group.tree, 'r', nodes);
    const sources = group.sources.map(source => source.toe
      ? { label: source.label, edition: source.edition, href: source.pdf + '#page=' + source.pdfPage, page: source.pdfPage, kind: 'excerpt' }
      : { label: source.label, href: '../files/' + source.file + '.pdf#page=' + source.page, page: source.page, kind: 'library' });
    data.groups[group.id] = { title: group.title, toe: group.estimate === 'toe', nodes, sources };
  }
  return data;
}
const jsonForScript = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const chartSource = group => group.sources.find(source => source.toe && /chart|slide/i.test(source.label)) || group.sources.find(source => source.toe);

export function renderOrganizations(root, render, e) {
  const groups = loadOrganizations(root);
  const panelData = organizationPanelData(groups);
  const byId = Object.fromEntries(groups.map(group => [group.id, group]));
  // Default breadcrumb: the first formation whose chart links down to this one, followed upward.
  const trail = id => { const out = []; for (let at = panelData.parent[id], guard = 0; at && guard < 6; at = panelData.parent[at], guard++) out.unshift(at); return out; };
  const trailNav = id => { const chain = trail(id); return `<nav class="org-trail" aria-label="Formation hierarchy" data-trail="${id}"${chain.length ? '' : ' hidden'}><ol>${chain.map(at => `<li><a href="#${at}">${e(byId[at].title)}</a></li>`).join('')}<li aria-current="location">${e(byId[id].title)}</li></ol></nav>`; };
  const headerActions = group => { const source = chartSource(group); return source ? `<p class="org-actions"><a class="org-source-link" href="${e(source.pdf)}#page=${source.pdfPage}" target="_blank" rel="noopener"><span>View source PDF <span aria-hidden="true">↗</span></span><small>Official chart · excerpt page ${source.pdfPage}</small></a></p>` : ''; };
  const node = (item, depth = 0, estimate = '') => {
    const dual = item.dualPersonnel !== undefined;
    const count = dual ? `<span class="org-count is-dual">${paren(item.dualPersonnel)}<small> personnel${item.quantity > 1 ? ' each' : ''} · dual-designated</small></span>` : item.personnel !== undefined ? `<span class="org-count">${num(item.personnel)}<small> personnel${item.quantity > 1 ? ' each' : ''}</small></span>` : '';
    const head = `<span class="org-node-name">${item.quantity > 1 ? `<span class="org-multiple">${item.quantity} ×</span> ` : ''}${e(item.title)}${item.relation ? `<small class="org-attachment">${e(item.relation)}</small>` : ''}</span>${item.dualDesignation ? '<span class="org-dual">(1)<small>Dual duty?</small></span>' : count}`;
    const detail = `${dual ? `<p class="org-split is-dual">${dualNoun(item.dualOfficers, 'officer', 'officers')} · ${paren(item.dualEp)} EP${item.dualCivilians ? ` · ${dualNoun(item.dualCivilians, 'civilian', 'civilians')}` : ''} · dual-designated, not added to totals · ${e(item.dualSource)}</p>` : item.officers !== undefined && item.ep !== undefined ? `<p class="org-split">${noun(item.officers, 'officer', 'officers')} · ${num(item.ep)} EP${item.civilians ? ` · ${noun(item.civilians, 'civilian', 'civilians')}` : ''} · ${estimate === 'toe' ? 'TO 2019 required' : 'provisional'}</p>` : ''}${item.role ? `<p>${e(item.role)}</p>` : ''}${item.countBasis ? `<p class="org-basis">${e(item.countBasis)}</p>` : ''}`;
    return `<li${item.relation ? ' class="org-attached"' : ''}>${item.children?.length ? `<details${depth < 2 ? ' open' : ''}><summary>${head}</summary>${detail}<ul>${item.children.map(child => node(child, depth + 1, estimate)).join('')}</ul></details>` : `<div class="org-leaf"><div class="org-leaf-heading">${head}</div>${detail}</div>`}</li>`;
  };
  const sourceLink = source => source.toe ? `<a class="org-source-ref" href="${e(source.pdf)}#page=${source.pdfPage}" target="_blank" rel="noopener"><span>${e(source.label)} <span aria-hidden="true">↗</span></span><small>${e(source.edition)} · ${e(source.locator)}</small><small>Excerpt PDF page ${source.pdfPage} · equipment tables omitted</small></a>` : `<a href="../files/${e(source.file)}.pdf#page=${source.page}" target="_blank" rel="noopener">${e(source.label)} <span aria-hidden="true">↗</span><small>PDF page ${source.page}</small></a>`;
  const panelMarkup = `<div class="org-panel-backdrop" id="org-panel-backdrop" hidden></div><aside class="org-panel" id="org-panel" role="dialog" aria-modal="false" aria-labelledby="org-panel-title" tabindex="-1" hidden><div class="org-panel-head"><p class="org-overline" id="org-panel-kicker">Element details</p><button type="button" class="org-panel-close" id="org-panel-close" aria-label="Close details">Close <span aria-hidden="true">×</span></button></div><div class="org-panel-body" id="org-panel-body"><h3 id="org-panel-title">Details</h3></div></aside><script type="application/json" id="org-data">${jsonForScript(panelData)}</script>`;
  const body = `<link rel="stylesheet" href="../../assets/unit-organizations.css?v=6">
    <nav class="study-actions library-subtabs" aria-label="Library sections"><a href="../">Sources</a><a href="./" aria-current="page">Unit organization</a></nav>
    <div class="org-intro"><a href="../">← Study Library</a><p>Expand a branch to see its composition. Numbers followed by × count subunits. Personnel counts apply to one instance of the labelled element. <span class="org-js-hint" hidden>Select any box in a sketch to open its details, drill into a subordinate unit and view the official source PDF.</span></p></div>
    <nav class="org-index" aria-label="Choose a formation">${groups.map((g,i)=>`<a href="#${g.id}"><span>${String(i+1).padStart(2,'0')} / ${e(g.branch)}</span><strong>${e(g.title)}</strong><b aria-hidden="true">↓</b></a>`).join('')}</nav>
    <aside class="org-reading"><strong>How to read this atlas</strong><p>These are source-edition teaching diagrams, not current unit rosters or assigned strength. Solid branches show the documented composition. Dashed branches identify attachments. A person shown inside a child element is already part of that element’s count.</p></aside>
    ${groups.map((group,i)=>`<section class="org-formation org-${group.id}" id="${group.id}" aria-labelledby="${group.id}-title"><header><p class="study-eyebrow">Plate ${String(i+1).padStart(2,'0')} · ${e(group.tag)}</p><h2 id="${group.id}-title" tabindex="-1">${e(group.title)}</h2>${trailNav(group.id)}<p>${e(group.intro)}</p>${headerActions(group)}</header>${renderOrganizationCharts(group, e)}<div class="org-workspace"><div class="org-diagram"><p class="org-overline">Composition / expand the branches</p><div class="org-tree-tools" hidden><button type="button" data-expand="all">Expand all</button><button type="button" data-expand="none">Collapse all</button></div><ul class="org-tree">${node(group.tree, 0, group.estimate)}</ul></div><aside class="org-evidence" aria-label="${e(group.title)} evidence"><h3>Personnel record</h3><dl>${(group.personnelRecord || [['Officers','Not specified'],['Enlisted personnel (EP)','Not specified'],['Total establishment','Not verified']]).map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p>Known element counts appear on the diagram.</p><h3>Read the evidence</h3><div class="org-sources">${group.sources.map(sourceLink).join('')}</div><details class="org-notes" open><summary>Counting notes</summary><ul>${group.notes.map(note=>`<li>${e(note)}</li>`).join('')}</ul></details></aside></div>${group.roles ? `<details class="org-roles"><summary>Who does what? <span>${group.roles.length} key designations</span></summary><div>${group.roles.map(role=>`<article><h3>${e(role.title)}</h3><p>${e(role.role)}</p></article>`).join('')}</div><p>Role descriptions: ${sourceLink(group.sources[group.rolesSource])}</p></details>` : ''}<a class="org-top" href="#main">Back to formations ↑</a></section>`).join('')}
    ${panelMarkup}
    <p class="org-footnote">Strengths marked “TO 2019” come from the DND-approved Philippine Army Table of Organization 2019 (required strength), cited by document and sheet or slide. Source PDFs are excerpts of the approved files (organization charts, manning and recap sheets, basic documents) kept apart from the Library; the Table of Equipment is not used or published, and positions printed in parentheses in the table are dual designations that add no personnel. The supplied EW company table above is a separate, still-unverified document.</p>`;
  render('library/unit-organization/index.html', 2, 'library', 'Unit Organization', 'Follow the formation. Understand the roles. Trace every count to its source.', body, {
    eyebrow: 'Reference atlas · Organization & personnel',
    meta: '<p class="hero-stats"><span><strong>' + String(groups.length).padStart(2, '0') + '</strong> documented formations</span><span><strong>01</strong> connected view</span></p>',
    scripts: '<script src="../../assets/unit-organizations.js?v=1" defer></script>',
    art: '<div class="org-seal" aria-hidden="true"><span>FORMATION ATLAS</span><b>UNIT<br>BY UNIT</b><span>COMPOSITION · PEOPLE · PURPOSE</span></div>',
  });
}
