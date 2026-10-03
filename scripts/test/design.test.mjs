// The shared design system (src/shared/base.css): self-hosted fonts, same-origin assets only, WCAG AA contrast of
// every documented token pair (computed here), and no layout rule that could force sideways scrolling at 375px.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, HISTORY_ENDPOINT, PRELOADED_FONTS } from '../build.mjs';
import { test, parseCss, cssUrls, isLocalAsset, FONT_PRELOAD } from './harness.mjs';

const FONT_FILES = [
  'IBMPlexSansCondensed-Regular-Latin1.woff2', 'IBMPlexSansCondensed-Italic-Latin1.woff2', 'IBMPlexSansCondensed-Medium-Latin1.woff2',
  'IBMPlexSansCondensed-SemiBold-Latin1.woff2', 'IBMPlexSansCondensed-Bold-Latin1.woff2',
  'IBMPlexMono-Regular-Latin1.woff2', 'IBMPlexMono-Medium-Latin1.woff2', 'IBMPlexMono-SemiBold-Latin1.woff2',
];

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map(part => parseInt(part, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, what it is]. Text needs 4.5:1 (body copy 7:1), UI parts and graphics 3:1.
const PAIRS = [
  ['--color-text', '--color-paper', 7, 'body text'],
  ['--color-muted', '--color-paper', 7, 'secondary text'],
  ['--color-accent', '--color-paper', 4.5, 'olive links and labels'],
  ['--color-paper', '--color-accent', 4.5, 'primary button text'],
  ['--color-paper', '--color-olive-dark', 7, 'text on dark bands'],
  ['--color-khaki', '--color-olive-dark', 4.5, 'labels on dark bands'],
  ['--color-signal', '--color-paper', 3, 'signal orange: progress, current item, focus ring (non-text)'],
  ['--color-signal-text', '--color-paper', 4.5, 'orange text'],
  ['--color-signal-light', '--color-olive-dark', 4.5, 'orange text on dark bands'],
  ['--color-rule', '--color-paper', 3, 'control borders'],
  ['--color-correct', '--color-paper', 4.5, 'correct text'],
  ['--color-correct', '--color-correct-bg', 4.5, 'correct text on its tint'],
  ['--color-paper', '--color-correct', 4.5, 'text on the correct mark'],
  ['--color-incorrect', '--color-paper', 4.5, 'incorrect text'],
  ['--color-incorrect', '--color-incorrect-bg', 4.5, 'incorrect text on its tint'],
  ['--color-paper', '--color-incorrect', 4.5, 'text on the incorrect mark'],
  ['--color-text', '--color-sunken', 7, 'text in NOTE and CAUTION boxes'],
  ['--color-accent', '--color-selected', 4.5, 'selected answer'],
  ['--color-text', '--color-selected', 7, 'selected answer text'],
  ['--color-focus', '--color-paper', 3, 'focus ring on paper'],
  ['--color-focus', '--color-olive-dark', 3, 'focus ring on dark bands'],
];

const PAGES = ['index.html', 'class/index.html', 'instructor/index.html'];

export async function designSuite({ lessons }) {
  const T = (name, run) => test(`[design] ${name}`, run);
  const baseCss = readFileSync(join(ROOT, 'src', 'shared', 'base.css'), 'utf8');
  const pages = [...PAGES, ...lessons.map(lesson => `${lesson.slug}/index.html`)];
  const styles = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');

  await T('the IBM Plex fonts are self-hosted in assets/fonts as WOFF2 with the SIL Open Font License beside them', () => {
    for (const file of FONT_FILES) {
      const path = join(ROOT, 'assets', 'fonts', file);
      assert.ok(existsSync(path), `${file} exists`);
      assert.equal(readFileSync(path).subarray(0, 4).toString('latin1'), 'wOF2', `${file} is WOFF2`);
      assert.ok(statSync(path).size < 40000, `${file} is a subset (${statSync(path).size} bytes)`);
    }
    const license = readFileSync(join(ROOT, 'assets', 'fonts', 'OFL.txt'), 'utf8');
    assert.match(license, /SIL Open Font License/);
    assert.match(license, /IBM/);
    const grain = readFileSync(join(ROOT, 'assets', 'paper-grain.svg'), 'utf8');
    assert.doesNotMatch(grain.replace('xmlns="http://www.w3.org/2000/svg"', ''), /https?:|href|<script|<image/i, 'the paper grain is a self-contained SVG filter');
    assert.ok(Buffer.byteLength(grain) < 1024, 'the paper grain stays tiny');
  });

  await T('every page declares the fonts with @font-face (font-display: swap, same-origin files) and preloads the two most used faces', () => {
    for (const page of pages) {
      const html = readFileSync(join(ROOT, page), 'utf8');
      const css = styles(html);
      const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(match => match[1]);
      const remote = faces.filter(face => /url\(/.test(face));
      assert.equal(remote.length, FONT_FILES.length, `${page}: one @font-face per font file`);
      for (const face of remote) {
        assert.match(face, /font-display: swap;/, `${page}: font-display: swap`);
        const url = face.match(/url\("([^"]+)"\)/)[1];
        assert.ok(isLocalAsset(url) && existsSync(resolve(dirname(join(ROOT, page)), url)), `${page}: ${url} is a same-origin file on disk`);
      }
      assert.ok(faces.some(face => /local\("Arial Narrow"\)/.test(face) && /size-adjust/.test(face)), `${page}: a metric-matched local fallback limits the swap shift`);
      const preloads = [...html.matchAll(FONT_PRELOAD)].map(match => match[1]);
      assert.deepEqual(preloads.map(url => url.split('/').pop()), PRELOADED_FONTS, `${page}: preloads ${PRELOADED_FONTS.join(', ')}`);
      for (const url of preloads) assert.ok(existsSync(resolve(dirname(join(ROOT, page)), url)), `${page}: preload ${url} exists`);
      assert.ok(html.indexOf('rel="preload"') < html.indexOf('<style'), `${page}: preloads come before the stylesheet`);
      assert.match(css, /--font-sans: "IBM Plex Sans Condensed",[^;]*system-ui/, `${page}: Plex with system fallbacks`);
      assert.match(css, /--font-mono: "IBM Plex Mono",[^;]*monospace/, `${page}: Plex Mono with system fallbacks`);
    }
  });

  await T('no page makes an external request: every URL is the history endpoint or a same-origin relative path', () => {
    for (const page of pages) {
      const html = readFileSync(join(ROOT, page), 'utf8');
      const absolute = [...html.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi)].map(match => match[0]);
      assert.deepEqual(absolute.filter(url => url !== HISTORY_ENDPOINT), [], `${page}: only the history endpoint`);
      for (const url of cssUrls(styles(html))) assert.ok(url.startsWith('#') || isLocalAsset(url), `${page}: url(${url}) is same-origin`);
      for (const [, value] of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) assert.doesNotMatch(value, /^(?:[a-z]+:|\/\/)/i, `${page}: ${value} is relative`);
    }
  });

  await T('WCAG AA: every documented token pair is computed here, meets its minimum and matches the ratio written in base.css', () => {
    const { rules } = parseCss(baseCss.replace(/\/\*[\s\S]*?\*\//g, ''));
    const root = new Map(rules.filter(rule => !rule.media && rule.selectors.includes(':root')).flatMap(rule => [...rule.declarations]));
    const color = name => {
      const value = root.get(name);
      assert.match(value ?? '', /^#[0-9a-f]{6}$/i, `${name} is a plain hex token`);
      return value;
    };
    for (const [fg, bg, min, what] of PAIRS) {
      const ratio = contrast(color(fg), color(bg));
      assert.ok(ratio >= min, `${what}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
      assert.ok(baseCss.includes(`${ratio.toFixed(2)}:1`), `${what}: the computed ${ratio.toFixed(2)}:1 is documented in base.css`);
    }
    // Each lesson's accent (hero art, section markers) is a graphic on paper: at least 3:1.
    for (const lesson of lessons) {
      const accent = lesson.palette?.['--lesson-accent'];
      if (accent) assert.ok(contrast(accent, color('--color-paper')) >= 3, `${lesson.key} accent ${accent} reaches 3:1 on paper`);
    }
  });

  await T('no rule can force sideways scrolling at 375px: no fixed widths beyond the phone, wrapping text, clipped decoration, scrollable tables', () => {
    const LIMIT = 375 - 32; // the 16px gutters each side
    const tooWide = value => [...value.matchAll(/(?<![\w(-])(\d+(?:\.\d+)?)(px|rem|em)\b/g)].some(([, n, unit]) => Number(n) * (unit === 'px' ? 1 : 16) > LIMIT);
    for (const page of pages) {
      const html = readFileSync(join(ROOT, page), 'utf8');
      const { rules } = parseCss(styles(html).replace(/\/\*[\s\S]*?\*\//g, ''));
      for (const rule of rules) {
        if (rule.media && /print|min-width/.test(rule.media)) continue;
        for (const property of ['width', 'min-width', 'flex-basis']) {
          const value = rule.declarations.get(property);
          if (value && !/^(?:min|clamp|calc)\(/.test(value)) assert.ok(!tooWide(value), `${page}: ${rule.selectors.join(', ')} { ${property}: ${value} } is wider than a phone`);
        }
      }
      const base = selector => rules.find(rule => !rule.media && rule.selectors.includes(selector));
      assert.equal(base('body')?.declarations.get('overflow-wrap'), 'anywhere', `${page}: long words wrap`);
      assert.equal(base('.table-wrap')?.declarations.get('overflow-x'), 'auto', `${page}: wide tables scroll inside their wrapper`);
      const layer = rules.find(rule => !rule.media && (rule.selectors.includes('.terrain') || rule.selectors.includes('.topo')));
      assert.equal(layer?.declarations.get('position'), 'fixed', `${page}: the contour layer is fixed`);
      assert.equal(layer?.declarations.get('overflow'), 'hidden', `${page}: and clipped`);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, `${page}: responsive viewport`);
    }
  });
}
