import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchRfisForEmployee } from '../../services/rfiService';
import { fetchAdjustmentsForEmployee } from '../../services/fieldAdjustmentService';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeeProjectCard from './EmployeeProjectCard';
import EmployeeQuickActions from './EmployeeQuickActions';
import EmployeeTaskCard from './EmployeeTaskCard';
import ReportIssueSheet from './ReportIssueSheet';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import {
  countDueToday,
  filterEmployeePlannerTasks,
  isTaskOverdue,
} from '../../utils/employeePlannerFilters';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(displayName?: string | null, email?: string | null): string {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0] ?? 'there';
  if (email) return email.split('@')[0] ?? 'there';
  return 'there';
}

export default function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [projects, setProjects] = useState<
    { id: string; name: string; jobsite_city?: string; jobsite_state?: string }[]
  >([]);
  const [openRfis, setOpenRfis] = useState(0);
  const [pendingAdj, setPendingAdj] = useState(0);
  const [reportTask, setReportTask] = useState<PlannerTask | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [t, p, rfis, adj] = await Promise.all([
      fetchTasksForEmployee(user.id),
      fetchAssignedProjects(user.id),
      fetchRfisForEmployee(user.id),
      fetchAdjustmentsForEmployee(user.id),
    ]);
    setTasks(t);
    setProjects(p as typeof projects);
    setOpenRfis(rfis.filter((r) => r.status === 'Open' || r.status === 'Pending Response').length);
    setPendingAdj(adj.filter((a) => a.status === 'Pending').length);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribePlannerRecordsChanged(() => void load()), [load]);

  const todayCount = useMemo(() => countDueToday(tasks), [tasks]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isTaskOverdue(t.dueDate, t.status)).length,
    [tasks],
  );

  const previewTasks = useMemo(
    () => filterEmployeePlannerTasks(tasks, 'assigned').slice(0, 3),
    [tasks],
  );

  const previewProjects = useMemo(() => projects.slice(0, 3), [projects]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const defaultProjectId = projects[0]?.id;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (!user) return null;

  const summaryCards = [
    { label: 'My Tasks Today', value: todayCount, href: '/employee/tasks' },
    { label: 'Overdue', value: overdueCount, href: '/employee/tasks' },
    { label: 'Open RFIs', value: openRfis, href: '/employee/rfi' },
    { label: 'Pending FARs', value: pendingAdj, href: '/employee/far' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4">
        <p className="text-sm text-slate-400">{todayLabel}</p>
        <h1 className="mt-1 text-xl font-bold text-white">
          {getGreeting()}, {getFirstName(profile?.displayName ?? profile?.firstName, user.email)}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((c) => (
          <Link
            key={c.label}
            to={c.href}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 touch-manipulation hover:border-cyan-500/40"
          >
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            My assigned tasks
          </h2>
          <Link to="/employee/tasks" className="text-xs font-medium text-cyan-400">
            See all →
          </Link>
        </div>
        {previewTasks.length === 0 ? (
          <p className="text-sm text-slate-500">No assigned tasks right now.</p>
        ) : (
          <ul className="space-y-3">
            {previewTasks.map((task) => (
              <li key={task.id}>
                <EmployeeTaskCard
                  task={task}
                  projectName={projectMap.get(task.projectId) ?? 'Project'}
                  onOpen={() => navigate(`/employee/tasks/${task.id}`)}
                  onUploadPhoto={() => {
                    const params = new URLSearchParams({
                      taskId: task.id,
                      taskTitle: task.title,
                    });
                    navigate(`/employee/uploads?${params.toString()}`);
                  }}
                  onReportIssue={() => setReportTask(task)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            My projects
          </h2>
          <Link to="/employee/projects" className="text-xs font-medium text-cyan-400">
            See all →
          </Link>
        </div>
        <div className="space-y-2">
          {previewProjects.map((p) => (
            <EmployeeProjectCard
              key={p.id}
              id={p.id}
              name={p.name}
              city={p.jobsite_city}
              state={p.jobsite_state}
            />
          ))}
          {previewProjects.length === 0 && (
            <p className="text-sm text-slate-500">No projects assigned yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
          Quick tools
        </h2>
        <EmployeeQuickActions
          userId={user.id}
          defaultProjectId={defaultProjectId}
          onRecordsChanged={() => void load()}
        />
      </section>

      {reportTask ? (
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
