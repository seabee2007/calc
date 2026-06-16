-- Persist the customizable Operations Dashboard grid layout per user.
-- Stored as the full grid layout (x/y/w/h per card) on the existing
-- user_preferences row. No new table and no widget catalog yet.
--
-- RLS: reuses the existing user_preferences policies (owner-only
-- SELECT/INSERT/UPDATE via auth.uid() = user_id, created in
-- 20260618000000_expand_user_preferences.sql). No new policies are required
-- because a user can only read/update their own preferences row.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS dashboard_layout jsonb NULL;

COMMENT ON COLUMN public.user_preferences.dashboard_layout IS
  'Operations Dashboard grid layout: { version, items: [{ id, x, y, w, h }] }. Desktop/base grid only; mobile is a render-only adaptation and is never persisted.';

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';
