import type { DocumentTemplate, DocumentType } from '../types';
import { GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE } from '../packs/genericResidential';
import { GENERIC_CHANGE_ORDER_TEMPLATE } from '../packs/changeOrder';
import { contractTemplates } from '../templates/contracts';
import { changeOrderTemplates } from '../templates/changeOrders';

const byKey = new Map<string, DocumentTemplate>();
const byType = new Map<DocumentType, DocumentTemplate[]>();

function register(template: DocumentTemplate): void {
  byKey.set(template.templateKey, template);
  const list = byType.get(template.documentType) ?? [];
  if (!list.some((t) => t.templateKey === template.templateKey)) {
    list.push(template);
    byType.set(template.documentType, list);
  }
}

for (const template of contractTemplates) {
  register(template);
}
register(GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE);

for (const template of changeOrderTemplates) {
  register(template);
}
register(GENERIC_CHANGE_ORDER_TEMPLATE);

export function getTemplate(templateKey: string): DocumentTemplate | undefined {
  return byKey.get(templateKey);
}

export function listTemplates(documentType: DocumentType): DocumentTemplate[] {
  return byType.get(documentType) ?? [];
}
