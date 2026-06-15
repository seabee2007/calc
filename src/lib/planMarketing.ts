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

export interface PlanMarketingCard {
  planId: PlanId;
  shortName: string;
  longName: string;
  highlights: string[];
}

export function getPlanMarketingCards(): PlanMarketingCard[] {
  return PLAN_ORDER.map((planId) => {
    const names = PLAN_DISPLAY_NAMES[planId];
    const maxProjects = getPlanLimit(planId, 'max_active_projects');
    const fieldSeats = getPlanLimit(planId, 'included_field_seats');

    const highlights: Record<PlanId, string[]> = {
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
      highlights: highlights[planId],
    };
  });
}

export function getPlanRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId);
}
