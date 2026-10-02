# Mastery Quizzes hub

A single static page (`index.html`) where students first choose a module, then one of that module's Philippine Army mastery exams, and see a summary of the class score history for the module. Published at https://atticus-42.github.io/quiz-hub/

- No build step, no dependencies, no external assets: inline CSS, JS and SVG, system fonts.
- Design tokens (colours, type scale, spacing, buttons, filter chips, history table) are copied from the quizzes (`armor-mastery-quiz/src/template.html`) so the hub looks like the same product.
- Module cards and exam cards are plain links, so they work without JavaScript (all module panels are then shown and the module cards jump to them). The history section needs JavaScript and says so in a `<noscript>` message.

## Modules and exams

| Module | Exam | Lesson key | URL |
| --- | --- | --- | --- |
| Module 2 | Combined Exam (30 questions, all four lessons) | `combined` | https://atticus-42.github.io/combined-mastery-exam/ |
| Module 2 | ISR Operations | `isr` | https://atticus-42.github.io/isr-mastery-quiz/ |
| Module 2 | Armor Operations | `armor` | https://atticus-42.github.io/armor-mastery-quiz/ |
| Module 2 | Field Artillery Operations | `fieldartillery` | https://atticus-42.github.io/field-artillery-mastery-quiz/ |
| Module 2 | Army Operations | `armyops` | https://atticus-42.github.io/army-operations-scenario-quiz/ |
| Module 3 | Signal Support in Combined Arms Operations | `signal` | https://atticus-42.github.io/signal-support-mastery-quiz/ |

## Module selection

- Step 1 shows the module cards; step 2 shows the exam grid of the chosen module only.
- The choice lives in the URL hash: `#module-2`, `#module-3`. Links can be shared, back/forward works, the hash is applied on load, and no (or an unknown) hash shows only the module chooser. "Change module" removes the hash and returns to step 1.
- The chosen card has `aria-current="true"`. After a choice, focus moves to the step's heading and a polite live region announces it (for example "Module 2 selected. Choose your exam: 5 exams available."). Ctrl/Cmd-click on a module card keeps the browser default.

### Adding a lesson or a module

1. Add the exam (`key`, `lesson`, `title`, `description`, `url`, `total`, optional `prominent`) to its module's `exams` in the `MODULES` array at the top of the script in `index.html`; a new module is one more entry (`id: 'module-N'`, `title`, `meta`, `description`, optional `note`, `exams`). With JavaScript on, a card is built automatically for any exam that has no static card.
2. For visitors without JavaScript, also copy a static `<li id="card-...">` block into the module's `<ul id="exam-grid-module-N">` (and, for a new module, a module card and an `exam-panel` section).
3. Add the URL to `EXPECTED` and the key to `MODULE_EXAMS` in `scripts/verify.mjs` and run the tests.

## Class history

The page reads the shared Google Sheet web app (`HISTORY_ENDPOINT`) with one GET per lesson:

```
GET <HISTORY_ENDPOINT>?lesson=<key>&mode=all&limit=200
-> {"ok":true,"rows":[{name,mode,score,total,percent,band,finishedAt}, ...]}  (newest first)
-> {"ok":false,"error":"..."}
```

- On load, the selected module's lessons are requested first, then all six lessons in parallel for the small "N class attempts" overview on each module card. Each lesson is requested once and cached; Refresh reloads only the selected module's lessons.
- For the selected module: per-exam stats on each card, a summary table (attempts, average, top score, latest attempt) and the 10 newest attempts. The All/Easy/Medium/Hard chips filter all three.
- A lesson whose request fails (for example `unknown lesson` before the Apps Script knows `signal`) shows "Not available yet"; if a whole module is unknown to the sheet the status says so. Only if every request of the module fails for network reasons is an error with Refresh shown.
- Remote text is only ever written with `textContent`, names are trimmed to 60 characters, and at most 200 rows per lesson are kept. Nothing is stored in cookies or browser storage.

## Background

A fixed, decorative topographic contour map (inline SVG, `aria-hidden`, `pointer-events: none`, `preserveAspectRatio="xMidYMid slice"`) sits behind the content over a paper-cream background with a soft green-to-sand tint. Line colours and opacities are CSS variables (`--topo-line`, `--topo-line-major`, `--topo-minor-opacity` 0.22, `--topo-major-opacity` 0.4); index contours use `class="major"`. Cards and tables stay on solid surfaces, the hero keeps its dark band, and print hides the map.

## Tests

```
node scripts/verify.mjs
```

Runs the page script in `node:vm` against a small fake DOM and window (no network) and checks the `MODULES` config (ids, keys, exact URLs), hash routing on load, by click, "Change module" and back/forward, focus and live-region announcements, per-module history scoping and Refresh, failure tolerance for `unknown lesson`, the pure helpers (`summarize`, `mergeRecent`, `filterByMode`, `parseHistoryResponse`, `moduleFromHash`, `formatDate`), the mode filter, XSS safety, the background layer, and that the only external URLs are the six exams, the hub itself and the history endpoint.
