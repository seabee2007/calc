import Button from '../../../../components/ui/Button';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { DocumentExportPolicy } from '../../types';

export interface ExportPanelProps {
  exportPolicy: DocumentExportPolicy;
  exporting: boolean;
  onExport: () => void;
  onDownloadManifest: () => void;
}

export default function ExportPanel({
  exportPolicy,
  exporting,
  onExport,
  onDownloadManifest,
}: ExportPanelProps) {
  return (
    <div className={APP_SECTION_CARD}>
      <h2 className={`mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`}>Export</h2>
      <div className={`space-y-1.5 text-sm ${TEXT_BODY}`}>
        <p>Draft PDF</p>
        <p>Manifest JSON</p>
        <p>
          Final Export{' '}
          <span className="font-semibold text-amber-700 dark:text-amber-300">Unavailable</span>
        </p>
        <p className={TEXT_MUTED}>
          Reason: {exportPolicy.reason ?? 'Attorney-reviewed state pack required.'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" onClick={onExport} isLoading={exporting}>
          Draft PDF
        </Button>
        <Button variant="outline" onClick={onDownloadManifest}>
          Manifest JSON
        </Button>
        <Button variant="outline" disabled title={exportPolicy.reason}>
          Final export
        </Button>
      </div>
    </div>
  );
}
