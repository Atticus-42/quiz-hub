# Mastery Quizzes hub

A single static page (`index.html`) where students choose one of the Philippine Army mastery exams and see a summary of the class score history. Future URL: https://atticus-42.github.io/quiz-hub/

- No build step, no dependencies, no external assets: inline CSS and JS, system fonts.
- Design tokens (colours, type scale, spacing, buttons, filter chips, history table) are copied from the quizzes (`armor-mastery-quiz/src/template.html`) so the hub looks like the same product.
- The exam cards are plain links, so they work without JavaScript. The history section needs JavaScript and says so in a `<noscript>` message.

## Exams

| Exam | Lesson key | URL |
| --- | --- | --- |
| Combined Exam (30 questions, all four lessons) | `combined` | https://atticus-42.github.io/combined-mastery-exam/ |
| ISR Operations | `isr` | https://atticus-42.github.io/isr-mastery-quiz/ |
| Armor Operations | `armor` | https://atticus-42.github.io/armor-mastery-quiz/ |
| Field Artillery Operations | `fieldartillery` | https://atticus-42.github.io/field-artillery-mastery-quiz/ |
| Army Operations | `armyops` | https://atticus-42.github.io/army-operations-scenario-quiz/ |

### Adding a lesson

1. Add one line to the `EXAMS` array at the top of the script in `index.html` (`key`, `lesson`, `title`, `description`, `url`, `total`). With JavaScript on, a card is built automatically for any entry that has no static card.
2. For visitors without JavaScript, also copy one of the static `<li id="card-...">` blocks in the markup and change its key, title, description and link.
3. Add the URL to `EXPECTED` in `scripts/verify.mjs` and run the tests.

## Class history

The page reads the shared Google Sheet web app (`HISTORY_ENDPOINT`) with one GET per lesson, all in parallel:

```
GET <HISTORY_ENDPOINT>?lesson=<key>&mode=all&limit=200
-> {"ok":true,"rows":[{name,mode,score,total,percent,band,finishedAt}, ...]}  (newest first)
-> {"ok":false,"error":"..."}
```

It shows per-exam stats on each card, a summary table (attempts, average, top score, latest attempt) and the 10 newest attempts across all exams. The All/Easy/Medium/Hard chips filter all three. An exam whose request fails (for example `unknown lesson` before the Apps Script is redeployed with that lesson) shows "Not available yet"; if every request fails, an error message and the Refresh button are shown. Remote text is only ever written with `textContent`, names are trimmed to 60 characters, and at most 200 rows per lesson are kept. Nothing is stored in cookies or browser storage.

## Tests

```
node scripts/verify.mjs
```

Runs the page script in `node:vm` against a small fake DOM and checks the pure helpers (`summarize`, `mergeRecent`, `filterByMode`, `parseHistoryResponse`, `formatDate`), the exam config and static cards, error handling (`ok:false`, network failure, HTTP errors, malformed JSON), the mode filter, XSS safety, and that the only external URLs are the five exams and the history endpoint.
