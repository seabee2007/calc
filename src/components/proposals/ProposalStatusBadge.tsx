import React from 'react';
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from '../../types/proposalTracking';
import {
  BADGE_BASE,
  BADGE_DANGER,
  BADGE_INFO,
  BADGE_NEUTRAL,
  BADGE_SUCCESS,
  BADGE_TEAL,
  BADGE_WARNING,
  BADGE_PURPLE,
} from '../../theme/statusColors';

const STATUS_STYLES: Record<ProposalStatus, string> = {
  draft: BADGE_NEUTRAL,
  sent: BADGE_INFO,
  viewed: BADGE_WARNING,
  opened: BADGE_WARNING,
  accepted: BADGE_SUCCESS,
  declined: BADGE_DANGER,
  deposit_paid: BADGE_TEAL,
  scheduled: BADGE_PURPLE,
  paid: BADGE_SUCCESS,
};

export default function ProposalStatusBadge({
  status,
  className = '',
}: {
  status: ProposalStatus;
  className?: string;
}) {
  return (
    <span
      className={[
        `${BADGE_BASE} px-2.5 py-1`,
        STATUS_STYLES[status],
        className,
      ].join(' ')}
    >
      {PROPOSAL_STATUS_LABELS[status]}
    </span>
  );
}
