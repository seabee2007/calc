-- In-app review feedback with optional usage credit rewards.
-- Inserts are server-only (edge function); clients may read their own / employer rows.

create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer_id uuid null references auth.users(id) on delete set null,
  rating integer not null check (rating >= 0 and rating <= 5),
  review_text text not null,
  public_consent boolean not null default false,
  reviewer_name text null,
  reviewer_company text null,
  reviewer_role text null,
  source text not null default 'in_app',
  status text not null default 'submitted',
  reward_granted boolean not null default false,
  reward_granted_at timestamptz null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_reviews_status_check check (
    status in ('submitted', 'approved_for_marketing', 'rejected', 'archived')
  )
);

create unique index if not exists app_reviews_one_reward_per_employer_idx
  on public.app_reviews (employer_id)
  where reward_granted = true and employer_id is not null;

create unique index if not exists app_reviews_one_reward_per_user_no_employer_idx
  on public.app_reviews (user_id)
  where reward_granted = true and employer_id is null;

create index if not exists app_reviews_employer_id_created_at_idx
  on public.app_reviews (employer_id, created_at desc);

create index if not exists app_reviews_user_id_created_at_idx
  on public.app_reviews (user_id, created_at desc);

create index if not exists app_reviews_rating_idx
  on public.app_reviews (rating);

create index if not exists app_reviews_public_consent_idx
  on public.app_reviews (public_consent);

create index if not exists app_reviews_status_idx
  on public.app_reviews (status);

alter table public.app_reviews enable row level security;

drop policy if exists "users read own or employer app reviews" on public.app_reviews;
create policy "users read own or employer app reviews"
  on public.app_reviews
  for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = employer_id);

-- No client insert/update/delete — writes via submit-app-review edge function (service role).

create or replace function public.set_app_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_reviews_updated_at on public.app_reviews;
create trigger set_app_reviews_updated_at
before update on public.app_reviews
for each row
execute function public.set_app_reviews_updated_at();

comment on table public.app_reviews is
  'In-app owner feedback reviews. Rewards granted for any honest rating; public marketing use requires public_consent and manual approval.';

notify pgrst, 'reload schema';
