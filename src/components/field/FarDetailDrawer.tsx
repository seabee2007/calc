import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { FarStatus, FieldAdjustmentRequest } from '../../types/fieldPlanner';
import {
  canEmployeeEditAdjustment,
  fetchAdjustmentById,
  hasLegacyPricing,
  reviewFieldAdjustment,
  updateFieldAdjustment,
} from '../../services/fieldAdjustmentService';
import { fetchAdjustmentAttachments } from '../../services/fieldRecordAttachmentService';
import type { FieldRecordAttachment } from '../../types/fieldPlanner';
import { fetchProfilesByIds, displayNameFor } from '../../services/profileService';
import { changeOrderEditHref, openNewChangeOrder } from '../../utils/plannerRoutes';
import FieldRecordStatusBadge from './FieldRecordStatusBadge';
import FieldRecordAttachmentsList from './FieldRecordAttachmentsList';
import Button from '../ui/Button';
import {
  PLANNER_CLOSE_BTN,
  PLANNER_DRAWER_BACKDROP,
  PLANNER_DRAWER_BODY,
  PLANNER_DRAWER_FOOTER,
  PLANNER_DRAWER_HEADER,
  PLANNER_DRAWER_PANEL,
  PLANNER_DRAWER_TITLE,
  PLANNER_BTN_PRIMARY,
} from '../planner/plannerTheme';

interface FarDetailDrawerProps {
  adjustmentId: string | null;
  userId: string;
  isOwner: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === false) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function ImpactFlags({ adj }: { adj: FieldAdjustmentRequest }) {
  const flags: string[] = [];
  if (adj.potentialCostImpact) flags.push('Potential cost impact');
  if (adj.potentialScheduleImpact) flags.push('Potential schedule impact');
  if (adj.impactSafety) flags.push('Safety');
  if (adj.impactQuality) flags.push('Quality');
  if (adj.requiresChangeOrder) flags.push('Change order required');
  if (flags.length === 0) return null;
  return (
    <DetailRow
      label="Impacts"
      value={
        <ul className="list-disc pl-4">
          {flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      }
    />
  );
}

export default function FarDetailDrawer({
  adjustmentId,
  userId,
  isOwner,
  onClose,
  onUpdated,
}: FarDetailDrawerProps) {
  const navigate = useNavigate();
  const [adj, setAdj] = useState<FieldAdjustmentRequest | null>(null);
  const [attachments, setAttachments] = useState<FieldRecordAttachment[]>([]);
  const [submitterName, setSubmitterName] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!adjustmentId) return;
    const [a, att] = await Promise.all([
      fetchAdjustmentById(adjustmentId),
      fetchAdjustmentAttachments(adjustmentId),
    ]);
    if (!a) return;
    setAdj(a);
    setAttachments(att);
    setComment(a.ownerResponse ?? '');
    const profiles = await fetchProfilesByIds([a.submittedBy]);
    setSubmitterName(displayNameFor(profiles.get(a.submittedBy), 'Team member'));
  }, [adjustmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit =
    adj && !isOwner && adj.submittedBy === userId && canEmployeeEditAdjustment(adj);

  const handleReview = async (status: FarStatus, flagCo?: boolean) => {
    if (!adj) return;
    setBusy(true);
    try {
      await reviewFieldAdjustment(adj.id, userId, status, comment.trim() || undefined, {
        flagRequiresChangeOrder: flagCo,
      });
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const formatCost = (n: number | null) =>
    n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : null;

  const canCreateCo =
    isOwner && adj && adj.status === 'Approved' && !adj.changeOrderId;

  const showLegacyCosts = adj && hasLegacyPricing(adj);

  if (!adjustmentId) return null;

  return createPortal(
    <AnimatePresence>
      {adjustmentId && (
        <motion.div
          className={PLANNER_DRAWER_BACKDROP}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className={`${PLANNER_DRAWER_PANEL} max-w-lg`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={PLANNER_DRAWER_HEADER}>
              <div>
                <p className="text-xs text-cyan-700 dark:text-cyan-400">
                  {adj?.displayNumber ?? 'FAR'}
                </p>
                <h2 className={PLANNER_DRAWER_TITLE}>{adj?.title ?? 'Loading…'}</h2>
              </div>
              <button type="button" onClick={onClose} className={PLANNER_CLOSE_BTN} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {adj && (
                <>
                  <div className="mb-4">
                    <FieldRecordStatusBadge status={adj.status} />
                  </div>
                  <dl className="space-y-3">
                    <DetailRow label="Submitted by" value={submitterName} />
                    <DetailRow label="Date" value={new Date(adj.createdAt).toLocaleString()} />
                    <DetailRow label="Location" value={adj.location} />
                    <DetailRow label="Reason" value={adj.reason} />
                    <DetailRow
                      label="Condition found"
                      value={
                        <p className={PLANNER_DRAWER_BODY}>
                          {adj.conditionDescription ?? adj.description}
                        </p>
                      }
                    />
                    <DetailRow label="Recommended adjustment" value={adj.proposedAdjustment} />
                    <DetailRow label="Recommended action" value={adj.recommendedAction} />
                    <ImpactFlags adj={adj} />
                    {adj.potentialScheduleImpact && (
                      <DetailRow label="Schedule impact" value={adj.scheduleImpact} />
                    )}
                    {showLegacyCosts && (
                      <>
                        <DetailRow label="Legacy est. cost" value={formatCost(adj.estimatedCost)} />
                        <DetailRow label="Legacy labor" value={formatCost(adj.laborImpact)} />
                        <DetailRow label="Legacy material" value={formatCost(adj.materialImpact)} />
                        <DetailRow label="Legacy equipment" value={formatCost(adj.equipmentCost)} />
                      </>
                    )}
                    {adj.changeOrderId && (
                      <DetailRow
                        label="Change order"
                        value={
                          <button
                            type="button"
                            className="text-cyan-600 hover:underline dark:text-cyan-400"
                            onClick={() => {
                              navigate(changeOrderEditHref(adj.projectId, adj.changeOrderId!));
                              onClose();
                            }}
                          >
                            View change order
                          </button>
                        }
                      />
                    )}
                  </dl>
                  {adj.ownerResponse && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="text-xs font-semibold text-gray-500">Owner comments</p>
                      <p className="mt-1 text-sm">{adj.ownerResponse}</p>
                    </div>
                  )}
                  <FieldRecordAttachmentsList attachments={attachments} />
                </>
              )}
            </div>

            <footer className={PLANNER_DRAWER_FOOTER}>
              {canEdit && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const title = window.prompt('Title', adj?.title ?? '');
                    const cond = window.prompt(
                      'Condition',
                      adj?.conditionDescription ?? adj?.description ?? '',
                    );
                    if (title && cond && adj) {
                      void updateFieldAdjustment(adj.id, {
                        title,
                        conditionDescription: cond,
                      }).then(() => {
                        void load();
                        onUpdated();
                      });
                    }
                  }}
                >
                  Edit request
                </Button>
              )}
              {isOwner && adj && ['Pending', 'Needs More Information'].includes(adj.status) && (
                <div className="space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Comments (optional)…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className={PLANNER_BTN_PRIMARY}
                      disabled={busy}
                      onClick={() =>
                        void handleReview(
                          'Approved',
                          adj.requiresChangeOrder || adj.potentialCostImpact,
                        )
                      }
                    >
                      Approve FAR
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleReview('Rejected')}
                    >
                      Reject FAR
                    </Button>
                    <Button
                      variant="outline"
                      className="col-span-2"
                      disabled={busy}
                      onClick={() => void handleReview('Needs More Information')}
                    >
                      Request More Information
                    </Button>
                  </div>
                </div>
              )}
              {canCreateCo && (
                <>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Create a priced change order for the client when scope has cost impact.
                  </p>
                  <Button
                    className={`w-full ${PLANNER_BTN_PRIMARY}`}
                    onClick={() => {
                      openNewChangeOrder(navigate, adj.projectId, { far: adj.id }, onClose);
                    }}
                  >
                    Create Change Order
                  </Button>
                </>
              )}
              {isOwner && adj?.changeOrderId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigate(changeOrderEditHref(adj.projectId, adj.changeOrderId!));
                    onClose();
                  }}
                >
                  Open Change Order
                </Button>
              )}
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
