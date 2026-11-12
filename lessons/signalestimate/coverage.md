# POI 8.2 coverage

**Primary reference:** Philippine Army Manual 6-0102, *Signal Operations*, 15 April 2022. PDF page 27 (printed page 18, paragraphs 0302–0303) explains the estimate and METAL. PDF page 44 (printed page 35, Annex A) gives the estimate format.

**Supplementary references** (lesson.json `sourceAlt` declares both, so a question cites either or both):

- *Signal Estimate* student handout, SOAC Subject 8.2 (8 pages; Library: `signal-estimate-handout`). Questions -21 to -28 in every mode cite it as `{ "ref": "signal-estimate-handout", "pages": [N] }`, N matching "Handout p. N" in the explanation. The quiz References block shows "Student handout · page N" and links that Library PDF page.
- *Signal Estimate* lesson slides, Signal School (58 slides, 16-hour lesson; Library: `signal-estimate-slides`, file `library/files/lesson-signal-estimate.pdf`, sha256 in `docs/lesson-pdf-sources.json`). Slide numbers equal PDF pages. Questions cite them as `{ "ref": "signal-estimate-slides", "pages": [N] }`, shown as "Lesson slides · slide N" with a link to that PDF page. The learning outcome (slide 5) is to determine the steps of the signal estimate in signal planning; slide 6 names PAM 6-0102 as the reference. No classification marking appears on any slide.

`sourceSlides` (PAM 6-0102) is kept only where the cited PAM page supports the content: METAL and para 0303 on PDF page 27, the Annex A headings on PDF page 44. It is omitted for 17 of the 24 handout questions (easy -21, -22, -25, -26, -27; medium -21, -22, -25 to -28; hard -21, -22, -25 to -28), whose content is handout or PAM 3-00 / PAM 3-0201 material, and for 8 of the 12 slide questions, whose content is the slides' worked example rather than the Annex A headings (easy -29, -32; medium -29, -30, -31; hard -29, -30, -31).

## Lesson slides (November 2026)

Added 4 questions per mode (qids -29 to -32; banks now 32 per mode, within the 35 cap). They test what the slides add beyond the PAM pages and the handout:

| qid | Slides | Content |
| --- | --- | --- |
| e-29 | 13 | The signal mission is based on the unit's mission and concept of operation |
| e-30 | 14, 21 (+ PAM 44) | Para II's four subparagraphs: area of operation, enemy situation, own situation, COAs |
| e-31 | 56 (+ PAM 44) | Means of Communication laid out as PACE |
| e-32 | 45–51 | Para IV compares each COA in an advantage/disadvantage table grouped by factor |
| m-29 | 23, 24 | Mindoro terrain: VHF dead spots, relay/repeater stations on key terrain, HF under the mountains |
| m-30 | 25, 26 | Weather: early-evening thunderstorms limit VHF; daytime heat affects HF via the ionosphere |
| m-31 | 49 | COA 5, total radio listening silence: deceives the enemy but no C2 |
| m-32 | 52, 58 (+ PAM 44) | The task list (implied and specific) is the commander's decision |
| h-29 | 46, 47 | COA 3 (cellular phones) versus COA 3a (messengers): distinct disadvantages |
| h-30 | 50, 51 | COA 6 (Harris radios, SMVRS) versus COA 7 (commercial radios): distinct disadvantages |
| h-31 | 49, 58 | The task list keeps radio silence only at set times and as the fallback without EW specialists |
| h-32 | 19 + handout 6 (+ PAM 44) | The slides' five-paragraph format against the handout's running estimate: Para II maps to running-estimate paragraphs 1 and 3 |

Existing easy questions whose content is on a slide now also cite it (wording, keys and qids unchanged): e-01 (slide 8), e-02 (9), e-04 to e-08 (10), e-09, e-10 (21), e-11, e-12 (39), e-13, e-14, e-16 (19), e-17 (52), e-18 (52, 56), e-19 (52, 58), e-20 (52, 57), e-22 (11, with handout p. 5).

**No contradictions found.** Slides 8 to 10 repeat PAM 6-0102 paras 0302–0303, and slides 19 to 58 follow the Annex A headings that the original questions use. Slides 11 and 12 give the same five steps as handout p. 5. Two slide errors are not tested: slide 5 cites "PAM 6-01202-3" for the PAM 6-0102 named on slide 6, and slide 37 lists the COA 3 listening-silence times as 0600H, 1200H and 0600H where slides 46, 47 and 58 give 0600H, 1200H and 1800H (questions use 1800H).

**Reviewer:** a new topic, "Five steps, five paragraphs" (PAM page 44, handout pages 5–6, slides 11–13 and 19), now holds the estimate-structure figure. The figure shows METAL and the five Annex A paragraphs I to V, each with the step it carries out. Slide content was added to the situation, comparison and decision topics. A new matrix figure sets out the slides' COA advantage and disadvantage table (slides 45–51), and a new analytical practice item covers timed radio silence (slides 49, 58). Topic, practice and figure source lines link the slide pages through their `alt` citations.

## Topics

| Topic | PDF pages | Handout pages | Slides | Questions, all modes (original + handout + slides) |
| --- | --- | --- | --- | --- |
| Estimate fundamentals and revision, five steps, facts and assumptions, screening criteria, running estimate, mission basis | 27, 44 | 3, 5 | 8–13 | 12 + 7 + 1 |
| METAL factors, METT-TC links, METAL versus MENTAL | 27, 44 | 4, 6 | 10 | 12 + 6 + 0 |
| Situation and opposing COA analysis; Para II subparagraphs; terrain and weather example; format correspondence | 44 | 6 | 14, 19, 21–26, 39 | 12 + 3 + 4 |
| Comparison of COAs, decision matrix, usual advantages and disadvantages, slide comparison tables | 27, 44 | 7 | 19, 45–51 | 12 + 5 + 4 |
| Decision and recommendations, PACE, task list as commander's decision | 27, 44 | 6, 7 | 49, 52–58 | 12 + 3 + 3 |

Each mode holds 32 questions: 20 original, 8 added from the handout and 4 added from the slides. Original questions and qids are untouched, and no qid was retired. The manual excerpt gives no scoring matrix, so the decision-matrix questions use only the handout's illustrative method (rank × weight, lowest total preferred) and say so in the prompt. The slides' Mindoro, Tarlac and unit details are a classroom example; questions test the estimate reasoning, not the place names or grid references.

**Gaps noted (not tested):** the handout's SOBC Subject 8.1 objectives, the Part V decision-matrix example beyond the tie rule, the Part VI exercise (BANTAY LINYA) and the Part VII worksheets. The slides' near-empty template pages (40–44, 53–55, 57), the enemy order of battle (slides 28–31) and the example's disposition, personnel and inventory details (slides 32–36) are not tested. Detailed signal-plan production is covered in POI 8.6.
