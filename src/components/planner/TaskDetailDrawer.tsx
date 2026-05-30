import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, CheckCircle, RotateCcw } from 'lucide-react';
import type { PlannerTask, Profile, TaskStatus } from '../../types/fieldPlanner';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types/fieldPlanner';
import {
  fetchTaskById,
  reviewTask,
  submitTaskForReview,
  updateTask,
} from '../../services/plannerService';
import {
  fetchChecklistItems,
  fetchTaskAttachments,
  fetchTaskComments,
} from '../../services/taskActivityService';
import TaskChecklist from './TaskChecklist';
import TaskComments from './TaskComments';
import TaskAttachments from './TaskAttachments';
import { TaskPriorityBadge, TaskStatusBadge } from './TaskStatusBadge';
import Select from '../ui/Select';
import Button from '../ui/Button';
import CreateRfiModal from '../field/CreateRfiModal';
import CreateFieldAdjustmentModal from '../field/CreateFieldAdjustmentModal';
import {
  PLANNER_BTN_PRIMARY,
  PLANNER_DRAWER_BACKDROP,
  PLANNER_DRAWER_BODY,
  PLANNER_DRAWER_FOOTER,
  PLANNER_DRAWER_FULL_PAGE,
  PLANNER_DRAWER_HEADER,
  PLANNER_DRAWER_PANEL,
  PLANNER_DRAWER_TITLE,
  PLANNER_EYEBROW,
  PLANNER_CLOSE_BTN,
} from './plannerTheme';

interface TaskDetailDrawerProps {
  taskId: string | null;
  projectName: string;
  userId: string;
  isOwner: boolean;
  isEmployee: boolean;
  team: Profile[];
  buckets: { id: string; title: string }[];
  onClose: () => void;
  onUpdated: () => void;
  fullPage?: boolean;
}

export default function TaskDetailDrawer({
  taskId,
  projectName,
  userId,
  isOwner,
  isEmployee,
  team,
  buckets,
  onClose,
  onUpdated,
  fullPage = false,
}: TaskDetailDrawerProps) {
  const [task, setTask] = useState<PlannerTask | null>(null);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof fetchTaskComments>>>([]);
  const [checklist, setChecklist] = useState<Awaited<ReturnType<typeof fetchChecklistItems>>>([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof fetchTaskAttachments>>
  >([]);
  const [rfiOpen, setRfiOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!taskId) return;
    const [t, c, cl, a] = await Promise.all([
      fetchTaskById(taskId),
      fetchTaskComments(taskId),
      fetchChecklistItems(taskId),
      fetchTaskAttachments(taskId),
    ]);
    setTask(t);
    setComments(c);
    setChecklist(cl);
    setAttachments(a);
  }, [taskId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handlePatch = async (patch: Parameters<typeof updateTask>[1]) => {
    if (!task) return;
    setBusy(true);
    try {
      const updated = await updateTask(task.id, patch);
      setTask(updated);
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await submitTaskForReview(task.id);
      await reload();
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (decision: 'Approved' | 'Needs Revision' | 'Completed') => {
    if (!task) return;
    setBusy(true);
    try {
      await reviewTask(task.id, decision);
      await reload();
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const canEditTask = isOwner || (isEmployee && task?.assignedTo === userId);
  const canComment = canEditTask;

  if (!taskId) return null;

  const panel = (
    <AnimatePresence>
      {taskId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={fullPage ? PLANNER_DRAWER_FULL_PAGE : PLANNER_DRAWER_BACKDROP}
        >
          <motion.div
            initial={fullPage ? { opacity: 0, y: 12 } : { x: '100%' }}
            animate={fullPage ? { opacity: 1, y: 0 } : { x: 0 }}
            exit={fullPage ? { opacity: 0, y: 12 } : { x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={fullPage ? 'flex h-full flex-col' : PLANNER_DRAWER_PANEL}
            style={fullPage ? undefined : { maxWidth: 'min(100vw, 640px)' }}
          >
            <header className={PLANNER_DRAWER_HEADER}>
              <div>
                <p className={PLANNER_EYEBROW}>{projectName}</p>
                <h2 className={PLANNER_DRAWER_TITLE}>{task?.title ?? 'Loading…'}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={PLANNER_CLOSE_BTN}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {task && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <TaskStatusBadge status={task.status} />
                    <TaskPriorityBadge priority={task.priority} />
                  </div>

                  {isOwner && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        label="Status"
                        value={task.status}
                        onChange={(v) => void handlePatch({ status: v as TaskStatus })}
                        options={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
                      />
                      <Select
                        label="Priority"
                        value={task.priority}
                        onChange={(v) =>
                          void handlePatch({
                            priority: v as import('../../types/fieldPlanner').TaskPriority,
                          })
                        }
                        options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                      />
                      <Select
                        label="Bucket"
                        value={task.bucketId}
                        onChange={(v) => void handlePatch({ bucketId: v })}
                        options={buckets.map((b) => ({ value: b.id, label: b.title }))}
                      />
                      <Select
                        label="Assigned to"
                        value={task.assignedTo ?? ''}
                        onChange={(v) => void handlePatch({ assignedTo: v || null })}
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...team.map((m) => ({
                            value: m.id,
                            label: m.displayName ?? 'Team member',
                          })),
                        ]}
                      />
                    </div>
                  )}

                  {task.description && (
                    <p className={PLANNER_DRAWER_BODY}>{task.description}</p>
                  )}

                  <TaskChecklist
                    taskId={task.id}
                    items={checklist}
                    userId={userId}
                    canEdit={canEditTask}
                    onChange={() => void reload()}
                  />

                  <TaskAttachments
                    taskId={task.id}
                    projectId={task.projectId}
                    userId={userId}
                    attachments={attachments}
                    canUpload={canEditTask}
                    onChange={() => void reload()}
                  />

                  <TaskComments
                    taskId={task.id}
                    projectId={task.projectId}
                    userId={userId}
                    comments={comments}
                    canComment={canComment}
                    isOwner={isOwner}
                    onChange={() => void reload()}
                    onCreateRfi={() => setRfiOpen(true)}
                    onCreateAdjustment={() => setAdjustmentOpen(true)}
                  />
                </>
              )}
            </div>

            <footer className={PLANNER_DRAWER_FOOTER}>
              {isEmployee && canEditTask && (
                <>
                  {task?.status !== 'Submitted' && task?.status !== 'Completed' && (
                    <Button
                      className={`w-full min-h-[48px] ${PLANNER_BTN_PRIMARY}`}
                      icon={<Send className="h-4 w-4" />}
                      onClick={() => void handleSubmitForReview()}
                      disabled={busy}
                    >
                      Submit for review
                    </Button>
                  )}
                  {(task?.status === 'In Progress' || task?.status === 'Approved') && (
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px]"
                      icon={<CheckCircle className="h-4 w-4" />}
                      onClick={() => void handlePatch({ status: 'Completed' })}
                      disabled={busy}
                    >
                      Mark complete
                    </Button>
                  )}
                </>
              )}
              {isOwner && task?.status === 'Submitted' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="min-h-[48px]"
                    icon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => void handleReview('Approved')}
                    disabled={busy}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[48px]"
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => void handleReview('Needs Revision')}
                    disabled={busy}
                  >
                    Return
                  </Button>
                </div>
              )}
              {(isOwner || isEmployee) && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="min-h-12"
                    onClick={() => setRfiOpen(true)}
                  >
                    Create RFI
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12"
                    onClick={() => setAdjustmentOpen(true)}
                  >
                    Field adjustment
                  </Button>
                </div>
              )}
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      {task && (
        <>
          <CreateRfiModal
            isOpen={rfiOpen}
            onClose={() => setRfiOpen(false)}
            projectId={task.projectId}
            taskId={task.id}
            userId={userId}
            onCreated={() => void reload()}
          />
          <CreateFieldAdjustmentModal
            isOpen={adjustmentOpen}
            onClose={() => setAdjustmentOpen(false)}
            projectId={task.projectId}
            taskId={task.id}
            userId={userId}
            onCreated={() => void reload()}
          />
        </>
      )}
    </>
  );
}
