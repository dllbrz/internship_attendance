-- ============================================================================
-- Naic OJT Attendance System — schema UPGRADE (v2)
-- Run this ONCE in Supabase Dashboard → SQL Editor AFTER sql/schema.sql.
-- Idempotent: safe to re-run.
--
-- Adds:
--   * profiles.expected_time_out  — per-intern shift end
--   * profiles.break_minutes      — unpaid break (default 60 = one hour)
--   * attendance.deleted_at       — soft delete so deleted records land in the
--                                   Archive page and can be restored or purged
--   * public.app_settings         — global office/shift schedule shared by every
--                                   admin device (replaces localStorage-only)
-- ============================================================================

-- ---------- profiles: shift end + one-hour break ----------
alter table public.profiles
  add column if not exists expected_time_out time not null default '17:00';

alter table public.profiles
  add column if not exists break_minutes int not null default 60;

-- ---------- attendance: soft delete ----------
alter table public.attendance
  add column if not exists deleted_at timestamptz;

alter table public.attendance
  add column if not exists deleted_by uuid;

create index if not exists attendance_deleted_at_idx
  on public.attendance (deleted_at);

create index if not exists attendance_date_idx
  on public.attendance (date);

-- ---------- global office / shift schedule ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

drop policy if exists "authenticated read settings" on public.app_settings;
create policy "authenticated read settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "admins write settings" on public.app_settings;
create policy "admins write settings" on public.app_settings
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- seed the default office schedule row
insert into public.app_settings(key, value)
values (
  'office_schedule',
  jsonb_build_object(
    'start_time', '08:00',
    'end_time', '17:00',
    'grace_minutes', 15,
    'absent_after_minutes', 60,
    'break_minutes', 60
  )
)
on conflict (key) do nothing;
