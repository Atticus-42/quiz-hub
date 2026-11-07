# Signal How To source audit

Verified on 7 November 2026. This replaces the earlier general study-task directory with equipment-specific signal procedures.

The source collections are the two Drive folders supplied by the user:
- https://drive.google.com/drive/folders/1fi3UzCAK0FSvetpg5LlOmIIjWNMJ-UxV
- https://drive.google.com/drive/folders/15IGCS1ktT9nyeWE3VWBtPpblXRviCQU_

The published PDFs are selected procedure excerpts, not complete manuals. Original page/slide numbers are shown in the guide; PDF fragments use the physical page in the excerpt. PPTX files were exported with PowerPoint and physical slide order preserved. Every excerpt page was checked against the corresponding original text (normalizing one font-specific square bullet).

| Source | Original pages/slides, in excerpt order | Hosted excerpt |
|---|---|---|
| Retransmit, SMVRS Operation – Handout — procedure excerpt | 11, 12, 13, 14, 15, 16, 24 | [signal-howto-retransmit](../library/files/signal-howto-retransmit.pdf) |
| Fixed Frequency Programming – Handout — procedure excerpt | 5, 10, 12, 13, 14, 15, 19, 24, 25, 32 | [signal-howto-rf5800h-fixed](../library/files/signal-howto-rf5800h-fixed.pdf) |
| Installation of USB to Serial Cable, NRDI, IP Configuration of PC – Handout — procedure excerpt | 12, 22, 26, 28, 29, 30, 34, 35, 36, 37, 40 | [signal-howto-usb-rndis](../library/files/signal-howto-usb-rndis.pdf) |
| Configuration of Tactical Chat – Handout — procedure excerpt | 14, 24, 25, 26, 37, 38, 39, 40, 41 | [signal-howto-tactical-chat](../library/files/signal-howto-tactical-chat.pdf) |
| Philippine Space Agency – Signal Propagation Mapping — procedure excerpt | 27, 28, 38, 39, 40, 41, 55, 56 | [signal-howto-philas-radio-mobile](../library/files/signal-howto-philas-radio-mobile.pdf) |
| Radio Telephone Procedures – Handout — procedure excerpt | 13, 14, 17, 24, 25, 26 | [signal-howto-radio-telephone](../library/files/signal-howto-radio-telephone.pdf) |
| Antenna Types and Systems — BOLC handout — procedure excerpt | 25 | [signal-howto-antenna-types](../library/files/signal-howto-antenna-types.pdf) |

## Interpretation and boundaries

- The retransmit guide applies specifically to two RF-5800V-HH radios and cable 12011-0230-A050. General settings and firmware-dependent ON-SYNC/ON-ASYNC choices follow source slides 15–16. The schematic is a single test direction, not a duplex wiring diagram.
- The RF-5800H-MP guide programs assigned channel values; it does not distribute channel plans or keys.
- USB/RNDIS and Tactical Chat sources differ in the ordering of ADDRESS and ETHERNET menu entries. The guide names the labels without inventing one universal ordering.
- Tactical Chat is radio data messaging, not RoIP voice. No model-specific RoIP gateway procedure was found in the supplied instructional material; the directory states this gap.
- Radio Mobile steps follow the supplied PhilSA training walkthrough; modeled paths still require field verification.
- The dipole calculator uses physical half-wave length 468/f feet, with each arm 234/f and conversion 0.3048 metres/foot. It is an initial estimate, not a tuning or installation certificate.
- Instructor biographies, classroom rules, administrative records, example military repeater locations in other slides, and key/configuration files were not included in the published excerpts. The retained slides may contain illustrative training values; guides tell personnel to use their assigned settings.

## Verification

- Existing gate: all 2,557 checks passed.
- Signal browser suite: 32 viewport/page combinations, filters, source links, reduced motion, animation, storage/reset, print, no-JavaScript, and dipole examples.
- LOS page download/release behavior remains covered by the resources browser suite.
