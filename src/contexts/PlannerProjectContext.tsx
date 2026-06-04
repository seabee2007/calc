import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ensurePlannerBoard,
  fetchPlannerBoardBundle,
} from '../services/plannerService';
import { fetchTeamProfiles, fetchProfilesByIds } from '../services/profileService';
import { fetchAssignmentsForProject } from '../services/employeeService';
import {
  resolveProjectWorkflow,
  PROJECT_LIFECYCLE_LABELS,
} from '../utils/projectWorkflow';
import { formatUSAddress, usAddressFromFields } from '../types/address';
import type { Project } from '../types';
import type { PlannerBoardBundle, Profile } from '../types/fieldPlanner';
import type { ProjectWorkflowStage } from '../utils/projectWorkflow';

export interface PlannerProjectMeta {
  id: string;
  name: string;
  statusLabel: string;
  statusStage: ProjectWorkflowStage;
  locationLabel: string;
  ownerId: string;
  pourDate?: string | null;
}

interface PlannerProjectRow {
  id: string;
  name: string;
  user_id: string;
  pour_date: string | null;
  jobsite_street: string | null;
  jobsite_street2: string | null;
  jobsite_city: string | null;
  jobsite_state: string | null;
  jobsite_zip: string | null;
  placement_order: Project['placementOrder'] | null;
}

interface PlannerProjectContextValue {
  projectId: string;
  project: PlannerProjectMeta | null;
  bundle: PlannerBoardBundle | null;
  team: Profile[];
  loading: boolean;
  accessDenied: boolean;
  reload: () => Promise<void>;
  isOwner: boolean;
}

const PlannerProjectContext = createContext<PlannerProjectContextValue | null>(null);

export function PlannerProjectProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, isOwner, isEmployee } = useAuth();
  const [project, setProject] = useState<PlannerProjectMeta | null>(null);
  const [bundle, setBundle] = useState<PlannerBoardBundle | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    setAccessDenied(false);
    try {
      const { data: row, error } = await supabase
        .from('projects')
        .select(
          'id, name, user_id, pour_date, jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip, placement_order',
        )
        .eq('id', projectId)
        .maybeSingle();

      if (error || !row) {
        setAccessDenied(true);
        return;
      }
      const projectRow = row as PlannerProjectRow;

      if (isEmployee) {
        const { data: assignment } = await supabase
          .from('employee_project_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('employee_id', user.id)
          .maybeSingle();
        if (!assignment) {
          setAccessDenied(true);
          return;
        }
      } else if (!isOwner && projectRow.user_id !== user.id) {
        setAccessDenied(true);
        return;
      }

      const workflowProject: Project = {
        id: projectRow.id,
        name: projectRow.name,
        description: '',
        createdAt: '',
        updatedAt: '',
        calculations: [],
        pourDate: projectRow.pour_date ?? undefined,
        placementOrder: projectRow.placement_order ?? undefined,
      };
      const workflow = resolveProjectWorkflow(workflowProject);
      const addr = usAddressFromFields({
        jobsiteStreet: projectRow.jobsite_street ?? undefined,
        jobsiteStreet2: projectRow.jobsite_street2 ?? undefined,
        jobsiteCity: projectRow.jobsite_city ?? undefined,
        jobsiteState: projectRow.jobsite_state ?? undefined,
        jobsiteZip: projectRow.jobsite_zip ?? undefined,
      });
      const locationLabel = formatUSAddress(addr) || 'Location not set';

      setProject({
        id: projectRow.id,
        name: projectRow.name,
        statusLabel: PROJECT_LIFECYCLE_LABELS[workflow.stage],
        statusStage: workflow.stage,
        locationLabel,
        ownerId: projectRow.user_id,
        pourDate: projectRow.pour_date ?? null,
      });

      const ownerId = projectRow.user_id || user.id;
      await ensurePlannerBoard(projectId, ownerId);
      const b = await fetchPlannerBoardBundle(projectId);
      setBundle(b);

      if (isOwner) {
        const members = await fetchTeamProfiles(user.id);
        setTeam(members);
      } else {
        const assignments = await fetchAssignmentsForProject(projectId);
        const ids = assignments.map((a) => a.employeeId);
        if (ids.length > 0) {
          const profileMap = await fetchProfilesByIds(ids);
          setTeam(
            ids.map((id) => profileMap.get(id)).filter(Boolean) as Profile[],
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, user, isOwner, isEmployee]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (accessDenied && !loading) {
      navigate(isEmployee ? '/employee/dashboard' : '/projects', { replace: true });
    }
  }, [accessDenied, loading, navigate, isEmployee]);

  const value = useMemo(
    () => ({
      projectId: projectId ?? '',
      project,
      bundle,
      team,
      loading,
      accessDenied,
      reload,
      isOwner,
    }),
    [projectId, project, bundle, team, loading, accessDenied, reload, isOwner],
  );

  if (!projectId) return null;

  return (
    <PlannerProjectContext.Provider value={value}>{children}</PlannerProjectContext.Provider>
  );
}

export function usePlannerProject(): PlannerProjectContextValue {
  const ctx = useContext(PlannerProjectContext);
  if (!ctx) {
    throw new Error('usePlannerProject must be used within PlannerProjectProvider');
  }
  return ctx;
}
