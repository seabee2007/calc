import path from 'node:path';
import type { PlanId } from '../../../src/lib/entitlements';

export type TierGateId = PlanId | 'pastdue' | 'canceled';

export interface TierFixture {
  tierId: TierGateId;
  email: string;
  /** Entitlements resolve from subscription status + plan id */
  effectivePlan: PlanId;
  maxProjects: number;
  fieldSeats: number;
  profileBadgeLabel: string;
  billingPlanLabel: string;
  billingStatusLabel: string;
  hasEmployeePortal: boolean;
  hasClientPortal: boolean;
  hasQuickEstimate: boolean;
  hasDetailedEstimate: boolean;
  hasLogicNetwork: boolean;
  hasChangeOrders: boolean;
  hasRfisFarsQc: boolean;
  hasAccountingExports: boolean;
}

export const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? 'Password123!';

export const QA_MANIFEST_PATH = path.join(process.cwd(), 'scripts', 'qa', 'shared', '.qa-manifest.json');

/** Visible active-folder project cards after qa:seed-gates (intentionally over plan limits). */
export const EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS: Record<TierGateId, number> = {
  free: 2,
  starter: 4,
  professional: 11,
  business: 12,
  pastdue: 1,
  canceled: 1,
};

export const OVER_LIMIT_SEED_NOTE =
  'Over-limit seeded project counts are intentional. Existing projects should remain visible; additional project creation should be blocked.';

/** All QA auth users — setup saves storageState for each. */
export const AUTH_USERS = [
  { email: 'qa-free@arden.test', plan: 'free' as TierGateId },
  { email: 'qa-starter@arden.test', plan: 'starter' as TierGateId },
  { email: 'qa-professional@arden.test', plan: 'professional' as TierGateId },
  { email: 'qa-business@arden.test', plan: 'business' as TierGateId },
  { email: 'qa-pastdue@arden.test', plan: 'pastdue' as TierGateId },
  { email: 'qa-canceled@arden.test', plan: 'canceled' as TierGateId },
] as const;

export const GATE_TIERS: TierFixture[] = [
  {
    tierId: 'free',
    email: 'qa-free@arden.test',
    effectivePlan: 'free',
    maxProjects: 1,
    fieldSeats: 0,
    profileBadgeLabel: 'Free',
    billingPlanLabel: 'Free',
    billingStatusLabel: 'No active subscription',
    hasEmployeePortal: false,
    hasClientPortal: false,
    hasQuickEstimate: true,
    hasDetailedEstimate: false,
    hasLogicNetwork: false,
    hasChangeOrders: false,
    hasRfisFarsQc: false,
    hasAccountingExports: false,
  },
  {
    tierId: 'starter',
    email: 'qa-starter@arden.test',
    effectivePlan: 'starter',
    maxProjects: 3,
    fieldSeats: 1,
    profileBadgeLabel: 'Starter plan',
    billingPlanLabel: 'Starter plan',
    billingStatusLabel: 'Active',
    hasEmployeePortal: true,
    hasClientPortal: false,
    hasQuickEstimate: true,
    hasDetailedEstimate: false,
    hasLogicNetwork: false,
    hasChangeOrders: false,
    hasRfisFarsQc: false,
    hasAccountingExports: false,
  },
  {
    tierId: 'professional',
    email: 'qa-professional@arden.test',
    effectivePlan: 'professional',
    maxProjects: 10,
    fieldSeats: 5,
    profileBadgeLabel: 'Professional plan',
    billingPlanLabel: 'Professional plan',
    billingStatusLabel: 'Active',
    hasEmployeePortal: true,
    hasClientPortal: true,
    hasQuickEstimate: true,
    hasDetailedEstimate: true,
    hasLogicNetwork: true,
    hasChangeOrders: true,
    hasRfisFarsQc: true,
    hasAccountingExports: false,
  },
  {
    tierId: 'business',
    email: 'qa-business@arden.test',
    effectivePlan: 'business',
    maxProjects: -1,
    fieldSeats: 15,
    profileBadgeLabel: 'Business plan',
    billingPlanLabel: 'Business plan',
    billingStatusLabel: 'Active',
    hasEmployeePortal: true,
    hasClientPortal: true,
    hasQuickEstimate: true,
    hasDetailedEstimate: true,
    hasLogicNetwork: true,
    hasChangeOrders: true,
    hasRfisFarsQc: true,
    hasAccountingExports: true,
  },
  {
    tierId: 'pastdue',
    email: 'qa-pastdue@arden.test',
    effectivePlan: 'free',
    maxProjects: 1,
    fieldSeats: 0,
    profileBadgeLabel: 'Past due',
    billingPlanLabel: 'Professional plan',
    billingStatusLabel: 'Past due',
    hasEmployeePortal: false,
    hasClientPortal: false,
    hasQuickEstimate: true,
    hasDetailedEstimate: false,
    hasLogicNetwork: false,
    hasChangeOrders: false,
    hasRfisFarsQc: false,
    hasAccountingExports: false,
  },
  {
    tierId: 'canceled',
    email: 'qa-canceled@arden.test',
    effectivePlan: 'free',
    maxProjects: 1,
    fieldSeats: 0,
    profileBadgeLabel: 'Canceled',
    billingPlanLabel: 'Professional plan',
    billingStatusLabel: 'Canceled',
    hasEmployeePortal: false,
    hasClientPortal: false,
    hasQuickEstimate: true,
    hasDetailedEstimate: false,
    hasLogicNetwork: false,
    hasChangeOrders: false,
    hasRfisFarsQc: false,
    hasAccountingExports: false,
  },
];

/** @deprecated Use GATE_TIERS */
export const TIERS = GATE_TIERS;

export interface QaManifest {
  seedId: string;
  createdAt: string;
  users: Record<
    string,
    {
      id: string;
      email: string;
      plan: string;
      projectIds: string[];
      primaryProjectId: string | null;
    }
  >;
}
