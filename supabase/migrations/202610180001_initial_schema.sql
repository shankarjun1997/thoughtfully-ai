-- Thoughtfully AI initial schema. Apply only after creating a Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.planner_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  event_date date not null,
  category text not null default 'Personal',
  notes text check (notes is null or char_length(notes) <= 2000),
  calendar_system text not null default 'gregorian' check (calendar_system in ('gregorian', 'panchang')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My shopping list' check (char_length(title) between 1 and 200),
  purpose text not null default 'General shopping',
  budget_inr numeric(12,2) not null default 0 check (budget_inr >= 0),
  region text not null default 'India',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  quantity text,
  estimated_price_inr numeric(12,2) check (estimated_price_inr is null or estimated_price_inr >= 0),
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists planner_events_user_date_idx on public.planner_events(user_id, event_date);
create index if not exists shopping_lists_user_updated_idx on public.shopping_lists(user_id, updated_at desc);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id);

alter table public.planner_events enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "Users manage their own planner events" on public.planner_events;
create policy "Users manage their own planner events" on public.planner_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own shopping lists" on public.shopping_lists;
create policy "Users manage their own shopping lists" on public.shopping_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own shopping items" on public.shopping_items;
create policy "Users manage their own shopping items" on public.shopping_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
