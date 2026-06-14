import { supabase } from '../lib/supabase';
import type { EmployeeInvite, EmployeeProjectAssignment, UserRole } from '../types/fieldPlanner';

export function employeeInviteSignupHref(token: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return `${base}/signup?invite=${encodeURIComponent(token)}`;
}

export function employeeInviteLoginHref(token: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return `${base}/login?invite=${encodeURIComponent(token)}`;
}

export interface EmployeeInvitePreview {
  email: string;
  role: string;
  expired: boolean;
}

export async function fetchEmployeeInvitePreview(
  token: string,
): Promise<EmployeeInvitePreview | null> {
  const { data, error } = await supabase.rpc('get_employee_invite_by_token', {
    p_token: token,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (row.expired === true && typeof row.email === 'string') {
    return { email: row.email, role: 'employee', expired: true };
  }
  if (typeof row.email !== 'string') return null;
  return {
    email: row.email,
    role: typeof row.role === 'string' ? row.role : 'employee',
    expired: false,
  };
}

export interface SendEmployeeInviteResult {
  inviteLink: string;
  existingUser?: boolean;
}

function mapInvite(row: Record<string, unknown>): EmployeeInvite {
  return {
    id: row.id as string,
    employerId: row.employer_id as string,
    email: row.email as string,
    role: row.role as string,
    token: row.token as string,
    expiresAt: row.expires_at as string,
    acceptedAt: (row.accepted_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapAssignment(row: Record<string, unknown>): EmployeeProjectAssignment {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    projectId: row.project_id as string,
    role: (row.role as string) ?? 'employee',
    assignedBy: (row.assigned_by as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchPendingInvites(employerId: string): Promise<EmployeeInvite[]> {
  const { data, error } = await supabase
    .from('employee_invites')
    .select('*')
    .eq('employer_id', employerId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export async function createEmployeeInvite(
  employerId: string,
  email: string,
  role: UserRole = 'employee',
) {
  const { data, error } = await supabase
    .from('employee_invites')
    .insert({
      employer_id: employerId,
      email: email.trim().toLowerCase(),
      role: role === 'owner' || role === 'client' ? 'employee' : role,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapInvite(data);
}

export async function sendEmployeeInviteEmail(
  inviteId: string,
  options?: { redirectTo?: string; siteUrl?: string },
): Promise<SendEmployeeInviteResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const siteUrl = options?.siteUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/invite-employee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      inviteId,
      siteUrl,
      redirectTo: options?.redirectTo,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    inviteLink?: string;
    existingUser?: boolean;
  };

  if (!res.ok) {
    throw new Error(body.error ?? 'Failed to send invite');
  }

  return {
    inviteLink: body.inviteLink ?? '',
    existingUser: body.existingUser,
  };
}

export async function acceptInviteForCurrentUser(
  inviteToken: string,
  userId?: string,
): Promise<void> {
  void userId;
  const { error } = await supabase.rpc('accept_employee_invite', {
    p_token: inviteToken,
  });
  if (error) throw error;
}

export async function syncEmployeeProfileFromInvites(): Promise<{
  ok: boolean;
  role?: string;
  reason?: string;
}> {
  const { data, error } = await supabase.rpc('sync_employee_profile_from_invites');
  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message ?? '';
    const rpcUnavailable =
      code === 'PGRST202' ||
      code === '42883' ||
      /sync_employee_profile_from_invites/i.test(message);
    if (rpcUnavailable) {
      return { ok: false, reason: 'rpc_unavailable' };
    }
    throw error;
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty_response' };
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    role: typeof row.role === 'string' ? row.role : undefined,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
  };
}

export async function fetchAssignmentsForProject(
  projectId: string,
): Promise<EmployeeProjectAssignment[]> {
  const { data, error } = await supabase
    .from('employee_project_assignments')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function fetchAssignmentsForEmployee(
  employeeId: string,
): Promise<EmployeeProjectAssignment[]> {
  const { data, error } = await supabase
    .from('employee_project_assignments')
    .select('*')
    .eq('employee_id', employeeId);

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function assignEmployeeToProject(
  employeeId: string,
  projectId: string,
  assignedBy: string,
  role = 'employee',
) {
  const { data, error } = await supabase
    .from('employee_project_assignments')
    .upsert(
      {
        employee_id: employeeId,
        project_id: projectId,
        assigned_by: assignedBy,
        role,
      },
      { onConflict: 'employee_id,project_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return mapAssignment(data);
}

export async function removeEmployeeFromProject(assignmentId: string) {
  const { error } = await supabase
    .from('employee_project_assignments')
    .delete()
    .eq('id', assignmentId);
  if (error) throw error;
}

export async function fetchAssignedProjects(employeeId: string) {
  const assignments = await fetchAssignmentsForEmployee(employeeId);
  if (assignments.length === 0) return [];

  const projectIds = assignments.map((a) => a.projectId);
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, pour_date, jobsite_city, jobsite_state, created_at')
    .in('id', projectIds)
    .order('name');

  if (error) throw error;
  return data ?? [];
}
