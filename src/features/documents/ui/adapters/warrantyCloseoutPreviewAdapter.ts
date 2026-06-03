import { format } from 'date-fns';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';
import {
  FINAL_INSPECTION_RESULT_OPTIONS,
  PUNCH_LIST_STATUS_OPTIONS,
  STATUS_OPTIONS,
  WARRANTY_PERIOD_OPTIONS,
} from '../../packs/warrantyCloseout/questions';

export interface WarrantyCloseoutDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  preparedBy: string;
  recipientName: string;
  projectCompletionDate: string;
  warrantyStartDate: string;
  warrantyPeriod: string;
  closeoutSummary: string;
  projectScopeCompleted: string;
  punchListStatus: string;
  finalInspectionDate: string;
  finalInspectionResult: string;
  warrantyCoverage: string;
  warrantyExclusions: string;
  ownerResponsibilities: string;
  maintenanceInstructions: string;
  closeoutDocumentsIncluded: string;
  asBuiltDrawingsIncluded: string;
  operationManualsIncluded: string;
  testReportsIncluded: string;
  materialCertificationsIncluded: string;
  lienWaiverStatus: string;
  keysAccessCodesReturned: string;
  spareMaterialsProvided: string;
  retainageStatus: string;
  finalPaymentStatus: string;
  unresolvedItems: string;
  followUpRequired: string;
  followUpDate: string;
  additionalTerms: string;
  contractorContactName: string;
  contractorContactPhone: string;
  contractorContactEmail: string;
  attachmentNotes: string;
  signaturePreparedBy: string;
  signatureOwner: string;
  signatureDate: string;
}

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

function formatSelectLabel(
  v: unknown,
  options: { value: string; label: string }[],
): string {
  const raw = cleanField(v);
  if (!raw) return '';
  const match = options.find(
    (o) => o.value === raw || o.label.toLowerCase() === raw.toLowerCase(),
  );
  return match?.label ?? raw;
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

function buildDocumentTitle(
  title: string | undefined,
  documentNumber: string,
  projectName: string,
): string {
  if (title?.trim()) return title.trim();
  if (documentNumber && documentNumber !== 'Draft') {
    return `Warranty / Closeout Letter — ${documentNumber}`;
  }
  if (projectName) {
    return `Warranty / Closeout Letter — ${projectName}`;
  }
  return 'Warranty / Closeout Letter';
}

export function buildWarrantyCloseoutPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  title?: string;
}): WarrantyCloseoutDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const letterDateRaw = cleanField(answers.letterDate) || cleanField(answers.documentDate);
  const documentNumber = cleanField(answers.documentNumber) || 'Draft';
  const projectNameForTitle = selectedProject?.name?.trim() || cleanField(answers.projectName) || '';

  const documentTitle = buildDocumentTitle(title, documentNumber, projectNameForTitle);

  const statusRaw =
    formatSelectLabel(answers.status, STATUS_OPTIONS) || cleanField(answers.status) || 'Draft';

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  if (letterDateRaw) {
    try {
      generatedDate = format(new Date(letterDateRaw), 'MMMM d, yyyy');
    } catch {
      generatedDate = letterDateRaw;
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

  const preparedBy = displayField(answers.preparedBy);
  const recipientName =
    displayField(answers.recipientName) !== '—'
      ? displayField(answers.recipientName)
      : projectClientName(selectedProject);

  const ownerSig =
    displayField(answers.reviewedBy) !== '—'
      ? displayField(answers.reviewedBy)
      : displayField(answers.ownerRepresentative);

  let signatureDate = displayField(answers.signatureDate);
  if (signatureDate === '—' && letterDateRaw) {
    try {
      signatureDate = format(new Date(letterDateRaw), 'MMMM d, yyyy');
    } catch {
      signatureDate = letterDateRaw;
    }
  }

  const projectRows = [
    { label: 'Project Name', value: projectName },
    { label: 'Project Address', value: project.address },
    { label: 'Owner / Client', value: projectClientName(selectedProject) },
    { label: 'Contractor', value: projectContractor(companySettings) },
    { label: 'Prepared By', value: preparedBy },
    { label: 'Recipient', value: recipientName },
  ];

  return {
    documentTitle,
    documentNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    preparedBy,
    recipientName,
    projectCompletionDate: displayField(answers.projectCompletionDate),
    warrantyStartDate: displayField(answers.warrantyStartDate),
    warrantyPeriod:
      formatSelectLabel(answers.warrantyPeriod, WARRANTY_PERIOD_OPTIONS) ||
      displayField(answers.warrantyPeriod),
    closeoutSummary: displayField(answers.closeoutSummary),
    projectScopeCompleted: displayField(answers.projectScopeCompleted),
    punchListStatus:
      formatSelectLabel(answers.punchListStatus, PUNCH_LIST_STATUS_OPTIONS) ||
      displayField(answers.punchListStatus),
    finalInspectionDate: displayField(answers.finalInspectionDate),
    finalInspectionResult:
      formatSelectLabel(answers.finalInspectionResult, FINAL_INSPECTION_RESULT_OPTIONS) ||
      displayField(answers.finalInspectionResult),
    warrantyCoverage: displayField(answers.warrantyCoverage),
    warrantyExclusions: displayField(answers.warrantyExclusions),
    ownerResponsibilities: displayField(answers.ownerResponsibilities),
    maintenanceInstructions: displayField(answers.maintenanceInstructions),
    closeoutDocumentsIncluded: displayField(answers.closeoutDocumentsIncluded),
    asBuiltDrawingsIncluded: displayField(answers.asBuiltDrawingsIncluded),
    operationManualsIncluded: displayField(answers.operationManualsIncluded),
    testReportsIncluded: displayField(answers.testReportsIncluded),
    materialCertificationsIncluded: displayField(answers.materialCertificationsIncluded),
    lienWaiverStatus: displayField(answers.lienWaiverStatus),
    keysAccessCodesReturned: displayField(answers.keysAccessCodesReturned),
    spareMaterialsProvided: displayField(answers.spareMaterialsProvided),
    retainageStatus: displayField(answers.retainageStatus),
    finalPaymentStatus: displayField(answers.finalPaymentStatus),
    unresolvedItems: displayField(answers.unresolvedItems),
    followUpRequired: displayField(answers.followUpRequired),
    followUpDate: displayField(answers.followUpDate),
    additionalTerms: displayField(answers.additionalTerms),
    contractorContactName: displayField(answers.contractorContactName),
    contractorContactPhone: displayField(answers.contractorContactPhone),
    contractorContactEmail: displayField(answers.contractorContactEmail),
    attachmentNotes: displayField(answers.attachmentNotes),
    signaturePreparedBy: preparedBy,
    signatureOwner: ownerSig,
    signatureDate,
  };
}
