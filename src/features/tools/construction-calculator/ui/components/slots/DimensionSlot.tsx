import React, { useCallback, useId } from 'react';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import { parseConstructionDimension } from '../../../domain/constructionDimensionParser';
import { buildDimensionFromDecimal } from '../../../domain/constructionCalculatorFormatters';
import { formatDimension } from '../../../domain/constructionCalculatorFormatters';
import { FORM_LABEL } from '../../../../../../theme/appTheme';

interface DimensionSlotProps {
  moduleId: string;
  slotId: string;
  label: string;
  allowNegative?: boolean;
  controller: CalculatorInputController;
}

export default function DimensionSlot({
  moduleId,
  slotId,
  label,
  allowNegative = false,
  controller,
}: DimensionSlotProps) {
  const inputId = useId();
  const isActive =
    controller.activeSlot?.moduleId === moduleId && controller.activeSlot?.slotId === slotId;
  const stored = controller.getSlotValue(moduleId, slotId);
  const precision = controller.state.precision;

  const displayValue =
    stored !== null
      ? formatDimension(buildDimensionFromDecimal(stored), precision)
      : '—';

  const handleActivate = useCallback(() => {
    controller.setActiveSlot({
      moduleId,
      slotId,
      label,
      valueType: 'dimension',
      allowNegative,
    });
  }, [controller, moduleId, slotId, label, allowNegative]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseConstructionDimension(e.target.value);
      if (parsed) {
        controller.setSlotValue(moduleId, slotId, parsed.decimalInches);
      } else if (e.target.value.trim() === '') {
        controller.setSlotValue(moduleId, slotId, null);
      }
    },
    [controller, moduleId, slotId],
  );

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isActive
          ? 'border-cyan-500 bg-cyan-950/20 ring-2 ring-cyan-500/40 dark:bg-cyan-950/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <label htmlFor={inputId} className={`${FORM_LABEL} block cursor-pointer`} onClick={handleActivate}>
        {label}
      </label>
      <button
        type="button"
        onClick={handleActivate}
        className="mt-1 w-full truncate text-left font-mono text-lg font-semibold text-slate-900 dark:text-white"
        data-testid={`dimension-slot-${moduleId}-${slotId}`}
      >
        {isActive ? controller.state.display : displayValue}
      </button>
      <input
        id={inputId}
        type="text"
        className="mt-2 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
        placeholder={`Type e.g. 9' 3 1/2"`}
        onFocus={handleActivate}
        onChange={handleTextChange}
        aria-label={`${label} manual entry`}
      />
    </div>
  );
}
