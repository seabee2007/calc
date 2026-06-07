import React, { useId } from 'react';
import { FORM_LABEL, FORM_LABEL_FOCUS } from '../../../../theme/appTheme';

interface FieldLabelWithTooltipProps {
  htmlFor: string;
  label: string;
  tooltip: string;
}

export default function FieldLabelWithTooltip({
  htmlFor,
  label,
  tooltip,
}: FieldLabelWithTooltipProps) {
  const tooltipId = useId();

  return (
    <div className="group relative mb-1 inline-flex max-w-full">
      <label
        htmlFor={htmlFor}
        tabIndex={0}
        aria-describedby={tooltipId}
        className={`${FORM_LABEL} cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
      >
        {label}
      </label>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-max max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-normal normal-case text-slate-100 shadow-lg group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </div>
  );
}
