-- Project-level crew capacity for Level III Gantt resource histogram and resource leveling.
alter table public.projects
add column if not exists project_crew_size integer not null default 7;

alter table public.projects
drop constraint if exists projects_project_crew_size_check;

alter table public.projects
add constraint projects_project_crew_size_check
check (project_crew_size > 0 and project_crew_size <= 999);
