/*
  Add proposal "paid" end-stage status with timestamp.

  - Adds paid_at column
  - Extends proposals_status_check to include 'paid'
*/

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE proposals
  DROP CONSTRAINT IF EXISTS proposals_status_check;

ALTER TABLE proposals
  ADD CONSTRAINT proposals_status_check CHECK (
    status IN (
      'draft',
      'sent',
      'viewed',
      'opened',
      'accepted',
      'declined',
      'deposit_paid',
      'scheduled',
      'paid'
    )
  );

CREATE INDEX IF NOT EXISTS proposals_paid_at_idx ON proposals(paid_at);

