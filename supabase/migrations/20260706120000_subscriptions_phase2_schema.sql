-- Upgrade legacy subscriptions table (tier_id) to Phase 2 plan-based billing schema.
-- Safe to run when 20260706000000_subscriptions already created the new table.

alter table public.subscriptions
  drop constraint if exists subscriptions_tier_id_fkey;

alter table public.subscriptions
  drop column if exists tier_id;

alter table public.subscriptions
  add column if not exists plan_id text not null default 'starter';

alter table public.subscriptions
  add column if not exists current_period_start timestamptz;

alter table public.subscriptions
  add column if not exists current_period_end timestamptz;

alter table public.subscriptions
  add column if not exists trial_end timestamptz;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.subscriptions
  add column if not exists active_project_limit integer;

alter table public.subscriptions
  add column if not exists included_field_seats integer;

alter table public.subscriptions
  alter column status set default 'trialing';

create unique index if not exists subscriptions_user_id_key on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
drop policy if exists "owner can read own subscription" on public.subscriptions;
drop policy if exists "owner can update own subscription" on public.subscriptions;
drop policy if exists "owner can insert own subscription" on public.subscriptions;

create policy "owner can read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

create policy "owner can update own subscription"
  on public.subscriptions
  for update
  using (auth.uid() = user_id);

create policy "owner can insert own subscription"
  on public.subscriptions
  for insert
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
