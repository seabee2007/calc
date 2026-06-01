import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { DocumentComplianceIssue, DocumentExportPolicy } from '../../types';
import { SEVERITY_TEXT } from '../contractBuilderConstants';

export interface ExportPanelProps {
  complianceIssues: DocumentComplianceIssue[];
  exportPolicy: DocumentExportPolicy;
  exporting: boolean;
  onExport: () => void;
  onDownloadManifest: () => void;
}

export default function ExportPanel({
  complianceIssues,
  exportPolicy,
  exporting,
  onExport,
  onDownloadManifest,
}: ExportPanelProps) {
  return (
    <div className={APP_SECTION_CARD}>
      <h2 className={`mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`}>Export</h2>
      <ul className="space-y-1.5">
        {complianceIssues.map((issue, idx) => {
          const Icon =
            issue.severity === 'blocker'
              ? AlertTriangle
              : issue.severity === 'warning'
                ? Info
                : issue.severity === 'info'
                  ? Info
                  : CheckCircle2;
          return (
            <li key={`${issue.code}-${idx}`} className="flex items-start gap-2 text-sm">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_TEXT[issue.severity] ?? TEXT_MUTED}`}
                aria-hidden
              />
              <span className={TEXT_BODY}>{issue.message}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" onClick={onExport} isLoading={exporting}>
          Download draft PDF
        </Button>
        <Button variant="outline" onClick={onDownloadManifest}>
          Download manifest (JSON)
        </Button>
        <Button variant="outline" disabled title={exportPolicy.reason}>
          Final export
        </Button>
        {exportPolicy.reason && (
          <span className={`text-xs ${TEXT_MUTED}`}>{exportPolicy.reason}</span>
        )}
      </div>
    </div>
  );
}
