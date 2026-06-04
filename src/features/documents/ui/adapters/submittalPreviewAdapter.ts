import { format } from 'date-fns';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';
import type { DocumentCompanySettings } from '../documentCompanySettings';

const DEFAULT_CONTRACTOR_STATEMENT =
  'Contractor has reviewed this submittal for general conformance with the contract documents. Approval of this submittal does not relieve Contractor from responsibility for errors, omissions, dimensions, field verification, or compliance with project requirements.';

// ─── View model ───────────────────────────────────────────────────────────────

export interface SubmittalDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  specSection: string;
  productData: string;
  shopDrawings: string;
  samples: string;
  manufacturer: string;
  supplier: string;
  reviewer: string;
  submittedBy: string;
  submittedTo: string;
  dueDate: string;
  reviewStatus: string;
  reviewerComments: string;
  contractorStatement: string;
  attachmentProductData: string;
  attachmentShopDrawings: string;
  attachmentSamples: string;
  attachmentCertifications: string;
  attachmentOther: string;
  references: string;
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

function formatSelectLabel(v: unknown, options: { value: string; label: string }[]): string {
  const raw = cleanField(v);
  if (!raw) return '';
  const match = options.find((o) => o.value === raw || o.label.toLowerCase() === raw.toLowerCase());
  return match?.label ?? raw;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'approved_as_noted', label: 'Approved as Noted' },
  { value: 'revise_and_resubmit', label: 'Revise and Resubmit' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'approved_as_noted', label: 'Approved as Noted' },
  { value: 'revise_and_resubmit', label: 'Revise and Resubmit' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'no_exception_taken', label: 'No Exception Taken' },
];

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

function projectContractor(companySettings: DocumentCompanySettings): string {
  return companySettings.companyName?.trim() || '—';
}

function combineReferences(answers: Record<string, unknown>): string {
  const parts: string[] = [];
  const rfi = cleanField(answers.relatedRfi);
  const co = cleanField(answers.relatedChangeOrder);
  if (rfi) parts.push(`RFI: ${rfi}`);
  if (co) parts.push(`Change Order: ${co}`);
  return displayValue(parts.length ? parts.join(' · ') : undefined);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Maps Document Builder answers + project/company into a clean Submittal view model.
 */
export function buildSubmittalPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: DocumentCompanySettings;
  title?: string;
}): SubmittalDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const documentTitle =
    title?.trim() ||
    cleanField(answers.submittalTitle) ||
    cleanField(answers.title) ||
    'Submittal Cover Sheet';

  const documentNumber = cleanField(answers.submittalNumber) || 'Draft';

  const statusRaw =
    formatSelectLabel(answers.status, STATUS_OPTIONS) || cleanField(answers.status) || 'Draft';

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  const dateAnswer = cleanField(answers.submittalDate) || cleanField(answers.documentDate);
  if (dateAnswer) {
    try {
      generatedDate = format(new Date(dateAnswer), 'MMMM d, yyyy');
    } catch {
      generatedDate = dateAnswer;
    }
  }

  const logoUrl = companySettings.logoUrl ?? null;

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
    { label: 'Contractor', value: projectContractor(companySettings) },
  ];

  const contractorStatementRaw = cleanField(answers.contractorStatement);
  const contractorStatement = contractorStatementRaw || DEFAULT_CONTRACTOR_STATEMENT;

  const reviewStatus =
    formatSelectLabel(answers.reviewStatus, REVIEW_STATUS_OPTIONS) ||
    displayField(answers.reviewStatus);

  return {
    documentTitle,
    documentNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    specSection: displayField(answers.specSection),
    productData: displayField(answers.productData),
    shopDrawings: displayField(answers.shopDrawings),
    samples: displayField(answers.samples),
    manufacturer: displayField(answers.manufacturer),
    supplier: displayField(answers.supplier),
    reviewer: displayField(answers.reviewer),
    submittedBy: displayField(answers.submittedBy),
    submittedTo: displayField(answers.submittedTo),
    dueDate: displayField(answers.dueDate),
    reviewStatus: reviewStatus === '—' ? '—' : reviewStatus,
    reviewerComments: displayField(answers.reviewerComments),
    contractorStatement,
    attachmentProductData: displayField(answers.productData),
    attachmentShopDrawings: displayField(answers.shopDrawings),
    attachmentSamples: displayField(answers.samples),
    attachmentCertifications: displayField(answers.certifications),
    attachmentOther: displayField(answers.attachments),
    references: combineReferences(answers),
    signatureSubmittedBy: displayField(answers.submittedBy),
    signatureReviewedBy: displayField(answers.reviewedBy) !== '—'
      ? displayField(answers.reviewedBy)
      : displayField(answers.reviewer),
    signatureDate: displayField(answers.signatureDate),
  };
}
