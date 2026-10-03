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
4. Add `easy.json`, `medium.json` and `hard.json` (see the main README for the question format), then run
   `node scripts/assign-qids.mjs <key> && node scripts/build.mjs && node scripts/verify.mjs`.

The hub card, Module card text, instructor page and class history wiring are generated automatically.
