// Interactive layer for the Unit Organization atlas. Without this script the page is a static, fully readable document.
(() => {
  'use strict';
  const dataEl = document.getElementById('org-data');
  const panel = document.getElementById('org-panel');
  if (!dataEl || !panel) return;
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch (error) { return; }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const body = $('#org-panel-body');
  const closeButton = $('#org-panel-close');
  const backdrop = $('#org-panel-backdrop');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 800px)');
  const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = value => Number(value).toLocaleString('en-US');
  const paren = value => value === null || value === undefined ? '(—)' : '(' + num(value) + ')';
  const label = node => (node.q > 1 ? node.q + ' × ' : '') + node.t;
  const HASH = /^#([a-z0-9-]+)(?:\/(r(?:\.\d+)*))?(?:\?from=([a-z0-9-]+))?$/;

  document.documentElement.classList.add('org-js');
  $$('.org-js-hint, .org-tree-tools').forEach(element => { element.hidden = false; });

  // ---- Hierarchy (breadcrumb) -------------------------------------------------
  const ancestors = id => {
    const out = [];
    for (let at = data.parent[id], guard = 0; at && guard < 6; at = data.parent[at], guard++) out.unshift(at);
    return out;
  };
  const renderTrail = (unit, from) => {
    const nav = $('.org-trail[data-trail="' + unit + '"]');
    if (!nav) return;
    const chain = from && data.groups[from] && from !== unit ? [...ancestors(from), from] : ancestors(unit);
    const list = $('ol', nav);
    list.innerHTML = chain.map(id => '<li><a href="#' + id + '">' + esc(data.groups[id].title) + '</a></li>').join('') + '<li aria-current="location">' + esc(data.groups[unit].title) + '</li>';
    nav.hidden = !chain.length;
  };

  // ---- Make chart boxes interactive ------------------------------------------
  let uid = 0;
  $$('.org-formation').forEach(section => {
    $$('.org-chart-card[data-node] > h4, .org-chart-parent[data-node] > h4', section).forEach(heading => {
      heading.innerHTML = '<button type="button" class="org-card-btn" aria-haspopup="dialog">' + heading.innerHTML + '</button>';
    });
    $$('.org-chart-card li[data-node]', section).forEach(item => {
      item.innerHTML = '<button type="button" class="org-li-btn" aria-haspopup="dialog">' + item.innerHTML + '</button>';
    });
    // Long bullet lists start collapsed; the toggle reveals the rest.
    $$('.org-chart-card ul', section).forEach(list => {
      const count = list.children.length;
      if (count <= 6) return;
      list.id = list.id || 'org-list-' + (++uid);
      list.classList.add('is-collapsed');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'org-list-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', list.id);
      toggle.textContent = 'Show all ' + count;
      toggle.addEventListener('click', () => {
        const open = list.classList.toggle('is-collapsed') === false;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Show fewer' : 'Show all ' + count;
      });
      list.after(toggle);
    });
    $$('.org-tree-tools button', section).forEach(button => {
      button.addEventListener('click', () => {
        $$('.org-tree details', section).forEach(details => { details.open = button.dataset.expand === 'all'; });
      });
    });
  });

  // ---- Navigation through the URL hash ----------------------------------------
  const parse = () => { const match = HASH.exec(location.hash); return match && data.groups[match[1]] ? { unit: match[1], path: match[2] || '', from: match[3] || '' } : null; };
  const build = (unit, path, from) => '#' + unit + (path ? '/' + path : '') + (from ? '?from=' + from : '');
  const navigate = (hash, replace) => {
    if (replace) { history.replaceState(null, '', hash); route(false); } else location.hash = hash;
  };
  const unitOf = element => { const section = element.closest('.org-formation'); return section ? section.id : (current ? current.unit : ''); };

  let current = null; // { unit, path }
  let shownUnit = '';
  let lastTrigger = null;
  let userNav = false;

  const selectNode = (unit, path) => {
    $$('.is-selected').forEach(element => { element.classList.remove('is-selected'); element.removeAttribute('aria-current'); });
    $$('[aria-expanded][aria-haspopup]').forEach(element => element.setAttribute('aria-expanded', 'false'));
    if (!path) return;
    const section = document.getElementById(unit);
    if (!section) return;
    $$('[data-node="' + path + '"]', section).forEach(element => {
      element.classList.add('is-selected');
      const button = $('.org-card-btn, .org-li-btn', element);
      if (button) button.setAttribute('aria-expanded', 'true');
      const list = element.closest('ul.is-collapsed');
      if (list) { const toggle = list.nextElementSibling; if (toggle) toggle.click(); }
    });
  };

  const strengthRows = (group, node) => {
    const rows = [];
    const each = node.q > 1 ? ' each' : '';
    if (node.dual) {
      rows.push(['Personnel', paren(node.dual.p) + each + ' · dual-designated, not added to totals']);
      rows.push(['Officers / EP', paren(node.dual.o) + ' / ' + paren(node.dual.e)]);
      if (node.dual.c) rows.push(['Civilians', paren(node.dual.c)]);
    } else if (node.dd) {
      rows.push(['Personnel', '(1) · possible dual duty, not added to totals']);
    } else if (node.p !== undefined) {
      rows.push(['Personnel', num(node.p) + each]);
      if (node.o !== undefined) {
        rows.push(['Officers', num(node.o)]);
        rows.push(['Enlisted personnel (EP)', num(node.e)]);
        if (node.c) rows.push(['Civilians', num(node.c) + ' · not in military totals']);
        rows.push(['Basis', group.toe ? 'DND-approved PA TO 2019 · required strength' : 'Provisional · not a confirmed establishment']);
      }
      if (node.q > 1) rows.push(['Quantity', node.q + ' identical elements']);
    } else {
      rows.push(['Personnel', 'Not specified in the source']);
    }
    return rows;
  };

  const renderPanel = (unit, path) => {
    const group = data.groups[unit];
    const node = group.nodes[path];
    const parentPath = path.replace(/\.\d+$/, '');
    const rows = strengthRows(group, node);
    // "Open chart" targets: a linked formation, or the detailed sketch on this page.
    const sketch = $('[data-node="' + path + '"] .org-chart-open', document.getElementById(unit));
    let drill = '';
    if (node.chart && data.groups[node.chart]) drill = '<a class="org-btn is-primary" href="#' + node.chart + '" data-drill="' + node.chart + '">Open chart: ' + esc(data.groups[node.chart].title) + ' <span aria-hidden="true">→</span></a>';
    else if (sketch) drill = '<a class="org-btn" href="' + esc(sketch.getAttribute('href')) + '" data-sketch>Open the detailed sketch <span aria-hidden="true">↓</span></a>';
    const sources = group.sources.slice().sort((a, b) => (/chart|slide/i.test(b.label) ? 1 : 0) - (/chart|slide/i.test(a.label) ? 1 : 0));
    const hasExcerpt = sources.some(source => source.kind === 'excerpt');
    body.innerHTML =
      (path !== 'r' ? '<button type="button" class="org-panel-up" data-go="' + parentPath + '"><span aria-hidden="true">↑</span> ' + esc(label(group.nodes[parentPath])) + '</button>' : '') +
      '<h3 id="org-panel-title" tabindex="-1">' + esc(label(node)) + '</h3>' +
      '<p class="org-panel-unit">' + esc(group.title) + '</p>' +
      (node.rel ? '<p class="org-attachment">' + esc(node.rel) + '</p>' : '') +
      '<dl class="org-panel-strength">' + rows.map(row => '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>').join('') + '</dl>' +
      (node.dual && node.dual.src ? '<p class="org-panel-note">' + esc(node.dual.src) + '</p>' : '') +
      (node.role ? '<p>' + esc(node.role) + '</p>' : '') +
      (node.basis ? '<p class="org-basis">' + esc(node.basis) + '</p>' : '') +
      (node.kids ? '<h4>Composed of</h4><ul class="org-panel-kids">' + node.kids.map(kid => {
        const child = group.nodes[kid];
        const count = child.dual ? paren(child.dual.p) : child.p !== undefined ? num(child.p) : '';
        return '<li><button type="button" data-go="' + kid + '"><span>' + esc(label(child)) + '</span>' + (count ? '<b>' + count + (child.q > 1 ? ' each' : '') + '</b>' : '') + '</button></li>';
      }).join('') + '</ul>' : '') +
      (drill ? '<div class="org-panel-drill">' + drill + '</div>' : '') +
      '<h4>Official source</h4><div class="org-panel-sources">' + sources.map(source => '<a class="org-btn' + (source.kind === 'excerpt' ? ' is-pdf' : '') + '" href="' + esc(source.href) + '" target="_blank" rel="noopener">' + esc(source.label) + ' <span aria-hidden="true">↗</span><small>' + (source.kind === 'excerpt' ? 'Excerpt PDF · page ' + source.page : 'Library PDF · page ' + source.page) + ' · opens in a new tab</small></a>').join('') + '</div>' +
      (hasExcerpt ? '<p class="org-panel-note">Excerpts of the DND-approved PA TO 2019 (DND Secretary memorandum, 28 February 2020): organization charts, manning sheets and basic documents only. Equipment tables are omitted.</p>' : '');
  };

  const openPanel = (unit, path) => {
    const wasOpen = !panel.hidden;
    if (!wasOpen && document.activeElement && !panel.contains(document.activeElement)) lastTrigger = document.activeElement;
    renderPanel(unit, path);
    $('#org-panel-kicker').textContent = path === 'r' ? 'Formation details' : 'Element details';
    panel.hidden = false;
    const modal = narrow.matches;
    panel.setAttribute('aria-modal', String(modal));
    backdrop.hidden = !modal;
    current = { unit, path };
    selectNode(unit, path);
    if (userNav || !wasOpen) { const title = $('#org-panel-title'); if (title && userNav) title.focus({ preventScroll: true }); }
    userNav = false;
  };

  const closePanel = restoreFocus => {
    if (panel.hidden) return;
    panel.hidden = true;
    backdrop.hidden = true;
    const was = current;
    current = null;
    selectNode('', '');
    if (restoreFocus) {
      let target = lastTrigger && document.contains(lastTrigger) && lastTrigger.offsetParent !== null ? lastTrigger : null;
      if (!target && was) target = $('[data-node="' + was.path + '"] .org-card-btn, [data-node="' + was.path + '"] .org-li-btn', document.getElementById(was.unit));
      if (target) target.focus({ preventScroll: true });
    }
    lastTrigger = null;
  };

  const showUnit = (route0) => {
    renderTrail(route0.unit, route0.from);
    if (route0.unit !== shownUnit) {
      const section = document.getElementById(route0.unit);
      const needsScroll = shownUnit !== '' || route0.path || route0.from;
      shownUnit = route0.unit;
      if (section && needsScroll && !(route0.path && userNav)) {
        section.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: route0.path ? 'nearest' : 'start' });
        if (!route0.path) { const heading = $('h2', section); if (heading && userNav) heading.focus({ preventScroll: true }); }
      }
    }
  };

  function route(fromHashEvent) {
    const parsed = parse();
    if (!parsed) { closePanel(false); return; }
    const user = userNav;
    showUnit(parsed);
    if (parsed.path && data.groups[parsed.unit].nodes[parsed.path]) {
      openPanel(parsed.unit, parsed.path);
      // A shared link opens straight to the box; bring it into view.
      if (!user) { const box = $('[data-node="' + parsed.path + '"]', document.getElementById(parsed.unit)); if (box) box.scrollIntoView({ behavior: 'auto', block: 'center' }); }
    } else { closePanel(false); userNav = false; }
  }

  // ---- Events -----------------------------------------------------------------
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const go = target.closest('[data-go]');
    if (go && panel.contains(go) && current) {
      userNav = true;
      navigate(build(current.unit, go.dataset.go, parse() ? parse().from : ''), true);
      return;
    }
    const nodeButton = target.closest('.org-card-btn, .org-li-btn');
    if (nodeButton) {
      const holder = nodeButton.closest('[data-node]');
      const unit = unitOf(nodeButton);
      if (holder && unit) {
        const parsed = parse();
        lastTrigger = nodeButton;
        userNav = true;
        navigate(build(unit, holder.dataset.node, parsed && parsed.unit === unit ? parsed.from : ''), !panel.hidden);
      }
      return;
    }
    const link = target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!data.groups[id]) return;
    // Drill-down: remember where we came from so the breadcrumb can show regiment > battalion > company.
    if (!link.closest('.org-chart-card, .org-panel')) return;
    event.preventDefault();
    const from = unitOf(link);
    userNav = true;
    navigate(build(id, '', from), false);
  });

  document.addEventListener('click', event => {
    // Sketch links point at a plate inside a collapsed <details>; open it and bring it into view.
    const link = event.target instanceof Element ? event.target.closest('a[href*="-subchart-"]') : null;
    if (!link) return;
    const plate = document.getElementById(link.getAttribute('href').slice(1));
    if (!plate) return;
    event.preventDefault();
    const details = plate.closest('details');
    if (details) details.open = true;
    if (narrow.matches || !panel.hidden) closePanel(false);
    plate.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    const caption = $('figcaption strong', plate);
    if (caption) { caption.tabIndex = -1; caption.focus({ preventScroll: true }); }
  });

  closeButton.addEventListener('click', () => {
    const parsed = parse();
    if (parsed) history.replaceState(null, '', build(parsed.unit, '', parsed.from));
    closePanel(true);
  });
  backdrop.addEventListener('click', () => closeButton.click());
  document.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeButton.click(); return; }
    if (event.key === 'Tab' && narrow.matches) {
      const focusable = $$('a[href], button:not([disabled]), [tabindex="0"], [tabindex="-1"]', panel).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  narrow.addEventListener('change', () => { if (!panel.hidden) { panel.setAttribute('aria-modal', String(narrow.matches)); backdrop.hidden = !narrow.matches; } });
  window.addEventListener('hashchange', () => route(true));
  route(false);
})();
