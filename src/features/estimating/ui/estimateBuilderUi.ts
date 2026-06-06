export const ESTIMATE_SAVE_TOAST_MESSAGE = 'Estimate saved';

export const REMOVED_ESTIMATE_BUILDER_LABELS = [
  'Filters',
  'Division of Work',
  'Work Package / Scope',
  'Build your estimate by division of work, work package, and activity.',
] as const;

export const REMOVED_ESTIMATE_FILTER_LABELS = [
  'Work Package',
  'All work packages',
] as const;

export const REMOVED_ESTIMATE_BUILDER_SUMMARY_CARD_LABELS = [
  'Activities',
  'Labor Hours',
  'Man-Days',
  'Crew-Days',
  'Total',
] as const;

export function shouldRenderEstimateBuilderSummaryCards(): boolean {
  return false;
}

export const REMOVED_ESTIMATE_SAVED_ACTIVITIES_SECTION_LABEL = 'Saved activities' as const;

export function shouldRenderEstimateSavedActivitiesSection(): boolean {
  return false;
}

export function shouldShowEstimateBuilderHelperText(options: {
  showQuickFeasibilityPanel: boolean;
  showBucketPanel: boolean;
}): boolean {
  return options.showQuickFeasibilityPanel && !options.showBucketPanel;
}

export function shouldRenderInlineEstimateSuccessBanner(): boolean {
  return false;
}

export function createEstimateSaveSuccessToast(): {
  message: string;
  durationMs: number;
  placement: 'bottom-right';
} {
  return {
    message: ESTIMATE_SAVE_TOAST_MESSAGE,
    durationMs: 2500,
    placement: 'bottom-right',
  };
}
