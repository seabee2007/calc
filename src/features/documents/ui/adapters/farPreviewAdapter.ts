import { format } from 'date-fns';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';

export interface FarDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  description: string;
  reason: string;
  location: string;
  requestedBy: string;
  submittedTo: string;
  existingCondition: string;
  proposedAdjustment: string;
  laborImpact: string;
  materialImpact: string;
  equipmentImpact: string;
  costImpact: string;
  scheduleImpact: string;
  priority: string;
  dueDate: string;
  reviewerResponse: string;
  reviewedBy: string;
  responseDate: string;
  approvalDecision: string;
  drawingReference: string;
  specReference: string;
  contractorRecommendation: string;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
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

export function buildFarPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  title?: string;
}): FarDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const documentTitle = title?.trim() || cleanField(answers.title) || 'Field Adjustment Request';
  const documentNumber = cleanField(answers.farNumber) || cleanField(answers.displayNumber) || 'Draft';
  const statusRaw = cleanField(answers.status) || 'Draft';

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  const dateAnswer = cleanField(answers.responseDate) || cleanField(answers.documentDate);
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
    { label: 'Owner / Client', value: selectedProject?.clientInfo?.clientName?.trim() || '—' },
    { label: 'Contractor', value: company.name },
  ];

  return {
    documentTitle,
    documentNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    description: displayField(answers.description),
    reason: displayField(answers.reason),
    location: displayField(answers.location),
    requestedBy: displayField(answers.requestedBy),
    submittedTo: displayField(answers.submittedTo),
    existingCondition: displayField(answers.existingCondition),
    proposedAdjustment: displayField(answers.proposedAdjustment),
    laborImpact: displayField(answers.laborImpact),
    materialImpact: displayField(answers.materialImpact),
    equipmentImpact: displayField(answers.equipmentImpact),
    costImpact: displayField(answers.costImpact),
    scheduleImpact: displayField(answers.scheduleImpact),
    priority: displayField(answers.priority),
    dueDate: displayField(answers.dueDate),
    reviewerResponse: displayField(answers.reviewerResponse),
    reviewedBy: displayField(answers.reviewedBy),
    responseDate: displayField(answers.responseDate),
    approvalDecision: displayField(answers.approvalDecision),
    drawingReference: displayField(answers.drawingReference),
    specReference: displayField(answers.specReference),
    contractorRecommendation: displayField(answers.contractorRecommendation),
  };
}
