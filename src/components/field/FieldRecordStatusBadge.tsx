import { formatEnumLabel } from '../../utils/formatEnumLabel';
import {
  BADGE_BASE,
  BADGE_CYAN,
  BADGE_DANGER,
  BADGE_INFO,
  BADGE_NEUTRAL,
  BADGE_PURPLE,
  BADGE_SUCCESS,
  BADGE_WARNING,
} from '../../theme/statusColors';

const STATUS_STYLES: Record<string, string> = {
  Open: BADGE_INFO,
  'Pending Response': BADGE_WARNING,
  Pending: BADGE_WARNING,
  Answered: BADGE_SUCCESS,
  Approved: BADGE_SUCCESS,
  Rejected: BADGE_DANGER,
  'Need More Information': BADGE_WARNING,
  'Needs More Information': BADGE_WARNING,
  'Requires Change Order': BADGE_PURPLE,
  'Convert to Change Order': BADGE_PURPLE,
  Closed: BADGE_NEUTRAL,
  Draft: BADGE_NEUTRAL,
  Submitted: BADGE_INFO,
  'Under Review': BADGE_WARNING,
  Void: BADGE_NEUTRAL,
  Sent: BADGE_INFO,
  Viewed: BADGE_CYAN,
  Accepted: BADGE_SUCCESS,
  Declined: BADGE_DANGER,
};

export default function FieldRecordStatusBadge({ status }: { status: string }) {
  const label = formatEnumLabel(status);
  const display = label === '—' ? status : label;
  return (
    <span
      className={`${BADGE_BASE} ${STATUS_STYLES[display] ?? STATUS_STYLES[status] ?? BADGE_NEUTRAL}`}
    >
      {display}
    </span>
  );
}
