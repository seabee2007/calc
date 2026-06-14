import type { DocumentQuestion } from '../../types';

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'complete', label: 'Complete' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
];

export const ITEM_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'complete', label: 'Complete' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const CATEGORY_OPTIONS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'formwork', label: 'Formwork' },
  { value: 'reinforcement', label: 'Reinforcement' },
  { value: 'finishes', label: 'Finishes' },
  { value: 'sitework', label: 'Sitework' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

/**
 * Punch List Pack question bank (document-level fields only).
 * Discrepancies live in `answers.punchItems` via PunchListItemsEditor.
 */
export const punchListQuestions: DocumentQuestion[] = [
  {
    questionKey: 'listDate',
    label: 'List date',
    type: 'date',
    group: 'schedule',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'punchListNumber',
    label: 'Punch list number',
    type: 'text',
    group: 'schedule',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'preparedBy',
    label: 'Prepared by',
    type: 'text',
    group: 'parties',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'inspectionDate',
    label: 'Inspection date',
    type: 'date',
    group: 'schedule',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'inspectionLocation',
    label: 'Inspection location / area',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'overallStatus',
    label: 'Overall status',
    type: 'select',
    group: 'execution',
    options: STATUS_OPTIONS,
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'summary',
    label: 'Summary',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'status',
    label: 'Document status',
    type: 'select',
    group: 'execution',
    options: STATUS_OPTIONS,
    required: false,
    mode: 'quick',
  },
  {
    questionKey: 'finalAcceptanceBy',
    label: 'Final acceptance by',
    type: 'text',
    group: 'parties',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'finalAcceptanceDate',
    label: 'Final acceptance date',
    type: 'date',
    group: 'schedule',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'signatureDate',
    label: 'Signature date',
    type: 'date',
    group: 'schedule',
    required: false,
    mode: 'advanced',
  },
];
