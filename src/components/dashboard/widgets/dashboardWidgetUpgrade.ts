import type { DashboardCardId, DashboardCardMeta } from '../../../lib/dashboardLayout';
import type { PlanId } from '../../../lib/entitlements';
import { PLAN_DISPLAY_NAMES } from '../../../lib/entitlements';
import { requiredPlanForWidget } from './dashboardWidgetCategories';

/** Query string fragment to restore customize + catalog after billing. */
export const DASHBOARD_CUSTOMIZE_RETURN_SEARCH =
  'customizeDashboard=1&openWidgetCatalog=1&checkout=success';

/** Return path after widget-catalog upgrade (Operations Dashboard lives at `/`). */
export const DASHBOARD_CUSTOMIZE_RETURN_PATH = `/?${DASHBOARD_CUSTOMIZE_RETURN_SEARCH}`;

const PAID_PLANS = new Set<PlanId>(['starter', 'professional', 'business']);

/** Paid plan required to unlock a widget, if any. */
export function getRequiredUpgradePlan(
  meta: Pick<DashboardCardMeta, 'requiredPlan' | 'requiredFeature'>,
): PlanId | undefined {
  const plan = requiredPlanForWidget(meta);
  if (!plan || !PAID_PLANS.has(plan)) return undefined;
  return plan;
}

export function getUpgradeButtonLabel(requiredPlan: PlanId): string {
  return `Upgrade to ${PLAN_DISPLAY_NAMES[requiredPlan].short}`;
}

export function getLockedWidgetExplanation(requiredPlan: PlanId): string {
  return `${PLAN_DISPLAY_NAMES[requiredPlan].short} required to add this widget.`;
}

export function buildBillingUpgradeUrl(requiredPlan: PlanId): string {
  const params = new URLSearchParams({
    upgrade: requiredPlan,
    returnTo: DASHBOARD_CUSTOMIZE_RETURN_PATH,
  });
  return `/settings/billing?${params.toString()}`;
}

export interface DashboardWidgetUpgradeTarget {
  widgetId: DashboardCardId;
  requiredPlan: PlanId;
}
