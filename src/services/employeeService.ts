import { getAppUrl, normalizeUrlBase } from '../config/brand';
import { canInviteTeamMember } from '../lib/entitlements';
import { supabase } from '../lib/supabase';
import type { EmployeeInvite, EmployeeProjectAssignment, UserRole } from '../types/fieldPlanner';
import { assertCurrentUserHasFeature, resolveCurrentUserPlan } from './featureEntitlementService';
import { fetchTeamProfiles } from './profileService';

/** App origin for employee invite links — uses VITE_APP_URL, not accidental window.location. */
export function resolveEmployeeInviteAppOrigin(explicitOrigin?: string): string {
  if (explicitOrigin?.trim()) {
    return normalizeUrlBase(explicitOrigin);
  }
  return getAppUrl();
}

export function employeeInviteSignupHref(token: string, origin?: string): string {
  const base = resolveEmployeeInviteAppOrigin(origin);
  return `${base}/signup?invite=${encodeURIComponent(token)}`;
}

export function employeeInviteLoginHref(token: string, origin?: string): string {
  const base = resolveEmployeeInviteAppOrigin(origin);
  return `${base}/login?invite=${encodeURIComponent(token)}`;
}

export interface EmployeeInvitePreview {
  email: string;
  role: string;
  expired: boolean;
  revoked?: boolean;
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
  if (row.revoked === true && typeof row.email === 'string') {
    return { email: row.email, role: 'employee', expired: false, revoked: true };
  }
  if (typeof row.email !== 'string') return null;
  return {
    email: row.email,
    role: typeof row.role === 'string' ? row.role : 'employee',
    expired: false,
  };
}

export interface SendEmployeeInviteResult {
  inviteId: string;
  email: string;
  role?: string;
  status?: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt?: string;
  emailSent: boolean;
  emailStatus: 'pending' | 'sent' | 'failed';
  reused?: boolean;
  rotatedToken?: boolean;
  error?: string;
  existingUser?: boolean;
}

function mapInvite(row: Record<string, unknown>): EmployeeInvite {
  return {
    id: row.id as string,
    employerId: row.employer_id as string,
    email: row.email as string,
    role: row.role as string,
    status: (row.status as EmployeeInvite['status']) ?? 'pending',
    token: row.token as string,
    expiresAt: row.expires_at as string,
    acceptedAt: (row.accepted_at as string) ?? null,
    revokedAt: (row.revoked_at as string) ?? null,
    revokedBy: (row.revoked_by as string) ?? null,
    emailStatus: (row.email_status as EmployeeInvite['emailStatus']) ?? 'pending',
    emailSentAt: (row.email_sent_at as string) ?? null,
    emailLastError: (row.email_last_error as string) ?? null,
    emailSendCount: Number(row.email_send_count ?? 0),
    emailLastAttemptAt: (row.email_last_attempt_at as string) ?? null,
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
    .eq('status', 'pending')
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

export async function createEmployeeInvite(
  _employerId: string,
  email: string,
  role: UserRole = 'employee',
): Promise<SendEmployeeInviteResult> {
  await assertCurrentUserHasFeature('employee_portal');

  const plan = await resolveCurrentUserPlan();
  const [pendingInvites, teamProfiles] = await Promise.all([
    fetchPendingInvites(_employerId),
    fetchTeamProfiles(_employerId),
  ]);
  const activePendingInvites = pendingInvites.filter(
    (invite) => new Date(invite.expiresAt).getTime() > Date.now(),
  );
  const seatUsageCount = activePendingInvites.length + teamProfiles.length;
  const canInviteLocally = canInviteTeamMember(plan, seatUsageCount);
  const existingPendingInvite = pendingInvites.some(
    (invite) => invite.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!canInviteLocally && !existingPendingInvite) {
    throw new Error(
      'Field seat limit reached. Starter includes 1 field seat. Remove a pending invite, deactivate a field user, or upgrade for additional field seats.',
    );
  }

  return callInviteEmployeeFunction({
    email: email.trim().toLowerCase(),
    role: role === 'owner' || role === 'client' ? 'employee' : role,
  });
}

export async function sendEmployeeInviteEmail(
  inviteId: string,
  options?: { redirectTo?: string; siteUrl?: string },
): Promise<SendEmployeeInviteResult> {
  return callInviteEmployeeFunction({ inviteId, redirectTo: options?.redirectTo, siteUrl: options?.siteUrl });
}

async function callInviteEmployeeFunction(
  payload: {
    inviteId?: string;
    email?: string;
    role?: UserRole;
    action?: 'send' | 'revoke';
    redirectTo?: string;
    siteUrl?: string;
  },
): Promise<SendEmployeeInviteResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const siteUrl = payload.siteUrl ?? getAppUrl();
  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/invite-employee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      siteUrl,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    inviteId?: string;
    email?: string;
    role?: string;
    status?: 'pending' | 'accepted' | 'revoked' | 'expired';
    expiresAt?: string;
    emailSent?: boolean;
    emailStatus?: 'pending' | 'sent' | 'failed';
    reused?: boolean;
    rotatedToken?: boolean;
    existingUser?: boolean;
  };

  if (!res.ok) {
    throw new Error(body.error ?? 'Failed to send invite');
  }

  return {
    inviteId: body.inviteId ?? payload.inviteId ?? '',
    email: body.email ?? payload.email ?? '',
    role: body.role,
    status: body.status,
    expiresAt: body.expiresAt,
    emailSent: body.emailSent === true,
    emailStatus: body.emailStatus ?? (body.emailSent ? 'sent' : 'failed'),
    reused: body.reused,
    rotatedToken: body.rotatedToken,
    error: body.error,
    existingUser: body.existingUser,
  };
}

export async function revokeEmployeeInvite(inviteId: string): Promise<void> {
  try {
    const result = await callInviteEmployeeFunction({ inviteId, action: 'revoke' });
    if (result.status === 'revoked') return;
  } catch {
    // Fall through to the direct RLS-protected update. This keeps revoke working
    // in local/dev environments where the Edge Function has not been redeployed.
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('employee_invites')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .is('accepted_at', null)
    .select('id, status')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not revoke invite');
  }
  if ((data as { status?: string } | null)?.status !== 'revoked') {
    throw new Error('Could not revoke invite');
  }
}

export interface RemoveEmployeeFromWorkspaceResult {
  employeeId: string;
  workspaceId: string;
  assignmentsRemoved: number;
  invitesRevoked: number;
  teamMemberCount: number;
  pendingInviteCount: number;
  seatReleased: boolean;
}

export async function removeEmployeeFromWorkspace(
  employeeId: string,
): Promise<RemoveEmployeeFromWorkspaceResult> {
  const { data, error } = await supabase.rpc('remove_employee_from_workspace', {
    p_employee_id: employeeId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Could not remove employee from workspace');
  }
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    throw new Error('Could not remove employee from workspace');
  }
  return {
    employeeId: String(row.employeeId ?? employeeId),
    workspaceId: String(row.workspaceId ?? ''),
    assignmentsRemoved: Number(row.assignmentsRemoved ?? 0),
    invitesRevoked: Number(row.invitesRevoked ?? 0),
    teamMemberCount: Number(row.teamMemberCount ?? 0),
    pendingInviteCount: Number(row.pendingInviteCount ?? 0),
    seatReleased: row.seatReleased === true,
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
