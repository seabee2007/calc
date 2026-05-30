import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTaskById } from '../../services/plannerService';
import { supabase } from '../../lib/supabase';
import TaskDetailDrawer from '../../components/planner/TaskDetailDrawer';

export default function EmployeeTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user, isEmployee } = useAuth();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('Project');
  const [buckets, setBuckets] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!taskId) return;
    void (async () => {
      const task = await fetchTaskById(taskId);
      if (!task) return;
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', task.projectId)
        .maybeSingle();
      if (project?.name) setProjectName(project.name as string);

      const { data: bucketRows } = await supabase
        .from('planner_buckets')
        .select('id, title')
        .eq('board_id', task.boardId);
      setBuckets((bucketRows ?? []).map((b) => ({ id: b.id as string, title: b.title as string })));
    })();
  }, [taskId]);

  if (!user || !taskId) return null;

  return (
    <TaskDetailDrawer
      taskId={taskId}
      projectName={projectName}
      userId={user.id}
      isOwner={false}
      isEmployee={isEmployee}
      team={[]}
      buckets={buckets}
      onClose={() => navigate('/employee/tasks')}
      onUpdated={() => {}}
      fullPage
    />
  );
}
