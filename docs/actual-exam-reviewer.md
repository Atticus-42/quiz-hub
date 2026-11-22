# Actual Exam category and the Comprehensive Exam Reviewer

Questions from the class's 15 graded exams (SOAC 52-2026), plus lesson-bank questions covering every numbered POI lesson without its own graded lesson exam.

## Comprehensive topic coverage

Only `comprehensive-reviewer/all/` combines the two sources. Individual graded-exam pages are unchanged.

- **Mixed set:** 50 questions: 30 Actual Exam questions and 20 Reviewer questions. Reviewer lessons are selected round-robin, one question per topic before revisiting a topic. The next topic cursor is stored on this device after the first answer, including abandoned sets; untouched draws do not advance it. All 27 no-exam lessons are reachable within `ceil(27 / 20) = 2` consecutive activated sets. Final question order is shuffled.
- **Full set:** all 491 distinct Actual Exam questions only.
- **Topic coverage set:** 81 Reviewer questions, three medium/hard questions from each of the 27 no-exam lessons, in one sitting. Retakes keep the selected kind of set.
- Reviewer selection uses all difficulties in Mixed sets: unseen first, then missed, then seen, preferring medium/hard within each priority group. Coverage sets use medium/hard only. Each question keeps its original explanation and any rationales, and displays `Reviewer question · <Lesson title> (no graded exam)` rather than Actual Exam.
- Reviewer qids are the original lesson qids. Progress reads and writes `mastery-quiz:progress:<lessonKey>:<difficulty>`, shared with lesson pages. Activating a set marks its reviewer questions seen; checking an answer updates the lesson's seen/missed flag. Reset on the mixed page also clears these shared records and the topic cursor. With storage unavailable, quizzes still run but rotation/progress cannot survive reload.
- All three kinds of attempts save under `lesson: "gradedall", mode: "actual"`; item provenance does not change the attempt's history filter. Reviewer item ids keep their lesson and difficulty (`<lessonKey>:<difficulty>:<qid>`). The existing v8 endpoint still saves scores; its graded-only item validator skips item analysis for mixed/coverage payloads until updated to accept reviewer identities.

**Graded lesson exams (Actual only):** Coalition (`coalition`); Signal Support in Joint Operations (`signaljoint`); Signal Support in Combined Arms Operations (`signal`); ISR (`isr`); Field Artillery (`fieldartillery`); Army Operations (`armyops`); Military Leadership Attributes (`leadershipattributes`). The Actual bank also includes graded module exams/assessments for Modules 1, 2, 4, 5, 6, 7 and 8, and the Diagnostic Examination (listed below).

**Reviewer banks, no graded lesson exam (27):**

- Military Leadership Competencies (`leadershipcompetencies`)
- Company Management (`companymanagement`)
- Mission Command (`missioncommand`)
- Ethical and Transformational Leadership (`ethicalleadership`)
- NCO Empowerment (`ncoempowerment`)
- Effective Communication 2 (`effectivecommunication`)
- Armor Operations (`armor`)
- Troop Leading Procedure (`tlp`)
- Military Decision-Making Process (`mdmp`)
- MANET C4ISTAR Planning (`manet`)
- C4ISTAR Sensors Integration (`sensors`)
- C4ISTAR Weapon System Integration (`weapons`)
- Signal Propagation (`propagation`)
- Signals Intelligence (`sigint`)
- Electronic Intelligence (`elint`)
- Radio Direction Finding (`rdf`)
- Electronic Counter-Countermeasures (`eccm`)
- NIST Framework (`nist`)
- Zero Trust (`zerotrust`)
- LOE3 GSOMIA Compliance (`gsomia`)
- Cyber Risk Assessment (`cyberrisk`)
- CEOI / CESI Management (`ceoicesi`)
- Signal Estimate (`signalestimate`)
- Voice Communications Planning (`voicecomms`)
- Data Communications Planning (`datacomms`)
- C4ISTAR Communications Planning (`c4istarplanning`)
- Signal Planning Process (`signalplanning`)

The reviewer list is derived from `lesson.json` membership in Modules 1–8, excluding graded lesson owners, module/combined exam pages, pools and templates. Supporting Lessons (`supplemental`, including `intcycle`) supply no reviewer questions. Army Operations remains available through its existing graded exam only.

- Data: `data/actual-exams.json`. Each question has `n` (its number on the graded exam), `stem`, `key`, three hand-chosen `distractors`
  (none for true/false keys), an `explanation` of why the key is right and `why`, one line per distractor saying why
  it is wrong (in distractor order).
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
| 01 | Module Exam on Signal Planning (13 Nov 2026) | 50 | none | Module 8 Exam (`moduleeight`) |
| 02 | Module Exam on Advanced Electronic Warfare Operations (12 Nov 2026) | 49 of 50 | none | Module 6 Exam (`modulesix`) |
| 03 | Module Exam on Advanced Cyberspace Operations (30 Oct 2026) | 40 | none | Module 7 Exam (`moduleseven`) |
| 04 | Module Exam on Advanced C2 Communications (28 Oct 2026; the portal title reads "ommunications") | 35 | none | Module 5 Exam (`modulefive`) |
| 05 | Module Exam on Signal Support Integration (7 Oct 2026) | 40 | none | Module 4 Exam (`modulethree`) |
| 06 | Exam on Signal Support in Coalition Operations (7 Oct 2026) | 13 | Coalition (`coalition`) | Module 4 Exam |
| 07 | Exam on Signal Support in Joint Operations (5 Oct 2026) | 30 | Joint (`signaljoint`) | Module 4 Exam |
| 08 | Exam on Signal Support in Combined Arms Operations (3 Oct 2026) | 30 | Combined Arms (`signal`) | Module 4 Exam |
| 09 | Module Assessment 2 (2 Oct 2026) | 50 | none | Combined Practice Exam, Module 2 (`combined`) |
| 10 | Exam on ISR Operations (1 Oct 2026) | 22 | ISR (`isr`) | Combined Practice Exam |
| 11 | Exam on Introduction to Artillery Operations (1 Oct 2026) | 20 | Field Artillery (`fieldartillery`) | Combined Practice Exam |
| 12 | Exam on Army Operations (29 Sep 2026) | 20 | Army Operations (`armyops`) | Combined Practice Exam |
| 13 | Module Assessment 1 (26 Sep 2026) | 45 | none | Module 1 Exam (`moduleone`) |
| 14 | Exam on Military Leadership Attributes (23 Sep 2026) | 20 | Military Leadership Attributes (`leadershipattributes`) | Module 1 Exam |
| 15 | Diagnostic Examination, SOAC 52-2026 (19 Sep 2026) | 70 of 73 | none (mixed topics) | none: reviewer only |

Placement rules:
- A lesson exam goes on its lesson page and its module exam page.
- A module exam or module assessment goes on that module's exam page.
- Module Assessment 1 covers Module 1 leadership; Module Assessment 2 covers the Module 2 lessons (ISR, Armor,
  Field Artillery, Army Operations).
- Questions are not split between lessons. Keyword-based assignment of assessment questions to single lessons
  would be unreliable (for example, the fires effects in Module Assessment 2 are taught in both Field Artillery and
  Army Operations).
- The Diagnostic Examination spans every module, so it appears only on the reviewer and in the mixed set.
- Armor, the Module 3 lesson pages and the remaining Module 1/5/6/7/8 lesson pages have no graded exam of their own.
  Their module exam page carries the module's graded exam, where one exists.

On a page that draws on several exams, a question repeated with the same stem and key is asked once. For
example, Module Assessment 2 reuses Field Artillery items. A lesson page serves its whole Actual Exam bank. A
module exam page draws up to 50 Actual questions at a time, unseen questions first. The mixed page offers the
three sets described above, including the full Actual bank (491 distinct questions) in one sitting.

## Questions left out (4 of 538)

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

The portal showed no answer choices, so every item is made multiple choice from stored data:

- **Choices:** the key plus the question's three stored `distractors`: same kind as the key, drawn from the same
  exam's keys or the lesson material when they fit and clearly wrong, otherwise authored. No choice is pulled from an
  unrelated question. True/false keys get two choices (the current exams contain none).
- **Seeded order:** the three distractors are shuffled by the question's qid and the key goes in a position balanced
  across each exam's questions. The same data always builds identical pages.
- **Feedback:** the Note holds the `explanation`; an "Other choices" list gives each wrong option with its `why`
  line (the built question carries `rationales`, parallel to `options`, `null` for the answer); References still cite
  the graded exam and question number.
- **Grounding:** explanations were written from the course material (lessons, reviewers, field manuals and PAMs in
  `library/files`, and the lesson banks). Where no source could be found, a careful general-knowledge explanation was
  used. The data keeps the recorded keys unchanged, including ones that look contestable.
- **Duplicates:** an identical stem and key reused in another exam carries the same text in each exam.
- **Ordering:** the site keeps the built choice order and shuffles the question order. Unseen questions come first.
- **Tests:** every question must have an explanation, one `why` line per distractor, and distractors distinct from the
  key and from each other.

## Identity, citations and class history

- **qid:** `<examKey>-a-<NN>`, where NN is the question's number on the graded exam. Example: `gradedisr-a-07`.
  These ids are permanent. Exam keys: `gradedsigplan`, `gradedew`, `gradedcyber`, `gradedc2`, `gradedssi`, `gradedcoalition`,
  `gradedjoint`, `gradedcombined`, `gradedma2`, `gradedisr`, `gradedartillery`, `gradedarmyops`, `gradedma1`,
  `gradedmla`, `gradeddiag`.
- **Actual device progress:** keyed by graded exam (`mastery-quiz:progress:<examKey>:actual`), so the record is shared by
  every page that asks the exam.
- **Actual citations:** each graded question carries `source: { type: "graded-exam", exam, title, date, number }`. Feedback cites
  "SOAC 52-2026 graded exam: <title>, <date> · question N". It never cites a lesson slide or PDF page. Both the build
  and the engine reject any source type that is not listed in the Actual bank. Reviewer items use a separate bank with `source.type: "reviewer-bank"` and their own lesson provenance.
- **Class history:** Actual Exam attempts post to the same Apps Script endpoint as Easy/Medium/Hard, with
  `mode: "actual"`. Lesson and module pages post under their own key; each reviewer page posts under its graded
  exam key (`gradedisr`, ...) and the mixed set under `gradedall`. Item ids are `<examKey>:actual:<examKey>-a-NN`.
  This needs `apps-script/Code.gs` v8 or later (`MODES` and `QID_PATTERN` accept `actual` and `a`; `LESSONS` has a
  tab per reviewer key). The history view has an Actual Exam filter; reviewer pages show only All and Actual Exam.
  After deploying, check `?action=history&lesson=gradedall&limit=1` returns `ok:true`.
