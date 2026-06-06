import { normalizeSelectedDivisionCodes } from '../application/estimateWorkBreakdown';
import type { EstimateSelectedDivision, EstimateType } from '../domain/estimateTypes';
import type { EstimateWorkspaceTabId } from './components/EstimateWorkspaceTabBar';

export function shouldShowEstimateTypeSelectionOnTab(
  tabId: EstimateWorkspaceTabId,
  options: { isLoading: boolean; hasEstimate: boolean },
): boolean {
  return tabId === 'line-items' && !options.isLoading && !options.hasEstimate;
}

export function shouldShowOverviewNoEstimateMessage(
  tabId: EstimateWorkspaceTabId,
  options: { isLoading: boolean; hasEstimate: boolean },
): boolean {
  return tabId === 'overview' && !options.isLoading && !options.hasEstimate;
}

export function shouldShowOverviewFinancialSummary(
  tabId: EstimateWorkspaceTabId,
  options: { isLoading: boolean; hasEstimate: boolean },
): boolean {
  return tabId === 'overview' && !options.isLoading && options.hasEstimate;
}

/** @deprecated Use shouldShowOverviewFinancialSummary */
export const shouldShowOverviewDashboard = shouldShowOverviewFinancialSummary;

export function shouldShowEstimateBuilderPanel(
  tabId: EstimateWorkspaceTabId,
  options: { isLoading: boolean; hasEstimate: boolean },
): boolean {
  return tabId === 'line-items' && !options.isLoading && options.hasEstimate;
}

export function resolveDisplayedEstimateType(
  activeEstimateType: EstimateType | null,
  currentEstimateType: EstimateType | null | undefined,
  fallbackType: EstimateType,
): EstimateType | null {
  if (currentEstimateType) return currentEstimateType;
  if (activeEstimateType) return activeEstimateType;
  return null;
}

export function mergePersistedAndSessionDivisionCodes(
  persistedDivisions: readonly EstimateSelectedDivision[],
  sessionDivisionCodes: readonly string[],
): string[] {
  return normalizeSelectedDivisionCodes([
    ...persistedDivisions.map((division) => division.code),
    ...sessionDivisionCodes,
  ]);
}

export function hasSelectedEstimateDivisions(
  persistedDivisions: readonly EstimateSelectedDivision[],
  sessionDivisionCodes: readonly string[],
): boolean {
  return mergePersistedAndSessionDivisionCodes(persistedDivisions, sessionDivisionCodes).length > 0;
}

export function shouldShowBuilderDivisionBuckets(
  showActivityWorkflow: boolean,
  persistedDivisions: readonly EstimateSelectedDivision[],
  sessionDivisionCodes: readonly string[],
): boolean {
  return showActivityWorkflow && hasSelectedEstimateDivisions(persistedDivisions, sessionDivisionCodes);
}
