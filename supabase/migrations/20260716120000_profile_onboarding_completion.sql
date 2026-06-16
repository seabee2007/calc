-- Explicit owner onboarding completion on profiles (not inferred from company_settings).

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz null,
  add column if not exists onboarding_version text null;

-- Backfill owners who already completed company setup or have existing projects.
update public.profiles p
set
  onboarding_completed_at = coalesce(p.onboarding_completed_at, p.updated_at, now()),
  onboarding_version = coalesce(p.onboarding_version, '2025-01')
where p.role = 'owner'
  and p.onboarding_completed_at is null
  and (
    exists (
      select 1
      from public.company_settings cs
      where cs.user_id = p.id
        and nullif(trim(cs.company_name), '') is not null
    )
    or exists (
      select 1
      from public.projects pr
      where pr.user_id = p.id
    )
  );

notify pgrst, 'reload schema';
