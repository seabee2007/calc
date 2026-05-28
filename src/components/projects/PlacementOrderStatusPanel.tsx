import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import type { Project } from '../../types';
import type { PlacementOrder, PlacementOrderStatus } from '../../types/placementOrder';
import {
  PLACEMENT_ORDER_STATUS_LABELS,
  defaultPlacementOrder,
} from '../../types/placementOrder';
import { useProjectStore } from '../../store';

const ORDER_STATUS_OPTIONS = (
  Object.entries(PLACEMENT_ORDER_STATUS_LABELS) as [PlacementOrderStatus, string][]
).map(([value, label]) => ({ value, label }));

interface PlacementOrderStatusPanelProps {
  project: Project;
}

export default function PlacementOrderStatusPanel({ project }: PlacementOrderStatusPanelProps) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const order = project.placementOrder;
  const initialStatus = (order?.status ?? 'draft') as PlacementOrderStatus;
  const initialNotes = order?.orderNotes ?? '';

  const [status, setStatus] = useState<PlacementOrderStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus((project.placementOrder?.status ?? 'draft') as PlacementOrderStatus);
    setNotes(project.placementOrder?.orderNotes ?? '');
    setMessage(null);
    setError(null);
  }, [project.id, project.placementOrder?.status, project.placementOrder?.orderNotes]);

  const dirty =
    status !== initialStatus || notes.trim() !== initialNotes.trim();

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    const nextOrder: PlacementOrder = {
      ...(project.placementOrder ?? defaultPlacementOrder()),
      status,
      orderNotes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateProject(project.id, { placementOrder: nextOrder });
      setMessage('Order status saved.');
    } catch {
      setError('Could not save order status. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200/80 dark:border-gray-700/80">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        Placement order
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Update after you call the batch plant. The call sheet is built in Placement Planner.
      </p>
      <div className="space-y-3">
        <Select
          label="Order status"
          options={ORDER_STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus(v as PlacementOrderStatus)}
        />
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Dispatch notes
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm min-h-[88px] placeholder:text-gray-400 dark:placeholder:text-gray-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              'No washout on pavement.\nCall superintendent before entering convoy gate.\nSlump test each truck.'
            }
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            icon={
              saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )
            }
          >
            {saving ? 'Saving…' : 'Save order status'}
          </Button>
          {message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
