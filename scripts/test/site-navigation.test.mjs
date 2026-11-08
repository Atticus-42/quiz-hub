import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = ['index.html', 'reviewer/index.html', 'reviewer/eccm/index.html', 'library/index.html', 'how-to/index.html', 'los-radios/index.html'];
const labels = ['Practice exams', 'Reviewer 101', 'Library', 'How To', 'LOS Radios'];

for (const path of pages) {
  test(`${path}: section links keep readable labels beside decorative vector icons`, () => {
    const html = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
    const nav = html.match(/<nav[^>]*aria-label="Site sections"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, 'site section navigation exists');
    for (const label of labels) {
      const link = [...nav.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]).find(link => link.includes(label));
      assert.ok(link, label);
      assert.match(link, /<svg\b[^>]*class="nav-icon"[^>]*aria-hidden="true"[^>]*focusable="false"/, label + ' decorative icon');
      assert.match(link, new RegExp('<span>' + label + '</span>'), label + ' visible label');
    }
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1, 'one current section');
  });
}
