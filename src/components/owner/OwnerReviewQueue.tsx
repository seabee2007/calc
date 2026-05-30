import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForOwner, reviewTask } from '../../services/plannerService';
import { fetchOpenRfisForOwner } from '../../services/rfiService';
import { fetchPendingAdjustmentsForOwner } from '../../services/fieldAdjustmentService';
import type { PlannerTask, RfiRequest, FieldAdjustmentRequest } from '../../types/fieldPlanner';
import { TaskStatusBadge } from '../planner/TaskStatusBadge';
import Button from '../ui/Button';
import OpsCard from '../dashboard/OpsCard';
import { respondToRfi } from '../../services/rfiService';
import { reviewFieldAdjustment } from '../../services/fieldAdjustmentService';

export default function OwnerReviewQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [adjustments, setAdjustments] = useState<FieldAdjustmentRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    const [t, r, a] = await Promise.all([
      fetchTasksForOwner(user.id),
      fetchOpenRfisForOwner(user.id),
      fetchPendingAdjustmentsForOwner(user.id),
    ]);
    setTasks(t.filter((x) => x.status === 'Submitted'));
    setRfis(r);
    setAdjustments(a);
  };

  useEffect(() => {
    void reload();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <OpsCard className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Tasks awaiting review</h2>
        {tasks.length === 0 && (
          <p className="text-sm text-slate-400">No submitted tasks.</p>
        )}
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-100">{task.title}</p>
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/projects/${task.projectId}/planner?task=${task.id}`)}
                >
                  Review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === task.id}
                  onClick={async () => {
                    setBusyId(task.id);
                    await reviewTask(task.id, 'Approved');
                    await reload();
                    setBusyId(null);
                  }}
                >
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </OpsCard>

      <OpsCard className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Open RFIs</h2>
        <ul className="space-y-3">
          {rfis.map((rfi) => (
            <li key={rfi.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
              <p className="font-medium text-slate-100">{rfi.title}</p>
              <p className="text-sm text-slate-400 mt-1">{rfi.question}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const response = window.prompt('Owner response:');
                    if (!response) return;
                    await respondToRfi(rfi.id, user.id, response);
                    await reload();
                  }}
                >
                  Respond
                </Button>
              </div>
            </li>
          ))}
          {rfis.length === 0 && <p className="text-sm text-slate-400">No open RFIs.</p>}
        </ul>
      </OpsCard>

      <OpsCard className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Pending field adjustments</h2>
        <ul className="space-y-3">
          {adjustments.map((adj) => (
            <li key={adj.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
              <p className="font-medium text-slate-100">{adj.title}</p>
              <p className="text-sm text-slate-400 mt-1">{adj.description}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await reviewFieldAdjustment(adj.id, user.id, 'Approved');
                    await reload();
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await reviewFieldAdjustment(adj.id, user.id, 'Rejected');
                    await reload();
                  }}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
          {adjustments.length === 0 && (
            <p className="text-sm text-slate-400">No pending adjustments.</p>
          )}
        </ul>
      </OpsCard>
    </div>
  );
}
