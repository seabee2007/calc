import { FilePlus2 } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import { APP_SECTION_CARD, TEXT_BODY, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import type { ContractDocumentRow } from '../../services/contractDocumentTypes';

export interface DocumentMetaPanelProps {
  documentId: string | null;
  title: string;
  savedDocs: ContractDocumentRow[];
  onTitleChange: (title: string) => void;
  onNewContract: () => void;
  onLoadDocument: (id: string) => void;
  /**
   * When true the document is a Change Order — the "Contract title" input is
   * hidden because the Change Order title comes from the questionnaire field
   * instead. The saved-docs list and New/Load controls remain visible.
   */
  isChangeOrder?: boolean;
}

export default function DocumentMetaPanel({
  documentId,
  title,
  savedDocs,
  onTitleChange,
  onNewContract,
  onLoadDocument,
  isChangeOrder = false,
}: DocumentMetaPanelProps) {
  const headingNew = isChangeOrder ? 'New document' : 'New contract';
  const headingSaved = isChangeOrder ? 'Saved document' : 'Saved contract';

  return (
    <div className={APP_SECTION_CARD}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>
          {documentId ? headingSaved : headingNew}
        </h2>
        {documentId && (
          <Button variant="ghost" size="sm" onClick={onNewContract}>
            <FilePlus2 className="mr-1 h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        )}
      </div>

      {/* Contract title input — hidden for Change Orders because the CO title
          comes from the "Change order title" questionnaire field instead. */}
      {!isChangeOrder && (
        <div className="space-y-3">
          <Input
            label="Contract title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Smith driveway agreement"
            fullWidth
          />
        </div>
      )}

      {savedDocs.length > 0 && (
        <div className={`border-t border-slate-200 pt-3 dark:border-slate-700 ${!isChangeOrder ? 'mt-4' : ''}`}>
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
