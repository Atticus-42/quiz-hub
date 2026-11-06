# Electronic Intelligence (ELINT) coverage

Source basis: the 25-slide deck **Electronic Intelligence (ELINT)**, dated 3 Nov 2026, Signal School, whose doctrinal basis is PAM 3-0702-01 Electronic Warfare Operations (Sep 2026). Slide numbers below refer to that deck (PDF page numbers). No additional factual source was introduced; the questions use only the deck's own terms, worked examples and fictional records.

This standalone lesson is POI 6.2 and has 20 easy, 20 medium, and 20 hard questions (60 in total). All scenarios are fictional Philippine Army classroom, Signal School, Camp O'Donnell or northern Luzon coast exercises with non-sensitive, simulated information. No real person or instructor is named, and no real equipment performance is asserted.

## Category map

The category order is fixed as follows. Every category appears in every difficulty.

| Category | Items per bank (easy / medium / hard) | Taught content assessed | Source slides |
| --- | :---: | --- | --- |
| ELINT Foundations and Doctrine | 3 / 3 / 3 | The PAM 3-0702-01 definition of ELINT as a SIGINT sub-discipline for non-communication signals; why a radar can be found and why found radars become targets (including the Zoopark-1 example); the EW and SIGINT arms and the ES, EA and EP roles; the three key takeaways | 5–8, 10, 23–24 |
| ELINT, COMINT and ES | 3 / 3 / 3 | COMINT listens to operators and ELINT to hardware; their signals, skills and questions; ES as the commander's backup camera versus ELINT as the intelligence black-box recorder; same receiver, different tasking and product | 4, 6–8, 18 |
| Electronic Order of Battle | 2 / 2 / 2 | Friendly, Adversary and Neutral EOBs, what each catalogues and what each is used for; ELINT's main job of filling and updating the Adversary EOB | 9, 22, 24 |
| Radar Principles and the One-Way Advantage | 3 / 3 / 3 | Reading the waterfall (steady line, irregular bursts, wideband bursts, evenly spaced hits); pulse out, echo back, time equals range, the 100 µs and 15 km worked example; the one-way advantage and the signatures a passive site can still give | 4, 10–11 |
| Radar Parameters and Bands | 4 / 3 / 3 | Fingerprint parameters (Ft, scan, PW, beamwidth, PRI/PRF, polarization, modulation and bandwidth); PRF = 1 ÷ PRI with PRI 1 ms giving 1 kHz; effects of long PRI and of long or short PW; NATO bands, typical uses and the caveat that range does not follow band letter | 12–14, 16–17, 20, 24 |
| Scan, Intent and Ground Emitters | 3 / 3 / 3 | Circular, sector and track scans; beamwidth; search versus track and the signs of a switch; reporting an emitter that switches immediately; the five ground emitter types and the three questions asked of each; the class intercept log | 15–16, 18–19, 21, 24 |
| Process, Signature Library and Effect | 2 / 3 / 3 | The five-step ES and ELINT process; signature-library records, validate and share; the intercept-to-effect chain, "Don't jam what you collect", and the SEAD air-asset example linked to the targeting board | 7, 19–20, 22 |

Easy items recognise a definition, term or one neighbouring concept. Medium items apply a principle to a short case or to a closely related alternative. Hard items compare defensible decisions or interpretations under stated constraints, always with exactly one best answer drawn from the slides. Across the lesson 32 of the 60 items are situational scenarios and 28 are objective items (easy 9 situational / 11 objective, medium 10 / 10, hard 13 / 7). Tags record each item's type. No item asks for a practical interception, jamming, targeting or fix-plotting procedure.

## Source boundaries and exclusions

- **Slide 14 printed formula.** The slide prints "Average power = Peak power × PW × PRI". That is a printed error: average power is peak power × PW × PRF, and the slide's own worked example (100 kW × 1 µs × 1 ms = 100 W) is consistent only with a PRF of 1 kHz. The formula's literal wording is deliberately not tested and the omission is intentional. The related ideas that are consistent and are tested are PRF = 1 ÷ PRI (slide 13; PRI 1 ms is PRF 1 kHz, slide 24 and the 1,000 µs / 1 kHz record on slide 20), that a long PRI gives a greater maximum unambiguous range, and the PW trade-offs. The "PRI 1 ms is about 150 km" rule of thumb appears only as a distractor value in a range question.
- **Slides 1–3.** Slide 1 is the title, slide 2 the lesson overview and objectives, and slide 3 the ice-breaker question. They fall outside the citable range of slides 4–24, so the waterfall ice breaker is cited through its answer slide 4. The objectives are covered by the category map above.
- **Slide 21 class exercise.** The Coastal ES Team scenario is a fictional class exercise whose slide prints questions but no answers. The band (9.41 GHz in I-band, slide 17), the search-to-track reading of the change at 0312H (slide 16) and immediate reporting (slide 16) are applied from the printed slide content, not from a printed answer key.
- **Slide 24 check on learning.** Its five questions are reused as objective items: the two SIGINT sub-disciplines, ES versus ELINT, PRI 1 ms giving PRF 1 kHz, two signs of search turning to track, and the three EOBs. The unprinted answer to question 3 is limited to the printed "about 150 km" rule of thumb and is not examined numerically.
- **Slide 20 record.** The example record is fictional. Its values are used only as fictional exercise data; confidence, assessed-system and fix-grid fields are not treated as doctrine.
- **Slide 22 SEAD.** The air-asset SEAD example is tested only as a concept (ELINT locates radars, then jam or strike so friendly aircraft can operate; ES data feeds the targeting board). No jamming or targeting method is taught or tested.
- **Slide 17 bands.** Band lookups use the printed GHz ranges and the typical uses only, with the slide's caveat that range depends on power, antenna and target, not on the band letter. Frequencies are chosen well inside a band to avoid boundary conventions.
- **Slide 25** closes the deck and falls outside the cited range.
- The slide 5 Ukraine and Zoopark-1 statement is used only as the slide's own "reports" illustration that found radars become targets.

## Authoring and audit record

Each bank uses sequential IDs 1–20, unique `elint-e-`, `elint-m-`, or `elint-h-` QIDs, four distinct options, zero-based answer indices, category and item-type tags, and source slides confined to 4–24. Explanations contain two sentences (38–71 words), name the slide or slides they rely on, and say why the closest distractor fails. Every explicit "Slide N" citation in an explanation is also listed in that item's `sourceSlides`.

Each bank's answer distribution is 5/5/5/5 for indices 0/1/2/3, with a different ordering in each bank. Options were written in parallel form from neighbouring concepts, swapped attributes and opposite rules of the same lesson, and were reviewed for absolute-word giveaways and for prompt wording that repeats the key.

| Bank | Correct uniquely shortest, characters | Correct uniquely longest, characters | Correct uniquely shortest, words | Correct uniquely longest, words |
| --- | ---: | ---: | ---: | ---: |
| Easy | 3 | 4 | 2 | 2 |
| Medium | 2 | 5 | 4 | 5 |
| Hard | 2 | 6 | 1 | 5 |

The independent audit checks counts, schema, category coverage in every bank, IDs and QIDs, option uniqueness, duplicate prompts, answer balance, both length extremes (each at or below 35% of a bank), explanation length and the match between cited slides and `sourceSlides`.
