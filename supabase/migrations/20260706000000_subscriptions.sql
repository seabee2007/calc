create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text not null default 'starter',
  status text not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  active_project_limit integer,
  included_field_seats integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_key on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

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
