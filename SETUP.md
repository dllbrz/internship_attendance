# Naic OJT — Supabase + GitHub + Vercel Setup Guide

This app is a **Supabase-backed** static website that can be hosted on **Vercel** from **GitHub**. Follow these steps to make registration, login, email verification, password reset, intern dashboards, admin dashboards, attendance, requirements, and file uploads work in production.

---

## Step 1 — Get your Supabase project keys

1. Go to <https://supabase.com/dashboard> and open (or create) your project.
2. Left sidebar → **Project Settings** → **API**.
3. Copy two values:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **Project API key → anon / public**

## Step 2 — Paste your Supabase keys into `js/supabase-config.js`

Open `js/supabase-config.js` and replace the two placeholder values:

```js
window.SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
window.SUPABASE_ANON_KEY = "YOUR-PUBLIC-ANON-KEY";
```

> These are **publishable** keys. They are safe to include in client-side code — Row-Level Security (RLS) protects your data on the server side.

## Step 3 — Run or rerun the SQL schema

1. In your Supabase dashboard, open **SQL Editor** → **New Query**.
2. Copy the entire contents of `sql/schema.sql` from this project.
3. Paste and click **Run**.

This creates:
- `profiles` table (student data, linked to `auth.users`)
- `attendance`, `requirements`, `announcements` tables
- `user_roles` table + `has_role()` function
- Full **Row-Level Security** policies (students see their own data; admins see everything)
- A trigger that **auto-creates a profile and assigns the `student` role** on new signup (this satisfies the "auto-recognize new accounts" requirement)
- Two storage buckets: `avatars` (public) and `requirements` (private)
- Storage policies (users can only write to their own folder)
- `find_student_email_by_username()` function so interns can log in by username without exposing the `profiles` table publicly

The script is idempotent — safe to re-run. If login previously stayed on **Loading…**, rerun the latest `sql/schema.sql` because username login depends on the new safe lookup function.

## Step 4 — Configure Supabase Auth emails

1. Dashboard → **Authentication** → **Providers** → **Email**.
2. Turn **Email provider** ON.
3. Turn **Confirm email** ON for production.
4. Optional but recommended: enable **Secure email change** and leaked-password protection if your Supabase plan/settings show it.

### Auth URL settings

Go to **Authentication** → **URL Configuration**:

- **Site URL**: your Vercel production URL, for example:
  - `https://your-project.vercel.app`
- **Redirect URLs**: add every URL pattern you use, for example:
  - `https://your-project.vercel.app/**`
  - `http://localhost:8000/**`

If your app is served inside `/naic_ojt-main/`, the app automatically generates the correct redirect paths such as:

- `https://your-project.vercel.app/naic_ojt-main/login-student.html?verified=1`
- `https://your-project.vercel.app/naic_ojt-main/reset-password.html`

### Email confirmation template

Go to **Authentication** → **Email Templates** → **Confirm signup** and make sure the email includes the confirmation token/code. Example message body:

```html
<h2>Confirm your Naic OJT account</h2>
<p>Your confirmation code is:</p>
<h1>{{ .Token }}</h1>
<p>Enter this code on the Naic OJT signup verification screen.</p>
<p>You can also confirm by opening this link:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm account</a></p>
```

### Password reset template

Go to **Authentication** → **Email Templates** → **Reset Password** and make sure the email includes the reset token/code. Example message body:

```html
<h2>Reset your Naic OJT password</h2>
<p>Your password reset code is:</p>
<h1>{{ .Token }}</h1>
<p>Enter this code on the Naic OJT reset password screen.</p>
<p>You can also open this reset page:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
```

The app now has:

- `forgot-password.html` — sends the password reset email
- `reset-password.html` — verifies the OTP/code and saves the new password
- Signup verification form — verifies the email confirmation OTP/code

## Step 5 — Create your first admin

Admins are created manually (there is no public admin signup):

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Fill in:
   - Email: `admin@naic.gov.ph` (or any email you want)
   - Password: choose a strong password
   - **Auto Confirm User**: ON
3. Copy the new user's **UUID**.
4. Open **SQL Editor** and run:

```sql
insert into public.user_roles(user_id, role)
values ('PASTE-UUID-HERE','admin');
```

Now you can sign in on `login-admin.html` with that email + password.

## Step 6 — Run the site locally

The site is pure static HTML/JS. Options:

```bash
cd naic-ojt
python -m http.server 8000
# open http://localhost:8000
```

Use local testing for layout and basic navigation. Email verification and password reset must use redirect URLs that are allowed in Supabase.

## Step 7 — Push to GitHub

1. Open your project folder in VS Code or your terminal.
2. Commit the fixed files.
3. Push to the GitHub repository connected to Vercel.

```bash
git status
git add .
git commit -m "Fix auth loading and add password reset"
git push origin main
```

## Step 8 — Deploy on Vercel

1. Go to <https://vercel.com/dashboard>.
2. Open the project connected to your GitHub repo.
3. Go to **Settings** → **Build and Output Settings**.
4. For a pure static deployment of this folder, use:
   - **Build Command**: leave blank, or use `echo "No build required"`
   - **Output Directory**: `.` if deploying the static folder itself
5. If you are deploying this Lovable wrapper project, keep the default install/build flow. The root page redirects to `/naic_ojt-main/`.
6. Click **Deployments** → redeploy the latest GitHub commit.

After Vercel gives you a URL, add that URL to Supabase **Authentication → URL Configuration → Redirect URLs**.

> The camera QR scanner needs HTTPS (all the hosts above provide it automatically).

## Step 9 — Full production test checklist

Test in this order:

1. Open your Vercel URL.
2. Go to **Intern Login** → **Create an account**.
3. Register with a real email address.
4. Check the inbox for the confirmation code.
5. Enter the code on the signup verification form.
6. Sign in as the intern.
7. Confirm the intern dashboard loads instead of staying on **Loading…**.
8. Sign out.
9. Go to **Forgot password**.
10. Request a reset code.
11. Open `reset-password.html`, enter the email, OTP/code, and new password.
12. Sign in with the new password.
13. Create or confirm an admin user, then test admin login.
14. Test QR scanner and requirement uploads over HTTPS.

---

## What was corrected

### General
- Fixed the stuck **Loading…** issue caused by invalid inline script wrappers and missing database-safe username lookup.
- Session/navigation now uses Supabase Auth with persistent sessions.
- Page load failures now show a clear error instead of silently staying on **Loading…**.
- Intern signup now supports email confirmation code verification.
- Intern forgot-password/reset-password now supports OTP/code email reset.
- All emoji icons removed → replaced with consistent **dark-blue inline SVG icons** in `js/app.js` (`ICONS` object).

### Intern module
- **Profile:** avatar is displayed from Supabase Storage (`avatars` bucket).
- **My Requirements:** `<input type="file" multiple>` — upload many files in one go.

### Admin module
- **Auto-recognized signups:** the `handle_new_user()` trigger creates the profile with `active=true` and assigns the `student` role automatically — no "unrecognized" state.
- **Students edit form:** only Start Date, End Date, Required Hours.
- **Attendance page:**
  - Every active student appears automatically.
  - Only Time In/Out, Status, Hours refresh (30-second poll).
  - Today's records by default (date picker to change).
  - Status tabs: All / Present / Late / Absent (replaces "All Year").
  - **Auto-Absent Rule**: `autoMarkAbsent()` in `js/data.js` inserts an `absent` record for any active student without a scan-in 1 hour after their expected time-in (default 08:00, per-student via `profiles.expected_time_in`).
  - "Delete All (Today)" button top-right.
- **Scanner:** auto-recognize on scan; Remarks column shows only the status (Present/Late/Absent) — no timestamp.

---

## File layout

```
naic-ojt/
├── index.html
├── login-admin.html, login-student.html, signup-student.html
├── forgot-password.html, reset-password.html
├── css/styles.css                 (dark-blue icon styles added)
├── js/
│   ├── supabase-config.js         ← EDIT THIS with your keys
│   ├── data.js                    ← Supabase data layer (async)
│   └── app.js                     ← sidebar/topbar + SVG icons
├── sql/schema.sql                 ← RUN THIS in Supabase SQL Editor
├── student/  (dashboard, attendance, profile, requirements, reports, notifications)
├── admin/    (dashboard, students, attendance, scanner, archived, reports, announcements, account)
└── assets/
```

## Troubleshooting

- **Still stuck on Loading…** → open browser DevTools Console. Most likely causes are: old files not redeployed, `sql/schema.sql` not rerun, or Supabase RLS/schema errors. Redeploy Vercel and rerun the latest SQL.
- **Username login fails** → rerun `sql/schema.sql` so `find_student_email_by_username()` exists. Email login should still work.
- **"Invalid credentials"** on login → make sure Email auth is enabled, the account is confirmed, and the user has the right role in `user_roles`.
- **No verification/reset email arrives** → check Supabase Authentication email settings, redirect URLs, spam folder, and email template content. Make sure the template contains `{{ .Token }}` if you want users to type an OTP/code.
- **Signup does nothing / no profile created** → run `sql/schema.sql` again; ensure the trigger `on_auth_user_created` exists.
- **Can't upload avatar or files** → ensure the two storage buckets exist and the storage policies at the bottom of `schema.sql` were applied.
- **Camera doesn't open in scanner** → HTTPS or `localhost` is required by browsers for camera access.
- **Redirected to login unexpectedly** → the session may have expired. Sign in again; Supabase Auth then persists across page navigations (this was the root cause of the previous navigation bug).

Do **not** commit Supabase service-role keys or private secrets. Only the Supabase URL and anon/public key belong in `js/supabase-config.js`.
