# Udon — productivity tool

Projects, a stopwatch with Pomodoro, a GitHub-style heatmap, monthly revenue, a change history, and settings.
It's plain HTML/CSS/JS with Firebase Auth (Google sign-in), Firestore, and Firebase Hosting. There's no build step.

## Getting it live

### 1. Set up the Firebase project (in the browser)

1. Go to https://console.firebase.google.com and click **Create a project**. Note the **project ID** it gives you.
2. On the project home page, click the **Web** icon (`</>`) to add a web app. Give it any nickname.
   Leave "Also set up Firebase Hosting" unchecked, then click **Register app** and **Continue to console**.
3. Go to **Build → Authentication → Get started → Sign-in method → Google**. Turn it on, choose a support email, and click **Save**.
4. Go to **Build → Firestore Database → Create database**. Pick a location near you, choose **production mode**,
   and click **Create**. The rules in this folder will replace the default rules when you deploy.

### 2. Get the Firebase CLI

The `firebase` command is what uploads the site. Choose **one** option:

**Option A: standalone CLI (no Node or npm needed)**

1. Download the Windows binary from https://firebase.tools/bin/win/instant/latest.
2. Move `firebase-tools-instant-win.exe` into this project folder.
3. Double-click it. A terminal opens with the `firebase` command ready, already in this folder.
   Run every command below in that window.
   - Windows may show a SmartScreen warning the first time. Click **More info → Run anyway**.

**Option B: npm**

npm comes bundled with Node.js, so this installs both:

```powershell
winget install OpenJS.NodeJS.LTS
```

Close and reopen VS Code so the new commands are found, then run:

```powershell
npm install -g firebase-tools
```

### 3. Log in and link this folder

```sh
firebase login
firebase use --add
```

`firebase login` opens your browser to sign in with the Google account that owns the project.
For `firebase use --add`, pick your project from the list and enter `default` as the alias.

### 4. Deploy

```sh
firebase deploy
```

This uploads the site and the Firestore security rules. When it finishes, it prints your live URL,
`https://<project-id>.web.app`. Open it and sign in with Google.

You don't need to edit `firebase-config.js`, because Firebase Hosting supplies the config automatically.
To publish changes later, run `firebase deploy` again.

## Run locally

```sh
firebase serve --only hosting     # http://localhost:5000
```

`localhost` is an authorized sign-in domain by default. If you'd rather use another local server
(for example VS Code Live Server), paste your web app config into `firebase-config.js`.
If you add a custom domain, also add it under Authentication → Settings → Authorized domains.

## How data is stored

Everything lives under `users/{uid}/…` in Firestore, and `firestore.rules` only lets each user touch their own data.

| Path | Contents |
| --- | --- |
| `users/{uid}` | profile, settings (statuses, Pomodoro, currency) |
| `users/{uid}/projects` | name, subname, status, link |
| `users/{uid}/docs` (+ `/chunks`) | attached documents, stored as ≤900 KB byte chunks |
| `users/{uid}/sessions` | timer sessions used by the heatmap |
| `users/{uid}/revenue` | monthly revenue entries |
| `users/{uid}/history` | change log |

Documents are stored in Firestore instead of Cloud Storage. That keeps the project on the free Spark plan and
avoids bucket CORS setup. The trade-off is a 15 MB limit per file, which is plenty for specs, contracts and briefs.

## Document viewer

- **PDF** uses the browser's built-in viewer.
- **Word (.docx)** is converted to HTML with [mammoth.js](https://github.com/mwilliamson/mammoth.js), loaded on demand.
- **OpenDocument (.odt)** is unzipped with JSZip and rendered with headings, formatting, lists, tables, links and images.
- **Legacy .doc** files can be attached and downloaded but not previewed.

## Timer notes

- The running timer is saved on the device, so a refresh or closed tab doesn't lose it.
- Stopwatch sessions are logged when you press **Stop & log**. Sessions under a minute are skipped.
- Pomodoro logs each completed focus block automatically. Stopping or skipping a focus block early logs the time done so far, if it's a minute or more.
