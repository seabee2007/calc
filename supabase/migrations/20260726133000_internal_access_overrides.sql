/*
  Internal owner access overrides.

  Use the service-role-only helper to grant an override by Supabase Auth email:

    select public.grant_internal_access_override_by_email(
      'owner@example.com',
      'Owner production access while Stripe billing remains active'
    );

  The app normalizes an active override to the highest in-app entitlement tier.
  Stripe customer, subscription, checkout, portal, and webhook rows are not changed.
*/

create table if not exists public.internal_access_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  plan_id text not null default 'enterprise',
  reason text not null,
  granted_by uuid null references auth.users(id),
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists internal_access_overrides_active_user_key
  on public.internal_access_overrides(user_id)
  where is_active = true;

create index if not exists internal_access_overrides_user_active_expires_idx
  on public.internal_access_overrides(user_id, is_active, expires_at);

create index if not exists internal_access_overrides_email_idx
  on public.internal_access_overrides(lower(email));

alter table public.internal_access_overrides enable row level security;

revoke all on public.internal_access_overrides from anon, authenticated;
grant select on public.internal_access_overrides to authenticated;
grant all on public.internal_access_overrides to service_role;

drop policy if exists "users read own active internal override"
  on public.internal_access_overrides;

create policy "users read own active internal override"
  on public.internal_access_overrides
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and is_active = true
    and (expires_at is null or expires_at > now())
  );

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column') then
    drop trigger if exists internal_access_overrides_updated_at
      on public.internal_access_overrides;

    create trigger internal_access_overrides_updated_at
      before update on public.internal_access_overrides
      for each row execute function update_updated_at_column();
  end if;
end;
$$;

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
