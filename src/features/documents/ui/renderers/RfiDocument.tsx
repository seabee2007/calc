import type { RfiDocumentView } from '../adapters/rfiPreviewAdapter';
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

interface RfiDocumentProps {
  view: RfiDocumentView;
}

/**
 * Professional RFI paper document for the Contract & Document Builder preview.
 */
export default function RfiDocument({ view }: RfiDocumentProps) {
  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="RFI"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="RFI Details">
        <TextBlock label="Question" text={view.question} />
        <TextBlock label="Drawing / Spec Reference" text={view.drawingSpecReference} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Submitted By" text={view.submittedBy} />
          <TextBlock label="Submitted To" text={view.submittedTo} />
        </div>
        {view.dueDate !== '—' ? <TextBlock label="Due Date" text={view.dueDate} /> : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Impact Review" tone="muted">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Cost Impact" text={view.costImpact} />
          <TextBlock label="Schedule Impact" text={view.scheduleImpact} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Response">
        <TextBlock label="Response" text={view.response} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Responded By" text={view.respondedBy} />
          <TextBlock label="Response Date" text={view.responseDate} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Attachments / References" tone="muted">
        <TextBlock label="Drawings" text={view.attachmentDrawings} />
        <TextBlock label="Photos" text={view.attachmentPhotos} />
        <TextBlock label="Spec Sections" text={view.attachmentSpecSections} />
        <TextBlock label="Other References" text={view.attachmentOtherReferences} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentSignatureBlock
            role="Submitted By"
            printedName={view.signatureSubmittedBy !== '—' ? view.signatureSubmittedBy : null}
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
