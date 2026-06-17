import { describe, expect, it } from 'vitest';
import {
  computePercentUsed,
  getUsageStateBand,
  nextUpgradePlan,
  usageStateProgressClass,
  usageUpgradeCtaLabel,
} from '../usageLabels';

describe('usageLabels', () => {
  it('maps usage units to labels', async () => {
    const { getUsageUnitLabel } = await import('../usageLabels');
    expect(getUsageUnitLabel('ai_request')).toBe('AI requests');
    expect(getUsageUnitLabel('email_send')).toBe('Email sends');
  });

  it('computes percent used with zero-limit as blocked', () => {
    expect(computePercentUsed(0, 0)).toBe(100);
    expect(computePercentUsed(5, 10)).toBe(50);
  });

  it('assigns state bands by threshold', () => {
    expect(getUsageStateBand(50, 100)).toBe('normal');
    expect(getUsageStateBand(75, 100)).toBe('caution');
    expect(getUsageStateBand(92, 100)).toBe('warning');
    expect(getUsageStateBand(100, 100)).toBe('blocked');
    expect(getUsageStateBand(0, 0)).toBe('blocked');
  });

  it('returns progress classes for warning and blocked states', () => {
    expect(usageStateProgressClass('warning')).toContain('amber');
    expect(usageStateProgressClass('blocked')).toContain('red');
  });

  it('suggests the next upgrade plan', () => {
    expect(nextUpgradePlan('free')).toBe('starter');
    expect(nextUpgradePlan('starter')).toBe('professional');
    expect(nextUpgradePlan('professional')).toBe('business');
    expect(nextUpgradePlan('business')).toBeNull();
  });

  it('uses "Upgrade plan" for free users', () => {
    expect(usageUpgradeCtaLabel('free')).toBe('Upgrade plan');
  });

  it('uses plan-specific labels for paid upgrade paths', () => {
    expect(usageUpgradeCtaLabel('starter')).toContain('Professional');
    expect(usageUpgradeCtaLabel('professional')).toContain('Business');
  });
});
