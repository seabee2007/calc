import { format } from 'date-fns';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { ESTIMATE_BLANK, formatEstimateBlank, formatEstimateCurrency } from '../estimateFormatters';
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
  draftDirty?: boolean;
}

function VersionMetaLine({ version }: { version: EstimateDomainVersion }) {
  return (
    <p className={`text-xs tabular-nums ${TEXT_BODY}`}>
      <span className={PLANNER_MUTED}>Saved </span>
      <span className="font-medium">{format(new Date(version.createdAt), 'MMM d, yyyy')}</span>
      <span className={PLANNER_MUTED} aria-hidden>
        {' '}
        ·{' '}
      </span>
      <span className="font-medium">{version.lineItems.length}</span>
      <span className={PLANNER_MUTED}>
        {' '}
        activit{version.lineItems.length === 1 ? 'y' : 'ies'}
      </span>
    </p>
  );
}

function MetricCell({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className={`text-[10px] font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm font-medium tabular-nums sm:text-xs ${TEXT_BODY}`}>
        {value}
      </dd>
    </div>
  );
}

export default function EstimateWorkspaceHeader({
  estimate = null,
  version = null,
  totalPriceDisplay,
  laborHoursDisplay,
  plannedDurationDisplay = null,
  hasEstimate = false,
  draftDirty = false,
}: Props) {
  const estimateType = version?.estimateType ?? null;
  const resolvedTotalPrice =
    totalPriceDisplay ??
    (version
      ? formatEstimateCurrency(version.totals.finalSellPrice ?? version.totals.directCost)
      : ESTIMATE_BLANK);
  const resolvedLaborHours = laborHoursDisplay ?? ESTIMATE_BLANK;
  const resolvedPlannedDuration = plannedDurationDisplay ?? ESTIMATE_BLANK;

  if (!hasEstimate) {
    return (
      <div className="mb-4">
        <p className={`text-sm ${PLANNER_MUTED}`}>
          No estimate has been started for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_FORM_PANEL} mb-4 px-3 py-2.5 sm:px-4 sm:py-3`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
            <span className={`text-xs ${PLANNER_MUTED}`}>Unsaved draft activities</span>
          ) : null}
        </div>

        {version ? (
          <div className="min-w-0 sm:max-w-[50%] sm:text-right">
            <VersionMetaLine version={version} />
          </div>
        ) : null}
      </div>

      {version ? (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:mt-2 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-1">
          <MetricCell label="Total price" value={resolvedTotalPrice} />
          <MetricCell label="Labor hours" value={resolvedLaborHours} />
          <MetricCell
            label="Planned duration"
            value={resolvedPlannedDuration}
            className="col-span-2 sm:col-span-1"
          />
        </dl>
      ) : (
        <p className={`mt-2 text-xs ${PLANNER_MUTED}`}>
          No saved estimate details yet. Start your estimate from the Estimate tab.
        </p>
      )}
    </div>
  );
}
