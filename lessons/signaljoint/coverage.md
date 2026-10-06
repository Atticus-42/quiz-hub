# Coverage map: Signal Support in Joint Operations (signaljoint)

Item ids (positions in the current banks): E = easy.json, M = medium.json, H = hard.json. (S) = scenario-to-term item, (O) = objective item.
Totals (after the October 2026 trim to at most 50 per difficulty): easy 50, medium 50, hard 50, giving 150 items; the 47 retired items are listed at the end. Every bank still covers every topic (hard keeps its Operational Environment item).

Sources: the slide deck (slides 6-70) and the official student handout "Signal Support in Joint Operations - Student Handouts" (18 pages, IAW PAM 6-0102). Where the handout is explicit it is authoritative; slides remain valid where consistent. `sourceSlides` always holds slide numbers (the engine has one reference label per lesson); a handout-only item cites the nearest matching slide, names "Handout p.N" in its explanation and carries the tag `handout`. Handout items added in October 2026 are the items tagged `handout`.

Handout revision audit (October 2026): every existing item was checked against the handout and no key was wrong or ambiguous, so no qid was retired by the audit (the later size trim retired some, see the end of this file). Wording-only fixes (qids kept): E11 (asks for the five *areas* covered under systems and technologies, since the handout calls only fixed, tactical and special purpose the main categories), E16, E31 and M01 (prompts reworded so they are not near-duplicates of E15, E28 and E1); handout references added to the explanations of E11, E14, E27 and M20.

Slide contradictions resolved by the handout: (1) principles - Handout p.8 lists five: operations focused, interoperable, redundant, scalable, secured (= slide 27); the six combined-arms principles on slide 26 are not joint doctrine. (2) planning - Handout pp.13-15 gives eight steps: signal estimate, communication requirements, available resources, priorities, recovery procedures, tentative plan, validate and finalize, publish and maintain coordination (= slide 49); the six steps on slide 47 are not used. (3) systems - Handout pp.5-7 covers the same five areas as slide 18 (fixed, tactical, special purpose, operations-center systems, network support and cyber protection) and names fixed, tactical and special purpose as the three main categories of C2 communication; the eight poster panels of slide 17 (tactical radio, satellite, line and fiber, data networks, radio relay, C2 systems, communications security, power and support equipment) are not a handout list and are not tested. (4) Slides 48-58 are titled "in CAO", but their content matches the handout's joint ELO5 word for word, so they are tested as joint doctrine. The handout has no counterpart to the slide 8 diagram, whose items stay on the slide.

Excluded (non-doctrine): slides 1-5 (title, instructor profile, references, TLO and ELOs) and slide 71 (end).

Image-only slides (no text): slide 8 is a joint-operations diagram (Land-PA, Maritime-PN, Air-PAF; physical, cyberspace and electromagnetic spectrum environments; Connect-Sustain-Recover), and items are built on it. Slides 9, 17, 26, 34, 47 and 59 are illustrative section-divider posters. Slides 26 and 47 are labelled "Combined Arms Operations" and come from the sibling deck: they show 6 combined-arms principles and 6 planning steps that conflict with the joint slides 27 and 49. Slide 17 shows 8 technology panels that differ from the 5 categories on slide 18. These poster slides are not tested as doctrine. The combined-arms principle list appears only as a wrong option in E18.

## 1. Joint Operations Fundamentals (slides 6-7)
| Topic / term | Items |
|---|---|
| Joint operations definition (2+ AFP services, single commander, common mission) | M2 (S) |
| Philippine Army contribution (land forces incl. combined arms teams; supports air/maritime ops) | M1 (O) |
| Philippine Navy contribution (maritime, sea control) | E1 (O) |
| Philippine Air Force contribution (air, counter-air) | E2 (O) |
| Combined arms vs joint distinction | E3 (S) |
| Combined arms team can be part of a larger joint operation | H12 (S) |
| Why services must communicate (exchange info to coordinate actions) | M3 (O) |
| Joint synergy (Handout p.1) | M35 (S) |
| Joint Force Commander coordinates the forces; clear command relationships (Handout p.1) | E35 (O) |
| Same area is not enough: common mission through coordinated command and action (Handout p.1) | M36 (O) |
| Supported component (primary responsibility) vs supporting (Handout p.2) | E36 (O) |
| Normally supported: land ops - land forces; sea control - Navy; counter-air - Air Force (Handout p.2) | E37 (S), H42 (O) |
| Relationships change with the task (island example, Handout p.2) | H43 (S) |

## 2. Operational Environment (slide 8, image)
| Topic / term | Items |
|---|---|
| Domains: Maritime-PN (also Air-PAF and Land-PA as options) | E4 (O) |
| Three signal environments (physical, cyberspace, EMS) | H41 (S) |
| EMS: radio waves, satellite links, LOS, BLOS | E5 (S), H41 (S) |
| Physical environment: terrain, weather, people, equipment | E6 (O) |
| Cyberspace environment: networks, data, information, protection | M4 (S) |

## 3. Roles of Signal Support (slides 10-16)
| Topic / term | Items |
|---|---|
| Five roles (list) | E8 (O) |
| Role 1 Connect the participating services | E8 (S); why it matters M8 (O) |
| Interoperability definition | E7 (O) |
| Role 2 Enable effective command and control | M7 (S); E45 (O, timely communication) |
| Role 3 Facilitate coordination between operating troops and supporting assets (embedded relay operators) | M5 (S) |
| Role 4 Support the synchronization of joint activities | H11 (S, not achieved) |
| Another service's operators at the TOC simplify the radio net and give direct contact with supporting assets (Handout p.3) | E9 (O) |
| Joint planning; supported/supporting roles | M34 (O) |
| Role 5 Apply communication protection measures (less secure mode; ciphertext, double talk) | M10 (S), H12 (S, neglected), E12 (O), H1 (O, not fully secure) |
| Vigilance net reserved for emergency and exigent situations (Handout p.4) | E38 (O) |
| Key point: plan to action by keeping commanders, troops, assets connected | E10 (O) |
| Summary table (interoperability / links commanders / bridges gaps) | M9 (O); E9, M7 explanations |
| Summary table rows only in the handout: coordination and synchronization (common plan), protection (reduces vulnerabilities) (Handout p.4) | E39 (O), H44 (O) |

## 4. Systems and Technologies (slides 18-25)
| Topic / term | Items |
|---|---|
| Definition of signal support systems and technologies | M8 (O) |
| Five areas (list) | E11 (O) |
| Three main categories of C2 communication: fixed, tactical, special purpose (Handout p.5) | E40 (O) |
| BONTEX = Bonifacio Telephone Exchange (Army telephones to HPA and GHQ AFP) (Handout p.5) | E41 (O), H45 (O) |
| PANET = Philippine Army Network (secured, managed Army intranet) (Handout p.5) | E42 (O), H45 (O) |
| VoIP (IP-based telephone services over a data network) (Handout p.5) | M40 (O), H45 (O) |
| DBTOCS = Deployable Brigade Tactical Operations Center System (extends fixed services to brigades) (Handout p.5) | M37 (S), H45 (O) |
| Fixed VTC, email and collaboration systems vs commercial VTC (Handout pp.5-6) | H15 explanation |
| Voice is the foundation of tactical communication (Handout p.5) | E43 (O) |
| HF, VHF, UHF radios (Handout p.6) | E44 (O) |
| CNR = Combat Net Radio (organizes radio communication among stations) (Handout p.6) | M38 (O) |
| ROIP = Radio over IP (links radio through an IP network) (Handout p.6) | M39 (S) |
| Ad-hoc network technologies (networks for an operational requirement) (Handout p.6) | M38 (O) |
| Equipment depends on mission, environment, requirements (Handout p.6) | M41 (O) |
| Frequency category alone does not establish interoperability (Handout p.6) | H46 (S) |
| Commercial devices: VTC platforms, cellular phones, satellite phones (Handout p.6) | M26 (S), H15 (S) |
| MCC = Mobile Command Centers (operations center away from a fixed facility); services converge at the operations center (Handout p.6) | E60 (O), M57 (S), M13 explanation |
| Operations-center systems (information from sensors and communication devices reaches the commander; services converge there) (Handout p.6) | E14 (S) |
| Fixed communications system (backbone; wired and wireless; voice and data) | E12 (O) |
| Fixed connection to another service needs approved arrangements and compatible systems | H14 (S) |
| Tactical communication systems (operating troops; on the move and on the halt) | E13 (S) |
| Special purpose systems (commercial; routine/admin; content within policy) | E14 (S), H15 (S) |
| Network support and cyber protection (supporting activities, not equipment) | H13 (S) |
| INO = Information Network Operations | E15 (O) |
| DCO = Defensive Cyberspace Operations | E16 (O) |
| INO purpose: build PANET, restore after a computer emergency, IS development and integration (Handout p.7) | M42 (S), H47 (O) |
| DCO purpose: defend PANET, respond to cyber incidents (Handout p.7) | H47 (O) |
| Requirement first, then technology | M9 (O) |
| Required: signal estimate, signal planning and EMS management | M9 (O) |
| Five planner questions: who / what / where / work together / protected-sustained-restored | E20, M17, H42 (O) |
| Practical arrangements (lend equipment, embed Army operators, embed other-service operators at TOC) | H2 (O) |
| Effectiveness depends on compatible equipment, trained operators, coordinated procedures, protection | M11 (O) |

## 5. Principles of Signal Support (slides 27-33)
| Topic / term | Items |
|---|---|
| Five principles (list) | E18 (O) |
| Operations focused | E25 (S), H7 (S, compromised) |
| Communication is an enabling capability (discharged batteries, lost contact) (Handout p.8) | M43 (O) |
| Interoperable requires compatibility and standardization (Handout p.8) | M44 (O) |
| Redundant in joint ops: no single device, link or network (Handout p.9) | M45 (O) |
| Scalable phases: home station, en route, deployed (Handout p.9) | E46 (O) |
| Interoperable (within Army and with other services; a working link is needed) | H7 (S) |
| Operations focused in joint ops: who must communicate, when, how long (Handout p.8) | H4 (S) |
| Scalable in joint ops: more forces, new HQ, changing locations, more information (Handout p.9) | M12 (O) |
| Redundant (multiple paths, backups, self-healing, data replication; usable backup) | M21 (O), E22 (S), H5 (S, compromised) |
| Scalable | E23 (S), H6 (S, compromised) |
| Secured | H7 (S), H9 (O) |
| Summary phrases (serve, connect, survive, adapt, protect) | H8 (O) |
| Question to ask per principle | H9 (O) |

## 6. Tactical Considerations (slides 35-46)
| Topic / term | Items |
|---|---|
| Definition of tactical considerations | E19 (O) |
| Nine considerations (list) | H20 (O) |
| 1 Mission and commander's intent | M15 (S) |
| 2 Terrain, distance, and weather | E20 (S) |
| Island separation / mountains / vegetation / urban / typhoons | M25, E29, H22 (O) |
| 3 Unit movement and communication-site location | E22 (S), H40 (O) |
| Site-location factors: terrain, propagation, disposition, projected operations, accessibility, logistics (Handout p.11) | M46 (O) |
| 4 Interoperability in joint operations | H17 (S, neglected), M46 (O) |
| 5 Equipment, personnel, and sustainment | E23 (S) |
| 6 Spectrum management and electronic threats | M13 (S), M18 (O) |
| 7 Communication and cyber security | H18 (S) |
| 8 Redundancy and recovery | H18 (S, neglected), H43 (O) |
| 9 Priorities when resources are limited | M14 (S), H22 (S), H40 (O) |
| CSR = Connect-Sustain-Recover | E24 (O) |
| Connect / Sustain / Recover | H19 (S), M17 (S), E25 (S) |

## 7. Planning and Coordination (slides 48-58)
| Topic / term | Items |
|---|---|
| Definition of planning and coordinating | M19 (O) |
| Command and Control Communication definition (Handout p.13) | M47 (O) |
| C4S = Command and Control, Communications, and Cyber Systems (Handout p.13) | E62 (O), E37 explanation |
| Eight steps: first step and steps 4-7 in order | E26 (O), H28 (O) |
| Step 1 Signal estimate; METAL guides it | H21 (S) |
| METAL factors: Mission, Enemy, Troops, Area of Operations, Logistics (Handout p.13 table) | H48 (O) |
| Estimate revised when the situation changes (Handout p.13) | M48 (O) |
| Step 2 Communication requirements; sources incl. CEOI and CESI; who, what, when | M22 (S), M20 (O) |
| Coordination requirement: command relationships (Handout p.15) | M21 (S) |
| Align requirements with supported/supporting relationships assigned by the JFC (Handout p.14) | M49 (O) |
| Step 3 Available resources (equipment, personnel, funds) | M23 (S), H3 (O) |
| Step 4 Establish priorities | H22 (S) |
| Step 5 Develop recovery procedures (4 threat-provision pairs) | M24 (S), H29 (O) |
| Step 6 Tentative plan (lending, embedding, spectrum; coordination table) | H23 (S), M25 (O), H27 (O) |
| Tentative plan contents: PACE, resources, sites, security, interconnections and alternate routing (Handout p.14) | H49 (O) |
| Step 7 Validate and finalize (checklist; resolve gaps) | H24 (S), H26 (O) |
| Step 8 Publish (C4S annex) and maintain coordination; CSR in execution | H25 (S), E27 (O) |
| Joint C3 plan answers: who with whom, by what means, whose responsibility, what if it fails (Handout p.15) | H50 (O) |

## 8. Security Measures and Protocols (slides 60-70)
| Topic / term | Items |
|---|---|
| Security definition (protect while keeping the ability to communicate) | H37 (O) |
| Security needs protective measures and procedures personnel consistently follow (Handout p.16) | M50 (O) |
| COMSEC = Communication Security; governs regardless of technology | E28 (O), M33 (O) |
| Nine measures (list) | H39 (O) |
| 1 Follow COMSEC policies and operating instructions | E29 (S) |
| CEOI = Communication-Electronics Operating Instructions (what to do when operating C4 systems) (Handout p.16) | E48 (O) |
| CESI = Communication-Electronics Standing Instructions (how to use the CEOI items) (Handout p.16) | E49 (O) |
| 2 Protect against interception and electronic interference (frequency hopping, anti-jamming) | H32 (S, neglected), M42 (O) |
| 3 Prepare for compromised equipment and frequencies | E30 (S), H18 (S) |
| 4 Use less secure and commercial communication with caution (vigilance net; VTC, cell, sat phones) | M26 (S), H1 (O) |
| 5 Control access and protect computers and networks | H31 (S) |
| NAC = Network Access Control; its function | M27 (O) |
| UTM firewall / Endpoint security / Anti-spam firewall | E33 (O), H32 (S), M28 (S) |
| 6 Monitor systems and assess vulnerabilities; begin while the network is built | M29 (S), M32 (O) |
| SOC monitoring, cyber risk assessment, VAPT, SIEM | H38 (O) |
| SOC = Security Operations Center (Handout p.17) | E50 (O) |
| SIEM = Security Information and Event Management | E31 (O) |
| 7 Follow an incident-response plan; IR definition; CSIRT duties | H33 (S), M30 (O), H34 (O) |
| 8 Coordinate security across the joint force (AFPCyG; JFC mission and intent) | H37 (S, neglected), M41 (O) |
| 9 Maintain communication and recovery arrangements; PACE plans | H38 (S, neglected), E43 (O) |

Acronyms the handout expands (BONTEX, PANET, VoIP, DBTOCS, ROIP, CNR, MCC, C4S, CEOI, CESI, SOC) are now also tested by expansion; METAL is tested by its factor list (slide 50 name + Handout p.13 table). CSIRT, AFPCyG and UTM (as a letter set) are expanded in neither source and are tested by function only, never with "What does X stand for?".

## Retired in the October 2026 size trim

Owner rule: at most 50 questions per difficulty, with every topic/term covered by the union of the three difficulties. Only questions whose terms (tags, topics and the rows above) were still covered by another question were removed. Their qids are retired and never reused (see `retired.json`).

- Easy: signaljoint-e-01, signaljoint-e-08, signaljoint-e-12, signaljoint-e-22, signaljoint-e-23, signaljoint-e-24, signaljoint-e-25, signaljoint-e-26, signaljoint-e-35, signaljoint-e-36, signaljoint-e-41, signaljoint-e-46, signaljoint-e-47, signaljoint-e-56, signaljoint-e-58, signaljoint-e-63, signaljoint-e-06, signaljoint-e-11, signaljoint-e-17
- Medium: signaljoint-m-04, signaljoint-m-07, signaljoint-m-10, signaljoint-m-12, signaljoint-m-13, signaljoint-m-14, signaljoint-m-16, signaljoint-m-20, signaljoint-m-21, signaljoint-m-26, signaljoint-m-42, signaljoint-m-46, signaljoint-m-47, signaljoint-m-50, signaljoint-m-52, signaljoint-m-57, signaljoint-m-59, signaljoint-m-61, signaljoint-m-64, signaljoint-m-69, signaljoint-m-70, signaljoint-m-15, signaljoint-m-19, signaljoint-m-31
- Hard: signaljoint-h-05, signaljoint-h-22, signaljoint-h-42, signaljoint-h-04

Re-covered (October 2026 follow-up): the seven rows that had lost their only question (EMS; operations-center systems; signal estimate, signal planning and EMS management; another service's operators at the TOC; operations focused in joint ops; scalable in joint ops; coordination requirement: command relationships) each have a new question again. Each replaced a question in the same category whose terms were covered elsewhere, so every bank is still 50 and no other row lost coverage: E5 (EMS) replaced the "three environments" item (H41 still covers it), E14 (operations-center systems) replaced the second special purpose item (H15 still covers it), E9 (TOC operators) replaced the synchronization scenario (H11 still covers it), M9 (the requirement-first item now also asks for the three required activities), M12 (scalable changes) replaced the interoperable scenario (H7 still covers it), M21 (command relationships) replaced the "who, what, when" objective item (M22 still covers it) and H4 (operations focused: who, when, how long) replaced the secured-compromised scenario (H7 and H9 still cover Secured). Their old qids are retired in the lists above; the new items are signaljoint-e-67, e-68, e-69, m-72, m-73, m-74 and h-54.
