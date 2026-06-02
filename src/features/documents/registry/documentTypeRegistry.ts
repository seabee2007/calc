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
