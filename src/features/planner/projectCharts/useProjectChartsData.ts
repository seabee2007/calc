import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlannerProjectMeta } from '../../../contexts/PlannerProjectContext';
import { loadCurrentEstimateForProject } from '../../estimating/ui/estimateWorkspaceLoad';
import { fetchProjectActivities } from '../../estimating/infrastructure/activityRepository';
import { fetchChangeOrdersForProject } from '../../../services/changeOrderService';
import { fetchRfisForProject } from '../../../services/rfiService';
import { useProjectStore } from '../../../store';
import type { Project } from '../../../types';
import { summarizeQcBreakAlerts } from '../../../utils/projectFolders';
import { resolveProjectWorkflow } from '../../../utils/projectWorkflow';
import { buildProjectChartsSnapshotFromInputs } from './projectChartsData';
import type { ProjectChartsSnapshot } from './projectChartsTypes';

export const EMPTY_PROJECT_CHARTS_SNAPSHOT: ProjectChartsSnapshot = {
  costHealth: {
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    subcontractorCost: 0,
    directCostSubtotal: 0,
    finalSellPrice: null,
    hasActivities: false,
  },
  scopeByDivision: { divisions: [], totalActivities: 0 },
  laborDemand: {
    hasCpm: false,
    peakCrew: 0,
    availableCrew: 0,
    overallocatedDays: 0,
    histogram: [],
  },
  scheduleReadiness: {
    scheduledActivities: 0,
    totalActivities: 0,
    activitiesMissingLogic: 0,
    criticalActivityCount: null,
    projectDurationDays: null,
    hasCpm: false,
    cpmStale: false,
  },
  qcRisk: {
    openQcItems: 0,
    dueQcItems: 0,
    overdueQcItems: 0,
    qcRecordCount: 0,
    openRfiCount: 0,
    riskLabel: null,
    hasAnyData: false,
  },
  changeOrders: {
    pendingValue: 0,
    approvedValue: 0,
    declinedValue: 0,
    statusCounts: [],
    totalCount: 0,
  },
};

function resolveQcAlerts(project: Project | undefined) {
  if (!project) {
    return { openThisWeek: 0, overdue: 0 };
  }
  const workflow = resolveProjectWorkflow(project, { now: new Date() });
  return summarizeQcBreakAlerts(project, workflow.stage, undefined, new Date());
}

export function useProjectChartsData(projectId: string, project: PlannerProjectMeta | null) {
  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectChartsSnapshot>(EMPTY_PROJECT_CHARTS_SNAPSHOT);

  const storeProject = useMemo(
    () => projects.find((entry) => entry.id === projectId),
    [projectId, projects],
  );

  const load = useCallback(async () => {
    if (!projectId) {
      setSnapshot(EMPTY_PROJECT_CHARTS_SNAPSHOT);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loadProjects();
      const estimate = await loadCurrentEstimateForProject(projectId);
      const activitiesResult = await fetchProjectActivities(projectId, estimate?.id);
      const activities = activitiesResult.data ?? [];
      const [rfis, changeOrders] = await Promise.all([
        fetchRfisForProject(projectId).catch(() => []),
        fetchChangeOrdersForProject(projectId).catch(() => []),
      ]);

      const projectRecord = useProjectStore.getState().projects.find((entry) => entry.id === projectId);
      const qcAlerts = resolveQcAlerts(projectRecord);

      setSnapshot(
        buildProjectChartsSnapshotFromInputs({
          estimate,
          activities,
          projectCrewSize: project?.projectCrewSize,
          qcRecords: projectRecord?.qcRecords ?? [],
          qcAlerts,
          rfis,
          changeOrders,
          workflowStageLabel: project?.statusLabel ?? null,
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load project charts.');
      setSnapshot(EMPTY_PROJECT_CHARTS_SNAPSHOT);
    } finally {
      setLoading(false);
    }
  }, [loadProjects, project?.projectCrewSize, project?.statusLabel, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    snapshot,
    loading,
    error,
    reload: load,
    storeProject,
  };
}
