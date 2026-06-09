import { supabase } from '../lib/supabase';
import type {
  AcceptProjectInvitationResult,
  CreateProjectInvitationResult,
  ProjectInvitationPreview,
  ProjectMemberRole,
} from '../types/projectInvite';
import { getProjectInviteUrl } from '../utils/shareLinks';

function mapInvitationPreview(data: Record<string, unknown>): ProjectInvitationPreview {
  const status = data.status;
  if (status === 'revoked' || status === 'accepted' || status === 'expired') {
    return { status };
  }

  return {
    status: 'pending',
    projectId: typeof data.project_id === 'string' ? data.project_id : undefined,
    projectName: typeof data.project_name === 'string' ? data.project_name : undefined,
    role: typeof data.role === 'string' ? (data.role as ProjectMemberRole) : undefined,
    inviteeEmail: typeof data.invitee_email === 'string' ? data.invitee_email : null,
    inviteeName: typeof data.invitee_name === 'string' ? data.invitee_name : null,
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : undefined,
  };
}

export async function fetchProjectInvitationPreview(
  token: string,
): Promise<ProjectInvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_project_invitation_by_token', {
    p_token: token,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  return mapInvitationPreview(data as Record<string, unknown>);
}

export async function createProjectInvitation(input: {
  projectId: string;
  inviteeEmail?: string;
  inviteeName?: string;
  role?: ProjectMemberRole;
}): Promise<CreateProjectInvitationResult & { inviteUrl: string }> {
  const { data, error } = await supabase.rpc('create_project_invitation', {
    p_project_id: input.projectId,
    p_invitee_email: input.inviteeEmail ?? null,
    p_invitee_name: input.inviteeName ?? null,
    p_role: input.role ?? 'client_viewer',
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Could not create invitation');
  }

  const row = data as Record<string, unknown>;
  const token = row.token as string;
  return {
    token,
    projectId: row.project_id as string,
    role: row.role as ProjectMemberRole,
    expiresAt: row.expires_at as string,
    inviteUrl: getProjectInviteUrl(token),
  };
}

export async function acceptProjectInvitation(
  token: string,
): Promise<AcceptProjectInvitationResult> {
  const { data, error } = await supabase.rpc('accept_project_invitation', {
    p_token: token,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Could not accept invitation');
  }

  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    projectId: row.project_id as string,
    role: row.role as ProjectMemberRole,
  };
}

export function storePendingProjectInviteToken(token: string): void {
  try {
    sessionStorage.setItem('pendingProjectInviteToken', token);
  } catch {
    // ignore storage failures
  }
}

export function consumePendingProjectInviteToken(): string | null {
  try {
    const token = sessionStorage.getItem('pendingProjectInviteToken');
    if (token) {
      sessionStorage.removeItem('pendingProjectInviteToken');
    }
    return token;
  } catch {
    return null;
  }
}

export function formatProjectInviteRole(role?: string): string {
  if (!role) return 'Client viewer';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
