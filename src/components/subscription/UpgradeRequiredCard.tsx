import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import {
  FEATURE_DESCRIPTIONS,
  PLAN_DISPLAY_NAMES,
  minPlanForFeature,
  type FeatureKey,
} from '../../lib/entitlements';
import PlanBadge from './PlanBadge';

interface UpgradeRequiredCardProps {
  feature: FeatureKey;
  title?: string;
  description?: string;
  className?: string;
}

export default function UpgradeRequiredCard({
  feature,
  title,
  description,
  className = '',
}: UpgradeRequiredCardProps) {
  const navigate = useNavigate();
  const requiredPlan = minPlanForFeature(feature);
  const planLabel = PLAN_DISPLAY_NAMES[requiredPlan].short;
  const featureDescription = description ?? FEATURE_DESCRIPTIONS[feature];

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      data-testid={`upgrade-required-${feature}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Lock className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title ?? 'Upgrade required'}
            </h3>
            <PlanBadge plan={requiredPlan} />
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {featureDescription}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Available on the <span className="font-medium">{planLabel}</span> plan and above.
          </p>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            data-testid={`upgrade-cta-${feature}`}
            onClick={() => {
              navigate('/settings/billing');
            }}
          >
            Upgrade to {planLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
