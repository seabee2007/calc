import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  FORM_INPUT,
  FORM_LABEL,
  FORM_LABEL_FOCUS,
  TEXT_FOREGROUND,
} from '../../../../theme/appTheme';
import {
  formatMasterActivityOption,
  searchMasterActivities,
} from '../../data/masterActivityIndex';
import type { EstimateActivityTemplate } from '../../data/residentialActivityMaster';

interface MasterActivityComboboxProps {
  label?: string;
  /** The currently selected master activity, if any. */
  value: EstimateActivityTemplate | null;
  onSelect: (activity: EstimateActivityTemplate) => void;
  /** Restrict results to a single CSI division. */
  divisionCode?: string | null;
  placeholder?: string;
  fullWidth?: boolean;
}

export default function MasterActivityCombobox({
  label,
  value,
  onSelect,
  divisionCode,
  placeholder = 'Search activities by code, name, trade…',
  fullWidth = true,
}: MasterActivityComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => searchMasterActivities(query, { divisionCode }),
    [query, divisionCode],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const selectActivity = (activity: EstimateActivityTemplate) => {
    onSelect(activity);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      selectActivity(results[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const widthStyle = fullWidth ? 'w-full' : '';
  const inputValue = isOpen ? query : value ? formatMasterActivityOption(value) : query;

  return (
    <div ref={containerRef} className={`${widthStyle} ${TEXT_FOREGROUND}`}>
      {label ? (
        <label className={`${FORM_LABEL} ${isFocused ? FORM_LABEL_FOCUS : ''}`}>{label}</label>
      ) : null}

      <div className={`relative ${widthStyle}`}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder={placeholder}
          className={`${FORM_INPUT} ${widthStyle}`}
          value={inputValue}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        {isOpen && results.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {results.map((activity, index) => (
              <li
                key={activity.activityCode}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-cyan-50 text-slate-900 dark:bg-cyan-950/40 dark:text-slate-100'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectActivity(activity)}
              >
                <span className="font-mono font-semibold">{activity.activityCode}</span>
                <span className="mx-1 text-slate-400">—</span>
                <span>{activity.title}</span>
                <span className="ml-1 block text-xs text-slate-400 dark:text-slate-500">
                  {activity.workPackageName} · {activity.primaryTrade}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {isOpen && results.length === 0 ? (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No matching master activities.
          </div>
        ) : null}
      </div>
    </div>
  );
}
