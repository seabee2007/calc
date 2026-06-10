-- ═══════════════════════════════════════════════════════════════════════════
-- Milestone 8: Field Control Schema
-- Tables: project_activity_progress_updates, project_activity_baselines
-- ═══════════════════════════════════════════════════════════════════════════

-- ── project_activity_baselines ───────────────────────────────────────────────
-- Immutable snapshot of the planned values at baseline approval.
-- Rules (enforced by service layer):
--   • Created once per project_activity.
--   • Cannot be modified after creation.
--   • Progress updates NEVER touch this table.
--   • Schedule revisions require a documented reason.

create table if not exists project_activity_baselines (
  id                       uuid primary key default gen_random_uuid(),
  project_activity_id      uuid not null references project_construction_activities(id) on delete cascade,
  project_id               uuid not null references projects(id) on delete cascade,

  baselined_at             timestamptz not null default now(),
  baselined_by             text,
  baseline_reason          text,

  -- Frozen plan values
  baseline_duration_days   numeric(10,2) not null check (baseline_duration_days > 0),
  baseline_crew_size       integer not null check (baseline_crew_size > 0),
  baseline_man_hours       numeric(12,2) not null check (baseline_man_hours >= 0),
  baseline_man_days        numeric(10,2) not null check (baseline_man_days >= 0),
  baseline_quantity        numeric(14,4) not null check (baseline_quantity >= 0),
  baseline_unit            text not null,

  -- CPM schedule positions (day-offset from project start day 0)
  baseline_early_start_day integer,
  baseline_early_finish_day integer,

  created_at               timestamptz not null default now(),

  -- One baseline per project activity (immutable)
  constraint project_activity_baselines_unique_activity
    unique (project_activity_id)
);

create index if not exists project_activity_baselines_project_idx
  on project_activity_baselines (project_id);

-- ── project_activity_progress_updates ────────────────────────────────────────
-- Daily or periodic field progress records per construction activity.
-- Based on CPM manual: track actualStart, remainingDuration, actualFinish.

create table if not exists project_activity_progress_updates (
  id                           uuid primary key default gen_random_uuid(),
  project_activity_id          uuid not null references project_construction_activities(id) on delete cascade,
  project_id                   uuid not null references projects(id) on delete cascade,

  -- CPM primary inputs (manual recommends these over percent-complete)
  report_date                  date not null,
  actual_start                 date,
  actual_finish                date,
  remaining_duration_days      numeric(8,2) check (remaining_duration_days >= 0),

  -- Production quantity tracking
  quantity_installed_today     numeric(14,4) not null default 0 check (quantity_installed_today >= 0),
  quantity_complete_to_date    numeric(14,4) not null default 0 check (quantity_complete_to_date >= 0),
  quantity_remaining_after     numeric(14,4) not null default 0 check (quantity_remaining_after >= 0),
  unit                         text not null,

  -- Crew and resources
  crew_size_today              integer not null default 0 check (crew_size_today >= 0),
  hours_worked_today           numeric(6,2) not null default 0 check (hours_worked_today >= 0),
  equipment_used_today         text[] not null default '{}',

  -- Weather and delays
  weather_impact               text not null default 'none'
                                 check (weather_impact in ('none', 'partial_day', 'full_day_lost')),
  delay_hours_today            numeric(6,2) not null default 0 check (delay_hours_today >= 0),
  delay_reason                 text check (delay_reason in (
                                 'weather', 'material_shortage', 'equipment_breakdown',
                                 'labor_shortage', 'design_change', 'rfi_hold',
                                 'inspection_hold', 'safety_stop', 'other'
                               )),
  delay_notes                  text,

  -- Field notes
  daily_notes                  text,

  -- Audit
  reported_by                  text,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  -- One update per activity per day
  constraint progress_updates_unique_activity_date
    unique (project_activity_id, report_date)
);

create index if not exists progress_updates_project_activity_idx
  on project_activity_progress_updates (project_activity_id);

create index if not exists progress_updates_project_idx
  on project_activity_progress_updates (project_id);

create index if not exists progress_updates_report_date_idx
  on project_activity_progress_updates (report_date desc);

-- updated_at trigger
create or replace function set_progress_update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_progress_update_updated_at_trigger
  on project_activity_progress_updates;

create trigger set_progress_update_updated_at_trigger
  before update on project_activity_progress_updates
  for each row execute function set_progress_update_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

alter table project_activity_baselines enable row level security;
alter table project_activity_progress_updates enable row level security;

-- Baselines: read = authenticated; write = owner of the project
create policy "baselines_select" on project_activity_baselines
  for select to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "baselines_insert" on project_activity_baselines
  for insert to authenticated
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- No update / delete allowed on baselines — they are immutable by policy
-- (service layer enforces this; DB policy is a safety net)

-- Progress updates: full CRUD for project owner
create policy "progress_updates_select" on project_activity_progress_updates
  for select to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "progress_updates_insert" on project_activity_progress_updates
  for insert to authenticated
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "progress_updates_update" on project_activity_progress_updates
  for update to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  )
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "progress_updates_delete" on project_activity_progress_updates
  for delete to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );
