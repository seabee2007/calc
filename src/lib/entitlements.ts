export type PlanId = 'free' | 'starter' | 'professional' | 'business';

/** Paid plans in ascending order — used for minPlanForFeature and marketing cards. */
export const PLAN_ORDER: PlanId[] = ['starter', 'professional', 'business'];

export const PLAN_DISPLAY_NAMES: Record<PlanId, { short: string; long: string }> = {
  free: { short: 'Free', long: 'Free' },
  starter: { short: 'Starter', long: 'Foundation' },
  professional: { short: 'Professional', long: 'Field' },
  business: { short: 'Business', long: 'Portfolio' },
};

export type FeatureKey =
  | 'quick_estimates'
  | 'conceptual_estimates'
  | 'activity_based_estimating'
  | 'calculators'
  | 'resources'
  | 'proposals'
  | 'proposal_public_links'
  | 'employee_portal'
  | 'rfis'
  | 'fars'
  | 'qc'
  | 'document_builder'
  | 'client_portal'
  | 'change_orders'
  | 'logic_network'
  | 'cpm'
  | 'level_three_gantt'
  | 'level_three_gantt_export'
  | 'accounting_exports'
  | 'financial_dashboard'
  | 'ai_concrete_chat'
  | 'global_ask_ai'
  | 'ai_scope_summary'
  | 'ai_labor_crew_review'
  | 'ai_batch_plant_tools'
  | 'contract_builder'
  | 'global_planner_hub'
  | 'arden_calc_in_estimator'
  | 'model_3d_takeoff'
  | 'model_3d_extraction';

export type LimitKey =
  | 'max_active_projects'
  | 'included_field_seats'
  | 'max_field_seats'
  | 'ai_requests_monthly'
  | 'level_three_exports_monthly'
  | 'max_3d_models_per_project'
  | 'max_3d_model_size_mb';

/** -1 = unlimited */
export const PLAN_LIMITS: Record<PlanId, Record<LimitKey, number>> = {
  free: {
    max_active_projects: 1,
    included_field_seats: 0,
    max_field_seats: 0,
    ai_requests_monthly: 0,
    level_three_exports_monthly: 0,
    max_3d_models_per_project: 0,
    max_3d_model_size_mb: 0,
  },
  starter: {
    max_active_projects: 3,
    included_field_seats: 1,
    max_field_seats: 1,
    ai_requests_monthly: 0,
    level_three_exports_monthly: 0,
    max_3d_models_per_project: 0,
    max_3d_model_size_mb: 0,
  },
  professional: {
    max_active_projects: 10,
    included_field_seats: 5,
    max_field_seats: 25,
    ai_requests_monthly: 0,
    level_three_exports_monthly: 5,
    max_3d_models_per_project: 10,
    max_3d_model_size_mb: 100,
  },
  business: {
    max_active_projects: -1,
    included_field_seats: 15,
    max_field_seats: -1,
    ai_requests_monthly: 500,
    level_three_exports_monthly: -1,
    max_3d_models_per_project: 50,
    max_3d_model_size_mb: 500,
  },
};

export type ThreeDTakeoffCapability =
  | 'viewDemo'
  | 'uploadGlb'
  | 'manualTakeoff'
  | 'measureTool'
  | 'snapMeasure'
  | 'scaleCalibration'
  | 'addToEstimate'
  | 'saveModelLinkedTakeoffItems'
  | 'ifcImport'
  | 'modelVersionCompare'
  | 'clientViewer'
  | 'aiObjectMapping';

export const THREE_D_TAKEOFF_ENTITLEMENTS: Record<ThreeDTakeoffCapability, PlanId[]> = {
  viewDemo: ['free', 'starter', 'professional', 'business'],
  uploadGlb: ['professional', 'business'],
  manualTakeoff: ['professional', 'business'],
  measureTool: ['professional', 'business'],
  snapMeasure: ['professional', 'business'],
  scaleCalibration: ['professional', 'business'],
  addToEstimate: ['professional', 'business'],
  saveModelLinkedTakeoffItems: ['professional', 'business'],
  ifcImport: ['business'],
  modelVersionCompare: ['business'],
  clientViewer: ['business'],
  aiObjectMapping: ['business'],
};

const FREE_FEATURES: FeatureKey[] = [
  'quick_estimates',
  'calculators',
  'resources',
];

const STARTER_FEATURES: FeatureKey[] = [
  'quick_estimates',
  'conceptual_estimates',
  'calculators',
  'resources',
  'proposals',
  'global_ask_ai',
];

const PROFESSIONAL_FEATURES: FeatureKey[] = [
  ...STARTER_FEATURES,
  'activity_based_estimating',
  'proposal_public_links',
  'employee_portal',
  'rfis',
  'fars',
  'qc',
  'document_builder',
  'client_portal',
  'change_orders',
  'logic_network',
  'cpm',
  'level_three_gantt',
  'model_3d_takeoff',
  'arden_calc_in_estimator',
];

const BUSINESS_FEATURES: FeatureKey[] = [
  ...PROFESSIONAL_FEATURES,
  'level_three_gantt_export',
  'model_3d_extraction',
  'accounting_exports',
  'financial_dashboard',
  'ai_concrete_chat',
  'ai_scope_summary',
  'ai_labor_crew_review',
  'ai_batch_plant_tools',
  'contract_builder',
  'global_planner_hub',
];

export const PLAN_FEATURES: Record<PlanId, Set<FeatureKey>> = {
  free: new Set(FREE_FEATURES),
  starter: new Set(STARTER_FEATURES),
  professional: new Set(PROFESSIONAL_FEATURES),
  business: new Set(BUSINESS_FEATURES),
};

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  quick_estimates: 'Fast ballpark estimates for early project sizing.',
  conceptual_estimates: 'Conceptual budgets with allowances and scenarios.',
  activity_based_estimating: 'Detailed bid and self-perform estimating with construction activities.',
  calculators: 'Standalone construction calculators and field tools.',
  resources: 'Resources hub with estimating and concrete references.',
  proposals: 'Create and manage project proposals.',
  proposal_public_links: 'Email proposals and share public proposal links with clients.',
  employee_portal: 'Employee mobile field portal for tasks, RFIs, and daily work.',
  rfis: 'Request for Information workflow across projects.',
  fars: 'Field Adjustment Requests workflow.',
  qc: 'Quality control inspections and punch workflows.',
  document_builder: 'Document builder for project paperwork and deliverables.',
  client_portal: 'Client portal for project visibility and approvals.',
  change_orders: 'Change order scope, pricing, and delivery workflows.',
  logic_network: 'Logic network for activity dependencies and schedule logic.',
  cpm: 'Critical path method schedule calculations.',
  level_three_gantt: 'Level III Gantt schedule workspace.',
  level_three_gantt_export: 'Export Level III Gantt charts to PDF or Excel.',
  accounting_exports: 'Accounting and tax export workflows.',
  financial_dashboard: 'Financial deep-dive dashboards and portfolio metrics.',
  ai_concrete_chat: 'Concrete Chat AI assistant.',
  global_ask_ai: 'Global floating Ask AI assistant for project planning and concrete guidance.',
  ai_scope_summary: 'AI scope summarization for projects and estimates.',
  ai_labor_crew_review: 'AI labor crew review recommendations.',
  ai_batch_plant_tools: 'AI batch plant pricing and contact tools.',
  contract_builder: 'Contract builder for client agreements.',
  global_planner_hub:
    'Global Planner company-wide view across all projects, RFIs, FARs, change orders, deadlines, and schedule risks.',
  arden_calc_in_estimator: 'Arden Calc inside the estimator activity modal.',
  model_3d_takeoff: 'Upload and view 3D models, select objects, and map manual takeoff into Detailed Estimates.',
  model_3d_extraction: 'Advanced BIM extraction, model version comparison, and client 3D viewer (Business).',
};

export interface SubscriptionEntitlementInput {
  planId: PlanId;
  status?: string | null;
  activeProjectLimit?: number | null;
  includedFieldSeats?: number | null;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function shouldEnforcePlanLimits(): boolean {
  if (!import.meta.env.DEV) return true;
  return import.meta.env.VITE_ENFORCE_PLAN === 'true';
}

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return PLAN_FEATURES[plan].has(feature);
}

export function hasThreeDTakeoffCapability(
  plan: PlanId,
  capability: ThreeDTakeoffCapability,
): boolean {
  return THREE_D_TAKEOFF_ENTITLEMENTS[capability].includes(plan);
}

export function canUseThreeDTakeoffCapability(
  plan: PlanId | null | undefined,
  capability: ThreeDTakeoffCapability,
): boolean {
  if (!shouldEnforcePlanLimits()) return true;
  if (!plan) return false;
  return hasThreeDTakeoffCapability(plan, capability);
}

export function getPlanLimit(plan: PlanId, key: LimitKey): number {
  return PLAN_LIMITS[plan][key];
}

export function canUseFeature(
  plan: PlanId | null | undefined,
  feature: FeatureKey,
): boolean {
  if (!shouldEnforcePlanLimits()) return true;
  if (!plan) return false;
  return hasFeature(plan, feature);
}

export function resolvePlanLimit(
  plan: PlanId,
  key: LimitKey,
  override?: number | null,
): number {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return override;
  }
  return getPlanLimit(plan, key);
}

export function canCreateProject(
  plan: PlanId | null | undefined,
  activeCount: number,
  activeProjectLimit?: number | null,
): boolean {
  if (!shouldEnforcePlanLimits()) return true;
  if (!plan) return false;
  const limit = resolvePlanLimit(plan, 'max_active_projects', activeProjectLimit);
  if (limit < 0) return true;
  return activeCount < limit;
}

export function canInviteFieldSeat(
  plan: PlanId | null | undefined,
  currentCount: number,
  includedFieldSeats?: number | null,
): boolean {
  if (!shouldEnforcePlanLimits()) return true;
  if (!plan) return false;
  const maxSeats = resolvePlanLimit(plan, 'max_field_seats', null);
  if (maxSeats >= 0) {
    return currentCount < maxSeats;
  }
  void includedFieldSeats;
  return true;
}

/** Whether the owner can send another team/field invite (feature + included seat limit). */
export function canInviteTeamMember(
  plan: PlanId | null | undefined,
  seatUsageCount: number,
  includedFieldSeats?: number | null,
): boolean {
  if (!shouldEnforcePlanLimits()) return true;
  if (!plan) return false;
  if (!hasFeature(plan, 'employee_portal')) return false;
  const seatLimit = resolvePlanLimit(plan, 'included_field_seats', includedFieldSeats);
  if (seatLimit < 0) return true;
  return seatUsageCount < seatLimit;
}

export function minPlanForFeature(feature: FeatureKey): PlanId {
  for (const plan of PLAN_ORDER) {
    if (hasFeature(plan, feature)) return plan;
  }
  return 'business';
}

export function isSubscriptionStatusActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status);
}

export function resolveEffectivePlan(
  row: SubscriptionEntitlementInput | null | undefined,
): PlanId {
  if (!row) return 'free';
  if (!isSubscriptionStatusActive(row.status)) return 'free';
  return row.planId;
}

/** Human-readable upgrade prompt when the user hits their active-project limit. */
export function projectLimitUpgradeMessage(plan: PlanId): string {
  switch (plan) {
    case 'free':
      return 'Free includes 1 active project. Upgrade to Starter for 3 projects or Professional for 10.';
    case 'starter':
      return 'Starter includes 3 active projects. Upgrade to Professional for 10.';
    case 'professional':
      return 'Professional includes 10 active projects. Upgrade to Business for unlimited projects.';
    case 'business':
      return 'You have reached your active project limit.';
  }
}

export function getEffectiveLimits(
  plan: PlanId,
  overrides?: Pick<SubscriptionEntitlementInput, 'activeProjectLimit' | 'includedFieldSeats'>,
): Record<LimitKey, number> {
  return {
    max_active_projects: resolvePlanLimit(plan, 'max_active_projects', overrides?.activeProjectLimit),
    included_field_seats: resolvePlanLimit(
      plan,
      'included_field_seats',
      overrides?.includedFieldSeats,
    ),
    max_field_seats: getPlanLimit(plan, 'max_field_seats'),
    ai_requests_monthly: getPlanLimit(plan, 'ai_requests_monthly'),
    level_three_exports_monthly: getPlanLimit(plan, 'level_three_exports_monthly'),
  };
}
