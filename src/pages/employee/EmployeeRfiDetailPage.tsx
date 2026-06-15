import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { canEmployeeEditRfi, fetchRfiById, updateRfi } from '../../services/rfiService';
import { fetchRfiAttachments } from '../../services/fieldRecordAttachmentService';
import type { FieldRecordAttachment, RfiRequest } from '../../types/fieldPlanner';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import FieldRecordAttachmentsList from '../../components/field/FieldRecordAttachmentsList';
import { TaskPriorityBadge } from '../../components/planner/TaskStatusBadge';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function EmployeeRfiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rfi, setRfi] = useState<RfiRequest | null>(null);
  const [attachments, setAttachments] = useState<FieldRecordAttachment[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEmployeePageTitle(rfi?.title ?? 'RFI Details');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [loaded, att] = await Promise.all([fetchRfiById(id), fetchRfiAttachments(id)]);
      setRfi(loaded);
      setAttachments(att);
      if (loaded) {
        setEditTitle(loaded.title);
        setEditQuestion(loaded.question);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = rfi ? canEmployeeEditRfi(rfi) : false;

  const handleSave = async () => {
    if (!rfi || !user) return;
    setBusy(true);
    try {
      await updateRfi(rfi.id, {
        title: editTitle,
        question: editQuestion,
      });
      setEditMode(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading RFI…</p>;
  }

  if (!rfi) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">RFI not found.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/employee/rfi')}>
          Back to RFIs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap gap-2">
          <FieldRecordStatusBadge status={rfi.status} />
          {['Low', 'Normal', 'High', 'Urgent'].includes(rfi.urgency) ? (
            <TaskPriorityBadge priority={rfi.urgency as 'Low' | 'Normal' | 'High' | 'Urgent'} />
          ) : null}
        </div>

        {editMode ? (
          <div className="mt-4 space-y-3">
            <Input label="Subject" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Question</span>
              <textarea
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="accent" onClick={() => void handleSave()} disabled={busy}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-lg font-bold text-white">{rfi.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{rfi.question}</p>
            {canEdit ? (
              <Button type="button" variant="outline" className="mt-4" onClick={() => setEditMode(true)}>
                Edit RFI
              </Button>
            ) : null}
          </>
        )}
      </div>

      {rfi.suggestedSolution ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Suggested solution</h2>
          <p className="mt-2 text-sm text-slate-300">{rfi.suggestedSolution}</p>
        </section>
      ) : null}

      {rfi.ownerResponse ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Owner response</h2>
          <p className="mt-2 text-sm text-slate-300">{rfi.ownerResponse}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white">Attachments</h2>
        <FieldRecordAttachmentsList attachments={attachments} />
      </section>
    </div>
  );
}
