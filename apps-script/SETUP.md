# Class score history and question analysis: setup

One Google Sheet serves every quiz on this site. Each finished attempt adds a row to its lesson's tab: name, difficulty, score, total, percentage, mastery band, finish time and the codes of the questions missed. The 'Item Analysis' tab counts how often each question was asked and missed, and the instructor page (`/quiz-hub/instructor/`) reads those counts. The answers students chose are never sent, and practice retries send nothing.

`Code.gs` in this folder is the one copy of the script (version 7). The live web app is already deployed. Its URL is `HISTORY_ENDPOINT` in `scripts/build.mjs`.

## Updating the deployed script (after Code.gs changes, for example to version 7)

1. Open the class history spreadsheet and choose **Extensions > Apps Script**.
2. Replace the whole contents of `Code.gs` with this folder's `Code.gs`, then save (Ctrl+S).
3. Choose **Deploy > Manage deployments**, click the pencil icon on the existing web-app deployment, set **Version** to **New version**, and click **Deploy**.
   Editing the existing deployment keeps the same `/exec` URL. A *new* deployment would get a new URL, and then every page would need rebuilding with that URL.
4. Quick check: open `<exec URL>?action=items&lesson=all` in a browser. It should show `{"ok":true,"kind":"items","version":7,"rows":[]}` (the rows fill as attempts arrive).

Version 7 is backward compatible:
- pages that send no `asked`/`missed` (or no `total`) are stored as before;
- existing history tabs get a `Missed` header added once, and their rows are untouched.

## First-time setup (a new spreadsheet)

1. Create a blank Google Sheet. The script creates its tabs and headers itself.
2. **Extensions > Apps Script**: paste `Code.gs` and save.
3. **Deploy > New deployment > Web app**:
   - **Execute as**: Me.
   - **Who has access**: Anyone.
   Authorise the script when asked. On the "Google hasn't verified this app" screen, choose **Advanced > Go to ... (unsafe)**: it is your own script.
4. Copy the `/exec` URL into `HISTORY_ENDPOINT` in `scripts/build.mjs`, then run `node scripts/build.mjs && node scripts/verify.mjs`, commit and push.

## Adding a lesson

The tab names live in `LESSONS` at the top of `Code.gs`. A new lesson's key must be added there, followed by an updated deployment (above), before its attempts are accepted. `signaljoint` is already listed.

## Privacy and housekeeping

- The web app is public: anyone with the `/exec` URL (visible in the page source) can read recent names and scores, and could add rows. Ask students to use a first name or a class username.
- To remove entries, delete rows in a tab. To reset the question analysis, delete the rows below the header of 'Item Analysis'.
- To switch the class history off, build with an empty endpoint (`HISTORY_ENDPOINT = ''` in `scripts/build.mjs`), or archive the deployment.
