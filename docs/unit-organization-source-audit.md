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

## DND-approved Philippine Army Table of Organization 2019 addition

Source (read-only, owner-authorised, the originals are not copied into the repository; only the excerpt PDFs described in the last section are published, outside the Library and library/files): the DND-approved PA TO 2019 package, memorandum of the DND Secretary dated 28 February 2020. Edition label used in the data: "DND-approved PA TO 2019". Each unit has a basic document (.doc), an organizational chart (.ppt/.pptx) and a personnel recap or unit manning workbook (.xls/.xlsx). Legacy files were converted locally to text, PDF and xlsx in a scratch folder for reading only. The Table of Equipment files (TE recaps and "Approved AFP Table of Equipment 2019.pdf") were not used and no equipment or weapon quantities are published.

How the figures were taken. Chart corners print officers (top left), EP (top right) and civilians (bottom right). Required strength is used throughout. Section and squad figures are calculated from the Unit Manning Document billet rows by grade (O = officers, E = EP, SG = civilians) and every parent was checked to equal the sum of its children and the printed chart or recap totals. A position printed in parentheses is a dual designation; the TO TOTAL rows exclude it, so no strength is added (confirmed where an entire EW platoon totals 0). Citations give the document and the sheet or slide; each now also links to the excerpt PDF (see the last section). The original TOE files are not published.

Taken from TO 2019, with sheets or slides cited on the page:
- Army Signal Regiment: 169 officers / 1,713 EP / 55 civilians (reduced EP 1,677). HHC 34 / 87 / 6, Command Signal Battalion 9 / 110 / 14, Network Enterprise Technology Battalion 9 / 118 / 13, Signal Battalion x11 each 9 / 115 / 1, Signal Installation and Maintenance Battalion 9 / 112 / 7, The Signal School 9 / 21 / 4. Each battalion has its own plate with companies, platoons and squads.
- Infantry Division 516 / 6,528 / 78 with Division Headquarters staff (71 / 149 / 36, including the G6 C4S office), Infantry Brigade HHC 15 / 83, Infantry Battalion 32 / 570 with its 11-EP Signal Platoon, Rifle company 5 / 130, Field Artillery Battalion (105 mm towed) 17 / 199 with the HHB signal platoon (6 EP, communication section only), Cavalry Battalion 24 / 242, scout platoon 1 / 19 and Armor Division 384 / 4,630 / 28.

Conflicts and corrections against the earlier sources:
- PAM 6-0102 (2022) lists a Cyber Battalion under the regiment; the TO 2019 has none (cyber security is a company of the Network Enterprise Technology Battalion). Eleven Signal Battalions agree.
- The ASR recap workbook has hidden draft worksheets whose figures disagree with the visible recap and charts (for example Command Signal Bn 9 / 151 / 39, Signal Bn 9 / 146 / 6, Signal School 4 / 21 / 8). Not used.
- Supplied EW company table: no EW company or three-platoon EW structure exists in the TO 2019. Its EW elements are dual-designated platoons (ESM, ECM and ECCM squads) in the Command IT Company, the SIM Battalion IT company and the Electronics company, counting 0 additional personnel. The company table's own counts therefore remain provisional and unreconciled (company HQ 4 vs 8 rows, 41 vs 37).
- Infantry company: 2018 PAM ambiguity on the headquarters machine-gun wording resolved by the TO count (platoon headquarters of nine with two machine gunners and two assistants). Squad of nine, three squads per platoon, headquarters platoon of command, anti-armor and mortar sections, and the attached medic (parenthesized) are consistent. Company 135 (5 officers, 130 EP).
- Armor lesson scout platoon: labels 1 / 19 and 1 / 9 confirmed; "SL" is the squad leader row. The scout section has 10 positions.
- Field Artillery lesson: signal platoon sections are now known (platoon headquarters, communication, electronics, information system); only the communication section is counted.
- The Weapons Company (Infantry Battalion) was only provisionally approved in the memorandum.

Not extracted or not shown: individual billets for most signal units (sections only), the Mechanized Infantry Brigade HHC and battalion detail, Military Intelligence, CMO, support and hospital unit internals, the 155 mm battalion, and detail for dashed boxes without printed figures (Signal Battalion and combat engineer battalion in division charts, mobile training teams). Grade-by-grade officer splits were not published.

## Dual-designated figures (parenthesized positions)

Elements whose TO 2019 positions are all printed in parentheses (17 elements: Rear Signal Support Platoon and its four teams/squads; the Command IT Company, SIM Battalion Electronics and IT company EW platoons and their squads) now show the parenthesized figures as "(n)" with a dashed outline, labelled "dual-designated" and never added to any total. Figures were read from the unit manning sheets (required column, grade by grade: O = officers, E = EP, SG = civilians) and are stored as dualOfficers, dualEp, dualCivilians, dualPersonnel and dualSource (workbook, sheet and rows). Parent platoons include their headquarters rows and all squads. For the IT company EW platoon the sheet lists each squad type once for two squads (x2); the figure is shown per squad. A figure that cannot be read is stored as null and rendered "(—)", never 0. The TOE files were read in place and not copied.

## Published excerpt PDFs (interactive atlas)

Decision (user, explicit): publish excerpts of the DND-approved PA TO 2019, per unit, so a viewer can open the page the organization comes from.

- Location: library/unit-organization/sources/<unit-id>.pdf, one file per formation that cites the TO (14 files, each under 1 MB). They are linked only from the Unit Organization page (source panel, formation header and the evidence list). They are not in library/files, data/library.json, the Library index or the Library filters, and the tests assert this.
- Included: only the sources already cited in data/unit-organizations.json: the organizational chart slides, the cited manning or recap sheets, the basic document (mission, composition, basis of allocation) and, for the Infantry and Armor Divisions, the two-page DND approval memorandum. Page 1 of each excerpt is a cover page naming the edition and stating "Equipment tables omitted", with a contents list. Each TO source entry carries pdf (file) and pdfPage (first page of that source in the excerpt); links open file.pdf#page=N in a new tab.
- Omitted: every Table of Equipment file, equipment recap, "Approved AFP Table of Equipment 2019", the other worksheets of the cited workbooks (hidden drafts, sibling recaps, other units) and the right-hand distribution grids of the wide manning sheets (the printed Unit Manning Document block with description, grade, AFPOS and required/reduced strength is kept). No equipment or weapon quantities appear. The basic documents only name "Equipment Allowances" as a section heading.
- Method: originals opened read-only through Office (PowerPoint, Excel, Word), exported to PDF in a scratch folder (sheets fit to page width, landscape), selected slides or sheets combined with PyMuPDF, document metadata removed (title only). All pages were scanned for RESTRICTED, CONFIDENTIAL, SECRET or CLASSIFIED markings: none. The only hit, the word "confidential" in the NET Battalion basic document, is part of a capability sentence about cyber attacks. The memorandum carries no classification marking. Pages are converted copies shown as supplied, including the Philippine Army watermark of the originals.
- Tests (scripts/test/unit-organizations.test.mjs): every TO source has pdf and pdfPage; pdfPage lies inside the file's page count; only cited units have an excerpt file and every cited unit has one; file names contain no equipment words; files are under 3 MB, carry no author or tool metadata and state the omission on the cover; none is listed in the Library; the page contains the dialog markup, node paths, drill-down links and breadcrumb trail.
