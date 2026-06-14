import { supabase } from '../lib/supabase';
import type {
  AttendanceRow,
  SafetyJhaRow,
  SafetyMeeting,
  ToolboxTalk,
} from '../types/fieldTools';
import { normalizeSafetyMeeting } from '../utils/normalizeToolboxTalk';

function mapSafetyMeeting(row: Record<string, unknown>): SafetyMeeting {
  return normalizeSafetyMeeting({
    id: row.id as string,
    userId: row.user_id as string,
    projectId: (row.project_id as string) ?? null,
    projectName: (row.project_name as string) ?? '',
    projectAddress: (row.project_address as string) ?? '',
    meetingDate: (row.meeting_date as string) ?? '',
    supervisor: (row.supervisor as string) ?? '',
    companyName: (row.company_name as string) ?? '',
    weather: (row.weather as string) ?? '',
    workActivity: (row.work_activity as string) ?? '',
    toolboxTopic: (row.toolbox_topic as string) ?? '',
    toolboxContent: (row.toolbox_content as Partial<ToolboxTalk> | null) ?? null,
    jhaRows: (row.jha_rows as SafetyJhaRow[]) ?? [],
    attendees: (row.attendees as AttendanceRow[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  });
}

function toDbRow(meeting: SafetyMeeting, userId: string) {
  const normalized = normalizeSafetyMeeting(meeting);
  return {
    user_id: userId,
    project_id: normalized.projectId || null,
    project_name: normalized.projectName || null,
    project_address: normalized.projectAddress || null,
    meeting_date: normalized.meetingDate || null,
    supervisor: normalized.supervisor || null,
    company_name: normalized.companyName || null,
    weather: normalized.weather || null,
    work_activity: normalized.workActivity || null,
    toolbox_topic: normalized.toolboxTopic || null,
    toolbox_content: normalized.toolboxContent,
    jha_rows: normalized.jhaRows,
    attendees: normalized.attendees,
  };
}

export async function fetchSafetyMeeting(id: string): Promise<SafetyMeeting | null> {
  const { data, error } = await supabase.from('safety_meetings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapSafetyMeeting(data) : null;
}

export async function listSafetyMeetings(userId: string, limit = 20): Promise<SafetyMeeting[]> {
  const { data, error } = await supabase
    .from('safety_meetings')
    .select('*')
    .eq('user_id', userId)
    .order('meeting_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapSafetyMeeting);
}

export async function listSafetyMeetingsForProject(
  projectId: string,
  userId: string,
): Promise<SafetyMeeting[]> {
  const { data, error } = await supabase
    .from('safety_meetings')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('meeting_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSafetyMeeting);
}

export async function upsertSafetyMeeting(
  meeting: SafetyMeeting,
  userId: string,
): Promise<SafetyMeeting> {
  const payload = toDbRow(meeting, userId);

  if (meeting.id) {
    const { data, error } = await supabase
      .from('safety_meetings')
      .update(payload)
      .eq('id', meeting.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return mapSafetyMeeting(data);
  }

  const { data, error } = await supabase
    .from('safety_meetings')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapSafetyMeeting(data);
}

export async function deleteSafetyMeeting(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('safety_meetings').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
