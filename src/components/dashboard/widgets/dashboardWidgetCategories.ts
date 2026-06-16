import {
  Activity,
  Building2,
  Calculator,
  CalendarClock,
  ClipboardCheck,
  DollarSign,
  FileText,
  FolderKanban,
  LayoutGrid,
  Sparkles,
  type LucideIcon,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type { DashboardCardMeta, DashboardWidgetCategory } from '../../../lib/dashboardLayout';
import { minPlanForFeature, type FeatureKey, type PlanId } from '../../../lib/entitlements';

/**
 * Catalog filter chips. "All" plus a curated subset of categories so the filter
 * row stays compact; tiles still carry their full category pill.
 */
export const WIDGET_CATALOG_FILTERS: { id: 'all' | DashboardWidgetCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Projects', label: 'Projects' },
  { id: 'Estimating', label: 'Estimating' },
  { id: 'Financial', label: 'Financial' },
  { id: 'Proposals', label: 'Proposals' },
  { id: 'Scheduling', label: 'Scheduling' },
  { id: 'Field / Crew', label: 'Field' },
  { id: 'Risk / QC', label: 'Risk / QC' },
  { id: 'Weather / Placement', label: 'Placement' },
  { id: 'Shortcuts', label: 'Shortcuts' },
  { id: 'Tools / Calculators', label: 'Tools' },
  { id: 'Admin / Business', label: 'Admin' },
];

export const WIDGET_CATEGORY_ICONS: Record<DashboardWidgetCategory, LucideIcon> = {
  Operations: Activity,
  Projects: FolderKanban,
  Estimating: Calculator,
  Scheduling: CalendarClock,
  Financial: DollarSign,
  Proposals: FileText,
  'Field / Crew': Activity,
  'Risk / QC': ShieldAlert,
  'Weather / Placement': ClipboardCheck,
  'Client / Approvals': UserCheck,
  Documents: FileText,
  Team: Users,
  'Tools / Calculators': Wrench,
  Shortcuts: Sparkles,
  'Admin / Business': Building2,
};

export function widgetCategoryIcon(category: DashboardWidgetCategory): LucideIcon {
  return WIDGET_CATEGORY_ICONS[category] ?? LayoutGrid;
}

/** Plan tiers in ascending order, including the implicit free tier. */
const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  business: 3,
};

/** True when `current` meets or exceeds the `required` plan tier. */
export function isPlanSufficient(current: PlanId, required: PlanId | undefined): boolean {
  if (!required) return true;
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

/** Minimum plan tier for catalog display (explicit requiredPlan or derived from feature). */
export function requiredPlanForWidget(meta: Pick<DashboardCardMeta, 'requiredPlan' | 'requiredFeature'>): PlanId | undefined {
  if (meta.requiredPlan) return meta.requiredPlan;
  if (meta.requiredFeature) return minPlanForFeature(meta.requiredFeature);
  return undefined;
}

export interface WidgetAccessContext {
  plan: PlanId;
  isOwner: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
}

/** Whether the user can add and use this widget (catalog + in-card access). */
export function canAccessWidget(
  meta: Pick<DashboardCardMeta, 'requiredPlan' | 'requiredFeature' | 'requiredRole'>,
  ctx: WidgetAccessContext,
): boolean {
  if (meta.requiredRole === 'owner' && !ctx.isOwner) return false;
  if (!isPlanSufficient(ctx.plan, meta.requiredPlan)) return false;
  if (meta.requiredFeature && !ctx.hasFeature(meta.requiredFeature)) return false;
  return true;
}
