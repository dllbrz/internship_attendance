# Admin management — Supabase edge function

The "Account" page (`admin/account.html`) now manages administrators through a
Supabase Edge Function (`supabase/functions/admin-manage/index.ts`) backed by
the `user_roles` table. No more localStorage `db.admins`.

## Deploy once

```bash
# From the project root, with the Supabase CLI linked to your project:
supabase functions deploy admin-manage --no-verify-jwt
```

`--no-verify-jwt` is used because the function performs its own JWT check
(it calls `auth.getUser(jwt)` and verifies the caller has the `admin` role in
`user_roles` before doing anything privileged).

## Required env vars

These are provided automatically by Supabase to every edge function:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nothing to configure manually.

## Actions

`POST` to `/functions/v1/admin-manage` with JSON:

- `{ "action": "list" }` — returns `{ admins: [{ id, email, name, created_at, is_self }] }`
- `{ "action": "create", "email", "password", "full_name" }` — creates a
  confirmed Auth user and inserts an `admin` row in `user_roles`.
- `{ "action": "delete", "user_id" }` — deletes the Auth user (cascades to
  `user_roles`). Self-delete is blocked.

## Bootstrap the first admin

The function refuses non-admin callers, so you still need one admin to exist
before you can add more. Create the first admin manually in Supabase:

```sql
-- After signing that user up (or creating them in Auth → Users), grab their UUID:
insert into public.user_roles (user_id, role)
values ('<uuid-of-first-admin>', 'admin');
```

From then on, all admin add/remove flows go through the Account page.
