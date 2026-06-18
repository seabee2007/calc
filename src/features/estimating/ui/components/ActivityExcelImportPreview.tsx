import { PLANNER_MUTED, TEXT_BODY } from '../estimateWorkspaceTheme';
import type { ActivityExcelImportPreview } from '../../excel/estimateExcelTypes';
import { previewImportableRowCount as countImportableRows } from '../../excel/estimateExcelImportParser';
import { hasBlockingPreviewErrors } from '../../excel/estimateExcelValidation';

interface Props {
  preview: ActivityExcelImportPreview;
}

export function hasActivityExcelPreviewErrors(preview: ActivityExcelImportPreview): boolean {
  return hasBlockingPreviewErrors({
    errors: preview.errors,
    importableRowCount: countImportableRows(preview),
  });
}

export default function ActivityExcelImportPreview({ preview }: Props) {
  const importableRows = countImportableRows(preview);
  const hasErrors = hasActivityExcelPreviewErrors(preview);
  const rowMessages = preview.rowResults.filter((row) => row.messages.length > 0);

  return (
    <div className="space-y-4" data-testid="activity-excel-import-preview">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Activities</p>
          <p className="text-lg font-semibold">{preview.activityCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Valid</p>
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{preview.validCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Warnings</p>
          <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{preview.warningCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Blocked</p>
          <p className="text-lg font-semibold text-red-700 dark:text-red-300">{preview.blockedCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Duplicates</p>
          <p className="text-lg font-semibold">{preview.duplicateCount}</p>
        </div>
        <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
          <p className={PLANNER_MUTED}>Unpriced</p>
          <p className="text-lg font-semibold">{preview.unpricedCount}</p>
        </div>
      </div>

      <div className={`rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>Importable rows</p>
        <p className="text-lg font-semibold">{importableRows}</p>
        <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
          Arden recalculates labor hours and totals internally. Excel totals are never trusted.
        </p>
      </div>

      {preview.groups.length > 0 ? (
        <div>
          <p className={`mb-2 text-sm font-medium ${TEXT_BODY}`}>Activity groups</p>
          <ul className={`space-y-1 text-sm ${PLANNER_MUTED}`}>
            {preview.groups.map((group) => (
              <li key={group.groupKey}>
                {group.divisionCode} — {group.activityName}
                {group.activityCode ? ` (${group.activityCode})` : ''} ({group.lineRows.length} line
                {group.lineRows.length === 1 ? '' : 's'})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rowMessages.length > 0 ? (
        <div>
          <p className={`mb-2 text-sm font-medium ${TEXT_BODY}`}>Row messages</p>
          <ul className={`max-h-48 space-y-1 overflow-y-auto text-sm ${PLANNER_MUTED}`}>
            {rowMessages.slice(0, 40).map((row) => (
              <li key={row.rowNumber}>
                Row {row.rowNumber} ({row.status}): {row.messages.join(' ')}
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
          Fix blocking errors before importing this file.
        </p>
      ) : (
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Ready to import {importableRows} row{importableRows === 1 ? '' : 's'} into construction activities.
        </p>
      )}
    </div>
  );
}
