-- Consent-based session verification and new-device sign-in alerts.
-- No photo is ever captured without an explicit, recorded consent event.

create table if not exists public.login_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 128),
  user_agent text,
  ip text,
  country text,
  region text,
  city text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  alert_sent_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists login_devices_user_idx on public.login_devices(user_id);
create index if not exists login_devices_last_seen_idx on public.login_devices(last_seen_at);

create table if not exists public.session_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  consent_version text not null,
  consented_at timestamptz not null,
  image_path text not null,
  mime_type text not null default 'image/jpeg',
  ip text,
  user_agent text,
  country text,
  region text,
  city text,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists session_verifications_user_idx on public.session_verifications(user_id, created_at desc);
create index if not exists session_verifications_device_idx on public.session_verifications(user_id, device_id, created_at desc);
create index if not exists session_verifications_created_idx on public.session_verifications(created_at);

alter table public.login_devices enable row level security;
alter table public.session_verifications enable row level security;

drop policy if exists "Users can view their login devices" on public.login_devices;
create policy "Users can view their login devices" on public.login_devices
  for select using (user_id = auth.uid());

drop policy if exists "Users can register their login devices" on public.login_devices;
create policy "Users can register their login devices" on public.login_devices
  for insert with check (user_id = auth.uid());

drop policy if exists "Users can update their login devices" on public.login_devices;
create policy "Users can update their login devices" on public.login_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Users may review their own consent history. Writes and photo deletion go
-- through server routes using the service key so storage objects stay in sync.
drop policy if exists "Users can view their verifications" on public.session_verifications;
create policy "Users can view their verifications" on public.session_verifications
  for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-verifications',
  'session-verifications',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- No storage.objects policies on purpose: only the service role can read or
-- write verification photos. Admins receive short-lived signed URLs by email.
