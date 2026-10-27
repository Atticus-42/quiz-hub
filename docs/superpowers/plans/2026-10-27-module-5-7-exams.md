# Module 5 and Module 7 Exams Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the owner's preserved native execution method. Implement inline; use one final independent review.

**Goal:** Publish the approved hybrid Module 5 and Module 7 examinations.

**Architecture:** Add two dedicated bank configurations using the current engine and optional reference field. Categorize by primary lesson; retain multi-source citations in explanations and provenance/coverage documents. Add two server registry keys and deploy before publication.

**Tech Stack:** Existing JSON, HTML/CSS/JavaScript build and quiz engine, Google Apps Script, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-27-module-5-7-exams-design.md`.

## Global constraints

- Module 5: 30 per difficulty, ten per primary lesson, five selected foundations plus five new scenarios per lesson.
- Module 7: 32 per difficulty, eight per primary lesson, four selected foundations plus four new scenarios per lesson.
- Each new scenario connects at least two source lessons. New stable module qids; no existing qid reuse.
- Preserve existing lesson banks, exam routes, history data, schedules and CipherDesk. No new dependencies or Telegram sends.

## Review focus

- Correct-looking cases with unsupported facts: verify keyed explanations against supporting questions and actual source references.
- Reused foundations miscounted as new scenarios: coverage identifies origin qids and counts each kind per lesson/mode.
- Mixed page/slide references: cite the source lesson and correct unit for every support record.
- Hub/history naming drift: route, primary-lesson labels, registry keys and saved item identities must agree.
- Full attempts versus short mistake retries: exercise results and retries without real history writes.

## Task 1: Author and validate the hybrid banks

**Files:** create `lessons/{modulefive,moduleseven}/{lesson.json,easy.json,medium.json,hard.json,hero.svg,coverage.md}` and `scripts/test/module-exams.test.mjs`.

**Interfaces:** existing standalone question schema, `categoryOrder` equal to the primary lesson names, `sourceRef.required=false`; explanatory citations identify individual source lessons. Coverage maps provide foundation origin qids or scenario support qids.

- [x] Add failing tests for missing keys, 30/32 counts, 10/8 primary shares, 50/50 provenance and cross-lesson references; observe missing-exam failure. Source preservation uses a release diff audit, not permanent bank hashes.
- [x] Author the 93 new scenario rows and select 93 foundation rows from the existing difficulty banks. Compile to 186 stable module questions and coverage maps; balanced choices and length-cue checks.
- [x] Run the module unit test, inspect substantive source support and difficulty progression; revise ambiguous options.

## Task 2: Integrate history and discoverability

**Files:** `apps-script/Code.gs`, `apps-script/SETUP.md`, `README.md`, `scripts/test/{build,codegs,module5}.test.mjs`, generated pages.

**Interfaces:** keys `modulefive`/`moduleseven`; tabs `Module 5 Exam History`/`Module 7 Exam History`; routes `module-5-exam`/`module-7-exam`. Additive server version-7 protocol.

- [x] Add registry assertions and update obsolete fixed inventory/unknown-key fixtures while preserving behavior checks.
- [x] Register new keys, build prominent module cards and lesson-analysis labels, and document actual scope and counts.
- [x] Update the existing Apps Script deployment without changing URL or permissions; verify new keys with read-only requests and no synthetic records.

## Task 3: Verify and publish

**Files:** generated module/hub/instructor outputs; targeted browser smoke script.

- [x] Run build, new module tests and standard gate; require fresh generated output and unchanged existing source banks.
- [x] Complete both exams at all three difficulties on 1440px and 375px viewports with history traffic blocked; verify lesson analysis, references, keyboard navigation and mistake retry.
- [x] Perform the one final independent factual/code review and fix actionable issues.
- [ ] Commit scoped changes, push to main, wait for Pages and verify live module pages, counts, hub links and legacy routes.

Rollback by reverting the scoped publication commit and rebuilding; leave existing history records and additive registry keys intact.
