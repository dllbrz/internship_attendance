-- ============================================================================
-- Naic OJT Attendance System — Supabase schema
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- roles enum ----------
do $$ begin
  create type public.app_role as enum ('admin','student');
exception when duplicate_object then null; end $$;

-- ---------- user_roles ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- ---------- has_role() security definer ----------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role);
$$;

-- ---------- profiles (student profile linked to auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  intern_id text unique not null,
  username text unique,
  full_name text not null,
  email text,
  school text,
  course text,
  phone text,
  address text,
  adviser_name text,
  adviser_contact text,
  required_hours int not null default 486,
  start_date date not null default current_date,
  end_date date not null default (current_date + interval '120 days'),
  expected_time_in time not null default '08:00',
  active boolean not null default true,   -- newly registered = auto-accepted
  avatar_url text,
  qr_token text unique not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "students read own profile" on public.profiles;
create policy "students read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "students update own profile" on public.profiles;
create policy "students update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (true);

drop policy if exists "admins delete profile" on public.profiles;
create policy "admins delete profile" on public.profiles
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- profile is auto-created by the trigger below; no INSERT policy needed for clients.

-- ---------- attendance ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  time_in time,
  time_out time,
  hours numeric(5,2) not null default 0,
  status text not null default 'absent'  check (status in ('present','late','absent')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(student_id, date)
);
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

drop policy if exists "students read own attendance" on public.attendance;
create policy "students read own attendance" on public.attendance
  for select to authenticated using (auth.uid() = student_id);

drop policy if exists "admins read all attendance" on public.attendance;
create policy "admins read all attendance" on public.attendance
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "students insert own attendance" on public.attendance;
create policy "students insert own attendance" on public.attendance
  for insert to authenticated with check (auth.uid() = student_id);

drop policy if exists "students update own attendance" on public.attendance;
create policy "students update own attendance" on public.attendance
  for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);

drop policy if exists "admins write attendance" on public.attendance;
create policy "admins write attendance" on public.attendance
  for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (true);

-- ---------- requirements (file uploads) ----------
create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  label text,
  file_name text not null,
  file_path text not null,          -- object path in storage bucket 'requirements'
  file_type text,
  file_size int,
  uploaded_at timestamptz not null default now()
);
grant select, insert, update, delete on public.requirements to authenticated;
grant all on public.requirements to service_role;
alter table public.requirements enable row level security;

drop policy if exists "students manage own requirements" on public.requirements;
create policy "students manage own requirements" on public.requirements
  for all to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);

drop policy if exists "admins read all requirements" on public.requirements;
create policy "admins read all requirements" on public.requirements
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ---------- announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  author text,
  created_at timestamptz not null default now()
);
grant select on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;

drop policy if exists "all authenticated read announcements" on public.announcements;
create policy "all authenticated read announcements" on public.announcements
  for select to authenticated using (true);

drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements
  for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (true);

-- ============================================================================
-- Trigger: auto-create profile + assign 'student' role on new signup.
-- The signup form passes extra fields via raw_user_meta_data (options.data).
-- New accounts are AUTO-RECOGNIZED (active=true) — no admin approval needed.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  next_num int;
  new_intern_id text;
  meta jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
  is_admin boolean := coalesce((meta->>'is_admin')::boolean, false);
  yr int := extract(year from now())::int;
begin
  if is_admin then
    insert into public.user_roles(user_id, role) values (new.id, 'admin')
      on conflict do nothing;
    return new;
  end if;

  -- generate OJT-YYYY-NNN
  select coalesce(max(substring(intern_id from '\d+$')::int),0)+1
    into next_num
    from public.profiles
    where intern_id like 'OJT-'||yr||'-%';

  new_intern_id := 'OJT-'||yr||'-'||lpad(next_num::text,3,'0');

  insert into public.profiles(
    id, intern_id, username, full_name, email, school, course, phone, address,
    adviser_name, adviser_contact, required_hours, start_date, end_date,
    active, qr_token
  ) values (
    new.id,
    new_intern_id,
    coalesce(meta->>'username', split_part(new.email,'@',1)),
    coalesce(meta->>'full_name','New Intern'),
    new.email,
    coalesce(meta->>'school',''),
    coalesce(meta->>'course',''),
    coalesce(meta->>'phone',''),
    coalesce(meta->>'address',''),
    coalesce(meta->>'adviser_name',''),
    coalesce(meta->>'adviser_contact',''),
    coalesce(nullif(meta->>'required_hours','')::int, 486),
    coalesce(nullif(meta->>'start_date','')::date, current_date),
    coalesce(nullif(meta->>'end_date','')::date, current_date + interval '120 days'),
    true,  -- AUTO-ACCEPTED
    'NAIC-OJT-'||new_intern_id||'-'||upper(substr(md5(random()::text),1,8))
  );

  insert into public.user_roles(user_id, role) values (new.id, 'student')
    on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Storage buckets
-- Run these lines separately if the schema errors: buckets already exist.
-- ============================================================================
insert into storage.buckets(id, name, public) values ('avatars','avatars',true)
  on conflict (id) do update set public = true;
insert into storage.buckets(id, name, public) values ('requirements','requirements',false)
  on conflict (id) do nothing;

-- avatars: public-read, users write only their own folder (path = <uid>/...)
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars user upload" on storage.objects;
create policy "avatars user upload" on storage.objects
  for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars user update" on storage.objects;
create policy "avatars user update" on storage.objects
  for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars user delete" on storage.objects;
create policy "avatars user delete" on storage.objects
  for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- requirements: private. Owner + admin can read; owner can write to own folder.
drop policy if exists "requirements owner read" on storage.objects;
create policy "requirements owner read" on storage.objects
  for select to authenticated
  using (bucket_id='requirements' and ((storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(),'admin')));

drop policy if exists "requirements owner write" on storage.objects;
create policy "requirements owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id='requirements' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "requirements owner update" on storage.objects;
create policy "requirements owner update" on storage.objects
  for update to authenticated
  using (bucket_id='requirements' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "requirements owner delete" on storage.objects;
create policy "requirements owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id='requirements' and ((storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(),'admin')));

-- ---------- safe username login helper ----------
-- Allows the login page to resolve a username to an email address without making
-- the profiles table publicly readable. Required by js/data.js loginStudent().
create or replace function public.find_student_email_by_username(_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(_username))
    and active = true
  limit 1;
$$;

grant execute on function public.find_student_email_by_username(text) to anon, authenticated;

-- ============================================================================
-- One-time seed of an admin user (optional):
--   1) In Supabase Dashboard → Authentication → Users → Add user
--      email = admin@naic.gov.ph, password = <choose one>, Auto-confirm = ON
--   2) Copy the new user's UUID, then run:
--        insert into public.user_roles(user_id, role) values ('<paste-uuid>','admin');
-- ============================================================================
