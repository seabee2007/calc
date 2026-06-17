-- Notifications MVP: preferences + canonical in-app notifications.
-- Weather alert automation is intentionally deferred.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_updates_enabled boolean not null default true,
  weather_alerts_enabled boolean not null default true,
  project_reminders_enabled boolean not null default true,
  in_app_notifications_enabled boolean not null default true,
  email_digest_frequency text not null default 'immediate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_digest_frequency_check check (
    email_digest_frequency in ('immediate', 'daily', 'off')
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  employer_id uuid null,
  project_id uuid null references public.projects(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  type text not null,
  severity text not null default 'info',
  channel text not null default 'in_app',
  title text not null,
  message text not null,
  action_label text null,
  action_url text null,
  metadata jsonb not null default '{}',
  read_at timestamptz null,
  dismissed_at timestamptz null,
  emailed_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in (
      'field_activity',
      'employee_message',
      'document_uploaded',
      'document_needs_review',
      'deadline_due',
      'schedule_attention',
      'email_delivery',
      'system_notice',
      'task_submitted',
      'proposal_accepted',
      'proposal_viewed',
      'proposal_declined',
      'proposal_deposit_paid',
      'proposal_sent'
    )
  ),
  constraint notifications_severity_check check (
    severity in ('info', 'success', 'warning', 'danger')
  ),
  constraint notifications_channel_check check (
    channel in ('in_app', 'email', 'system')
  )
);

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read_at, created_at desc);

create index if not exists notifications_employer_created_idx
  on public.notifications (employer_id, created_at desc);

create index if not exists notifications_project_created_idx
  on public.notifications (project_id, created_at desc);

create index if not exists notifications_type_created_idx
  on public.notifications (type, created_at desc);

create index if not exists notifications_severity_created_idx
  on public.notifications (severity, created_at desc);

create index if not exists notifications_expires_at_idx
  on public.notifications (expires_at)
  where expires_at is not null;

create unique index if not exists notifications_dedupe_source_idx
  on public.notifications (
    user_id,
    type,
    (metadata->>'sourceType'),
    (metadata->>'sourceId'),
    coalesce(metadata->>'reminderDate', '')
  )
  where user_id is not null
    and metadata->>'sourceType' is not null
    and metadata->>'sourceId' is not null;

-- Migrate legacy field_notifications into canonical notifications.
insert into public.notifications (
  user_id,
  project_id,
  type,
  severity,
  channel,
  title,
  message,
  action_url,
  metadata,
  read_at,
  created_at,
  updated_at
)
select
  fn.user_id,
  fn.project_id,
  case fn.type
    when 'task_submitted' then 'field_activity'
    when 'proposal_accepted' then 'proposal_accepted'
    when 'proposal_viewed' then 'proposal_viewed'
    when 'proposal_declined' then 'proposal_declined'
    when 'proposal_deposit_paid' then 'proposal_deposit_paid'
    when 'proposal_sent' then 'proposal_sent'
    else 'system_notice'
  end,
  'info',
  'in_app',
  fn.title,
  coalesce(fn.body, ''),
  fn.href,
  jsonb_build_object(
    'legacyFieldNotificationId', fn.id::text,
    'taskId', fn.task_id::text
  ),
  case when fn.is_read then fn.created_at else null end,
  fn.created_at,
  fn.created_at
from public.field_notifications fn
where not exists (
  select 1
  from public.notifications n
  where n.metadata->>'legacyFieldNotificationId' = fn.id::text
);

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences"
  on public.notification_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_notification_preferences_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_notifications_updated_at();

create or replace function public.create_app_notification(
  p_user_id uuid,
  p_project_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_action_label text default null,
  p_action_url text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_employer_id uuid default null,
  p_created_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is null then
    raise exception 'Recipient user_id is required';
  end if;

  if p_project_id is not null then
    if not (
      public.is_project_owner(p_project_id)
      or public.is_project_employee(p_project_id)
      or public.can_access_project(p_project_id)
    ) then
      raise exception 'Not authorized for project';
    end if;
  elsif p_user_id <> v_actor then
    raise exception 'Not authorized to notify this user';
  end if;

  if p_metadata ? 'sourceType' and p_metadata ? 'sourceId' then
    select n.id into v_id
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = p_type
      and n.metadata->>'sourceType' = p_metadata->>'sourceType'
      and n.metadata->>'sourceId' = p_metadata->>'sourceId'
      and coalesce(n.metadata->>'reminderDate', '') = coalesce(p_metadata->>'reminderDate', '')
    limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.notifications (
    user_id,
    employer_id,
    project_id,
    created_by,
    type,
    severity,
    channel,
    title,
    message,
    action_label,
    action_url,
    metadata
  )
  values (
    p_user_id,
    p_employer_id,
    p_project_id,
    p_created_by,
    p_type,
    coalesce(p_severity, 'info'),
    'in_app',
    p_title,
    p_message,
    p_action_label,
    p_action_url,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_app_notification(
  uuid, uuid, text, text, text, text, text, text, jsonb, uuid, uuid
) to authenticated;

comment on table public.notification_preferences is
  'Per-user notification delivery preferences. Weather alerts are stored but inactive in MVP.';

comment on table public.notifications is
  'Canonical in-app notifications for project activity, messages, documents, and reminders.';

notify pgrst, 'reload schema';
