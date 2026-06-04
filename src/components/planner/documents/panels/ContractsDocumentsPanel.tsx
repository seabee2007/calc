import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import Button from '../../../ui/Button';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
import {
  DocumentsPanelFootnote,
  formatDocDate,
  formatSigningMeta,
  PanelActionRow,
  SimpleDocumentsTable,
} from '../documentsPanelUtils';

interface Props {
  projectId: string;
  contracts: ProjectDocumentRow[];
  highlightContractId: string | null;
  onReload?: () => void;
}

export default function ContractsDocumentsPanel({
  projectId,
  contracts,
  highlightContractId,
  onReload,
}: Props) {
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
                  packKey: 'GENERIC_RESIDENTIAL',
                  documentType: 'residential_contract',
                }),
              )
            }
          >
            New contract
          </Button>
        }
      />
      <SimpleDocumentsTable
        rows={contracts.map((c) => ({
          id: c.id,
          date: formatDocDate(c.updated_at),
          title: c.title,
          meta: formatSigningMeta(c),
        }))}
        empty="No contracts saved for this project yet."
        highlightId={highlightContractId}
        buildHref={(id) => contractBuilderToolHref(projectId, id)}
        onOpenDrawer={setDrawerDocId}
        primaryLabel="View / Update"
      />
      <DocumentsPanelFootnote />
      <ProjectDocumentDrawer
        documentId={drawerDocId}
        projectId={projectId}
        onClose={() => setDrawerDocId(null)}
        onSaved={() => onReload?.()}
      />
    </>
  );
}
