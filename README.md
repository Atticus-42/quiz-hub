# Mastery Quizzes (Bandwidth Brothers, SOAC 52 - 2026)

**Adding or revising exams:** first consult [POI placement and publishing rules](docs/poi-exam-placement.md). This records the POI module order, 20–35 questions per difficulty, and future placement for lessons whose materials have not yet been supplied. Unsupported lessons have no student-facing placeholders.

The whole site is published from this repository with GitHub Pages at https://atticus-42.github.io/quiz-hub/. It contains:

- **The hub** (`index.html`): choose a module, then an exam, and see a summary of the class score history.
- **One page per quiz**, all built from a single quiz engine:

  | Module | Exam | Lesson key | URL |
  | --- | --- | --- | --- |
  | Module 2 | Combined Practice Exam (30 questions; includes supporting Army Operations) | `combined` | `/quiz-hub/combined/` |
  | Module 2 | Field Artillery Operations | `fieldartillery` | `/quiz-hub/field-artillery/` |
  | Module 2 | Armor Operations | `armor` | `/quiz-hub/armor/` |
  | Module 2 | ISR Operations | `isr` | `/quiz-hub/isr/` |
  | Module 4 | Module 4 Exam (30 questions, 10 per lesson) | `modulethree` | `/quiz-hub/module-3-exam/` |
  | Module 4 | Signal Support in Combined Arms Operations | `signal` | `/quiz-hub/signal-support/` |
  | Module 4 | Signal Support in Joint Operations | `signaljoint` | `/quiz-hub/joint-signal/` |
  | Module 4 | Signal Support in Coalition Operations | `coalition` | `/quiz-hub/coalition-signal/` |
  | Module 5 | Module 5 Exam (30 questions, 10 per available lesson) | `modulefive` | `/quiz-hub/module-5-exam/` |
  | Module 5 | MANET C4ISTAR Planning | `manet` | `/quiz-hub/manet-c4istar-planning/` |
  | Module 5 | C4ISTAR Sensors Integration | `sensors` | `/quiz-hub/c4istar-sensors-integration/` |
  | Module 5 | C4ISTAR Weapon System Integration | `weapons` | `/quiz-hub/c4istar-weapon-system-integration/` |
  | Module 6 | Signals Intelligence (SIGINT) | `sigint` | `/quiz-hub/signals-intelligence/` |
  | Module 6 | Radio Direction Finding | `rdf` | `/quiz-hub/radio-direction-finding/` |
  | Module 7 | Module 7 Exam (32 questions, 8 per lesson) | `moduleseven` | `/quiz-hub/module-7-exam/` |
  | Module 7 | NIST Framework | `nist` | `/quiz-hub/nist-framework/` |
  | Module 7 | Zero Trust | `zerotrust` | `/quiz-hub/zero-trust/` |
  | Module 7 | LOE3 GSOMIA Compliance | `gsomia` | `/quiz-hub/gsomia-compliance/` |
  | Module 7 | Cyber Risk Assessment | `cyberrisk` | `/quiz-hub/cyber-risk-assessment/` |
  | Supporting | Army Operations | `armyops` | `/quiz-hub/army-operations/` |
  | Supporting | Intelligence Cycle | `intcycle` | `/quiz-hub/intelligence-cycle/` |

- **Instructor view** (`/quiz-hub/instructor/`): question analysis.
- **Our class** (`/quiz-hub/class/`): class organization and roster.
- **Weekly training schedule** (`/quiz-hub/schedule/`): click a day to show its timetable; today opens automatically within the week, with a Now / Next panel. Printing includes every day. Linked from the hub header and class page.

The old per-lesson repositories now only redirect to these URLs.

The seven Module 5/7 lesson quizzes contain 450 questions: NIST and Zero Trust have 25 per difficulty, and MANET, Sensors, Weapon Systems, GSOMIA and Cyber Risk have 20. The two separate hybrid module exams add 186 question records: Module 5 has 30 per difficulty across its three available lessons; Module 7 has 32 across all four lessons. Each mode combines 50% selected foundations with 50% new cross-lesson scenarios. Their `coverage.json` maps primary lessons, origins and supporting source qids; explanations cite lesson names and pages/slides. They have independent history and question identities. Existing oversized banks have 35 per difficulty; SIGINT, RDF and Intelligence Cycle retain 25. Every lesson's `coverage.md` maps assessed topics and records source limitations. Raw source decks are not published. CipherDesk is a standalone tool.

No login, analytics, cookies, external fonts or scripts. Everything is inline HTML/CSS/JS, plus the shared files in `assets/` (photos, the self-hosted fonts and the paper grain).

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/template.html` | The one quiz engine: gate, Easy/Medium/Hard, shuffle, keyboard, sounds, results, history, practice retries |
| `src/engine/contours.svg` | The topographic contours, shown faintly in the page margins and masthead band |
| `src/shared/base.css` | The "Field Manual" design system shared by every page: fonts, colour tokens (with their computed WCAG contrast), type scale, grid, paper, buttons, tables. The build writes it into each page's one `<style>` |
| `assets/fonts/` | IBM Plex Sans Condensed and IBM Plex Mono (Latin-1 WOFF2 subsets, SIL Open Font License in `OFL.txt`), self-hosted and preloaded |
| `assets/paper-grain.svg` | The paper texture (a tiny SVG noise tile) |
| `src/hub/`, `src/instructor/`, `src/class/` | Page templates |
| `lessons/modules.json` | Modules, in hub order |
| `lessons/<key>/lesson.json` | A lesson's titles, topics (`categoryOrder`), slide/page reference range, palette, slug, module and order |
| `lessons/<key>/hero.svg`, `hero.css` | The lesson's artwork and its animation |
| `lessons/<key>/{easy,medium,hard}.json` | The question banks |
| `lessons/<key>/checks.mjs` | Optional lesson-specific tests |
| `lessons/<key>/retired.json` | Optional: qids removed from the banks; never reissued by `assign-qids` |
| `lessons/combined/lesson.json` | A *pool* exam: `pool.lessons` and `pool.count`; it has no banks of its own |
| `data/class.json` | The approved public class data (rank, name, commissioning source, positions only) |
| `data/schedule.json`, `data/schedules/` | This week's training schedule, and the archive of every week's file |
| `src/schedule/` | The weekly schedule page template |
| `apps-script/Code.gs`, `SETUP.md` | The Google Apps Script web app behind the class history and item analysis |
| `scripts/build.mjs` | Builds every page; the hub's `MODULES` are generated from the `lesson.json` files |
| `scripts/verify.mjs` | The test gate |

The `index.html` files are generated. Never edit them by hand; always rebuild and test:

```sh
node scripts/build.mjs && node scripts/verify.mjs
node --test scripts/test/module5.test.mjs
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
- `qid` is permanent. The instructor's question analysis is keyed on it, so never change or reuse one. A question
  corrected only in wording, explanation or a distractor keeps its qid; a question whose meaning changes gets a new
  qid (delete its `qid` and run `assign-qids`), so its statistics are not mixed with the old version's. Retired so far:
  `armyops-h-24` (now `armyops-h-26`: unity of command in a joint task force instead of civilians reporting to an
  officer) and `armyops-m-14` (now `armyops-m-26`: the stem described Information Operations, the key is Information).
  The October 2026 size trim (at most 50 per difficulty, full term coverage across the three modes) removed only questions whose terms another question still covers, and retired their qids, which `assign-qids` never issues again (`lessons/<key>/retired.json`): `signal` 31 (easy 14, medium 17), `signaljoint` 47 (easy 19, medium 24, hard 4) and `coalition` 3 (medium); the lists are in `lessons/signaljoint/coverage.md`, `lessons/coalition/coverage.md` and the `retired.json` files. The `signaljoint` audit against the student handout (October 2026) retired none: every key held, and its fixes
  (`signaljoint-e-14`, `-e-17`, `-e-19`, `-e-35`, `-e-37`, `-e-42`, `-m-01`, `-m-13`, `-m-30`) were wording or explanation only.
- `category` must be one of the lesson's `categoryOrder` topics.
- `sourceSlides` must fall within `sourceRef` (it is optional for Army Operations).
- Standalone banks and pool attempts contain **20–35 questions**, enforced by the build and engine. A lesson attempt serves the whole bank of the chosen mode: unseen questions first, then previously missed, then the rest, each group shuffled. Every declared topic appears in each mode; coverage documents map substantive concepts across the three difficulties and record limits. The mode buttons and cards show the actual count. Accurate `tags` guide selection in pool exams. The Combined Practice Exam asks 30 questions, with 8/8/7/7 shares allocated randomly among its four lessons. The Module 4 exam asks 30, with 10 from each lesson. Practice retries may contain fewer than 20 missed items. Historical pages and stored results with older totals remain readable.

**Appending questions** (for example the course-style questions written in parallel) is a plain append, then a rebuild:

1. Append the new objects to `lessons/<key>/<mode>.json`. `id` and `qid` may be left out.
2. Run the following, which numbers the ids and gives each new question the next free qid:
   ```sh
   node scripts/assign-qids.mjs <key>
   node scripts/build.mjs
   node scripts/verify.mjs
   ```

Page texts, hub cards, the Combined Exam pool and the instructor page all follow automatically. The tests require each bank to keep:
- answer letters balanced (each letter within ±1 of a quarter of the bank, and the most and least used letters differ by at most one);
- the key as the unique longest option in no more than 35% of questions (every lesson; `maxKeyLongestShare` in `lesson.json` can override it, but no lesson does);
- every topic present;
- unique prompts.
Signal Support also has content rules in `lessons/signal/checks.mjs`.

## Adding a lesson

Copy `lessons/_template/` to `lessons/<key>/`, then:
- fill in `lesson.json`;
- add `hero.svg` (and optionally `hero.css`) and the three banks;
- add the key to `LESSONS` in `apps-script/Code.gs` and update the deployment.

Then run `assign-qids`, build and verify. See `lessons/_template/README.md`. Lesson keys and history tab names stay stable when a display module changes. `sourceSlides` uses the lesson's declared slide/page numbering; paired handouts are named in explanations and coverage notes. For example, `signaljoint` (slug `joint-signal`, now POI 4.2) maps its questions to the lesson slides and student handout.

## Updating the weekly schedule

Week 6 (26 October–1 November) is active at `schedule/` and `schedule-2026-10-26/`, updated from the revised `26 OCT SCHEDULE.docx` and its separately supplied 21-meal workbook. Module 5 assessment is on 28 October; Module 7 assessment is on 30 October. All 90 source rows remain, plus five untimed menu-only entries where the timetable omits a mess period. Blank or shifted source fields are noted instead of inventing times or venues.

The approved partial screenshot for 2–6 November is published separately at `schedule-2026-11-02/`. It is clearly marked partial, includes only visible entries, and does not invent the cropped details or 7–8 November. The public `data/schedule.json` contains the active week followed by these five available dates. `loadSchedule()` returns the active first seven days; `loadSchedule(ROOT, undefined, {allDays:true})` returns every validated published date. The main page links the dated pages and opens a matching future date in Philippine time. A schedule-level `notice` identifies partial coverage; a feed may end midweek, but must contain every date through its stated end.

The daily Telegram sender targets 19:00 Philippine time with tomorrow's activities. See [TELEGRAM-SETUP.md](TELEGRAM-SETUP.md) for the one-time bot/group connection, private secrets, preview and timing limitations.

The schedule page shows whatever `data/schedule.json` holds. Each week:

Earlier weeks retain their dated JSON and pages, including their own menus and approved corrections. The normal build refreshes the active week's dated page and upcoming pages; older snapshots stay unchanged. Menus are never copied into a different week.

1. Copy last week's file to `data/schedules/<start>_<end>.json` named by the new week's dates (for example `2026-10-12_2026-10-18.json`) and transcribe the new weekly training schedule into it, row by row, exactly as printed:
   - `week`: `{ number, of, start, end }` (dates `YYYY-MM-DD`, Monday to Sunday); `prepared` is the "Date Prepared".
   - `days`: one entry per date, in order, with `day` matching the date's weekday.
   - each block: `time` (`"0830-1100"`, a single `"2130"`, or `""` when the schedule prints none), `activity`, `kind` (`"lecture"` for the green academic rows, `"exam"` for the yellow exam/assessment rows, otherwise `"routine"`), `instructor` (PRI SME/ALT SME as printed), `uniform`, `venue` (`null` when blank), and when present `class`, `periods` (PDS) and `remarks`.
2. Copy that file over `data/schedule.json`.
3. Rebuild and test:
   ```sh
   node scripts/build.mjs && node scripts/verify.mjs
   ```
   (the tests check this week's exact contents, so update the expectations at the top of `scripts/test/schedule.test.mjs` for the new week).

The page is public: instructors appear as rank + name (or a duty title) only. Never copy serial numbers, service numbers, phone numbers, e-mail or home addresses, nor the signature block; the build rejects `@`, `+63`, `O-<digits>`, `(SC)` and any run of 5 or more digits. A subject that names a quiz lesson (ISR, Armor, Field Artillery, Army Operations, Signal Support in Combined Arms Operations, Signal Support in Joint Operations, Coalition Operations) links to that quiz automatically (`SCHEDULE_QUIZ_MATCH` in `scripts/build.mjs`). To preview a given moment, open `schedule/?now=2026-10-05T13:10`.

## Students' features

- **Cipher Desk** (`codes-ciphers/`). A standalone tool with its own Codes & Ciphers navigation tab, independent of all modules. Students enter a message and key to see the computed answer immediately. All eight systems from the 12-page *Codes & Ciphers* handout support encipherment and decipherment, with charts and working steps. The indicator helper performs no-borrow subtraction and validates the check digit. Calculations stay in the browser and do not use class history or the bot.
  - **Generate practice keys:** the button adapts to the cipher—shift/indicator, readable key phrase, phrase plus decimation interval, or shuffled column orders. Transposition accepts 2–40 columns; double transposition produces two different orders. Generated settings remain editable and do not change the message, direction or padding. Browser-local randomness; this is not key recovery or modern encryption. `node --test scripts/test/cipher-generator.test.mjs` checks validity and all-eight round trips; the mode browser test covers generation on desktop/mobile.
  - **Scan a cipher:** upload/drop/paste a PNG, JPG or WebP (10 MB / 32 megapixels maximum). On-device OCR suggests explicitly named systems and labeled keys/messages; students review and confirm before applying. Unknown systems, missing keys, multiple exercises and ambiguous directions require review. It does not identify arbitrary ciphertext or recover secret keys. Handwriting and complex tables are not reliable; use a clear upright image of one printed exercise. HEIC/PDF must be converted to an image first.
  - OCR uses self-hosted Tesseract.js 6.0.1, core 6.1.2 and English fast language data under `assets/vendor/tesseract/`. Loaded only on scan, approximately 8 MB for the engine and language data before HTTP compression; image/text processing stays local. No model API, accounts, image uploads or persistent image storage. The worker is terminated after reading or cancellation. Desktop Chromium real-OCR checks cover known exercises, review validation, local-only GET requests, cancellation and a 375px viewport; physical iPhone/Safari testing is not claimed.
  - Scanner regression checks: `node --test scripts/test/cipher-scan.test.mjs`. With Playwright and Chromium installed, run `node scripts/test/cipher-scan.browser.cjs`; optional `PLAYWRIGHT_MODULE` and `CHROME_PATH` environment variables select an existing installation. The browser test creates synthetic printed exercises, tests real OCR and failed-download recovery, and saves screenshots in an OS temporary directory.
  - Source: `src/cipher/`; generated page: `codes-ciphers/index.html`. Rebuild with `node scripts/build.mjs`.
  - DSACS uses the handout's inclusive count: FIVE means four actual positions. Reverse standard starts at the indicated alphabet position.
  - Playfair opens in Encipher mode, uses X only for pair preparation, and displays five-letter groups without adding extra group padding. The user handles additional padding manually. If X-only preparation would create XX, it reports the conflict instead of substituting another filler. I/J are accepted in either direction; deciphering retains fillers. `node scripts/test/cipher-mode.browser.cjs` checks the mode, X-only fillers, manual group padding, reversal and mobile layout (same Playwright/Chrome environment options as the scanner test).
  - [Public-reference audit of all eight systems](docs/cipher-reference-audit.md): historical Army manual, Berkeley Playfair and ACA columnar worked examples, alongside the class handout. Lesson-specific indicator counts and padding remain explicit.
  - Transposition preserves digits, handles incomplete rows, and reverses key order for double decipherment. Assigned keys are entered directly; example CEOI keys are not treated as an operational key database.
  - `node --test scripts/test/cipher.test.mjs` checks the handout's vectors, boundary cases and inverse transforms. It also runs through the normal verification gate.

- **Retry my mistakes.** On the results page, *Retry the N questions I missed* (or the **M** key) starts a practice round with only those questions, reshuffled. It has its own results and is never sent to the class history.
- **Unseen first.** Each attempt asks the questions this browser has not shown yet first, then the ones last missed, then the rest, each group shuffled. The pool exam applies the same order within each lesson's share.
  - The record lives only in this browser's `localStorage`: question codes with seen/missed flags, and no name.
  - Without storage, the order is a plain shuffle.
  - *Reset my progress on this device* on the start page clears it.

## Class history and item analysis

Each finished (non-practice) attempt POSTs `{lesson, name, mode, score, total, percent, band, finishedAt, asked, missed}` to `HISTORY_ENDPOINT`. `asked` and `missed` hold stable ids of the form `<lessonKey>:<mode>:<qid>`; a pool exam reports each source question's own id.

The sheet (Code.gs v7) stores the attempt row with a `Missed` column and updates the 'Item Analysis' tab. The instructor page reads `?action=items&lesson=all`. Until the deployed script is updated to v7, the page says "not available yet". See `apps-script/SETUP.md`.
