import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForOwner, reviewTask } from '../../services/plannerService';
import { fetchOpenRfisForOwner } from '../../services/rfiService';
import {
  fetchApprovedFarsNeedingChangeOrder,
  fetchPendingAdjustmentsForOwner,
} from '../../services/fieldAdjustmentService';
import { fetchChangeOrdersForOwnerReview } from '../../services/changeOrderService';
import type { ChangeOrder } from '../../types/changeOrder';
import type { PlannerTask, RfiRequest, FieldAdjustmentRequest } from '../../types/fieldPlanner';
import {
  changeOrderEditHref,
  changeOrderNewHref,
  plannerAdjustmentHref,
  plannerBoardHref,
  plannerRfiHref,
} from '../../utils/plannerRoutes';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import {
  APP_SECTION_CARD,
  TEXT_ACCENT,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_WARNING,
} from '../../theme/appTheme';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';
import { TaskStatusBadge } from '../planner/TaskStatusBadge';
import Button from '../ui/Button';

/** Short labels for shared status badge styles. */
const CHANGE_ORDER_BADGE_STATUS: Record<ChangeOrder['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Closed',
};

function changeOrderActionLabel(status: ChangeOrder['status']): string {
  if (status === 'draft') return 'Edit';
  if (status === 'declined') return 'Revise';
  return 'Open';
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.08, ease: 'easeOut' },
  }),
};

const QUEUE_SECTION_CARD = `${APP_SECTION_CARD} !p-4`;

const QUEUE_LIST_ROW =
  'flex flex-col gap-2 rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 transition-colors hover:bg-slate-100/80 dark:border-slate-700/70 dark:bg-slate-950/40 dark:hover:bg-slate-800/60 sm:flex-row sm:items-start sm:justify-between';

const FAR_CO_ROW =
  'flex flex-col gap-2 rounded-lg border border-amber-200/70 bg-amber-50/80 p-3 transition-colors hover:bg-amber-100/80 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 sm:flex-row sm:items-start sm:justify-between';

export default function OwnerReviewQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [adjustments, setAdjustments] = useState<FieldAdjustmentRequest[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [farsNeedingCo, setFarsNeedingCo] = useState<FieldAdjustmentRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!user) return;
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const [t, r, a, co, farCo] = await Promise.all([
        fetchTasksForOwner(user.id),
        fetchOpenRfisForOwner(user.id),
        fetchPendingAdjustmentsForOwner(user.id),
        fetchChangeOrdersForOwnerReview(user.id),
        fetchApprovedFarsNeedingChangeOrder(user.id),
      ]);
      setTasks(t.filter((x) => x.status === 'Submitted'));
      setRfis(r);
      setAdjustments(a);
      setChangeOrders(co);
      setFarsNeedingCo(farCo);
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-cyan-400" />
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
        <div className={QUEUE_SECTION_CARD}>
          <h2 className={`mb-4 text-lg font-semibold ${TEXT_FOREGROUND}`}>Submitted tasks</h2>
          {tasks.length === 0 && (
            <p className={`text-sm ${TEXT_MUTED}`}>No submitted tasks.</p>
          )}
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`${QUEUE_LIST_ROW} sm:items-center`}
              >
                <div>
                  <p className={`font-medium ${TEXT_FOREGROUND}`}>{task.title}</p>
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
        </div>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={sectionVariants}>
        <div className={QUEUE_SECTION_CARD}>
          <h2 className={`mb-4 text-lg font-semibold ${TEXT_FOREGROUND}`}>Open RFIs</h2>
          <ul className="space-y-3">
            {rfis.map((rfi) => (
              <li key={rfi.id} className={QUEUE_LIST_ROW}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {rfi.displayNumber && (
                      <span className={`font-mono text-xs ${TEXT_ACCENT}`}>{rfi.displayNumber}</span>
                    )}
                    <FieldRecordStatusBadge status={rfi.status} />
                  </div>
                  <p className={`mt-1 font-medium ${TEXT_FOREGROUND}`}>{rfi.title}</p>
                  <p className={`mt-1 line-clamp-2 text-sm ${TEXT_MUTED}`}>{rfi.question}</p>
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
            {rfis.length === 0 && (
              <p className={`text-sm ${TEXT_MUTED}`}>No open RFIs.</p>
            )}
          </ul>
        </div>
      </motion.div>

      <motion.div custom={2} initial="hidden" animate="visible" variants={sectionVariants}>
        <div className={QUEUE_SECTION_CARD}>
          <h2 className={`mb-4 text-lg font-semibold ${TEXT_FOREGROUND}`}>
            Pending adjustments
          </h2>
          <ul className="space-y-3">
            {adjustments.map((adj) => (
              <li key={adj.id} className={QUEUE_LIST_ROW}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {adj.displayNumber && (
                      <span className={`font-mono text-xs ${TEXT_ACCENT}`}>{adj.displayNumber}</span>
                    )}
                    <FieldRecordStatusBadge status={adj.status} />
                  </div>
                  <p className={`mt-1 font-medium ${TEXT_FOREGROUND}`}>{adj.title}</p>
                  <p className={`mt-1 line-clamp-2 text-sm ${TEXT_MUTED}`}>
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
              <p className={`text-sm ${TEXT_MUTED}`}>No pending adjustments.</p>
            )}
          </ul>
        </div>
      </motion.div>

      <motion.div custom={3} initial="hidden" animate="visible" variants={sectionVariants}>
        <div className={QUEUE_SECTION_CARD}>
          <h2 className={`mb-4 text-lg font-semibold ${TEXT_FOREGROUND}`}>Change orders</h2>
          <ul className="space-y-3">
            {farsNeedingCo.map((adj) => (
              <li key={`far-co-${adj.id}`} className={FAR_CO_ROW}>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium uppercase tracking-wide ${TEXT_WARNING}`}>
                    Create from approved FAR
                  </p>
                  {adj.displayNumber && (
                    <span className={`mt-1 inline-block font-mono text-xs ${TEXT_ACCENT}`}>
                      {adj.displayNumber}
                    </span>
                  )}
                  <p className={`mt-1 font-medium ${TEXT_FOREGROUND}`}>{adj.title}</p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate(changeOrderNewHref(adj.projectId, { far: adj.id }))}
                >
                  Create CO
                </Button>
              </li>
            ))}
            {changeOrders.map((co) => (
              <li key={co.id} className={QUEUE_LIST_ROW}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {co.displayNumber && (
                      <span className={`font-mono text-xs ${TEXT_ACCENT}`}>{co.displayNumber}</span>
                    )}
                    <FieldRecordStatusBadge status={CHANGE_ORDER_BADGE_STATUS[co.status]} />
                  </div>
                  <p className={`mt-1 font-medium ${TEXT_FOREGROUND}`}>{co.title}</p>
                  <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
                    {formatChangeOrderMoney(co.total)}
                    {co.status === 'draft' && ' · Finish pricing and send to client'}
                    {(co.status === 'sent' || co.status === 'viewed') &&
                      ' · Awaiting client decision'}
                    {co.status === 'declined' && ' · Client declined — revise or void'}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate(changeOrderEditHref(co.projectId, co.id))}
                >
                  {changeOrderActionLabel(co.status)}
                </Button>
              </li>
            ))}
            {farsNeedingCo.length === 0 && changeOrders.length === 0 && (
              <p className={`text-sm ${TEXT_MUTED}`}>No change orders need attention.</p>
            )}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
}
