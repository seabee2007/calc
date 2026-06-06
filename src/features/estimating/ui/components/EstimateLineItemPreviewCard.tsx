import { useMemo } from 'react';
import Card from '../../../../components/ui/Card';
import {
  collectDraftFormWarnings,
  computeLinePreviewTotals,
} from '../estimateFormDefaults';
import {
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
} from '../estimateFormatters';
import type { EstimateDraftLine } from '../../application/estimateDraftLine';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  draft: EstimateDraftLine;
}

interface PreviewRow {
  label: string;
  value: string;
}

function PreviewGrid({ rows }: { rows: PreviewRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-2 sm:block">
          <dt className={`text-xs ${PLANNER_MUTED}`}>{row.label}</dt>
          <dd className={`text-sm font-medium tabular-nums ${TEXT_FOREGROUND}`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function EstimateLineItemPreviewCard({ draft }: Props) {
  const totals = useMemo(() => computeLinePreviewTotals(draft), [draft]);
  const warnings = useMemo(() => collectDraftFormWarnings(draft), [draft]);

  const metricRows: PreviewRow[] = [
    { label: 'Labor hours', value: formatEstimateHours(totals.laborHours) },
    { label: 'Man-days', value: formatEstimateNumber(totals.manDays, { decimals: 2 }) },
    { label: 'Crew-days', value: formatEstimateNumber(totals.crewDays, { decimals: 2 }) },
    { label: 'Duration days', value: formatEstimateNumber(totals.durationDays, { decimals: 2 }) },
  ];

  const costRows: PreviewRow[] = [
    { label: 'Labor cost', value: formatEstimateCurrency(totals.laborCost) },
    { label: 'Material cost', value: formatEstimateCurrency(totals.materialCost) },
    { label: 'Equipment cost', value: formatEstimateCurrency(totals.equipmentCost) },
    { label: 'Subcontractor cost', value: formatEstimateCurrency(totals.subcontractorCost) },
    { label: 'Direct cost', value: formatEstimateCurrency(totals.directCost) },
  ];

  return (
    <Card variant="panel" className={`${PLANNER_FORM_PANEL} mt-4`}>
      <h3 className={PLANNER_SECTION_TITLE}>Activity preview</h3>
      <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
        Calculated from the estimating engine using current form values.
      </p>

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
            Metrics
          </p>
          <PreviewGrid rows={metricRows} />
        </div>
        <div>
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
            Direct costs
          </p>
          <PreviewGrid rows={costRows} />
        </div>
      </div>
    </Card>
  );
}
