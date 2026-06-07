import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical } from './cpm/cpmDisplayCritical';
import type { CpmActivityResult, CpmLogicLink, CpmResult } from './cpmTypes';
import { formatEstimatedFloat } from './levelThreeGanttGrid';
import type { LevelThreeGanttRow } from './levelThreeGanttUtils';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

export interface ActivityDetailsViewModel {
  activityCode: string;
  title: string;
  division: string;
  workPackage: string;
  durationDays: number;
  estimatedFloat: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  crewSize: number;
  laborHours: number;
  manDays: number;
  crewDays: number;
  totalCost: number;
  predecessors: string;
  relationshipType: string;
  lagDays: number;
  notes: string;
}

function formatPredecessors(
  activityCode: string,
  logicLinks: CpmLogicLink[],
  lineItem?: EstimateDomainTask,
): string {
  const fromLinks = logicLinks
    .filter((link) => link.successorActivityCode === activityCode)
    .map((link) => {
      const lag = link.lagDays > 0 ? ` +${link.lagDays}d` : '';
      return `${link.predecessorActivityCode} (${link.relationshipType}${lag})`;
    });

  if (fromLinks.length > 0) return fromLinks.join(', ');

  const primary = lineItem?.predecessorActivityCode?.trim();
  if (!primary) return '—';
  const rel = lineItem?.relationshipType ?? 'FS';
  const lag = (lineItem?.lagDays ?? 0) > 0 ? ` +${lineItem?.lagDays}d` : '';
  return `${primary} (${rel}${lag})`;
}

export function buildActivityDetailsViewModel(
  activity: ScheduleActivity,
  cpm: CpmActivityResult,
  logicLinks: CpmLogicLink[] = [],
  lineItem?: EstimateDomainTask,
  cpmResult?: CpmResult | null,
): ActivityDetailsViewModel {
  const division = [activity.divisionCode, activity.divisionName].filter(Boolean).join(' — ');
  const workPackage = [activity.workPackageCode, activity.workPackageName].filter(Boolean).join(' — ');

  return {
    activityCode: activity.activityCode,
    title: activity.activityDescription,
    division: division || '—',
    workPackage: workPackage || '—',
    durationDays: activity.durationDays,
    estimatedFloat: formatEstimatedFloat(cpm.totalFloat),
    earlyStart: cpm.earlyStart,
    earlyFinish: cpm.earlyFinish,
    lateStart: cpm.lateStart,
    lateFinish: cpm.lateFinish,
    totalFloat: cpm.totalFloat,
    freeFloat: cpm.freeFloat,
    isCritical: cpmResult ? isDisplayCritical(cpmResult, activity.activityCode) : cpm.isCritical,
    crewSize: activity.crewSize,
    laborHours: activity.laborHours,
    manDays: activity.manDays,
    crewDays: activity.crewDays,
    totalCost: activity.totalCost,
    predecessors: formatPredecessors(activity.activityCode, logicLinks, lineItem),
    relationshipType: lineItem?.relationshipType ?? activity.relationshipType,
    lagDays: lineItem?.lagDays ?? activity.lagDays,
    notes: lineItem?.description?.trim() || lineItem?.title?.trim() || '',
  };
}

export function resolveSelectedGanttActivityDetails(
  selectedActivityCode: string | null,
  rows: LevelThreeGanttRow[],
  logicLinks: CpmLogicLink[] = [],
  lineItems: EstimateDomainTask[] = [],
  cpmResult?: CpmResult | null,
): ActivityDetailsViewModel | null {
  if (!selectedActivityCode) return null;
  const row = rows.find((entry) => entry.activity.activityCode === selectedActivityCode);
  if (!row) return null;
  const lineItem = lineItems.find((item) => item.activityCode === selectedActivityCode);
  return buildActivityDetailsViewModel(row.activity, row.cpm, logicLinks, lineItem, cpmResult);
}
