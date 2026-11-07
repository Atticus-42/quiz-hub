import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function loadReviewerFocus(root) {
  const result = {};
  for (const file of readdirSync(join(root, 'data/reviewer-focus')).filter(f => f.endsWith('.json'))) {
    const entries = JSON.parse(readFileSync(join(root, 'data/reviewer-focus', file), 'utf8'));
    for (const [key, value] of Object.entries(entries)) {
      if (result[key]) throw Error('Duplicate reviewer focus: ' + key);
      result[key] = value;
    }
  }
  return result;
}

export function renderReviewerFocus(key, focus, panel, e, sourcePages) {
  if (!focus || focus.keyPoints.length < 4 || !focus.examAngles.some(q => q.type === 'Analytical')) throw Error('Incomplete exam focus: ' + key);
  return panel('exam-focus', 'The essentials', `<div class="review-focus" data-review-focus="${e(key)}"><div class="focus-takeaway"><p class="focus-label">THE LESSON IN ONE IDEA</p><p>${e(focus.takeaway)}</p></div><div class="focus-toolbar" data-focus-tools hidden><button type="button" data-focus-recall aria-pressed="false">Test my recall</button><button type="button" data-focus-filter aria-pressed="false">Only review again</button><button type="button" data-focus-reset>Reset marks</button><p data-focus-status role="status"></p></div><p class="focus-instruction">Explain each point in your own words. Then use the lesson page to check the details.</p><div class="focus-cards">${focus.keyPoints.map((point,i) => `<section class="focus-card" data-focus-card="${i}"><div class="focus-card-heading"><span>${String(i+1).padStart(2,'0')}</span><h3>${e(point.label)}</h3></div><details open data-focus-answer><summary>Recall it, then reveal</summary><p class="focus-answer">${e(point.answer)}</p><p class="focus-why"><strong>Why it matters</strong> ${e(point.why)}</p>${sourcePages(point.pages)}</details><div class="focus-mark" hidden><button type="button" data-focus-mark="ready" aria-pressed="false">I can explain this</button><button type="button" data-focus-mark="again" aria-pressed="false">Review again</button></div></section>`).join('')}</div><p data-focus-empty hidden>No points marked “Review again” yet. Turn off this filter to see all points.</p><p class="focus-storage" data-focus-storage hidden>Your marks stay on this device. They are not an exam score.</p><aside class="focus-memory"><span class="focus-label">MEMORY CUE</span><p>${e(focus.memoryCue)}</p></aside></div>`) +
    panel('compare-concepts', 'Don’t confuse these', `<div class="focus-contrasts">${focus.distinctions.map(d=>`<section><div class="focus-versus"><h3>${e(d.a)}</h3><span aria-hidden="true">/</span><h3>${e(d.b)}</h3></div><p>${e(d.difference)}</p>${sourcePages(d.pages)}</section>`).join('')}</div>`) +
    panel('question-styles', 'How this could be tested', `<p class="focus-exam-note">Practice question styles inferred from the lesson—not confirmed questions from your instructor’s exam.</p>${focus.examAngles.map((q,i)=>`<details class="focus-question"><summary><span class="focus-label">${e(q.type)} · ${String(i+1).padStart(2,'0')}</span><span>${e(q.question)}</span><small>Think first · reveal answer</small></summary><div><p><strong>Answer</strong> ${e(q.answer)}</p><p><strong>Reasoning</strong> ${e(q.reasoning)}</p>${sourcePages(q.pages)}</div></details>`).join('')}<aside class="focus-final"><h3>Can you do this without looking?</h3><ul>${focus.lastCheck.map(t=>`<li>${e(t)}</li>`).join('')}</ul><p>If one feels uncertain, revisit that key point before starting the practice exam.</p></aside>`);
}
