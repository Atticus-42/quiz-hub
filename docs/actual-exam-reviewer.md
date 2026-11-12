# Actual Exam category and the Comprehensive Exam Reviewer

Questions from the class's 14 graded exams (SOAC 52-2026), for reviewing before the Comprehensive Exam.

- Data: `data/actual-exams.json`. Each question has only `n` (its number on the graded exam), `stem` and `key`.
  Student answers, names, scores and pass marks are not recorded. The build and the tests reject any `studentAnswer`.
- Code: `scripts/actual-exams.mjs` (loading, validation, multiple-choice generation, page placement),
  `scripts/build.mjs` (`actualSection`, `renderActualPage`, `renderActualPages`, `renderReviewerIndex`),
  and the quiz engine (`src/engine/template.html`: the `actual` category).
- Tests: `scripts/test/actual-exams.test.mjs`, also run by `node scripts/verify.mjs`.

## Where each graded exam appears

Every exam is its own quiz at `comprehensive-reviewer/<slug>/`. All exams together form the mixed set at
`comprehensive-reviewer/all/`. Each exam also appears as the **Actual Exam** category on these pages:

| # | Graded exam (date) | Items used | Lesson page | Module exam page |
| --- | --- | --- | --- | --- |
| 01 | Module Exam on Advanced Electronic Warfare Operations (12 Nov 2026) | 49 of 50 | none | Module 6 Exam (`modulesix`) |
| 02 | Module Exam on Advanced Cyberspace Operations (30 Oct 2026) | 40 | none | Module 7 Exam (`moduleseven`) |
| 03 | Module Exam on Advanced C2 Communications (28 Oct 2026; the portal title reads "ommunications") | 35 | none | Module 5 Exam (`modulefive`) |
| 04 | Module Exam on Signal Support Integration (7 Oct 2026) | 40 | none | Module 4 Exam (`modulethree`) |
| 05 | Exam on Signal Support in Coalition Operations (7 Oct 2026) | 13 | Coalition (`coalition`) | Module 4 Exam |
| 06 | Exam on Signal Support in Joint Operations (5 Oct 2026) | 30 | Joint (`signaljoint`) | Module 4 Exam |
| 07 | Exam on Signal Support in Combined Arms Operations (3 Oct 2026) | 30 | Combined Arms (`signal`) | Module 4 Exam |
| 08 | Module Assessment 2 (2 Oct 2026) | 50 | none | Combined Practice Exam, Module 2 (`combined`) |
| 09 | Exam on ISR Operations (1 Oct 2026) | 22 | ISR (`isr`) | Combined Practice Exam |
| 10 | Exam on Introduction to Artillery Operations (1 Oct 2026) | 20 | Field Artillery (`fieldartillery`) | Combined Practice Exam |
| 11 | Exam on Army Operations (29 Sep 2026) | 20 | Army Operations (`armyops`) | Combined Practice Exam |
| 12 | Module Assessment 1 (26 Sep 2026) | 45 | none | Module 1 Exam (`moduleone`) |
| 13 | Exam on Military Leadership Attributes (23 Sep 2026) | 20 | Military Leadership Attributes (`leadershipattributes`) | Module 1 Exam |
| 14 | Diagnostic Examination, SOAC 52-2026 (19 Sep 2026) | 70 of 73 | none (mixed topics) | none: reviewer only |

Placement rules:
- A lesson exam goes on its lesson page and its module exam page.
- A module exam or module assessment goes on that module's exam page.
- Module Assessment 1 covers Module 1 leadership; Module Assessment 2 covers the Module 2 lessons (ISR, Armor,
  Field Artillery, Army Operations).
- Questions are not split between lessons. Keyword-based assignment of assessment questions to single lessons
  would be unreliable (for example, the fires effects in Module Assessment 2 are taught in both Field Artillery and
  Army Operations).
- The Diagnostic Examination spans every module, so it appears only on the reviewer and in the mixed set.
- Armor, the Module 3, Module 8 and the remaining Module 1/5/6/7 lesson pages have no graded exam of their own.
  Their module exam page carries the module's graded exam, where one exists.

On a page that draws on several exams, a question repeated with the same stem and key is asked once. For
example, Module Assessment 2 reuses Field Artillery items. A lesson page serves its whole Actual Exam bank. A
module exam page and the mixed set draw 50 at a time, unseen questions first. The mixed page also offers the
full set (441 distinct questions) in one sitting.

## Questions left out (4 of 488)

- Diagnostic Q71–Q73 are essays. The portal shows no answer key.
- EW module exam Q26: the export marks a garbled character in the stated frequency. The recorded key
  ("short-range, high-precision sensors and missile seekers", the K- to M-band role on the NATO band chart in
  `data/reviewer-figures.json`) contradicts the legible "9 GHz (I-band)". That band's role is tracking, fire control
  and surveillance. The correct frequency cannot be recovered without guessing, so the item is dropped.

## Text edits

Stems and keys are verbatim, with two exceptions:

- Removed the export's "[quote marks garbled in source]" and "[apostrophe garbled in source]" notes: Artillery Q1, 6,
  8, 10, 11, 13, 14 and 19, and Module Assessment 1 Q8, 27 and 43. The surrounding text already carried the
  intended quote marks and apostrophes.
- Collapsed repeated whitespace.

Exam titles are cleaned for display. `portalTitle` keeps the original wording.

## Multiple choice

The portal showed no answer choices, so the build makes each item multiple choice:

- **Choices:** the key plus three distractors taken from other questions' answer keys. Candidates are ranked by
  closeness: same exam first, then same module, then any exam. Within that order, candidates of the same answer
  type rank higher: short term, phrase, sentence or number, with similar length.
- **Seeded selection:** the build picks among the closest seven, seeded by the question's qid. The same data always
  builds identical pages.
- **Key position:** balanced across each exam's questions (each letter within one), in a seeded order.
- **Excluded distractors:**
  - near-duplicates of the key: case, plural or punctuation variants, an acronym, a subset of the key's words, or
    most words shared ("Signal Intelligence" and "Signals Intelligence (SIGINT)");
  - keys of questions whose stem is nearly the same.
- **Two-option items:** true/false keys get two choices. The current exams contain none.
- **Ordering:** the site keeps authored choice order and shuffles the question order. Unseen questions come first,
  as in every other mode.
- **Explanation:** each item states that the key is the recorded answer and where the other choices came from.

## Identity, citations and class history

- **qid:** `<examKey>-a-<NN>`, where NN is the question's number on the graded exam. Example: `gradedisr-a-07`.
  These ids are permanent. Exam keys: `gradedew`, `gradedcyber`, `gradedc2`, `gradedssi`, `gradedcoalition`,
  `gradedjoint`, `gradedcombined`, `gradedma2`, `gradedisr`, `gradedartillery`, `gradedarmyops`, `gradedma1`,
  `gradedmla`, `gradeddiag`.
- **Device progress:** keyed by graded exam (`mastery-quiz:progress:<examKey>:actual`), so the record is shared by
  every page that asks the exam.
- **Citations:** each question carries `source: { type: "graded-exam", exam, title, date, number }`. Feedback cites
  "SOAC 52-2026 graded exam: <title>, <date> · question N". It never cites a lesson slide or PDF page. Both the build
  and the engine reject any source type that is not listed.
- **Class history:** Actual Exam attempts are never sent. The live Apps Script (`apps-script/Code.gs` v7) accepts only
  `easy|medium|hard` and qids matching `[emh]`, and these pages never send it another mode. The reviewer pages are
  built with an empty endpoint and make no requests at all.

To record Actual Exam scores later, `Code.gs` would need:

1. `MODES` and `QID_PATTERN` extended to `actual` and `a`.
2. `validQid` to accept `<examKey>-a-NN` items. These belong to a graded exam, not to the page's lesson.
3. History tabs or `LESSONS` entries for the reviewer pages.

After redeploying, the engine's `finishQuiz` would post for `attempt.mode === 'actual'`.
