import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { OPS_MUTED } from '../opsTheme';

export interface WeatherLocationOption {
  value: string;
  label: string;
  group: 'personal' | 'projects';
  /** Full label for tooltip when truncated. */
  title?: string;
}

interface WeatherLocationSelectorProps {
  value: string;
  options: WeatherLocationOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}

const triggerBase =
  'dashboard-no-drag inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-left text-xs font-medium text-slate-800 transition hover:border-cyan-500/40 hover:bg-slate-100/80 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600/80 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800/80';

const menuClass =
  'absolute z-40 mt-1 max-h-56 min-w-[200px] max-w-[min(100vw-2rem,280px)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-[#020817] dark:shadow-black/40';

function optionClass(selected: boolean, active: boolean) {
  return [
    'cursor-pointer truncate px-3 py-2 text-sm text-slate-900 dark:text-slate-100',
    selected ? 'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100' : '',
    active && !selected ? 'bg-slate-100 dark:bg-slate-800' : '',
    !selected && !active ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function WeatherLocationSelector({
  value,
  options,
  onChange,
  compact = false,
}: WeatherLocationSelectorProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const flatOptions = options;
  const selectedIndex = flatOptions.findIndex((option) => option.value === value);
  const selected = flatOptions[selectedIndex] ?? flatOptions[0];

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

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

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ')) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) {
      if (event.key === 'Enter') {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, flatOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = flatOptions[activeIndex];
      if (option) selectOption(option.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  let lastGroup: WeatherLocationOption['group'] | null = null;

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-full" data-testid="weather-location-selector">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={`${triggerBase} ${compact ? 'max-w-[140px]' : 'max-w-[220px]'}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
        title={selected?.title ?? selected?.label}
        data-testid="weather-location-selector-trigger"
      >
        <MapPin className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
        <span className="min-w-0 truncate">{selected?.label ?? 'My Weather'}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <ul id={listboxId} role="listbox" className={menuClass}>
          {flatOptions.map((option, index) => {
            const showHeader = option.group !== lastGroup;
            lastGroup = option.group;
            const selectedOption = option.value === value;
            const active = index === activeIndex;
            return (
              <React.Fragment key={option.value}>
                {showHeader ? (
                  <li
                    role="presentation"
                    className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide ${OPS_MUTED}`}
                  >
                    {option.group === 'personal' ? 'Personal' : 'Projects'}
                  </li>
                ) : null}
                <li
                  role="option"
                  aria-selected={selectedOption}
                  className={optionClass(selectedOption, active)}
                  title={option.title ?? option.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option.value)}
                  data-testid={`weather-location-option-${option.value}`}
                >
                  {option.label}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default WeatherLocationSelector;
