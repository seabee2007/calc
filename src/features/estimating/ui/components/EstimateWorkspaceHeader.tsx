import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { formatEstimateBlank, formatEstimateCurrency } from '../estimateFormatters';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  estimate?: EstimateSummary | null;
  version?: EstimateDomainVersion | null;
  totalPriceDisplay?: string;
  laborHoursDisplay?: string;
  plannedDurationDisplay?: string | null;
  hasEstimate?: boolean;
  creating?: boolean;
  dataLoading?: boolean;
  draftDirty?: boolean;
  onCreateEstimate?: () => void;
}

function savedVersionSellPrice(version: EstimateDomainVersion): string {
  return formatEstimateCurrency(version.totals.finalSellPrice ?? version.totals.directCost);
}

export default function EstimateWorkspaceHeader({
  estimate = null,
  version = null,
  totalPriceDisplay,
  laborHoursDisplay,
  plannedDurationDisplay = null,
  hasEstimate = false,
  creating = false,
  dataLoading = false,
  draftDirty = false,
  onCreateEstimate,
}: Props) {
  const createLabel = creating ? 'Creating...' : hasEstimate ? 'Estimate exists' : 'Create estimate';
  const estimateType = version?.estimateType ?? null;
  const resolvedTotalPrice =
    totalPriceDisplay ??
    (version
      ? formatEstimateCurrency(version.totals.finalSellPrice ?? version.totals.directCost)
      : '—');
  const resolvedLaborHours = laborHoursDisplay ?? '—';

  if (!hasEstimate) {
    return (
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Select an estimate method below, then create the draft.
        </p>
        <Button
          variant="accent"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          disabled={creating || dataLoading || !onCreateEstimate}
          isLoading={creating}
          className="w-full shrink-0 sm:w-auto"
          onClick={onCreateEstimate}
        >
          {createLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_FORM_PANEL} mb-4 space-y-2.5`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className={`truncate text-sm font-semibold sm:text-base ${TEXT_FOREGROUND}`}>
          {formatEstimateBlank(estimate?.name)}
        </h1>
        {estimate?.status ? (
          <FieldRecordStatusBadge status={estimate.status} />
        ) : (
          <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Draft</span>
        )}
        {estimateType ? (
          <span className={`${BADGE_BASE} ${BADGE_INFO}`}>
            {formatEstimateMethodLabel(estimateType)}
          </span>
        ) : null}
        {draftDirty ? (
          <span className={`text-xs ${PLANNER_MUTED}`}>Unsaved draft line items</span>
        ) : null}
      </div>

      {version ? (
        <>
          <p className={`text-xs ${TEXT_BODY}`}>
            <span className="font-medium tabular-nums">
              {formatEstimateBlank(version.versionName)} v{version.versionNumber}
            </span>
            <span className={PLANNER_MUTED} aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span className={PLANNER_MUTED}>Saved </span>
            <span className="font-medium">
              {format(new Date(version.createdAt), 'MMM d, yyyy')}
            </span>
            <span className={PLANNER_MUTED} aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span className="font-medium tabular-nums">{version.lineItems.length}</span>
            <span className={PLANNER_MUTED}>
              {' '}
              line item{version.lineItems.length === 1 ? '' : 's'}
            </span>
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <div>
              <dt className={PLANNER_MUTED}>Total price</dt>
              <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
                {resolvedTotalPrice}
              </dd>
            </div>
            <div>
              <dt className={PLANNER_MUTED}>Labor hours</dt>
              <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
                {resolvedLaborHours}
              </dd>
            </div>
            {plannedDurationDisplay ? (
              <div className="col-span-2 sm:col-span-1">
                <dt className={PLANNER_MUTED}>Planned duration</dt>
                <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
                  {plannedDurationDisplay}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="border-t border-slate-200 pt-2 dark:border-slate-700/80">
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Current version
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
              <span className={`font-semibold ${TEXT_FOREGROUND}`}>
                {formatEstimateBlank(version.versionName)} v{version.versionNumber}
              </span>
              <FieldRecordStatusBadge status={version.status} />
              <span className={`${BADGE_BASE} ${BADGE_INFO}`}>
                {formatEstimateMethodLabel(version.estimateType)}
              </span>
              <span className={`tabular-nums font-medium ${TEXT_BODY}`}>
                {savedVersionSellPrice(version)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className={`text-xs ${PLANNER_MUTED}`}>
          No saved version yet. Add line items and save from the Line items tab.
        </p>
      )}
    </div>
  );
}
