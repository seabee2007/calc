import { supabase } from '../lib/supabase';
import type {
  AttendanceRow,
  SafetyJhaRow,
  SafetyMeeting,
  ToolboxTalk,
} from '../types/fieldTools';

function mapSafetyMeeting(row: Record<string, unknown>): SafetyMeeting {
  return {
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
    toolboxContent: (row.toolbox_content as ToolboxTalk) ?? null,
    jhaRows: (row.jha_rows as SafetyJhaRow[]) ?? [],
    attendees: (row.attendees as AttendanceRow[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDbRow(meeting: SafetyMeeting, userId: string) {
  return {
    user_id: userId,
    project_id: meeting.projectId || null,
    project_name: meeting.projectName || null,
    project_address: meeting.projectAddress || null,
    meeting_date: meeting.meetingDate || null,
    supervisor: meeting.supervisor || null,
    company_name: meeting.companyName || null,
    weather: meeting.weather || null,
    work_activity: meeting.workActivity || null,
    toolbox_topic: meeting.toolboxTopic || null,
    toolbox_content: meeting.toolboxContent ?? {},
    jha_rows: meeting.jhaRows ?? [],
    attendees: meeting.attendees ?? [],
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
