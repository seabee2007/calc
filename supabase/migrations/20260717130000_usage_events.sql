-- Central usage ledger for metered APIs (AI, weather, mapbox, email, etc.).
-- Written only by Edge Functions via service role; clients may read summaries.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  employer_id uuid null references auth.users(id) on delete set null,
  plan_id text null,
  feature_key text not null,
  usage_unit text not null,
  quantity numeric not null default 1,
  source text null,
  request_id text null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_id_created_at_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists usage_events_employer_id_created_at_idx
  on public.usage_events (employer_id, created_at desc);

create index if not exists usage_events_feature_key_created_at_idx
  on public.usage_events (feature_key, created_at desc);

create index if not exists usage_events_usage_unit_created_at_idx
  on public.usage_events (usage_unit, created_at desc);

create unique index if not exists usage_events_request_id_unique_idx
  on public.usage_events (request_id)
  where request_id is not null;

alter table public.usage_events enable row level security;

drop policy if exists "users read own usage events" on public.usage_events;
create policy "users read own usage events"
  on public.usage_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "owners read employer usage events" on public.usage_events;
create policy "owners read employer usage events"
  on public.usage_events
  for select
  using (auth.uid() = employer_id);

notify pgrst, 'reload schema';
