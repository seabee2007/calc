export type ProjectMemberRole =
  | 'owner'
  | 'admin'
  | 'team_member'
  | 'client_viewer'
  | 'client_collaborator';

export type ProjectInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface ProjectInvitationPreview {
  status: ProjectInvitationStatus;
  projectId?: string;
  projectName?: string;
  role?: ProjectMemberRole;
  inviteeEmail?: string | null;
  inviteeName?: string | null;
  expiresAt?: string;
}

export interface CreateProjectInvitationResult {
  token: string;
  projectId: string;
  role: ProjectMemberRole;
  expiresAt: string;
}

export interface AcceptProjectInvitationResult {
  ok: boolean;
  projectId: string;
  role: ProjectMemberRole;
}

export const PROJECT_CLIENT_ROLES: Array<{ value: ProjectMemberRole; label: string }> = [
  { value: 'client_viewer', label: 'Client viewer' },
  { value: 'client_collaborator', label: 'Client collaborator' },
];

export const PENDING_PROJECT_INVITE_STORAGE_KEY = 'pendingProjectInviteToken';
