import { format } from 'date-fns';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayDateValue, displayValue } from '../previewDisplay';
import type { DocumentCompanySettings } from '../documentCompanySettings';

// ─── View model ───────────────────────────────────────────────────────────────

export interface DailyReportDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  preparedBy: string;
  weatherConditions: string;
  temperature: string;
  rain: string;
  wind: string;
  siteConditions: string;
  crewSummary: string;
  crewMembers: string;
  trade: string;
  hoursWorked: string;
  foremanLead: string;
  equipmentUsed: string;
  equipmentHours: string;
  idleEquipment: string;
  equipmentIssues: string;
  workPerformed: string;
  workAreas: string;
  quantitiesInstalled: string;
  deliveries: string;
  deliveryTicketNumbers: string;
  supplier: string;
  materialsAcceptedRejected: string;
  delays: string;
  delayCause: string;
  responsibleParty: string;
  scheduleImpact: string;
  visitors: string;
  inspectors: string;
  ownerArchitectEngineerVisits: string;
  safetyMeetingHeld: string;
  incidentsNearMisses: string;
  ppeIssues: string;
  correctiveActions: string;
  safetyNotes: string;
  qcNotes: string;
  inspectionsPerformed: string;
  deficiencies: string;
  testsPerformed: string;
  followUpRequired: string;
  photos: string;
  attachmentNotes: string;
  signaturePreparedBy: string;
  signatureReviewedBy: string;
  signatureDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'closed', label: 'Closed' },
];

const WEATHER_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rain', label: 'Rain' },
  { value: 'windy', label: 'Windy' },
  { value: 'hot', label: 'Hot' },
  { value: 'cold', label: 'Cold' },
  { value: 'severe_weather', label: 'Severe Weather' },
  { value: 'other', label: 'Other' },
];

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

function displayDateField(v: unknown): string {
  return displayDateValue(cleanField(v) || undefined);
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

function resolveProjectNameForTitle(
  answers: Record<string, unknown>,
  selectedProject: Project | null,
): string {
  const fromAnswer = cleanField(answers.projectName);
  if (fromAnswer) return fromAnswer;
  return selectedProject?.name?.trim() || '';
}

function buildDocumentTitle(
  title: string | undefined,
  reportDateRaw: string,
  projectName: string,
): string {
  if (title?.trim()) return title.trim();
  if (reportDateRaw && projectName) {
    return `Daily Report — ${reportDateRaw} — ${projectName}`;
  }
  if (reportDateRaw) return `Daily Report — ${reportDateRaw}`;
  if (projectName) return `Daily Report — ${projectName}`;
  return 'Daily Report';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Maps Document Builder answers + project/company into a clean Daily Report view model.
 */
export function buildDailyReportPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: DocumentCompanySettings;
  title?: string;
}): DailyReportDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const reportDateRaw = cleanField(answers.reportDate) || cleanField(answers.documentDate);
  const projectNameForTitle = resolveProjectNameForTitle(answers, selectedProject);

  const documentTitle = buildDocumentTitle(title, reportDateRaw, projectNameForTitle);

  const documentNumber = cleanField(answers.reportNumber) || 'Draft';

  const statusRaw =
    formatSelectLabel(answers.status, STATUS_OPTIONS) || cleanField(answers.status) || 'Draft';

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

  const projectRows = [
    { label: 'Project Name', value: projectName },
    { label: 'Project Address', value: project.address },
    { label: 'Owner / Client', value: projectClientName(selectedProject) },
    { label: 'Contractor', value: projectContractor(companySettings) },
    { label: 'Prepared By', value: preparedBy },
  ];

  const weatherConditions =
    formatSelectLabel(answers.weatherConditions, WEATHER_OPTIONS) ||
    displayField(answers.weatherConditions);

  return {
    documentTitle,
    documentNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    preparedBy,
    weatherConditions: weatherConditions === '—' ? '—' : weatherConditions,
    temperature: displayField(answers.temperature),
    rain: displayField(answers.rain),
    wind: displayField(answers.wind),
    siteConditions: displayField(answers.siteConditions),
    crewSummary: displayField(answers.crewSummary),
    crewMembers: displayField(answers.crewMembers),
    trade: displayField(answers.trade),
    hoursWorked: displayField(answers.hoursWorked),
    foremanLead: displayField(answers.foremanLead),
    equipmentUsed: displayField(answers.equipmentUsed),
    equipmentHours: displayField(answers.equipmentHours),
    idleEquipment: displayField(answers.idleEquipment),
    equipmentIssues: displayField(answers.equipmentIssues),
    workPerformed: displayField(answers.workPerformed),
    workAreas: displayField(answers.workAreas),
    quantitiesInstalled: displayField(answers.quantitiesInstalled),
    deliveries: displayField(answers.deliveries),
    deliveryTicketNumbers: displayField(answers.deliveryTicketNumbers),
    supplier: displayField(answers.supplier),
    materialsAcceptedRejected: displayField(answers.materialsAcceptedRejected),
    delays: displayField(answers.delays),
    delayCause: displayField(answers.delayCause),
    responsibleParty: displayField(answers.responsibleParty),
    scheduleImpact: displayField(answers.scheduleImpact),
    visitors: displayField(answers.visitors),
    inspectors: displayField(answers.inspectors),
    ownerArchitectEngineerVisits: displayField(answers.ownerArchitectEngineerVisits),
    safetyMeetingHeld: displayField(answers.safetyMeetingHeld),
    incidentsNearMisses: displayField(answers.incidentsNearMisses),
    ppeIssues: displayField(answers.ppeIssues),
    correctiveActions: displayField(answers.correctiveActions),
    safetyNotes: displayField(answers.safetyNotes),
    qcNotes: displayField(answers.qcNotes),
    inspectionsPerformed: displayField(answers.inspectionsPerformed),
    deficiencies: displayField(answers.deficiencies),
    testsPerformed: displayField(answers.testsPerformed),
    followUpRequired: displayField(answers.followUpRequired),
    photos: displayField(answers.photos),
    attachmentNotes: displayField(answers.attachmentNotes),
    signaturePreparedBy: preparedBy,
    signatureReviewedBy: displayField(answers.reviewedBy),
    signatureDate: displayDateField(answers.signatureDate),
  };
}
