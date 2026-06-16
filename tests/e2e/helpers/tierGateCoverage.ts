import type { PlanId } from '../../../src/lib/entitlements';
import {
  EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS,
  OVER_LIMIT_SEED_NOTE,
  type TierFixture,
} from './tierGateFixtures';

export { OVER_LIMIT_SEED_NOTE };

/** Canonical gate features shown in qa-reports/tier-gates/latest.md */
export const COVERAGE_FEATURES = [
  'profile badge',
  'billing page plan/status',
  'active project count',
  'new project creation gate',
  'employee/team invite gate',
  'client portal gate',
  'quick estimate gate',
  'detailed estimate gate',
  'Logic Network / CPM gate',
  'RFIs',
  'FARs',
  'QC',
  'change orders',
  'accounting/tax exports',
  'dashboard widget catalog locked widgets',
  'past_due paid access blocked',
  'canceled paid access blocked',
] as const;

export type CoverageFeature = (typeof COVERAGE_FEATURES)[number];

/** Playwright test title → coverage feature label */
export const TEST_TITLE_TO_FEATURE: Record<string, CoverageFeature> = {
  'profile badge shows expected plan label': 'profile badge',
  'billing page shows expected plan and status': 'billing page plan/status',
  'active project count shows seeded over-limit state': 'active project count',
  'new project creation blocked when at or over plan limit': 'new project creation gate',
  'employee invite gate matches tier': 'employee/team invite gate',
  'client portal gate matches tier': 'client portal gate',
  'quick estimate gate matches tier': 'quick estimate gate',
  'detailed estimate gate matches tier': 'detailed estimate gate',
  'logic network gate matches tier': 'Logic Network / CPM gate',
  'RFIs gate matches tier': 'RFIs',
  'FARs gate matches tier': 'FARs',
  'QC gate matches tier': 'QC',
  'change orders gate matches tier': 'change orders',
  'accounting exports gate matches tier': 'accounting/tax exports',
  'dashboard widget catalog locked widgets match tier': 'dashboard widget catalog locked widgets',
  'past_due paid access is blocked': 'past_due paid access blocked',
  'canceled paid access is blocked': 'canceled paid access blocked',
};

export function featureFromTestTitle(title: string): CoverageFeature | string {
  return TEST_TITLE_TO_FEATURE[title] ?? title;
}

export function expectedForFeature(tier: TierFixture, feature: CoverageFeature): string {
  switch (feature) {
    case 'profile badge':
      return tier.profileBadgeLabel;
    case 'billing page plan/status':
      return `${tier.billingPlanLabel} / ${tier.billingStatusLabel}`;
    case 'active project count': {
      const count = EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS[tier.tierId];
      return tier.tierId === 'business' ? `>= ${count} visible in Active tab` : `${count} visible in Active tab`;
    }
    case 'new project creation gate':
      if (tier.tierId === 'business') return 'New Project allowed (unlimited plan)';
      if (tier.tierId === 'pastdue' || tier.tierId === 'canceled') {
        return 'Blocked at plan limit (effective Free entitlements)';
      }
      return 'Blocked — seeded over plan limit; existing projects remain visible';
    case 'employee/team invite gate':
      return tier.hasEmployeePortal ? 'Invite card visible' : 'Upgrade required (employee_portal)';
    case 'client portal gate':
      return tier.hasClientPortal ? 'Client portal actions available' : 'Client portal upgrade gate shown';
    case 'quick estimate gate':
      return tier.hasQuickEstimate ? 'Quick Estimate widget unlocked' : 'Quick Estimate locked';
    case 'detailed estimate gate':
      return tier.hasDetailedEstimate ? 'Detailed estimate available' : 'Upgrade or choose-type empty state';
    case 'Logic Network / CPM gate':
      return tier.hasLogicNetwork ? 'Logic Network tab usable' : 'Upgrade required (logic_network)';
    case 'RFIs':
      return tier.hasRfisFarsQc ? 'Seeded QA RFI visible on /planner/rfis' : 'No Professional RFI access';
    case 'FARs':
      return tier.hasRfisFarsQc ? 'Seeded QA FAR visible on /planner/fars' : 'No Professional FAR access';
    case 'QC':
      return tier.hasRfisFarsQc ? 'QC Due widget unlocked in catalog' : 'QC Due widget locked (Professional+)';
    case 'change orders':
      return tier.hasChangeOrders ? 'Change orders page accessible' : 'Upgrade required (change_orders)';
    case 'accounting/tax exports':
      return tier.hasAccountingExports ? 'Accounting & Tax page accessible' : 'Upgrade required (accounting_exports)';
    case 'dashboard widget catalog locked widgets':
      return 'Plan-locked widgets show Upgrade required in catalog';
    case 'past_due paid access blocked':
      return tier.tierId === 'pastdue'
        ? 'Professional UI blocked — effective plan Free'
        : 'N/A (pastdue harness user only)';
    case 'canceled paid access blocked':
      return tier.tierId === 'canceled'
        ? 'Professional UI blocked — effective plan Free'
        : 'N/A (canceled harness user only)';
    default:
      return 'pass';
  }
}

export function effectivePlanLabel(plan: PlanId): string {
  return plan;
}
