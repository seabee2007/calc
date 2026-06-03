import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import Button from '../../../ui/Button';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import { PLANNER_SECTION_TITLE } from '../../plannerTheme';
import { BuilderDraftsTable, DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';

interface Props {
  projectId: string;
  closeoutDocs: ProjectDocumentRow[];
  otherDocs: ProjectDocumentRow[];
  onReload: () => void;
}

export default function CloseoutDocumentsPanel({
  projectId,
  closeoutDocs,
  otherDocs,
  onReload,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <PanelActionRow
        action={
          <Button
            variant="accent"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() =>
              navigate(
                contractBuilderToolHref(projectId, undefined, {
                  packKey: 'GENERIC_WARRANTY_CLOSEOUT',
                  documentType: 'warranty_letter',
                }),
              )
            }
          >
            New closeout / warranty letter
          </Button>
        }
      />
      <BuilderDraftsTable
        docs={closeoutDocs}
        projectId={projectId}
        empty="No closeout or warranty documents saved yet."
        onDeleted={onReload}
      />
      {otherDocs.length > 0 ? (
        <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
          <h3 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>Other documents</h3>
          <BuilderDraftsTable docs={otherDocs} projectId={projectId} empty="" onDeleted={onReload} />
        </section>
      ) : null}
      <DocumentsPanelFootnote />
    </>
  );
}
