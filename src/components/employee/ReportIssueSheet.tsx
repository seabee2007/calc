import React, { useEffect, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { createFieldAdjustment } from '../../services/fieldAdjustmentService';
import { uploadAdjustmentAttachments } from '../../services/fieldRecordAttachmentService';
import { dispatchPlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import FieldFilePicker from '../field/FieldFilePicker';
import Button from '../ui/Button';
import Select from '../ui/Select';

const ISSUE_TYPES = [
  { value: 'Missing information', label: 'Missing information' },
  { value: 'Material issue', label: 'Material issue' },
  { value: 'Safety issue', label: 'Safety issue' },
  { value: 'Existing condition', label: 'Existing condition' },
  { value: 'Work blocked', label: 'Work blocked' },
  { value: 'Other', label: 'Other' },
] as const;

interface ReportIssueSheetProps {
  open: boolean;
  projectId: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReportIssueSheet({
  open,
  projectId,
  taskId,
  taskTitle,
  userId,
  onClose,
  onSubmitted,
}: ReportIssueSheetProps) {
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0].value);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIssueType(ISSUE_TYPES[0].value);
    setNotes('');
    setFiles([]);
    setBusy(false);
    setSuccess(false);
    setError(null);
  }, [open, taskId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError('Please add notes describing the issue.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const isSafety = issueType === 'Safety issue';
      const isWorkBlocked = issueType === 'Work blocked';

      const adj = await createFieldAdjustment({
        projectId,
        taskId,
        submittedBy: userId,
        title: `${issueType}: ${taskTitle}`,
        conditionDescription: trimmedNotes,
        reason: issueType,
        potentialScheduleImpact: isWorkBlocked,
        impactSafety: isSafety,
        recommendedAction: isWorkBlocked ? 'Unblock work' : undefined,
      });

      if (files.length > 0) {
        await uploadAdjustmentAttachments(files, {
          userId,
          projectId,
          taskId,
          adjustmentId: adj.id,
        });
      }

      dispatchPlannerRecordsChanged();
      setSuccess(true);
      onSubmitted?.();
      window.setTimeout(() => onClose(), 1500);
    } catch {
      setError('Could not submit issue. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close report issue"
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
      />

      <div
        role="dialog"
        aria-label="Report issue"
        className="relative max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Report issue</h2>
            <p className="text-xs text-slate-400">{taskTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Issue reported successfully</p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Select
              label="Issue type"
              value={issueType}
              onChange={setIssueType}
              disabled={busy}
              options={ISSUE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />

            <div>
              <label htmlFor="issue-notes" className="mb-1 block text-sm font-medium text-slate-200">
                Notes
              </label>
              <textarea
                id="issue-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                required
                disabled={busy}
                placeholder="Describe what happened…"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <FieldFilePicker files={files} onChange={setFiles} label="Optional photo" />

            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : null}

            <Button
              type="submit"
              variant="accent"
              fullWidth
              className="min-h-[48px]"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit issue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
