import type { QcReportDocumentView } from '../adapters/qcReportPreviewAdapter';
import {
  DocumentInfoGrid,
  DocumentSignatureBlock,
  PaperDocumentSection,
  ProfessionalDocumentShell,
} from '../components';

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900 [overflow-wrap:anywhere]">
        {text}
      </p>
    </div>
  );
}

function OptionalTextBlock({ label, text }: { label: string; text: string }) {
  if (text === '—') return null;
  return <TextBlock label={label} text={text} />;
}

function hasAny(...values: string[]): boolean {
  return values.some((v) => v !== '—' && v.trim() !== '');
}

interface QcReportDocumentProps {
  view: QcReportDocumentView;
}

/**
 * Professional QC Report paper document for the Contract & Document Builder preview.
 */
export default function QcReportDocument({ view }: QcReportDocumentProps) {
  const hasConcreteQc = hasAny(
    view.concretePlacementDate,
    view.mixDesignReference,
    view.truckTicketNumbers,
    view.slump,
    view.airContent,
    view.concreteTemperature,
    view.ambientTemperature,
    view.cylinderSetNumbers,
    view.breakResults,
  );

  const hasTesting = hasAny(
    view.testType,
    view.testResults,
    view.testingAgency,
    view.sampleNumbers,
  );

  const hasDeficiencySection = hasAny(
    view.deficiencies,
    view.correctiveActions,
    view.responsibleParty,
    view.followUpRequired,
    view.followUpDate,
    view.reinspectionRequired,
    view.reinspectionDate,
  );

  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="QC REPORT"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Inspection Overview">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Inspection Type" text={view.inspectionType} />
          <TextBlock label="Inspection Location / Area" text={view.inspectionLocation} />
          <OptionalTextBlock label="Specification Reference" text={view.specificationReference} />
          <OptionalTextBlock label="Drawing Reference" text={view.drawingReference} />
        </div>
        <TextBlock label="Work Inspected" text={view.workInspected} />
        <TextBlock label="Overall Status" text={view.status} />
        {view.summary !== '—' ? <TextBlock label="Summary" text={view.summary} /> : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Inspection Details" tone="muted">
        <OptionalTextBlock label="Inspection Method" text={view.inspectionMethod} />
        <OptionalTextBlock label="Acceptance Criteria" text={view.acceptanceCriteria} />
        <TextBlock label="Observations" text={view.observations} />
        <OptionalTextBlock label="QC Notes" text={view.qcNotes} />
      </PaperDocumentSection>

      {hasDeficiencySection ? (
        <PaperDocumentSection title="Deficiencies / Corrective Actions">
          <OptionalTextBlock label="Deficiencies" text={view.deficiencies} />
          <OptionalTextBlock label="Corrective Actions" text={view.correctiveActions} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Responsible Party" text={view.responsibleParty} />
            <OptionalTextBlock label="Follow-up Required" text={view.followUpRequired} />
            <OptionalTextBlock label="Follow-up Date" text={view.followUpDate} />
            <OptionalTextBlock label="Reinspection Required" text={view.reinspectionRequired} />
            <OptionalTextBlock label="Reinspection Date" text={view.reinspectionDate} />
          </div>
        </PaperDocumentSection>
      ) : null}

      {hasConcreteQc ? (
        <PaperDocumentSection title="Concrete QC Data" tone="muted">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Concrete Placement Date" text={view.concretePlacementDate} />
            <OptionalTextBlock label="Mix Design Reference" text={view.mixDesignReference} />
            <OptionalTextBlock label="Truck Ticket Numbers" text={view.truckTicketNumbers} />
            <OptionalTextBlock label="Slump" text={view.slump} />
            <OptionalTextBlock label="Air Content" text={view.airContent} />
            <OptionalTextBlock label="Concrete Temperature" text={view.concreteTemperature} />
            <OptionalTextBlock label="Ambient Temperature" text={view.ambientTemperature} />
            <OptionalTextBlock label="Cylinder Set Numbers" text={view.cylinderSetNumbers} />
          </div>
          <OptionalTextBlock label="Break Results" text={view.breakResults} />
        </PaperDocumentSection>
      ) : null}

      {hasTesting ? (
        <PaperDocumentSection title="Testing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Test Type" text={view.testType} />
            <OptionalTextBlock label="Test Results" text={view.testResults} />
            <OptionalTextBlock label="Testing Agency" text={view.testingAgency} />
            <OptionalTextBlock label="Sample Numbers" text={view.sampleNumbers} />
          </div>
        </PaperDocumentSection>
      ) : null}

      <PaperDocumentSection title="Inspector / Review" tone="muted">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Inspector Name" text={view.inspectorName} />
          <OptionalTextBlock label="Inspector Company" text={view.inspectorCompany} />
          <OptionalTextBlock label="Owner Representative" text={view.ownerRepresentative} />
          <OptionalTextBlock label="Reviewed By" text={view.reviewedBy} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Photos / Attachments">
        <OptionalTextBlock label="Photos" text={view.photos} />
        <OptionalTextBlock label="Attachments" text={view.attachments} />
        <OptionalTextBlock label="Attachment Notes" text={view.attachmentNotes} />
        {view.photos === '—' && view.attachments === '—' && view.attachmentNotes === '—' ? (
          <TextBlock label="Attachments" text="—" />
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DocumentSignatureBlock
            role="Prepared By"
            printedName={view.signaturePreparedBy !== '—' ? view.signaturePreparedBy : null}
          />
          <DocumentSignatureBlock
            role="Inspector"
            printedName={view.signatureInspector !== '—' ? view.signatureInspector : null}
          />
          <DocumentSignatureBlock
            role="Reviewed By"
            printedName={view.signatureReviewedBy !== '—' ? view.signatureReviewedBy : null}
          />
        </div>
        {view.signatureDate !== '—' ? (
          <p className="mt-3 text-xs text-slate-500">Date: {view.signatureDate}</p>
        ) : null}
      </PaperDocumentSection>
    </ProfessionalDocumentShell>
  );
}
