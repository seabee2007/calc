/**
 * Pure dashboard layout model (no React/JSX imports).
 *
 * Phase 2B switched the dashboard from an ordered list (order + size) to a true
 * grid layout with x/y/w/h coordinates, so cards can be freely placed and
 * resized on a 12-column grid (driven by react-grid-layout in the UI).
 *
 * The render/visibility behavior lives in the registry
 * (`src/components/dashboard/layout/dashboardCardRegistry.tsx`), which imports
 * the metadata from here. Keeping this module pure lets layout
 * validation/migration be unit-tested without pulling in component modules.
 */

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
  | 'concreteDeliverySchedule';

/** The dashboard grid is a 12-column grid on desktop. */
export const DASHBOARD_GRID_COLS = 12;

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
  /** Optional one-line description shown under the title in the card header. */
  subtitle?: string;
  /** Default position/size on the 12-column grid. `h` is an initial guess; the
   * grid measures real content height at runtime and overrides it. */
  default: DashboardCardGridRect;
  minW: number;
  minH: number;
  /** Widths offered by the size controls (in grid columns). */
  allowedWidths: number[];
}

const FULL_ONLY: number[] = [12];
const ALL_WIDTHS: number[] = [12, 8, 6, 4];

/**
 * Default layout reading order:
 *  1. Today's Operations
 *  2. Schedule & Deadlines
 *  3. Business Snapshot
 *  4. Field Activity
 *  5. Active Projects | Proposal Pipeline (Next Actions under pipeline)
 *  6. Project Controls | Project Risk Review
 *  7. concrete-only cards at the bottom
 *
 * `y` values are spaced out; the grid uses vertical compaction so the gaps pack
 * away and column heights stay tidy regardless of measured card heights.
 */
export const DASHBOARD_CARD_META: Record<DashboardCardId, DashboardCardMeta> = {
  todaysOperations: {
    id: 'todaysOperations',
    title: "Today's Operations",
    default: { x: 0, y: 0, w: 12, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  operationsSchedule: {
    id: 'operationsSchedule',
    title: 'Schedule & Deadlines',
    default: { x: 0, y: 100, w: 12, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  businessSnapshot: {
    id: 'businessSnapshot',
    title: 'Business Snapshot',
    default: { x: 0, y: 200, w: 12, h: 3 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  fieldActivity: {
    id: 'fieldActivity',
    title: 'Field Activity',
    default: { x: 0, y: 300, w: 12, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  activeProjects: {
    id: 'activeProjects',
    title: 'Active Projects',
    default: { x: 0, y: 400, w: 6, h: 10 },
    minW: 4,
    minH: 6,
    allowedWidths: ALL_WIDTHS,
  },
  proposalPipeline: {
    id: 'proposalPipeline',
    title: 'Proposal Pipeline',
    default: { x: 6, y: 400, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  nextActions: {
    id: 'nextActions',
    title: 'Next Actions',
    default: { x: 6, y: 500, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  projectControls: {
    id: 'projectControls',
    title: 'Project Controls',
    default: { x: 0, y: 600, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  projectRiskReview: {
    id: 'projectRiskReview',
    title: 'Project Risk Review',
    default: { x: 6, y: 600, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  placementConditions: {
    id: 'placementConditions',
    title: 'Placement Conditions',
    default: { x: 0, y: 700, w: 12, h: 5 },
    minW: 12,
    minH: 4,
    allowedWidths: FULL_ONLY,
  },
  smartPourAssistant: {
    id: 'smartPourAssistant',
    title: 'Pre-Placement Review',
    default: { x: 0, y: 800, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
  concreteDeliverySchedule: {
    id: 'concreteDeliverySchedule',
    title: 'Concrete Delivery Schedule',
    default: { x: 6, y: 800, w: 6, h: 4 },
    minW: 4,
    minH: 3,
    allowedWidths: ALL_WIDTHS,
  },
};

/** Card ids in default reading order (top-to-bottom, left-to-right). */
export const DASHBOARD_CARD_IDS: DashboardCardId[] = (
  Object.keys(DASHBOARD_CARD_META) as DashboardCardId[]
).sort((a, b) => {
  const da = DASHBOARD_CARD_META[a].default;
  const db = DASHBOARD_CARD_META[b].default;
  return da.y - db.y || da.x - db.x;
});

export const DASHBOARD_LAYOUT_VERSION = 2 as const;

export interface DashboardLayoutItem {
  id: DashboardCardId;
  x: number;
  y: number;
  w: number;
  h: number;
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

/** The factory default layout, derived from the card registry metadata. */
export function getDefaultDashboardLayout(): DashboardLayout {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    items: DASHBOARD_CARD_IDS.map(defaultItem),
  };
}

interface RawLayoutItem {
  id?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Validate and migrate a persisted layout against the current card registry:
 * - drop unknown card ids
 * - drop duplicate ids (keep first occurrence)
 * - coerce missing/invalid coordinates to the card defaults
 * - clamp widths to the card's allowed range
 * - append any registry cards missing from the saved layout, using defaults
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
    items.push({
      id: item.id,
      x: num(item.x, def.x),
      y: num(item.y, def.y),
      w: clampCardWidth(item.id, item.w),
      h: Math.max(DASHBOARD_CARD_META[item.id].minH, num(item.h, def.h)),
    });
  });

  for (const id of DASHBOARD_CARD_IDS) {
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(defaultItem(id));
  }

  return { version: DASHBOARD_LAYOUT_VERSION, items };
}
