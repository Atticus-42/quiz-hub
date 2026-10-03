# Mastery Quizzes (Bandwidth Brothers, SOAC 52 - 2026)

The whole site is published from this repository with GitHub Pages at https://atticus-42.github.io/quiz-hub/. It contains:

- **The hub** (`index.html`): choose a module, then an exam, and see a summary of the class score history.
- **One page per quiz**, all built from a single quiz engine:

  | Module | Exam | Lesson key | URL |
  | --- | --- | --- | --- |
  | Module 2 | Combined Exam (30 questions drawn across the four lessons) | `combined` | `/quiz-hub/combined/` |
  | Module 2 | ISR Operations | `isr` | `/quiz-hub/isr/` |
  | Module 2 | Armor Operations | `armor` | `/quiz-hub/armor/` |
  | Module 2 | Field Artillery Operations | `fieldartillery` | `/quiz-hub/field-artillery/` |
  | Module 2 | Army Operations | `armyops` | `/quiz-hub/army-operations/` |
  | Module 3 | Signal Support in Combined Arms Operations | `signal` | `/quiz-hub/signal-support/` |

- **Instructor view** (`/quiz-hub/instructor/`): question analysis.
- **Our class** (`/quiz-hub/class/`): class organization and roster.

The old per-lesson repositories now only redirect to these URLs.

No login, analytics, cookies, external fonts or scripts. Everything is inline HTML/CSS/JS, plus the shared images in `assets/`.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/template.html` | The one quiz engine: gate, Easy/Medium/Hard, shuffle, keyboard, sounds, results, history, practice retries |
| `src/engine/contours.svg` | The shared topographic background |
| `src/hub/`, `src/instructor/`, `src/class/` | Page templates |
| `lessons/modules.json` | Modules, in hub order |
| `lessons/<key>/lesson.json` | A lesson's titles, topics (`categoryOrder`), slide/page reference range, palette, slug, module and order |
| `lessons/<key>/hero.svg`, `hero.css` | The lesson's artwork and its animation |
| `lessons/<key>/{easy,medium,hard}.json` | The question banks |
| `lessons/<key>/checks.mjs` | Optional lesson-specific tests |
| `lessons/combined/lesson.json` | A *pool* exam: `pool.lessons` and `pool.count`; it has no banks of its own |
| `data/class.json` | The approved public class data (rank, name, commissioning source, positions only) |
| `apps-script/Code.gs`, `SETUP.md` | The Google Apps Script web app behind the class history and item analysis |
| `scripts/build.mjs` | Builds every page; the hub's `MODULES` are generated from the `lesson.json` files |
| `scripts/verify.mjs` | The test gate |

The `index.html` files are generated. Never edit them by hand; always rebuild and test:

```sh
node scripts/build.mjs && node scripts/verify.mjs
```

The tests never contact the class history sheet: they clear the endpoint or use a fake network.

For a local preview with no class-history traffic at all, build a copy with the endpoint blanked, copy `assets/` next to it, and serve that folder:

```sh
node scripts/build.mjs --out ../preview --endpoint ""
```

## Questions

Each bank is a JSON array. Each question looks like this:

```json
{ "id": 7, "qid": "armor-e-07", "difficulty": "easy", "category": "Tank Operations", "tags": ["..."],
  "prompt": "...", "options": ["...", "...", "...", "..."], "answer": 2, "explanation": "...", "sourceSlides": [31] }
```

- `id` is the position in the bank: 1, 2, 3, …
- `qid` is permanent. The instructor's question analysis is keyed on it, so never change or reuse one.
- `category` must be one of the lesson's `categoryOrder` topics.
- `sourceSlides` must fall within `sourceRef` (it is optional for Army Operations).
- An attempt asks every question of the chosen bank (1–500 per bank). The pool exam asks `pool.count` questions, split evenly across its lessons.

**Appending questions** (for example the course-style questions written in parallel) is a plain append, then a rebuild:

1. Append the new objects to `lessons/<key>/<mode>.json`. `id` and `qid` may be left out.
2. Run the following, which numbers the ids and gives each new question the next free qid:
   ```sh
   node scripts/assign-qids.mjs <key>
   node scripts/build.mjs
   node scripts/verify.mjs
   ```

Page texts, hub cards, the Combined Exam pool and the instructor page all follow automatically. The tests require each bank to keep:
- answer letters balanced (each letter within ±1 of a quarter of the bank);
- the key as the unique longest option in no more than 35% of questions (ISR is allowed 48% and Army Operations 44%, as their current banks need);
- every topic present;
- unique prompts.
Signal Support also has content rules in `lessons/signal/checks.mjs`.

## Adding a lesson

Copy `lessons/_template/` to `lessons/<key>/`, then:
- fill in `lesson.json`;
- add `hero.svg` (and optionally `hero.css`) and the three banks;
- add the key to `LESSONS` in `apps-script/Code.gs` and update the deployment.

Then run `assign-qids`, build and verify. See `lessons/_template/README.md`. The Module 3 lesson `signaljoint` (slug `joint-signal`) is already registered in `Code.gs`.

## Students' features

- **Retry my mistakes.** On the results page, *Retry the N questions I missed* (or the **M** key) starts a practice round with only those questions, reshuffled. It has its own results and is never sent to the class history.
- **Unseen first.** Each attempt asks the questions this browser has not shown yet first, then the ones last missed, then the rest, each group shuffled. The pool exam applies the same order within each lesson's share.
  - The record lives only in this browser's `localStorage`: question codes with seen/missed flags, and no name.
  - Without storage, the order is a plain shuffle.
  - *Reset my progress on this device* on the start page clears it.

## Class history and item analysis

Each finished (non-practice) attempt POSTs `{lesson, name, mode, score, total, percent, band, finishedAt, asked, missed}` to `HISTORY_ENDPOINT`. `asked` and `missed` hold stable ids of the form `<lessonKey>:<mode>:<qid>`; a pool exam reports each source question's own id.

The sheet (Code.gs v7) stores the attempt row with a `Missed` column and updates the 'Item Analysis' tab. The instructor page reads `?action=items&lesson=all`. Until the deployed script is updated to v7, the page says "not available yet". See `apps-script/SETUP.md`.
