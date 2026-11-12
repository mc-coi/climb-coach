# Climb Coach

A phone-friendly scorebook for one coach, built for the ICL sheet layout reviewed in November 2026. The entire application is in **index.html**. There is no build step, server, subscription, or bundled student roster.

## Start now

Open `index.html` in a browser. The practice roster uses fictional names. Choose **Use my roster**, enter the meet name and date, and paste one climber name per line.

Select a climber, tap a rope or bouldering grade, and save. Logging a climb marks the climber present. The app retains every recorded climb and counts the highest three by points. Equal point values retain entry order. For another climb at the same grade, confirm that it was a different completed climb.

Use **Remove** to correct an entry. Unchecking attendance excludes the climber’s points without deleting history. The app shows individual points only; the official sheet remains responsible for team, varsity, and qualification calculations.

Data is saved in this browser’s local storage. It is not sent to GitHub. Different browsers, devices, and site addresses have separate data. Export a full backup regularly, especially before changing devices or clearing browser data. Backups can be restored through **Export**. Restoring makes a separate local meet without an active sheet link. Local scoring works without Google; a page already open can keep scoring without internet. This version does not cache the page for offline reopening.

## Host on GitHub Pages

1. Create a GitHub repository and upload `index.html` to its root. Uploading this README is optional. Do not upload exported score files or backups containing student information.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch and **/(root)**, and save.
4. Open the published address, typically `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
5. On your phone, bookmark it or use **Add to Home Screen**.

You can deploy the HTML unchanged. No credentials or roster edits are needed in the source file. The HTML has no external fonts, analytics, or packages. It loads Google’s identity script only when connection settings are opened.

## Google permissions: ownership is not required

- **Editor on the actual sheet, with access to its input cells:** you can authorize this app to read and write those cells. You do not need to own the spreadsheet or install Apps Script inside it.
- **Viewer or commenter:** you cannot write scores through this app. Having the URL or an API key does not grant edit permission.
- **Editor only on your copy:** the app can update that copy. Updating it does not update the original.
- **Protected cells or school restrictions:** Google enforces these. The owner may need to allow editing the input cells; a school administrator may need to approve the OAuth app.
- **No edit access possible:** keep scoring locally or in your copy, then export CSV for the authorized person. Alternatively, the owner can implement an approved write service under their account; that is a separate integration and is not included here.

This page uses Google Identity Services and the Sheets API directly, which is compatible with static GitHub Pages hosting. There is no public Apps Script write endpoint and no embedded service-account credential.

## Enable the optional Google connection

The page works without this setup. Do these steps only when you want live Sheet reads and writes, initially against your copy.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project that you can configure. This project is separate from ownership of the spreadsheet.
2. Enable the **Google Sheets API** for that project.
3. Configure **Google Auth Platform**: set branding, audience, and your support email. For a personal test, choose **External**, keep the app in **Testing**, and add the coach’s Google account as a test user. An organization may offer an Internal audience instead.
4. Under **Data Access**, add `https://www.googleapis.com/auth/spreadsheets`. This scope permits Sheets access across the signed-in user’s accessible spreadsheets; the implementation sends requests only to the sheet ID entered by the coach. A wider rollout may require OAuth verification and organization approval. A future integration with Google Picker could narrow access to selected files with `drive.file`.
5. Create an **OAuth client ID → Web application**.
6. Add your exact **Authorized JavaScript origin**, e.g. `https://YOUR-USERNAME.github.io` (no repository path or trailing slash). For local development, add `http://localhost:8765`. A custom domain needs its own origin. This token-popup flow does not require a redirect URI.
7. Copy the client ID ending in `.apps.googleusercontent.com`. A client ID is public configuration, not a secret. **Do not put a client secret in this page or repository.**
8. On the hosted page, open **Pick meet tab**, paste the client ID and your spreadsheet URL, and choose **Sign in & find meet tabs**.
9. Choose the competition from **Available meet tabs** and tap **Open meet**. The picker checks the sheet each time you open it while signed in. Use **Refresh tab list** if someone adds a meet while the picker is open. Loading reads the roster, attendance, existing three climbs, and grade-to-points mapping. It does not write anything.
10. Record a test climb in your copy and choose **Sync scores**. The confirmation identifies the meet and affected climbers. Check the resulting sheet before using the app for an official meet.

Access tokens remain in page memory only. After a reload or token expiry, open **Pick meet tab** and sign in again. You do not have to reload the meet: close settings after signing in and sync your existing pending changes. **Open meet** resumes your saved meet and its pending scores. **Reload scores from sheet** replaces the saved version of that linked meet; it asks before discarding local history or pending changes.

Disconnect clears the token held by this page. To remove the app’s Google consent grant entirely, revoke it in your Google Account’s third-party connections settings.

## Supported sheet layout and sync behavior

The connection targets the template you provided:

| Column / range | Meaning | App access |
| --- | --- | --- |
| A, starting row 2 | Participating checkbox | Read/write |
| B, starting row 2 | Climber name | Read only |
| C, starting row 2 | Category | Read only |
| D, F, H | Climb 1, 2, 3 grades | Read/write |
| E, G, I, J | Calculated points and total | Never written |
| P3:Q33 | Grade-to-points table | Read only |

The app reads up to 1,000 roster rows, validates the expected Climb 1/2/3 and Total headings, and skips Instructions and Roster when listing tabs. It does not create tabs, edit the roster, or modify the meet’s competitor, location, date, time, category, or team formulas. Enter those details in the sheet as usual. A new local meet is not automatically mapped to a sheet; connect and load an existing meet to enable syncing.

Only changed climbers are written, using the four individual cells A/D/F/H per row with RAW values. Empty climb slots use the template’s `None` value. Existing grade order alone is not treated as an edit. Best-three grades are sorted by points when a score change is sent. Repeated equal grades represent separate completed climbs; the coach must distinguish repeats from accidental duplicate submissions.

Before each sync, the app rereads the scoring table and each affected row’s name, category, attendance, and grades. If any differ from the loaded baseline, it stops rather than overwriting that change. It also refuses to overwrite formulas in the four input cells. After a successful write, it reads back and verifies the result. Formula totals are not recalculated locally as a substitute for the official team rules.

This is designed for one coach. The read/check/write sequence is not an atomic lock: a second editor could change a row between the check and write. Avoid simultaneous manual changes to the affected rows. A lost connection after a write can leave the result uncertain; inspect the sheet before retrying. Local scores remain available for export.

**Only attendance and best three are synced.** The full climb history stays on this device and in exported backups. Existing sheet grades are imported as baseline history entries with their grades. Refreshing from the sheet cannot reconstruct older climbs. Do not use another device as though it has the same complete history.

## Verification

Run `node test.cjs` for scoring, tie handling, sheet mapping, duplicate grades, empty/absent handling, and backup validation tests. No installation is required.

For a local browser preview, run `python3 -m http.server 8765 --bind 127.0.0.1` in this directory, then visit `http://localhost:8765`. Google sign-in requires an authorized HTTP localhost origin or HTTPS deployed origin; it does not work from `file://`.

The included Google integration requires your OAuth configuration and sheet authorization for an end-to-end test. No Google credentials are included and no live sheet writes were performed during development.

## References

- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Sheets values batch update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate)
- [Google Drive sharing roles](https://support.google.com/drive/answer/2494822)
