import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchRfisForEmployee } from '../../services/rfiService';
import { fetchAdjustmentsForEmployee } from '../../services/fieldAdjustmentService';
import { fetchMessagesForUser } from '../../services/fieldMessageService';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeeTaskList from './EmployeeTaskList';
import EmployeeProjectCard from './EmployeeProjectCard';
import EmployeeQuickActions from './EmployeeQuickActions';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [projects, setProjects] = useState<
    { id: string; name: string; jobsite_city?: string; jobsite_state?: string }[]
  >([]);
  const [openRfis, setOpenRfis] = useState(0);
  const [pendingAdj, setPendingAdj] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [t, p, rfis, adj, msgs] = await Promise.all([
        fetchTasksForEmployee(user.id),
        fetchAssignedProjects(user.id),
        fetchRfisForEmployee(user.id),
        fetchAdjustmentsForEmployee(user.id),
        fetchMessagesForUser(user.id, false),
      ]);
      setTasks(t);
      setProjects(p as typeof projects);
      setOpenRfis(rfis.filter((r) => r.status === 'Open').length);
      setPendingAdj(adj.filter((a) => a.status === 'Pending').length);
      setUnreadMsg(msgs.filter((m) => !m.isRead).length);
    })();
  }, [user]);

  const todayCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.dueDate) return t.status === 'In Progress';
        const d = new Date(t.dueDate);
        const n = new Date();
        return d.toDateString() === n.toDateString();
      }).length,
    [tasks],
  );

  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.dueDate || t.status === 'Completed') return false;
        return new Date(t.dueDate) < new Date(new Date().toDateString());
      }).length,
    [tasks],
  );

  const defaultProjectId = projects[0]?.id;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'My Tasks Today', value: todayCount },
          { label: 'Overdue', value: overdueCount },
          { label: 'Open RFIs', value: openRfis },
          { label: 'Adjustments', value: pendingAdj },
          { label: 'Messages', value: unreadMsg, className: 'col-span-2' },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border border-slate-700 bg-slate-800/80 p-3 ${c.className ?? ''}`}
          >
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-3">
          My assigned tasks
        </h2>
        <EmployeeTaskList tasks={tasks} filter="all" />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-3">
          My projects
        </h2>
        <div className="space-y-2">
          {projects.map((p) => (
            <EmployeeProjectCard
              key={p.id}
              id={p.id}
              name={p.name}
              city={p.jobsite_city}
              state={p.jobsite_state}
            />
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-slate-500">No projects assigned yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-3">
          Quick tools
        </h2>
        <EmployeeQuickActions userId={user.id} defaultProjectId={defaultProjectId} />
      </section>
    </div>
  );
}
