import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type {
  ProjectMilestoneKey,
  ScheduleEvent,
  ScheduleEventDocument,
  ScheduleEventInput,
  ScheduleEventType,
  SchedulePriority,
  ScheduleWeatherRisk,
} from '../../types/scheduleEvent';
import {
  PROJECT_MILESTONE_KEYS,
  SCHEDULE_EVENT_TYPES,
  SCHEDULE_EVENT_STATUSES,
  SCHEDULE_EVENT_TYPE_LABELS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_WEATHER_RISKS,
  SCHEDULE_PRIORITIES,
  SCHEDULE_PRIORITY_LABELS,
  MILESTONE_LABELS,
  normalizeMilestoneKey,
} from '../../types/scheduleEvent';
import { SCHEDULE_FILTER_INPUT, SCHEDULE_MUTED } from './scheduleTheme';
import { PLANNER_FORM_LABEL } from '../planner/plannerTheme';
import { toIsoDate } from '../../utils/scheduleEventUtils';
import type { RecurrenceRule, ScheduleEventSavePayload } from '../../types/scheduleEvent';
import {
  defaultRecurrenceRule,
  isRecurringOccurrenceSelection,
  parseRecurrenceInstanceId,
} from '../../utils/scheduleRecurrenceUtils';
import ScheduleRecurrenceFormSection from './ScheduleRecurrenceFormSection';

interface ProjectOption {
  id: string;
  name: string;
}

export interface ScheduleEventCreateDefaults {
  startDate: string;
  startTime?: string;
  endTime?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: ScheduleEventSavePayload) => Promise<void>;
  projects: ProjectOption[];
  defaultProjectId?: string;
  defaultValues?: ScheduleEventCreateDefaults | null;
  event?: ScheduleEvent | null;
  focusDatesOnly?: boolean;
  userId: string;
}

const emptyDoc = (): ScheduleEventDocument => ({
  id: crypto.randomUUID(),
  name: '',
  url: '',
});

export default function ScheduleEventFormModal({
  isOpen,
  onClose,
  onSave,
  projects,
  defaultProjectId,
  defaultValues,
  event,
  focusDatesOnly,
  userId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<ScheduleEventType>('general_task');
  const [status, setStatus] = useState<ScheduleEventInput['status']>('scheduled');
  const [startDate, setStartDate] = useState(toIsoDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [trade, setTrade] = useState('');
  const [crew, setCrew] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [weatherRisk, setWeatherRisk] = useState<ScheduleWeatherRisk | ''>('');
  const [milestoneKey, setMilestoneKey] = useState<ProjectMilestoneKey | ''>('');
  const [assignedToText, setAssignedToText] = useState('');
  const [priority, setPriority] = useState<SchedulePriority>('medium');
  const [documents, setDocuments] = useState<ScheduleEventDocument[]>([]);
  const [photos, setPhotos] = useState<ScheduleEventDocument[]>([]);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(defaultRecurrenceRule());

  useEffect(() => {
    if (!isOpen) return;
    if (event) {
      setProjectId(event.projectId);
      setTitle(event.title);
      setEventType(event.eventType);
      setStatus(event.status);
      setStartDate(event.startDate);
      setEndDate(event.endDate ?? '');
      setStartTime(event.startTime ?? '');
      setEndTime(event.endTime ?? '');
      setTrade(event.trade ?? '');
      setCrew(event.crew ?? '');
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
      setWeatherRisk(event.weatherRisk ?? '');
      setMilestoneKey(normalizeMilestoneKey(event.milestoneKey) ?? '');
      setAssignedToText(event.assignedTo.join(', '));
      setPriority(event.priority);
      setDocuments(
        event.relatedDocuments.length > 0 ? event.relatedDocuments : [],
      );
      setPhotos(event.relatedPhotos.length > 0 ? event.relatedPhotos : []);
      const hasRule = !!event.recurrenceRule && !event.recurrenceSeriesId;
      setRecurrenceEnabled(hasRule || isRecurringOccurrenceSelection(event));
      setRecurrenceRule(event.recurrenceRule ?? defaultRecurrenceRule());
    } else {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '');
      setTitle('');
      setEventType('general_task');
      setStatus('scheduled');
      setStartDate(defaultValues?.startDate ?? toIsoDate(new Date()));
      setEndDate('');
      setStartTime(defaultValues?.startTime ?? '');
      setEndTime(defaultValues?.endTime ?? '');
      setTrade('');
      setCrew('');
      setLocation('');
      setNotes('');
      setWeatherRisk('');
      setMilestoneKey('');
      setAssignedToText('');
      setPriority('medium');
      setDocuments([]);
      setPhotos([]);
      setRecurrenceEnabled(false);
      setRecurrenceRule(defaultRecurrenceRule());
    }
  }, [isOpen, event, defaultProjectId, defaultValues, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !title.trim()) return;
    setBusy(true);
    try {
      const assignedTo = assignedToText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const relatedDocuments = documents.filter((d) => d.name.trim() || d.url.trim());
      const relatedPhotos = photos.filter((d) => d.name.trim() || d.url.trim());
      const parsed = event ? parseRecurrenceInstanceId(event.id) : null;
      await onSave({
        projectId,
        createdBy: userId,
        title: title.trim(),
        eventType,
        status: status ?? 'scheduled',
        priority,
        startDate,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        trade: trade || null,
        crew: crew || null,
        location: location || null,
        notes: notes || null,
        weatherRisk: weatherRisk || null,
        milestoneKey: milestoneKey || null,
        assignedTo,
        relatedDocuments,
        relatedPhotos,
        recurrenceRule: recurrenceEnabled ? recurrenceRule : null,
        occurrenceDate: parsed?.occurrenceDate ?? event?.occurrenceDate ?? undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? (focusDatesOnly ? 'Reschedule event' : 'Edit event') : 'Add schedule event'}
      size="lg"
      stackAboveDrawer
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!focusDatesOnly && (
          <>
            {!defaultProjectId && (
              <div>
                <label className={PLANNER_FORM_LABEL}>Project</label>
                <select
                  className={SCHEDULE_FILTER_INPUT}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={PLANNER_FORM_LABEL}>Title</label>
              <input
                className={SCHEDULE_FILTER_INPUT}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={PLANNER_FORM_LABEL}>Event type</label>
                <select
                  className={SCHEDULE_FILTER_INPUT}
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as ScheduleEventType)}
                >
                  {SCHEDULE_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SCHEDULE_EVENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={PLANNER_FORM_LABEL}>Status</label>
                <select
                  className={SCHEDULE_FILTER_INPUT}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as ScheduleEventInput['status'])
                  }
                >
                  {SCHEDULE_EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SCHEDULE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={PLANNER_FORM_LABEL}>Priority</label>
                <select
                  className={SCHEDULE_FILTER_INPUT}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SchedulePriority)}
                >
                  {SCHEDULE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {SCHEDULE_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={PLANNER_FORM_LABEL}>Start date</label>
            <input
              type="date"
              className={SCHEDULE_FILTER_INPUT}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={PLANNER_FORM_LABEL}>End date (optional)</label>
            <input
              type="date"
              className={SCHEDULE_FILTER_INPUT}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className={PLANNER_FORM_LABEL}>Start time</label>
            <input
              type="time"
              className={SCHEDULE_FILTER_INPUT}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className={PLANNER_FORM_LABEL}>End time</label>
            <input
              type="time"
              className={SCHEDULE_FILTER_INPUT}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        {!focusDatesOnly && !event?.recurrenceSeriesId && (
          <ScheduleRecurrenceFormSection
            enabled={recurrenceEnabled}
            onEnabledChange={setRecurrenceEnabled}
            rule={recurrenceRule}
            onRuleChange={setRecurrenceRule}
          />
        )}
        {!focusDatesOnly && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={PLANNER_FORM_LABEL}>Trade</label>
                <input
                  className={SCHEDULE_FILTER_INPUT}
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                />
              </div>
              <div>
                <label className={PLANNER_FORM_LABEL}>Crew</label>
                <input
                  className={SCHEDULE_FILTER_INPUT}
                  value={crew}
                  onChange={(e) => setCrew(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Location</label>
              <input
                className={SCHEDULE_FILTER_INPUT}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Assigned users (comma-separated)</label>
              <input
                className={SCHEDULE_FILTER_INPUT}
                value={assignedToText}
                onChange={(e) => setAssignedToText(e.target.value)}
              />
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Milestone link (optional)</label>
              <select
                className={SCHEDULE_FILTER_INPUT}
                value={milestoneKey}
                onChange={(e) =>
                  setMilestoneKey(e.target.value as ProjectMilestoneKey | '')
                }
              >
                <option value="">None</option>
                {PROJECT_MILESTONE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {MILESTONE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Weather risk</label>
              <select
                className={SCHEDULE_FILTER_INPUT}
                value={weatherRisk}
                onChange={(e) =>
                  setWeatherRisk(e.target.value as ScheduleWeatherRisk | '')
                }
              >
                <option value="">Not set</option>
                {SCHEDULE_WEATHER_RISKS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={PLANNER_FORM_LABEL}>Notes</label>
              <textarea
                className={SCHEDULE_FILTER_INPUT}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={PLANNER_FORM_LABEL}>Related documents</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDocuments((d) => [...d, emptyDoc()])}
                >
                  Add link
                </Button>
              </div>
              {documents.length === 0 && (
                <p className={`text-xs ${SCHEDULE_MUTED}`}>No documents linked.</p>
              )}
              {documents.map((doc, i) => (
                <div key={doc.id} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={SCHEDULE_FILTER_INPUT}
                    placeholder="Name"
                    value={doc.name}
                    onChange={(e) => {
                      const next = [...documents];
                      next[i] = { ...doc, name: e.target.value };
                      setDocuments(next);
                    }}
                  />
                  <input
                    className={SCHEDULE_FILTER_INPUT}
                    placeholder="URL"
                    value={doc.url}
                    onChange={(e) => {
                      const next = [...documents];
                      next[i] = { ...doc, url: e.target.value };
                      setDocuments(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={PLANNER_FORM_LABEL}>Related photos</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPhotos((d) => [...d, emptyDoc()])}
                >
                  Add photo link
                </Button>
              </div>
              {photos.length === 0 && (
                <p className={`text-xs ${SCHEDULE_MUTED}`}>No photos linked.</p>
              )}
              {photos.map((photo, i) => (
                <div key={photo.id} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={SCHEDULE_FILTER_INPUT}
                    placeholder="Name"
                    value={photo.name}
                    onChange={(e) => {
                      const next = [...photos];
                      next[i] = { ...photo, name: e.target.value };
                      setPhotos(next);
                    }}
                  />
                  <input
                    className={SCHEDULE_FILTER_INPUT}
                    placeholder="URL"
                    value={photo.url}
                    onChange={(e) => {
                      const next = [...photos];
                      next[i] = { ...photo, url: e.target.value };
                      setPhotos(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={busy} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
