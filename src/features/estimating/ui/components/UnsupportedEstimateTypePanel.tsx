import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/ui/Button';
import {
  FEATURE_DESCRIPTIONS,
  PLAN_DISPLAY_NAMES,
  minPlanForFeature,
} from '../../../../lib/entitlements';
import {
  canUseEstimateType,
  getDefaultEstimateTypeForPlan,
  getFeatureKeyForEstimateType,
} from '../../../../lib/estimateEntitlements';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import type { EstimateType } from '../../domain/estimateTypes';
import type { PlanId } from '../../../../lib/entitlements';
import { PLANNER_FORM_PANEL, PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface UnsupportedEstimateTypePanelProps {
  estimateType: EstimateType;
  plan: PlanId;
  onSwitchToSupportedType: (type: EstimateType) => void;
  switching?: boolean;
}

export default function UnsupportedEstimateTypePanel({
  estimateType,
  plan,
  onSwitchToSupportedType,
  switching = false,
}: UnsupportedEstimateTypePanelProps) {
  const navigate = useNavigate();
  const feature = getFeatureKeyForEstimateType(estimateType);
  const requiredPlan = minPlanForFeature(feature);
  const planLabel = PLAN_DISPLAY_NAMES[requiredPlan].short;
  const fallbackType = getDefaultEstimateTypeForPlan(plan);
  const canSwitch = canUseEstimateType(plan, fallbackType);

  return (
    <div
      className={`${PLANNER_FORM_PANEL} space-y-4`}
      data-testid="unsupported-estimate-type-panel"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Lock className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>
            {formatEstimateMethodLabel(estimateType)} requires {planLabel}
          </h3>
          <p className={`text-sm ${PLANNER_MUTED}`}>{FEATURE_DESCRIPTIONS[feature]}</p>
          <p className={`text-sm ${PLANNER_MUTED}`}>
            Your saved estimate data is preserved. Switch to a supported estimate type or upgrade
            to continue with this workflow.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {canSwitch ? (
          <Button
            type="button"
            variant="accent"
            size="sm"
            isLoading={switching}
            disabled={switching}
            data-testid="switch-to-supported-estimate-type"
            onClick={() => onSwitchToSupportedType(fallbackType)}
          >
            Switch to {formatEstimateMethodLabel(fallbackType)}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="upgrade-for-estimate-type"
          onClick={() => navigate('/settings/billing')}
        >
          Upgrade to {planLabel}
        </Button>
      </div>
    </div>
  );
}
