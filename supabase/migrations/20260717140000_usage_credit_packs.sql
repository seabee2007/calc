-- One-time usage credit packs purchased via Stripe Checkout (re-up packs).
-- Written by stripe-webhook / consume RPC; owners may read employer balances.

create table if not exists public.usage_credit_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer_id uuid null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,
  stripe_customer_id text null,
  usage_unit text not null,
  quantity_purchased numeric not null,
  quantity_remaining numeric not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_checkout_session_id, usage_unit)
);

create index if not exists usage_credit_packs_employer_unit_active_idx
  on public.usage_credit_packs (employer_id, usage_unit, expires_at)
  where status = 'active' and quantity_remaining > 0;

create index if not exists usage_credit_packs_user_id_created_at_idx
  on public.usage_credit_packs (user_id, created_at desc);

alter table public.usage_credit_packs enable row level security;

drop policy if exists "owners read employer credit packs" on public.usage_credit_packs;
create policy "owners read employer credit packs"
  on public.usage_credit_packs
  for select
  using (auth.uid() = employer_id);

-- Atomically decrement active, non-expired credit packs (oldest first).
create or replace function public.consume_usage_credit_pack(
  p_employer_id uuid,
  p_user_id uuid,
  p_usage_unit text,
  p_quantity numeric default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining numeric := p_quantity;
  v_pack_id uuid;
  v_pack_qty numeric;
  v_take numeric;
  v_first_pack_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  while v_remaining > 0 loop
    select id, quantity_remaining
    into v_pack_id, v_pack_qty
    from public.usage_credit_packs
    where employer_id = p_employer_id
      and usage_unit = p_usage_unit
      and status = 'active'
      and quantity_remaining > 0
      and expires_at > now()
    order by created_at asc
    limit 1
    for update;

    if v_pack_id is null then
      raise exception 'insufficient_credits';
    end if;

    v_take := least(v_remaining, v_pack_qty);

    update public.usage_credit_packs
    set
      quantity_remaining = quantity_remaining - v_take,
      updated_at = now(),
      status = case when quantity_remaining - v_take <= 0 then 'depleted' else status end
    where id = v_pack_id;

    if v_first_pack_id is null then
      v_first_pack_id := v_pack_id;
    end if;

    v_remaining := v_remaining - v_take;
  end loop;

  return v_first_pack_id;
end;
$$;

revoke all on function public.consume_usage_credit_pack(uuid, uuid, text, numeric) from public;
grant execute on function public.consume_usage_credit_pack(uuid, uuid, text, numeric) to service_role;

notify pgrst, 'reload schema';
