-- ============================================================================
-- Naic OJT — (1) "Absent / Excused (Not Credited) / Other" schedule types
--               (2) Scheduled announcements (publish in advance)
-- Run ONCE in Supabase Dashboard -> SQL Editor, AFTER sql/schema.sql,
-- sql/migration-credited-schedule.sql and sql/migration-regular-day.sql.
-- Idempotent: safe to re-run. Nothing is deleted; existing rows are untouched.
-- ============================================================================

-- ---------- 1) attendance.credit_type: allow the new types ----------
alter table public.attendance add column if not exists credit_type text;
alter table public.attendance add column if not exists note        text;
alter table public.attendance add column if not exists credited_by uuid;

alter table public.attendance drop constraint if exists attendance_credit_type_chk;

alter table public.attendance
  add constraint attendance_credit_type_chk
  check (credit_type is null or credit_type in
    ('regular','rest_day','reward','excused','excused_uncredited','absent',
     'holiday','offsite','makeup','other'));

create index if not exists attendance_credit_type_idx
  on public.attendance (credit_type);

-- ---------- 2) announcements: schedule in advance ----------
-- publish_at = the moment interns start seeing the announcement.
-- Existing announcements keep their original date (created_at).
alter table public.announcements
  add column if not exists publish_at timestamptz;

update public.announcements set publish_at = created_at where publish_at is null;

alter table public.announcements
  alter column publish_at set default now();

create index if not exists announcements_publish_at_idx
  on public.announcements (publish_at desc);

-- Interns must not receive announcements that are still scheduled.
-- (Admins keep full access so they can review and edit scheduled posts.)
alter table public.announcements enable row level security;

drop policy if exists "read published announcements" on public.announcements;
create policy "read published announcements" on public.announcements
  for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or coalesce(publish_at, created_at) <= now()
  );

drop policy if exists "admins write announcements" on public.announcements;
create policy "admins write announcements" on public.announcements
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

grant select on public.announcements to authenticated;
grant all    on public.announcements to service_role;