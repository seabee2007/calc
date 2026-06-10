import { useCallback, useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { assignProjectActivityCode } from '../../application/constructionActivityCoding';
import type { UpdateProjectActivityInput } from '../../application/constructionActivityService';
import ActivityInstanceFields, { buildIdentityFromForm } from './ActivityInstanceFields';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

interface Props {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  onSave: (input: UpdateProjectActivityInput) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function EditConstructionActivityModal({
  activity,
  lineItems,
  onSave,
  onCancel,
  saving,
}: Props) {
  const [activityName, setActivityName] = useState(activity.baseTitle ?? activity.title);
  const [instanceLabel, setInstanceLabel] = useState(activity.instanceLabel ?? '');
  const [location, setLocation] = useState(activity.location ?? '');
  const [drawingReference, setDrawingReference] = useState(activity.drawingReference ?? '');
  const [notes, setNotes] = useState(activity.notes ?? '');
  const [crewSizeStr, setCrewSizeStr] = useState(String(activity.crewSize));
  const [hoursPerDayStr, setHoursPerDayStr] = useState(String(activity.hoursPerDay));
  const [durationOverrideStr, setDurationOverrideStr] = useState(
    activity.durationDaysOverride != null ? String(activity.durationDaysOverride) : '',
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(activity.scheduleEnabled);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(lineItems.map((item) => [item.id, String(item.quantity)])),
  );

  const identity = useMemo(
    () =>
      buildIdentityFromForm({
        activityName,
        instanceLabel,
        location,
        drawingReference,
        notes,
      }),
    [activityName, drawingReference, instanceLabel, location, notes],
  );

  const preview = useMemo(
    () =>
      assignProjectActivityCode({
        existingActivities: [activity],
        divisionCode: activity.divisionCode,
        sourceTemplateKey: activity.sourceTemplateKey ?? activity.templateId ?? '',
        identity,
        preserveActivityCode: activity.activityCode,
        excludeActivityId: activity.id,
      }),
    [activity, identity],
  );

  const handleSave = useCallback(async () => {
    const crewSize = Math.max(1, parseInt(crewSizeStr, 10) || activity.crewSize);
    const hoursPerDay = Math.max(0.5, parseFloat(hoursPerDayStr) || activity.hoursPerDay);
    const durationDaysOverride =
      durationOverrideStr.trim() === ''
        ? null
        : Math.max(1, parseInt(durationOverrideStr, 10) || 1);

    const lineItemQuantities: Record<string, number> = {};
    for (const item of lineItems) {
      const raw = quantities[item.id];
      lineItemQuantities[item.id] = raw !== undefined && raw !== '' ? parseFloat(raw) || 0 : item.quantity;
    }

    await onSave({
      activity,
      lineItems,
      identity,
      crewSize,
      hoursPerDay,
      durationDaysOverride,
      scheduleEnabled,
      lineItemQuantities,
    });
  }, [
    activity,
    crewSizeStr,
    durationOverrideStr,
    hoursPerDayStr,
    identity,
    lineItems,
    onSave,
    quantities,
    scheduleEnabled,
  ]);

  return (
    <Modal isOpen onClose={onCancel} title="Edit Construction Activity" size="lg">
      <div className="space-y-4">
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{activity.activityCode}</p>

        <ActivityInstanceFields
          activityName={activityName}
          instanceLabel={instanceLabel}
          location={location}
          drawingReference={drawingReference}
          notes={notes}
          onActivityNameChange={setActivityName}
          onInstanceLabelChange={setInstanceLabel}
          onLocationChange={setLocation}
          onDrawingReferenceChange={setDrawingReference}
          onNotesChange={setNotes}
          previewTitle={preview.title}
          previewCode={activity.activityCode}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Crew Size</span>
            <input className={FIELD_CLASS} value={crewSizeStr} onChange={(e) => setCrewSizeStr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Hours / Day</span>
            <input className={FIELD_CLASS} value={hoursPerDayStr} onChange={(e) => setHoursPerDayStr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Duration Override (days)
            </span>
            <input
              className={FIELD_CLASS}
              value={durationOverrideStr}
              onChange={(e) => setDurationOverrideStr(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
          />
          Include on schedule (Logic Network / CPM)
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Work Element Quantities
          </p>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <label key={item.id} className="grid grid-cols-[1fr_120px_60px] items-center gap-2">
                <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.name}</span>
                <input
                  className={FIELD_CLASS}
                  value={quantities[item.id] ?? ''}
                  onChange={(e) => setQuantities((current) => ({ ...current, [item.id]: e.target.value }))}
                />
                <span className="text-xs text-slate-500">{item.unit}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !activityName.trim()}
            onClick={() => void handleSave()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Activity'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
