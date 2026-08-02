// Supabase Edge Function: admin-manage
// Deploy:  supabase functions deploy admin-manage --no-verify-jwt
// Env vars (set automatically by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
//
// Actions (POST JSON body):
//   { action: "list" }
//   { action: "create", email, password, full_name }
//   { action: "invite", email, full_name, redirect_to }
//   { action: "send_credentials", full_name }
//   { action: "delete", user_id }
//
// Caller must send Authorization: Bearer <access_token> of a signed-in admin.
// The function verifies that user has the 'admin' role in user_roles before
// performing any privileged action.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}


// ---------------------------------------------------------------------------
// Mailer: uses SMTP when SMTP_* secrets are set, otherwise Resend, otherwise
// silently reports "not configured" so the onboarding flow never breaks.
// ---------------------------------------------------------------------------
async function sendAdminMail(
  to: string,
  subject: string,
  html: string,
): Promise<{ emailed: boolean; reason?: string }> {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM") || user || "";
  if (host && user && pass) {
    try {
      const { SMTPClient } = await import(
        "https://deno.land/x/denomailer@1.6.0/mod.ts"
      );
      const port = Number(Deno.env.get("SMTP_PORT") || "465");
      const client = new SMTPClient({
        connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } },
      });
      await client.send({ from, to, subject, html, content: "text/html" });
      await client.close();
      return { emailed: true };
    } catch (e) {
      return { emailed: false, reason: (e as Error).message };
    }
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return { emailed: false, reason: "mailer_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("ADMIN_MAIL_FROM") ||
        "Engineering Office <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) return { emailed: false, reason: await res.text() };
  return { emailed: true };
}

// ---------------------------------------------------------------------------
// Shared branded email shell — one consistent look for every admin email.
// ---------------------------------------------------------------------------
function mailShell(opts: {
  kicker: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}) {
  const btn = opts.ctaUrl && opts.ctaLabel
    ? `<p style="margin:28px 0 8px"><a href="${opts.ctaUrl}" style="background:#12305c;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:10px;display:inline-block;font-weight:700;font-size:15px;letter-spacing:.01em">${opts.ctaLabel}</a></p>`
    : "";
  return `
  <div style="font-family:Poppins,Segoe UI,Arial,sans-serif;background:#f5f7fb;padding:32px 16px">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e9f0">
      <div style="background:#12305c;color:#ffffff;padding:24px 28px">
        <div style="font-size:12px;letter-spacing:.14em;opacity:.75;text-transform:uppercase">${opts.kicker}</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px">${opts.heading}</div>
      </div>
      <div style="padding:28px;color:#1f2937;font-size:15px;line-height:1.65">
        ${opts.body}
        ${btn}
        ${opts.footnote ? `<p style="color:#6b7280;font-size:13px;margin-top:24px">${opts.footnote}</p>` : ""}
      </div>
      <div style="background:#f8fafc;border-top:1px solid #eef1f6;padding:16px 28px;color:#94a3b8;font-size:12px">
        Municipality of Naic &middot; Engineering Office &middot; OJT Attendance &amp; Internship Monitoring System
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ||
    req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === ANON) return json({ error: "Missing bearer token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Identify caller. Validate with the service-role client first: it does not
  // depend on SUPABASE_ANON_KEY being present in the function env (newer
  // projects ship publishable keys instead), which is a common cause of a
  // spurious "Invalid session".
  let callerId = "";
  {
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (!userErr && userRes?.user) {
      callerId = userRes.user.id;
    } else if (ANON) {
      const anon = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false },
      });
      const alt = await anon.auth.getUser(jwt);
      if (alt.data?.user) callerId = alt.data.user.id;
    }
    if (!callerId) {
      return json(
        { error: "Invalid session — please sign out and sign in again." },
        401,
      );
    }
  }

  // Verify caller is admin
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  if (roleErr) return json({ error: roleErr.message }, 500);
  if (!(roles || []).some((r) => r.role === "admin")) {
    return json({ error: "Forbidden: admin role required" }, 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const action = String(body.action || "");

  try {
    if (action === "list") {
      const { data: adminRoles, error } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (error) throw error;
      const ids = (adminRoles || []).map((r) => r.user_id);
      const admins: Array<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        is_self: boolean;
      }> = [];
      // Auth Admin API pagination — fetch pages until we've found every id.
      const wanted = new Set(ids);
      let page = 1;
      const perPage = 200;
      while (wanted.size > 0) {
        const { data, error: listErr } = await admin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (listErr) throw listErr;
        const users = data?.users || [];
        for (const u of users) {
          if (wanted.has(u.id)) {
            admins.push({
              id: u.id,
              email: u.email || "",
              name:
                (u.user_metadata?.full_name as string) ||
                (u.user_metadata?.name as string) ||
                (u.email || "").split("@")[0],
              created_at: u.created_at,
              is_self: u.id === callerId,
            });
            wanted.delete(u.id);
          }
        }
        if (users.length < perPage) break;
        page += 1;
      }
      admins.sort((a, b) => a.email.localeCompare(b.email));
      return json({ admins });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const full_name = String(body.full_name || "").trim();
      if (!email || !password || password.length < 8) {
        return json(
          { error: "Email and a password of 8+ characters are required." },
          400,
        );
      }

      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr) return json({ error: createErr.message }, 400);
      const newId = created.user!.id;

      const { error: roleInsErr } = await admin
        .from("user_roles")
        .insert({ user_id: newId, role: "admin" });
      if (roleInsErr) {
        // roll back the created user so we don't leave an orphan
        await admin.auth.admin.deleteUser(newId);
        return json({ error: roleInsErr.message }, 500);
      }
      return json({ ok: true, user_id: newId });
    }

    // Email an invitation link instead of setting a password manually.
    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const full_name = String(body.full_name || "").trim();
      const redirectTo = String(body.redirect_to || "");
      if (!email || !email.includes("@")) {
        return json({ error: "A valid email address is required." }, 400);
      }

      const { data: invited, error: inviteErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name, invited_as: "admin" },
          redirectTo: redirectTo || undefined,
        });
      if (inviteErr) return json({ error: inviteErr.message }, 400);
      const newId = invited.user!.id;

      const { error: roleInsErr } = await admin
        .from("user_roles")
        .upsert({ user_id: newId, role: "admin" }, { onConflict: "user_id,role" });
      if (roleInsErr) return json({ error: roleInsErr.message }, 500);

      return json({ ok: true, user_id: newId, invited: true });
    }

    // Send the "your admin account is ready" confirmation email. Called by
    // admin-setup-password.html right after an invited admin sets a password.
    // Requires a RESEND_API_KEY secret; if it is not set this is a no-op so
    // the setup flow never breaks.
    if (action === "setup_complete") {
      const { data: meRes } = await admin.auth.getUser(jwt);
      const email = meRes?.user?.email || "";
      const name =
        (meRes?.user?.user_metadata?.full_name as string) ||
        (email || "").split("@")[0];
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM = Deno.env.get("ADMIN_MAIL_FROM") ||
        "Engineering Office <onboarding@resend.dev>";
      const LOGIN_URL = Deno.env.get("ADMIN_LOGIN_URL") || "";
      if (!RESEND_API_KEY || !email) {
        return json({ ok: true, emailed: false, reason: "mailer_not_configured" });
      }
      const html = mailShell({
        kicker: "Engineering Office",
        heading: `Welcome aboard, ${name}`,
        body: `<p>Your administrator workspace is live. Sign in with <strong>${email}</strong> and the password you just created.</p>
               <p>From the dashboard you can review daily attendance, verify intern hours, manage requirements and publish announcements.</p>`,
        ctaLabel: "Open the Admin Dashboard",
        ctaUrl: LOGIN_URL,
        footnote: "Didn't set this up? Contact the Engineering Office right away.",
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: "Your admin access is live",
          html,
        }),
      });
      if (!res.ok) {
        return json({ ok: true, emailed: false, reason: await res.text() });
      }
      return json({ ok: true, emailed: true });
    }

    // Invited admin clicked "Accept invitation": generate a password for the
    // account, set it, and email the credentials to the invited address.
    if (action === "send_credentials") {
      const { data: me } = await admin.auth.getUser(jwt);
      const email = me?.user?.email || "";
      const full_name = String(body.full_name || "").trim() ||
        (me?.user?.user_metadata?.full_name as string) ||
        (email || "").split("@")[0];
      if (!email) return json({ error: "No email on this account." }, 400);

      // Strong random password (16 chars, mixed classes).
      const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const password = Array.from(bytes, (b) => chars[b % chars.length]).join("");

      const { error: updErr } = await admin.auth.admin.updateUserById(callerId, {
        password,
        user_metadata: { ...(me?.user?.user_metadata || {}), full_name },
      });
      if (updErr) return json({ error: updErr.message }, 400);

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM = Deno.env.get("ADMIN_MAIL_FROM") ||
        "Engineering Office <onboarding@resend.dev>";
      const LOGIN_URL = Deno.env.get("ADMIN_LOGIN_URL") || "";
      if (!RESEND_API_KEY) {
        // Mailer not configured — return the password so the page can show it.
        return json({ ok: true, emailed: false, password, reason: "mailer_not_configured" });
      }

      const html = mailShell({
        kicker: "Engineering Office",
        heading: `Your admin keys, ${full_name}`,
        body: `<p>Your administrator account is active. Use the details below for your first sign-in:</p>
               <table style="border-collapse:collapse;margin:18px 0;font-size:15px">
                 <tr><td style="padding:6px 16px 6px 0;color:#6b7280">Email</td><td style="font-weight:700">${email}</td></tr>
                 <tr><td style="padding:6px 16px 6px 0;color:#6b7280">Temporary password</td><td style="font-weight:700;font-family:ui-monospace,Menlo,monospace;font-size:16px">${password}</td></tr>
               </table>
               <p style="color:#b45309"><strong>Swap this for a password only you know</strong> under Account &rarr; Change Password.</p>`,
        ctaLabel: "Sign in now",
        ctaUrl: LOGIN_URL,
        footnote: "Not expecting this email? Contact the Engineering Office right away.",
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: "Your admin sign-in details",
          html,
        }),
      });
      if (!res.ok) {
        return json({ ok: true, emailed: false, password, reason: await res.text() });
      }
      return json({ ok: true, emailed: true, email });
    }

    // Invited admin submitted the onboarding form on
    // admin-setup-password.html: save profile details + their chosen password,
    // mark the account activated, then email a confirmation.
    if (action === "complete_setup") {
      const { data: me } = await admin.auth.getUser(jwt);
      const user = me?.user;
      const email = user?.email || "";
      if (!email) return json({ error: "No email on this account." }, 400);

      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      if (meta["admin_activated"] === true) {
        return json(
          { error: "This invitation has already been used. Please sign in instead." },
          400,
        );
      }

      const full_name = String(body.full_name || "").trim();
      const position = String(body.position || "").trim();
      const contact = String(body.contact || "").trim();
      const password = String(body.password || "");
      if (!full_name) return json({ error: "Full name is required." }, 400);
      if (password.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, 400);
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(callerId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...meta,
          full_name,
          position,
          contact,
          invited_as: "admin",
          admin_activated: true,
          activated_at: new Date().toISOString(),
        },
      });
      if (updErr) return json({ error: updErr.message }, 400);

      // Make sure the admin role row exists (idempotent).
      await admin
        .from("user_roles")
        .upsert({ user_id: callerId, role: "admin" }, {
          onConflict: "user_id,role",
        });

      const LOGIN_URL = Deno.env.get("ADMIN_LOGIN_URL") || "";
      const html = mailShell({
        kicker: "Engineering Office",
        heading: `You're all set, ${full_name}`,
        body: `<p>Your administrator account is active. Sign in with <strong>${email}</strong> and the password you chose during registration.</p>
               <p>You now have full access to attendance monitoring, intern records, requirements and announcements.</p>`,
        ctaLabel: "Open the Admin Dashboard",
        ctaUrl: LOGIN_URL,
        footnote: "Didn't set this up? Contact the Engineering Office right away.",
      });
      const mail = await sendAdminMail(
        email,
        "Your admin access is live",
        html,
      );
      return json({ ok: true, email, emailed: mail.emailed, reason: mail.reason });
    }

    if (action === "delete") {

      const target = String(body.user_id || "");
      if (!target) return json({ error: "user_id required" }, 400);
      if (target === callerId) {
        return json({ error: "You cannot delete your own admin account." }, 400);
      }
      // Confirm target is actually an admin (avoid using this endpoint to
      // delete arbitrary users).
      const { data: targetRoles, error: trErr } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target);
      if (trErr) throw trErr;
      if (!(targetRoles || []).some((r) => r.role === "admin")) {
        return json({ error: "Target user is not an admin." }, 400);
      }
      // Deleting the auth user cascades to user_roles via FK.
      const { error: delErr } = await admin.auth.admin.deleteUser(target);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});
