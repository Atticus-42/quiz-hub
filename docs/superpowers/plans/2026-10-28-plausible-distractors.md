# Plausible Distractors Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans under the owner's previously selected native workflow. Owner approved this plan on 28 October 2026. Use one independent final review.

**Goal:** Improve weak exam choices without changing the assessed knowledge or introducing ambiguous keys.

**Architecture:** Revise authored JSON banks at their existing lesson boundary, propagate foundation copies using coverage.json, and rebuild existing pooled/generated pages. No engine/schema/history change.

**Tech Stack:** Existing JSON question banks, Node build/tests, browser smoke.

**Spec:** `docs/superpowers/specs/2026-10-28-plausible-distractors-design.md`.

## Global constraints

- All 21 exams are in approved scope; retain counts, qids, categories, references and keyed concepts.
- Exactly one defensible best answer per item; all four alternatives remain distinct.
- Preserve Easy/Medium/Hard differences and all existing history and routes.
- No external announcements, scheduling or unrelated code changes.

## Review focus

- A more plausible alternative accidentally becomes correct: review the stem, key and all four choices together against the source.
- A distractor states an unsupported technical detail: prefer source-grounded conceptual confusions, verify any new factual distinction.
- Several choices overlap: sharpen the question's decision criterion rather than rely on examiner intent.
- Foundation copies drift: assert provenance equality after propagation; automatic pools rebuild from originals.
- Surface cue reduction masquerades as quality: inspect actual changed items, not just length/keyword statistics.

## Task 1: Revise the weak authored items

**Files:** `lessons/<key>/{easy,medium,hard}.json` for 17 source lessons and the two standalone module exam banks.

- [x] Capture the pre-edit counts, identities, keyed concepts and provenance. Run existing tests as a baseline.
- [x] Review screened candidates in each bank/mode, retaining sound choices. Rewrite wrong options as same-domain, parallel and genuinely plausible alternatives.
- [x] Minimally clarify stems with overlapping answers, checking source support before retaining the key.
- [x] Record changed qids and why each revision removes a cue without creating ambiguity.

## Task 2: Preserve consistency and verify

**Files:** Module 5/7 stored foundations; focused quality/provenance regression checks and audit report.

- [x] Add failing checks for targeted confirmed defects and preservation contracts before revising those items.
- [x] Synchronize foundation copies by support qid while preserving each module's question identity and answer position.
- [x] Confirm counts, objective coverage, distinct alternatives, balanced positions, source references and all keyed concepts.
- [x] Run `node scripts/build.mjs`, `node scripts/verify.mjs`, and the applicable browser checks with live history disabled.

## Task 3: Review and publish

- [x] Independently review the actual changed questions, including all alternatives and source boundaries; fix actionable findings.
- [x] Confirm no schedule, history, engine behavior or unrelated user-file changes.
- [ ] Commit the scoped changes, push through the existing publication workflow and verify live pages.

Stop after verified publication. State the number revised rather than implying that heuristic screening equals complete manual validation.
