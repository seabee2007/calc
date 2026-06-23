import { useEffect, useRef, useState } from 'react';
import type { DoorSwingDirection, DoorSwingType } from '../domain/planDoorSymbol';

const DOOR_HANDING_OPTIONS = [
  { swingType: 'inswing' as const, swingDirection: 'left' as const, label: 'Inswing · Left' },
  { swingType: 'inswing' as const, swingDirection: 'right' as const, label: 'Inswing · Right' },
  { swingType: 'outswing' as const, swingDirection: 'left' as const, label: 'Outswing · Left' },
  { swingType: 'outswing' as const, swingDirection: 'right' as const, label: 'Outswing · Right' },
];

function formatDoorHandingLabel(swingType: DoorSwingType, swingDirection: DoorSwingDirection): string {
  return (
    DOOR_HANDING_OPTIONS.find(
      (option) => option.swingType === swingType && option.swingDirection === swingDirection,
    )?.label ?? 'Inswing · Left'
  );
}

export type DoorConfigurationControlsProps = {
  swingType: DoorSwingType;
  swingDirection: DoorSwingDirection;
  onSwingTypeChange: (value: DoorSwingType) => void;
  onSwingDirectionChange: (value: DoorSwingDirection) => void;
  title?: string;
};

export function DoorConfigurationControls({
  swingType,
  swingDirection,
  onSwingTypeChange,
  onSwingDirectionChange,
  title,
}: DoorConfigurationControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentLabel = formatDoorHandingLabel(swingType, swingDirection);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      {title ? (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </span>
      ) : (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Door handing</span>
      )}
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Door handing: ${currentLabel}`}
        data-door-handing-control="true"
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      >
        <span>{currentLabel}</span>
        <span aria-hidden className="text-[10px] text-slate-400">▾</span>
      </button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label="Door handing options"
          data-door-handing-menu="true"
          className="absolute left-0 top-full z-50 mt-1 grid w-[15.5rem] grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-950"
        >
          {DOOR_HANDING_OPTIONS.map((option) => {
            const selected = option.swingType === swingType && option.swingDirection === swingDirection;
            return (
              <button
                key={option.label}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                data-door-handing-option={option.label}
                onClick={() => {
                  onSwingTypeChange(option.swingType);
                  onSwingDirectionChange(option.swingDirection);
                  setMenuOpen(false);
                }}
                className={`rounded-md px-2 py-1.5 text-left text-xs font-semibold transition ${
                  selected
                    ? 'bg-cyan-500 text-slate-950 shadow-sm dark:bg-cyan-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
