import type { DocumentTemplate } from '../../types';
import { changeOrderPackClauseKeys } from './clauses';

export const GENERIC_CHANGE_ORDER_TEMPLATE: DocumentTemplate = {
  templateKey: 'GENERIC_CHANGE_ORDER_TEMPLATE',
  title: 'Generic Change Order',
  documentType: 'change_order',
  clauseKeys: changeOrderPackClauseKeys,
  addendumKeys: [],
  version: '0.1.0',
};
