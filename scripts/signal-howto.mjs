import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const categories = {
  programming: 'Radio programming',
  repeater: 'Repeaters',
  network: 'IP & data',
  dipole: 'Antennas',
  coverage: 'Link planning',
  'radio-check': 'Radio procedure',
};

const radio = (x, y) => `<g class="sig-device" transform="translate(${x} ${y})">
  <rect x="0" y="0" width="60" height="78" rx="9"/><path d="M12 0v-29m33 29v-8m-35 60h40m-38 10h10m7 0h8m7 0h5"/>
  <rect class="sig-screen" x="10" y="16" width="40" height="24" rx="3"/><path d="M17 32h5l5-9 5 11 4-6h6"/>
</g>`;
const dot = (x, y) => `<circle class="sig-node" cx="${x}" cy="${y}" r="5"/>`;

const diagrams = {
  repeater: {
    title: 'Two radios and a retransmit cable',
    caption: 'The RX radio hears the approved input. The retransmit cable carries the call to the TX radio, which relays it on the approved output.',
    body: `
      <path class="sig-flow" d="M24 64h80m50 68v36h172v-36m50-68h80"/>
      <path class="sig-accent" d="M86 57l8 7-8 7m306-14 8 7-8 7m-161 90 8 7-8 7"/>
      ${radio(104, 53)}${radio(316, 53)}
      <text x="134" y="150">RX</text><text x="346" y="150">TX</text>
      <text x="52" y="42">INPUT</text><text x="428" y="42">OUTPUT</text>
      <text x="240" y="198">50 ft retransmit cable</text>`,
  },
  programming: {
    title: 'Fixed-frequency programming path',
    caption: 'Follow the radio menu to CHANNEL, then compare the saved preset with the assigned worksheet.',
    body: `
      <g class="sig-device"><rect x="30" y="27" width="420" height="109" rx="12"/><rect class="sig-screen" x="46" y="43" width="388" height="77" rx="6"/></g>
      <path class="sig-flow" d="M108 97h265M240 137v20"/>
      <text x="105" y="78">PGM</text><text x="174" y="78">MODE</text><text x="252" y="78">PRESET</text><text x="353" y="78">CHANNEL</text>
      ${dot(108, 97)}${dot(174, 97)}${dot(252, 97)}${dot(353, 97)}
      <rect class="sig-device" x="71" y="158" width="338" height="45" rx="6"/><text x="240" y="186">CH  /  RX  /  TX  /  MOD</text>`,
  },
  network: {
    title: 'Direct USB radio network',
    caption: 'The direct USB link joins the radio and the Windows RNDIS adapter on the assigned subnet.',
    body: `
      ${radio(55, 61)}
      <g class="sig-device"><rect x="300" y="44" width="128" height="88" rx="8"/><rect class="sig-screen" x="312" y="56" width="104" height="62" rx="4"/>
      <path d="M289 133h150l-13 15H302z"/></g>
      <path class="sig-flow" d="M128 103h159"/><path class="sig-accent" d="M245 96l8 7-8 7m-62-14-8 7 8 7"/>
      <text x="207" y="83">DIRECT USB</text><text x="364" y="94">RNDIS</text>
      <text x="86" y="173">RADIO IP</text><text x="364" y="173">PC IP</text>
      <text class="sig-note" x="240" y="203">Same subnet · distinct addresses</text>`,
  },
  coverage: {
    title: 'Point-to-point terrain profile',
    caption: 'Trace the modeled line between the two sites and inspect the terrain beneath it before exporting the profile.',
    body: `
      <path class="sig-terrain" d="M24 177l48-45 37 13 39-33 53 40 60-60 47 43 35-8 46 31 67-28v67H24z"/>
      <path class="sig-device" d="M72 132V64m317 94V64M59 132h26m291 26h26"/>
      <path class="sig-flow" d="M72 64h317"/>
      ${dot(72, 64)}${dot(389, 64)}
      <text x="72" y="43">SITE A</text><text x="389" y="43">SITE B</text><text x="240" y="185">TERRAIN PROFILE</text>`,
  },
  chat: {
    title: 'Tactical Chat over a training radio link',
    caption: 'Send an identified test message through the connected radio and confirm that the other station receives it.',
    body: `
      <g class="sig-device"><rect x="21" y="47" width="121" height="80" rx="8"/><rect class="sig-screen" x="31" y="57" width="101" height="59" rx="4"/>
      <path d="M12 128h139l-12 13H24z"/></g>
      ${radio(211, 65)}${radio(393, 65)}
      <path class="sig-flow" d="M153 106h45m84-8h98"/><path class="sig-accent" d="M363 91l8 7-8 7"/>
      <text x="81" y="91">CHAT</text><text x="174" y="89">USB</text><text x="331" y="78">RADIO LINK</text>
      <text x="81" y="172">SENDER</text><text x="241" y="172">LOCAL RADIO</text><text x="423" y="172">PARTNER</text>`,
  },
  dipole: {
    title: 'Two measured dipole arms',
    caption: 'Measure both arms from the center feed point. The diagram shows the layout for an equal-arm dipole.',
    body: `
      <path class="sig-device" d="M33 112h196m22 0h196M240 124v71"/>
      <path class="sig-flow" d="M225 100H38m217 0h187"/>
      <path class="sig-accent" d="M33 60v20m196-20v20m22-20v20m196-20v20M33 70h196m22 0h196"/>
      ${dot(229, 112)}${dot(251, 112)}
      <text x="131" y="49">ARM A</text><text x="349" y="49">ARM B</text>
      <text x="131" y="148">234 ÷ f ft</text><text x="349" y="148">234 ÷ f ft</text>
      <text x="240" y="217">CENTER FEED POINT</text>`,
  },
  'radio-check': {
    title: 'Two-way voice check',
    caption: 'One station requests a radio check. The other returns a report of signal strength and readability.',
    body: `
      ${radio(37, 64)}${radio(383, 64)}
      <path class="sig-flow" d="M111 71h258"/><path class="sig-flow sig-flow-return" d="M369 128H111"/>
      <path class="sig-accent" d="M350 64l8 7-8 7m-220 43-8 7 8 7"/>
      <text x="240" y="57">RADIO CHECK</text><text x="240" y="114">REPORT</text>
      <text x="67" y="173">STATION A</text><text x="413" y="173">STATION B</text>`,
  },
};

function diagram(type, e, decorative = false) {
  const { title, body } = diagrams[type];
  return `<svg viewBox="0 0 480 225" focusable="false" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${e(title)}"`}>${body}</svg>`;
}

const scopeArt = `<div class="signal-scope" aria-hidden="true">
  <div class="signal-scope-label"><span><i></i> FIELD REFERENCE</span><span>SOAC 52–26</span></div>
  <svg viewBox="0 0 320 165" focusable="false">
    <circle cx="160" cy="80" r="68"/><circle cx="160" cy="80" r="46"/><circle cx="160" cy="80" r="24"/>
    <path d="M17 80h286M160 3v155"/>
    <path class="signal-scope-beam" d="M160 80l48-48a68 68 0 0 1 20 48z"/>
    <path class="signal-scope-wave" d="M17 80h39l9 10 9-26 10 37 12-49 13 28h31l9-12 11 12h27l12-24 9 42 11-18h84"/>
    <circle class="signal-scope-mark" cx="160" cy="80" r="5"/><circle class="signal-scope-mark" cx="208" cy="98" r="3"/>
  </svg>
  <div class="signal-scope-label"><span>PROGRAM / CONNECT</span><span>VERIFY / RECORD</span></div>
</div>`;

function guideModel(guide) {
  const model = guide.model ?? guide.equipment.match(/RF-\d{4}[A-Z](?:-[A-Z]{2})?/i)?.[0];
  if (model) return model;
  if (guide.diagram === 'coverage') return 'Radio Mobile';
  if (guide.diagram === 'dipole') return 'Wire dipole';
  return 'Training radios';
}

function diagramKey(guide) {
  return guide.id === 'how-to-test-tactical-chat-link' ? 'chat' : guide.diagram;
}

const dipoleCalculator = `<section class="signal-panel signal-calculator" aria-labelledby="signal-calc-title">
  <p class="signal-label">LENGTH ESTIMATE</p><h2 id="signal-calc-title">Calculate the two arms</h2>
  <p>Divide 468 by the frequency in MHz for the total length in feet. Divide 234 by the same frequency for each arm. At 7.5 MHz, that is 62.4 ft total and 31.2 ft per arm.</p>
  <form data-signal-dipole hidden>
    <div class="signal-field"><label for="signal-frequency">Frequency (MHz)</label><input id="signal-frequency" name="frequency" type="number" inputmode="decimal" step="any" value="7.5" required></div>
    <button type="submit" class="signal-control">Calculate</button>
    <output for="signal-frequency" role="status"></output>
  </form>
  <p class="signal-calc-note">Use this initial estimate to plan the wire length. Check tuning on the installed antenna before trimming.</p>
</section>`;

function sourceLinks(guide, root, e) {
  const documents = Map.groupBy(guide.sources, source => source.file);
  return Array.from(documents, ([file, sources]) => {
    const pdf = String(file).endsWith('.pdf') ? file : file + '.pdf';
    if (!file || !existsSync(join(root, 'library/files', pdf))) throw Error('Missing How To source PDF: ' + guide.id);
    const pages = sources.map(source => {
      if (!Number.isInteger(source.page) || source.page < 1 || !Number.isInteger(source.pdfPage) || source.pdfPage < 1) {
        throw Error('Invalid How To source page: ' + guide.id);
      }
      return `<a href="../../library/files/${e(pdf)}#page=${source.pdfPage}" target="_blank" rel="noopener" aria-label="${e(source.title)}, original page ${source.page} (opens PDF in a new tab)">Page ${source.page} <span aria-hidden="true">↗</span></a>`;
    }).join('');
    return `<div class="signal-document"><h3>${e(sources[0].title)}</h3><div class="signal-source-pages">${pages}</div></div>`;
  }).join('');
}

function guideBody(guide, root, e) {
  const { diagram: type, id } = guide;
  const key = diagramKey(guide);
  const { title, caption } = diagrams[key];
  return `<article class="signal-guide" data-signal-guide="${e(id)}" data-signal-type="${type}">
    <div class="signal-setup">
      <figure class="signal-diagram">
        <div class="signal-diagram-head"><span class="signal-label"><i></i> CONNECTION DIAGRAM</span><button type="button" class="signal-control signal-play" data-signal-play hidden>Play signal flow</button></div>
        ${diagram(key, e)}
        <figcaption><strong>${e(title)}</strong> ${e(caption)} <span>Training schematic · not to scale</span></figcaption>
      </figure>
      <section class="signal-panel signal-kit" aria-labelledby="signal-kit-title">
        <p class="signal-label">BEFORE YOU START</p><h2 id="signal-kit-title">Kit &amp; prerequisites</h2>
        <p><strong>Equipment</strong><br>${e(guide.equipment)}</p>
        <ul>${guide.requires.map(item => `<li>${e(item)}</li>`).join('')}</ul>
      </section>
    </div>
    ${type === 'dipole' ? dipoleCalculator : ''}
    <section class="signal-procedure" aria-labelledby="signal-steps-title">
      <div class="signal-section-head"><div><p class="signal-label">FIELD CHECKLIST</p><h2 id="signal-steps-title">Follow the steps</h2></div><button type="button" class="signal-control" data-signal-print hidden>Print guide</button></div>
      <div class="signal-progress" data-signal-progress hidden>
        <div class="signal-progress-copy"><p role="status" data-signal-progress-text>0 of ${guide.steps.length} steps complete</p><progress max="${guide.steps.length}" value="0" aria-label="Checklist progress"></progress><p data-signal-storage>Progress is saved on this device.</p></div>
        <button type="button" class="signal-control" data-signal-reset>Reset checklist</button>
      </div>
      <ol class="signal-steps">${guide.steps.map((step, i) => `<li>
        <span class="signal-step-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <div class="signal-step-copy"><h3>${e(step.title)}</h3><p>${e(step.detail)}</p><p class="signal-step-check"><strong>Verify</strong> ${e(step.check)}</p>
        <label class="signal-step-control" hidden><input type="checkbox" data-signal-step><span>Mark step ${i + 1} complete</span></label></div>
      </li>`).join('')}</ol>
    </section>
    <section class="signal-finish" aria-labelledby="signal-finish-title"><p class="signal-label">VERIFICATION</p><h2 id="signal-finish-title">Done when</h2><p>${e(guide.check)}</p></section>
    <div class="signal-reference">
      <section class="signal-panel" aria-labelledby="signal-trouble-title"><p class="signal-label">FIELD DIAGNOSIS</p><h2 id="signal-trouble-title">Troubleshooting</h2>
        <dl>${guide.troubleshooting.map(item => `<dt>${e(item.symptom)}</dt><dd>${e(item.action)}</dd>`).join('')}</dl>
        <p class="signal-watch"><strong>Watch for</strong> ${e(guide.avoid)}</p>
      </section>
      <section class="signal-panel" aria-labelledby="signal-source-title"><p class="signal-label">SOURCE MATERIAL</p><h2 id="signal-source-title">Open the handout</h2><p>Page numbers refer to the original handout. Each link opens the matching page in the PDF excerpt.</p>${sourceLinks(guide, root, e)}</section>
    </div>
  </article>`;
}

function guideCard(guide, index, e) {
  const { id, diagram: type, title, summary, model } = guide;
  const category = categories[type];
  const search = [title, summary, category, model, guide.equipment, ...guide.steps.map(step => step.title)].join(' ');
  return `<li class="signal-card" id="${e(id)}" data-signal-card data-signal-type="${type}" data-signal-model="${e(model)}" data-signal-search="${e(search)}">
    <a href="./${e(id)}/">
      <div class="signal-card-art"><div class="signal-card-index"><span>${e(category)}</span><span>${String(index + 1).padStart(2, '0')}</span></div>${diagram(diagramKey(guide), e, true)}</div>
      <div class="signal-card-copy"><p class="signal-card-meta">${e(model)} <span>·</span> ${e(guide.duration)}</p>
        <h3>${e(title)}</h3><p class="signal-card-summary">${e(summary)}</p>
        <span class="signal-card-link">Open guide <span aria-hidden="true">→</span></span>
      </div>
    </a>
  </li>`;
}

export function renderSignalHowto(root, render, e) {
  const guides = JSON.parse(readFileSync(join(root, 'data/howto.json'), 'utf8')).map(guide => ({ ...guide, model: guideModel(guide) }));
  const types = new Set(guides.map(guide => guide.diagram));
  const models = [...new Set(guides.map(guide => guide.model))].sort();
  const assets = depth => {
    const prefix = '../'.repeat(depth);
    return `<link rel="stylesheet" href="${prefix}assets/signal-howto.css"><script src="${prefix}assets/signal-howto.js" defer></script>`;
  };
  const index = `<section class="signal-index" aria-labelledby="signal-directory-title">
    <div class="signal-finder">
      <div class="signal-section-head"><div><p class="signal-label">TASK DIRECTORY</p><h2 id="signal-directory-title">Find a field guide</h2></div><p id="signal-count" role="status">${guides.length} guides</p></div>
      <div class="signal-filters" data-signal-finder hidden>
        <div class="signal-field"><label for="signal-search">Search guides</label><input id="signal-search" type="search" placeholder="Try USB, repeater or dipole"></div>
        <div class="signal-field"><label for="signal-category">Category</label><select id="signal-category"><option value="">All categories</option>${Object.entries(categories).filter(([type]) => types.has(type)).map(([type, label]) => `<option value="${type}">${e(label)}</option>`).join('')}</select></div>
        <div class="signal-field"><label for="signal-equipment">Equipment</label><select id="signal-equipment"><option value="">All equipment</option>${models.map(model => `<option value="${e(model)}">${e(model)}</option>`).join('')}</select></div>
      </div>
    </div>
    <ul class="signal-cards">${guides.map((guide, i) => guideCard(guide, i, e)).join('')}</ul>
    <p id="signal-empty" class="signal-panel" hidden>No guides match. Try a different search or clear a filter.</p>
    <p class="signal-coverage-note"><strong>RoIP voice setup</strong> The supplied material did not include a model-specific gateway procedure.</p>
    <p class="signal-footnote">Use assigned training settings and local procedures. Each guide includes the relevant handout pages.</p>
  </section>`;
  render('how-to/index.html', 1, 'howto', 'Signal field guides', 'Set up equipment, trace the signal path, and verify your work with step-by-step field checklists.', index, {
    eyebrow: 'HOW TO / SIGNAL PERSONNEL',
    meta: `<p class="signal-meta"><span>${guides.length} guides</span><span>${types.size} categories</span><span>Handout references</span></p>`,
    art: scopeArt,
    scripts: assets(1),
  });

  for (const guide of guides) {
    render(`how-to/${guide.id}/index.html`, 2, 'howto', guide.title, guide.summary, guideBody(guide, root, e), {
      eyebrow: 'HOW TO / ' + categories[guide.diagram],
      meta: `<div class="signal-meta"><span>${e(guide.model)}</span><span>${e(guide.duration)}</span><span>${guide.steps.length} steps</span></div><a class="signal-back" href="../">← All signal guides</a>`,
      scripts: assets(2),
    });
  }
}
