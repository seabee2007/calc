import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchConcreteInspection,
  upsertConcreteInspection,
} from '../../services/concreteInspectionService';
import type { ConcreteInspectionChecklist, InspectionItem, InspectionStatus } from '../../types/fieldTools';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import Button from '../../components/ui/Button';

const STATUS_OPTIONS: { value: InspectionStatus; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
];

function ChecklistSection({
  title,
  items,
  onToggle,
  section,
}: {
  title: string;
  items: InspectionItem[];
  onToggle: (section: 'pre' | 'during' | 'post', itemId: string, status: InspectionStatus) => void;
  section: 'pre' | 'during' | 'post';
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-sm font-medium text-slate-100">{item.label}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onToggle(section, item.id, option.value)}
                  className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium touch-manipulation ${
                    item.status === option.value
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EmployeeQcDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState<ConcreteInspectionChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEmployeePageTitle(checklist?.projectName || 'QC Details');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const loaded = await fetchConcreteInspection(id);
      setChecklist(loaded);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateItem = (
    section: 'pre' | 'during' | 'post',
    itemId: string,
    status: InspectionStatus,
  ) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      const updateItems = (items: InspectionItem[]) =>
        items.map((item) => (item.id === itemId ? { ...item, status } : item));
      if (section === 'pre') return { ...prev, prePourItems: updateItems(prev.prePourItems) };
      if (section === 'during') {
        return { ...prev, duringPlacementItems: updateItems(prev.duringPlacementItems) };
      }
      return { ...prev, postPlacementItems: updateItems(prev.postPlacementItems) };
    });
  };

  const handleSave = async () => {
    if (!checklist || !user) return;
    setBusy(true);
    try {
      await upsertConcreteInspection(checklist, user.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading checklist…</p>;
  }

  if (!checklist) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">Checklist not found.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/employee/qc')}>
          Back to QC
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h1 className="text-lg font-bold text-white">
          {checklist.projectName || checklist.pourArea || 'Inspection'}
        </h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Date</dt>
            <dd className="text-slate-200">
              {checklist.inspectionDate
                ? new Date(checklist.inspectionDate).toLocaleDateString()
                : '—'}
            </dd>
          </div>
          {checklist.pourArea ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Pour area</dt>
              <dd className="text-right text-slate-200">{checklist.pourArea}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <ChecklistSection
        title="Pre-pour"
        items={checklist.prePourItems}
        section="pre"
        onToggle={updateItem}
      />
      <ChecklistSection
        title="During placement"
        items={checklist.duringPlacementItems}
        section="during"
        onToggle={updateItem}
      />
      <ChecklistSection
        title="Post-placement"
        items={checklist.postPlacementItems}
        section="post"
        onToggle={updateItem}
      />

      {checklist.notes ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white">Notes</h2>
          <p className="mt-2 text-sm text-slate-300">{checklist.notes}</p>
        </section>
      ) : null}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-0 right-0 z-30 mx-auto max-w-lg px-4">
        <Button
          type="button"
          variant="accent"
          fullWidth
          className="min-h-[48px]"
          onClick={() => void handleSave()}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Save checklist'}
        </Button>
      </div>
    </div>
  );
}
