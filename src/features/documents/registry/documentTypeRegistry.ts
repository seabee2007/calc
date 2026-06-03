import type { DocumentType } from '../types';
import type { DocumentTypeDefinition } from './types';

const DEFINITIONS: Partial<Record<DocumentType, DocumentTypeDefinition>> = {
  residential_contract: {
    documentType: 'residential_contract',
    label: 'Residential Contract',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_RESIDENTIAL',
    defaultTemplateKey: 'GENERIC_RESIDENTIAL_CONTRACT',
  },
  change_order: {
    documentType: 'change_order',
    label: 'Change Order',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_CHANGE_ORDER',
    defaultTemplateKey: 'GENERIC_CHANGE_ORDER_TEMPLATE',
  },
  submittal: {
    documentType: 'submittal',
    label: 'Submittal Cover Sheet',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_SUBMITTAL',
    defaultTemplateKey: 'GENERIC_SUBMITTAL_TEMPLATE',
  },
  daily_report: {
    documentType: 'daily_report',
    label: 'Daily Report',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_DAILY_REPORT',
    defaultTemplateKey: 'GENERIC_DAILY_REPORT_TEMPLATE',
  },
  qc_report: {
    documentType: 'qc_report',
    label: 'QC Report',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_QC_REPORT',
    defaultTemplateKey: 'GENERIC_QC_REPORT_TEMPLATE',
  },
  warranty_letter: {
    documentType: 'warranty_letter',
    label: 'Warranty / Closeout Letter',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_WARRANTY_CLOSEOUT',
    defaultTemplateKey: 'GENERIC_WARRANTY_CLOSEOUT_TEMPLATE',
  },
  punch_list: {
    documentType: 'punch_list',
    label: 'Punch List',
    runtimeSupported: true,
    defaultPackKey: 'GENERIC_PUNCH_LIST',
    defaultTemplateKey: 'GENERIC_PUNCH_LIST_TEMPLATE',
  },
};

export function getDocumentTypeDefinition(
  documentType: DocumentType,
): DocumentTypeDefinition | undefined {
  return DEFINITIONS[documentType];
}

export function isRuntimeSupported(documentType: DocumentType): boolean {
  return DEFINITIONS[documentType]?.runtimeSupported === true;
}

export function getDefaultPackKey(documentType: DocumentType): string {
  return DEFINITIONS[documentType]?.defaultPackKey ?? 'GENERIC_RESIDENTIAL';
}

export function listSupportedDocumentTypes(): DocumentType[] {
  return Object.values(DEFINITIONS)
    .filter((d): d is DocumentTypeDefinition => d?.runtimeSupported === true)
    .map((d) => d.documentType);
}
