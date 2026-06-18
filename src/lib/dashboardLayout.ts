/**
 * Pure dashboard layout model (no React/JSX imports).
 *
 * Phase 2B switched the dashboard from an ordered list (order + size) to a true
 * grid layout with x/y/w/h coordinates, so cards can be freely placed and
 * resized on a 12-column grid (driven by react-grid-layout in the UI).
 *
 * Phase 4 introduces the widget catalog. The saved layout's `items` array is the
 * source of truth for which widgets are *active* (presence === added). The
 * registry (`dashboardCardRegistry.tsx`) defines every *available* widget and
 * its metadata; `validateAndMigrateLayout` only auto-adds widgets flagged
 * `defaultVisible`, so optional catalog widgets stay available but inactive
 * until the user adds them.
 *
 * Keeping this module pure lets layout validation/migration be unit-tested
 * without pulling in component modules.
 */

import type { FeatureKey, PlanId } from './entitlements';
import { repairDashboardGridLayout } from './dashboardGridRepair';

export type DashboardCardId =
  | 'todaysOperations'
  | 'operationsSchedule'
  | 'fieldActivity'
  | 'businessSnapshot'
  | 'activeProjects'
  | 'proposalPipeline'
  | 'nextActions'
  | 'projectControls'
  | 'projectRiskReview'
  | 'placementConditions'
  | 'smartPourAssistant'
  | 'concreteDeliverySchedule'
  // Phase 4 optional catalog widgets (not default-visible):
  | 'quickActions'
  | 'projectsNeedingEstimate'
  | 'proposalsFollowUp'
  | 'qcDue'
  // Phase 5A tool/shortcut catalog widgets:
  | 'ardenCalc'
  | 'quickEstimateLauncher'
  | 'newProjectShortcut'
  | 'newProposalShortcut'
  | 'plannerHubShortcut'
  | 'scheduleShortcut'
  | 'accountingTaxLauncher'
  | 'supportHelp'
  | 'weatherForecast'
  | 'usageMeter';

/** The dashboard grid is a 12-column grid on desktop. */
export const DASHBOARD_GRID_COLS = 12;

/** Widget categories used to group/filter the catalog. */
export const DASHBOARD_WIDGET_CATEGORIES = [
  'Operations',
  'Projects',
  'Estimating',
  'Scheduling',
  'Financial',
  'Proposals',
  'Field / Crew',
  'Risk / QC',
  'Weather / Placement',
  'Client / Approvals',
  'Documents',
  'Team',
  'Tools / Calculators',
  'Shortcuts',
  'Admin / Business',
] as const;

export type DashboardWidgetCategory = (typeof DASHBOARD_WIDGET_CATEGORIES)[number];

/** Role gating for a widget. `any` = available to all roles. */
export type DashboardWidgetRole = 'owner' | 'employee' | 'any';

/** Named widths (in grid columns) used by the size controls. */
export type DashboardCardSizeName = 'full' | 'twoThirds' | 'half' | 'third';

export const SIZE_TO_WIDTH: Record<DashboardCardSizeName, number> = {
  full: 12,
  twoThirds: 8,
  half: 6,
  third: 4,
};

export interface DashboardCardGridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardCardMeta {
  id: DashboardCardId;
  title: string;
  /** One-line catalog description (no sensitive counts). */
  description: string;
  category: DashboardWidgetCategory;
  /** Optional one-line description shown under the title in the card header. */
  subtitle?: string;
  /** Default position/size on the 12-column grid. `h` is an initial guess; the
   * grid measures real content height at runtime and overrides it. */
  default: DashboardCardGridRect;
  minW: number;
  minH: number;
  /** Widths offered by the size controls (in grid columns). */
  allowedWidths: number[];
  /** Whether this widget is part of the factory-default dashboard. Optional
   * catalog widgets are `false`: available but inactive until added. */
  defaultVisible: boolean;
  /** Minimum plan required to add/render this widget (omit = available on any plan). */
  requiredPlan?: PlanId;
  /** Entitlement feature required to add/render this widget. Plan pill derives from
   * `requiredPlan ?? minPlanForFeature(requiredFeature)` when set. */
  requiredFeature?: FeatureKey;
  /** Role required to add/render this widget. */
  requiredRole?: DashboardWidgetRole;
}

const FULL_ONLY: number[] = [12];
const ALL_WIDTHS: number[] = [12, 8, 6, 4];

/**
 * Default layout reading order (default-visible widgets):
 *  1. Today's Operations
 *  2. Schedule & Deadlines
 *  3. Business Snapshot
 *  4. Field Activity
 *  5. Active Projects | Proposal Pipeline (Next Actions under pipeline)
 *  6. Project Controls | Project Risk Review
 *  7. concrete-only cards at the bottom
 *
 * Optional catalog widgets carry `defaultVisible: false` and a high default `y`
 * so they pack below existing cards when added.
 *
 * `y` values are spaced out; the grid uses vertical compaction so the gaps pack
 * away and column heights stay tidy regardless of measured card heights.
 */
export const DASHBOARD_CARD_META: Record<DashboardCardId, DashboardCardMeta> = {
  todaysOperations: {
    id: 'todaysOperations',
    title: "Today's Operations",
    description: 'Key counts and quick actions for the day.',
    category: 'Operations',
    default: { x: 0, y: 0, w: 12, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  operationsSchedule: {
    id: 'operationsSchedule',
    title: 'Schedule & Deadlines',
    description: "Today's calendar plus upcoming deadlines and milestones.",
    category: 'Scheduling',
    default: { x: 0, y: 3, w: 12, h: 4 },
    minW: 4,
    minH: 4,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
    requiredRole: 'owner',
  },
  businessSnapshot: {
    id: 'businessSnapshot',
    title: 'Business Snapshot',
    description: 'Revenue, profit, and pipeline at a glance.',
    category: 'Financial',
    default: { x: 0, y: 7, w: 12, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  fieldActivity: {
    id: 'fieldActivity',
    title: 'Field Activity',
    description: 'Recent updates from the field and crews.',
    category: 'Field / Crew',
    default: { x: 0, y: 10, w: 12, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
    requiredRole: 'owner',
  },
  activeProjects: {
    id: 'activeProjects',
    title: 'Active Projects',
    description: 'Open projects with their next recommended action.',
    category: 'Projects',
    // `h` is an initial guess only; the grid measures real content height at
    // runtime (compact when empty, taller when the project list is populated).
    default: { x: 0, y: 13, w: 6, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  proposalPipeline: {
    id: 'proposalPipeline',
    title: 'Proposal Pipeline',
    description: 'Proposal stages, win rate, and forecast.',
    category: 'Proposals',
    default: { x: 6, y: 13, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  nextActions: {
    id: 'nextActions',
    title: 'Next Actions',
    description: 'The most important things to do next.',
    category: 'Operations',
    default: { x: 6, y: 17, w: 6, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
    requiredRole: 'owner',
  },
  projectControls: {
    id: 'projectControls',
    title: 'Project Controls',
    description: 'QC, deadlines, and field-note shortcuts.',
    category: 'Operations',
    default: { x: 0, y: 16, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  projectRiskReview: {
    id: 'projectRiskReview',
    title: 'Project Risk Review',
    description: 'Featured project risk and weather exposure.',
    category: 'Risk / QC',
    default: { x: 6, y: 20, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  placementConditions: {
    id: 'placementConditions',
    title: 'Placement Conditions',
    description: 'Weather and site conditions for upcoming pours.',
    category: 'Weather / Placement',
    default: { x: 0, y: 24, w: 12, h: 5 },
    minW: 12,
    minH: 4,
    allowedWidths: FULL_ONLY,
    defaultVisible: true,
  },
  smartPourAssistant: {
    id: 'smartPourAssistant',
    title: 'Pre-Placement Review',
    description: 'Readiness checks before a concrete placement.',
    category: 'Weather / Placement',
    default: { x: 0, y: 29, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },
  concreteDeliverySchedule: {
    id: 'concreteDeliverySchedule',
    title: 'Concrete Delivery Schedule',
    description: 'Truck timeline and delivery spacing for pours.',
    category: 'Weather / Placement',
    default: { x: 6, y: 29, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: true,
  },

  // ---- Phase 4 optional catalog widgets (defaultVisible: false) ----
  quickActions: {
    id: 'quickActions',
    title: 'Quick Actions',
    description: 'One-tap shortcuts to start projects, proposals, and estimates.',
    category: 'Shortcuts',
    default: { x: 0, y: 900, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
  },
  projectsNeedingEstimate: {
    id: 'projectsNeedingEstimate',
    title: 'Projects Needing Estimate',
    description: 'Projects still in takeoff or estimating that need pricing.',
    category: 'Projects',
    default: { x: 0, y: 900, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
  },
  proposalsFollowUp: {
    id: 'proposalsFollowUp',
    title: 'Proposals Needing Follow-up',
    description: 'Sent proposals that have gone quiet and need a nudge.',
    category: 'Proposals',
    default: { x: 6, y: 900, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
  },
  qcDue: {
    id: 'qcDue',
    title: 'QC Due',
    description: 'Quality-control tests due and overdue across projects.',
    category: 'Risk / QC',
    default: { x: 6, y: 900, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredPlan: 'professional',
    requiredRole: 'owner',
  },

  // ---- Phase 5A tool/shortcut catalog widgets (defaultVisible: false) ----
  ardenCalc: {
    id: 'ardenCalc',
    title: 'Arden Calc',
    description: 'Quick launch slab, footing, column, sidewalk, and reinforcement calculators.',
    category: 'Tools / Calculators',
    default: { x: 0, y: 950, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredFeature: 'calculators',
  },
  quickEstimateLauncher: {
    id: 'quickEstimateLauncher',
    title: 'Quick Estimate',
    description: 'Start or continue a quick ballpark estimate.',
    category: 'Estimating',
    default: { x: 6, y: 950, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredFeature: 'quick_estimates',
  },
  newProjectShortcut: {
    id: 'newProjectShortcut',
    title: 'New Project',
    description: 'Create a new active project from the dashboard.',
    category: 'Shortcuts',
    default: { x: 0, y: 950, w: 4, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
  },
  newProposalShortcut: {
    id: 'newProposalShortcut',
    title: 'New Proposal',
    description: 'Open the proposal generator to draft a client proposal.',
    category: 'Shortcuts',
    default: { x: 4, y: 950, w: 4, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredFeature: 'proposals',
    requiredRole: 'owner',
  },
  plannerHubShortcut: {
    id: 'plannerHubShortcut',
    title: 'Open Planner Hub',
    description: 'Jump to your project workspace for estimates, schedule, documents, and field workflows.',
    category: 'Shortcuts',
    default: { x: 8, y: 950, w: 4, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredRole: 'owner',
  },
  scheduleShortcut: {
    id: 'scheduleShortcut',
    title: 'Open Schedule',
    description: 'Open the schedule workspace and calendar.',
    category: 'Scheduling',
    default: { x: 0, y: 1000, w: 6, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredRole: 'owner',
  },
  accountingTaxLauncher: {
    id: 'accountingTaxLauncher',
    title: 'Accounting & Tax',
    description: 'Export accounting and tax reports for your business.',
    category: 'Financial',
    default: { x: 6, y: 1000, w: 6, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredFeature: 'accounting_exports',
    requiredRole: 'owner',
  },
  supportHelp: {
    id: 'supportHelp',
    title: 'Support & Help',
    description: 'Contact support or browse help resources.',
    category: 'Admin / Business',
    default: { x: 0, y: 1000, w: 6, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
  },
  weatherForecast: {
    id: 'weatherForecast',
    title: 'Weather Forecast',
    description:
      'Jobsite forecast with temperature, rain, wind, and weather risk for placement planning.',
    category: 'Weather / Placement',
    default: { x: 0, y: 950, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredPlan: 'starter',
  },
  usageMeter: {
    id: 'usageMeter',
    title: 'Usage Meter',
    description: 'Monthly metered API usage against your plan limits.',
    category: 'Admin / Business',
    default: { x: 6, y: 950, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
    defaultVisible: false,
    requiredRole: 'owner',
  },
};

/** Every registered widget id, in reading order (top-to-bottom, left-to-right). */
export const DASHBOARD_CARD_IDS: DashboardCardId[] = (
  Object.keys(DASHBOARD_CARD_META) as DashboardCardId[]
).sort((a, b) => {
  const da = DASHBOARD_CARD_META[a].default;
  const db = DASHBOARD_CARD_META[b].default;
  return da.y - db.y || da.x - db.x;
});

/** Ids that make up the factory-default dashboard (presence === active). */
export const DEFAULT_VISIBLE_CARD_IDS: DashboardCardId[] = DASHBOARD_CARD_IDS.filter(
  (id) => DASHBOARD_CARD_META[id].defaultVisible,
);

export const DASHBOARD_LAYOUT_VERSION = 2 as const;

export type WeatherSourceKind = 'my' | 'project';

/** Per-widget config persisted on dashboard layout items. */
export interface WeatherForecastWidgetConfig {
  selectedWeatherSource?: WeatherSourceKind;
  selectedProjectId?: string | null;
}

export interface DashboardLayoutItemConfig {
  weatherForecast?: WeatherForecastWidgetConfig;
}

export interface DashboardLayoutItem {
  id: DashboardCardId;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: DashboardLayoutItemConfig;
}

export interface DashboardLayout {
  version: number;
  items: DashboardLayoutItem[];
}

export function isDashboardCardId(value: unknown): value is DashboardCardId {
  return typeof value === 'string' && value in DASHBOARD_CARD_META;
}

/** Clamp a width to the card's allowed range on the 12-column grid. */
export function clampCardWidth(id: DashboardCardId, w: unknown): number {
  const meta = DASHBOARD_CARD_META[id];
  const value = typeof w === 'number' && Number.isFinite(w) ? Math.round(w) : meta.default.w;
  return Math.min(DASHBOARD_GRID_COLS, Math.max(meta.minW, value));
}

/** Human label for a width used by the size controls. */
export function widthLabel(w: number): string {
  switch (w) {
    case 12:
      return 'Full';
    case 8:
      return '2/3';
    case 6:
      return 'Half';
    case 4:
      return '1/3';
    default:
      return `${w}/12`;
  }
}

function defaultItem(id: DashboardCardId): DashboardLayoutItem {
  const { x, y, w, h } = DASHBOARD_CARD_META[id].default;
  return { id, x, y, w, h };
}

/** The factory default layout: the default-visible widgets in reading order. */
export function getDefaultDashboardLayout(): DashboardLayout {
  const items = DEFAULT_VISIBLE_CARD_IDS.map(defaultItem);
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    items: repairDashboardGridLayout(items),
  };
}

/**
 * Next free row below all existing items — where a newly added widget lands.
 * (The grid vertically compacts, so this just needs to be clear of everything.)
 */
export function nextAvailableY(items: DashboardLayoutItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

/** Build the grid item for a freshly added widget, placed below existing ones. */
export function buildAddedWidgetItem(
  id: DashboardCardId,
  items: DashboardLayoutItem[],
): DashboardLayoutItem {
  const meta = DASHBOARD_CARD_META[id];
  return {
    id,
    x: 0,
    y: nextAvailableY(items),
    w: clampCardWidth(id, meta.default.w),
    h: Math.max(meta.minH, meta.default.h),
  };
}

interface RawLayoutItem {
  id?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  config?: unknown;
}

function parseWeatherForecastConfig(raw: unknown): WeatherForecastWidgetConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const wf = (raw as { weatherForecast?: unknown }).weatherForecast;
  if (!wf || typeof wf !== 'object') return undefined;
  const src = (wf as { selectedWeatherSource?: unknown }).selectedWeatherSource;
  const projectId = (wf as { selectedProjectId?: unknown }).selectedProjectId;
  const config: WeatherForecastWidgetConfig = {};
  if (src === 'my' || src === 'project') {
    config.selectedWeatherSource = src;
  }
  if (typeof projectId === 'string') {
    config.selectedProjectId = projectId;
  } else if (projectId === null) {
    config.selectedProjectId = null;
  }
  return Object.keys(config).length > 0 ? config : undefined;
}

function parseItemConfig(raw: unknown): DashboardLayoutItemConfig | undefined {
  const weatherForecast = parseWeatherForecastConfig(raw);
  if (!weatherForecast) return undefined;
  return { weatherForecast };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Validate and migrate a persisted layout against the current registry:
 * - drop unknown card ids
 * - drop duplicate ids (keep first occurrence)
 * - coerce missing/invalid coordinates to the card defaults
 * - clamp widths to the card's allowed range
 * - append any missing *default-visible* widgets (optional catalog widgets are
 *   NOT auto-added — they stay available but inactive until the user adds them)
 * - stamp the current version
 *
 * Returns the factory default when the input is missing or unusable, so a
 * corrupt value never crashes the dashboard. Accepts both the current `items`
 * shape and the legacy `cards` key for forward safety.
 */
export function validateAndMigrateLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== 'object') {
    return getDefaultDashboardLayout();
  }

  const source = raw as { items?: unknown; cards?: unknown };
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.cards)
      ? source.cards
      : null;

  if (!rawItems) {
    return getDefaultDashboardLayout();
  }

  const seen = new Set<DashboardCardId>();
  const items: DashboardLayoutItem[] = [];

  rawItems.forEach((entry) => {
    const item = (entry ?? {}) as RawLayoutItem;
    if (!isDashboardCardId(item.id) || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    const def = DASHBOARD_CARD_META[item.id].default;
    const config = parseItemConfig(item.config);
    items.push({
      id: item.id,
      x: num(item.x, def.x),
      y: num(item.y, def.y),
      w: clampCardWidth(item.id, item.w),
      h: Math.max(DASHBOARD_CARD_META[item.id].minH, num(item.h, def.h)),
      ...(config ? { config } : {}),
    });
  });

  // Auto-add only missing default-visible widgets; optional widgets stay in the
  // catalog (available but not placed) until the user adds them.
  for (const id of DEFAULT_VISIBLE_CARD_IDS) {
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(defaultItem(id));
  }

  return { version: DASHBOARD_LAYOUT_VERSION, items };
}
