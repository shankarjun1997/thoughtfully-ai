-- Multi-tenant workspaces, membership, and workspace-scoped data.
-- Apply after 202610180001_initial_schema.sql.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);

create or replace function public.is_workspace_member(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Give every existing auth user a personal workspace before data is scoped.
insert into public.workspaces (name, slug, owner_id)
select 'Personal workspace', 'personal-' || replace(u.id::text, '-', ''), u.id
from auth.users u
where not exists (select 1 from public.workspaces w where w.owner_id = u.id)
on conflict (slug) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

alter table public.planner_events add column if not exists workspace_id uuid;
alter table public.shopping_lists add column if not exists workspace_id uuid;
alter table public.shopping_items add column if not exists workspace_id uuid;

update public.planner_events e
set workspace_id = w.id
from public.workspaces w
where w.owner_id = e.user_id and e.workspace_id is null;

update public.shopping_lists l
set workspace_id = w.id
from public.workspaces w
where w.owner_id = l.user_id and l.workspace_id is null;

update public.shopping_items i
set workspace_id = l.workspace_id
from public.shopping_lists l
where l.id = i.list_id and i.workspace_id is null;

alter table public.planner_events alter column workspace_id set not null;
alter table public.shopping_lists alter column workspace_id set not null;
alter table public.shopping_items alter column workspace_id set not null;

alter table public.planner_events
  add constraint planner_events_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.shopping_lists
  add constraint shopping_lists_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.shopping_items
  add constraint shopping_items_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

create unique index if not exists shopping_lists_id_workspace_idx on public.shopping_lists(id, workspace_id);
alter table public.shopping_items
  drop constraint if exists shopping_items_list_id_fkey;
alter table public.shopping_items
  add constraint shopping_items_list_workspace_fk foreign key (list_id, workspace_id)
  references public.shopping_lists(id, workspace_id) on delete cascade;

create index if not exists planner_events_workspace_date_idx on public.planner_events(workspace_id, event_date);
create index if not exists shopping_lists_workspace_updated_idx on public.shopping_lists(workspace_id, updated_at desc);
create index if not exists shopping_items_workspace_idx on public.shopping_items(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists "Users can create workspaces" on public.workspaces;
create policy "Users can create workspaces" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "Admins can update workspaces" on public.workspaces;
create policy "Admins can update workspaces" on public.workspaces
  for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces" on public.workspaces
  for delete using (owner_id = auth.uid());

drop policy if exists "Members can view workspace members" on public.workspace_members;
create policy "Members can view workspace members" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can manage workspace members" on public.workspace_members;
create policy "Admins can manage workspace members" on public.workspace_members
  for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Users manage their own planner events" on public.planner_events;
drop policy if exists "Workspace members manage planner events" on public.planner_events;
create policy "Workspace members manage planner events" on public.planner_events
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Users manage their own shopping lists" on public.shopping_lists;
drop policy if exists "Workspace members manage shopping lists" on public.shopping_lists;
create policy "Workspace members manage shopping lists" on public.shopping_lists
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Users manage their own shopping items" on public.shopping_items;
drop policy if exists "Workspace members manage shopping items" on public.shopping_items;
create policy "Workspace members manage shopping items" on public.shopping_items
  for all using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.shopping_lists l
      where l.id = list_id and l.workspace_id = workspace_id
    )
  );

create or replace function public.create_workspace(p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_workspace public.workspaces;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_name) = 0 then
    raise exception 'Workspace name is required';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'workspace';
  end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.workspaces (name, slug, owner_id)
  values (left(v_name, 120), v_slug, v_user)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, v_user, 'owner');

  return v_workspace;
end;
$$;

grant execute on function public.create_workspace(text) to authenticated;

create or replace function public.handle_new_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  v_workspace_id uuid;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'workspace_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'My'
  ) || ' workspace';
  v_slug := 'personal-' || replace(new.id::text, '-', '');

  insert into public.workspaces (name, slug, owner_id)
  values (left(v_name, 120), v_slug, new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace
  after insert on auth.users
  for each row execute function public.handle_new_user_workspace();
