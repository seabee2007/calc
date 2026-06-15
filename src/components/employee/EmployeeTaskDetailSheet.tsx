import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlannerTask } from '../../types/fieldPlanner';
import { fetchTaskById } from '../../services/plannerService';
import {
  fetchChecklistItems,
  fetchTaskAttachments,
  fetchTaskComments,
} from '../../services/taskActivityService';
import TaskChecklist from '../planner/TaskChecklist';
import TaskComments from '../planner/TaskComments';
import TaskAttachments from '../planner/TaskAttachments';
import { TaskPriorityBadge, TaskStatusBadge } from '../planner/TaskStatusBadge';
import EmployeeTaskStatusActions from './EmployeeTaskStatusActions';
import ReportIssueSheet from './ReportIssueSheet';
import Button from '../ui/Button';

interface EmployeeTaskDetailSheetProps {
  task: PlannerTask;
  projectName: string;
  jobsiteLabel?: string;
  userId: string;
  onClose: () => void;
  onUpdated: (task: PlannerTask) => void;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function EmployeeTaskDetailSheet({
  task: initialTask,
  projectName,
  jobsiteLabel,
  userId,
  onClose,
  onUpdated,
}: EmployeeTaskDetailSheetProps) {
  const navigate = useNavigate();
  const [task, setTask] = useState(initialTask);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof fetchTaskComments>>>([]);
  const [checklist, setChecklist] = useState<Awaited<ReturnType<typeof fetchChecklistItems>>>([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof fetchTaskAttachments>>
  >([]);
  const [reportOpen, setReportOpen] = useState(false);

  const reload = useCallback(async () => {
    const [t, c, cl, a] = await Promise.all([
      fetchTaskById(initialTask.id),
      fetchTaskComments(initialTask.id),
      fetchChecklistItems(initialTask.id),
      fetchTaskAttachments(initialTask.id),
    ]);
    if (t) setTask(t);
    setComments(c);
    setChecklist(cl);
    setAttachments(a);
    return t;
  }, [initialTask.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleUpdated = (updated: PlannerTask) => {
    setTask(updated);
    onUpdated(updated);
    void reload();
  };

  const handleUploadPhoto = () => {
    const params = new URLSearchParams({
      taskId: task.id,
      taskTitle: task.title,
    });
    navigate(`/employee/uploads?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <header
        className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"
            aria-label="Back to planner"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">{task.title}</h1>
            <p className="truncate text-xs text-slate-400">{projectName}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-48">
        <div className="space-y-4">
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
              userId={userId}
              canEdit
              onChange={() => void reload()}
            />
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <TaskAttachments
              taskId={task.id}
              projectId={task.projectId}
              userId={userId}
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
              userId={userId}
              comments={comments}
              canComment
              onChange={() => void reload()}
              onCreateAdjustment={() => setReportOpen(true)}
            />
          </section>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      >
        <EmployeeTaskStatusActions
          task={task}
          userId={userId}
          onUpdated={handleUpdated}
          onReportIssue={() => setReportOpen(true)}
        />
      </div>

      <ReportIssueSheet
        open={reportOpen}
        projectId={task.projectId}
        taskId={task.id}
        taskTitle={task.title}
        userId={userId}
        onClose={() => setReportOpen(false)}
        onSubmitted={() => void reload()}
      />
    </div>
  );
}
