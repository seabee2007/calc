-- Subscription billing/system email idempotency log (upgrade welcome emails).

create table if not exists public.subscription_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer_id uuid null,
  stripe_subscription_id text not null,
  stripe_event_id text not null,
  plan_id text not null,
  email_type text not null,
  sent_to text not null,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_email_events_plan_id_check check (
    plan_id in ('starter', 'professional', 'business')
  ),
  constraint subscription_email_events_email_type_check check (
    email_type in (
      'subscription_welcome_starter',
      'subscription_welcome_professional',
      'subscription_welcome_business'
    )
  )
);

create unique index if not exists subscription_email_events_stripe_event_email_type_idx
  on public.subscription_email_events (stripe_event_id, email_type);

create unique index if not exists subscription_email_events_subscription_plan_email_type_idx
  on public.subscription_email_events (stripe_subscription_id, plan_id, email_type);

create index if not exists subscription_email_events_user_id_sent_at_idx
  on public.subscription_email_events (user_id, sent_at desc);

alter table public.subscription_email_events enable row level security;

comment on table public.subscription_email_events is
  'Idempotency log for billing/system subscription emails (upgrade welcome). Does not meter email_send usage.';

notify pgrst, 'reload schema';
