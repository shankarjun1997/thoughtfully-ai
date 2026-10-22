-- Seven-day free trial followed by a one-time annual Razorpay payment.
-- Billing stays optional: when Razorpay is not configured the app ignores this
-- table and never blocks a signed-in user.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'expired', 'cancelled')),
  trial_ends_at timestamptz not null,
  current_period_end timestamptz,
  provider text,
  provider_order_id text,
  provider_payment_id text,
  amount_paise integer,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_order_idx on public.subscriptions(provider_order_id);
create index if not exists subscriptions_payment_idx on public.subscriptions(provider_payment_id);

alter table public.subscriptions enable row level security;

-- Users may read their own subscription. All writes go through server routes
-- using the service key, so no insert/update/delete policies are exposed.
drop policy if exists "Users can view their subscription" on public.subscriptions;
create policy "Users can view their subscription" on public.subscriptions
  for select using (user_id = auth.uid());

create or replace function public.touch_subscriptions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_subscriptions_updated_at();

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', coalesce(new.created_at, now()) + interval '7 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Existing accounts keep their original signup date as the trial start.
insert into public.subscriptions (user_id, status, trial_ends_at)
select u.id, 'trialing', coalesce(u.created_at, now()) + interval '7 days'
from auth.users u
on conflict (user_id) do nothing;
