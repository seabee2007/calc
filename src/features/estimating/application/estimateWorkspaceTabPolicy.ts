import {
  getDefaultSchedulingEnabled,
  normalizeEstimateMethod,
  resolveSchedulingEnabled,
  supportsConstructionActivitiesWorkflow,
} from '../domain/estimateMethods';
import type { EstimateType, StoredEstimateType } from '../domain/estimateTypes';
import type { EstimateWorkspaceTab, EstimateWorkspaceTabId } from '../ui/components/EstimateWorkspaceTabBar';

export const SCHEDULE_WORKSPACE_TAB_IDS = [
  'schedule-preview',
  'logic-network',
  'level-iii-gantt',
] as const satisfies readonly EstimateWorkspaceTabId[];

export function isScheduleWorkspaceTab(tabId: EstimateWorkspaceTabId): boolean {
  return (SCHEDULE_WORKSPACE_TAB_IDS as readonly EstimateWorkspaceTabId[]).includes(tabId);
}

function costsMarkupTab(): EstimateWorkspaceTab {
  return { id: 'overview', label: 'Costs & Markup' };
}

function settingsTab(): EstimateWorkspaceTab {
  return { id: 'settings', label: 'Settings' };
}

function scheduleTabs(schedulingEnabled: boolean): EstimateWorkspaceTab[] {
  if (!schedulingEnabled) return [];
  return [
    { id: 'schedule-preview', label: 'Schedule Preview' },
    { id: 'logic-network', label: 'Logic Network' },
    { id: 'level-iii-gantt', label: 'Level III Gantt' },
  ];
}

export function getVisibleWorkspaceTabs(
  estimateType: StoredEstimateType | string | null | undefined,
  schedulingEnabled: boolean,
): EstimateWorkspaceTab[] {
  const type = normalizeEstimateMethod(estimateType);
  const costs = costsMarkupTab();
  const settings = settingsTab();
  const schedule = scheduleTabs(schedulingEnabled);

  switch (type) {
    case 'quick':
      return [{ id: 'quick-estimate', label: 'Quick Estimate' }, costs, ...schedule, settings];
    case 'conceptual':
      return [
        { id: 'conceptual-budget', label: 'Conceptual Budget' },
        { id: 'assumptions-allowances', label: 'Assumptions & Exclusions' },
        { id: 'scenarios', label: 'Scenarios' },
        { id: 'risks-contingency', label: 'Risks & Contingency' },
        costs,
        ...schedule,
        settings,
      ];
    case 'change_order':
      return [
        { id: 'change-order-scope', label: 'Change Order Scope' },
        { id: 'pricing', label: 'Pricing' },
        costs,
        ...schedule,
        settings,
      ];
    case 'unit_price':
      return [
        { id: 'unit-price-items', label: 'Unit Price Items' },
        costs,
        ...schedule,
        settings,
      ];
    case 'subcontractor_quote':
      return [
        { id: 'subcontractor-quotes', label: 'Quotes' },
        { id: 'quote-comparison', label: 'Quote Comparison' },
        costs,
        settings,
      ];
    case 'detailed':
    case 'bid':
    case 'self_perform_labor':
    default:
      return [
        { id: 'activities', label: 'Activities' },
        { id: '3d-takeoff', label: '3D Takeoff' },
        ...schedule,
        costs,
        settings,
      ];
  }
}

export function getDefaultWorkspaceTabForEstimateType(
  estimateType: StoredEstimateType | string | null | undefined,
): EstimateWorkspaceTabId {
  const type = normalizeEstimateMethod(estimateType);
  switch (type) {
    case 'quick':
      return 'quick-estimate';
    case 'conceptual':
      return 'conceptual-budget';
    case 'change_order':
      return 'change-order-scope';
    case 'unit_price':
      return 'unit-price-items';
    case 'subcontractor_quote':
      return 'subcontractor-quotes';
    case 'detailed':
    case 'bid':
    case 'self_perform_labor':
    default:
      return 'activities';
  }
}

export function isTabVisibleForEstimateType(
  tabId: EstimateWorkspaceTabId,
  estimateType: StoredEstimateType | string | null | undefined,
  schedulingEnabled: boolean,
): boolean {
  return getVisibleWorkspaceTabs(estimateType, schedulingEnabled).some((tab) => tab.id === tabId);
}

export function resolveWorkspaceSchedulingEnabled(
  estimateType: StoredEstimateType | string | null | undefined,
  stored: boolean | null | undefined,
): boolean {
  return resolveSchedulingEnabled(estimateType, stored);
}

export function getEstimateTypeEmptyState(
  estimateType: StoredEstimateType | string | null | undefined,
  tabId: EstimateWorkspaceTabId,
): { title: string; body: string } {
  const type = normalizeEstimateMethod(estimateType);

  if (isScheduleWorkspaceTab(tabId)) {
    return {
      title: 'Scheduling is not enabled for this estimate type.',
      body: 'Enable scheduling in Settings to use Schedule Preview, Logic Network, and Level III Gantt.',
    };
  }

  switch (tabId) {
    case 'activities':
      if (type === 'self_perform_labor') {
        return {
          title: 'No construction activities yet.',
          body: 'Add activities to plan self-perform labor production, crews, and durations.',
        };
      }
      return {
        title: 'No construction activities yet.',
        body: 'Add activities to build your detailed estimate.',
      };
    case '3d-takeoff':
      return {
        title: 'No 3D model yet',
        body: 'Upload a single-file .glb model to start 3D takeoff and map objects to estimate activities.',
      };
    case 'quick-estimate':
      return {
        title: 'Start your quick estimate',
        body: 'Start with project size, unit pricing, and assumptions.',
      };
    case 'conceptual-budget':
      return {
        title: 'Build a conceptual budget',
        body: 'Add division allowances and rough scope before detailed takeoff.',
      };
    case 'assumptions-allowances':
      return {
        title: 'No assumptions or exclusions yet',
        body: 'Document early assumptions, exclusions, and allowance notes.',
      };
    case 'scenarios':
      return {
        title: 'No scenarios yet',
        body: 'Create budget scenarios to compare subtotals, contingency, and totals.',
      };
    case 'risks-contingency':
      return {
        title: 'No risks documented yet',
        body: 'Add risks and set contingency to drive budget rollups.',
      };
    case 'change-order-scope':
      return {
        title: 'No change order scope yet',
        body: 'Add added, deleted, or revised scope items for this change order.',
      };
    case 'pricing':
      return {
        title: 'No change order pricing yet',
        body: 'Price added, deleted, or revised scope against the base contract.',
      };
    case 'unit-price-items':
      return {
        title: 'No unit price items yet',
        body: 'Add repetitive scope priced by LF, SF, CY, EA, TON, or other units.',
      };
    case 'subcontractor-quotes':
      return {
        title: 'No quotes tracked yet',
        body: 'Add subcontractor or vendor quotes with scope, inclusions, and exclusions.',
      };
    case 'quote-comparison':
      return {
        title: 'No quote comparison yet',
        body: 'Compare quoted scope, alternates, and exclusions side by side.',
      };
    default:
      return {
        title: 'Nothing here yet',
        body: 'Start building this section of your estimate.',
      };
  }
}

export interface EstimateTypeChangeWarning {
  showWarning: boolean;
  title: string;
  body: string;
}

export function getEstimateTypeChangeWarning(
  fromType: StoredEstimateType | string | null | undefined,
  toType: EstimateType,
  schedulingEnabled: boolean,
): EstimateTypeChangeWarning {
  const fromNormalized = normalizeEstimateMethod(fromType);
  const toNormalized = normalizeEstimateMethod(toType);
  if (fromNormalized === toNormalized) {
    return { showWarning: false, title: '', body: '' };
  }

  const fromHadScheduleTabs = getVisibleWorkspaceTabs(fromNormalized, schedulingEnabled).some((tab) =>
    isScheduleWorkspaceTab(tab.id),
  );
  const toHasScheduleTabs = getVisibleWorkspaceTabs(toNormalized, schedulingEnabled).some((tab) =>
    isScheduleWorkspaceTab(tab.id),
  );

  if (fromHadScheduleTabs && !toHasScheduleTabs) {
    return {
      showWarning: true,
      title: 'Schedule tabs will be hidden',
      body:
        'Changing estimate type will hide schedule tabs for this workflow. Existing activities, logic network, and schedule data are preserved and can be shown again if you re-enable scheduling or switch back to a schedule-supported type.',
    };
  }

  return {
    showWarning: true,
    title: 'Change estimate type?',
    body:
      'Your saved activities, line items, costs, markup, and schedule data are preserved. Tabs will adapt to the new estimate type.',
  };
}

export { supportsConstructionActivitiesWorkflow, getDefaultSchedulingEnabled };
