# Exam-style coverage for lessons without a graded exam (design note)

Date: 2026-11-22

## Intent
27 POI lessons have no graded exam of their own, so students cannot practise them the way the real graded exams ask. Provide exam-style question sets for them, modelled on the 534 real graded questions in `data/actual-exams.json`: direct recall of the lesson's own wording, short stems, term/definition keys, sibling-term distractors.

## Options considered
- A (chosen by the user): add a new exam-style set per lesson, leave existing banks untouched.
- B: rewrite the existing easy/medium/hard banks in exam style (rejected: large churn, loses the situational practice).
- C: shorten only the 81 questions that are too long (rejected: does not give the real-exam mix).

## Data
`data/exam-style/<lessonKey>.json`, one per lesson (27 files, 11-15 questions each, 353 total):

    {"lesson","title","source","questions":[{"n","stem","key","distractors":[3],"explanation","why":[3],"pattern","ref"}]}

`pattern` is one of defines | definition | scenario | list | not, approximating the real exam mix (about 35/20/25/10/5-10).
Keys use the handout wording; distractors are same-lesson sibling terms. Every set is grounded in the lesson handout, coverage notes, banks and reviewers; thin lessons got fewer questions rather than invented doctrine.

## Use
- The Topic coverage set draws from these files.
- The 20 Reviewer slots of the comprehensive Mixed set draw from them.
- Lesson pages keep their existing banks; these files are not shown there.
- Wiring is done separately; no engine/build code changed here.
