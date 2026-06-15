import React, { useState } from 'react';
import type { PlannerTask } from '../../types/fieldPlanner';
import { submitTaskForReview, updateTask, fetchTaskById } from '../../services/plannerService';
import { addTaskComment } from '../../services/taskActivityService';
import { dispatchPlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import Button from '../ui/Button';

interface EmployeeTaskStatusActionsProps {
  task: PlannerTask;
  userId: string;
  onUpdated: (task: PlannerTask) => void;
  onReportIssue: () => void;
}

export default function EmployeeTaskStatusActions({
  task,
  userId,
  onUpdated,
  onReportIssue,
}: EmployeeTaskStatusActionsProps) {
  const [busy, setBusy] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runUpdate = async (fn: () => Promise<PlannerTask | void>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      dispatchPlannerRecordsChanged();
      if (result) onUpdated(result);
    } catch {
      setError('Could not update task. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () =>
    void runUpdate(async () => updateTask(task.id, { status: 'In Progress' }));

  const handleSubmitForReview = () =>
    void runUpdate(async () => {
      await submitTaskForReview(task.id);
      const updated = await fetchTaskById(task.id);
      if (!updated) throw new Error('Task not found');
      return updated;
    });

  const handleResume = () =>
    void runUpdate(async () => updateTask(task.id, { status: 'In Progress' }));

  const handleComplete = () =>
    void runUpdate(async () => updateTask(task.id, { status: 'Completed' }));

  const handleBlockedSubmit = () => {
    const reason = blockedReason.trim();
    if (!reason) {
      setError('Please describe why work is blocked.');
      return;
    }
    void runUpdate(async () => {
      const updated = await updateTask(task.id, { status: 'Needs Revision' });
      await addTaskComment(
        task.id,
        task.projectId,
        userId,
        `[Blocked] ${reason}`,
      );
      setBlockedOpen(false);
      setBlockedReason('');
      return updated;
    });
  };

  if (task.status === 'Completed') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-200">
        Task completed
      </div>
    );
  }

  if (task.status === 'Approved') {
    return (
      <Button
        type="button"
        variant="accent"
        fullWidth
        className="min-h-[48px] text-base"
        disabled={busy}
        onClick={handleComplete}
      >
        Mark complete
      </Button>
    );
  }

  if (task.status === 'Submitted') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
        Submitted for review — waiting on admin
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {blockedOpen ? (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm font-medium text-white">Why is this blocked?</p>
          <textarea
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            rows={3}
            placeholder="Describe the issue blocking work…"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              className="min-h-[44px]"
              disabled={busy}
              onClick={() => {
                setBlockedOpen(false);
                setBlockedReason('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              fullWidth
              className="min-h-[44px]"
              disabled={busy}
              onClick={handleBlockedSubmit}
            >
              Mark blocked
            </Button>
          </div>
        </div>
      ) : (
        <>
          {task.status === 'Not Started' ? (
            <Button
              type="button"
              variant="accent"
              fullWidth
              className="min-h-[48px] text-base"
              disabled={busy}
              onClick={handleStart}
            >
              Start task
            </Button>
          ) : null}

          {task.status === 'In Progress' ? (
            <>
              <Button
                type="button"
                variant="accent"
                fullWidth
                className="min-h-[48px] text-base"
                disabled={busy}
                onClick={handleSubmitForReview}
              >
                Submit for review
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                className="min-h-[48px]"
                disabled={busy}
                onClick={() => setBlockedOpen(true)}
              >
                Mark blocked
              </Button>
            </>
          ) : null}

          {task.status === 'Needs Revision' ? (
            <Button
              type="button"
              variant="accent"
              fullWidth
              className="min-h-[48px] text-base"
              disabled={busy}
              onClick={handleResume}
            >
              Resume task
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            fullWidth
            className="min-h-[44px]"
            disabled={busy}
            onClick={onReportIssue}
          >
            Report issue
          </Button>
        </>
      )}
    </div>
  );
}
