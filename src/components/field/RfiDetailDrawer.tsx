import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { RfiRequest, RfiStatus } from '../../types/fieldPlanner';
import { RFI_RESPONSE_STATUSES } from '../../types/fieldPlanner';
import {
  canEmployeeEditRfi,
  fetchRfiById,
  respondToRfi,
  updateRfi,
} from '../../services/rfiService';
import { fetchRfiAttachments } from '../../services/fieldRecordAttachmentService';
import type { FieldRecordAttachment } from '../../types/fieldPlanner';
import { fetchProfilesByIds, displayNameFor } from '../../services/profileService';
import FieldRecordStatusBadge from './FieldRecordStatusBadge';
import { TaskPriorityBadge } from '../planner/TaskStatusBadge';
import FieldRecordAttachmentsList from './FieldRecordAttachmentsList';
import Button from '../ui/Button';
import Select from '../ui/Select';
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

interface RfiDetailDrawerProps {
  rfiId: string | null;
  userId: string;
  isOwner: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-slate-200">{value}</dd>
    </div>
  );
}

export default function RfiDetailDrawer({
  rfiId,
  userId,
  isOwner,
  onClose,
  onUpdated,
}: RfiDetailDrawerProps) {
  const [rfi, setRfi] = useState<RfiRequest | null>(null);
  const [attachments, setAttachments] = useState<FieldRecordAttachment[]>([]);
  const [submitterName, setSubmitterName] = useState('');
  const [response, setResponse] = useState('');
  const [responseStatus, setResponseStatus] = useState<RfiStatus>('Answered');
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editQuestion, setEditQuestion] = useState('');

  const load = useCallback(async () => {
    if (!rfiId) return;
    const [r, att] = await Promise.all([fetchRfiById(rfiId), fetchRfiAttachments(rfiId)]);
    if (!r) return;
    setRfi(r);
    setAttachments(att);
    setResponse(r.ownerResponse ?? '');
    setEditTitle(r.title);
    setEditQuestion(r.question);
    const profiles = await fetchProfilesByIds([r.submittedBy]);
    setSubmitterName(displayNameFor(profiles.get(r.submittedBy), 'Team member'));
  }, [rfiId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = rfi && !isOwner && rfi.submittedBy === userId && canEmployeeEditRfi(rfi);

  const handleRespond = async () => {
    if (!rfi || !response.trim()) return;
    setBusy(true);
    try {
      await respondToRfi(rfi.id, userId, response.trim(), responseStatus);
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!rfi) return;
    setBusy(true);
    try {
      await updateRfi(rfi.id, { title: editTitle.trim(), question: editQuestion.trim() });
      setEditMode(false);
      await load();
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  if (!rfiId) return null;

  return createPortal(
    <AnimatePresence>
      {rfiId && (
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
                  {rfi?.displayNumber ?? 'RFI'}
                </p>
                <h2 className={PLANNER_DRAWER_TITLE}>{rfi?.title ?? 'Loading…'}</h2>
              </div>
              <button type="button" onClick={onClose} className={PLANNER_CLOSE_BTN} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {rfi && (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <FieldRecordStatusBadge status={rfi.status} />
                    <TaskPriorityBadge priority={rfi.urgency as 'Low' | 'Normal' | 'High' | 'Urgent'} />
                  </div>
                  {editMode ? (
                    <div className="space-y-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                      <textarea
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                      <Button size="sm" onClick={() => void handleSaveEdit()} disabled={busy}>
                        Save changes
                      </Button>
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      <DetailRow label="Submitted by" value={submitterName} />
                      <DetailRow
                        label="Date"
                        value={new Date(rfi.createdAt).toLocaleString()}
                      />
                      <DetailRow label="Location" value={rfi.location} />
                      <DetailRow label="Drawing" value={rfi.drawingReference} />
                      <DetailRow label="Specification" value={rfi.specReference} />
                      <DetailRow label="Question" value={<p className={PLANNER_DRAWER_BODY}>{rfi.question}</p>} />
                      {rfi.suggestedSolution && (
                        <DetailRow label="Suggested solution" value={rfi.suggestedSolution} />
                      )}
                      {(rfi.impactSchedule ||
                        rfi.impactCost ||
                        rfi.impactQuality ||
                        rfi.impactSafety) && (
                        <DetailRow
                          label="Impact"
                          value={[
                            rfi.impactSchedule && 'Schedule',
                            rfi.impactCost && 'Cost',
                            rfi.impactQuality && 'Quality',
                            rfi.impactSafety && 'Safety',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        />
                      )}
                    </dl>
                  )}
                  {rfi.ownerResponse && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="text-xs font-semibold text-gray-500">Owner response</p>
                      <p className="mt-1 text-sm">{rfi.ownerResponse}</p>
                    </div>
                  )}
                  <FieldRecordAttachmentsList attachments={attachments} />
                </>
              )}
            </div>

            <footer className={PLANNER_DRAWER_FOOTER}>
              {canEdit && !editMode && (
                <Button variant="outline" className="w-full" onClick={() => setEditMode(true)}>
                  Edit RFI
                </Button>
              )}
              {isOwner && rfi && !['Closed', 'Rejected'].includes(rfi.status) && (
                <div className="space-y-2">
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                    placeholder="Owner response…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                  <Select
                    label="Status"
                    value={responseStatus}
                    onChange={(v) => setResponseStatus(v as RfiStatus)}
                    options={RFI_RESPONSE_STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                  <Button
                    className={`w-full ${PLANNER_BTN_PRIMARY}`}
                    disabled={busy || !response.trim()}
                    onClick={() => void handleRespond()}
                  >
                    Submit response
                  </Button>
                </div>
              )}
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
