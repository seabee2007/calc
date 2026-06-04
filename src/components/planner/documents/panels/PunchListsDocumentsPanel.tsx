import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import Button from '../../../ui/Button';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
import { BuilderDraftsTable, DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';

interface Props {
  projectId: string;
  docs: ProjectDocumentRow[];
  onReload: () => void;
}

export default function PunchListsDocumentsPanel({ projectId, docs, onReload }: Props) {
  const navigate = useNavigate();
  const [drawerDocId, setDrawerDocId] = useState<string | null>(null);

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
                  packKey: 'GENERIC_PUNCH_LIST',
                  documentType: 'punch_list',
                }),
              )
            }
          >
            New punch list
          </Button>
        }
      />
      <BuilderDraftsTable
        docs={docs}
        projectId={projectId}
        empty="No punch lists saved yet."
        onDeleted={onReload}
        onOpenDrawer={setDrawerDocId}
      />
      <DocumentsPanelFootnote />
      <ProjectDocumentDrawer
        documentId={drawerDocId}
        projectId={projectId}
        onClose={() => setDrawerDocId(null)}
        onSaved={onReload}
      />
    </>
  );
}
