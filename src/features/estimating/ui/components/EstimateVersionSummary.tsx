import { format } from 'date-fns';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import type { EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { formatEstimateBlank, formatEstimateCurrency } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  estimate: EstimateSummary;
  version: EstimateDomainVersion | null;
  /** Compact layout for embedded panels (e.g. line items tab). */
  compact?: boolean;
}

function savedVersionSellPrice(version: EstimateDomainVersion): string {
  const sell =
    version.totals.finalSellPrice ??
    version.totals.directCost ??
    null;
  return formatEstimateCurrency(sell);
}

export default function EstimateVersionSummary({ estimate, version, compact = false }: Props) {
  if (compact && version) {
    return (
      <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className={PLANNER_MUTED}>Version</dt>
            <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
              v{version.versionNumber}
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Status</dt>
            <dd className="mt-0.5">
              <FieldRecordStatusBadge status={version.status} />
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Created</dt>
            <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>
              {format(new Date(version.createdAt), 'MMM d, yyyy')}
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Line items</dt>
            <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
              {version.lineItems.length}
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Total sell price</dt>
            <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
              {savedVersionSellPrice(version)}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={PLANNER_SECTION_TITLE}>Estimate record</p>
          <p className={`mt-1 text-base font-semibold ${TEXT_FOREGROUND}`}>
            {formatEstimateBlank(estimate.name)}
          </p>
        </div>
        <FieldRecordStatusBadge status={estimate.status} />
      </div>

      {version ? (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className={PLANNER_MUTED}>Version</dt>
            <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>
              {version.versionName} (v{version.versionNumber})
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Estimate type</dt>
            <dd className={`mt-0.5 font-medium capitalize ${TEXT_BODY}`}>
              {version.estimateType.replace(/_/g, ' ')}
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Version status</dt>
            <dd className="mt-0.5">
              <FieldRecordStatusBadge status={version.status} />
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Saved</dt>
            <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>
              {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
            </dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Line items</dt>
            <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>{version.lineItems.length}</dd>
          </div>
          <div>
            <dt className={PLANNER_MUTED}>Total sell price</dt>
            <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
              {savedVersionSellPrice(version)}
            </dd>
          </div>
          {version.notes ? (
            <div className="sm:col-span-2">
              <dt className={PLANNER_MUTED}>Notes</dt>
              <dd className={`mt-0.5 whitespace-pre-wrap ${TEXT_BODY}`}>{version.notes}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className={`text-sm ${PLANNER_MUTED}`}>
          This estimate does not have a saved version yet.
        </p>
      )}
    </div>
  );
}
