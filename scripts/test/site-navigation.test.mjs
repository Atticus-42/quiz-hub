import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, build } from '../build.mjs';
import { execFileSync } from 'node:child_process';

// The build manifest covers every generated index, including nested reviewer pages,
// without treating source templates or local preview copies as published pages.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0');
const builtIndexes = [...new Set([...Object.keys(build({ write: false })), ...tracked])]
  .filter(path => /(^|\/)index\.html$/.test(path) && !path.startsWith('src/') && !path.startsWith('lessons/_template/'));
for (const path of builtIndexes) {
  test(`${path}: shared section tabs have one correct current section and working links`, () => {
    const html = readFileSync(join(ROOT, path), 'utf8');
    const navs = [...html.matchAll(/<nav class="site-tabs wrap" aria-label="Site sections">([\s\S]*?)<\/nav>/g)];
    assert.equal(navs.length, 1, 'exactly one shared site-tabs nav');
    const nav = navs[0][1];
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
    const section = path.split('/')[0];
    const expected = path.startsWith('library/unit-organization/') ? 'Unit Organization'
      : section.startsWith('schedule') ? 'Weekly schedule'
      : ({ reviewer: 'Reviewer', 'comprehensive-reviewer': 'Exam Reviewer', library: 'Library', 'how-to': 'How To', 'los-radios': 'LOS Radios', 'codes-ciphers': 'Codes &amp; Ciphers', class: 'Our class', instructor: 'Our class', gallery: 'Gallery' })[section] || 'Practice exams';
    const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.equal(links.length, 11);
    assert.ok(links.find(([, attrs, label]) => attrs.includes('aria-current="page"') && label.includes(expected)), expected);
    for (const [, attrs] of links) {
      const href = attrs.match(/href="([^"]+)"/)[1].split(/[?#]/)[0];
      assert.ok(!/^(?:[a-z]+:|\/)/i.test(href), 'relative site link');
      const target = resolve(ROOT, dirname(path), href, href.endsWith('/') ? 'index.html' : '');
      assert.ok(existsSync(target), `${path}: ${href} resolves to a file`);
    }
    assert.ok(html.includes('assets/ui-polish.css'), 'shared navigation styles');
    const strip = html.match(/<div class="strip"[^>]*>[\s\S]*?<\/div>\s*<\/div>/);
    if (strip) assert.ok(html.slice(strip.index + strip[0].length).trimStart().startsWith(navs[0][0]), 'tabs directly below header strip');
  });
}

const pages = ['index.html', 'reviewer/index.html', 'reviewer/eccm/index.html', 'library/index.html', 'how-to/index.html', 'los-radios/index.html', 'library/unit-organization/index.html'];
const labels = ['Practice exams', 'Reviewer', 'Library', 'Unit Organization', 'How To', 'LOS Radios'];

for (const path of pages) {
  test(`${path}: section links keep consistent text-only labels`, () => {
    const html = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
    const nav = html.match(/<nav[^>]*aria-label="Site sections"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, 'site section navigation exists');
    for (const label of labels) {
      const link = [...nav.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]).find(link => link.includes(label));
      assert.ok(link, label);
      assert.doesNotMatch(link, /<svg|<img/, label + ' text-only navigation');
      assert.match(link, new RegExp('<span>' + label + '</span>'), label + ' visible label');
    }
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1, 'one current section');
  });
}

for (const [section,icon] of Object.entries({'':'colored',reviewer:'anime',library:'bronze','how-to':'jungle','los-radios':'neon','codes-ciphers':'red',schedule:'philippines',class:'comic',gallery:'comic',instructor:'realistic'})) {
 test(`browser favicon: ${section || 'home'}`,()=>{
  const html=readFileSync(new URL('../../'+(section ? section+'/' : '')+'index.html',import.meta.url),'utf8');
  assert.ok(html.includes('assets/favicons/crest-'+icon+'.png'));
  assert.equal(readFileSync(new URL('../../assets/favicons/crest-'+icon+'.png',import.meta.url)).readUInt32BE(16),64);
 });
}
