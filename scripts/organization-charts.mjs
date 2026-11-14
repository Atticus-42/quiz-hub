// Schematic organization plates generated from the same evidence-backed tree as the details.
export function renderOrganizationCharts(group, e) {
  const title = item => `${item.quantity > 1 ? item.quantity + ' × ' : ''}${item.title}`;
  const num = value => Number(value).toLocaleString('en-US');
  const noun = (value, one, many) => `${num(value)} ${value === 1 ? one : many}`;
  const toe = group.estimate === 'toe';
  // Positions printed in parentheses are dual designations: they add no strength to any total, but their own figures are shown as "(n)".
  const isDual = item => item.dualPersonnel !== undefined;
  const paren = value => value === null || value === undefined ? '(—)' : `(${num(value)})`;
  const dualNoun = (value, one, many) => `${paren(value)} ${value === 1 ? one : many}`;
  const strength = item => isDual(item)
    ? `<p class="org-chart-strength is-dual">${paren(item.dualPersonnel)} personnel${item.quantity > 1 ? ' each' : ''} · ${dualNoun(item.dualOfficers, 'officer', 'officers')} / ${paren(item.dualEp)} EP${item.dualCivilians ? ` · ${dualNoun(item.dualCivilians, 'civilian', 'civilians')}` : ''} · dual-designated</p>`
    : item.personnel === undefined ? '' : `<p class="org-chart-strength">${num(item.personnel)} personnel${item.quantity > 1 ? ' each' : ''}${item.officers !== undefined ? ` · ${noun(item.officers, 'officer', 'officers')} / ${num(item.ep)} EP${item.civilians ? ` · ${noun(item.civilians, 'civilian', 'civilians')}` : ''}${toe ? '' : ' · provisional'}` : ''}</p>`;
  const hasDual = item => isDual(item) || (item.children || []).some(hasDual);
  const WORDS = new Set(['of', 'and', 'the', 'for', 'to', 'in', 'on', 'a']);
  const abbreviation = title => {
    const words = title.replace(/\(.*?\)/g, ' ').split(/[^A-Za-z0-9]+/).filter(word => word && !WORDS.has(word.toLowerCase()));
    if (words.length === 1) return (/^[A-Z0-9]{2,5}$/.test(words[0]) ? words[0] : words[0].slice(0, 4)).toUpperCase();
    return words.map(word => /^[A-Z0-9]{2,}$/.test(word) ? word : word[0]).join('').toUpperCase().slice(0, 5);
  };
  const emblem = item => {
    const infantry = /rifle (company|platoon|squad)|fire team/i.test(item.title);
    const label = /headquarters|command section/i.test(item.title) ? 'HQ' : /message center/i.test(item.title) ? 'MSG' : /signal/i.test(item.title) ? 'SIG' : /electronic|cyber/i.test(item.title) ? 'EW' : /scout/i.test(item.title) ? 'SCOUT' : /console/i.test(item.title) ? 'CONS' : /information (system|technology)/i.test(item.title) ? 'IS' : abbreviation(item.title);
    return `<span class="org-chart-emblem${infantry ? ' is-infantry' : ''}" aria-hidden="true">${label}</span>`;
  };
  // Node paths identify one element inside a formation: "r" is the root, "r.2.0" its third child's first child. The browser script reads data-node to open the detail panel.
  const attr = (path, extra = '') => ` data-node="${path}"${extra}`;
  const subplates = new Map();
  const bullet = (child, path) => `<li${attr(path)}>${e(title(child))}${isDual(child) ? ` <span>— ${paren(child.dualPersonnel)}${child.quantity > 1 ? ' each' : ''}</span>` : child.personnel !== undefined ? ` <span>— ${num(child.personnel)}${child.quantity > 1 ? ' each' : ''}</span>` : ''}${child.dualDesignation ? ' <span>(1) · possible dual duty</span>' : ''}${child.grade ? ` <small>${e(child.grade)}</small>` : ''}${child.relation ? ` <small>${e(child.relation)}</small>` : ''}</li>`;
  const drill = item => item.chart ? `<a class="org-chart-open" href="#${e(item.chart)}">Open chart <span aria-hidden="true">→</span></a>` : subplates.has(item) ? `<a class="org-chart-open" href="#${subplates.get(item)}">Open sketch <span aria-hidden="true">↓</span></a>` : '';
  const card = (item, path) => `<div class="org-chart-card${item.relation ? ' is-attached' : ''}${isDual(item) ? ' is-dual' : ''}"${attr(path)}>${emblem(item)}<h4>${e(title(item))}</h4>${item.relation ? `<p class="org-attachment">${e(item.relation)}</p>` : ''}${strength(item)}${item.children?.length ? `<ul>${item.children.map((child, i) => bullet(child, path + '.' + i)).join('')}</ul>` : item.role ? `<p>${e(item.role)}</p>` : ''}${item.countBasis ? `<p class="org-chart-qualifier">${e(item.countBasis)}</p>` : ''}${drill(item)}</div>`;
  const plate = (item, id, path) => `<figure class="org-chart"><figcaption id="${id}"><span>Organization sketch</span><strong>${e(item.title)}</strong></figcaption><p class="org-chart-hint">Wide diagram · scroll sideways on a small screen. Expand the details below for the full source notes.<span class="org-js-hint" hidden> Select a box for its details and the source PDF.</span></p><div class="org-chart-viewport" tabindex="0" role="region" aria-labelledby="${id}"><div class="org-chart-board"><div class="org-chart-parent${isDual(item) ? ' is-dual' : ''}"${attr(path)}>${emblem(item)}<h4>${e(item.title)}</h4>${strength(item)}</div><div class="org-chart-branches">${(item.children || []).map((child, i) => `<div class="org-chart-branch${child.relation ? ' is-attached' : ''}">${card(child, path + '.' + i)}</div>`).join('')}</div></div></div><div class="org-chart-legend"><b>KEY</b><span>HQ · Headquarters</span><span>SIG · Signal</span><span>EW · Electronic warfare / cyber label</span><span>× · Number of units</span><span>Dashed box · Attached${hasDual(item) ? ' or dual-designated' : ''}</span>${hasDual(item) ? '<span>(n) · dual-designated, not added to totals</span>' : ''}<span>Crossed box · Infantry</span></div><p class="org-chart-disclaimer">Schematic teaching graphic. Text labels identify the units; symbols are not a full standardized military-symbol set. ${e(group.tag)}. Counts carry the qualifications in the source notes below.</p></figure>`;
  // Each distinct named subunit gets a plate. Repeated generic structures are shown once.
  const extra = [];
  const seen = new Map();
  const collect = (node, path) => (node.children || []).forEach((child, i) => {
    const childPath = path + '.' + i;
    if (child.children?.length) {
      const key = JSON.stringify([child.title, child.children]);
      if (!seen.has(key)) { seen.set(key, `${group.id}-subchart-${extra.length}`); extra.push({ item: child, path: childPath, id: seen.get(key) }); }
      subplates.set(child, seen.get(key));
      collect(child, childPath);
    }
  });
  collect(group.tree, 'r');
  return `<div class="org-chart-gallery">${plate(group.tree, group.id + '-chart', 'r')}<details class="org-chart-more"><summary>Subunit sketches <span>${extra.length} detailed views</span></summary>${extra.map(x => plate(x.item, x.id, x.path)).join('')}</details></div>`;
}
