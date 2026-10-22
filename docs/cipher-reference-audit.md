# CipherDesk reference audit

Checked 22 October 2026. These are classical teaching ciphers, not secure modern encryption. Different classroom conventions can legitimately produce different answers; the chart, key, filler and padding settings must agree.

## Coverage

| System | Independent reference | Outcome |
| --- | --- | --- |
| Direct standard | Army TM 32-220 §42 | Shifted-alphabet example matches. Preserve the handout's inclusive count: FIVE means four positions, not a conventional shift of five. |
| Reverse standard | Army §43 | Reversed-alphabet example matches. |
| Keyword mixed | Army §46 | GOVERNMENT example matches. |
| Decimation | Army §48 | Interval-7 example matches. This is elimination counting, not modular-multiplication substitution; retain the lesson's interval-4 example. |
| Numerical key mixed | Army §47 | TELEPHONY example matches. |
| Playfair | Army §117; Harvey's Berkeley examples | Row, column and rectangle rules match. Distinguished display grouping from extra padding and accepted ciphertext J in the shared I/J cell. |
| Single transposition | ACA Complete Columnar; Army §§27–28 | ACA key 3-1-2 example matches; existing incomplete-row tests also pass. |
| Double transposition | Army §95 | Published two-pass example matches in both directions. |

## Playfair correction

- Work in digraphs: BALLOON becomes BA LX LO ON, not a separator between every adjacent repeated letter. BOOKKEEPER already splits into BO OK KE EP ER.
- The class requires X as the only generated filler. An XX conflict or lone final X reports an error rather than substituting Q/Z; naturally occurring Q/Z remain valid message letters.
- A lone final plaintext letter requires a filler. Five-letter **display** groups do not: eight ciphertext letters display as five plus three.
- Prepared input and trace show pairs; answer and clipboard use five-letter groups when that display option is checked.
- Deciphering removes display spaces before rebuilding pairs. I/J share one cell. Odd-length ciphertext remains an error, not silently repaired.
- Retain filler letters in the deciphered result: automatic removal could destroy genuine X, Q or Z letters.
- Following the class owner's final clarification on 22 October, extra padding to complete five-letter groups is manual. CipherDesk only prepares pairs and spaces the result; it does not add full-group nulls. Playfair opens in Encipher mode.

Transposition's existing default and class worked answers are unchanged. Its five-group padding is distinct from filling a complete rectangular grid. Operational indicator conventions remain handout-specific.

## Sources and proof

1. US Army, *TM 32-220: Basic Cryptography* (1950), [official NSA archive](https://www.nsa.gov/Portals/75/documents/news-features/declassified-documents/friedman-documents/publications/FOLDER_238/41748889078809.pdf), [readable mirror](https://www.cipherchallenge.org/wp-content/uploads/2023/12/Basic-Cryptography-Army-Field-Manual-1950.pdf). Section numbers above refer to the manual, not PDF viewer pages.
2. Brian Harvey, *Computer Science Logo Style*, [Playfair chapter](https://people.eecs.berkeley.edu/~bh/v1ch12/playfair.html). Uses Q as filler and permits either I/J notation; fixtures supply the already-prepared reference pairs explicitly and normalize J to I. CipherDesk itself generates only X fillers.
3. American Cryptogram Association, [Complete Columnar Transposition](https://www.cryptogram.org/downloads/aca.info/ciphers/CompleteColTransposition.pdf). Test supplies the example's prepared plaintext, including its final X.
4. Open-source cross-check: [pycipher Playfair implementation](https://github.com/jameslyons/pycipher/blob/master/pycipher/playfair.py). Its transformation rules were inspected, but its preprocessing is not used as the reference oracle. No dependency or code was imported.

Run `node --test scripts/test/cipher.test.mjs` for independent worked vectors for all eight systems, handout examples, duplicate-letter boundaries, grouped-input decoding and round trips. UI/OCR checks are documented in the README.
