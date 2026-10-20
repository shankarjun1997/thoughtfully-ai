-- Keep the signup-provided workspace name intact instead of appending " workspace".
-- The suffix is now only used for fallback names derived from a full name or email.

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
  v_name := nullif(btrim(new.raw_user_meta_data->>'workspace_name'), '');

  if v_name is null then
    v_name := nullif(btrim(new.raw_user_meta_data->>'full_name'), '');
    if v_name is null then
      v_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    end if;
    v_name := coalesce(v_name, 'My') || ' workspace';
  end if;

  v_slug := 'personal-' || replace(new.id::text, '-', '');

  insert into public.workspaces (name, slug, owner_id)
  values (left(v_name, 120), v_slug, new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$$;
