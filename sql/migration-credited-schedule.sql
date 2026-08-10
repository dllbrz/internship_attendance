-- ============================================================================
-- Naic OJT — "Scheduled / Credited Day" upgrade
-- Run ONCE in Supabase Dashboard -> SQL Editor (after sql/schema.sql).
-- Idempotent: safe to re-run.
--
-- Adds to public.attendance:
--   * credit_type text  — 'rest_day' | 'reward' | 'excused' | 'holiday' |
--                         'offsite' | 'makeup'   (NULL = normal scanned day)
--   * note text         — admin remark shown to the intern
--   * credited_by uuid  — admin who granted it
-- Existing rows keep credit_type = NULL and behave exactly as before.
-- ============================================================================

alter table public.attendance add column if not exists credit_type   text;
alter table public.attendance add column if not exists note          text;
alter table public.attendance add column if not exists credited_by   uuid;

create index if not exists attendance_credit_type_idx
  on public.attendance (credit_type);

-- Allowed values (NULL always allowed = ordinary attendance record)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attendance_credit_type_chk'
  ) then
    alter table public.attendance
      add constraint attendance_credit_type_chk
      check (credit_type is null or credit_type in
        ('rest_day','reward','excused','holiday','offsite','makeup'));
  end if;
end $$;
