/*
  Legal document acceptance audit log — append-only rows per user/version pair.
*/

CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  terms_accepted_at timestamptz NOT NULL,
  privacy_accepted_at timestamptz NOT NULL,
  accepted_ip text NULL,
  accepted_user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_legal_acceptances_user_versions_unique
    UNIQUE (user_id, terms_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS user_legal_acceptances_user_id_idx
  ON public.user_legal_acceptances(user_id);

CREATE INDEX IF NOT EXISTS user_legal_acceptances_created_at_idx
  ON public.user_legal_acceptances(created_at DESC);

ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own legal acceptances"
  ON public.user_legal_acceptances;

CREATE POLICY "Users can read own legal acceptances"
  ON public.user_legal_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own legal acceptances"
  ON public.user_legal_acceptances;

CREATE POLICY "Users can insert own legal acceptances"
  ON public.user_legal_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
