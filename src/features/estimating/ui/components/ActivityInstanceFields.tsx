import type { ActivityInstanceIdentityInput } from '../../application/constructionActivityService';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

interface Props {
  activityName: string;
  instanceLabel: string;
  location: string;
  drawingReference: string;
  notes: string;
  onActivityNameChange: (value: string) => void;
  onInstanceLabelChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDrawingReferenceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  duplicateTemplateWarning?: string | null;
  previewTitle?: string;
  previewCode?: string;
}

export default function ActivityInstanceFields({
  activityName,
  instanceLabel,
  location,
  drawingReference,
  notes,
  onActivityNameChange,
  onInstanceLabelChange,
  onLocationChange,
  onDrawingReferenceChange,
  onNotesChange,
  duplicateTemplateWarning,
  previewTitle,
  previewCode,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity Identity</p>
      {duplicateTemplateWarning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {duplicateTemplateWarning}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Activity Name</span>
          <input className={FIELD_CLASS} value={activityName} onChange={(e) => onActivityNameChange(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Instance Label / Area</span>
          <input
            className={FIELD_CLASS}
            value={instanceLabel}
            onChange={(e) => onInstanceLabelChange(e.target.value)}
            placeholder="F-1, Area C-2, Grid A/1-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Location</span>
          <input
            className={FIELD_CLASS}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="North foundation wall"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Drawing Reference</span>
          <input
            className={FIELD_CLASS}
            value={drawingReference}
            onChange={(e) => onDrawingReferenceChange(e.target.value)}
            placeholder="S-101"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Notes</span>
          <input className={FIELD_CLASS} value={notes} onChange={(e) => onNotesChange(e.target.value)} />
        </label>
      </div>
      {previewTitle ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Preview:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-200">{previewCode ?? '—'}</span>{' '}
          {previewTitle}
        </p>
      ) : null}
    </div>
  );
}

export function buildIdentityFromForm(input: {
  activityName: string;
  instanceLabel: string;
  location: string;
  drawingReference: string;
  notes: string;
}): ActivityInstanceIdentityInput {
  return {
    activityName: input.activityName,
    instanceLabel: input.instanceLabel || null,
    location: input.location || null,
    drawingReference: input.drawingReference || null,
    notes: input.notes || null,
  };
}
