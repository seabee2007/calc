/*
  Transactional email event log (Resend).
*/

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  resend_email_id text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT email_events_status_check CHECK (
    status IN (
      'queued',
      'sent',
      'delivered',
      'delivery_delayed',
      'complained',
      'bounced',
      'opened',
      'clicked',
      'failed',
      'skipped',
      'disabled'
    )
  )
);

CREATE INDEX IF NOT EXISTS email_events_user_id_idx ON public.email_events(user_id);
CREATE INDEX IF NOT EXISTS email_events_project_id_idx ON public.email_events(project_id);
CREATE INDEX IF NOT EXISTS email_events_proposal_id_idx ON public.email_events(proposal_id);
CREATE INDEX IF NOT EXISTS email_events_resend_email_id_idx ON public.email_events(resend_email_id);
CREATE INDEX IF NOT EXISTS email_events_created_at_idx ON public.email_events(created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_to_email_idx ON public.email_events(lower(to_email));

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email events"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read email events for own projects"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = email_events.project_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read email events for own proposals"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (
    proposal_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.proposals pr
      WHERE pr.id = email_events.proposal_id
        AND pr.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.email_events IS 'Transactional email send log and delivery status from Resend';
