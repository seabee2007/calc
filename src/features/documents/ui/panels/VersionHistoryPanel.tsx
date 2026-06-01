import { History } from 'lucide-react';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { ContractDocumentVersionRow } from '../../services/contractDocumentTypes';

export interface VersionHistoryPanelProps {
  versions: ContractDocumentVersionRow[];
  previewVersion: ContractDocumentVersionRow | null;
  onSelectVersion: (version: ContractDocumentVersionRow) => void;
  onClearPreview: () => void;
}

export default function VersionHistoryPanel({
  versions,
  previewVersion,
  onSelectVersion,
  onClearPreview,
}: VersionHistoryPanelProps) {
  if (versions.length === 0) return null;

  return (
    <div className={APP_SECTION_CARD}>
      <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${TEXT_FOREGROUND}`}>
        <History className="h-4 w-4" aria-hidden />
        Version history
      </h2>
      <ul className="space-y-1.5">
        {previewVersion && (
          <li>
            <button
              type="button"
              onClick={onClearPreview}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-cyan-700 hover:bg-slate-100 dark:text-cyan-300 dark:hover:bg-slate-700/60"
            >
              Back to live draft
            </button>
          </li>
        )}
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onSelectVersion(v)}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/60 ${
                previewVersion?.id === v.id ? 'bg-cyan-500/10' : ''
              }`}
            >
              <span className={TEXT_BODY}>
                Version {v.version_number}
                <span className={`ml-2 text-xs ${TEXT_MUTED}`}>
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </span>
              <span className={`shrink-0 font-mono text-xs ${TEXT_MUTED}`}>{v.output_hash}</span>
            </button>
          </li>
        ))}
      </ul>
      {previewVersion && (
        <p className={`mt-2 text-xs ${TEXT_MUTED}`}>
          Viewing an immutable saved snapshot. Editing intake affects the live draft only.
        </p>
      )}
    </div>
  );
}
