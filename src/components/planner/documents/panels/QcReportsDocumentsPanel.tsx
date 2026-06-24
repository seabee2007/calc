import { useMemo, useState } from 'react';
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
  DocumentsFilterBar,
  DocumentsSectionCard,
  formatDocDate,
  formatSigningMeta,
  matchesDateFilter,
  matchesSearchTerm,
  SimpleDocumentsTable,
} from '../documentsPanelUtils';

interface Props {
  projectId: string;
  qcReportDocs: ProjectDocumentRow[];
  inspections: ConcreteInspectionChecklist[];
  highlightInspectionId: string | null;
  onReload: () => void;
}

function qcReportMatchesSearch(doc: ProjectDocumentRow, term: string): boolean {
  const haystack = [
    doc.title,
    doc.document_number,
    doc.document_type,
    doc.pack_key,
    doc.status,
    doc.signing_status,
    formatSigningMeta(doc),
  ]
    .filter(Boolean)
    .join(' ');
  return matchesSearchTerm(haystack, term);
}

function inspectionMatchesSearch(checklist: ConcreteInspectionChecklist, term: string): boolean {
  const haystack = [
    checklist.projectName,
    checklist.projectAddress,
    checklist.inspector,
    checklist.contractor,
    checklist.mixDesign,
    checklist.placementType,
    checklist.pourArea,
    checklist.estimatedYards,
    checklist.notes,
  ]
    .filter(Boolean)
    .join(' ');
  return matchesSearchTerm(haystack, term);
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
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportDateFilter, setReportDateFilter] = useState('');
  const [checklistSearchTerm, setChecklistSearchTerm] = useState('');
  const [checklistDateFilter, setChecklistDateFilter] = useState('');
  const { records, saveQCRecord, deleteQCRecord } = useProjectQcRecordHandlers(projectId);

  const filteredQcReportDocs = useMemo(
    () =>
      qcReportDocs.filter(
        (doc) =>
          qcReportMatchesSearch(doc, reportSearchTerm) &&
          matchesDateFilter(doc.updated_at ?? doc.created_at, reportDateFilter),
      ),
    [qcReportDocs, reportDateFilter, reportSearchTerm],
  );

  const filteredInspections = useMemo(
    () =>
      inspections.filter(
        (checklist) =>
          inspectionMatchesSearch(checklist, checklistSearchTerm) &&
          matchesDateFilter(checklist.inspectionDate, checklistDateFilter),
      ),
    [checklistDateFilter, checklistSearchTerm, inspections],
  );

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
          <DocumentsFilterBar
            searchPlaceholder="Search QC reports..."
            searchTerm={reportSearchTerm}
            onSearchTermChange={setReportSearchTerm}
            dateFilter={reportDateFilter}
            onDateFilterChange={setReportDateFilter}
          />
          {filteredQcReportDocs.length === 0 ? (
            <DocumentsEmptyState
              message={
                qcReportDocs.length === 0 ? 'No QC reports yet.' : 'No QC reports found.'
              }
            />
          ) : (
            <BuilderDraftsTable
              docs={filteredQcReportDocs}
              projectId={projectId}
              empty="No QC reports found."
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
          <DocumentsFilterBar
            searchPlaceholder="Search QC checklists..."
            searchTerm={checklistSearchTerm}
            onSearchTermChange={setChecklistSearchTerm}
            dateFilter={checklistDateFilter}
            onDateFilterChange={setChecklistDateFilter}
          />
          {filteredInspections.length === 0 ? (
            <DocumentsEmptyState message="No QC checklists found." />
          ) : (
            <SimpleDocumentsTable
              rows={filteredInspections.map((c) => ({
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
