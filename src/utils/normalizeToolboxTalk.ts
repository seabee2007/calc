import type { AttendanceRow, SafetyJhaRow, SafetyMeeting, ToolboxTalk } from '../types/fieldTools';

export function normalizeToolboxTalkContent(
  content: Partial<ToolboxTalk> | null | undefined,
): ToolboxTalk | null {
  if (content == null) return null;

  const normalized: ToolboxTalk = {
    topicKey: content.topicKey ?? '',
    title: content.title ?? '',
    explanation: content.explanation ?? '',
    keyHazards: Array.isArray(content.keyHazards) ? content.keyHazards : [],
    safePractices: Array.isArray(content.safePractices) ? content.safePractices : [],
    crewReminder: content.crewReminder ?? '',
    supervisorQuestion: content.supervisorQuestion ?? '',
  };

  const hasContent =
    normalized.topicKey.trim() !== '' ||
    normalized.title.trim() !== '' ||
    normalized.explanation.trim() !== '' ||
    normalized.keyHazards.length > 0 ||
    normalized.safePractices.length > 0 ||
    normalized.crewReminder.trim() !== '' ||
    normalized.supervisorQuestion.trim() !== '';

  return hasContent ? normalized : null;
}

export function normalizeSafetyMeeting(meeting: SafetyMeeting): SafetyMeeting {
  return {
    ...meeting,
    jhaRows: Array.isArray(meeting.jhaRows) ? meeting.jhaRows : [],
    attendees: Array.isArray(meeting.attendees) ? meeting.attendees : [],
    toolboxContent: normalizeToolboxTalkContent(meeting.toolboxContent),
  };
}

export function normalizeJhaRows(rows: SafetyJhaRow[] | null | undefined): SafetyJhaRow[] {
  return Array.isArray(rows) ? rows : [];
}

export function normalizeAttendanceRows(rows: AttendanceRow[] | null | undefined): AttendanceRow[] {
  return Array.isArray(rows) ? rows : [];
}
