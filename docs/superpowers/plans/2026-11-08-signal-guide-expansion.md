# Signal guide expansion

Continue the established task-based How To design. Add three complete, source-backed guides: RF-5800V net programming, RF-5800V scan configuration, and conventional repeater frequency/tone checks. Keep categories stable and use separate schematics so the HF programming diagram is never presented as a VHF menu path.

1. Extract the applicable instructional PDF pages without classroom/admin material; preserve original-page mappings in data/howto-sources.json.
2. Add task prerequisites, ordered steps, checks, troubleshooting, and completion conditions to data/howto.json. Distinguish assigned settings from example values and identify the scan slide's duplicated Hold Time wording.
3. Add dedicated net-manager, scan-cycle and repeater-pair SVG schematics in scripts/signal-howto.mjs. Reuse existing accessible animation and checklist controls.
4. Update the browser catalogue expectations; build, verify source page equivalence, run the full catalogue gate and mobile/desktop browser checks. Inspect rendered sources and guide screenshots.
5. Publish the tested changes and verify live pages. CPA/7800V source candidates remain outside this release until version assumptions and source excerpts are reviewed.
