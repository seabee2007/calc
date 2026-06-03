import type { PunchListDocumentView, PunchListItemView } from '../adapters/punchListPreviewAdapter';
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

function PunchListItemCard({ item }: { item: PunchListItemView }) {
  const hasItemImpacts = hasAny(item.costImpact, item.scheduleImpact);
  const hasItemComments = hasAny(item.ownerComment, item.contractorResponse);
  const hasItemAttach = hasAny(item.photoReferences, item.attachmentNotes, item.notes);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
        <span className="font-mono text-sm font-semibold text-slate-900">
          Item {item.itemNumber}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {[item.locationArea !== '—' ? item.locationArea : null, item.priority, item.itemStatus]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <TextBlock label="Description" text={item.itemDescription} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OptionalTextBlock label="Location / Area" text={item.locationArea} />
        <OptionalTextBlock label="Category" text={item.category} />
        <OptionalTextBlock label="Trade" text={item.trade} />
        <OptionalTextBlock label="Responsible Party" text={item.responsibleParty} />
        <OptionalTextBlock label="Due Date" text={item.dueDate} />
        <OptionalTextBlock label="Completion Date" text={item.completionDate} />
        <OptionalTextBlock label="Verified By" text={item.verifiedBy} />
        <OptionalTextBlock label="Verification Date" text={item.verificationDate} />
      </div>
      <OptionalTextBlock label="Corrective Action" text={item.correctiveAction} />
      {hasItemImpacts ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OptionalTextBlock label="Cost Impact" text={item.costImpact} />
          <OptionalTextBlock label="Schedule Impact" text={item.scheduleImpact} />
        </div>
      ) : null}
      {hasItemComments ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OptionalTextBlock label="Owner Comment" text={item.ownerComment} />
          <OptionalTextBlock label="Contractor Response" text={item.contractorResponse} />
        </div>
      ) : null}
      {hasItemAttach ? (
        <>
          <OptionalTextBlock label="Photo References" text={item.photoReferences} />
          <OptionalTextBlock label="Attachment Notes" text={item.attachmentNotes} />
          <OptionalTextBlock label="Notes" text={item.notes} />
        </>
      ) : null}
    </div>
  );
}

interface PunchListDocumentProps {
  view: PunchListDocumentView;
}

export default function PunchListDocument({ view }: PunchListDocumentProps) {
  const hasImpacts = hasAny(view.costImpact, view.scheduleImpact);
  const hasComments = hasAny(view.ownerComment, view.contractorResponse);
  const hasAttachments = hasAny(view.photoReferences, view.attachmentNotes);
  const hasAcceptance = hasAny(view.finalAcceptanceBy, view.finalAcceptanceDate);

  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="PUNCH LIST"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Inspection Summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Inspection Date" text={view.inspectionDate} />
          <OptionalTextBlock label="Inspection Location / Area" text={view.inspectionLocation} />
          <TextBlock label="Overall Status" text={view.status} />
        </div>
        <TextBlock label="Summary" text={view.summary} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Punch List Items" tone="muted">
        {view.items.length === 0 ? (
          <p className="text-sm text-slate-600">No punch items recorded on this list yet.</p>
        ) : (
          <div className="space-y-4">
            {view.items.map((item) => (
              <PunchListItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </PaperDocumentSection>

      {hasImpacts ? (
        <PaperDocumentSection title="Impacts">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Cost Impact" text={view.costImpact} />
            <OptionalTextBlock label="Schedule Impact" text={view.scheduleImpact} />
          </div>
        </PaperDocumentSection>
      ) : null}

      {hasComments ? (
        <PaperDocumentSection title="Owner / Contractor Comments" tone="muted">
          <OptionalTextBlock label="Owner Comment" text={view.ownerComment} />
          <OptionalTextBlock label="Contractor Response" text={view.contractorResponse} />
        </PaperDocumentSection>
      ) : null}

      {hasAttachments ? (
        <PaperDocumentSection title="Photos / Attachments">
          <OptionalTextBlock label="Photo References" text={view.photoReferences} />
          <OptionalTextBlock label="Attachment Notes" text={view.attachmentNotes} />
        </PaperDocumentSection>
      ) : null}

      {hasAcceptance ? (
        <PaperDocumentSection title="Final Acceptance" tone="muted">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Final Acceptance By" text={view.finalAcceptanceBy} />
            <OptionalTextBlock label="Final Acceptance Date" text={view.finalAcceptanceDate} />
          </div>
        </PaperDocumentSection>
      ) : null}

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DocumentSignatureBlock
            role="Prepared By"
            printedName={view.signaturePreparedBy !== '—' ? view.signaturePreparedBy : null}
          />
          <DocumentSignatureBlock
            role="Verified By"
            printedName={view.signatureVerifiedBy !== '—' ? view.signatureVerifiedBy : null}
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
