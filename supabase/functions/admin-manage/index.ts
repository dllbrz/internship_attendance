// Supabase Edge Function: admin-manage
// Deploy:  supabase functions deploy admin-manage --no-verify-jwt
// Env vars (set automatically by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
//
// Actions (POST JSON body):
//   { action: "list" }
//   { action: "create", email, password, full_name }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing bearer token" }, 401);

  // Identify caller
  const anon = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
  const callerId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
