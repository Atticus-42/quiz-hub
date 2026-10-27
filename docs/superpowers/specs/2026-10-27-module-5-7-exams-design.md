# Module 5 and Module 7 practice examinations

The owner approved this design in conversation on 27 October 2026. Continue the previously selected native implementation workflow in the existing checkout. Publish both module examinations after verification; no Telegram announcement is requested.

## Intended result

Module 5 Advanced C2 Communications has 30 questions at each difficulty, ten primarily assessing each available lesson: MANET C4ISTAR Planning, Sensors Integration, and Weapon System Integration. Clearly describe its scope as the three available lessons. Module 7 Advanced Cyberspace Operations has 32 at each difficulty, eight primarily assessing each of NIST, Zero Trust, GSOMIA and Cyber Risk Assessment.

Easy checks concepts and straightforward application. Medium applies principles to organizational/classroom cases. Hard compares defensible decisions under stated constraints. Every difficulty combines foundation questions with new scenarios connecting lessons. Proposed implementation detail: half of each lesson share is selected from its existing bank, and half is newly authored, giving 90 Module 5 items and 96 Module 7 items. New scenarios still have one primary lesson for clear lesson-level results, while their explanations identify the supporting lessons.

Every question has four distinct choices, one justified answer and identifiable source pages/slides. Results show overall score, a breakdown by lesson, explanations and references. Existing shuffle, keyboard controls, mistake retries and mobile layout remain in use. Existing lesson quizzes, identifiers, history and schedules remain unchanged. Unsupported lessons have no placeholders.

## Approaches

A straight pool would cheaply reuse the current individual banks but add no new synthesis questions. Entirely new banks would provide fresh material but lose familiar foundations and duplicate more authoring. The approved hybrid combines selected foundations and new integrated scenarios. Dedicated module banks fit the existing engine without a new sampling framework; each attempt serves its complete difficulty bank in shuffled order, preserving exact lesson shares.

## Implementation decisions

Use keys `modulefive` and `moduleseven`, routes `/module-5-exam/` and `/module-7-exam/`, prominent cards at order zero, and new history tabs `Module 5 Exam History` and `Module 7 Exam History`. New module question IDs keep statistics separate from individual lesson practice. Record foundation provenance in coverage documents. Use existing optional `sourceRef` behavior: multi-lesson source citations are explicit text in explanations, as the existing pooled exams already do. No engine schema or new dependency is needed.

The source lessons determine supported claims. Do not invent equipment performance, real deployment parameters, classified details, agreement terms or missing procedures. These quizzes assess instructional concepts and stated evidence, not practical qualification or psychometric validity.

## Acceptance and stopping point

All six banks have the approved counts and exact primary-lesson shares; foundation/scenario split is equal; every primary lesson appears in each difficulty. New scenarios meaningfully connect at least two supported sources. Keys are balanced and avoid systematic answer-length cues. Both exams complete through results and review on laptop and mobile, with citations and lesson breakdowns. Add the two history keys without renaming existing tabs, deploy the additive registry, then publish and verify the live pages. Stop once these conditions hold.
