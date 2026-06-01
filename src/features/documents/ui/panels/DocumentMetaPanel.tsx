import { FilePlus2, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { ContractDocumentRow } from '../../services/contractDocumentTypes';

export interface DocumentMetaPanelProps {
  documentId: string | null;
  title: string;
  projectId: string | null;
  projectOptions: { value: string; label: string }[];
  savedDocs: ContractDocumentRow[];
  saving: boolean;
  onTitleChange: (title: string) => void;
  onProjectChange: (projectId: string | null) => void;
  onSave: () => void;
  onNewContract: () => void;
  onLoadDocument: (id: string) => void;
}

export default function DocumentMetaPanel({
  documentId,
  title,
  projectId,
  projectOptions,
  savedDocs,
  saving,
  onTitleChange,
  onProjectChange,
  onSave,
  onNewContract,
  onLoadDocument,
}: DocumentMetaPanelProps) {
  return (
    <div className={APP_SECTION_CARD}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>
          {documentId ? 'Saved contract' : 'New contract'}
        </h2>
        {documentId && (
          <Button variant="ghost" size="sm" onClick={onNewContract}>
            <FilePlus2 className="mr-1 h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <Input
          label="Contract title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Smith driveway agreement"
          fullWidth
        />
        <Select
          label="Project (optional)"
          options={projectOptions}
          value={projectId ?? ''}
          onChange={(v) => onProjectChange(v || null)}
          fullWidth
        />
        <Button variant="accent" onClick={onSave} isLoading={saving} fullWidth>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          {documentId ? 'Save new version' : 'Save contract'}
        </Button>
      </div>

      {savedDocs.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${TEXT_MUTED}`}>
            Open saved
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {savedDocs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => onLoadDocument(doc.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/60 ${
                    doc.id === documentId ? 'bg-cyan-500/10' : ''
                  }`}
                >
                  <span className={`truncate ${TEXT_BODY}`}>{doc.title}</span>
                  <span className={`shrink-0 text-xs ${TEXT_MUTED}`}>v{doc.latest_version_number}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
