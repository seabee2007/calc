import type { CpmResult } from '../cpmTypes';

export type TopologyLabel = 'open-start' | 'open-finish' | 'disconnected' | 'missing-logic';

export function isDisplayCritical(cpmResult: CpmResult, activityCode: string): boolean {
  return (
    cpmResult.hasRunCpm &&
    cpmResult.hasValidCriticalPath &&
    cpmResult.validCriticalPathActivityCodes.includes(activityCode)
  );
}

export function resolveTopologyLabel(
  cpmResult: CpmResult | null | undefined,
  activityCode: string,
  mathIsZeroFloat: boolean,
): TopologyLabel | null {
  if (!cpmResult || !cpmResult.hasRunCpm || cpmResult.hasValidCriticalPath) {
    return null;
  }

  if (cpmResult.criticalPathStatus === 'missing-logic') {
    return 'missing-logic';
  }

  if (cpmResult.openStartActivityCodes.includes(activityCode)) {
    return 'open-start';
  }

  if (cpmResult.openFinishActivityCodes.includes(activityCode)) {
    return 'open-finish';
  }

  if (mathIsZeroFloat) {
    return 'disconnected';
  }

  return null;
}

export function isTopologyWarningLabel(label: TopologyLabel | null): label is TopologyLabel {
  return label !== null;
}
