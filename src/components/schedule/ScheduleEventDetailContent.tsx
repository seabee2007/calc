import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Image, Repeat } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventTypeBadge from './ScheduleEventTypeBadge';
import ScheduleStatusBadge from './ScheduleStatusBadge';
import SchedulePriorityBadge from './SchedulePriorityBadge';
import Button from '../ui/Button';
import { SCHEDULE_BODY, SCHEDULE_HEADING, SCHEDULE_MUTED } from './scheduleTheme';
import {
  formatScheduleDateTime,
  formatScheduleEventDateRange,
  isMultiDayEvent,
} from '../../utils/scheduleEventUtils';
import {
  formatRecurrenceSummary,
  isRecurringOccurrenceSelection,
  isRecurringSeriesMaster,
} from '../../utils/scheduleRecurrenceUtils';
import { plannerBoardHref } from '../../utils/plannerRoutes';

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#E5E7EB] pt-4 first:border-0 first:pt-0 dark:border-slate-700">
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${SCHEDULE_MUTED}`}>
        {title}
      </h4>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return null;
  }
  return (
    <div>
      <dt className={`text-xs font-medium ${SCHEDULE_MUTED}`}>{label}</dt>
      <dd className={`mt-0.5 text-sm ${SCHEDULE_BODY}`}>{value}</dd>
    </div>
  );
}

interface Props {
  event: ScheduleEvent;
  canComment?: boolean;
  onAddComment?: (body: string) => Promise<void>;
  commentBusy?: boolean;
}

export default function ScheduleEventDetailContent({
  event,
  canComment,
  onAddComment,
  commentBusy,
}: Props) {
  const [commentText, setCommentText] = useState('');

  const handleComment = async () => {
    if (!onAddComment || !commentText.trim()) return;
    await onAddComment(commentText.trim());
    setCommentText('');
  };

  const attachments = [
    ...event.relatedDocuments.map((d) => ({ ...d, kind: 'document' as const })),
    ...event.relatedPhotos.map((p) => ({ ...p, kind: 'photo' as const })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2">
          <h3 className={`flex-1 text-lg font-semibold ${SCHEDULE_HEADING}`}>{event.title}</h3>
          {(isRecurringSeriesMaster(event) ||
            isRecurringOccurrenceSelection(event) ||
            event.recurrenceRule) && (
            <Repeat
              className="mt-1 h-4 w-4 shrink-0 text-[#2563EB]"
              aria-label="Recurring event"
              title="Recurring event"
            />
          )}
        </div>
        {(event.recurrenceRule || event.seriesMasterId) && (
          <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>
            {event.recurrenceRule
              ? formatRecurrenceSummary(event.recurrenceRule)
              : 'Part of a recurring series'}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <ScheduleEventTypeBadge type={event.eventType} />
          <ScheduleStatusBadge status={event.status} />
          <SchedulePriorityBadge priority={event.priority} />
        </div>
        <p className={`mt-2 text-sm ${SCHEDULE_BODY}`}>
          {isMultiDayEvent(event)
            ? formatScheduleEventDateRange(event)
            : formatScheduleDateTime(event)}
        </p>
      </div>

      <DetailSection title="Project">
        <dl className="space-y-3">
          <DetailRow label="Project" value={event.projectName} />
          <DetailRow label="Trade" value={event.trade} />
          <DetailRow label="Location" value={event.location} />
        </dl>
      </DetailSection>

      <DetailSection title="Assigned users">
        <DetailRow
          label="Assigned"
          value={
            event.assignedTo.length > 0 ? (
              <ul className="list-inside list-disc">
                {event.assignedTo.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            ) : (
              <span className={SCHEDULE_MUTED}>None assigned</span>
            )
          }
        />
        <div className="mt-3">
          <DetailRow label="Crew" value={event.crew} />
        </div>
      </DetailSection>

      {event.weatherRisk && (
        <DetailSection title="Weather impact">
          <p className={`text-sm capitalize ${SCHEDULE_BODY}`}>{event.weatherRisk} risk</p>
        </DetailSection>
      )}

      {event.taskId && (
        <DetailSection title="Related tasks">
          <Link
            to={plannerBoardHref(event.projectId, event.taskId)}
            className="text-sm font-medium text-[#2563EB] hover:underline"
          >
            Open planner task
          </Link>
        </DetailSection>
      )}

      {attachments.length > 0 && (
        <DetailSection title="Attachments">
          <ul className="space-y-1">
            {attachments.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-[#2563EB] hover:underline"
                >
                  {item.kind === 'photo' ? (
                    <Image className="h-3 w-3 shrink-0" />
                  ) : (
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  )}
                  {item.name || (item.kind === 'photo' ? 'Photo' : 'Document')}
                </a>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {event.notes && (
        <DetailSection title="Notes">
          <p className={`text-sm ${SCHEDULE_BODY}`}>{event.notes}</p>
        </DetailSection>
      )}

      <DetailSection title="Comments">
        {event.comments.length === 0 && (
          <p className={`text-xs ${SCHEDULE_MUTED}`}>No comments yet.</p>
        )}
        <div className="space-y-2">
          {event.comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <p className={SCHEDULE_BODY}>{c.body}</p>
              <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>
                {new Date(c.at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        {canComment && onAddComment && (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              rows={2}
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={() => void handleComment()}
              disabled={commentBusy || !commentText.trim()}
              isLoading={commentBusy}
            >
              Post comment
            </Button>
          </div>
        )}
      </DetailSection>

      {event.activityLog.length > 0 && (
        <DetailSection title="Activity feed">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {[...event.activityLog].reverse().map((entry) => (
              <div key={entry.id} className="text-xs text-[#4B5563] dark:text-slate-400">
                <span className="font-medium capitalize">{entry.action}</span>
                {entry.detail ? ` — ${entry.detail}` : ''}
                <span className={`block ${SCHEDULE_MUTED}`}>
                  {new Date(entry.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <p className={`text-xs ${SCHEDULE_MUTED}`}>Calendar sync — coming soon</p>
    </div>
  );
}
