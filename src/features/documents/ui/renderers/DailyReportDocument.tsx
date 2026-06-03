import type { DailyReportDocumentView } from '../adapters/dailyReportPreviewAdapter';
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

interface DailyReportDocumentProps {
  view: DailyReportDocumentView;
}

/**
 * Professional Daily Report paper document for the Contract & Document Builder preview.
 */
export default function DailyReportDocument({ view }: DailyReportDocumentProps) {
  const hasDelaySection =
    view.delays !== '—' ||
    view.delayCause !== '—' ||
    view.responsibleParty !== '—' ||
    view.scheduleImpact !== '—';

  const hasEquipmentDetail =
    view.equipmentHours !== '—' || view.idleEquipment !== '—' || view.equipmentIssues !== '—';

  const hasDeliveryDetail =
    view.deliveryTicketNumbers !== '—' ||
    view.supplier !== '—' ||
    view.materialsAcceptedRejected !== '—';

  const hasSafetyDetail =
    view.safetyMeetingHeld !== '—' ||
    view.incidentsNearMisses !== '—' ||
    view.ppeIssues !== '—' ||
    view.correctiveActions !== '—';

  const hasQcDetail =
    view.inspectionsPerformed !== '—' ||
    view.deficiencies !== '—' ||
    view.testsPerformed !== '—' ||
    view.followUpRequired !== '—';

  return (
    <ProfessionalDocumentShell
      documentTitle={view.documentTitle}
      documentTypeLabel="DAILY REPORT"
      documentNumber={view.documentNumber}
      status={view.status}
      generatedDate={view.generatedDate}
      company={view.company}
      project={view.project}
    >
      <DocumentInfoGrid title="Project Information" rows={view.projectRows} />

      <PaperDocumentSection title="Weather / Site Conditions" tone="muted">
        <TextBlock label="Weather Conditions" text={view.weatherConditions} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Temperature" text={view.temperature} />
          <OptionalTextBlock label="Rain" text={view.rain} />
          <OptionalTextBlock label="Wind" text={view.wind} />
          <OptionalTextBlock label="Site Conditions" text={view.siteConditions} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Labor / Crew">
        <TextBlock label="Crew Summary" text={view.crewSummary} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalTextBlock label="Crew Members" text={view.crewMembers} />
          <OptionalTextBlock label="Trade" text={view.trade} />
          <OptionalTextBlock label="Hours Worked" text={view.hoursWorked} />
          <OptionalTextBlock label="Foreman / Lead" text={view.foremanLead} />
        </div>
      </PaperDocumentSection>

      <PaperDocumentSection title="Equipment" tone="muted">
        <TextBlock label="Equipment Used" text={view.equipmentUsed} />
        {hasEquipmentDetail ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Equipment Hours" text={view.equipmentHours} />
            <OptionalTextBlock label="Idle Equipment" text={view.idleEquipment} />
            <OptionalTextBlock label="Equipment Issues" text={view.equipmentIssues} />
          </div>
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Work Performed">
        <TextBlock label="Work Completed Today" text={view.workPerformed} />
        <OptionalTextBlock label="Work Areas / Locations" text={view.workAreas} />
        <OptionalTextBlock label="Quantities Installed" text={view.quantitiesInstalled} />
      </PaperDocumentSection>

      <PaperDocumentSection title="Deliveries" tone="muted">
        <TextBlock label="Material Deliveries" text={view.deliveries} />
        {hasDeliveryDetail ? (
          <>
            <OptionalTextBlock label="Ticket Numbers" text={view.deliveryTicketNumbers} />
            <OptionalTextBlock label="Supplier" text={view.supplier} />
            <OptionalTextBlock
              label="Accepted / Rejected"
              text={view.materialsAcceptedRejected}
            />
          </>
        ) : null}
      </PaperDocumentSection>

      {hasDelaySection ? (
        <PaperDocumentSection title="Delays / Impacts">
          <OptionalTextBlock label="Delays" text={view.delays} />
          <OptionalTextBlock label="Cause" text={view.delayCause} />
          <OptionalTextBlock label="Responsible Party" text={view.responsibleParty} />
          <OptionalTextBlock label="Schedule Impact" text={view.scheduleImpact} />
        </PaperDocumentSection>
      ) : null}

      <PaperDocumentSection title="Visitors / Inspections" tone="muted">
        <OptionalTextBlock label="Visitors" text={view.visitors} />
        <OptionalTextBlock label="Inspectors" text={view.inspectors} />
        <OptionalTextBlock
          label="Owner / Architect / Engineer Visits"
          text={view.ownerArchitectEngineerVisits}
        />
      </PaperDocumentSection>

      <PaperDocumentSection title="Safety Notes">
        <TextBlock label="Safety Notes" text={view.safetyNotes} />
        {hasSafetyDetail ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OptionalTextBlock label="Safety Meeting Held" text={view.safetyMeetingHeld} />
            <OptionalTextBlock label="Incidents / Near Misses" text={view.incidentsNearMisses} />
            <OptionalTextBlock label="PPE Issues" text={view.ppeIssues} />
            <OptionalTextBlock label="Corrective Actions" text={view.correctiveActions} />
          </div>
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="QC Notes" tone="muted">
        <TextBlock label="QC Notes" text={view.qcNotes} />
        {hasQcDetail ? (
          <>
            <OptionalTextBlock label="Inspections Performed" text={view.inspectionsPerformed} />
            <OptionalTextBlock label="Deficiencies" text={view.deficiencies} />
            <OptionalTextBlock label="Tests Performed" text={view.testsPerformed} />
            <OptionalTextBlock label="Follow-up Required" text={view.followUpRequired} />
          </>
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Photos / Attachments">
        <OptionalTextBlock label="Photo Log" text={view.photos} />
        <OptionalTextBlock label="Attachment Notes" text={view.attachmentNotes} />
        {view.photos === '—' && view.attachmentNotes === '—' ? (
          <TextBlock label="Attachments" text="—" />
        ) : null}
      </PaperDocumentSection>

      <PaperDocumentSection title="Signature / Acknowledgment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentSignatureBlock
            role="Prepared By"
            printedName={view.signaturePreparedBy !== '—' ? view.signaturePreparedBy : null}
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
