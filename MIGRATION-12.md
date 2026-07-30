# Item 12 — Admin Invitation Link & Password Setup Flow

Files in this zip (drop them into your repo, keeping the same paths):

```
admin-setup-password.html                 (NEW — "Set Your Password" portal)
js/data.js                                (UPDATED — invite redirect + notifyAdminSetupComplete)
supabase/functions/admin-manage/index.ts  (UPDATED — new "setup_complete" action)
```

---

## 1. Supabase → Auth → Email Templates → "Invite user"

The default template renders the URL as plain text. Replace the template body with:

```html
<h2>You're invited to the Engineering Office OJT System</h2>
<p>Hello,</p>
<p>You have been invited to join the <strong>OJT Attendance &amp; Internship Monitoring System</strong> as an administrator.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="background:#12305c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600;font-family:Arial,sans-serif">
    Accept invitation
  </a>
</p>
<p style="font-size:13px;color:#6b7280">
  If the button does not work, copy this link into your browser:<br>
  <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
</p>
<p style="font-size:13px;color:#6b7280">This link expires in 24 hours.</p>
```

Save. (Dashboard path: **Authentication → Emails → Invite user**.)

## 2. Supabase → Authentication → URL Configuration

Add the setup portal to **Redirect URLs** (one line each, for every domain you use):

```
https://YOUR-VERCEL-DOMAIN.vercel.app/admin-setup-password.html
http://localhost:5500/admin-setup-password.html
```

Without this, Supabase silently drops the `redirect_to` and the invite lands on your Site URL instead.

## 3. Redeploy the edge function

```bash
supabase functions deploy admin-manage --no-verify-jwt
```

## 4. Confirmation email after password is saved (optional but requested)

Supabase Auth has no API for arbitrary transactional email, so the new
`setup_complete` action sends it through **Resend** (free tier is enough).

1. Create an account at resend.com, verify your sending domain (or use the test
   sender `onboarding@resend.dev` while testing), and copy an API key.
2. Set the secrets:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set ADMIN_MAIL_FROM="Engineering Office <no-reply@yourdomain.com>"
supabase secrets set ADMIN_LOGIN_URL="https://YOUR-VERCEL-DOMAIN.vercel.app/login-admin.html"
```

3. Redeploy the function (step 3) so it picks up the secrets.

If `RESEND_API_KEY` is not set, the flow still works end to end — the function
just returns `{ ok:true, emailed:false }` and no confirmation email is sent.

## 5. Database

**No schema changes required.** The invited user already gets their `admin` row
in `public.user_roles` from the existing `invite` action.

## 6. Vercel

Nothing to configure — `admin-setup-password.html` is a static file served at
`/admin-setup-password.html` after the next deploy. Just make sure the domain
you deploy to is the one listed in step 2.

---

## How the flow now works

1. Admin → Account page → **Send Invitation**.
2. Edge function calls `inviteUserByEmail` with
   `redirect_to = <your-site>/admin-setup-password.html`.
3. Invitee gets the email with a real **Accept invitation** button.
4. Clicking it verifies the token and opens the **Set Your Password** portal
   (handles both `#access_token=…` and `?token_hash=…&type=invite` links).
5. On save: password + full name are stored, `setup_complete` fires the
   confirmation email, the session is signed out, and the invitee is pointed at
   the Admin Login page.
