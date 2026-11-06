# Electronic Counter-Countermeasures (ECCM) coverage

Source basis: the 26-page deck **Electronic Counter-Countermeasures (ECCM) — Electronic Protection for the soldier** (3 Nov 2026, Signal School). Slide numbers below are the deck page numbers. The doctrinal basis named in the deck is PAM 3-0702-01 *Electronic Warfare Operations* (Sep 2026), with FM 3-12 (2025) Table 3-1 for the EMCON levels. No other source and no outside doctrine, figures or equipment performance were introduced.

This standalone lesson (POI 6.4) has 22 easy, 22 medium and 22 hard questions (66 in total). About half of each bank is situational (a short, fictional Philippine Army field or classroom scenario that paraphrases one idea) and about half is objective (definitions, purposes, lists, numbers, acronyms, levels). The lesson is defensive: it tests the protective measures, EMCON levels, recognition tests, reporting and PACE as written, and nothing about how to build or operate a jammer.

## Category map

The category order is fixed as in `lesson.json`. Every category appears in every difficulty.

| Category | Items per bank (easy / medium / hard) | Taught content assessed | Source slides |
| --- | :---: | --- | --- |
| EP Purpose and the ECM Duel | 3 / 3 / 3 | ECM now Electronic Attack and ECCM now Electronic Protection; the PAM 3-0702-01 statement of what EP safeguards; the five EP measures of para 0110; EP as the task of every unit; the example duel (spot jamming, hopping, barrage jamming, lower power, masking, PACE); the news examples | 5, 6, 7, 14, 24, 25 (also 9, 10) |
| Enemy Questions and Radio Discipline | 3 / 2 / 3 | The three questions the enemy asks (find, jam, read) and the EP answer to each; the radio-discipline rules (lowest power that works, short transmissions, transmit only when needed, directional antennas, smart antenna placement, vary your routine) | 8, 9, 10 |
| Masking, Blending and Emission Risk | 3 / 3 / 3 | Terrain masking, reverse slope and hilltop risk, camouflage nets on directional antennas; blending in with local spectrum users; home-on-jam; the Ukraine lessons (static emissions get hit, DF leads to fires, blending works) | 9, 10, 11, 14, 21, 22, 23 |
| EMCON Levels | 3 / 3 / 3 | EMCON as emission control; levels 1 GREEN to 5 BLACK with the condition and measures of each; EMCON 3 AMBER as the field baseline; unencrypted systems off at level 3; rehearsing movement between levels | 7, 12, 25 |
| Hopping, Encryption and Anti-Jam | 2 / 3 / 3 | Frequency hopping, error correction and the 6-of-40 illustration; spread spectrum; hop and secure modes on PA tactical radios; what encryption protects versus what anti-jam protects | 13, 14, 25 |
| Recognize, React and Report | 3 / 3 / 3 | The four possible causes of sudden static; signs of jamming; the antenna-disconnect and move-or-turn quick test; the four reaction steps; the seven lines of the generic interference report and how it is sent | 4, 15, 16, 17 |
| PACE and GPS Protection | 2 / 2 / 2 | The PACE letters and example plan, the trigger and rehearsal; jamming versus spoofing, spoofing red flags, cross-checks and reporting, CRPA antennas | 18, 19 |
| Hardening, Compatibility and Sensor ECCM | 3 / 3 / 2 | Hardening (shielding, filtering, grounding) and its setup checks; compatibility and spectrum management (separate antennas, assigned frequencies, C-RCIED jammers and the convoy net); radar examples: frequency agility, pulse compression, sidelobe blanking, low-probability-of-intercept | 20, 21 |

Easy items recognise a definition, term or one neighbouring concept. Medium items apply a principle to a short case. Hard items compare defensible decisions or interpretations under stated constraints, always with exactly one best answer drawn from the slides.

## Source boundaries and exclusions

- Slides 1–3 are the title, the lesson overview and the ice breaker, so they are outside the 4–25 citation range. Slide 3 has blanks for the learner to complete; slide 4 gives the answer set (enemy jamming, friendly interference, equipment fault, terrain and distance). Items on that content cite slide 4. The terminal and enabling learning objectives on slide 2 are not tested as separate facts.
- Slide 5 contains news examples (the February 2024 West Philippine Sea report of jamming, airport GNSS loss and the CAAP reporting requirement, and the Ukraine finding). Only what the slide states is tested; no detail beyond the slide is added.
- Slide 17 states that no Philippine Army standard interference-report format exists yet, so the seven-line report (WHO, WHEN, WHERE, FREQUENCY / NET, WHAT, EFFECT, ACTIONS) is a generic training format, and the items present it as such.
- Slide 25 is the check on learning. Its questions are reused as objective items: question 1 (what EP safeguards, in medium), question 2 (why encryption alone does not stop jamming, in medium), question 3 (EMCON 3 AMBER as the field baseline, in easy) and question 4 (the antenna-disconnect quick test, in medium and hard, citing slide 15 where the test is given). Question 5 (an example PACE plan) is tested in medium and hard through slide 18.
- Slide 15 numbers the quick test as steps 1 and 3. The items test the two outcomes of the antenna test and the move-or-turn check as written and do not depend on the missing number.
- Slide 16 allows raising power briefly as one adjustment after recognising jamming and checking equipment, while slide 9 sets lowest power that works as the normal rule. No item keys raising power. Higher power appears only as a distractor in routine-report and siting items (where the normal rule applies) and as the step-3 adjustment inside a wrong-order option of the reaction-sequence item.
- Slides 21 and 22 explain the concepts with radar and air assets. Only the stated techniques (frequency agility, pulse compression, sidelobe blanking, low-probability-of-intercept) and the home-on-jam lesson are tested; no sensor or weapon performance is implied.
- Slide 26 closes the deck and falls outside the 4–25 citation range.
- Items may use the Harris radios and Combat Net Radio System named on slides 13 and 18 only in the way those slides do. The deck gives no figures for them, and none are invented.

## Authoring and audit record

Each bank uses sequential ids 1–22, unique `eccm-e-`, `eccm-m-` or `eccm-h-` qids, four distinct options, zero-based answer indices, a category, tags (lesson, category, situational or objective), and slide citations within 4–25. Every explanation has two sentences, names the slides, and says why the key is right and why the closest distractor is not. Every "Slide N" cited in an explanation appears in the item's `sourceSlides`. Wrong options are credible mistakes from the same lesson: neighbouring concepts, swapped attributes (for example encryption versus anti-jam, or measures of a different EMCON level), the opposite of a rule, or the measure that belongs to a different enemy question.

| Bank | Situational / objective | Answer positions 0 / 1 / 2 / 3 |
| --- | :---: | :---: |
| Easy | 12 / 10 | 6 / 5 / 6 / 5 |
| Medium | 11 / 11 | 5 / 6 / 5 / 6 |
| Hard | 12 / 10 | 6 / 6 / 5 / 5 |

Length cues were measured by characters and by words. The table counts the items where the correct option is the only longest or the only shortest; none exceeds the 35% limit (7 of 22).

| Bank | Uniquely shortest, characters | Uniquely longest, characters | Uniquely shortest, words | Uniquely longest, words |
| --- | ---: | ---: | ---: | ---: |
| Easy | 6 | 5 | 2 | 3 |
| Medium | 4 | 6 | 3 | 6 |
| Hard | 2 | 1 | 4 | 4 |

An independent audit script (not committed) checked counts, schema, category presence in every bank, ids and qids, option uniqueness, duplicate prompts, source range, answer balance, both length extremes by characters and by words, explanation length and sentence count, and that each cited slide is present in `sourceSlides`.
