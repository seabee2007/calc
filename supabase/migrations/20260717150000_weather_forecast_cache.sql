-- Server-side cache for Weather Forecast dashboard data.
-- Cached reads are free; Edge Functions update rows with the service role.

create table if not exists public.weather_forecast_cache (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid null references auth.users(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  project_id uuid null,
  location_key text not null,
  location_label text not null,
  latitude numeric null,
  longitude numeric null,
  address text null,
  forecast_json jsonb not null,
  source text not null default 'weather_api',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULLS NOT DISTINCT prevents duplicates even for user-scoped rows where
-- employer_id may be null, while still supporting Supabase upsert onConflict.
create unique index if not exists weather_forecast_cache_scope_location_key_idx
  on public.weather_forecast_cache (employer_id, user_id, location_key)
  nulls not distinct;

create index if not exists weather_forecast_cache_employer_fetched_at_idx
  on public.weather_forecast_cache (employer_id, fetched_at desc);

create index if not exists weather_forecast_cache_user_fetched_at_idx
  on public.weather_forecast_cache (user_id, fetched_at desc);

create index if not exists weather_forecast_cache_location_key_idx
  on public.weather_forecast_cache (location_key);

create index if not exists weather_forecast_cache_expires_at_idx
  on public.weather_forecast_cache (expires_at);

alter table public.weather_forecast_cache enable row level security;

drop policy if exists "users read own weather forecast cache" on public.weather_forecast_cache;
create policy "users read own weather forecast cache"
  on public.weather_forecast_cache
  for select
  using (auth.uid() = user_id);

drop policy if exists "owners read employer weather forecast cache" on public.weather_forecast_cache;
create policy "owners read employer weather forecast cache"
  on public.weather_forecast_cache
  for select
  using (auth.uid() = employer_id);

-- Clients do not insert/update/delete cache rows. Edge Functions use service_role.

create or replace function public.set_weather_forecast_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_weather_forecast_cache_updated_at
  on public.weather_forecast_cache;

create trigger set_weather_forecast_cache_updated_at
  before update on public.weather_forecast_cache
  for each row execute function public.set_weather_forecast_cache_updated_at();

notify pgrst, 'reload schema';
