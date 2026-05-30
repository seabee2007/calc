import { supabase } from '../lib/supabase';
import type { EmployeeInvite, EmployeeProjectAssignment, UserRole } from '../types/fieldPlanner';

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
  redirectTo?: string,
): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/invite-employee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ inviteId, redirectTo }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to send invite');
  }
}

export async function acceptInviteForCurrentUser(
  inviteToken: string,
  userId: string,
): Promise<void> {
  const { data: invite, error } = await supabase
    .from('employee_invites')
    .select('*')
    .eq('token', inviteToken)
    .is('accepted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!invite) throw new Error('Invite not found or expired');

  const expires = new Date(invite.expires_at as string);
  if (expires < new Date()) throw new Error('Invite has expired');

  const { ensureEmployeeProfile } = await import('./profileService');
  await ensureEmployeeProfile(
    userId,
    invite.employer_id as string,
    invite.role as UserRole,
  );

  await supabase
    .from('employee_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);
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
