import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  canEmployeeEditAdjustment,
  fetchAdjustmentById,
  updateFieldAdjustment,
} from '../../services/fieldAdjustmentService';
import { fetchAdjustmentAttachments } from '../../services/fieldRecordAttachmentService';
import type { FieldAdjustmentRequest, FieldRecordAttachment } from '../../types/fieldPlanner';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import FieldRecordAttachmentsList from '../../components/field/FieldRecordAttachmentsList';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function EmployeeFarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [adj, setAdj] = useState<FieldAdjustmentRequest | null>(null);
  const [attachments, setAttachments] = useState<FieldRecordAttachment[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEmployeePageTitle(adj?.title ?? 'FAR Details');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [loaded, att] = await Promise.all([
        fetchAdjustmentById(id),
        fetchAdjustmentAttachments(id),
      ]);
      setAdj(loaded);
      setAttachments(att);
      if (loaded) {
        setEditTitle(loaded.title);
        setEditDescription(loaded.description);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = adj ? canEmployeeEditAdjustment(adj) : false;

  const handleSave = async () => {
    if (!adj || !user) return;
    setBusy(true);
    try {
      await updateFieldAdjustment(adj.id, {
        title: editTitle,
        description: editDescription,
      });
      setEditMode(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading FAR…</p>;
  }

  if (!adj) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">Field adjustment not found.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/employee/far')}>
          Back to FARs
        </Button>
      </div>
    );
  }

  const impactFlags: string[] = [];
  if (adj.potentialCostImpact) impactFlags.push('Potential cost impact');
  if (adj.potentialScheduleImpact) impactFlags.push('Potential schedule impact');
  if (adj.impactSafety) impactFlags.push('Safety');
  if (adj.impactQuality) impactFlags.push('Quality');
  if (adj.requiresChangeOrder) impactFlags.push('Change order required');

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <FieldRecordStatusBadge status={adj.status} />

        {editMode ? (
          <div className="mt-4 space-y-3">
            <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
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
            <h1 className="mt-4 text-lg font-bold text-white">{adj.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{adj.description}</p>
            {canEdit ? (
              <Button type="button" variant="outline" className="mt-4" onClick={() => setEditMode(true)}>
                Edit FAR
              </Button>
            ) : null}
          </>
        )}
      </div>

      {impactFlags.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Impacts</h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-slate-300">
            {impactFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {adj.proposedAdjustment ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Proposed adjustment</h2>
          <p className="mt-2 text-sm text-slate-300">{adj.proposedAdjustment}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white">Attachments</h2>
        <FieldRecordAttachmentsList attachments={attachments} />
      </section>
    </div>
  );
}
