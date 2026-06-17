# Notifications MVP

Arden Project OS notifications are event-driven, stored in Supabase, and surfaced through the existing header bell plus an owner/admin attention toast.

## Scope in this phase

- In-app notifications for field activity, employee messages, documents, deadlines, and schedule attention
- Optional immediate email for selected high-signal events
- Settings toggles backed by `notification_preferences`
- Weather alerts toggle is stored only; **no WeatherAPI calls** and **no weather notifications** yet
- No browser push notifications
- No external polling

## Tables

### `notification_preferences`

Per-user delivery preferences:

- `email_updates_enabled`
- `weather_alerts_enabled` (stored only in MVP)
- `project_reminders_enabled`
- `in_app_notifications_enabled`
- `email_digest_frequency`: `immediate | daily | off`

### `notifications`

Canonical in-app notification rows:

- Recipient: `user_id`
- Context: `project_id`, `employer_id`, `created_by`
- Display: `type`, `severity`, `title`, `message`, `action_label`, `action_url`
- State: `read_at`, `dismissed_at`, `emailed_at`, `expires_at`
- Dedupe metadata: `metadata.sourceType`, `metadata.sourceId`, `metadata.reminderDate`

Legacy `field_notifications` rows are migrated into `notifications` on deploy.

## Notification types

| Type | Severity | Email in MVP |
|------|----------|--------------|
| `field_activity` | info | no |
| `employee_message` | info | yes |
| `document_uploaded` | info | no |
| `document_needs_review` | warning | yes |
| `deadline_due` | warning | yes |
| `schedule_attention` | warning/danger | no |
| `system_notice` | info | no |

Proposal lifecycle types remain supported for backward compatibility.

## Preferences behavior

- **Email Updates** → `email_updates_enabled`
- **Project Reminders** → `project_reminders_enabled`
- **Weather Alerts** → `weather_alerts_enabled`, inactive until a later phase
- **In-app master switch** → `in_app_notifications_enabled`

`daily` digest preference is stored but only `immediate` and `off` are implemented in MVP.

## UI

### Header bell

- Unread badge
- Newest notifications first
- Mark one read / mark all read / dismiss
- Empty state:
  - `No notifications yet.`
  - `Important project updates will appear here.`

### Owner/admin attention toast

Shows one high-priority unread notification at a time for:

- `employee_message`
- `document_needs_review`
- `deadline_due`
- `schedule_attention` with warning/danger severity

Dismiss sets `dismissed_at`. Open navigates to `action_url` and marks read.

## Event sources

- Task submission, comments, attachments → `field_activity`
- Field messages → `employee_message`
- Builder document submitted for review → `document_needs_review`
- Saved schedule deadlines / overdue items → `deadline_due`
- Overdue / delayed schedule items → `schedule_attention`

Reminder checks run when owners load main app or planner workspace routes. They use existing saved schedule data only.

## Email behavior

Emails use the existing `send-transactional-email` edge function path.

- Sent only when recipient `email_updates_enabled = true`
- Sent only when `email_digest_frequency = immediate`
- `email_send` usage is counted only when Resend actually sends the message

## Duplicate prevention

Notifications with `metadata.sourceType`, `metadata.sourceId`, and optional `metadata.reminderDate` are deduped in `create_app_notification`.

## Deferred

- Weather alert automation (saved forecast data only)
- Browser push notifications
- Daily digest delivery
- Billing/admin-only notification families

## Key files

- Migration: `supabase/migrations/20260718120000_notifications.sql`
- Types: `src/lib/notificationTypes.ts`
- Preferences: `src/services/notificationPreferenceService.ts`
- Notifications: `src/services/notificationService.ts`
- Event wiring: `src/services/notificationEventService.ts`
- Reminders: `src/services/notificationReminderService.ts`
- Bell UI: `src/components/field/FieldNotificationsBell.tsx`
- Toast UI: `src/components/field/NotificationAttentionToast.tsx`
