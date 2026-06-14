import React, { useRef, useState, useCallback, useId } from 'react';
import { X, User } from 'lucide-react';
import { SCHEDULE_FILTER_INPUT, SCHEDULE_MUTED } from './scheduleTheme';
import { PLANNER_FORM_LABEL } from '../planner/plannerTheme';

export interface AssigneeOption {
  /** Unique key — user id or free-text slug. */
  id: string;
  /** Stored value (display name saved on the event). */
  name: string;
  /** Dropdown label; defaults to `name`. Use "(me)" suffix for current user. */
  label?: string;
}

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  team: AssigneeOption[];
  disabled?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ScheduleAssigneeCombobox({
  value,
  onChange,
  team,
  disabled = false,
}: Props) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const optionLabel = (option: AssigneeOption) => option.label ?? option.name;

  // Filter team list: match query, exclude already-selected names
  const filtered = team.filter((m) => {
    const label = optionLabel(m);
    const haystack = `${label} ${m.name}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && !value.includes(m.name);
  });

  const addName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || value.includes(trimmed)) return;
      onChange([...value, trimmed]);
      setQuery('');
      setOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const removeName = useCallback(
    (name: string) => {
      onChange(value.filter((v) => v !== name));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If there's exactly one filtered match, select it; otherwise add as free text
      if (filtered.length === 1) {
        addName(filtered[0].name);
      } else if (query.trim()) {
        addName(query);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      removeName(value[value.length - 1]);
    }
  };

  const showDropdown = open && (filtered.length > 0 || query.trim().length > 0);

  return (
    <div className="relative">
      <label htmlFor={inputId} className={PLANNER_FORM_LABEL}>
        Assigned users
      </label>

      {/* ── Selected chips ── */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 py-0.5 pl-1.5 pr-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[9px] font-bold text-blue-700 dark:bg-blue-400/20 dark:text-blue-300">
                {initials(name)}
              </span>
              {name}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  onClick={() => removeName(name)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Search input ── */}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className={SCHEDULE_FILTER_INPUT + ' w-full pr-8'}
          placeholder={value.length === 0 ? 'Search or type a name…' : 'Add another…'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so click on dropdown option registers first
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
        />
        <User className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                onMouseDown={(e) => {
                  // Prevent input blur before click registers
                  e.preventDefault();
                  addName(m.name);
                }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-700 dark:bg-blue-400/20 dark:text-blue-300">
                  {initials(m.name)}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {optionLabel(m)}
                </span>
              </button>
            </li>
          ))}

          {/* Allow adding the typed value as free text when not in the team list */}
          {query.trim() &&
            !team.some((m) => m.name.toLowerCase() === query.trim().toLowerCase()) &&
            !value.includes(query.trim()) && (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addName(query);
                  }}
                >
                  <span className={`text-xs ${SCHEDULE_MUTED}`}>Add</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    &ldquo;{query.trim()}&rdquo;
                  </span>
                </button>
              </li>
            )}

          {filtered.length === 0 && !query.trim() && (
            <li className={`px-3 py-2 text-sm ${SCHEDULE_MUTED}`}>
              No team members found.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
