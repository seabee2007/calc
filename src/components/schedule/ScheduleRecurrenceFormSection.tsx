import React from 'react';
import type { RecurrenceRule } from '../../types/scheduleEvent';
import {
  RECURRENCE_CUSTOM_UNITS,
  RECURRENCE_END_TYPE_LABELS,
  RECURRENCE_END_TYPES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
} from '../../types/scheduleEvent';
import { defaultRecurrenceRule, formatRecurrenceSummary } from '../../utils/scheduleRecurrenceUtils';
import { SCHEDULE_FILTER_INPUT, SCHEDULE_MUTED } from './scheduleTheme';
import { PLANNER_FORM_LABEL } from '../planner/plannerTheme';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rule: RecurrenceRule;
  onRuleChange: (rule: RecurrenceRule) => void;
}

export default function ScheduleRecurrenceFormSection({
  enabled,
  onEnabledChange,
  rule,
  onRuleChange,
}: Props) {
  const patch = (partial: Partial<RecurrenceRule>) => onRuleChange({ ...rule, ...partial });

  return (
    <div className="rounded-lg border border-[#E5E7EB] p-4 dark:border-slate-700">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const on = e.target.checked;
            onEnabledChange(on);
            if (on && !rule.frequency) onRuleChange(defaultRecurrenceRule());
          }}
          className="rounded border-slate-300"
        />
        <span className={`text-sm font-semibold ${enabled ? 'text-[#1F2937] dark:text-slate-100' : SCHEDULE_MUTED}`}>
          Repeat
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={PLANNER_FORM_LABEL}>Repeats</label>
              <select
                className={SCHEDULE_FILTER_INPUT}
                value={rule.frequency}
                onChange={(e) =>
                  patch({
                    frequency: e.target.value as RecurrenceRule['frequency'],
                  })
                }
              >
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {RECURRENCE_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Every</label>
              <input
                type="number"
                min={1}
                className={SCHEDULE_FILTER_INPUT}
                value={rule.interval}
                onChange={(e) => patch({ interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
          </div>

          {rule.frequency === 'weekly' && (
            <div>
              <label className={PLANNER_FORM_LABEL}>On days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, i) => {
                  const selected = rule.weekdays?.includes(i) ?? false;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        selected
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'border-[#E5E7EB] bg-white text-[#4B5563] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                      onClick={() => {
                        const set = new Set(rule.weekdays ?? []);
                        if (set.has(i)) set.delete(i);
                        else set.add(i);
                        patch({ weekdays: [...set].sort() });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {rule.frequency === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={PLANNER_FORM_LABEL}>Interval</label>
                <input
                  type="number"
                  min={1}
                  className={SCHEDULE_FILTER_INPUT}
                  value={rule.customInterval ?? 1}
                  onChange={(e) =>
                    patch({ customInterval: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                />
              </div>
              <div>
                <label className={PLANNER_FORM_LABEL}>Unit</label>
                <select
                  className={SCHEDULE_FILTER_INPUT}
                  value={rule.customUnit ?? 'day'}
                  onChange={(e) =>
                    patch({ customUnit: e.target.value as RecurrenceRule['customUnit'] })
                  }
                >
                  {RECURRENCE_CUSTOM_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u.charAt(0).toUpperCase() + u.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={PLANNER_FORM_LABEL}>Ends</label>
            <select
              className={SCHEDULE_FILTER_INPUT}
              value={rule.endType}
              onChange={(e) =>
                patch({ endType: e.target.value as RecurrenceRule['endType'] })
              }
            >
              {RECURRENCE_END_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECURRENCE_END_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {rule.endType === 'on_date' && (
            <div>
              <label className={PLANNER_FORM_LABEL}>End date</label>
              <input
                type="date"
                className={SCHEDULE_FILTER_INPUT}
                value={rule.endDate ?? ''}
                onChange={(e) => patch({ endDate: e.target.value || null })}
              />
            </div>
          )}

          {rule.endType === 'after_count' && (
            <div>
              <label className={PLANNER_FORM_LABEL}>Occurrences</label>
              <input
                type="number"
                min={1}
                className={SCHEDULE_FILTER_INPUT}
                value={rule.occurrenceCount ?? 10}
                onChange={(e) =>
                  patch({
                    occurrenceCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
              />
            </div>
          )}

          <p className={`text-xs ${SCHEDULE_MUTED}`}>{formatRecurrenceSummary(rule)}</p>
        </div>
      )}
    </div>
  );
}
