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
        continue;
      }
      if (!allowed.has(source.file) || !existsSync(join(root, 'library/files', source.file + '.pdf')) || !Number.isInteger(source.page) || source.page < 1) throw new Error('Unavailable organization source: ' + source.file);
    }
    if (group.roles && (!group.sources[group.rolesSource] || group.sources[group.rolesSource].toe)) throw new Error('Roles lack validated source');
    const check = node => {
      if (!node.title) throw new Error('Unnamed organization node');
      for (const key of ['personnel', 'officers', 'ep', 'civilians', 'quantity']) if (node[key] !== undefined && (!Number.isInteger(node[key]) || node[key] < 0)) throw new Error('Invalid count');
      if (node.officers !== undefined && node.ep !== undefined && node.personnel !== node.officers + node.ep) throw new Error('Inconsistent personnel split');
      (node.children || []).forEach(check);
    };
    check(group.tree);
  }
  return groups;
}

const num = value => Number(value).toLocaleString('en-US');
const noun = (value, one, many) => `${num(value)} ${value === 1 ? one : many}`;

export function renderOrganizations(root, render, e) {
  const groups = loadOrganizations(root);
  const node = (item, depth = 0, estimate = '') => {
    const count = item.personnel !== undefined ? `<span class="org-count">${num(item.personnel)}<small> personnel${item.quantity > 1 ? ' each' : ''}</small></span>` : '';
    const head = `<span class="org-node-name">${item.quantity > 1 ? `<span class="org-multiple">${item.quantity} ×</span> ` : ''}${e(item.title)}${item.relation ? `<small class="org-attachment">${e(item.relation)}</small>` : ''}</span>${item.dualDesignation ? '<span class="org-dual">(1)<small>Dual duty?</small></span>' : count}`;
    const detail = `${item.officers !== undefined && item.ep !== undefined ? `<p class="org-split">${noun(item.officers, 'officer', 'officers')} · ${num(item.ep)} EP${item.civilians ? ` · ${noun(item.civilians, 'civilian', 'civilians')}` : ''} · ${estimate === 'toe' ? 'TO 2019 required' : 'provisional'}</p>` : ''}${item.role ? `<p>${e(item.role)}</p>` : ''}${item.countBasis ? `<p class="org-basis">${e(item.countBasis)}</p>` : ''}`;
    return `<li${item.relation ? ' class="org-attached"' : ''}>${item.children?.length ? `<details${depth < 2 ? ' open' : ''}><summary>${head}</summary>${detail}<ul>${item.children.map(child => node(child, depth + 1, estimate)).join('')}</ul></details>` : `<div class="org-leaf"><div class="org-leaf-heading">${head}</div>${detail}</div>`}</li>`;
  };
  const sourceLink = source => source.toe ? `<p class="org-source-ref"><span>${e(source.label)}</span><small>${e(source.edition)} · ${e(source.locator)}</small></p>` : `<a href="../files/${e(source.file)}.pdf#page=${source.page}" target="_blank" rel="noopener">${e(source.label)} <span aria-hidden="true">↗</span><small>PDF page ${source.page}</small></a>`;
  const body = `<link rel="stylesheet" href="../../assets/unit-organizations.css?v=4">
    <nav class="study-actions library-subtabs" aria-label="Library sections"><a href="../">Sources</a><a href="./" aria-current="page">Unit organization</a></nav>
    <div class="org-intro"><a href="../">← Study Library</a><p>Expand a branch to see its composition. Numbers followed by × count subunits. Personnel counts apply to one instance of the labelled element.</p></div>
    <nav class="org-index" aria-label="Choose a formation">${groups.map((g,i)=>`<a href="#${g.id}"><span>${String(i+1).padStart(2,'0')} / ${e(g.branch)}</span><strong>${e(g.title)}</strong><b aria-hidden="true">↓</b></a>`).join('')}</nav>
    <aside class="org-reading"><strong>How to read this atlas</strong><p>These are source-edition teaching diagrams, not current unit rosters or assigned strength. Solid branches show the documented composition. Dashed branches identify attachments. A person shown inside a child element is already part of that element’s count.</p></aside>
    ${groups.map((group,i)=>`<section class="org-formation org-${group.id}" id="${group.id}" aria-labelledby="${group.id}-title"><header><p class="study-eyebrow">Plate ${String(i+1).padStart(2,'0')} · ${e(group.tag)}</p><h2 id="${group.id}-title">${e(group.title)}</h2><p>${e(group.intro)}</p></header>${renderOrganizationCharts(group, e)}<div class="org-workspace"><div class="org-diagram"><p class="org-overline">Composition / expand the branches</p><ul class="org-tree">${node(group.tree, 0, group.estimate)}</ul></div><aside class="org-evidence" aria-label="${e(group.title)} evidence"><h3>Personnel record</h3><dl>${(group.personnelRecord || [['Officers','Not specified'],['Enlisted personnel (EP)','Not specified'],['Total establishment','Not verified']]).map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p>Known element counts appear on the diagram.</p><h3>Read the evidence</h3><div class="org-sources">${group.sources.map(sourceLink).join('')}</div><details class="org-notes" open><summary>Counting notes</summary><ul>${group.notes.map(note=>`<li>${e(note)}</li>`).join('')}</ul></details></aside></div>${group.roles ? `<details class="org-roles"><summary>Who does what? <span>${group.roles.length} key designations</span></summary><div>${group.roles.map(role=>`<article><h3>${e(role.title)}</h3><p>${e(role.role)}</p></article>`).join('')}</div><p>Role descriptions: ${sourceLink(group.sources[group.rolesSource])}</p></details>` : ''}<a class="org-top" href="#main">Back to formations ↑</a></section>`).join('')}
    <p class="org-footnote">Strengths marked “TO 2019” come from the DND-approved Philippine Army Table of Organization 2019 (required strength), cited by document and sheet or slide. The Table of Equipment is not used here, and positions printed in parentheses in the table are dual designations that add no personnel. The supplied EW company table above is a separate, still-unverified document.</p>`;
  render('library/unit-organization/index.html', 2, 'library', 'Unit Organization', 'Follow the formation. Understand the roles. Trace every count to its source.', body, {
    eyebrow: 'Reference atlas · Organization & personnel',
    meta: '<p class="hero-stats"><span><strong>' + String(groups.length).padStart(2, '0') + '</strong> documented formations</span><span><strong>01</strong> connected view</span></p>',
    art: '<div class="org-seal" aria-hidden="true"><span>FORMATION ATLAS</span><b>UNIT<br>BY UNIT</b><span>COMPOSITION · PEOPLE · PURPOSE</span></div>',
  });
}
