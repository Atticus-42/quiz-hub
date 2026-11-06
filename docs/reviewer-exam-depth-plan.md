# Reviewer and quiz source alignment

User requirements: substantially deeper online Reviewer 101 guides, objective and analytical/situational study, Philippine Army classroom context. Exclude instructor profiles and classroom rules. Quiz facts and decisions must be grounded in supplied teaching slides/handouts/lessons, never reference-only additions. PAM 6-0102 is explicitly confirmed as the assigned teaching handout for Signal Estimate and Signal Planning Process. References named by lessons come first; very relevant supplementary manuals may remain clearly labeled further reading and cannot become quiz scope.

Implementation: three independent content groups own their corresponding reviewer JSON and lesson banks, plus authored module banks in their group. Preserve question IDs, balanced options, 20–35 per difficulty, single-best answers and category coverage. Replace unsupported questions with supported questions, maintaining analytical difficulty. Do not publish raw restricted source files.

Schema addition on every reviewer: examGuide { topics: [{title, explanation, remember: [strings], trap, pages: [integers]}], practice: [{type: "objective"|"analytical", question, answer, reasoning, pages:[integers]}], checklist:[strings] }. Aim for 4–8 substantial topics mapped to the lesson categories, 5–8 practice items with both types, and clear explanations rather than compressed notes or bank dumping. Use source pages for all added teaching points. Retain and improve existing brief/facts/insights/scenario/steps/checks.

Tasks:
1. Leadership/planning content and related module exam source audit.
2. Signal/C2 content and related module exams source audit.
3. Cyber/signal-planning content and module exam source audit.
4. Shared detailed-review rendering, practice disclosures, source links, prominent Reviewer 101 controls on exam pages.
5. Cross-check all coverage and references, run build/content/UI checks, publish to existing Pages site and verify.

Work in the existing isolated course-coverage-expansion branch. No Telegram messages. Preserve unrelated untracked outputs.
