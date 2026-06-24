import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { AccountingExportData, AccountingExportWarning } from '../../utils/accountingExport';
import InlineNotice from '../ui/InlineNotice';

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

  const checks: CheckItem[] = [];

  if (!businessName?.trim()) {
    checks.push({
      key: 'business_name',
      label: 'Business name is missing — add it in Settings for export headers.',
      passed: false,
      severity: 'warning',
    });
  }

  checks.push(
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
        data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null ? 'ok' : 'info',
    },
  );

  const warnings = data.warnings;

  if (checks.every((c) => c.passed) && warnings.length === 0) {
    return (
      <div data-testid="export-checklist-ok" className={className}>
        <InlineNotice variant="success" title="All checks passed. Ready to export." />
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
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
        className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-100"
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
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100"
        role="listitem"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-800/80 dark:bg-blue-950/30 dark:text-blue-100"
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
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100"
      role="listitem"
      data-testid={`export-warning-${warning.key}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{warning.message}</span>
    </div>
  );
}

export default ExportValidationChecklist;
