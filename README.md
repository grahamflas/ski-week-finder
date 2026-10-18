# Ski Week Finder

A shared calendar for January to April 2027. Each person picks their name and
clicks the days they can't travel. Everyone sees the marks right away, and days
nobody marked stay green, so you can spot a free stretch of 7 days.

It is a static site (`index.html`, `app.js`), so it runs on GitHub Pages. The
shared marks are stored in Firebase Firestore, which has a free plan. Nobody
who uses the page needs an account anywhere.

## Setup

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account
   (only you need this).
2. **Add project**, name it e.g. `ski-week-finder`, and turn Google Analytics off.
3. Use the free **Spark** plan. If the console asks you to upgrade to a paid plan
   to continue, stop and check Firebase's current pricing page first.

### 2. Create the database

1. In the project, open **Build > Firestore Database > Create database**.
2. Pick a location in Europe (for example `eur3`).
3. Choose **Start in production mode**.

### 3. Paste the rules

1. Open the **Rules** tab of Firestore.
2. Replace everything with the contents of `firestore.rules` from this repo.
3. Click **Publish**.

The rules allow anyone to read the calendar and to edit only the three
documents `alisa`, `graham` and `konny`, and only in the expected format.

### 4. Connect the page

1. In **Project settings** (gear icon) scroll to **Your apps** and click the web
   icon `</>`. Register an app (skip Firebase Hosting).
2. Copy the `apiKey`, `authDomain`, `projectId` and `appId` values it shows
   into `firebase-config.js`.

### 5. Publish on GitHub Pages

1. Put all files of this folder in a GitHub repository and push them.
2. In the repository open **Settings > Pages**, set **Source** to
   **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute the site is live at
   `https://<your-user>.github.io/<repo-name>/`. Send that link to Alisa and Konny.

## Good to know

- Anyone who has the link can change anyone's days. That is fine for a group of
  friends, but don't post the link publicly.
- The Firebase config values in `firebase-config.js` are visible to everyone who
  opens the page. That is normal for Firebase; the rules in step 3 are what
  protect the data.
- To start over, open Firestore in the Firebase console and delete the
  documents in the `people` collection.
- To change names or months, edit `PEOPLE`, `START`/`END` and the month list in
  `app.js`. If you rename people, update the list in `firestore.rules` too.
- Until `firebase-config.js` is filled in, the page still opens, but marks stay
  on that one screen and are not shared.
