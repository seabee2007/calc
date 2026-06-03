import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import type { ConcreteInspectionChecklist } from '../../../../types/fieldTools';
import Button from '../../../ui/Button';
import { contractBuilderToolHref, concreteInspectionToolHref } from '../../../../utils/plannerRoutes';
import { PLANNER_SECTION_TITLE } from '../../plannerTheme';
import {
  BuilderDraftsTable,
  DocumentsPanelFootnote,
  formatDocDate,
  PanelActionRow,
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
                  packKey: 'GENERIC_QC_REPORT',
                  documentType: 'qc_report',
                }),
              )
            }
          >
            New QC report
          </Button>
        }
      />
      <BuilderDraftsTable docs={qcReportDocs} projectId={projectId} empty="No QC reports saved yet." onDeleted={onReload} />

      <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className={PLANNER_SECTION_TITLE}>QC checklists</h3>
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate(concreteInspectionToolHref(projectId))}
          >
            New checklist
          </Button>
        </div>
        <SimpleDocumentsTable
          rows={inspections.map((c) => ({
            id: c.id,
            date: formatDocDate(c.inspectionDate),
            title: c.projectName || 'Concrete inspection',
            meta: c.inspector ? `Inspector: ${c.inspector}` : c.mixDesign || '—',
          }))}
          empty="No inspection checklists saved for this project yet."
          highlightId={highlightInspectionId}
          buildHref={(id) => concreteInspectionToolHref(projectId, id)}
        />
      </section>
      <DocumentsPanelFootnote />
    </>
  );
}
