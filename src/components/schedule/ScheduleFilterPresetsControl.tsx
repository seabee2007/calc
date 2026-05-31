import React, { useState } from 'react';
import type { ScheduleFilters } from '../../types/scheduleEvent';
import {
  deleteScheduleFilterPreset,
  loadScheduleFilterPresets,
  saveScheduleFilterPreset,
  type SavedScheduleFilterPreset,
} from '../../utils/scheduleFilterPresets';
import { SCHEDULE_FILTER_INPUT, SCHEDULE_MUTED } from './scheduleTheme';
import Button from '../ui/Button';

interface Props {
  userId: string;
  filters: ScheduleFilters;
  onApply: (filters: ScheduleFilters) => void;
}

export default function ScheduleFilterPresetsControl({ userId, filters, onApply }: Props) {
  const [presets, setPresets] = useState<SavedScheduleFilterPreset[]>(() =>
    loadScheduleFilterPresets(userId),
  );
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = saveScheduleFilterPreset(userId, trimmed, filters);
    setPresets(next);
    setName('');
  };

  const handleDelete = (id: string) => {
    const next = deleteScheduleFilterPreset(userId, id);
    setPresets(next);
  };

  return (
    <div className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-4 dark:border-slate-700">
      <p className={`text-xs font-semibold uppercase tracking-wide ${SCHEDULE_MUTED}`}>
        Saved presets
      </p>
      {presets.length > 0 && (
        <select
          className={SCHEDULE_FILTER_INPUT}
          defaultValue=""
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) onApply({ ...preset.filters });
            e.target.value = '';
          }}
        >
          <option value="">Load preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <input
          className={`${SCHEDULE_FILTER_INPUT} min-w-0 flex-1`}
          placeholder="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </div>
      {presets.length > 0 && (
        <ul className="space-y-1">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="truncate text-[#2563EB] hover:underline"
                onClick={() => onApply({ ...p.filters })}
              >
                {p.name}
              </button>
              <button
                type="button"
                className="shrink-0 text-red-600 hover:underline"
                onClick={() => handleDelete(p.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
