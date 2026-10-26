# POI Exam Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Publish seven source-backed lesson quizzes, align existing exams with the supplied POI, and enforce 20–35 questions per difficulty without losing existing links or history.

**Architecture:** Extend the existing data-driven lesson folders and shared quiz engine. Keep unsupported lessons out of the published lesson registry; preserve their future placement in the project reference. Change presentation labels independently of stable lesson keys, URLs, question identities and history tabs.

**Tech Stack:** Existing Node.js build/tests, JSON question banks, browser JavaScript and Google Apps Script history service. No new runtime dependencies.

**Spec:** `docs/poi-exam-placement.md`, including the owner's 25 October clarification that unsupported lessons must have no public placeholders.

## Global Constraints

- Each difficulty must contain 20–35 questions. This also bounds existing combined-exam attempts; their underlying pools can contain more questions.
- Unsupported lessons stay absent from the student-facing site: no empty cards, disabled exams, "coming soon" or "materials needed" entries.
- Preserve stable URLs, lesson/history identifiers and historical results. Do not reuse old question identifiers for unrelated questions.
- Questions need supported answers, useful explanations and precise page/slide references; avoid filler and duplicate questions.
- Use Easy for comprehension, Medium for application and Hard for analysis. All remain four-option, single-best-answer questions so the current scoring engine remains valid.
- Do not present these practice quizzes as replacements for instructor-required essays, practical exercises or multiple-response examinations.
- Do not publish raw course files, personal instructor profiles, operational project data, secrets or real deployment particulars.
- Weapon/sensor questions cover source-backed concepts, system roles, interoperability, information quality, authority and limitations; no procedural targeting, weapon operation or attack optimization.
- Cyber scenarios concern authorized assessment and defensive governance, not unauthorized exploitation.
- CipherDesk, schedules, Telegram behavior and unrelated work remain unchanged. No GC announcement.

## Review Focus

1. An old direct link still reaches its exam, and historical rows retain their original interpretation.
2. A future source upload maps to the POI without creating unsupported placeholders today.
3. Reducing a bank does not silently remove a substantive topic or reuse an old question ID.
4. Source conflicts, outdated framework versions and missing content are disclosed rather than silently reconciled into invented facts.
5. New quiz completion does not claim a history save unless the deployed registry accepts its lesson key.

## Task 1: Source coverage and seven question banks

**Files:** create `lessons/{manet,sensors,weapons,nist,zerotrust,gsomia,cyberrisk}/{lesson.json,easy.json,medium.json,hard.json,coverage.md}` and reuse the existing supported art/template mechanism. Source files stay outside the public repository.

**Interfaces:** Each lesson exports the current `lesson.json` schema and question schema (`id`, stable `qid`, `difficulty`, `category`, `tags`, `prompt`, four `options`, zero-based `answer`, `explanation`, `sourceSlides`). `sourceRef.label` distinguishes PDF pages from slide numbers. The coverage document identifies the primary source filename and supplemental references.

| Key / URL slug | POI | Primary source | Initial target per difficulty |
| --- | --- | --- | --- |
| `manet` / `manet-c4istar-planning` | 5.3 | 3. MANET C4ISTAR Planning.pdf, 82 pages | 30 |
| `sensors` / `c4istar-sensors-integration` | 5.4 | 4. C4ISTAR Sensors Integration.pdf, 35 pages; paired 7-page handout | 25 |
| `weapons` / `c4istar-weapon-system-integration` | 5.5 | 5. C4ISTAR Weapon System Integration.pptx, 40 slides; paired DOCX handout | 25 |
| `nist` / `nist-framework` | 7.1 | 1. NIST Framework.pdf, 31 pages | 25 |
| `zerotrust` / `zero-trust` | 7.2 | 2. Zero Trust.pptx, 31 slides | 25 |
| `gsomia` / `gsomia-compliance` | 7.3 | 3. LOE3 GSOMIA Compliance.pptx, 52 slides | 30 |
| `cyberrisk` / `cyber-risk-assessment` | 7.4 | 4. Cyber Risk Assessment.pdf, 47 pages | 30 |

Counts can vary within 20–35 after complete source review; scope and coverage, not the target number, determine final counts. Do not add new combined Module 5/7 exams in this release.

- [x] Read all substantive source pages/slides and the two paired handouts. Inspect visual diagrams/tables when extraction loses meaning. Exclude biographies, icebreakers and administrative slides from assessed content.
- [x] Write per-lesson topic/objective-to-question coverage maps. Name ambiguities and any omitted unsupported or unsafe procedural material explicitly.
- [x] For NIST/Zero Trust and GSOMIA, distinguish what the supplied lesson teaches from current external standards or agreements. Verify external claims against authoritative sources if needed; do not turn a classroom quiz into legal guidance.
- [x] Author banks with objective and scenario questions, plausible distractors and explanations that justify the answer. Cite actual source pages/slides rather than inferred numbering.
- [x] Add `scripts/test/poi-exams.test.mjs` assertions for unique keys/qids, counts 20–35, valid source ranges, exactly four distinct options, answer balance, nonduplicate prompts and every declared category represented at each difficulty.
- [x] Run `node --test scripts/test/poi-exams.test.mjs`; verify the seven new keys and coverage maps, then review substantive question accuracy independently of structural tests.

## Task 2: Reorganize and revise existing exams

**Files:** `lessons/modules.json`; existing `lessons/*/lesson.json`, bank JSON and coverage files; `docs/poi-exam-placement.md`; `README.md`.

**Interfaces:** Keep existing keys, slugs, `historyLesson` values and retained-question `qid`s. Module IDs, order and display labels follow the POI. Add an explicitly supplemental section for lessons without a numbered POI match, rather than assigning them a fabricated lesson number.

- [x] Add migration assertions to `scripts/test/poi-exams.test.mjs` using the current key/slug/history mappings as the baseline. Check Module 4 placement of `signal`, `signaljoint`, `coalition`, `modulethree`; Module 6 placement of `sigint`, `rdf`; and the correct Module 2 order.
- [x] Review Army Operations sources before treating it as Infantry Operations. If it does not match 2.1, retain it as supplemental. Intelligence Cycle remains supporting material, not a replacement for Electronic Intelligence.
- [x] Revise oversized existing lesson banks to 35 or fewer by category/objective coverage, not by taking their first 35 questions. Keep the already-valid 25-question banks unless substantive review identifies a necessary correction. Record retained/retired qids and coverage changes; source history remains recoverable in Git.
- [x] Retain qids for unchanged questions; assign fresh identifiers for substantively changed items so old item statistics are not attributed to a new question. Sequential UI `id` values may change independently.
- [x] Set the former Module 3 signal-support combined exam to 30 questions (10 per lesson), relabel it Module 4, and keep `/module-3-exam/` and `modulethree` history compatibility.
- [x] Set the existing Module 2 combined exam to 30 questions. Ensure its title describes the actual included sources; do not claim it covers unsupported Infantry material. Preserve its route and history key.
- [x] Keep unsupported POI modules/lessons absent from the hub and instructor lesson selector. Update project inventory to distinguish implemented changes from future mappings.
- [x] Run migration assertions, verify retained qids and manually inspect revised coverage maps.

## Task 3: Enforce limits and protect history compatibility

**Files:** `scripts/build.mjs`, `src/engine/template.html`, `apps-script/Code.gs`, `apps-script/SETUP.md`, `scripts/test/{build,engine,hub,module5,codegs}.test.mjs`, `scripts/verify.mjs`.

**Interfaces:** Build-time and browser validation must agree: standalone banks 20–35; pool attempts 20–35 with sufficient source questions. Historical server validation must continue accepting old valid 40–60-question submissions during mixed-version rollout.

- [x] Add failing boundary tests for standalone sizes 19/20/35/36 and pool counts 19/20/35/36. Reject malformed content independently of length. Verify a combined source pool may exceed 35 while its served attempt cannot.
- [x] Replace legacy 50/69 limits and module-specific exceptions in build/browser validation. Preserve short retry-my-mistakes rounds as retries, not new full exams subject to the 20 minimum.
- [x] Add the seven new history lesson keys to the Apps Script registry without renaming or deleting existing tabs. Test old payload acceptance, the new keys, and rejection of unknown keys.
- [x] Update existing tests that encode obsolete module labels/counts. Do not remove behavioral coverage to make the suite pass.
- [x] Verify a replayed old exam link, old question-history IDs and short practice retries remain usable.
- [x] Deploy the additive Apps Script registry change before enabling new public history writes. Verify via read-only registry requests; do not add synthetic attempts to the class sheet. If deployment access is unavailable, report that gate instead of claiming history saving works or borrowing another lesson's key.

## Task 4: Build, review and publish

**Files:** Generated lesson pages, hub, instructor and related outputs from `scripts/build.mjs`; new `scripts/test/poi-exams.browser.cjs` for targeted smoke checks.

- [x] Run `node scripts/build.mjs`, `node scripts/verify.mjs`, and the new POI unit tests. Require clean generated-output freshness and no source reference or coverage errors.
- [x] Browser-test each new lesson's start, selection, check, next, previous, completion and review paths at laptop and 375px widths. Assert actual attempt totals, keyboard navigation, readable references and no horizontal page overflow.
- [x] Test representative existing lessons and both combined exams. Assert absent unsupported cards and unchanged CipherDesk/schedule behavior.
- [x] Review the branch for factual errors, ambiguous keyed answers, superficial difficulty inflation, longest-answer cues, broken legacy links and mismatched history keys.
- [ ] Commit only task files and push to the established `main` publishing target. Preserve unrelated `.superpowers/` and recovery artifacts.
- [ ] Wait for Pages deployment, then smoke-test the live hub, new pages, legacy links and count labels. Report only verified publication/history status and any material source limitations.

## Rollback

Revert the scoped publication commits and rebuild to restore old pages and banks. Do not delete or rename history tabs, saved attempts or question-analysis records. The additive server registry remains compatible with both old and new versions, so rollback does not require destructive server changes.
