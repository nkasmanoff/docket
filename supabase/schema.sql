-- Docket access control. Run this in the Supabase SQL editor (or via the CLI)
-- once per project. Add a row per email you want to let in.
--
-- Emails are matched case-insensitively against the signed-in user's email,
-- so always store them lowercase.

create table if not exists public.allowed_users (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

-- A signed-in user may read ONLY their own row, just enough to confirm
-- membership at login. They cannot enumerate the rest of the allowlist.
-- (Editing the list is done from the dashboard / service role, which bypasses
-- RLS — no insert/update/delete policy is granted to normal users.)
drop policy if exists "read own allowlist row" on public.allowed_users;
create policy "read own allowlist row"
  on public.allowed_users
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = email);

-- Seed the owner. Add more emails the same way, or from the Table editor.
insert into public.allowed_users (email, note)
values ('nkasmanoff@gmail.com', 'owner')
on conflict (email) do nothing;
