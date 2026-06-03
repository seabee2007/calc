import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import Button from '../../../ui/Button';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import { BuilderDraftsTable, DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';

interface Props {
  projectId: string;
  docs: ProjectDocumentRow[];
  onReload: () => void;
}

export default function SubmittalsDocumentsPanel({ projectId, docs, onReload }: Props) {
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
                  packKey: 'GENERIC_SUBMITTAL',
                  documentType: 'submittal',
                }),
              )
            }
          >
            New submittal
          </Button>
        }
      />
      <BuilderDraftsTable
        docs={docs}
        projectId={projectId}
        empty="No submittal cover sheets saved for this project yet."
        onDeleted={onReload}
      />
      <DocumentsPanelFootnote />
    </>
  );
}
