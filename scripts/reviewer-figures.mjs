// Reviewer figures: small inline-SVG diagrams generated at build time from structured data in
// data/reviewer-figures.json. Every label comes from that data (which is drawn only from the
// lesson's own reviewer and question-bank content); this file only supplies geometry.
// Kinds: flow (process, optional cycle and group outline), ladder (levels), matrix (table graphic),
// tree (parent with children), spectrum (two ends of a scale), pulse (radar pulse train) and bands
// (a lettered frequency-band strip whose rows are grouped by typical use).
// Output is accessible (role="img", <title>, <desc> listing the same content as text), uses real
// <text>, and is styled by classes in assets/reviewer-focus.css (site tokens, print-safe).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 340;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy word wrap for IBM Plex Sans Condensed (average glyph ≈ 0.5em, kept conservative).
function wrap(text, size, width, mono = false) {
  const max = Math.max(6, Math.floor(width / (size * (mono ? 0.62 : 0.48))));
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= max) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
const text = (x, y, lines, cls, lh, anchor) => lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" class="${cls}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(l)}</text>`).join('');
const arrowDown = (x, y1, y2) => `<path d="M${x} ${y1}V${y2 - 5}" class="rd-line"/><path d="M${x - 4} ${y2 - 6}L${x} ${y2}L${x + 4} ${y2 - 6}" class="rd-line"/>`;

const LABEL = 14, NOTE = 12.5, LH_L = 17, LH_N = 15.5;

function flow(fig) {
  const cyc = fig.cycle, x0 = 42, right = cyc ? W - 24 : W - 2, bw = right - x0, pad = 9;
  const gStart = new Map((fig.groups || []).map(g => [g.from, g]));
  let y = 2, out = '';
  const boxes = [];
  fig.steps.forEach((s, i) => {
    if (gStart.has(i)) y += 20;
    const label = wrap(s.label, LABEL, bw - 2 * pad), note = s.note ? wrap(s.note, NOTE, bw - 2 * pad) : [], tag = s.tag ? wrap(s.tag, 10.5, bw - 2 * pad - 12, true) : [];
    const h = pad * 2 + label.length * LH_L + note.length * LH_N + tag.length * 14 + (note.length || tag.length ? 3 : 0) - 4;
    boxes.push({ y, h });
    out += `<rect x="${x0}" y="${y}" width="${bw}" height="${h}" class="rd-box${s.highlight ? ' rd-box-hi' : ''}"/>`;
    out += `<circle cx="18" cy="${y + 15}" r="13" class="rd-num-bg"/><text x="18" y="${y + 19.5}" class="rd-num" text-anchor="middle">${esc(s.n ?? i + 1)}</text>`;
    let ty = y + pad + 11;
    out += text(x0 + pad, ty, label, 'rd-label', LH_L);
    ty += label.length * LH_L + 3;
    if (note.length) { out += text(x0 + pad, ty, note, 'rd-note', LH_N); ty += note.length * LH_N; }
    if (tag.length) { out += `<rect x="${x0 + pad}" y="${ty - 8}" width="7" height="7" class="rd-mark"/>` + text(x0 + pad + 12, ty, tag, 'rd-tag', 14); }
    y += h + 16;
  });
  // A list group (e.g. METAL factors) is a set, not a sequence: no arrows inside it.
  const inList = i => (fig.groups || []).some(g => g.list && i >= g.from && i < g.to);
  for (let i = 0; i + 1 < boxes.length; i++) if (!inList(i)) out = arrowDown(18, boxes[i].y + 28, boxes[i + 1].y + 2) + out;
  for (const g of fig.groups || []) {
    const a = boxes[g.from], b = boxes[g.to], gy = a.y - 18;
    out += `<rect x="${x0 - 6}" y="${gy}" width="${bw + 12}" height="${b.y + b.h - gy + 6}" class="rd-group"/><text x="${x0}" y="${gy + 12}" class="rd-tag">${esc(g.label)}</text>`;
  }
  let h = y - 16 + 4;
  if (cyc) {
    const last = boxes[boxes.length - 1], first = boxes[0], lx = W - 8, ly = last.y + last.h / 2, fy = first.y + 14;
    out += `<path d="M${right} ${ly}H${lx}V${fy}H${right + 6}" class="rd-loop"/><path d="M${right + 11} ${fy - 4}L${right + 5} ${fy}L${right + 11} ${fy + 4}" class="rd-loop"/>`;
    if (fig.loopLabel) { const l = wrap(fig.loopLabel, NOTE, W - x0); out += text(x0, h + 14, l, 'rd-note rd-italic', LH_N); h += 8 + l.length * LH_N; }
  }
  return { body: out, h: h + 2, desc: fig.steps.map((s, i) => `${s.n ?? i + 1}. ${s.label}${s.note ? ': ' + s.note : ''}${s.tag ? ' (' + s.tag + ')' : ''}.`).join(' ') + (fig.groups || []).map(g => ` ${g.label}: steps ${fig.steps[g.from].n ?? g.from + 1} to ${fig.steps[g.to].n ?? g.to + 1}.`).join('') + (cyc ? ' ' + (fig.loopLabel || 'The cycle repeats.') : '') };
}

function ladder(fig) {
  const tw = 78, x1 = 18 + tw, pad = 8, n = fig.rungs.length;
  let y = fig.top ? 18 : 2, out = fig.top ? text(18, 11, [fig.top], 'rd-tag', 12) : '';
  const startY = y;
  fig.rungs.forEach((r, i) => {
    const cw = W - x1 - 2 * pad, cond = r.condition ? wrap(r.condition, LABEL, cw) : [], meas = wrap(r.measures, NOTE, cw), name = wrap(r.name, 11, tw - 10);
    const h = Math.max(pad * 2 + cond.length * LH_L + meas.length * LH_N + (cond.length ? 2 : 0) - 3 + (r.highlight ? 15 : 0), pad * 2 + 18 + name.length * 13);
    // Olive tint deepens with each rung; tints stay either light (ink text) or dark (paper text) for AA contrast.
    const shade = n > 1 ? i / (n - 1) : 0, dark = shade >= 0.5, opacity = dark ? 0.9 + (shade - 0.5) * 0.2 : 0.12 + shade * 0.5;
    out += `<rect x="18" y="${y}" width="${tw}" height="${h}" class="rd-rung" fill-opacity="${opacity.toFixed(2)}"/>`;
    out += `<text x="${18 + tw / 2}" y="${y + pad + 14}" text-anchor="middle" class="rd-rung-tag${dark ? ' rd-on-dark' : ''}">${esc(r.tag)}</text>`;
    out += text(18 + tw / 2, y + pad + 30, name, 'rd-rung-name' + (dark ? ' rd-on-dark' : ''), 13, 'middle');
    out += `<rect x="${x1}" y="${y}" width="${W - x1 - 1}" height="${h}" class="rd-box${r.highlight ? ' rd-box-hi' : ''}"/>`;
    let ty = y + pad + 11;
    if (cond.length) { out += text(x1 + pad, ty, cond, 'rd-label', LH_L); ty += cond.length * LH_L + 2; }
    out += text(x1 + pad, ty, meas, 'rd-note', LH_N); ty += meas.length * LH_N;
    if (r.highlight) out += `<rect x="${x1 + pad}" y="${ty - 7}" width="7" height="7" class="rd-mark"/><text x="${x1 + pad + 12}" y="${ty}" class="rd-tag">${esc(r.highlight)}</text>`;
    y += h + 6;
  });
  out += `<path d="M7 ${startY + 4}V${y - 12}" class="rd-line"/><path d="M3 ${y - 17}L7 ${y - 10}L11 ${y - 17}" class="rd-line"/>`;
  let h = y - 6;
  if (fig.bottom) { out += text(18, h + 15, wrap(fig.bottom, NOTE, W - 20), 'rd-note rd-italic', LH_N); h += 8 + wrap(fig.bottom, NOTE, W - 20).length * LH_N; }
  return { body: out, h: h + 2, desc: (fig.top ? fig.top + '. ' : '') + fig.rungs.map(r => `${r.tag} ${r.name}: ${r.condition ? r.condition + ' — ' : ''}${r.measures}${r.highlight ? ' (' + r.highlight + ')' : ''}.`).join(' ') + (fig.bottom ? ' ' + fig.bottom : '') };
}

function matrix(fig) {
  const fr = fig.widths || fig.columns.map(() => 1), total = fr.reduce((a, b) => a + b, 0), pad = 6;
  const xs = [1]; fr.forEach(f => xs.push(xs[xs.length - 1] + (W - 2) * f / total));
  let y = 1, out = '';
  const row = (cells, head, idx) => {
    const ls = cells.map((c, i) => wrap(c, head ? 10.5 : NOTE, xs[i + 1] - xs[i] - 2 * pad, head));
    const h = pad * 2 + Math.max(...ls.map(l => l.length)) * LH_N - 2;
    out += `<rect x="1" y="${y}" width="${W - 2}" height="${h}" class="${head ? 'rd-head' : idx % 2 ? 'rd-cell-alt' : 'rd-cell'}"/>`;
    ls.forEach((l, i) => { out += text(xs[i] + pad, y + pad + 10.5, l, head ? 'rd-head-text' : i === 0 ? 'rd-label rd-small' : 'rd-note', LH_N); if (i) out += `<path d="M${xs[i]} ${y}V${y + h}" class="${head ? 'rd-rule-dark' : 'rd-rule'}"/>`; });
    y += h;
  };
  row(fig.columns, true, 0);
  fig.rows.forEach((r, i) => row(r, false, i));
  out += `<rect x="1" y="1" width="${W - 2}" height="${y - 1}" class="rd-frame"/>`;
  return { body: out, h: y + 2, desc: fig.rows.map(r => r.map((c, i) => (fig.columns[i] ? fig.columns[i] + ': ' : '') + c).join('; ') + '.').join(' ') };
}

function tree(fig) {
  const pad = 8, rw = 220, rx = (W - rw) / 2;
  const rl = wrap(fig.root.label, 14, rw - 2 * pad), rn = fig.root.note ? wrap(fig.root.note, NOTE, rw - 2 * pad) : [];
  const rh = pad * 2 + rl.length * 17 + rn.length * LH_N;
  let out = `<rect x="${rx}" y="1" width="${rw}" height="${rh}" class="rd-root"/>` + text(W / 2, 1 + pad + 12, rl, 'rd-root-text', 17, 'middle') + text(W / 2, 1 + pad + 12 + rl.length * 17, rn, 'rd-root-note', LH_N, 'middle');
  const cols = fig.cols || 2, gap = 22, cw = (W - 2 - gap * (cols - 1)) / cols;
  let y = rh + 26;
  const spineTop = rh + 1, mids = [];
  for (let i = 0; i < fig.children.length; i += cols) {
    const row = fig.children.slice(i, i + cols).map(c => ({ c, l: wrap(c.label, LABEL, cw - 2 * pad), n: c.note ? wrap(c.note, NOTE, cw - 2 * pad) : [] }));
    const h = pad * 2 + Math.max(...row.map(r => r.l.length * LH_L + r.n.length * LH_N + 2)) - 3;
    row.forEach((r, j) => {
      const x = 1 + j * (cw + gap);
      out += `<rect x="${x}" y="${y}" width="${cw}" height="${h}" class="rd-box"/><rect x="${x}" y="${y}" width="3" height="${h}" class="rd-mark-olive"/>` + text(x + pad + 2, y + pad + 11, r.l, 'rd-label', LH_L) + text(x + pad + 2, y + pad + 11 + r.l.length * LH_L + 2, r.n, 'rd-note', LH_N);
    });
    mids.push({ y: y + 15, n: row.length });
    y += h + 12;
  }
  const sx = cols === 2 ? W / 2 : W / 2;
  out += `<path d="M${sx} ${spineTop}V${mids[mids.length - 1].y}" class="rd-line"/>` + mids.map(m => `<path d="M${1 + cw} ${m.y}H${m.n > 1 ? 1 + cw + gap : sx}" class="rd-line"/>`).join('');
  return { body: out, h: y - 10, desc: `${fig.root.label}${fig.root.note ? ' (' + fig.root.note + ')' : ''} divides into: ` + fig.children.map(c => `${c.label}${c.note ? ' — ' + c.note : ''}`).join('; ') + '.' };
}

function spectrum(fig) {
  const half = (W - 14) / 2, pad = 7;
  let out = `<path d="M8 12H${W - 8}" class="rd-line-strong"/><path d="M14 7L7 12L14 17M${W - 14} 7L${W - 7} 12L${W - 14} 17" class="rd-line-strong"/>`;
  const lt = wrap(fig.left.title, LABEL, half - 4), rt = wrap(fig.right.title, LABEL, half - 4);
  out += text(1, 36, lt, 'rd-label', LH_L) + text(W - 1, 36, rt, 'rd-label', LH_L, 'end');
  let y = 36 + Math.max(lt.length, rt.length) * LH_L + 4, yl = y, yr = y;
  for (const it of fig.left.items) { const l = wrap(it, NOTE, half - 2 * pad - 4); out += `<rect x="1" y="${yl}" width="${half}" height="${l.length * LH_N + 2 * pad - 3}" class="rd-cell-alt"/>` + text(1 + pad, yl + pad + 10, l, 'rd-note', LH_N); yl += l.length * LH_N + 2 * pad + 2; }
  for (const it of fig.right.items) { const l = wrap(it, NOTE, half - 2 * pad - 4); out += `<rect x="${W - 1 - half}" y="${yr}" width="${half}" height="${l.length * LH_N + 2 * pad - 3}" class="rd-cell"/>` + text(W - 1 - half + pad, yr + pad + 10, l, 'rd-note', LH_N); yr += l.length * LH_N + 2 * pad + 2; }
  y = Math.max(yl, yr) + 4;
  if (fig.note) { const l = wrap(fig.note, NOTE, W - 30); out += `<rect x="1" y="${y}" width="${W - 2}" height="${l.length * LH_N + 14}" class="rd-box rd-box-hi"/>` + text(W / 2, y + 17, l, 'rd-note', LH_N, 'middle'); y += l.length * LH_N + 16; }
  return { body: out, h: y + 2, desc: `${fig.left.title}: ${fig.left.items.join('; ')}. ${fig.right.title}: ${fig.right.items.join('; ')}.${fig.note ? ' ' + fig.note : ''}` };
}

function pulse(fig) {
  // Three identical pulses on a time axis; brackets mark one pulse width and one interval.
  const base = 112, top = 62, pw = 30, pri = 104, x0 = 22;
  let out = `<path d="M8 ${base}H${W - 6}" class="rd-line"/><path d="M${W - 12} ${base - 4}L${W - 6} ${base}L${W - 12} ${base + 4}" class="rd-line"/><text x="${W - 8}" y="${base + 14}" text-anchor="end" class="rd-tag">${esc(fig.axis)}</text>`;
  for (let i = 0; i < 3; i++) { const x = x0 + i * pri; out += `<path d="M${x} ${base}V${top}H${x + pw}V${base}" class="rd-pulse"/>`; }
  out += `<path d="M${x0} ${top - 8}H${x0 + pw}M${x0} ${top - 12}V${top - 4}M${x0 + pw} ${top - 12}V${top - 4}" class="rd-line-accent"/>`;
  out += text(x0, top - 32, wrap(fig.width.label, 12.5, 140), 'rd-label rd-small', 13) + text(x0, top - 18, [fig.width.symbol], 'rd-tag', 12);
  const by = base + 26;
  out += `<path d="M${x0} ${by}H${x0 + pri}M${x0} ${by - 4}V${by + 4}M${x0 + pri} ${by - 4}V${by + 4}" class="rd-line-accent"/>`;
  out += text(x0 + pri + 8, by + 4, [fig.interval.label + ' (' + fig.interval.symbol + ')'], 'rd-label rd-small', 13);
  let y = by + 26;
  const rows = [fig.width, fig.interval, ...fig.notes];
  for (const r of rows) {
    const l = wrap(r.note, NOTE, W - 98);
    out += `<path d="M1 ${y - 13}H${W - 1}" class="rd-rule"/>` + text(1, y, wrap(r.symbol || r.label, 12.5, 86), 'rd-label rd-small', 13) + text(96, y, l, 'rd-note', LH_N);
    y += Math.max(l.length * LH_N, wrap(r.symbol || r.label, 12.5, 86).length * 13) + 12;
  }
  return { body: out, h: y - 6, desc: rows.map(r => `${r.label}${r.symbol && r.symbol !== r.label ? ' (' + r.symbol + ')' : ''}: ${r.note}.`).join(' ') };
}

function bands(fig) {
  // One row per band (letter and GHz range); consecutive rows share a tinted block with the typical use beside it.
  const rowH = 22, head = 22, xr = 124, pad = 7;
  const index = new Map(fig.bands.map((b, i) => [b.letter, i]));
  const groups = fig.groups.map(g => ({ ...g, a: index.get(g.from), b: index.get(g.to) }));
  const covered = groups.flatMap(g => Array.from({ length: g.b - g.a + 1 }, (_, i) => g.a + i));
  if (groups.some(g => !(g.a <= g.b)) || covered.length !== fig.bands.length || new Set(covered).size !== fig.bands.length) throw Error('Band groups must cover every band exactly once: ' + fig.title);
  let out = `<rect x="1" y="1" width="${W - 2}" height="${head}" class="rd-head"/>` +
    text(1 + pad, 16, ['BAND'], 'rd-head-text', 12) + text(46, 16, [fig.unit || 'GHZ'], 'rd-head-text', 12) + text(xr + pad, 16, ['TYPICAL USE'], 'rd-head-text', 12);
  const top = 1 + head;
  groups.forEach((g, gi) => {
    const y = top + g.a * rowH, h = (g.b - g.a + 1) * rowH, cls = gi % 2 ? 'rd-cell' : 'rd-cell-alt';
    out += `<rect x="1" y="${y}" width="${W - 2}" height="${h}" class="${cls}"/>`;
    if (gi) out += `<path d="M1 ${y}H${W - 1}" class="rd-rule-dark"/>`;
    for (let i = g.a; i <= g.b; i++) {
      const b = fig.bands[i], ry = top + i * rowH;
      if (i > g.a) out += `<path d="M1 ${ry}H${xr - 8}" class="rd-rule"/>`;
      out += text(1 + pad, ry + 15, [b.letter], 'rd-label', 14) + text(46, ry + 15, [b.range], 'rd-label rd-small', 14);
    }
    out += `<path d="M${xr - 8} ${y + 3}V${y + h - 3}" class="rd-line-accent"/>`;
    const lines = wrap(g.use, NOTE, W - xr - 2 * pad), ty = y + h / 2 - (lines.length - 1) * LH_N / 2 + 4;
    out += text(xr + pad, ty, lines, 'rd-note', LH_N);
  });
  let y = top + fig.bands.length * rowH;
  out += `<rect x="1" y="1" width="${W - 2}" height="${y - 1}" class="rd-frame"/>`;
  y += 8;
  const notes = fig.notes.map(n => wrap(n, NOTE, W - 2 * pad - 4));
  const nh = notes.reduce((a, l) => a + l.length * LH_N + 5, 0) + 6;
  out += `<rect x="1" y="${y}" width="${W - 2}" height="${nh}" class="rd-box rd-box-hi"/>`;
  let ny = y + 17;
  notes.forEach(l => { out += text(1 + pad, ny, l, 'rd-note', LH_N); ny += l.length * LH_N + 5; });
  y += nh;
  const desc = 'NATO radar bands, frequency in ' + (fig.unit || 'GHz') + ': ' + fig.bands.map(b => `${b.letter} ${b.range}`).join('; ') + '. Typical uses: ' + groups.map(g => `bands ${g.from} to ${g.to}, ${g.use}`).join('; ') + '. ' + fig.notes.join(' ');
  return { body: out, h: y + 2, desc };
}

const KINDS = { flow, ladder, matrix, tree, spectrum, pulse, bands };

export function loadReviewerFigures(root, reviewers) {
  const figures = JSON.parse(readFileSync(join(root, 'data', 'reviewer-figures.json'), 'utf8'));
  for (const [key, list] of Object.entries(figures)) {
    if (key.startsWith('$')) continue;
    const item = reviewers[key];
    if (!item?.examGuide) throw Error('Reviewer figure for unknown lesson: ' + key);
    const cited = new Set([...item.examGuide.topics, ...item.examGuide.practice].flatMap(t => t.pages));
    for (const fig of list) {
      if (!KINDS[fig.kind]) throw Error(`Unknown figure kind ${fig.kind} in ${key}`);
      if (!item.examGuide.topics.some(t => t.title === fig.topic)) throw Error(`Figure topic not found in ${key}: ${fig.topic}`);
      if (!fig.caption || !fig.title || !fig.pages?.length || !fig.pages.every(p => cited.has(p))) throw Error(`Figure in ${key} needs a title, caption and pages cited by the lesson: ${fig.title}`);
      // Secondary citations (fig.alt) must also be pages the lesson's topics or practice already cite from that document.
      const altCited = (ref, page) => [...item.examGuide.topics, ...item.examGuide.practice].some(t => (t.alt || []).some(a => a.ref === ref && a.pages.includes(page)));
      if (fig.alt && (!Array.isArray(fig.alt) || !fig.alt.every(a => a?.pages?.length && a.pages.every(p => altCited(a.ref, p))))) throw Error(`Figure in ${key} cites secondary pages the lesson does not: ${fig.title}`);
    }
  }
  delete figures.$comment;
  return figures;
}

export function renderFigure(fig, number, id, sourceLine) {
  const { body, h, desc } = KINDS[fig.kind](fig);
  const vh = Math.ceil(h);
  return `<figure class="review-diagram" id="${id}"><svg viewBox="0 0 ${W} ${vh}" width="${W}" height="${vh}" role="img" aria-labelledby="${id}-t ${id}-d" focusable="false"><title id="${id}-t">${esc(fig.title)}</title><desc id="${id}-d">${esc(desc)}</desc>${body}</svg>` +
    `<figcaption><span class="fig-num">Fig. ${number}</span> — ${esc(fig.caption)}</figcaption>${sourceLine}</figure>`;
}
