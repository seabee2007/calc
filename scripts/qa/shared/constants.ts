export const QA_SEED_ID = 'tier-gate-harness-v1';

export const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? 'Password123!';

export const CURRENT_TERMS_VERSION = '2026-06-12';
export const CURRENT_PRIVACY_VERSION = '2026-06-12';
export const CURRENT_ONBOARDING_VERSION = '2025-01';

export const QA_USER_SPECS = [
  {
    email: 'qa-free@arden.test',
    plan: 'free' as const,
    subscription: null,
    activeProjectCount: 2,
    archivedProjectCount: 0,
    inviteCount: 0,
    seedProData: false,
    seedBizData: false,
  },
  {
    email: 'qa-starter@arden.test',
    plan: 'starter' as const,
    subscription: {
      plan_id: 'starter',
      status: 'active',
      stripe_subscription_id: 'sub_qa_starter',
      stripe_customer_id: 'cus_qa_starter',
    },
    activeProjectCount: 4,
    archivedProjectCount: 0,
    inviteCount: 1,
    seedProData: false,
    seedBizData: false,
  },
  {
    email: 'qa-professional@arden.test',
    plan: 'professional' as const,
    subscription: {
      plan_id: 'professional',
      status: 'active',
      stripe_subscription_id: 'sub_qa_professional',
      stripe_customer_id: 'cus_qa_professional',
    },
    activeProjectCount: 11,
    archivedProjectCount: 0,
    inviteCount: 5,
    seedProData: true,
    seedBizData: false,
  },
  {
    email: 'qa-business@arden.test',
    plan: 'business' as const,
    subscription: {
      plan_id: 'business',
      status: 'active',
      stripe_subscription_id: 'sub_qa_business',
      stripe_customer_id: 'cus_qa_business',
    },
    activeProjectCount: 12,
    archivedProjectCount: 0,
    inviteCount: 15,
    seedProData: true,
    seedBizData: true,
  },
  {
    email: 'qa-pastdue@arden.test',
    plan: 'professional' as const,
    subscription: {
      plan_id: 'professional',
      status: 'past_due',
      stripe_subscription_id: 'sub_qa_pastdue',
      stripe_customer_id: 'cus_qa_pastdue',
    },
    activeProjectCount: 1,
    archivedProjectCount: 0,
    inviteCount: 0,
    seedProData: false,
    seedBizData: false,
  },
  {
    email: 'qa-canceled@arden.test',
    plan: 'professional' as const,
    subscription: {
      plan_id: 'professional',
      status: 'canceled',
      stripe_subscription_id: 'sub_qa_canceled',
      stripe_customer_id: 'cus_qa_canceled',
    },
    activeProjectCount: 1,
    archivedProjectCount: 0,
    inviteCount: 0,
    seedProData: false,
    seedBizData: false,
  },
] as const;

export const MANIFEST_PATH = new URL('./.qa-manifest.json', import.meta.url);

export interface QaManifestUser {
  id: string;
  email: string;
  plan: string;
  projectIds: string[];
  primaryProjectId: string | null;
}

export interface QaManifest {
  seedId: string;
  createdAt: string;
  users: Record<string, QaManifestUser>;
}
