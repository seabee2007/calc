import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  FORM_INPUT,
  FORM_LABEL,
  FORM_LABEL_FOCUS,
  TEXT_FOREGROUND,
} from '../../../../theme/appTheme';
import {
  filterConstructionUnits,
  formatConstructionUnitOption,
} from '../../data/constructionUnits';
import { usePreferencesStore } from '../../../../store';
import { getMeasurementSystemFromPreferences } from '../../../../utils/measurementPreferences';

interface ConstructionUnitComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}

export default function ConstructionUnitCombobox({
  label,
  value,
  onChange,
  fullWidth = false,
}: ConstructionUnitComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { preferences } = usePreferencesStore();
  const measurementSystem = getMeasurementSystemFromPreferences(preferences);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredUnits = useMemo(
    () => filterConstructionUnits(value, measurementSystem),
    [measurementSystem, value],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [value, isOpen]);

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

  const selectUnit = (code: string) => {
    onChange(code);
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
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredUnits.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && filteredUnits[activeIndex]) {
      event.preventDefault();
      selectUnit(filteredUnits[activeIndex].code);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const widthStyle = fullWidth ? 'w-full' : '';

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
          className={`${FORM_INPUT} ${widthStyle}`}
          value={value}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        {isOpen && filteredUnits.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {filteredUnits.map((unit, index) => (
              <li
                key={unit.code}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-cyan-50 text-slate-900 dark:bg-cyan-950/40 dark:text-slate-100'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectUnit(unit.code)}
              >
                {formatConstructionUnitOption(unit)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
