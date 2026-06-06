export interface LogicNetworkViewport {
  x: number;
  y: number;
  zoom: number;
}

export const INITIAL_LOGIC_NETWORK_VIEWPORT: LogicNetworkViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

/** fitView is only allowed on first load, Fit view button, or Auto layout button. */
export const LOGIC_NETWORK_FIT_VIEW_TRIGGERS = [
  'initial-load',
  'fit-view-button',
  'auto-layout-button',
] as const;

export type LogicNetworkFitViewTrigger = (typeof LOGIC_NETWORK_FIT_VIEW_TRIGGERS)[number];

export function shouldAutoFitOnInitialLoad(
  hasFitInitialView: boolean,
  nodeCount: number,
): boolean {
  return !hasFitInitialView && nodeCount > 0;
}

export function shouldResetLogicNetworkSession(
  canvasKey: string,
  previousCanvasKey: string | null,
): boolean {
  return previousCanvasKey !== canvasKey;
}

export function isFitViewTriggerAllowed(trigger: LogicNetworkFitViewTrigger): boolean {
  return LOGIC_NETWORK_FIT_VIEW_TRIGGERS.includes(trigger);
}
