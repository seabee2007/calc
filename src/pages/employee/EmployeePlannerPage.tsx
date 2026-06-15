import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { fetchAssignedProjects } from '../../services/employeeService';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeePlannerStats, {
  type EmployeePlannerStatFilter,
} from '../../components/employee/EmployeePlannerStats';
import EmployeeTaskCard from '../../components/employee/EmployeeTaskCard';
import ReportIssueSheet from '../../components/employee/ReportIssueSheet';
import EmployeeBucketFilterChips, {
  filterTasksByBucket,
  type EmployeeBucketFilter,
} from '../../components/employee/EmployeeBucketFilterChips';
import Select from '../../components/ui/Select';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import {
  countBlocked,
  countDueToday,
  countInProgress,
  countReadyForReview,
  filterEmployeePlannerTasks,
  isTaskDueToday,
  statFilterToChip,
  type EmployeePlannerChipFilter,
} from '../../utils/employeePlannerFilters';

type ProjectInfo = {
  id: string;
  name: string;
  jobsite_city?: string;
  jobsite_state?: string;
};

const FILTER_CHIPS: { id: EmployeePlannerChipFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'completed', label: 'Completed' },
];

export default function EmployeePlannerPage() {
  useEmployeePageTitle('Planner');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [projectId, setProjectId] = useState<string>('all');
  const [bucketFilter, setBucketFilter] = useState<EmployeeBucketFilter>('all');
  const [chipFilter, setChipFilter] = useState<EmployeePlannerChipFilter>('today');
  const [statFilter, setStatFilter] = useState<EmployeePlannerStatFilter | null>(null);
  const [reportTask, setReportTask] = useState<PlannerTask | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loadedTasks, loadedProjects] = await Promise.all([
        fetchTasksForEmployee(user.id),
        fetchAssignedProjects(user.id),
      ]);
      setTasks(loadedTasks);
      setProjects(loadedProjects);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribePlannerRecordsChanged(() => void load()), [load]);

  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectInfo>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const scopedTasks = useMemo(() => {
    if (projectId === 'all') return tasks;
    return tasks.filter((t) => t.projectId === projectId);
  }, [tasks, projectId]);

  const filteredTasks = useMemo(() => {
    let result = scopedTasks;

    if (statFilter === 'dueToday') {
      result = result.filter(
        (t) =>
          isTaskDueToday(t.dueDate) &&
          t.status !== 'Completed' &&
          t.status !== 'Approved',
      );
    } else if (statFilter === 'inProgress') {
      result = result.filter((t) => t.status === 'In Progress');
    } else if (statFilter === 'blocked') {
      result = result.filter((t) => t.status === 'Needs Revision');
    } else if (statFilter === 'readyForReview') {
      result = result.filter((t) => t.status === 'Submitted');
    } else {
      result = filterEmployeePlannerTasks(result, chipFilter);
    }

    return filterTasksByBucket(result, bucketFilter);
  }, [scopedTasks, chipFilter, statFilter, bucketFilter]);

  const selectedProject = projectId === 'all' ? null : projectMap.get(projectId);
  const singleProject = projects.length === 1 ? projects[0] : null;

  const handleStatSelect = (filter: EmployeePlannerStatFilter) => {
    setStatFilter(filter);
    setChipFilter(statFilterToChip(filter));
  };

  const handleChipSelect = (chip: EmployeePlannerChipFilter) => {
    setChipFilter(chip);
    setStatFilter(null);
  };

  const getProjectName = (id: string) => projectMap.get(id)?.name ?? 'Project';

  const getJobsiteLabel = (id: string) => {
    const p = projectMap.get(id);
    if (!p) return undefined;
    const parts = [p.jobsite_city, p.jobsite_state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
  };

  const handleUploadPhoto = (task: PlannerTask) => {
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
    });
    navigate(`/employee/uploads?${params.toString()}`);
  };

  const handleOpenTask = (task: PlannerTask) => {
    navigate(`/employee/tasks/${task.id}`);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">Work organized by status buckets</p>

      {singleProject ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
          <p className="mt-1 font-medium text-white">{singleProject.name}</p>
          {getJobsiteLabel(singleProject.id) ? (
            <p className="text-sm text-slate-400">{getJobsiteLabel(singleProject.id)}</p>
          ) : null}
        </div>
      ) : projects.length > 1 ? (
        <Select
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: 'all', label: 'All projects' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      ) : selectedProject ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <p className="font-medium text-white">{selectedProject.name}</p>
        </div>
      ) : null}

      <EmployeePlannerStats
        dueToday={countDueToday(scopedTasks)}
        inProgress={countInProgress(scopedTasks)}
        blocked={countBlocked(scopedTasks)}
        readyForReview={countReadyForReview(scopedTasks)}
        activeFilter={statFilter}
        onFilterSelect={handleStatSelect}
      />

      <EmployeeBucketFilterChips value={bucketFilter} onChange={setBucketFilter} />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleChipSelect(chip.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium touch-manipulation ${
              chipFilter === chip.id && !statFilter
                ? 'bg-cyan-500 text-slate-950'
                : chipFilter === chip.id && statFilter
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading tasks…</p>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No tasks in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredTasks.map((task) => (
            <li key={task.id}>
              <EmployeeTaskCard
                task={task}
                projectName={getProjectName(task.projectId)}
                onOpen={() => handleOpenTask(task)}
                onUploadPhoto={() => handleUploadPhoto(task)}
                onReportIssue={() => setReportTask(task)}
              />
            </li>
          ))}
        </ul>
      )}

      {reportTask && user ? (
        <ReportIssueSheet
          open
          projectId={reportTask.projectId}
          taskId={reportTask.id}
          taskTitle={reportTask.title}
          userId={user.id}
          onClose={() => setReportTask(null)}
          onSubmitted={() => void load()}
        />
      ) : null}
    </div>
  );
}
