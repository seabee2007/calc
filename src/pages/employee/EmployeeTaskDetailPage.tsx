import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchTaskById } from '../../services/plannerService';
import {
  fetchChecklistItems,
  fetchTaskAttachments,
  fetchTaskComments,
} from '../../services/taskActivityService';
import type { PlannerTask } from '../../types/fieldPlanner';
import TaskChecklist from '../../components/planner/TaskChecklist';
import TaskComments from '../../components/planner/TaskComments';
import TaskAttachments from '../../components/planner/TaskAttachments';
import { TaskPriorityBadge, TaskStatusBadge } from '../../components/planner/TaskStatusBadge';
import EmployeeTaskStatusActions from '../../components/employee/EmployeeTaskStatusActions';
import ReportIssueSheet from '../../components/employee/ReportIssueSheet';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function EmployeeTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<PlannerTask | null>(null);
  const [projectName, setProjectName] = useState('Project');
  const [jobsiteLabel, setJobsiteLabel] = useState<string | undefined>();
  const [comments, setComments] = useState<Awaited<ReturnType<typeof fetchTaskComments>>>([]);
  const [checklist, setChecklist] = useState<Awaited<ReturnType<typeof fetchChecklistItems>>>([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof fetchTaskAttachments>>
  >([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEmployeePageTitle(task?.title ?? 'Task Details');

  const reload = useCallback(async () => {
    if (!taskId || !user) return;
    setLoading(true);
    try {
      const [loadedTask, c, cl, a, projects] = await Promise.all([
        fetchTaskById(taskId),
        fetchTaskComments(taskId),
        fetchChecklistItems(taskId),
        fetchTaskAttachments(taskId),
        fetchAssignedProjects(user.id),
      ]);
      if (!loadedTask) {
        setTask(null);
        return;
      }
      setTask(loadedTask);
      setComments(c);
      setChecklist(cl);
      setAttachments(a);
      const project = (projects as { id: string; name: string; jobsite_city?: string; jobsite_state?: string }[]).find(
        (p) => p.id === loadedTask.projectId,
      );
      if (project) {
        setProjectName(project.name);
        const parts = [project.jobsite_city, project.jobsite_state].filter(Boolean);
        setJobsiteLabel(parts.length > 0 ? parts.join(', ') : undefined);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => subscribePlannerRecordsChanged(() => void reload()), [reload]);

  const handleUpdated = (updated: PlannerTask) => {
    setTask(updated);
    void reload();
  };

  const handleUploadPhoto = () => {
    if (!task) return;
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
    });
    navigate(`/employee/uploads?${params.toString()}`);
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading task…</p>;
  }

  if (!task || !user) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">Task not found.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/employee/tasks')}>
          Back to tasks
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-40">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Project</dt>
            <dd className="text-right text-slate-200">{projectName}</dd>
          </div>
          {jobsiteLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Jobsite</dt>
              <dd className="text-right text-slate-200">{jobsiteLabel}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Due</dt>
            <dd className="text-right text-slate-200">{formatDueDate(task.dueDate)}</dd>
          </div>
        </dl>
      </div>

      {task.description ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{task.description}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <TaskChecklist
          taskId={task.id}
          items={checklist}
          userId={user.id}
          canEdit
          onChange={() => void reload()}
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <TaskAttachments
          taskId={task.id}
          projectId={task.projectId}
          userId={user.id}
          attachments={attachments}
          canUpload
          onChange={() => void reload()}
        />
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            fullWidth
            className="min-h-[44px]"
            icon={<Camera className="h-4 w-4" />}
            onClick={handleUploadPhoto}
          >
            Upload photo
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <TaskComments
          taskId={task.id}
          projectId={task.projectId}
          userId={user.id}
          comments={comments}
          canComment
          onChange={() => void reload()}
          onCreateAdjustment={() => setReportOpen(true)}
        />
      </section>

      <div
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-0 right-0 z-30 mx-auto max-w-lg border-t border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur"
      >
        <EmployeeTaskStatusActions
          task={task}
          userId={user.id}
          onUpdated={handleUpdated}
          onReportIssue={() => setReportOpen(true)}
        />
      </div>

      <ReportIssueSheet
        open={reportOpen}
        projectId={task.projectId}
        taskId={task.id}
        taskTitle={task.title}
        userId={user.id}
        onClose={() => setReportOpen(false)}
        onSubmitted={() => void reload()}
      />
    </div>
  );
}
