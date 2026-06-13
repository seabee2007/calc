-- Migration: company_cost_library_items
-- User-managed reusable material and equipment pricing items.

create table if not exists company_cost_library_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  type              text not null check (type in ('material', 'equipment')),
  name              text not null,
  description       text,
  category          text,
  subcategory       text,

  unit              text not null default 'EA',
  default_unit_cost numeric not null default 0 check (default_unit_cost >= 0),

  source_provider   text not null default 'manual'
                      check (source_provider in ('manual', 'company_library', 'arden_starter')),
  -- If promoted from a starter item, the starter string ID is stored here.
  source_id         text,
  notes             text,

  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table company_cost_library_items enable row level security;

create policy "Users manage own company cost library"
  on company_cost_library_items
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Prevent duplicate names (case-insensitive) per user and type.
create unique index if not exists idx_company_lib_unique_name
  on company_cost_library_items (user_id, type, lower(name))
  where is_active = true;

create index if not exists idx_company_lib_user_type
  on company_cost_library_items (user_id, type);
create index if not exists idx_company_lib_source
  on company_cost_library_items (source_id)
  where source_id is not null;
