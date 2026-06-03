import { format } from 'date-fns';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';

// ─── View model ───────────────────────────────────────────────────────────────

export interface RfiDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  question: string;
  drawingSpecReference: string;
  submittedBy: string;
  submittedTo: string;
  dueDate: string;
  costImpact: string;
  scheduleImpact: string;
  response: string;
  respondedBy: string;
  responseDate: string;
  attachmentDrawings: string;
  attachmentPhotos: string;
  attachmentSpecSections: string;
  attachmentOtherReferences: string;
  signatureSubmittedBy: string;
  signatureReviewedBy: string;
  signatureDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return '';
}

function cleanField(v: unknown): string {
  const raw = str(v);
  if (!raw) return '';
  return cleanDocumentBody(raw);
}

function displayField(v: unknown): string {
  return displayValue(cleanField(v) || undefined);
}

function formatImpact(v: unknown): string {
  const raw = str(v);
  if (!raw) return '—';
  const lower = raw.toLowerCase();
  if (lower === 'yes' || lower === 'true') return 'Yes';
  if (lower === 'no' || lower === 'false') return 'No';
  return displayField(v);
}

function combineDrawingSpec(answers: Record<string, unknown>): string {
  const combined =
    cleanField(answers.drawingSpecReference) ||
    [cleanField(answers.drawingReference), cleanField(answers.specReference)]
      .filter(Boolean)
      .join(' · ');
  return displayValue(combined || undefined);
}

function projectAddress(project: Project | null): string {
  if (!project) return '—';
  const clientInfo = project.clientInfo;
  const jobsite = project.jobsiteAddress;
  const clientAddress = resolveClientAddressForProposal(clientInfo, jobsite);
  if (clientAddress && Object.values(clientAddress).some((v) => String(v).trim())) {
    const formatted = formatUSAddress(clientAddress);
    if (formatted) return formatted;
  }
  if (jobsite) {
    const formatted = formatUSAddress(jobsite);
    if (formatted) return formatted;
  }
  return '—';
}

function projectClientName(project: Project | null): string {
  const fromProject = project?.clientInfo?.clientName?.trim();
  if (fromProject) return fromProject;
  return '—';
}

function projectContractor(companySettings: Pick<CompanySettings, 'companyName'>): string {
  return companySettings.companyName?.trim() || '—';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Maps Document Builder answers + project/company into a clean RFI view model.
 *
 * Answer-key mapping (primary keys from Phase 5B spec):
 *   rfiNumber              → documentNumber
 *   rfiTitle / title       → documentTitle
 *   question               → question
 *   drawingSpecReference   → drawingSpecReference (also drawingReference + specReference)
 *   submittedBy            → submittedBy
 *   submittedTo            → submittedTo
 *   dueDate                → dueDate
 *   costImpact             → costImpact
 *   scheduleImpact         → scheduleImpact
 *   response               → response
 *   respondedBy            → respondedBy
 *   responseDate           → responseDate
 *   status                 → status
 *   attachmentDrawings     → attachmentDrawings
 *   attachmentPhotos       → attachmentPhotos
 *   attachmentSpecSections → attachmentSpecSections
 *   attachmentOtherReferences → attachmentOtherReferences
 *   reviewedBy             → signatureReviewedBy
 *   signatureDate          → signatureDate
 */
export function buildRfiPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  title?: string;
}): RfiDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const documentTitle =
    title?.trim() ||
    cleanField(answers.rfiTitle) ||
    cleanField(answers.title) ||
    'Request for Information';

  const documentNumber =
    cleanField(answers.rfiNumber) ||
    cleanField(answers.displayNumber) ||
    'Draft';

  const statusRaw = cleanField(answers.status) || 'Draft';

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  const dateAnswer = cleanField(answers.rfiDate) || cleanField(answers.documentDate);
  if (dateAnswer) {
    try {
      generatedDate = format(new Date(dateAnswer), 'MMMM d, yyyy');
    } catch {
      generatedDate = dateAnswer;
    }
  }

  const logoUrl = companySettings.logoUrl ?? companySettings.logo ?? null;

  const company: DocumentCompany = {
    name: companySettings.companyName?.trim() || 'Contractor',
    logoUrl,
    address: companySettings.address?.trim() || null,
    phone: companySettings.phone?.trim() || null,
    email: companySettings.email?.trim() || null,
    licenseNumber: companySettings.licenseNumber?.trim() || null,
  };

  const projectName = selectedProject?.name?.trim() || '—';
  const project: DocumentProject = {
    name: projectName,
    address: projectAddress(selectedProject),
    projectNumber: null,
  };

  const projectRows = [
    { label: 'Project Name', value: projectName },
    { label: 'Project Address', value: project.address },
    { label: 'Owner / Client', value: projectClientName(selectedProject) },
    {
      label: 'Contractor',
      value: projectContractor(companySettings),
    },
  ];

  return {
    documentTitle,
    documentNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    question: displayField(answers.question),
    drawingSpecReference: combineDrawingSpec(answers),
    submittedBy: displayField(answers.submittedBy),
    submittedTo: displayField(answers.submittedTo),
    dueDate: displayField(answers.dueDate),
    costImpact: formatImpact(answers.costImpact),
    scheduleImpact: formatImpact(answers.scheduleImpact),
    response: displayField(answers.response),
    respondedBy: displayField(answers.respondedBy),
    responseDate: displayField(answers.responseDate),
    attachmentDrawings: displayField(answers.attachmentDrawings),
    attachmentPhotos: displayField(answers.attachmentPhotos),
    attachmentSpecSections: displayField(answers.attachmentSpecSections),
    attachmentOtherReferences: displayField(answers.attachmentOtherReferences),
    signatureSubmittedBy: displayField(answers.submittedBy),
    signatureReviewedBy: displayField(answers.reviewedBy),
    signatureDate: displayField(answers.signatureDate),
  };
}
