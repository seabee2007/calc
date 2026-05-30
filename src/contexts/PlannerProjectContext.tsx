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
import { fetchTeamProfiles } from '../services/profileService';
import { fetchAssignmentsForProject } from '../services/employeeService';
import {
  resolveProjectWorkflow,
  PROJECT_WORKFLOW_LABELS,
} from '../utils/projectWorkflow';
import { formatUSAddress, usAddressFromFields } from '../types/address';
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
      } else if (!isOwner && row.user_id !== user.id) {
        setAccessDenied(true);
        return;
      }

      const workflow = resolveProjectWorkflow(row as Parameters<typeof resolveProjectWorkflow>[0]);
      const addr = usAddressFromFields({
        jobsiteStreet: row.jobsite_street as string | null,
        jobsiteStreet2: row.jobsite_street2 as string | null,
        jobsiteCity: row.jobsite_city as string | null,
        jobsiteState: row.jobsite_state as string | null,
        jobsiteZip: row.jobsite_zip as string | null,
      });
      const locationLabel = formatUSAddress(addr) || 'Location not set';

      setProject({
        id: row.id as string,
        name: row.name as string,
        statusLabel: PROJECT_WORKFLOW_LABELS[workflow.stage],
        statusStage: workflow.stage,
        locationLabel,
        ownerId: row.user_id as string,
        pourDate: (row.pour_date as string) ?? null,
      });

      const ownerId = (row.user_id as string) ?? user.id;
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
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', ids);
          setTeam(
            (profiles ?? []).map((p) => ({
              id: p.id as string,
              role: p.role as Profile['role'],
              employerId: (p.employer_id as string) ?? null,
              displayName: (p.display_name as string) ?? null,
              phone: (p.phone as string) ?? null,
              createdAt: p.created_at as string,
              updatedAt: p.updated_at as string,
            })),
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
