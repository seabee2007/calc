import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import type { ConcreteInspectionChecklist } from '../../../../types/fieldTools';
import QCRecords from '../../../projects/QCRecords';
import Button from '../../../ui/Button';
import { contractBuilderToolHref, concreteInspectionToolHref } from '../../../../utils/plannerRoutes';
import { useProjectQcRecordHandlers } from '../../../../features/projects/hooks/useProjectQcRecordHandlers';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
import {
  BuilderDraftsTable,
  DocumentsEmptyState,
  DocumentsSectionCard,
  formatDocDate,
  SimpleDocumentsTable,
} from '../documentsPanelUtils';

interface Props {
  projectId: string;
  qcReportDocs: ProjectDocumentRow[];
  inspections: ConcreteInspectionChecklist[];
  highlightInspectionId: string | null;
  onReload: () => void;
}

export default function QcReportsDocumentsPanel({
  projectId,
  qcReportDocs,
  inspections,
  highlightInspectionId,
  onReload,
}: Props) {
  const navigate = useNavigate();
  const [drawerDocId, setDrawerDocId] = useState<string | null>(null);
  const { records, saveQCRecord, deleteQCRecord } = useProjectQcRecordHandlers(projectId);

  return (
    <>
      <div className="space-y-8">
        <DocumentsSectionCard
          title="QC Reports"
          description="Create a QC report to document inspections, tests, and quality control activity."
          action={
            <Button
              variant="accent"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                navigate(
                  contractBuilderToolHref(projectId, undefined, {
                    packKey: 'GENERIC_QC_REPORT',
                    documentType: 'qc_report',
                  }),
                )
              }
            >
              New QC report
            </Button>
          }
        >
          {qcReportDocs.length === 0 ? (
            <DocumentsEmptyState message="No QC reports yet." />
          ) : (
            <BuilderDraftsTable
              docs={qcReportDocs}
              projectId={projectId}
              empty="No QC reports yet."
              onDeleted={onReload}
              onOpenDrawer={setDrawerDocId}
            />
          )}
        </DocumentsSectionCard>

        <DocumentsSectionCard>
          <QCRecords
            projectId={projectId}
            records={records}
            onSave={saveQCRecord}
            onDelete={deleteQCRecord}
            presentation="documents"
          />
        </DocumentsSectionCard>

        <DocumentsSectionCard
          title="QC Checklists"
          description="Create inspection checklists for project quality control."
          action={
            <Button
              variant="accent"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(concreteInspectionToolHref(projectId))}
            >
              New checklist
            </Button>
          }
        >
          {inspections.length === 0 ? (
            <DocumentsEmptyState message="No QC checklists found." />
          ) : (
            <SimpleDocumentsTable
              rows={inspections.map((c) => ({
                id: c.id,
                date: formatDocDate(c.inspectionDate),
                title: c.projectName || 'Concrete inspection',
                meta: c.inspector ? `Inspector: ${c.inspector}` : c.mixDesign || '—',
              }))}
              empty="No QC checklists found."
              highlightId={highlightInspectionId}
              buildHref={(id) => concreteInspectionToolHref(projectId, id)}
            />
          )}
        </DocumentsSectionCard>
      </div>

      <ProjectDocumentDrawer
        documentId={drawerDocId}
        projectId={projectId}
        onClose={() => setDrawerDocId(null)}
        onSaved={onReload}
      />
    </>
  );
}
