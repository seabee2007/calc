import type { FarDocumentView } from '../adapters/farPreviewAdapter';
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

interface FarDocumentProps {
  view: FarDocumentView;
}

export default function FarDocument({ view }: FarDocumentProps) {
  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="FAR"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Request Details">
        <TextBlock label="Description" text={view.description} />
        <TextBlock label="Reason" text={view.reason} />
        <TextBlock label="Location" text={view.location} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Requested By" text={view.requestedBy} />
          <TextBlock label="Submitted To" text={view.submittedTo} />
        </div>
        {view.dueDate !== '—' ? <TextBlock label="Due Date" text={view.dueDate} /> : null}
        {view.priority !== '—' ? <TextBlock label="Priority" text={view.priority} /> : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Adjustment" tone="muted">
        <TextBlock label="Existing Condition" text={view.existingCondition} />
        <TextBlock label="Proposed Adjustment" text={view.proposedAdjustment} />
        <TextBlock label="Contractor Recommendation" text={view.contractorRecommendation} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Impact Review" tone="muted">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Labor Impact" text={view.laborImpact} />
          <TextBlock label="Material Impact" text={view.materialImpact} />
          <TextBlock label="Equipment Impact" text={view.equipmentImpact} />
          <TextBlock label="Cost Impact" text={view.costImpact} />
          <TextBlock label="Schedule Impact" text={view.scheduleImpact} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Reviewer Response">
        <TextBlock label="Response" text={view.reviewerResponse} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Reviewed By" text={view.reviewedBy} />
          <TextBlock label="Response Date" text={view.responseDate} />
          <TextBlock label="Approval Decision" text={view.approvalDecision} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="References" tone="muted">
        <TextBlock label="Drawing Reference" text={view.drawingReference} />
        <TextBlock label="Spec Reference" text={view.specReference} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentSignatureBlock
            role="Requested By"
            printedName={view.requestedBy !== '—' ? view.requestedBy : null}
          />
          <DocumentSignatureBlock
            role="Reviewed By"
            printedName={view.reviewedBy !== '—' ? view.reviewedBy : null}
          />
        </div>
      </PaperDocumentSection>
    </ProfessionalDocumentShell>
  );
}
