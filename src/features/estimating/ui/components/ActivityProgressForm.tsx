/**
 * ActivityProgressForm — daily field log modal.
 *
 * Captures:
 *   - Report date
 *   - Actual start / actual finish
 *   - Quantity installed today + running total
 *   - Crew size and hours worked
 *   - Remaining duration (crew estimate — primary CPM input)
 *   - Weather impact and delay
 *   - Daily notes
 *
 * Per CPM manual: remaining duration from the crew is the authoritative
 * schedule update input. Percent complete is a derived value only.
 */
import { useEffect, useRef, useState } from 'react';
import { X, ClipboardList } from 'lucide-react';
import type {
  CreateProgressUpdateInput,
  DelayReason,
  WeatherImpact,
} from '../../domain/activityProgressTypes';
import type { ActivityProgressUpdate } from '../../domain/activityProgressTypes';

interface Props {
  projectActivityId: string;
  projectId: string;
  activityTitle: string;
  unit: string;
  originalQuantity: number;
  latestUpdate: ActivityProgressUpdate | null;
  saving: boolean;
  onSubmit: (input: CreateProgressUpdateInput) => void;
  onCancel: () => void;
}

const WEATHER_OPTIONS: { value: WeatherImpact; label: string }[] = [
  { value: 'none', label: 'No weather impact' },
  { value: 'partial_day', label: 'Partial day lost (weather)' },
  { value: 'full_day_lost', label: 'Full day lost (weather)' },
];

const DELAY_REASONS: { value: DelayReason; label: string }[] = [
  { value: 'weather', label: 'Weather' },
  { value: 'material_shortage', label: 'Material shortage' },
  { value: 'equipment_breakdown', label: 'Equipment breakdown' },
  { value: 'labor_shortage', label: 'Labor shortage' },
  { value: 'design_change', label: 'Design change' },
  { value: 'rfi_hold', label: 'RFI hold' },
  { value: 'inspection_hold', label: 'Inspection hold' },
  { value: 'safety_stop', label: 'Safety stop' },
  { value: 'other', label: 'Other' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ActivityProgressForm({
  projectActivityId,
  projectId,
  activityTitle,
  unit,
  originalQuantity,
  latestUpdate,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [reportDate, setReportDate] = useState(today());
  const [actualStart, setActualStart] = useState(latestUpdate?.actualStart ?? '');
  const [actualFinish, setActualFinish] = useState(latestUpdate?.actualFinish ?? '');
  const [qtyToday, setQtyToday] = useState('');
  const [qtyComplete, setQtyComplete] = useState(
    String(latestUpdate?.quantityCompleteToDate ?? '0'),
  );
  const [crewSize, setCrewSize] = useState(String(latestUpdate?.crewSizeToday ?? '4'));
  const [hoursWorked, setHoursWorked] = useState('8');
  const [remainingDuration, setRemainingDuration] = useState(
    String(latestUpdate?.remainingDurationDays ?? ''),
  );
  const [weatherImpact, setWeatherImpact] = useState<WeatherImpact>('none');
  const [delayHours, setDelayHours] = useState('0');
  const [delayReason, setDelayReason] = useState<DelayReason | ''>('');
  const [delayNotes, setDelayNotes] = useState('');
  const [dailyNotes, setDailyNotes] = useState('');
  const [equipment, setEquipment] = useState('');

  // Auto-update running total when today's quantity changes
  const prevQtyComplete = latestUpdate?.quantityCompleteToDate ?? 0;
  const parsedQtyToday = parseFloat(qtyToday) || 0;
  const autoQtyComplete = prevQtyComplete + parsedQtyToday;
  const qtyRemaining = Math.max(0, originalQuantity - autoQtyComplete);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input: CreateProgressUpdateInput = {
      projectActivityId,
      projectId,
      reportDate,
      actualStart: actualStart || null,
      actualFinish: actualFinish || null,
      remainingDurationDays: remainingDuration ? parseFloat(remainingDuration) : null,
      quantityInstalledToday: parsedQtyToday,
      quantityCompleteToDate: autoQtyComplete,
      quantityRemainingAfterToday: qtyRemaining,
      unit,
      crewSizeToday: parseInt(crewSize) || 0,
      hoursWorkedToday: parseFloat(hoursWorked) || 0,
      equipmentUsedToday: equipment
        ? equipment.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      weatherImpact,
      delayHoursToday: parseFloat(delayHours) || 0,
      delayReason: (delayReason as DelayReason) || null,
      delayNotes: delayNotes || null,
      dailyNotes: dailyNotes || null,
    };

    onSubmit(input);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-cyan-600 dark:text-cyan-400" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Log Daily Progress
              </p>
              <p className="text-[10px] text-slate-500 truncate max-w-[280px]">{activityTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Report date */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Report Date *
                </label>
                <input
                  ref={firstInputRef}
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Actual Start
                </label>
                <input
                  type="date"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Actual Finish
                </label>
                <input
                  type="date"
                  value={actualFinish}
                  onChange={(e) => setActualFinish(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Quantity ({unit})
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Installed Today</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={qtyToday}
                    onChange={(e) => setQtyToday(e.target.value)}
                    placeholder="0"
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Complete to Date
                  </label>
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm px-2 py-1.5 text-slate-600 dark:text-slate-400 tabular-nums">
                    {autoQtyComplete.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Remaining</label>
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm px-2 py-1.5 text-slate-600 dark:text-slate-400 tabular-nums">
                    {qtyRemaining.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Crew */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Crew Size
                </label>
                <input
                  type="number"
                  min="0"
                  value={crewSize}
                  onChange={(e) => setCrewSize(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Hours Worked
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Remaining Duration (days)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={remainingDuration}
                  onChange={(e) => setRemainingDuration(e.target.value)}
                  placeholder="Crew estimate"
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Equipment Used (comma-separated)
              </label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. Bobcat S185, Concrete pump"
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            {/* Weather and delays */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Weather Impact
                </label>
                <select
                  value={weatherImpact}
                  onChange={(e) => setWeatherImpact(e.target.value as WeatherImpact)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                >
                  {WEATHER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Delay Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={delayHours}
                  onChange={(e) => setDelayHours(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {(parseFloat(delayHours) > 0) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Delay Reason
                </label>
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value as DelayReason)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Select reason --</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Daily Notes
              </label>
              <textarea
                rows={3}
                value={dailyNotes}
                onChange={(e) => setDailyNotes(e.target.value)}
                placeholder="Observations, conditions, QC notes..."
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Remaining duration note */}
            <p className="text-[10px] text-slate-400 italic">
              Remaining duration (days) is the primary CPM schedule update input.
              Production rate forecast is automatically calculated as a cross-check.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="progress-form"
            disabled={saving || !reportDate}
            onClick={handleSubmit}
            className="rounded bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition-colors"
          >
            {saving ? 'Saving…' : 'Save Progress'}
          </button>
        </div>
      </div>
    </div>
  );
}
