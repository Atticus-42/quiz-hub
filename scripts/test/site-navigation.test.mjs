import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
