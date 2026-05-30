import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeeTaskList from '../../components/employee/EmployeeTaskList';

type Filter = 'today' | 'overdue' | 'all';

export default function EmployeeTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!user) return;
    void fetchTasksForEmployee(user.id).then(setTasks);
  }, [user]);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'overdue', label: 'Overdue' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">My tasks</h1>
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              filter === t.id
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <EmployeeTaskList tasks={tasks} filter={filter} />
    </div>
  );
}
