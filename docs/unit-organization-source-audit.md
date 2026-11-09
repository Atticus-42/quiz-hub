# Unit Organization — source audit and proposed design

Status: expandable tree selected by user and implemented. Validation and publication recorded in the implementation plan.

## Recommended experience

Add a prominent “Unit Organization” link within Library. Use the existing field-manual typography and crest. Show expandable, accessible formation trees with color-coded branches, roles and exact source-page links. Stack nodes vertically on phones. Offer a formation selector and an evidence panel. Keep this separate from lesson PDFs and exams.

Alternative: an illustrated catalogue with static diagrams. Simpler to scan but less useful for exploring company → platoon → section/squad relationships.

## Evidence found in existing public Library files

- PAM 6-0102, Signal Operations, PDF pages 16–17, printed pages 7–8: ASR organizational structure and subordinate-unit missions, figure 1.3 and paragraph 0130. Visual review confirms eleven Signal Battalions (x11) in the 2022 diagram. No personnel establishment for a signal platoon found in the inspected material. Show documented branches and roles with strength “Not specified”. Do not treat the 2022 structure as a verified current roster.
- PAM 3-0101-04, Infantry Company Operations, PDF pages 12–14, printed pages 1–3: company has a headquarters platoon and three rifle platoons. HQ platoon has command, anti-armor and mortar sections. Rifle platoon has platoon HQ and three rifle squads. Each rifle squad has nine personnel. Two four-person fire teams plus squad leader. The designated marksman is an existing squad member, not an additional billet. PDF pages 16–19 describe company leadership and specialist duties.
- Same Infantry manual: a medic is attached from the battalion medical platoon. Keep attachments distinct from organic composition. Headquarters machine-gun wording is ambiguous (“four machine gun crews” followed by two two-person crews); do not calculate an authoritative platoon total from that prose.
- Armor lesson, PDF page 58: scout platoon chart labels 1 and 19; platoon HQ labels 1 and 9. Interpret officer/EP notation only after confirming its legend or convention. Page 59 shows section leader, SL, and two sets of gunner, driver, scout and loader (ten depicted positions). Do not expand unexplained abbreviations speculatively.
- Field Artillery lesson, PDF page 37: signal platoon is organic to the FABn Headquarters and Headquarters Battery. This establishes a relationship, not a personnel total.

## Source discovery

Checked local lesson PDFs, the class folder and D:/MANUALS filenames. Existing Drive inventory identifies Signal Operations (1u5wEYgGU4o7_NI4Jm6rZmm12CA7Lmozj) and Infantry Company Operations (19fhQbsvbG26Cuwok3PgaMcgAkPmBaAnx). These inventory matches are not a fresh Drive content comparison. Web search did not supply a verified official Philippine signal-platoon establishment. Do not substitute a foreign formation or operational order from a document-sharing site.

## Counting rules

Every figure needs a source, edition and PDF page. Distinguish explicit source counts, calculated subtotals and unknown values. Officer/EP splits remain unspecified unless established by the source. Never display unknown as zero. Avoid summing parent strength and its children together. Separate attached personnel from organic strength. Use historical/doctrinal labels instead of implying current authorization. Restricted originals remain unavailable, consistent with the library policy.

## Acceptance checks

Check all links and page fragments, role text and arithmetic against cited pages. Verify keyboard expansion, 320/390-pixel mobile layouts and desktop, no horizontal overflow, and existing library filters. Run the repository verification suite before publishing.

## Supplied TO.docx addition

User supplied C:/Users/yurizen/Downloads/Telegram Desktop/TO.docx. Read-only Word PDF export, two pages, inspected both rendered pages and embedded images. No restricted marking or designated names found. The original table is retained in electronic-warfare-company-organization.pdf.

User interpretation of (1) is tentative dual designation. Counted only unparenthesized entries. Company HQ prints 4 but lists 2 officer and 6 EP billets. Each of three platoons has 1 officer + 10 EP (HQ 2 and three squads of 3), calculated provisionally. Company row sum 41 (5 officers, 36 EP) conflicts with printed subtotal sum 37. No confirmed company establishment is asserted. All 32 parenthesized positions are displayed as provisional dual duties, with no extra people added. Grade 03/02 normalized to O3/O2. No named personnel are present.

Operational note: PowerShell does not expand wildcards in rg path arguments; use a concrete directory and rg -g patterns.
