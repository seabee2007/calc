import type { DocumentQuestion } from '../../types';

/**
 * Change Order Pack question bank.
 *
 * quick   — core fields for a minimal change order (title, scope, amount).
 * standard — operational fields for documented approval and schedule.
 * advanced — contract value tracking, RFI/FAR references, risk conditions.
 */
export const changeOrderQuestions: DocumentQuestion[] = [
  // --- Quick ---
  {
    questionKey: 'project',
    label: 'Project name',
    type: 'text',
    group: 'project',
    required: true,
    mode: 'quick',
  },
  {
    questionKey: 'changeOrderTitle',
    label: 'Change order title',
    type: 'text',
    group: 'scope',
    required: true,
    mode: 'quick',
  },
  {
    questionKey: 'scopeOfChange',
    label: 'Scope of change',
    type: 'text',
    group: 'scope',
    required: true,
    mode: 'quick',
  },
  {
    questionKey: 'reasonForChange',
    label: 'Reason for change',
    type: 'text',
    group: 'scope',
    required: true,
    mode: 'quick',
  },
  {
    questionKey: 'totalChangeOrderAmount',
    label: 'Total change order amount ($)',
    type: 'number',
    group: 'pricing',
    required: true,
    mode: 'quick',
  },
  {
    questionKey: 'scheduleImpact',
    label: 'Schedule impact',
    type: 'text',
    group: 'schedule',
    required: false,
    mode: 'quick',
  },

  // --- Standard ---
  {
    questionKey: 'requestedBy',
    label: 'Requested by (owner / contractor / inspector / other)',
    type: 'select',
    group: 'parties',
    options: [
      { value: 'owner', label: 'Owner / Client' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'inspector', label: 'Inspector' },
      { value: 'engineer', label: 'Engineer / Architect' },
      { value: 'other', label: 'Other' },
    ],
    required: false,
    mode: 'standard',
    riskSignals: [
      {
        whenEquals: ['owner'],
        key: 'co.owner_requested',
        label: 'Owner-requested changes should be documented in writing before work starts.',
        points: 5,
      },
    ],
  },
  {
    questionKey: 'addedWork',
    label: 'Description of added work',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'standard',
  },
  {
    questionKey: 'deletedWork',
    label: 'Description of deleted work',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'standard',
  },
  {
    questionKey: 'exclusions',
    label: 'Exclusions from this change order',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'standard',
  },
  {
    questionKey: 'additionalCalendarDays',
    label: 'Additional calendar days',
    type: 'number',
    group: 'schedule',
    required: false,
    mode: 'standard',
  },
  {
    questionKey: 'revisedCompletionDate',
    label: 'Revised completion date',
    type: 'date',
    group: 'schedule',
    required: false,
    mode: 'standard',
  },
  {
    questionKey: 'approvalRequiredBeforeWorkStarts',
    label: 'Approval required before work starts',
    type: 'boolean',
    group: 'change_management',
    required: false,
    mode: 'standard',
    riskSignals: [
      {
        whenEquals: [false],
        key: 'co.work_before_approval',
        label: 'Work starting without written approval creates scope and payment disputes.',
        points: 15,
      },
    ],
  },

  // --- Advanced ---
  {
    questionKey: 'originalContractAmount',
    label: 'Original contract amount ($)',
    type: 'number',
    group: 'pricing',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'previouslyApprovedChangeOrders',
    label: 'Previously approved change orders total ($)',
    type: 'number',
    group: 'pricing',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'revisedContractAmount',
    label: 'Revised contract amount ($)',
    type: 'number',
    group: 'pricing',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'costBreakdownAvailable',
    label: 'Cost breakdown available',
    type: 'boolean',
    group: 'pricing',
    required: false,
    mode: 'advanced',
  },
  {
    questionKey: 'emergencyWork',
    label: 'Emergency work (required to prevent damage or unsafe conditions)',
    type: 'boolean',
    group: 'risk',
    required: false,
    mode: 'advanced',
    riskSignals: [
      {
        whenEquals: [true],
        key: 'co.emergency_work',
        label: 'Emergency work should be documented with photos, notes, and owner notification.',
        points: 10,
      },
    ],
  },
  {
    questionKey: 'fieldCondition',
    label: 'Hidden or unforeseen field condition',
    type: 'boolean',
    group: 'risk',
    required: false,
    mode: 'advanced',
    riskSignals: [
      {
        whenEquals: [true],
        key: 'co.hidden_condition',
        label: 'Hidden or unforeseen conditions should be photographed and reported before work proceeds.',
        points: 10,
      },
    ],
  },
  {
    questionKey: 'ownerRequestedChange',
    label: 'Owner-requested scope change',
    type: 'boolean',
    group: 'risk',
    required: false,
    mode: 'advanced',
    riskSignals: [
      {
        whenEquals: [true],
        key: 'co.owner_requested_change',
        label: 'Owner-requested changes increase scope-creep and verbal-authorization risk.',
        points: 5,
      },
    ],
  },
  {
    questionKey: 'rfiFarReference',
    label: 'RFI or FAR reference number (if applicable)',
    type: 'text',
    group: 'documentation',
    required: false,
    mode: 'advanced',
  },
];
