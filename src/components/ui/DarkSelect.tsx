import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FORM_LABEL, FORM_HELPER } from '../../theme/appTheme';

export interface DarkSelectOption {
  value: string;
  label: string;
}

interface DarkSelectProps {
  label: string;
  value: string;
  options: DarkSelectOption[];
  onChange: (value: string) => void;
  helperText?: string;
  fullWidth?: boolean;
  className?: string;
  'data-testid'?: string;
}

const triggerClass =
  'flex h-12 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100';

const menuClass =
  'absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-[#020817] dark:shadow-black/40';

const optionClass = (selected: boolean, active: boolean) =>
  [
    'cursor-pointer px-3 py-2 text-sm text-slate-900 dark:text-slate-100',
    selected ? 'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100' : '',
    active && !selected ? 'bg-slate-100 dark:bg-slate-800' : '',
    !selected && !active ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : '',
  ]
    .filter(Boolean)
    .join(' ');

const DarkSelect: React.FC<DarkSelectProps> = ({
  label,
  value,
  options,
  onChange,
  helperText,
  fullWidth = false,
  className = '',
  'data-testid': dataTestId,
}) => {
  const labelId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const resolvedOptions = useMemo(() => {
    if (options.some((option) => option.value === value)) {
      return options;
    }
    return [...options, { value, label: `${value}%` }].sort(
      (a, b) => Number(a.value) - Number(b.value),
    );
  }, [options, value]);

  const selectedIndex = resolvedOptions.findIndex((option) => option.value === value);
  const selectedLabel =
    resolvedOptions[selectedIndex]?.label ??
    resolvedOptions[0]?.label ??
    value;

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
      setActiveIndex((current) => Math.min(current + 1, resolvedOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = resolvedOptions[activeIndex];
      if (option) selectOption(option.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${fullWidth ? 'w-full' : ''} ${className}`}
      data-testid={dataTestId}
    >
      <span id={labelId} className={FORM_LABEL}>
        {label}
      </span>

      <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-labelledby={labelId}
          className={triggerClass}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleKeyDown}
        >
          <span>{selectedLabel}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {isOpen ? (
          <ul id={listboxId} role="listbox" aria-labelledby={labelId} className={menuClass}>
            {resolvedOptions.map((option, index) => {
              const selected = option.value === value;
              const active = index === activeIndex;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  className={optionClass(selected, active)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option.value)}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {helperText ? <p className={FORM_HELPER}>{helperText}</p> : null}
    </div>
  );
};

export default DarkSelect;
