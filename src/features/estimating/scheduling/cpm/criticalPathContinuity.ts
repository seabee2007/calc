import type { CpmActivityResult, CpmLogicLink } from '../cpmTypes';
import { validateCriticalPathContinuity } from '../logic/validateCriticalPathContinuity';

export interface CriticalPathContinuityParams {
  activities: CpmActivityResult[];
  logicLinks: CpmLogicLink[];
  projectStartDay: number;
  projectFinish: number;
  hasCycle?: boolean;
}

/**
 * @deprecated Prefer validateCriticalPathContinuity for full display-critical results.
 * Returns the first continuity warning string, if any.
 */
export function buildCriticalPathContinuityWarning(
  params: CriticalPathContinuityParams,
): string | null {
  const result = validateCriticalPathContinuity({
    activities: params.activities,
    logicLinks: params.logicLinks,
    projectStartDay: params.projectStartDay,
    projectFinish: params.projectFinish,
    hasCycle: params.hasCycle ?? false,
  });

  return result.warnings[0] ?? null;
}
