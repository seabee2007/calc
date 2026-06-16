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
  annualMonthlyUsd: number; // effective per-month when billed annually
  annualTotalUsd: number;   // charged once per year
}

/**
 * Pricing displayed on the billing page.
 * Kept here as a single source of truth so no component hardcodes dollar amounts.
 */
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  free:         { monthlyUsd: 0,   annualMonthlyUsd: 0,   annualTotalUsd: 0    },
  starter:      { monthlyUsd: 49,  annualMonthlyUsd: 41,  annualTotalUsd: 490  },
  professional: { monthlyUsd: 129, annualMonthlyUsd: 109, annualTotalUsd: 1308 },
  business:     { monthlyUsd: 249, annualMonthlyUsd: 209, annualTotalUsd: 2508 },
};

export function formatUsd(cents: number): string {
  return `$${cents.toLocaleString('en-US')}`;
}

export interface PlanMarketingCard {
  planId: PlanId;
  shortName: string;
  longName: string;
  highlights: string[];
  pricing: PlanPricing;
  /** Card to visually highlight as recommended. */
  recommended?: boolean;
}

export function getPlanMarketingCards(): PlanMarketingCard[] {
  return PLAN_ORDER.map((planId) => {
    const names = PLAN_DISPLAY_NAMES[planId];
    const maxProjects = getPlanLimit(planId, 'max_active_projects');
    const fieldSeats = getPlanLimit(planId, 'included_field_seats');

    const highlights: Partial<Record<PlanId, string[]>> = {
      starter: [
        formatPlanLimitLabel(maxProjects, 'active projects'),
        formatPlanLimitLabel(fieldSeats, 'field seat'),
        'Quick and conceptual estimates',
        'Standalone calculators and resources hub',
        'Basic proposal creation',
      ],
      professional: [
        'Everything in Starter',
        formatPlanLimitLabel(maxProjects, 'active projects'),
        formatPlanLimitLabel(fieldSeats, 'field seats included'),
        'Activity-based estimating and Arden Calc in estimator',
        'Employee field portal, RFIs, FARs, QC, change orders',
        'Logic Network, CPM, and Level III Gantt workspace',
      ],
      business: [
        'Everything in Professional',
        formatPlanLimitLabel(maxProjects, 'active projects'),
        formatPlanLimitLabel(fieldSeats, 'field seats included'),
        'Level III Gantt PDF/Excel exports',
        'Accounting & tax exports and financial dashboards',
        'AI bundle and global planner hub',
      ],
    };

    return {
      planId,
      shortName: names.short,
      longName: names.long,
      highlights: highlights[planId] ?? [],
      pricing: PLAN_PRICING[planId],
      recommended: planId === 'professional',
    };
  });
}

export function getPlanRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}
