import { useSubscription } from '../../contexts/SubscriptionContext';
import { getProfilePlanLabel } from './profilePlanLabel';

const TONE_STYLES: Record<
  ReturnType<typeof getProfilePlanLabel>['tone'],
  string
> = {
  default: 'border-cyan-500/30 bg-slate-800 text-cyan-200',
  trial: 'border-cyan-400/40 bg-cyan-950/50 text-cyan-100',
  warning: 'border-amber-500/40 bg-amber-950/40 text-amber-200',
  muted: 'border-slate-600 bg-slate-800/80 text-slate-300',
};

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
      className={`inline-flex w-fit max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${TONE_STYLES[tone]}`}
      data-testid="profile-plan-badge"
    >
      {label}
    </span>
  );
}
