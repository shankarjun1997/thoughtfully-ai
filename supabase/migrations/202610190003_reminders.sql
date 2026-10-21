-- Web push subscriptions and event reminders for multi-tenant workspaces.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_workspace_idx on public.push_subscriptions(workspace_id);

create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id text not null,
  title text not null,
  category text not null default 'Personal',
  event_date date not null,
  notes text,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id, event_id)
);

create index if not exists event_reminders_due_idx on public.event_reminders(remind_at) where sent_at is null;
create index if not exists event_reminders_user_idx on public.event_reminders(user_id);

alter table public.push_subscriptions enable row level security;
alter table public.event_reminders enable row level security;

drop policy if exists "Users manage their push subscriptions" on public.push_subscriptions;
create policy "Users manage their push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Users manage their event reminders" on public.event_reminders;
create policy "Users manage their event reminders" on public.event_reminders
  for all using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
