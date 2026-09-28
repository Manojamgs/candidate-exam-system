# Putting the system online with Render

After these steps the system runs 24/7 at an `https://…onrender.com` address (or your own domain). Your team signs in from anywhere, and candidates open the exam links they receive by email.

```
GitHub (private repository)  ──push──▶  Render web service (Node 22, HTTPS)  ──▶  persistent disk /var/data/exam.db
                                                     ▲                                  (daily snapshots)
                          team + candidates ─────────┘  https://candidate-exam-system.onrender.com
```

All the Render settings are already in [`render.yaml`](../render.yaml) (a Render *Blueprint*).

## 1. Put the code on GitHub (private)

> **The repository must be Private.** It contains the question bank and the answer keys (`seed/`, `docs/ANSWER_KEYS.md`, `docs/PROGRAMMING_BANK.md`).

1. Sign in at <https://github.com> (or create a free account) → **New repository**.
   - Name it `candidate-exam-system`.
   - Choose **Private**.
   - Do **not** add a README, .gitignore or licence.
2. Upload the code with **GitHub Desktop** (easiest):
   1. Install it from <https://desktop.github.com> and sign in.
   2. Choose **File → Add local repository** → `~/Documents/candidate-exam-system`. The folder is already a Git repository with a first commit.
   3. Click **Publish repository**, keep **Keep this code private** ticked, and publish.

   Or use Terminal:

   ```bash
   cd ~/Documents/candidate-exam-system
   git remote add origin https://github.com/<your-account>/candidate-exam-system.git
   git push -u origin main        # sign in when prompted (use a personal access token as the password)
   ```

`.env`, `node_modules/` and `data/` (your local database) are excluded by `.gitignore`, so no local passwords or candidate data are uploaded.

## 2. Create the service on Render

1. Sign in at <https://render.com> using **Sign in with GitHub**. Allow Render to access the `candidate-exam-system` repository.
2. Go to **New → Blueprint** and select the repository. Render reads `render.yaml` and shows one web service with a 1 GB disk.
3. Fill in the values Render asks for:

   | Variable | Value |
   |---|---|
   | `ADMIN_EMAIL` | your email address |
   | `ADMIN_PASSWORD` | a strong password: 12+ characters with upper-case, lower-case, a number and a symbol |
   | `APP_BASE_URL` | leave blank for now (the onrender.com address is used), or `https://exams.activemindsit.com` if you set up a custom domain (step 5) |

   `APP_SECRET` is generated automatically. **Never change or delete it**, because it encrypts the stored secrets and exam links.
4. Click **Apply**. The first build takes about 3–5 minutes. When the service shows **Live**, open its URL and sign in as `admin` with your password.

**Plan and cost:** the Blueprint uses Render's smallest paid instance plus a 1 GB disk, because free instances cannot keep data.

- See <https://render.com/pricing> for current prices.
- You can change the plan or region in `render.yaml` (it is set to `singapore`), or later in the Render dashboard.

## 3. First-time configuration (in the app)

1. Change the admin password: top bar → **Password**.
2. **Settings → Branding:** upload the company logo (SVG plus a PNG for emails and PDFs) and set the colours.
3. **Settings → Email:** set the transport to SMTP. For Microsoft 365, use host `smtp.office365.com`, port `587`, *secure* off (STARTTLS) and a licensed mailbox or app password. Then click **Send test email**.
   - Without SMTP, emails are only recorded and never delivered.
4. **Settings → AI evaluation:** add your Anthropic or OpenAI key, then click **Test**.
   - Alternatively, add `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `SMTP_PASSWORD` as Environment variables on Render. Values set there take precedence and are never shown in the UI.
5. **Settings → Users:** create an account for each team member (HR, Evaluator or Admin). Share the URL with them. They sign in with their own username.
6. Test it end to end:
   1. Create a test candidate with your own email address.
   2. **Assign exam** → **Email link**.
   3. Open the link on your phone or another computer and complete the exam.
   4. Evaluate and finalise the result.

## 4. Updating the system

Push changes to GitHub (GitHub Desktop: **Commit** → **Push**). Render redeploys automatically in about 2 minutes.

- **Avoid deploying while candidates are taking exams.** A service with a disk restarts during a deploy, so there is about a minute of downtime.
- Answers that are already saved are safe and autosave retries, but the exam timer keeps running during the restart. Schedule updates outside exam windows, or turn off *Auto-Deploy* in Render and deploy manually.

## 5. Custom domain (optional)

1. In Render, open the service → **Settings → Custom Domains** and add, for example, `exams.activemindsit.com`.
2. Create the CNAME record Render shows at your DNS provider. Render issues the HTTPS certificate automatically.
3. Set `APP_BASE_URL=https://exams.activemindsit.com` (Environment tab). This makes new exam links use your domain. Links sent earlier keep working on the onrender.com address.

## 6. Backups and data

- **Render snapshots:** Render takes daily snapshots of the disk and keeps them for at least 7 days (service → **Disks**).
- **Your own copies:** also export regularly from **Reports & Export**, or connect Google Sheets or SharePoint sync (Settings → Backend sync) so every record is copied to Microsoft 365 or Google.
- **One instance only:** the service runs a single instance, since SQLite is on one disk. That comfortably serves hundreds of simultaneous candidates.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on `better-sqlite3` | Check that `NODE_VERSION` is 22 (set in `render.yaml`). Then **Manual Deploy → Clear build cache & deploy** |
| "FATAL: APP_SECRET must be set" | The `APP_SECRET` variable was deleted. Restore it from your records; a new value makes stored secrets and existing links unreadable |
| Exam links show `localhost` | Clear `APP_BASE_URL`, or set it to the public URL, then click **New link** or **Email link** again |
| Emails not arriving | Settings → Email → **Send test email**, and check the error shown. For Microsoft 365, SMTP AUTH must be enabled for the mailbox |
| Signed out immediately | Open the site with `https://` (the cookies are secure-only) |
