import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listEstimateMethods } from '../../domain/estimateMethods';
import type { EstimateType } from '../../domain/estimateTypes';
import ModalShell from '../../../../components/ui/ModalShell';
import Button from '../../../../components/ui/Button';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';
import {
  minPlanForFeature,
  PLAN_DISPLAY_NAMES,
} from '../../../../lib/entitlements';
import { getFeatureKeyForEstimateType } from '../../../../lib/estimateEntitlements';

interface Props {
  open: boolean;
  currentType: EstimateType;
  onClose: () => void;
  onSelect: (type: EstimateType) => void;
  isEstimateTypeAllowed?: (type: EstimateType) => boolean;
}

export default function ChooseEstimateTypeModal({
  open,
  currentType,
  onClose,
  onSelect,
  isEstimateTypeAllowed,
}: Props) {
  const navigate = useNavigate();
  const options = listEstimateMethods();

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      title="Choose Estimate Type"
      size="xl"
      stackAboveDrawer
      footer={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <p className={`mb-4 text-sm ${PLANNER_MUTED}`}>
        Tabs adapt to the estimate type. Your saved activities, costs, markup, and schedule data
        are preserved when you change type.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isCurrent = option.id === currentType;
          const allowed = isEstimateTypeAllowed ? isEstimateTypeAllowed(option.id) : true;
          const requiredPlan = minPlanForFeature(getFeatureKeyForEstimateType(option.id));
          const planLabel = PLAN_DISPLAY_NAMES[requiredPlan].short;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isCurrent}
              disabled={!allowed}
              data-testid={`choose-estimate-type-${option.id}`}
              data-locked={allowed ? 'false' : 'true'}
              onClick={() => {
                if (!allowed) return;
                onSelect(option.id);
              }}
              className={[
                'rounded-lg border px-4 py-3 text-left transition-colors',
                isCurrent
                  ? 'border-cyan-600 bg-cyan-50/80 ring-1 ring-cyan-600/30 dark:border-cyan-400 dark:bg-cyan-950/30 dark:ring-cyan-400/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                !allowed ? 'cursor-not-allowed opacity-70' : '',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{option.label}</p>
                {isCurrent ? (
                  <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Current</span>
                ) : null}
                {!allowed ? (
                  <span className={`${BADGE_BASE} bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 inline-flex items-center gap-1`}>
                    <Lock className="h-3 w-3" aria-hidden />
                    {planLabel}
                  </span>
                ) : null}
                {allowed && option.defaultSchedulingEnabled ? (
                  <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Supports CPM scheduling</span>
                ) : allowed && option.schedulingOptional ? (
                  <span className={`${BADGE_BASE} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>
                    Scheduling optional
                  </span>
                ) : null}
              </div>
              <p className={`mt-2 text-sm ${TEXT_BODY}`}>{option.shortDescription}</p>
              <p className={`mt-2 text-xs ${PLANNER_MUTED}`}>
                <span className="font-medium">Best for:</span> {option.intendedUse}
              </p>
              <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
                <span className="font-medium">Primary workflow:</span> {option.primaryWorkflow}
              </p>
              {!allowed ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/settings/billing');
                  }}
                >
                  Upgrade to {planLabel}
                </button>
              ) : null}
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
