# Unit Organization Implementation Plan

**Goal:** Publish the approved expandable organization trees under Library.
**Architecture:** Source-backed JSON records rendered as native HTML details trees through the existing study-page renderer. Scoped CSS, no dependencies or client script.
**Tech Stack:** Node, JSON, HTML, CSS.
**Spec:** docs/unit-organization-source-audit.md. User selected expandable organization tree.

## Constraints and review focus
Preserve restricted-file policy. Distinguish headcounts, unit quantities, attachments and unspecified officer/EP splits. Do not interpret unexplained chart notation as verified establishment. All source links have exact PDF pages. Mobile and keyboard operation must work without JavaScript.

## Tasks
- [x] Add source-data tests for file existence, page links, squad arithmetic, missing strength and restricted sources. Observe initial failure.
- [x] Add data/unit-organizations.json and scripts/unit-organizations.mjs. Render named branches, role cards and evidence notes. Link from Library and register generated page.
- [x] Add scoped styling, build, run focused tests, full verification and desktop/mobile browser checks.
- [ ] Review final diff, publish existing authorized site change and confirm live content.

## Decisions
The scout diagram has no explicit officer/EP legend on the inspected slide. Preserve its raw notation and mark that split unverified, rather than introducing a guessed total. Only aggregate explicitly counted persons. Use source-edition diagrams rather than claiming current unit strengths.

## Verification
Full suite: 2,560 passed. Focused source tests: 4 passed after review fixes. Chrome: 320, 390, 768 and 1440px, all branches expanded, no horizontal overflow, Enter toggles verified, Library entry works. Review corrected Team A-only marksman placement and added the explicit 2022 x11 Signal Battalion quantity. Role links use the source allowlist.
