-- Migration: project_activity_material_resources and project_activity_equipment_resources
-- Phase: Activity Resource Costing — Materials & Equipment Starter Library

-- ---------------------------------------------------------------------------
-- 1. project_activity_material_resources
-- ---------------------------------------------------------------------------
create table if not exists project_activity_material_resources (
  id                      uuid primary key default gen_random_uuid(),
  project_activity_id     uuid not null references project_construction_activities(id) on delete cascade,
  project_id              uuid not null references projects(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,

  name                    text not null,
  description             text,
  category                text,
  subcategory             text,

  quantity                numeric not null default 1 check (quantity >= 0),
  unit                    text not null default 'EA',
  unit_cost               numeric not null default 0 check (unit_cost >= 0),
  total_cost              numeric not null default 0 check (total_cost >= 0),

  source_provider         text not null default 'manual'
                            check (source_provider in ('manual', 'company_library', 'arden_starter')),
  -- String ID for starter library items (e.g. "material-concrete-ready-mix-3000-psi")
  -- or a company library UUID converted to text for legacy lookups.
  -- NULL for pure manual entries with no source reference.
  source_id               text,
  -- UUID FK to company_cost_library_items. Only set when source_provider = 'company_library'.
  company_library_item_id uuid references company_cost_library_items(id) on delete set null,
  -- Immutable snapshot of source item details at selection time (JSONB).
  source_snapshot         jsonb,

  sort_order              int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table project_activity_material_resources enable row level security;

create policy "Users manage own project material resources"
  on project_activity_material_resources
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_mat_resources_activity
  on project_activity_material_resources (project_activity_id);
create index if not exists idx_mat_resources_project
  on project_activity_material_resources (project_id, user_id);
create index if not exists idx_mat_resources_company_lib
  on project_activity_material_resources (company_library_item_id)
  where company_library_item_id is not null;

-- ---------------------------------------------------------------------------
-- 2. project_activity_equipment_resources
-- ---------------------------------------------------------------------------
create table if not exists project_activity_equipment_resources (
  id                      uuid primary key default gen_random_uuid(),
  project_activity_id     uuid not null references project_construction_activities(id) on delete cascade,
  project_id              uuid not null references projects(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,

  name                    text not null,
  description             text,
  category                text,
  subcategory             text,

  quantity                numeric not null default 1 check (quantity >= 0),
  unit                    text not null default 'day',
  unit_cost               numeric not null default 0 check (unit_cost >= 0),
  total_cost              numeric not null default 0 check (total_cost >= 0),

  source_provider         text not null default 'manual'
                            check (source_provider in ('manual', 'company_library', 'arden_starter')),
  source_id               text,
  company_library_item_id uuid references company_cost_library_items(id) on delete set null,
  source_snapshot         jsonb,

  sort_order              int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table project_activity_equipment_resources enable row level security;

create policy "Users manage own project equipment resources"
  on project_activity_equipment_resources
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_equip_resources_activity
  on project_activity_equipment_resources (project_activity_id);
create index if not exists idx_equip_resources_project
  on project_activity_equipment_resources (project_id, user_id);
create index if not exists idx_equip_resources_company_lib
  on project_activity_equipment_resources (company_library_item_id)
  where company_library_item_id is not null;
