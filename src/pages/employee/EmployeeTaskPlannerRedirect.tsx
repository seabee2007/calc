import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTaskById } from '../../services/plannerService';
import { supabase } from '../../lib/supabase';
import { plannerBoardHref } from '../../utils/plannerRoutes';

export default function EmployeeTaskPlannerRedirect() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!taskId || !user) return;
    void (async () => {
      const task = await fetchTaskById(taskId);
      if (!task) {
        setDenied(true);
        return;
      }

      const { data: assignment } = await supabase
        .from('employee_project_assignments')
        .select('id')
        .eq('project_id', task.projectId)
        .eq('employee_id', user.id)
        .maybeSingle();

      if (!assignment && task.assignedTo !== user.id) {
        setDenied(true);
        return;
      }

      setTarget(plannerBoardHref(task.projectId, task.id));
    })();
  }, [taskId, user]);

  if (denied) {
    return <Navigate to="/employee/tasks" replace />;
  }

  if (!target) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
