import type { WarrantyCloseoutDocumentView } from '../adapters/warrantyCloseoutPreviewAdapter';
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

function ChecklistRow({ label, value }: { label: string; value: string }) {
  const display = value === '—' ? '—' : value;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{display}</span>
    </div>
  );
}

function hasAny(...values: string[]): boolean {
  return values.some((v) => v !== '—' && v.trim() !== '');
}

interface WarrantyCloseoutDocumentProps {
  view: WarrantyCloseoutDocumentView;
}

export default function WarrantyCloseoutDocument({ view }: WarrantyCloseoutDocumentProps) {
  const hasFinancial = hasAny(
    view.finalPaymentStatus,
    view.retainageStatus,
    view.lienWaiverStatus,
  );

  const hasOpenItems = hasAny(
    view.unresolvedItems,
    view.followUpRequired,
    view.followUpDate,
    view.additionalTerms,
  );

  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="WARRANTY / CLOSEOUT"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Closeout Summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Project Completion Date" text={view.projectCompletionDate} />
          <OptionalTextBlock label="Final Inspection Date" text={view.finalInspectionDate} />
          <OptionalTextBlock label="Final Inspection Result" text={view.finalInspectionResult} />
          <OptionalTextBlock label="Punch List Status" text={view.punchListStatus} />
        </div>
        <TextBlock label="Closeout Summary" text={view.closeoutSummary} />
        <OptionalTextBlock label="Project Scope Completed" text={view.projectScopeCompleted} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Warranty Information" tone="muted">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Warranty Start Date" text={view.warrantyStartDate} />
          <TextBlock label="Warranty Period" text={view.warrantyPeriod} />
        </div>
        <OptionalTextBlock label="Warranty Coverage" text={view.warrantyCoverage} />
        <OptionalTextBlock label="Warranty Exclusions" text={view.warrantyExclusions} />
        <OptionalTextBlock label="Owner Responsibilities" text={view.ownerResponsibilities} />
        <OptionalTextBlock label="Maintenance Instructions" text={view.maintenanceInstructions} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Closeout Documents Included">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1">
          <ChecklistRow label="As-Built Drawings" value={view.asBuiltDrawingsIncluded} />
          <ChecklistRow label="Operation / Maintenance Manuals" value={view.operationManualsIncluded} />
          <ChecklistRow label="Test Reports" value={view.testReportsIncluded} />
          <ChecklistRow label="Material Certifications" value={view.materialCertificationsIncluded} />
          <ChecklistRow label="Lien Waivers" value={view.lienWaiverStatus} />
          <ChecklistRow label="Keys / Access Codes Returned" value={view.keysAccessCodesReturned} />
          <ChecklistRow label="Spare Materials Provided" value={view.spareMaterialsProvided} />
          <ChecklistRow label="Other Closeout Documents" value={view.closeoutDocumentsIncluded} />
        </div>
      </PaperDocumentSection>

      {hasFinancial ? (
        <PaperDocumentSection title="Financial / Administrative Status" tone="muted">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Final Payment Status" text={view.finalPaymentStatus} />
            <OptionalTextBlock label="Retainage Status" text={view.retainageStatus} />
            <OptionalTextBlock label="Lien Waiver Status" text={view.lienWaiverStatus} />
          </div>
        </PaperDocumentSection>
      ) : null}

      {hasOpenItems ? (
        <PaperDocumentSection title="Open Items / Follow-Up">
          <OptionalTextBlock label="Unresolved Items" text={view.unresolvedItems} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Follow-up Required" text={view.followUpRequired} />
            <OptionalTextBlock label="Follow-up Date" text={view.followUpDate} />
          </div>
          <OptionalTextBlock label="Additional Terms" text={view.additionalTerms} />
        </PaperDocumentSection>
      ) : null}

      <PaperDocumentSection title="Contractor Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Contact Name" text={view.contractorContactName} />
          <OptionalTextBlock label="Phone" text={view.contractorContactPhone} />
          <OptionalTextBlock label="Email" text={view.contractorContactEmail} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Attachments / Notes" tone="muted">
        <OptionalTextBlock label="Attachment Notes" text={view.attachmentNotes} />
        {view.attachmentNotes === '—' ? <TextBlock label="Notes" text="—" /> : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentSignatureBlock
            role="Contractor / Prepared By"
            printedName={view.signaturePreparedBy !== '—' ? view.signaturePreparedBy : null}
          />
          <DocumentSignatureBlock
            role="Owner / Client"
            printedName={view.signatureOwner !== '—' ? view.signatureOwner : null}
          />
        </div>
        {view.signatureDate !== '—' ? (
          <p className="mt-3 text-xs text-slate-500">Date: {view.signatureDate}</p>
        ) : null}
      </PaperDocumentSection>
    </ProfessionalDocumentShell>
  );
}
