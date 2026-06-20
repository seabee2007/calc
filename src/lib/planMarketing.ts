import manifest from '../../shared/pricing-manifest.json';
import type { PlanId } from './entitlements';
import {
  getPlanLimit,
  PLAN_DISPLAY_NAMES,
  PLAN_ORDER,
} from './entitlements';

export function formatPlanLimitLabel(value: number, noun: string): string {
  if (value < 0) return `Unlimited ${noun}`;
  return `Up to ${value} ${noun}`;
}

export interface PlanPricing {
  monthlyUsd: number;
  annualMonthlyUsd: number;
  annualTotalUsd: number;
}

const MARKETABLE_FEATURE_LABELS: Record<string, string> = {
  quick_estimates: 'Quick ballpark estimates',
  conceptual_estimates: 'Conceptual estimates with scenarios',
  calculators: 'Standalone calculators and field tools',
  resources: 'Resources hub for estimating references',
  proposals: 'Proposal creation workflow',
  activity_based_estimating: 'Activity-based estimating',
  arden_calc_in_estimator: 'Arden Calc inside the estimator',
  employee_portal: 'Employee field portal for assigned project work',
  rfis: 'RFI workflow',
  fars: 'Field Adjustment Request workflow',
  qc: 'Quality control inspections',
  change_orders: 'Change order scope and pricing',
  logic_network: 'Logic Network for schedule dependencies',
  cpm: 'Critical path method scheduling',
  level_three_gantt: 'Level III Gantt workspace',
  level_three_gantt_export: 'Level III Gantt PDF and Excel exports',
  accounting_exports: 'Accounting and tax exports',
  financial_dashboard: 'Financial dashboards',
  ai_concrete_chat: 'Concrete Chat AI assistant',
  ai_scope_summary: 'AI scope summary tools',
  ai_labor_crew_review: 'AI labor and crew review',
  ai_batch_plant_tools: 'AI batch plant pricing tools',
  global_planner_hub: 'Global Planner portfolio hub',
};

const NON_MARKETABLE = new Set(manifest.nonMarketableFeatureKeys);

export function getPlanPricing(planId: PlanId): PlanPricing {
  if (planId === 'free') {
    return { monthlyUsd: 0, annualMonthlyUsd: 0, annualTotalUsd: 0 };
  }
  const entry = manifest.plans.find((plan) => plan.planId === planId);
  if (!entry) throw new Error(`Unknown paid plan: ${planId}`);
  return {
    monthlyUsd: entry.monthlyPriceUsd,
    annualMonthlyUsd: entry.annualMonthlyUsd,
    annualTotalUsd: entry.annualTotalUsd,
  };
}

/** @deprecated Use getPlanPricing(planId) — kept for existing imports. */
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  free: getPlanPricing('free'),
  starter: getPlanPricing('starter'),
  professional: getPlanPricing('professional'),
  business: getPlanPricing('business'),
};

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function getAnnualSavings(planId: PlanId): { annualSavingsUsd: number; annualSavingsPercent: number } {
  const pricing = getPlanPricing(planId);
  const fullYearMonthly = pricing.monthlyUsd * 12;
  const annualSavingsUsd = fullYearMonthly - pricing.annualTotalUsd;
  const annualSavingsPercent =
    fullYearMonthly > 0 ? Math.round((annualSavingsUsd / fullYearMonthly) * 100) : 0;
  return { annualSavingsUsd, annualSavingsPercent };
}

export function getMaxAnnualSavingsPercent(): number {
  return Math.max(...PLAN_ORDER.map((planId) => getAnnualSavings(planId).annualSavingsPercent));
}

export interface PlanMarketingCard {
  planId: PlanId;
  shortName: string;
  longName: string;
  audience: string;
  highlights: string[];
  usageSummary: string;
  pricing: PlanPricing;
  recommended?: boolean;
}

function buildHighlights(planId: PlanId): { highlights: string[]; usageSummary: string; audience: string; recommended: boolean } {
  const manifestPlan = manifest.plans.find((plan) => plan.planId === planId);
  if (!manifestPlan) {
    return { highlights: [], usageSummary: '', audience: '', recommended: false };
  }

  const maxProjects = getPlanLimit(planId, 'max_active_projects');
  const fieldSeats = manifestPlan.includedFieldSeats;
  const limitBullets = [
    formatPlanLimitLabel(maxProjects, maxProjects === 1 ? 'active project' : 'active projects'),
    `${fieldSeats} field seat${fieldSeats === 1 ? '' : 's'} included`,
  ];

  const featureBullets = manifestPlan.marketableFeatureKeys
    .filter((key) => !NON_MARKETABLE.has(key))
    .map((key) => MARKETABLE_FEATURE_LABELS[key])
    .filter(Boolean);

  return {
    highlights: [...limitBullets, ...featureBullets].slice(0, 7),
    usageSummary: manifestPlan.usageSummary,
    audience: manifestPlan.audience,
    recommended: manifestPlan.recommended,
  };
}

export function getPlanMarketingCards(): PlanMarketingCard[] {
  return PLAN_ORDER.map((planId) => {
    const names = PLAN_DISPLAY_NAMES[planId];
    const { highlights, usageSummary, audience, recommended } = buildHighlights(planId);

    return {
      planId,
      shortName: names.short,
      longName: names.long,
      audience,
      highlights,
      usageSummary,
      pricing: getPlanPricing(planId),
      recommended,
    };
  });
}

export function getPlanRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}

export function planHasConfiguredTrial(): boolean {
  return manifest.trial.hasTrial === true && typeof manifest.trial.trialDays === 'number';
}
