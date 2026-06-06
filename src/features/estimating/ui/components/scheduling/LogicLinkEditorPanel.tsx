import { useState, useEffect } from 'react';
import type { CpmLogicLink, CpmRelationshipType } from '../../../scheduling/cpmTypes';

const RELATIONSHIP_OPTIONS: { value: CpmRelationshipType; label: string }[] = [
  { value: 'FS', label: 'FS — Finish to Start' },
  { value: 'SS', label: 'SS — Start to Start' },
  { value: 'FF', label: 'FF — Finish to Finish' },
  { value: 'SF', label: 'SF — Start to Finish' },
];

interface Props {
  link: CpmLogicLink;
  onSave: (updated: CpmLogicLink) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function LogicLinkEditorPanel({ link, onSave, onDelete, onClose }: Props) {
  const [relationshipType, setRelationshipType] = useState<CpmRelationshipType>(
    link.relationshipType,
  );
  const [lagDays, setLagDays] = useState(String(link.lagDays));

  useEffect(() => {
    setRelationshipType(link.relationshipType);
    setLagDays(String(link.lagDays));
  }, [link]);

  function handleSave() {
    const parsedLag = parseInt(lagDays, 10);
    onSave({
      ...link,
      relationshipType,
      lagDays: Number.isFinite(parsedLag) ? Math.max(0, parsedLag) : 0,
    });
  }

  return (
    <div className="w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Edit logic link
        </span>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {link.predecessorActivityCode} → {link.successorActivityCode}
      </p>

      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Relationship
      </label>
      <select
        className="mb-3 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={relationshipType}
        onChange={(event) => setRelationshipType(event.target.value as CpmRelationshipType)}
      >
        {RELATIONSHIP_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Lag days
      </label>
      <input
        type="number"
        min={0}
        step={1}
        className="mb-3 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={lagDays}
        onChange={(event) => setLagDays(event.target.value)}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={onDelete}
        >
          Delete link
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-700"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
