import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForOwner, reviewTask } from '../../services/plannerService';
import { fetchOpenRfisForOwner } from '../../services/rfiService';
import { fetchPendingAdjustmentsForOwner } from '../../services/fieldAdjustmentService';
import type { PlannerTask, RfiRequest, FieldAdjustmentRequest } from '../../types/fieldPlanner';
import {
  plannerAdjustmentHref,
  plannerBoardHref,
  plannerRfiHref,
} from '../../utils/plannerRoutes';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';
import { TaskStatusBadge } from '../planner/TaskStatusBadge';
import Button from '../ui/Button';
import OpsCard from '../dashboard/OpsCard';

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.08, ease: 'easeOut' },
  }),
};

export default function OwnerReviewQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [adjustments, setAdjustments] = useState<FieldAdjustmentRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!user) return;
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const [t, r, a] = await Promise.all([
        fetchTasksForOwner(user.id),
        fetchOpenRfisForOwner(user.id),
        fetchPendingAdjustmentsForOwner(user.id),
      ]);
      setTasks(t.filter((x) => x.status === 'Submitted'));
      setRfis(r);
      setAdjustments(a);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) return null;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center py-16"
        aria-busy
        aria-label="Loading review queue"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <motion.div custom={0} initial="hidden" animate="visible" variants={sectionVariants}>
        <OpsCard className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Tasks awaiting review</h2>
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
                    onClick={() => navigate(plannerBoardHref(task.projectId, task.id))}
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
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={sectionVariants}>
        <OpsCard className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Open RFIs</h2>
          <ul className="space-y-3">
            {rfis.map((rfi) => (
              <li
                key={rfi.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {rfi.displayNumber && (
                      <span className="font-mono text-xs text-cyan-400">{rfi.displayNumber}</span>
                    )}
                    <FieldRecordStatusBadge status={rfi.status} />
                  </div>
                  <p className="mt-1 font-medium text-slate-100">{rfi.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{rfi.question}</p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate(plannerRfiHref(rfi.projectId, rfi.id))}
                >
                  Open
                </Button>
              </li>
            ))}
            {rfis.length === 0 && <p className="text-sm text-slate-400">No open RFIs.</p>}
          </ul>
        </OpsCard>
      </motion.div>

      <motion.div custom={2} initial="hidden" animate="visible" variants={sectionVariants}>
        <OpsCard className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Pending field adjustments</h2>
          <ul className="space-y-3">
            {adjustments.map((adj) => (
              <li
                key={adj.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {adj.displayNumber && (
                      <span className="font-mono text-xs text-cyan-400">{adj.displayNumber}</span>
                    )}
                    <FieldRecordStatusBadge status={adj.status} />
                  </div>
                  <p className="mt-1 font-medium text-slate-100">{adj.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                    {adj.conditionDescription ?? adj.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate(plannerAdjustmentHref(adj.projectId, adj.id))}
                >
                  Review
                </Button>
              </li>
            ))}
            {adjustments.length === 0 && (
              <p className="text-sm text-slate-400">No pending adjustments.</p>
            )}
          </ul>
        </OpsCard>
      </motion.div>
    </motion.div>
  );
}
