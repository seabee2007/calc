import type { SubmittalDocumentView } from '../adapters/submittalPreviewAdapter';
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

interface SubmittalDocumentProps {
  view: SubmittalDocumentView;
}

const REVIEW_DISPOSITIONS = [
  'Approved',
  'Approved as Noted',
  'Revise and Resubmit',
  'Rejected',
  'No Exception Taken',
] as const;

/**
 * Professional Submittal Cover Sheet for the Contract & Document Builder preview.
 */
export default function SubmittalDocument({ view }: SubmittalDocumentProps) {
  const activeDisposition = REVIEW_DISPOSITIONS.find(
    (d) => d.toLowerCase() === view.reviewStatus.toLowerCase(),
  );

  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="SUBMITTAL"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Submittal Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Spec Section" text={view.specSection} />
          <TextBlock label="Submittal Title" text={view.documentTitle} />
        </div>
        <TextBlock label="Product Data" text={view.productData} />
        <TextBlock label="Shop Drawings" text={view.shopDrawings} />
        <TextBlock label="Samples" text={view.samples} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Manufacturer" text={view.manufacturer} />
          <TextBlock label="Supplier" text={view.supplier} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Review Information" tone="muted">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Reviewer" text={view.reviewer} />
          <TextBlock label="Review Status" text={view.reviewStatus} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextBlock label="Submitted By" text={view.submittedBy} />
          <TextBlock label="Submitted To" text={view.submittedTo} />
        </div>
        {view.dueDate !== '—' ? <TextBlock label="Due Date" text={view.dueDate} /> : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Contractor Statement">
        <p className="whitespace-pre-wrap break-words text-sm text-slate-900 [overflow-wrap:anywhere]">
          {view.contractorStatement}
        </p>
      </PaperDocumentSection>

      <PaperDocumentSection title="Reviewer Response">
        <ul className="space-y-1 text-sm text-slate-700">
          {REVIEW_DISPOSITIONS.map((label) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={[
                  'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-slate-400 text-[10px]',
                  activeDisposition === label ? 'bg-slate-800 text-white' : 'bg-white',
                ].join(' ')}
                aria-hidden
              >
                {activeDisposition === label ? '✓' : ''}
              </span>
              <span className={activeDisposition === label ? 'font-medium text-slate-900' : ''}>
                {label}
              </span>
            </li>
          ))}
        </ul>
        {view.reviewerComments !== '—' ? (
          <div className="mt-4">
            <TextBlock label="Reviewer Comments" text={view.reviewerComments} />
          </div>
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Attachments / References" tone="muted">
        <TextBlock label="Product Data" text={view.attachmentProductData} />
        <TextBlock label="Shop Drawings" text={view.attachmentShopDrawings} />
        <TextBlock label="Samples" text={view.attachmentSamples} />
        <TextBlock label="Certifications" text={view.attachmentCertifications} />
        <TextBlock label="Other Attachments" text={view.attachmentOther} />
        {view.references !== '—' ? (
          <TextBlock label="References" text={view.references} />
        ) : null}
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
