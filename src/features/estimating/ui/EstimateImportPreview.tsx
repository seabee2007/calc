import { formatEstimateCurrency } from './estimateFormatters';
import { PLANNER_MUTED, TEXT_BODY } from './estimateWorkspaceTheme';
import type { EstimateImportPreview as EstimateImportPreviewData } from '../importExport/estimateImportParser';

interface Props {
  preview: EstimateImportPreviewData;
}

export function hasImportPreviewErrors(preview: EstimateImportPreviewData): boolean {
  return preview.errors.length > 0 || preview.lineItemCount === 0;
}

export default function EstimateImportPreview({ preview }: Props) {
  const hasErrors = hasImportPreviewErrors(preview);

  return (
    <div className="space-y-4" data-testid="estimate-import-preview">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Divisions found</p>
          <p className="text-lg font-semibold">{preview.divisionCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Line items found</p>
          <p className="text-lg font-semibold">{preview.lineItemCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Estimated total</p>
          <p className="text-lg font-semibold">{formatEstimateCurrency(preview.estimatedTotal)}</p>
        </div>
      </div>

      {preview.divisions.length > 0 ? (
        <div>
          <p className={`mb-2 text-sm font-medium ${TEXT_BODY}`}>Divisions</p>
          <ul className={`space-y-1 text-sm ${PLANNER_MUTED}`}>
            {preview.divisions.map((division) => (
              <li key={division.code}>
                {division.code} — {division.name} ({division.lineItemCount} line
                {division.lineItemCount === 1 ? '' : 's'})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.errors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-medium">Errors</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasErrors ? (
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Fix the errors above before importing this file.
        </p>
      ) : null}
    </div>
  );
}
