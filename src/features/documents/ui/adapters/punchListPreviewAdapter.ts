import { format } from 'date-fns';
import type { Project } from '../../../../types/index';
import { formatUSAddress } from '../../../../types/address';
import { resolveClientAddressForProposal } from '../../../../types/projectClient';
import type { PunchListItemAnswer } from '../../packs/punchList/punchListItemTypes';
import { parsePunchListItems } from '../../packs/punchList/punchListItemTypes';
import type { DocumentCompany, DocumentProject } from '../components/professionalDocumentTypes';
import { cleanDocumentBody, displayValue } from '../previewDisplay';
import {
  CATEGORY_OPTIONS,
  ITEM_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from '../../packs/punchList/questions';
import type { DocumentCompanySettings } from '../documentCompanySettings';

export interface PunchListItemView {
  id: string;
  itemNumber: string;
  itemDescription: string;
  locationArea: string;
  category: string;
  trade: string;
  responsibleParty: string;
  priority: string;
  itemStatus: string;
  dueDate: string;
  correctiveAction: string;
  completionDate: string;
  verifiedBy: string;
  verificationDate: string;
  notes: string;
  ownerComment: string;
  contractorResponse: string;
  costImpact: string;
  scheduleImpact: string;
  photoReferences: string;
  attachmentNotes: string;
}

export interface PunchListDocumentView {
  documentTitle: string;
  documentNumber: string;
  status: string;
  generatedDate: string;
  company: DocumentCompany;
  project: DocumentProject;
  projectRows: Array<{ label: string; value?: string | null }>;
  preparedBy: string;
  inspectionDate: string;
  inspectionLocation: string;
  summary: string;
  items: PunchListItemView[];
  costImpact: string;
  scheduleImpact: string;
  ownerComment: string;
  contractorResponse: string;
  photoReferences: string;
  attachmentNotes: string;
  finalAcceptanceBy: string;
  finalAcceptanceDate: string;
  signaturePreparedBy: string;
  signatureVerifiedBy: string;
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

function projectContractor(companySettings: DocumentCompanySettings): string {
  return companySettings.companyName?.trim() || '—';
}

function resolveDocumentStatus(answers: Record<string, unknown>): string {
  const overall = formatSelectLabel(answers.overallStatus, STATUS_OPTIONS);
  if (overall) return overall;
  const status = formatSelectLabel(answers.status, STATUS_OPTIONS);
  if (status) return status;
  return cleanField(answers.overallStatus) || cleanField(answers.status) || 'Draft';
}

function buildDocumentTitle(
  title: string | undefined,
  punchListNumber: string,
  projectName: string,
): string {
  if (title?.trim()) return title.trim();
  if (punchListNumber && punchListNumber !== 'Draft') {
    return `Punch List — ${punchListNumber}`;
  }
  if (projectName) return `Punch List — ${projectName}`;
  return 'Punch List';
}

function mapPunchListItemAnswer(row: PunchListItemAnswer, index: number): PunchListItemView {
  const itemNumberRaw = displayField(row.itemNumber);
  const itemNumber = itemNumberRaw === '—' ? String(index + 1) : itemNumberRaw;
  const description = displayField(row.description);
  const itemStatusRaw =
    formatSelectLabel(row.status, ITEM_STATUS_OPTIONS) || displayField(row.status);

  return {
    id: row.id,
    itemNumber,
    itemDescription: description,
    locationArea: displayField(row.locationArea),
    category:
      formatSelectLabel(row.category, CATEGORY_OPTIONS) || displayField(row.category),
    trade: displayField(row.trade),
    responsibleParty: displayField(row.responsibleParty),
    priority:
      formatSelectLabel(row.priority, PRIORITY_OPTIONS) || displayField(row.priority),
    itemStatus: itemStatusRaw === '—' ? 'Open' : itemStatusRaw,
    dueDate: displayField(row.dueDate),
    correctiveAction: displayField(row.correctiveAction),
    completionDate: displayField(row.completionDate),
    verifiedBy: displayField(row.verifiedBy),
    verificationDate: displayField(row.verificationDate),
    notes: displayField(row.attachmentNotes),
    ownerComment: displayField(row.ownerComment),
    contractorResponse: displayField(row.contractorResponse),
    costImpact: displayField(row.costImpact),
    scheduleImpact: displayField(row.scheduleImpact),
    photoReferences: displayField(row.photoReferences),
    attachmentNotes: displayField(row.attachmentNotes),
  };
}

function buildPrimaryItem(answers: Record<string, unknown>): PunchListItemView | null {
  const itemNumber = displayField(answers.itemNumber);
  const itemDescription = displayField(answers.itemDescription);
  const hasItem =
    itemNumber !== '—' ||
    itemDescription !== '—' ||
    cleanField(answers.locationArea) ||
    cleanField(answers.responsibleParty);

  if (!hasItem) return null;

  const itemStatusRaw =
    formatSelectLabel(answers.itemStatus, ITEM_STATUS_OPTIONS) ||
    formatSelectLabel(answers.status, ITEM_STATUS_OPTIONS) ||
    displayField(answers.itemStatus);

  return {
    id: 'legacy',
    itemNumber: itemNumber === '—' ? '1' : itemNumber,
    itemDescription: itemDescription === '—' ? '—' : itemDescription,
    locationArea: displayField(answers.locationArea),
    category:
      formatSelectLabel(answers.category, CATEGORY_OPTIONS) || displayField(answers.category),
    trade: displayField(answers.trade),
    responsibleParty: displayField(answers.responsibleParty),
    priority:
      formatSelectLabel(answers.priority, PRIORITY_OPTIONS) || displayField(answers.priority),
    itemStatus: itemStatusRaw === '—' ? 'Open' : itemStatusRaw,
    dueDate: displayField(answers.dueDate),
    correctiveAction: displayField(answers.correctiveAction),
    completionDate: displayField(answers.completionDate),
    verifiedBy: displayField(answers.verifiedBy),
    verificationDate: displayField(answers.verificationDate),
    notes: displayField(answers.notes),
    ownerComment: displayField(answers.ownerComment),
    contractorResponse: displayField(answers.contractorResponse),
    costImpact: displayField(answers.costImpact),
    scheduleImpact: displayField(answers.scheduleImpact),
    photoReferences: displayField(answers.photoReferences),
    attachmentNotes: displayField(answers.attachmentNotes),
  };
}

function resolveItems(answers: Record<string, unknown>): PunchListItemView[] {
  const fromArray = parsePunchListItems(answers.punchItems);
  if (fromArray.length > 0) {
    return fromArray.map(mapPunchListItemAnswer);
  }
  const legacy = buildPrimaryItem(answers);
  return legacy ? [legacy] : [];
}

function resolveSignatureVerifiedBy(items: PunchListItemView[]): string {
  for (const item of items) {
    if (item.verifiedBy !== '—' && item.verifiedBy.trim()) return item.verifiedBy;
  }
  return '—';
}

export function buildPunchListPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: DocumentCompanySettings;
  title?: string;
}): PunchListDocumentView {
  const { answers, selectedProject, companySettings, title } = input;

  const listDateRaw = cleanField(answers.listDate) || cleanField(answers.documentDate);
  const punchListNumber = cleanField(answers.punchListNumber) || 'Draft';
  const projectNameForTitle = selectedProject?.name?.trim() || '';
  const usesPunchItemsArray = parsePunchListItems(answers.punchItems).length > 0;

  const documentTitle = buildDocumentTitle(title, punchListNumber, projectNameForTitle);
  const statusRaw = resolveDocumentStatus(answers);

  let generatedDate = format(new Date(), 'MMMM d, yyyy');
  if (listDateRaw) {
    try {
      generatedDate = format(new Date(listDateRaw), 'MMMM d, yyyy');
    } catch {
      generatedDate = listDateRaw;
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
  const items = resolveItems(answers);

  const finalAcceptanceBy = displayField(answers.finalAcceptanceBy);
  const ownerSig =
    finalAcceptanceBy !== '—' ? finalAcceptanceBy : projectClientName(selectedProject);

  let signatureDate = displayField(answers.signatureDate);
  if (signatureDate === '—' && listDateRaw) {
    try {
      signatureDate = format(new Date(listDateRaw), 'MMMM d, yyyy');
    } catch {
      signatureDate = listDateRaw;
    }
  }

  const projectRows = [
    { label: 'Project Name', value: projectName },
    { label: 'Project Address', value: project.address },
    { label: 'Owner / Client', value: projectClientName(selectedProject) },
    { label: 'Contractor', value: projectContractor(companySettings) },
    { label: 'Prepared By', value: preparedBy },
  ];

  const legacyDocLevel = !usesPunchItemsArray;

  return {
    documentTitle,
    documentNumber: punchListNumber,
    status: statusRaw,
    generatedDate,
    company,
    project,
    projectRows,
    preparedBy,
    inspectionDate: displayField(answers.inspectionDate),
    inspectionLocation: displayField(answers.inspectionLocation),
    summary: displayField(answers.summary),
    items,
    costImpact: legacyDocLevel ? displayField(answers.costImpact) : '—',
    scheduleImpact: legacyDocLevel ? displayField(answers.scheduleImpact) : '—',
    ownerComment: legacyDocLevel ? displayField(answers.ownerComment) : '—',
    contractorResponse: legacyDocLevel ? displayField(answers.contractorResponse) : '—',
    photoReferences: legacyDocLevel ? displayField(answers.photoReferences) : '—',
    attachmentNotes: legacyDocLevel ? displayField(answers.attachmentNotes) : '—',
    finalAcceptanceBy,
    finalAcceptanceDate: displayField(answers.finalAcceptanceDate),
    signaturePreparedBy: preparedBy,
    signatureVerifiedBy: resolveSignatureVerifiedBy(items),
    signatureOwner: ownerSig,
    signatureDate,
  };
}
