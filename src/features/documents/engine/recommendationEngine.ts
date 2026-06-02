import type {
  DocumentInput,
  DocumentRecommendation,
  PriceModel,
  ProjectType,
  RecommendationSeverity,
} from '../types';
import {
  getAcceptedAddendumKeys,
  getAnswer,
  getPriceModel,
  getProjectType,
} from './inputUtils';

interface RuleContext {
  /** Resolved document type — used to scope CO-only vs. residential-only rules. */
  documentType: string;
  projectType: ProjectType | undefined;
  priceModel: PriceModel | undefined;
  get: (key: string) => unknown;
}

interface RecommendationRule {
  clauseKey: string;
  severity: RecommendationSeverity;
  reason: string;
  when: (ctx: RuleContext) => boolean;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes';
}

function isFalse(value: unknown): boolean {
  return value === false || value === 'false' || value === 'no';
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/**
 * Deterministic, rule-based clause/addendum recommendations evaluated after
 * intake and risk scoring, before final assembly. Each rule explains why it
 * fired so the contractor can make an informed accept/reject decision. The
 * order here is the order recommendations are surfaced.
 *
 * Rules are scoped by `documentType` so Change Order recommendations are
 * CO-specific and residential rules are suppressed for CO documents.
 */
const RULES: RecommendationRule[] = [
  // ── Change Order rules ──────────────────────────────────────────────────────
  {
    clauseKey: 'co.approval_before_work',
    severity: 'recommended',
    reason:
      'You indicated approval is required before work starts. Accept this clause to add the approval language to Additional Terms.',
    when: (c) =>
      c.documentType === 'change_order' && isTrue(c.get('approvalRequiredBeforeWorkStarts')),
  },
  {
    clauseKey: 'co.emergency_work_docs',
    severity: 'critical',
    reason:
      'Emergency work is flagged. Accept this clause to add documentation requirements to Additional Terms.',
    when: (c) => c.documentType === 'change_order' && isTrue(c.get('emergencyWork')),
  },
  {
    clauseKey: 'co.concealed_condition',
    severity: 'recommended',
    reason:
      'A concealed or unforeseen field condition is flagged. Accept this clause to add the condition language to Additional Terms.',
    when: (c) => c.documentType === 'change_order' && isTrue(c.get('fieldCondition')),
  },
  {
    clauseKey: 'co.owner_requested_scope',
    severity: 'recommended',
    reason:
      'An owner-requested change is flagged. Accept this clause to add owner-acknowledgment language to Additional Terms.',
    when: (c) =>
      c.documentType === 'change_order' &&
      (isTrue(c.get('ownerRequestedChange')) || c.get('requestedBy') === 'owner'),
  },
  {
    clauseKey: 'co.cost_backup_required',
    severity: 'recommended',
    reason:
      'Cost backup is not marked as available. Accept this clause to add cost-backup language to Additional Terms.',
    when: (c) =>
      c.documentType === 'change_order' &&
      isFalse(c.get('costBreakdownAvailable')) &&
      (toNumber(c.get('totalChangeOrderAmount')) ?? 0) > 0,
  },
  {
    clauseKey: 'co.schedule_adjustment',
    severity: 'info',
    reason:
      'Schedule impact is documented. Accept this clause to add contract-time adjustment language to Additional Terms.',
    when: (c) =>
      c.documentType === 'change_order' &&
      ((toNumber(c.get('additionalCalendarDays')) ?? 0) > 0 ||
        Boolean(c.get('revisedCompletionDate'))),
  },

  // ── Residential / general rules ─────────────────────────────────────────────
  // All residential-specific rules are guarded by `c.documentType !== 'change_order'`
  // to prevent them from appearing when a Change Order document is selected.
  {
    clauseKey: 'addendum.concrete',
    severity: 'recommended',
    reason:
      'Concrete project: capture mix design, strength, jointing, finish, and curing in a dedicated addendum.',
    when: (c) => c.documentType !== 'change_order' && c.projectType === 'concrete',
  },
  {
    clauseKey: 'addendum.concrete_cracking',
    severity: 'critical',
    reason:
      'Concrete cracking and surface variation are the top source of disputes; disclose them up front.',
    when: (c) => c.documentType !== 'change_order' && c.projectType === 'concrete',
  },
  {
    clauseKey: 'addendum.ready_mix',
    severity: 'recommended',
    reason:
      'Ready-mix delivery is controlled by a third-party plant; disclaim plant and delivery delays.',
    when: (c) => c.documentType !== 'change_order' && c.projectType === 'concrete',
  },
  {
    clauseKey: 'addendum.owner_maintenance',
    severity: 'info',
    reason:
      'An owner maintenance guide (sealing, deicing, freeze/thaw) protects workmanship coverage.',
    when: (c) => c.documentType !== 'change_order' && c.projectType === 'concrete',
  },
  {
    clauseKey: 'change_order.unknown_conditions',
    severity: 'recommended',
    reason:
      'Renovation, repair, roofing, and older structures commonly reveal concealed conditions after work begins.',
    when: (c) =>
      c.documentType !== 'change_order' &&
      (['remodel', 'repair', 'roofing', 'insurance_restoration', 'new_construction'].includes(
        c.projectType ?? '',
      ) ||
        isTrue(c.get('roofDeckReplacement')) ||
        ((toNumber(c.get('yearBuilt')) ?? 9999) < 1980)),
  },
  {
    clauseKey: 'risk.material_escalation',
    severity: 'recommended',
    reason:
      'Lock in a material escalation clause when prices are volatile or the schedule is long.',
    when: (c) =>
      c.documentType !== 'change_order' &&
      (isTrue(c.get('materialEscalationConcern')) || c.projectType === 'new_construction'),
  },
  {
    clauseKey: 'weather.delay',
    severity: 'recommended',
    reason:
      'Weather-sensitive work (concrete, roofing) needs explicit weather-delay protection.',
    when: (c) =>
      c.documentType !== 'change_order' &&
      (c.projectType === 'concrete' ||
        c.projectType === 'roofing' ||
        isTrue(c.get('weatherSensitive'))),
  },
  {
    clauseKey: 'owner.supplied_materials',
    severity: 'recommended',
    reason:
      'Owner-supplied materials shift delivery, defect, and warranty risk; document responsibility clearly.',
    when: (c) => c.documentType !== 'change_order' && isTrue(c.get('ownerSuppliedMaterials')),
  },
  {
    clauseKey: 'addendum.owner_supplied_materials',
    severity: 'recommended',
    reason:
      'Attach an owner-supplied materials addendum listing items, dates, and responsibility.',
    when: (c) => c.documentType !== 'change_order' && isTrue(c.get('ownerSuppliedMaterials')),
  },
  {
    clauseKey: 'addendum.hoa_condo',
    severity: 'recommended',
    reason:
      'HOA / condo rules can add approvals, work-hour limits, and delays; attach the HOA addendum.',
    when: (c) => c.documentType !== 'change_order' && isTrue(c.get('hoa')),
  },
  {
    clauseKey: 'addendum.insurance_restoration',
    severity: 'critical',
    reason:
      'Insurance restoration depends on carrier scope and approvals; clarify the contractor is not the insurer.',
    when: (c) => c.documentType !== 'change_order' && c.projectType === 'insurance_restoration',
  },
  {
    clauseKey: 'risk.hazardous_materials',
    severity: 'critical',
    reason:
      'Possible asbestos, lead, or mold requires a stop-work and qualified remediation provision.',
    when: (c) =>
      c.documentType !== 'change_order' &&
      (isTrue(c.get('hazardousMaterialsPossible')) ||
        (toNumber(c.get('yearBuilt')) ?? 9999) < 1980),
  },
  {
    clauseKey: 'addendum.time_materials',
    severity: 'recommended',
    reason:
      'Time and materials pricing should attach an addendum detailing rates and billable categories.',
    when: (c) => c.documentType !== 'change_order' && c.priceModel === 'time_and_materials',
  },
];

export function recommendDocumentClauses(input: DocumentInput): DocumentRecommendation[] {
  const ctx: RuleContext = {
    documentType: input.documentType,
    projectType: getProjectType(input),
    priceModel: getPriceModel(input),
    get: (key: string) => getAnswer(input, key),
  };
  const accepted = new Set(getAcceptedAddendumKeys(input));

  const seen = new Set<string>();
  const recommendations: DocumentRecommendation[] = [];

  for (const rule of RULES) {
    if (seen.has(rule.clauseKey)) continue;
    if (!rule.when(ctx)) continue;
    seen.add(rule.clauseKey);
    recommendations.push({
      clauseKey: rule.clauseKey,
      reason: rule.reason,
      severity: rule.severity,
      accepted: accepted.has(rule.clauseKey) ? true : undefined,
    });
  }

  return recommendations;
}
