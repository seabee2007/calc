-- Subscriptions are written only by Stripe webhooks / edge functions (service role).
-- Clients may read their own row but must not self-grant paid access.

drop policy if exists "owner can update own subscription" on public.subscriptions;
drop policy if exists "owner can insert own subscription" on public.subscriptions;

-- Safer default: no subscription row should imply Free until Stripe activates billing.
alter table public.subscriptions
  alter column status set default 'inactive';

notify pgrst, 'reload schema';
