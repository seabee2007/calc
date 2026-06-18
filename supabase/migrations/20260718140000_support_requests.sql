-- Support requests submitted via send-support-request edge function.
-- Client inserts are server-only; users may read their own rows.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  employer_id uuid null,
  contact_email text not null,
  topic text not null,
  subject text not null,
  message text not null,
  status text not null default 'submitted',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_status_check check (
    status in ('submitted', 'acknowledged', 'closed')
  )
);

create index if not exists support_requests_user_id_created_at_idx
  on public.support_requests (user_id, created_at desc);

create index if not exists support_requests_contact_email_created_at_idx
  on public.support_requests (contact_email, created_at desc);

create index if not exists support_requests_topic_created_at_idx
  on public.support_requests (topic, created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "users read own support requests" on public.support_requests;
create policy "users read own support requests"
  on public.support_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No client insert/update/delete — writes via send-support-request edge function (service role).

create or replace function public.set_support_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_support_requests_updated_at on public.support_requests;
create trigger set_support_requests_updated_at
before update on public.support_requests
for each row
execute function public.set_support_requests_updated_at();

comment on table public.support_requests is
  'User-submitted support requests sent to support@ardenprojectos.com via edge function.';

notify pgrst, 'reload schema';
