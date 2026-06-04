import { format } from 'date-fns';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';
import { INSPECTION_TYPE_OPTIONS, STATUS_OPTIONS } from '../../packs/qcReport/questions';
import type { DocumentCompanySettings } from '../documentCompanySettings';

// ─── View model ───────────────────────────────────────────────────────────────

export interface QcReportDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  preparedBy: string;
  inspectionType: string;
  inspectionLocation: string;
  specificationReference: string;
  drawingReference: string;
  workInspected: string;
  inspectionMethod: string;
  acceptanceCriteria: string;
  observations: string;
  summary: string;
  qcNotes: string;
  deficiencies: string;
  correctiveActions: string;
  responsibleParty: string;
  followUpRequired: string;
  followUpDate: string;
  reinspectionRequired: string;
  reinspectionDate: string;
  concretePlacementDate: string;
  mixDesignReference: string;
  truckTicketNumbers: string;
  slump: string;
  airContent: string;
  concreteTemperature: string;
  ambientTemperature: string;
  cylinderSetNumbers: string;
  breakResults: string;
  testType: string;
  testResults: string;
  testingAgency: string;
  sampleNumbers: string;
  inspectorName: string;
  inspectorCompany: string;
  ownerRepresentative: string;
  reviewedBy: string;
  photos: string;
  attachments: string;
  attachmentNotes: string;
  signaturePreparedBy: string;
  signatureInspector: string;
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

function projectContractor(companySettings: DocumentCompanySettings): string {
  return companySettings.companyName?.trim() || '—';
}

function resolveStatus(answers: Record<string, unknown>): string {
  const overall = formatSelectLabel(answers.overallStatus, STATUS_OPTIONS);
  if (overall) return overall;
  const status = formatSelectLabel(answers.status, STATUS_OPTIONS);
  if (status) return status;
  return cleanField(answers.overallStatus) || cleanField(answers.status) || 'Draft';
}

function buildDocumentTitle(
  title: string | undefined,
  reportNumber: string,
  inspectionTypeLabel: string,
  reportDateRaw: string,
  projectName: string,
): string {
  if (title?.trim()) return title.trim();
  if (reportNumber && inspectionTypeLabel) {
    return `QC Report — ${reportNumber} — ${inspectionTypeLabel}`;
  }
  if (inspectionTypeLabel && projectName) {
    return `QC Report — ${inspectionTypeLabel} — ${projectName}`;
  }
  if (reportDateRaw && projectName) {
    return `QC Report — ${reportDateRaw} — ${projectName}`;
  }
  if (reportDateRaw) return `QC Report — ${reportDateRaw}`;
  if (projectName) return `QC Report — ${projectName}`;
  return 'QC Report';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Maps Document Builder answers + project/company into a clean QC Report view model.
 */
export function buildQcReportPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: DocumentCompanySettings;
  title?: string;
}): QcReportDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const reportDateRaw = cleanField(answers.reportDate) || cleanField(answers.documentDate);
  const reportNumber = cleanField(answers.reportNumber) || 'Draft';
  const inspectionTypeLabel =
    formatSelectLabel(answers.inspectionType, INSPECTION_TYPE_OPTIONS) ||
    displayField(answers.inspectionType);
  const projectNameForTitle = selectedProject?.name?.trim() || cleanField(answers.projectName) || '';

  const documentTitle = buildDocumentTitle(
    title,
    reportNumber !== 'Draft' ? reportNumber : '',
    inspectionTypeLabel !== '—' ? inspectionTypeLabel : '',
    reportDateRaw,
    projectNameForTitle,
  );

  const statusRaw = resolveStatus(answers);

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  if (reportDateRaw) {
    try {
      generatedDate = format(new Date(reportDateRaw), 'MMMM d, yyyy');
    } catch {
      generatedDate = reportDateRaw;
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

  const preparedBy = displayField(answers.preparedBy);
  const inspectorName = displayField(answers.inspectorName);
  const reviewedBy = displayField(answers.reviewedBy);

  const projectRows = [
    { label: 'Project Name', value: projectName },
    { label: 'Project Address', value: project.address },
    { label: 'Owner / Client', value: projectClientName(selectedProject) },
    { label: 'Contractor', value: projectContractor(companySettings) },
    { label: 'Prepared By', value: preparedBy },
  ];

  let signatureDate = displayField(answers.signatureDate);
  if (signatureDate === '—' && reportDateRaw) {
    try {
      signatureDate = format(new Date(reportDateRaw), 'MMMM d, yyyy');
    } catch {
      signatureDate = reportDateRaw;
    }
  }

  return {
    documentTitle,
    documentNumber: reportNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    preparedBy,
    inspectionType: inspectionTypeLabel,
    inspectionLocation: displayField(answers.inspectionLocation),
    specificationReference: displayField(answers.specificationReference),
    drawingReference: displayField(answers.drawingReference),
    workInspected: displayField(answers.workInspected),
    inspectionMethod: displayField(answers.inspectionMethod),
    acceptanceCriteria: displayField(answers.acceptanceCriteria),
    observations: displayField(answers.observations),
    summary: displayField(answers.summary),
    qcNotes: displayField(answers.qcNotes),
    deficiencies: displayField(answers.deficiencies),
    correctiveActions: displayField(answers.correctiveActions),
    responsibleParty: displayField(answers.responsibleParty),
    followUpRequired: displayField(answers.followUpRequired),
    followUpDate: displayField(answers.followUpDate),
    reinspectionRequired: displayField(answers.reinspectionRequired),
    reinspectionDate: displayField(answers.reinspectionDate),
    concretePlacementDate: displayField(answers.concretePlacementDate),
    mixDesignReference: displayField(answers.mixDesignReference),
    truckTicketNumbers: displayField(answers.truckTicketNumbers),
    slump: displayField(answers.slump),
    airContent: displayField(answers.airContent),
    concreteTemperature: displayField(answers.concreteTemperature),
    ambientTemperature: displayField(answers.ambientTemperature),
    cylinderSetNumbers: displayField(answers.cylinderSetNumbers),
    breakResults: displayField(answers.breakResults),
    testType: displayField(answers.testType),
    testResults: displayField(answers.testResults),
    testingAgency: displayField(answers.testingAgency),
    sampleNumbers: displayField(answers.sampleNumbers),
    inspectorName,
    inspectorCompany: displayField(answers.inspectorCompany),
    ownerRepresentative: displayField(answers.ownerRepresentative),
    reviewedBy,
    photos: displayField(answers.photos),
    attachments: displayField(answers.attachments),
    attachmentNotes: displayField(answers.attachmentNotes),
    signaturePreparedBy: preparedBy,
    signatureInspector: inspectorName,
    signatureReviewedBy: reviewedBy,
    signatureDate,
  };
}
