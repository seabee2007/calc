/*
  Allow Supabase SQL Editor / migration admin roles to use the internal access
  override grant helper while still blocking normal anon/authenticated clients.
*/

create or replace function public.grant_internal_access_override_by_email(
  p_email text,
  p_reason text,
  p_plan_id text default 'enterprise',
  p_expires_at timestamptz default null,
  p_granted_by uuid default null
)
returns public.internal_access_overrides
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_override public.internal_access_overrides;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin')
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'service_role required'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_email), '') is null then
    raise exception 'email is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'reason is required'
      using errcode = '22023';
  end if;

  select users.id, users.email
    into v_user_id, v_email
  from auth.users
  where lower(users.email) = lower(btrim(p_email))
  order by users.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user found for email %', p_email
      using errcode = 'P0002';
  end if;

  update public.internal_access_overrides
  set is_active = false,
      updated_at = now()
  where user_id = v_user_id
    and is_active = true;

  insert into public.internal_access_overrides (
    user_id,
    email,
    plan_id,
    reason,
    granted_by,
    expires_at,
    is_active
  )
  values (
    v_user_id,
    v_email,
    coalesce(nullif(btrim(p_plan_id), ''), 'enterprise'),
    btrim(p_reason),
    p_granted_by,
    p_expires_at,
    true
  )
  returning * into v_override;

  return v_override;
end;
$$;

revoke all on function public.grant_internal_access_override_by_email(
  text,
  text,
  text,
  timestamptz,
  uuid
) from public, anon, authenticated;

grant execute on function public.grant_internal_access_override_by_email(
  text,
  text,
  text,
  timestamptz,
  uuid
) to service_role;

notify pgrst, 'reload schema';
