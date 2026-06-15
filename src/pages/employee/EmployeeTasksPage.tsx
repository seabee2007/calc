import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeeTaskCard from '../../components/employee/EmployeeTaskCard';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import ReportIssueSheet from '../../components/employee/ReportIssueSheet';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import {
  filterEmployeePlannerTasks,
  type EmployeePlannerChipFilter,
} from '../../utils/employeePlannerFilters';

const FILTER_CHIPS: { id: EmployeePlannerChipFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'assigned', label: 'Assigned to Me' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'completed', label: 'Completed' },
];

export default function EmployeeTasksPage() {
  useEmployeePageTitle('Tasks');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<EmployeePlannerChipFilter>('today');
  const [reportTask, setReportTask] = useState<PlannerTask | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loaded, assigned] = await Promise.all([
        fetchTasksForEmployee(user.id),
        fetchAssignedProjects(user.id),
      ]);
      setTasks(loaded);
      setProjects(assigned as { id: string; name: string }[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribePlannerRecordsChanged(() => void load()), [load]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filteredTasks = filterEmployeePlannerTasks(tasks, filter);

  const handleUploadPhoto = (task: PlannerTask) => {
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
    });
    navigate(`/employee/uploads?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <EmployeeFilterChips chips={FILTER_CHIPS} value={filter} onChange={setFilter} />

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
                projectName={projectMap.get(task.projectId) ?? 'Project'}
                onOpen={() => navigate(`/employee/tasks/${task.id}`)}
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
