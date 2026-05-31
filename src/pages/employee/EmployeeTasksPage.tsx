import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import type { PlannerTask } from '../../types/fieldPlanner';
import EmployeeTaskList from '../../components/employee/EmployeeTaskList';
import Button from '../../components/ui/Button';

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
    <div className="mx-auto max-w-3xl flex-1 p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">My tasks</h1>
      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={filter === t.id ? 'accent' : 'outline'}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <EmployeeTaskList tasks={tasks} filter={filter} />
    </div>
  );
}
