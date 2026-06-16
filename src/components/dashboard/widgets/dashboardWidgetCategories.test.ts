import { describe, expect, it } from 'vitest';
import {
  canAccessWidget,
  isPlanSufficient,
  requiredPlanForWidget,
  widgetCategoryIcon,
} from './dashboardWidgetCategories';
import { DASHBOARD_CARD_META } from '../../../lib/dashboardLayout';
import { canUseFeature } from '../../../lib/entitlements';

describe('isPlanSufficient', () => {
  it('treats an absent requirement as always sufficient', () => {
    expect(isPlanSufficient('free', undefined)).toBe(true);
  });

  it('allows equal or higher plans', () => {
    expect(isPlanSufficient('professional', 'professional')).toBe(true);
    expect(isPlanSufficient('business', 'professional')).toBe(true);
  });

  it('blocks lower plans', () => {
    expect(isPlanSufficient('free', 'professional')).toBe(false);
    expect(isPlanSufficient('starter', 'professional')).toBe(false);
  });
});

describe('requiredPlanForWidget', () => {
  it('derives plan from requiredFeature when requiredPlan is absent', () => {
    expect(requiredPlanForWidget(DASHBOARD_CARD_META.accountingTaxLauncher)).toBe('business');
    expect(requiredPlanForWidget(DASHBOARD_CARD_META.newProposalShortcut)).toBe('starter');
  });
});

describe('canAccessWidget', () => {
  const ctx = (plan: 'free' | 'business', isOwner = true) => ({
    plan,
    isOwner,
    hasFeature: (feature: Parameters<typeof canUseFeature>[1]) => canUseFeature(plan, feature),
  });

  it('allows free users to add Arden Calc', () => {
    expect(canAccessWidget(DASHBOARD_CARD_META.ardenCalc, ctx('free'))).toBe(true);
  });

  it('blocks Accounting & Tax for free users', () => {
    expect(canAccessWidget(DASHBOARD_CARD_META.accountingTaxLauncher, ctx('free'))).toBe(false);
  });

  it('allows business users to add Accounting & Tax', () => {
    expect(canAccessWidget(DASHBOARD_CARD_META.accountingTaxLauncher, ctx('business'))).toBe(true);
  });
});

describe('widgetCategoryIcon', () => {
  it('returns an icon component for each category', () => {
    expect(widgetCategoryIcon('Operations')).toBeTypeOf('object');
    expect(widgetCategoryIcon('Risk / QC')).toBeTypeOf('object');
    expect(widgetCategoryIcon('Tools / Calculators')).toBeTypeOf('object');
    expect(widgetCategoryIcon('Admin / Business')).toBeTypeOf('object');
  });
});
