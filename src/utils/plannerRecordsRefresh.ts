/** Cross-panel refresh after field record create/save (mirrors planner-task-menu-open pattern). */
export const PLANNER_RECORDS_CHANGED_EVENT = 'planner-records-changed';

export type PlannerRecordKind = 'rfi' | 'far' | 'change_order';

export interface PlannerRecordsChangedDetail {
  kind: PlannerRecordKind;
  projectId: string;
  id?: string;
}

export function dispatchPlannerRecordsChanged(detail: PlannerRecordsChangedDetail): void {
  window.dispatchEvent(
    new CustomEvent<PlannerRecordsChangedDetail>(PLANNER_RECORDS_CHANGED_EVENT, { detail }),
  );
}

export function subscribePlannerRecordsChanged(
  handler: (detail: PlannerRecordsChangedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<PlannerRecordsChangedDetail>).detail;
    if (detail?.projectId && detail?.kind) handler(detail);
  };
  window.addEventListener(PLANNER_RECORDS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(PLANNER_RECORDS_CHANGED_EVENT, listener);
}
