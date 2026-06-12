import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { AccountingExportData, AccountingExportWarning } from '../../utils/accountingExport';
import { NON_SCHEDULE_C_ENTITIES } from '../../utils/accountingExport';

interface ExportValidationChecklistProps {
  data: AccountingExportData | null;
  businessName: string | undefined;
  className?: string;
}

interface CheckItem {
  key: string;
  label: string;
  passed: boolean;
  severity: 'ok' | 'warning' | 'info';
}

const ExportValidationChecklist: React.FC<ExportValidationChecklistProps> = ({
  data,
  businessName,
  className = '',
}) => {
  if (!data) return null;

  const checks: CheckItem[] = [
    {
      key: 'business_name',
      label: businessName?.trim()
        ? `Business name set: ${businessName}`
        : 'Business name is missing — add it in Settings for export headers.',
      passed: Boolean(businessName?.trim()),
      severity: businessName?.trim() ? 'ok' : 'warning',
    },
    {
      key: 'recognized_revenue',
      label:
        data.recognizedProposals.length > 0
          ? `${data.recognizedProposals.length} accepted proposal(s) found for ${data.taxYear}.`
          : `No accepted proposals found for ${data.taxYear}. Check your tax year and accounting method.`,
      passed: data.recognizedProposals.length > 0,
      severity: data.recognizedProposals.length > 0 ? 'ok' : 'warning',
    },
    {
      key: 'cost_data',
      label:
        data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null
          ? 'Job-cost data found on recognized proposals.'
          : 'No cost data found — cost fields will show "Not tracked" in exports.',
      passed: data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null,
      severity:
        data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null
          ? 'ok'
          : 'info',
    },
  ];

  // Render data warnings (cash timestamps, entity type, etc.)
  const warnings = data.warnings;

  if (checks.every((c) => c.passed) && warnings.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ${className}`}
        data-testid="export-checklist-ok"
      >
        <CheckCircle className="h-5 w-5 shrink-0" aria-hidden />
        <span>All checks passed. Ready to export.</span>
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 ${className}`}
      data-testid="export-checklist"
      role="list"
      aria-label="Export readiness checks"
    >
      {checks.map((c) => (
        <ChecklistRow key={c.key} item={c} />
      ))}
      {warnings.map((w) => (
        <WarningRow key={w.key} warning={w} />
      ))}
    </div>
  );
};

function ChecklistRow({ item }: { item: CheckItem }) {
  if (item.passed) {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        role="listitem"
      >
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </div>
    );
  }

  if (item.severity === 'warning') {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        role="listitem"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
      role="listitem"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </div>
  );
}

function WarningRow({ warning }: { warning: AccountingExportWarning }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      role="listitem"
      data-testid={`export-warning-${warning.key}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{warning.message}</span>
    </div>
  );
}

export default ExportValidationChecklist;
