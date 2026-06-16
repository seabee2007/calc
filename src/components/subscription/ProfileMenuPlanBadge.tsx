import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  getProfilePlanLabel,
  PROFILE_PLAN_LABEL_TONE_STYLES,
} from './profilePlanLabel';

export default function ProfileMenuPlanBadge() {
  const { plan, status, subscription, loading } = useSubscription();

  if (loading) {
    return (
      <span
        className="inline-flex h-4 w-16 animate-pulse rounded-full bg-slate-800"
        aria-hidden
        data-testid="profile-plan-badge-loading"
      />
    );
  }

  const { label, tone } = getProfilePlanLabel({ plan, status, subscription });

  return (
    <span
      className={`inline-flex w-fit max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${PROFILE_PLAN_LABEL_TONE_STYLES[tone]}`}
      data-testid="profile-plan-badge"
    >
      {label}
    </span>
  );
}
