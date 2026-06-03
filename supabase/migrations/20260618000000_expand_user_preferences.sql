-- Align user_preferences with fields written by companySettingsService / preferences store.
-- Original table (20250125000000) omitted sound_enabled and haptics_enabled.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS haptics_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.sound_enabled IS 'Play UI feedback sounds when enabled';
COMMENT ON COLUMN user_preferences.haptics_enabled IS 'Trigger device haptics when enabled';

-- Ensure core constraints and RLS (idempotent for partial or out-of-sync deploys)
ALTER TABLE user_preferences
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_preferences'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%user_id%'
  ) THEN
    ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_preferences'
      AND policyname = 'Users can view their own preferences'
  ) THEN
    CREATE POLICY "Users can view their own preferences"
      ON user_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_preferences'
      AND policyname = 'Users can insert their own preferences'
  ) THEN
    CREATE POLICY "Users can insert their own preferences"
      ON user_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_preferences'
      AND policyname = 'Users can update their own preferences'
  ) THEN
    CREATE POLICY "Users can update their own preferences"
      ON user_preferences FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';
