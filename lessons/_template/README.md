# Lesson template

Folders whose name starts with `_` are ignored by the build. To add a lesson:

1. Copy this folder to `lessons/<key>/` (for the next Module 3 lesson: `lessons/signaljoint/`).
2. Edit `lesson.json`. The `key` must equal the folder name and `historyLesson`, and it must be listed in
   `LESSONS` in `apps-script/Code.gs` (`signaljoint` already is). Set `categoryOrder`, `sourceRef`
   (page/slide range, or `"required": false`), `slug` (the URL folder) and `order` (position in its module).
3. Add `hero.svg` (one decorative `<svg viewBox="0 0 480 250" aria-hidden="true" focusable="false">`) and,
   optionally, `hero.css` (its animation; it must also stop it under `prefers-reduced-motion: reduce`).
   Then list the animated selectors in `art.stilled` and the art's ids/labels in `art.groups`/`art.labels`
   so the tests check them.
   Draw it like the other plates (technical line art, see `lessons/armor/hero.svg`): copy the `plate-grid`
   group, use `fill="none" stroke="currentColor"` (olive ink), class `ink` for the principal subject, `pf` to
   knock out lines behind an object, `thin`/`faint` for context, and one accent only (`acc` stroke, `acc-f`
   fill, `t-acc` text). The accent colour is the lesson's `"palette": { "--lesson-accent": "#…" }` (at least
   3:1 on paper; the design tests check it). Text is set by the page in IBM Plex Mono.
4. Add `easy.json`, `medium.json` and `hard.json` (see the main README for the question format), then run
   `node scripts/assign-qids.mjs <key> && node scripts/build.mjs && node scripts/verify.mjs`.

The hub card, Module card text, instructor page and class history wiring are generated automatically.
