import type { DocumentQuestion } from '../../types';

/**
 * Change Order Pack question bank.
 *
 * quick   — core fields for a minimal change order (title, scope, amount).
 * standard — operational fields for documented approval and schedule.
 * advanced — risk conditions, emergency work, field conditions.
 *
 * Field order follows the recommended CO builder layout:
 *   Scope → Pricing → Schedule → Change Management → Execution (Terms)
 *
 * Note: "project" text question is intentionally omitted — project information
 * is imported from the top project selector, not typed manually.
 *
 * Note: "Revised contract amount" is intentionally omitted — it is
 * auto-calculated from originalContractAmount + previouslyApprovedChangeOrders
 * + totalChangeOrderAmount and shown read-only in the preview.
 */
export const changeOrderQuestions: DocumentQuestion[] = [

  // ── Quick mode ─────────────────────────────────────────────────────────────

  {
    questionKey: 'changeOrderTitle',
    label: 'Change order title',
    type: 'text',
    group: 'scope',
    required: true,
    mode: 'quick',
    helperText: 'A short description of this change, e.g. "Add outdoor electrical outlet".',
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
    helperText: 'Describe any impact to the project timeline.',
  },

  // ── Standard mode ──────────────────────────────────────────────────────────

  // Scope — who/what/why detail
  {
    questionKey: 'requestedBy',
    label: 'Requested by',
    type: 'select',
    group: 'scope',
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
    questionKey: 'rfiFarReference',
    label: 'RFI or FAR reference (if applicable)',
    type: 'text',
    group: 'scope',
    required: false,
    mode: 'standard',
    helperText: 'Link this change to an existing RFI or Field Adjustment Request.',
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
    label: 'Description of deleted / removed work',
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

  // Pricing — contract value tracking
  {
    questionKey: 'originalContractAmount',
    label: 'Original contract amount ($)',
    type: 'number',
    group: 'pricing',
    required: false,
    mode: 'standard',
    helperText: 'Used to calculate the revised contract value in the preview. Auto-filled when a project with a contract value is selected.',
  },
  {
    questionKey: 'previouslyApprovedChangeOrders',
    label: 'Previously approved change orders total ($)',
    type: 'number',
    group: 'pricing',
    required: false,
    mode: 'standard',
  },

  // Schedule — time extensions
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

  // Change management — approval, risk signals
  {
    questionKey: 'approvalRequiredBeforeWorkStarts',
    label: 'Approval required before work starts',
    type: 'boolean',
    group: 'change_management',
    required: false,
    mode: 'standard',
    helperText: 'Turn on to require written Owner approval before any work described in this Change Order begins.',
    riskSignals: [
      {
        whenEquals: [false],
        key: 'co.work_before_approval',
        label: 'Work starting without written approval creates scope and payment disputes.',
        points: 15,
      },
    ],
  },
  {
    questionKey: 'costBreakdownAvailable',
    label: 'Cost backup attached or available?',
    type: 'boolean',
    group: 'change_management',
    required: false,
    mode: 'standard',
    helperText: 'Turn on if labor, material, equipment, subcontractor, or vendor backup is attached or available for client review. Leaving this off when a total is entered will trigger a cost-backup recommendation.',
  },

  // Execution — additional terms
  {
    questionKey: 'terms',
    label: 'Additional terms or conditions',
    type: 'text',
    group: 'execution',
    required: false,
    mode: 'standard',
  },

  // ── Advanced mode ──────────────────────────────────────────────────────────

  // Change management — risk conditions (advanced detail)
  {
    questionKey: 'emergencyWork',
    label: 'Emergency work (required to prevent damage or unsafe conditions)',
    type: 'boolean',
    group: 'change_management',
    required: false,
    mode: 'advanced',
    helperText: 'Turn on if this work was required immediately to prevent property damage or unsafe conditions.',
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
    group: 'change_management',
    required: false,
    mode: 'advanced',
    helperText: 'Turn on if a concealed, latent, or unforeseen condition was discovered during work.',
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
    group: 'change_management',
    required: false,
    mode: 'advanced',
    helperText: 'Turn on if the Owner directly requested this scope change (separate from the Requested By field above).',
    riskSignals: [
      {
        whenEquals: [true],
        key: 'co.owner_requested_change',
        label: 'Owner-requested changes increase scope-creep and verbal-authorization risk.',
        points: 5,
      },
    ],
  },
];
