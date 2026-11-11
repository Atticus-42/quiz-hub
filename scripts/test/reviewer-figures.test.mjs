import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const figures = JSON.parse(readFileSync(new URL('data/reviewer-figures.json', root)));
const reviewers = Object.assign({}, ...readdirSync(new URL('data/reviewers/', root)).map(f => JSON.parse(readFileSync(new URL('data/reviewers/' + f, root)))));
for (const [key, list] of Object.entries(figures)) {
  if (key.startsWith('$')) continue;
  test(key + ' diagrams are sourced, accessible and placed in their topic', () => {
    const guide = reviewers[key].examGuide;
    const cited = new Set([...guide.topics, ...guide.practice].flatMap(t => t.pages));
    const html = readFileSync(new URL('reviewer/' + key + '/index.html', root), 'utf8');
    list.forEach((fig, i) => {
      const n = i + 1;
      assert(fig.pages.every(p => cited.has(p)), 'figure cites a page the lesson does not');
      const at = guide.topics.findIndex(t => t.title === fig.topic);
      assert(at >= 0, 'unknown topic ' + fig.topic);
      const topic = html.slice(html.indexOf('id="topic-' + (at + 1) + '"'), html.indexOf('id="topic-' + (at + 2) + '"') >>> 0);
      const figure = topic.match(new RegExp('<figure class="review-diagram" id="fig-' + n + '">[\\s\\S]*?</figure>'));
      assert(figure, 'Fig. ' + n + ' sits in its topic');
      assert(/(<\/p>|<\/figure>)<figure class="review-diagram" id="fig-/.test(topic.slice(topic.indexOf('id="fig-' + n + '"') - 70)) && topic.indexOf(figure[0]) < topic.indexOf('<ul>'), 'Fig. ' + n + ' sits directly after the explanation it summarises');
      assert.equal(html.split('id="fig-' + n + '"').length, 2, 'Fig. ' + n + ' appears once');
      assert.match(figure[0], /<svg viewBox="0 0 340 \d+"[^>]*role="img" aria-labelledby="fig-\d+-t fig-\d+-d"/);
      assert.match(figure[0], /<title id="fig-\d+-t">[^<]+<\/title><desc id="fig-\d+-d">[^<]{20,}<\/desc>/);
      assert.match(figure[0], new RegExp('<span class="fig-num">Fig. ' + n + '</span> — '));
      assert.match(figure[0], /Figure source: /);
      assert.doesNotMatch(figure[0], /<image|href="http|xlink/);
      assert(html.includes('href="#fig-' + n + '"'), 'At a glance links to Fig. ' + n);
    });
    assert(html.includes('class="lesson-glance"'));
  });
}

test('the ELINT radar band chart carries the full NATO band table, uses and caveats from slide 17', () => {
  const fig = figures.elint.find(f => f.kind === 'bands');
  assert(fig, 'ELINT has a band figure');
  assert.deepEqual(fig.pages, [17]);
  assert.deepEqual(fig.bands.map(b => b.letter + ' ' + b.range), ['A 0–0.25', 'B 0.25–0.5', 'C 0.5–1', 'D 1–2', 'E 2–3', 'F 3–4', 'G 4–6', 'H 6–8', 'I 8–10', 'J 10–20', 'K 20–40', 'L 40–60', 'M 60–100']);
  assert.deepEqual(fig.groups.map(g => g.from + '-' + g.to), ['A-D', 'E-H', 'I-J', 'K-M']);
  const html = readFileSync(new URL('reviewer/elint/index.html', root), 'utf8');
  const figure = html.match(/<figure class="review-diagram" id="fig-\d+"><svg[^>]*><title id="fig-\d+-t">NATO radar bands[\s\S]*?<\/figure>/)[0];
  for (const band of fig.bands) assert(figure.includes('>' + band.letter + '</text>') && figure.includes('>' + band.range + '</text>'), band.letter);
  assert(figure.includes('Range depends on power, antenna and target, not on the band letter. These are typical uses only.'));
  assert(figure.includes('Lower frequency: sees farther, less precise. Higher frequency: more precise, shorter range.'));
  assert(html.includes('Range depends on power, antenna and target, not on the band letter'), 'the topic explanation states the caveat');
});
