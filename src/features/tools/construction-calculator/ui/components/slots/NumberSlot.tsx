import React, { useCallback, useId } from 'react';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import { FORM_LABEL, FORM_INPUT } from '../../../../../../theme/appTheme';

interface NumberSlotProps {
  moduleId: string;
  slotId: string;
  label: string;
  allowNegative?: boolean;
  controller: CalculatorInputController;
  unit?: string;
  step?: string;
}

export default function NumberSlot({
  moduleId,
  slotId,
  label,
  allowNegative = false,
  controller,
  unit,
  step = 'any',
}: NumberSlotProps) {
  const inputId = useId();
  const isActive =
    controller.activeSlot?.moduleId === moduleId && controller.activeSlot?.slotId === slotId;
  const stored = controller.getSlotValue(moduleId, slotId);

  const handleActivate = useCallback(() => {
    controller.setActiveSlot({
      moduleId,
      slotId,
      label,
      valueType: 'scalar',
      allowNegative,
    });
  }, [controller, moduleId, slotId, label, allowNegative]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw.trim() === '') {
        controller.setSlotValue(moduleId, slotId, null);
        return;
      }
      const n = parseFloat(raw);
      if (Number.isFinite(n)) {
        controller.setSlotValue(moduleId, slotId, n);
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
      <label htmlFor={inputId} className={FORM_LABEL}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={inputId}
          type="number"
          className={FORM_INPUT}
          value={stored ?? ''}
          onChange={handleChange}
          onFocus={handleActivate}
          step={step}
          min={allowNegative ? undefined : '0'}
          data-testid={`number-slot-${moduleId}-${slotId}`}
        />
        {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
      {isActive && (
        <p className="mt-1 truncate font-mono text-sm text-cyan-600 dark:text-cyan-400">
          Keypad: {controller.state.display}
        </p>
      )}
    </div>
  );
}
