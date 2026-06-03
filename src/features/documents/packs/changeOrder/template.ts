import type { DocumentTemplate } from '../../types';
import { changeOrderDocumentClauseKeys } from './clauses';

export const GENERIC_CHANGE_ORDER_TEMPLATE: DocumentTemplate = {
  templateKey: 'GENERIC_CHANGE_ORDER_TEMPLATE',
  title: 'Generic Change Order',
  documentType: 'change_order',
  clauseKeys: changeOrderDocumentClauseKeys,
  addendumKeys: [],
  version: '0.1.0',
};
