import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PlannerBoardBundle } from '../types/fieldPlanner';
import { fetchScheduleEventsForProject } from '../services/scheduleEventService';
import { listSafetyMeetingsForProject } from '../services/safetyMeetingService';
import { listConcreteInspectionsForProject } from '../services/concreteInspectionService';
import {
  listProjectDocuments,
  listProjectChangeOrderBuilderDocuments,
  listProjectRfiBuilderDocuments,
} from '../services/projectDocumentService';
import { countProjectDocumentsNavTotal } from '../services/projectTabCounts';
import { fetchRfisForProject } from '../services/rfiService';
import { fetchAdjustmentsForProject } from '../services/fieldAdjustmentService';
import { fetchChangeOrdersForProject } from '../services/changeOrderService';
import { fetchAssignmentsForProject } from '../services/employeeService';

export interface ProjectTabCounts {
  schedule?: number;
  documents?: number;
  rfis?: number;
  fars?: number;
  changeOrders?: number;
  team?: number;
  board?: number;
}

async function safeCount<T>(fn: () => Promise<T>, map: (value: T) => number): Promise<number | undefined> {
  try {
    return map(await fn());
  } catch {
    return undefined;
  }
}

export function useProjectTabCounts(
  projectId: string | undefined,
  userId: string | undefined,
  bundle: PlannerBoardBundle | null,
): ProjectTabCounts {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState<ProjectTabCounts>({});

  const boardCount =
    bundle && bundle.tasks.length > 0 ? bundle.tasks.length : undefined;

  useEffect(() => {
    if (!projectId || !userId) {
      setCounts(boardCount !== undefined ? { board: boardCount } : {});
      return;
    }

    let cancelled = false;

    void (async () => {
      const [
        schedule,
        documents,
        rfis,
        fars,
        changeOrders,
        team,
      ] = await Promise.all([
        safeCount(
          () => fetchScheduleEventsForProject(projectId),
          (rows) => rows.length,
        ),
        safeCount(
          async () => {
            const [docs, meetings, inspections] = await Promise.all([
              listProjectDocuments(projectId),
              listSafetyMeetingsForProject(projectId, userId),
              listConcreteInspectionsForProject(projectId, userId),
            ]);
            return countProjectDocumentsNavTotal(docs, meetings.length, inspections.length);
          },
          (n) => n,
        ),
        safeCount(
          async () => {
            const [rfiList, drafts] = await Promise.all([
              fetchRfisForProject(projectId),
              listProjectRfiBuilderDocuments(projectId),
            ]);
            return rfiList.length + drafts.length;
          },
          (n) => n,
        ),
        safeCount(
          () => fetchAdjustmentsForProject(projectId),
          (rows) => rows.length,
        ),
        safeCount(
          async () => {
            const [orders, drafts] = await Promise.all([
              fetchChangeOrdersForProject(projectId),
              listProjectChangeOrderBuilderDocuments(projectId),
            ]);
            return orders.length + drafts.length;
          },
          (n) => n,
        ),
        safeCount(
          () => fetchAssignmentsForProject(projectId),
          (rows) => rows.length,
        ),
      ]);

      if (cancelled) return;

      const next: ProjectTabCounts = {};
      if (schedule !== undefined) next.schedule = schedule;
      if (documents !== undefined) next.documents = documents;
      if (rfis !== undefined) next.rfis = rfis;
      if (fars !== undefined) next.fars = fars;
      if (changeOrders !== undefined) next.changeOrders = changeOrders;
      if (team !== undefined) next.team = team;
      if (boardCount !== undefined) next.board = boardCount;
      setCounts(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, userId, pathname, boardCount, bundle]);

  return counts;
}
