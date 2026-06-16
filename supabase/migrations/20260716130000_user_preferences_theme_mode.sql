-- Persist light/dark theme preference per user (synced from client theme store).

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS theme_mode TEXT NULL
    CHECK (theme_mode IS NULL OR theme_mode IN ('light', 'dark'));

COMMENT ON COLUMN public.user_preferences.theme_mode IS 'User UI theme: light or dark';

NOTIFY pgrst, 'reload schema';
