import { describe, expect, it } from 'vitest';
import { DASHBOARD_CARD_META } from '../../../lib/dashboardLayout';
import {
  buildBillingUpgradeUrl,
  DASHBOARD_CUSTOMIZE_RETURN_PATH,
  getLockedWidgetExplanation,
  getRequiredUpgradePlan,
  getUpgradeButtonLabel,
} from './dashboardWidgetUpgrade';

describe('dashboardWidgetUpgrade', () => {
  it('getRequiredUpgradePlan returns starter for Weather Forecast', () => {
    expect(getRequiredUpgradePlan(DASHBOARD_CARD_META.weatherForecast)).toBe('starter');
  });

  it('getRequiredUpgradePlan returns business for Accounting & Tax', () => {
    expect(getRequiredUpgradePlan(DASHBOARD_CARD_META.accountingTaxLauncher)).toBe('business');
  });

  it('getUpgradeButtonLabel uses plan-specific copy', () => {
    expect(getUpgradeButtonLabel('starter')).toBe('Upgrade to Starter');
    expect(getUpgradeButtonLabel('professional')).toBe('Upgrade to Professional');
    expect(getUpgradeButtonLabel('business')).toBe('Upgrade to Business');
  });

  it('getLockedWidgetExplanation describes the required plan', () => {
    expect(getLockedWidgetExplanation('starter')).toMatch(/Starter required/i);
  });

  it('buildBillingUpgradeUrl includes upgrade and returnTo params', () => {
    const url = buildBillingUpgradeUrl('starter');
    expect(url).toContain('upgrade=starter');
    expect(url).toContain(`returnTo=${encodeURIComponent(DASHBOARD_CUSTOMIZE_RETURN_PATH)}`);
    expect(DASHBOARD_CUSTOMIZE_RETURN_PATH).toContain('customizeDashboard=1');
    expect(DASHBOARD_CUSTOMIZE_RETURN_PATH).toContain('openWidgetCatalog=1');
  });
});
