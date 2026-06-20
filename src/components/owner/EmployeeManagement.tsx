import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus, Mail, Users, Clock, FolderKanban, Link2, Trash2, Smartphone, Copy, Check, Loader2, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../contexts/SubscriptionContext';
import UpgradeRequiredCard from '../subscription/UpgradeRequiredCard';
import {
  assignEmployeeToProject,
  createEmployeeInvite,
  employeeInviteSignupHref,
  fetchAssignmentsForProject,
  fetchPendingInvites,
  removeEmployeeFromProject,
  revokeEmployeeInvite,
  sendEmployeeInviteEmail,
} from '../../services/employeeService';
import { fetchTeamProfiles, DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import type { EmployeeInvite, EmployeeProjectAssignment, Profile } from '../../types/fieldPlanner';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import InlineNotice from '../ui/InlineNotice';
import ConfirmModal from '../ui/ConfirmModal';
import { useProjectStore } from '../../store';
import {
  BORDER_DEFAULT,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from '../../theme/appTheme';

const SECTION_CARD =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';

const KPI_CARD =
  'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80';

const FIELD_HELPER = `text-sm leading-relaxed ${TEXT_MUTED}`;

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  foreman: 'Foreman',
  project_manager: 'Project Manager',
};

type AssignmentRow = EmployeeProjectAssignment & {
  projectName: string;
  employeeName: string;
};

function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

function formatSentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function inviteExpired(expiresAt: string): boolean {
  const date = new Date(expiresAt);
  return !expiresAt || Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

function inviteStatusLabel(invite: EmployeeInvite): string {
  if (inviteExpired(invite.expiresAt)) return 'Expired';
  if (invite.emailStatus === 'sent') return 'Sent';
  if (invite.emailStatus === 'failed') return 'Delivery failed';
  return 'Pending';
}

export default function EmployeeManagement() {
  const { user } = useAuth();
  const { hasFeature, canInviteTeamMember } = useSubscription();
  const { projects, loadProjects } = useProjectStore();
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'warning'>('info');
  const [busy, setBusy] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const inviteSendingRef = useRef(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [openInviteActionsId, setOpenInviteActionsId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [invitePendingRevoke, setInvitePendingRevoke] = useState<EmployeeInvite | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const assignedProjectCount = useMemo(
    () => new Set(assignments.map((row) => row.projectId)).size,
    [assignments],
  );

  const memberProjectNames = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of assignments) {
      if (!map[row.employeeId]) map[row.employeeId] = [];
      map[row.employeeId].push(row.projectName);
    }
    return map;
  }, [assignments]);

  const reload = async () => {
    if (!user) return;
    const [inv, members] = await Promise.all([
      fetchPendingInvites(user.id),
      fetchTeamProfiles(user.id),
    ]);
    setInvites(inv);
    setTeam(members);

    const projectList = projects.length > 0 ? projects : [];
    const assignmentRows = (
      await Promise.all(
        projectList.map(async (project) => {
          const rows = await fetchAssignmentsForProject(project.id);
          return rows.map((row) => ({
            ...row,
            projectName: project.name,
            employeeName:
              members.find((member) => member.id === row.employeeId)?.displayName ??
              DEFAULT_PROFILE_DISPLAY_NAME,
          }));
        }),
      )
    ).flat();
    setAssignments(assignmentRows);
  };

  useEffect(() => {
    void reload();
  }, [user, projects.length]);

  const showMessage = (text: string, tone: 'info' | 'success' | 'warning' = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const activePendingInviteCount = invites.filter((invite) => !inviteExpired(invite.expiresAt)).length;
  const seatUsageCount = team.length + activePendingInviteCount;
  const canUseTeamInvites = hasFeature('employee_portal');
  const inviteAllowed = canUseTeamInvites && canInviteTeamMember(seatUsageCount);
  const seatLimitReached = canUseTeamInvites && !canInviteTeamMember(seatUsageCount);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim() || inviteSendingRef.current) return;

    if (!canUseTeamInvites) {
      showMessage('Team member invites require a paid team plan. Upgrade to continue.', 'warning');
      return;
    }

    if (!canInviteTeamMember(seatUsageCount)) {
      showMessage(
        'Field seat limit reached. Starter includes 1 field seat. Remove a pending invite, deactivate a field user, or upgrade for additional field seats.',
        'warning',
      );
      return;
    }

    inviteSendingRef.current = true;
    setInviteSending(true);
    setMessage(null);
    const submittedEmail = email.trim();

    try {
      const result = await createEmployeeInvite(
        user.id,
        submittedEmail,
        role as import('../../types/fieldPlanner').UserRole,
      );
      if (result.emailStatus === 'sent') {
        showMessage(`Invitation sent to ${submittedEmail}.`, 'success');
      } else {
        showMessage(
          'Invite created, but email delivery failed. Resend from Pending Invites.',
          'warning',
        );
      }
      setEmail('');
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to send invite', 'warning');
    } finally {
      inviteSendingRef.current = false;
      setInviteSending(false);
    }
  };

  const handleAssign = async () => {
    if (!user || !assignProjectId || !assignEmployeeId) return;
    setBusy(true);
    try {
      await assignEmployeeToProject(assignEmployeeId, assignProjectId, user.id);
      showMessage('Employee assigned to project', 'success');
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Assignment failed', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    setBusy(true);
    try {
      await removeEmployeeFromProject(assignmentId);
      showMessage('Employee removed from project', 'success');
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Could not remove assignment', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyInviteLinkByToken = async (memberId: string, token: string) => {
    const link = employeeInviteSignupHref(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedMemberId(memberId);
      setTimeout(() => setCopiedMemberId(null), 2000);
      showMessage('Invite link copied as fallback.', 'info');
    } catch {
      showMessage('Could not copy invite link. Try resending the invitation email.', 'warning');
    }
  };

  const handleResendInvite = async (invite: EmployeeInvite) => {
    setResendingInviteId(invite.id);
    setOpenInviteActionsId(null);
    try {
      const result = await sendEmployeeInviteEmail(invite.id);
      if (result.emailStatus === 'sent') {
        showMessage(`Invitation sent to ${invite.email}.`, 'success');
      } else {
        showMessage(
          'Invite created, but email delivery failed. Resend from Pending Invites.',
          'warning',
        );
      }
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Could not resend invite', 'warning');
    } finally {
      setResendingInviteId(null);
    }
  };

  const requestRevokeInvite = (invite: EmployeeInvite) => {
    setOpenInviteActionsId(null);
    setInvitePendingRevoke(invite);
  };

  const handleConfirmRevokeInvite = async () => {
    const invite = invitePendingRevoke;
    if (!invite) return;
    setRevokingInviteId(invite.id);
    setOpenInviteActionsId(null);
    setInvitePendingRevoke(null);
    showMessage(`Revoking invite for ${invite.email}...`, 'info');
    try {
      await revokeEmployeeInvite(invite.id);
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      showMessage(`Invite revoked for ${invite.email}.`, 'success');
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Could not revoke invite', 'warning');
    } finally {
      setRevokingInviteId(null);
    }
  };

  const inviteFormDisabled = !inviteAllowed || inviteSending;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={Boolean(invitePendingRevoke)}
        title="Revoke invitation?"
        message="This immediately disables the invitation link and releases the reserved field seat. The recipient will no longer be able to join using this invitation."
        cancelLabel="Cancel"
        confirmLabel="Revoke invitation"
        confirmVariant="danger"
        showWarningIcon
        onCancel={() => setInvitePendingRevoke(null)}
        onConfirm={() => void handleConfirmRevokeInvite()}
      />

      {inviteSending ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm dark:bg-slate-950/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-sending-title"
          data-testid="invite-sending-overlay"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400" />
            <p id="invite-sending-title" className={`mt-4 text-base font-semibold ${TEXT_FOREGROUND}`}>
              Sending invite...
            </p>
            <p className={`mt-2 text-sm ${TEXT_MUTED}`}>
              Creating employee invite and sending email.
            </p>
          </div>
        </div>
      ) : null}

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Team summary"
        data-testid="team-summary-row"
      >
        <SummaryStat label="Team members" value={String(team.length)} />
        <SummaryStat label="Pending invites" value={String(invites.length)} />
        <SummaryStat label="Assigned projects" value={String(assignedProjectCount)} />
      </section>

      {message ? (
        <div data-testid="team-management-message">
          <InlineNotice
            variant={
              messageTone === 'success'
                ? 'success'
                : messageTone === 'warning'
                  ? 'warning'
                  : 'info'
            }
            title={message}
          />
        </div>
      ) : null}

      <section className={SECTION_CARD} data-testid="invite-team-member-card">
        <SectionHeader
          icon={<UserPlus className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          title="Invite team member"
          description="Send an invite so an employee can access assigned project work."
        />
        {!canUseTeamInvites ? (
          <div className="mt-6">
            <UpgradeRequiredCard
              feature="employee_portal"
              title="Upgrade required"
              description="Team member invites and field access require a paid team plan."
            />
          </div>
        ) : seatLimitReached ? (
          <div className="mt-6">
            <InlineNotice
              variant="warning"
              title="Field seat limit reached"
              description="Starter includes 1 field seat. Remove a pending invite, deactivate a field user, or upgrade for additional field seats."
            />
          </div>
        ) : (
        <form onSubmit={(e) => void handleInvite(e)} className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={inviteFormDisabled}
            data-testid="invite-email-input"
          />
          <Select
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'foreman', label: 'Foreman' },
              { value: 'project_manager', label: 'Project Manager' },
            ]}
            fullWidth
            disabled={inviteFormDisabled}
          />
          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="primary"
              disabled={inviteFormDisabled}
              icon={<Mail className="h-4 w-4" />}
              data-testid="send-invite-button"
            >
              Send invite
            </Button>
          </div>
        </form>
        )}
      </section>

      <section className={SECTION_CARD} data-testid="pending-invites-card">
        <SectionHeader
          icon={<Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          title="Pending invites"
          description="Invites waiting for the employee to accept."
        />
        <div className="mt-6">
          {invites.length === 0 ? (
            <p className={`rounded-xl border border-dashed ${BORDER_DEFAULT} px-4 py-8 text-center text-sm ${TEXT_MUTED}`}>
              No pending invites.
            </p>
          ) : (
            <ul className={`divide-y ${BORDER_DEFAULT}`}>
              {invites.map((inv) => {
                const status = inviteStatusLabel(inv);
                const isCopied = copiedMemberId === `inv-${inv.id}`;
                const isBusy = resendingInviteId === inv.id || revokingInviteId === inv.id;
                return (
                  <li key={inv.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className={`font-medium ${TEXT_FOREGROUND}`}>{inv.email}</p>
                      <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
                        {formatRoleLabel(inv.role)} · Sent {formatSentDate(inv.emailSentAt ?? inv.createdAt)} · Expires {formatSentDate(inv.expiresAt)}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === 'Sent'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : status === 'Delivery failed' || status === 'Expired'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {status}
                      </span>
                      {inv.emailLastError ? (
                        <p className={`mt-2 text-xs ${TEXT_SUBTLE}`}>
                          Last delivery error: {inv.emailLastError}
                        </p>
                      ) : null}
                    </div>
                    <div className="relative flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        icon={<MoreHorizontal className="h-4 w-4" />}
                        onClick={() =>
                          setOpenInviteActionsId((current) => (current === inv.id ? null : inv.id))
                        }
                        aria-expanded={openInviteActionsId === inv.id}
                        data-testid={`invite-actions-${inv.id}`}
                      >
                        Actions
                      </Button>
                      {openInviteActionsId === inv.id ? (
                        <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => void handleResendInvite(inv)}
                            data-testid={`resend-invite-${inv.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Resend invite
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => void handleCopyInviteLinkByToken(`inv-${inv.id}`, inv.token)}
                            data-testid={`copy-invite-link-${inv.id}`}
                          >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {isCopied ? 'Copied!' : 'Copy invite link'}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            onClick={() => requestRevokeInvite(inv)}
                            data-testid={`revoke-invite-${inv.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Revoke invite
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className={SECTION_CARD} data-testid="assign-project-card">
        <SectionHeader
          icon={<Link2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          title="Assign to project"
          description="Assign employees to project plans so work can be managed from Planner Hub and My Tasks."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Select
            label="Employee"
            value={assignEmployeeId}
            onChange={setAssignEmployeeId}
            options={[
              { value: '', label: 'Select employee' },
              ...team.map((member) => ({
                value: member.id,
                label: member.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME,
              })),
            ]}
            fullWidth
          />
          <Select
            label="Project"
            value={assignProjectId}
            onChange={setAssignProjectId}
            options={[
              { value: '', label: 'Select project' },
              ...projects.map((project) => ({ value: project.id, label: project.name })),
            ]}
            fullWidth
          />
          <div className="md:col-span-2">
            <Button
              onClick={() => void handleAssign()}
              disabled={busy || !assignProjectId || !assignEmployeeId}
              variant="primary"
              data-testid="assign-employee-button"
            >
              Assign employee
            </Button>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Current project assignments</h3>
          {assignments.length === 0 ? (
            <p className={`mt-3 text-sm ${TEXT_MUTED}`}>No project assignments yet.</p>
          ) : (
            <ul className={`mt-4 divide-y ${BORDER_DEFAULT}`}>
              {assignments.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className={`font-medium ${TEXT_FOREGROUND}`}>
                      {row.employeeName}{' '}
                      <span className={`font-normal ${TEXT_MUTED}`}>on {row.projectName}</span>
                    </p>
                    <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
                      {formatRoleLabel(row.role)} · Active
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => void handleUnassign(row.id)}
                    data-testid={`unassign-${row.id}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={SECTION_CARD} data-testid="team-members-card">
        <SectionHeader
          icon={<Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          title="Team members"
          description="Employees who have accepted an invite and joined your team."
        />
        <div className="mt-6">
          {team.length === 0 ? (
            <p className={`rounded-xl border border-dashed ${BORDER_DEFAULT} px-4 py-8 text-center text-sm ${TEXT_MUTED}`}>
              No team members yet.
            </p>
          ) : (
            <ul className={`divide-y ${BORDER_DEFAULT}`}>
              {team.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className={`font-medium ${TEXT_FOREGROUND}`}>
                      {member.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME}
                    </p>
                    <p className={`text-sm ${TEXT_MUTED}`}>{formatRoleLabel(member.role)}</p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full border ${BORDER_DEFAULT} bg-slate-50 px-2.5 py-0.5 text-xs font-medium ${TEXT_MUTED} dark:bg-slate-800/80`}
                  >
                    <FolderKanban className="h-3.5 w-3.5" aria-hidden />
                    {
                      assignments.filter((row) => row.employeeId === member.id).length
                    }{' '}
                    project
                    {assignments.filter((row) => row.employeeId === member.id).length === 1
                      ? ''
                      : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={SECTION_CARD} data-testid="field-portal-access-card">
        <SectionHeader
          icon={<Smartphone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          title="Field Portal access"
          description="Each team member below has access to the Field Portal for submitting photos, notes, RFIs, FARs, and task updates from the jobsite."
        />
        <div className="mt-6">
          {team.length === 0 ? (
            <p className={`rounded-xl border border-dashed ${BORDER_DEFAULT} px-4 py-8 text-center text-sm ${TEXT_MUTED}`}>
              Invite team members above to manage Field Portal access.
            </p>
          ) : (
            <ul className={`divide-y ${BORDER_DEFAULT}`}>
              {team.map((member) => {
                const memberProjects = memberProjectNames[member.id] ?? [];
                const isCopied = copiedMemberId === member.id;
                // Match pending invite to member by checking if any pending invite
                // was created around the same time as the profile (best-effort)
                return (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                    data-testid={`field-portal-member-${member.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${TEXT_FOREGROUND}`}>
                        {member.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME}
                      </p>
                      <p className={`mt-0.5 text-sm ${TEXT_MUTED}`}>{formatRoleLabel(member.role)}</p>
                      {memberProjects.length > 0 ? (
                        <p className={`mt-1 text-xs ${TEXT_SUBTLE}`}>
                          Assigned: {memberProjects.join(', ')}
                        </p>
                      ) : (
                        <p className={`mt-1 text-xs ${TEXT_SUBTLE}`}>No projects assigned yet</p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {/* Copy the Field Portal login URL for this employer's portal */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={
                          isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        }
                        onClick={() => {
                          const fieldPortalUrl = `${window.location.origin}/login?path=field`;
                          void navigator.clipboard
                            .writeText(fieldPortalUrl)
                            .then(() => {
                              setCopiedMemberId(member.id);
                              setTimeout(() => setCopiedMemberId(null), 2000);
                            })
                            .catch(() =>
                              showMessage(`Field Portal login: ${fieldPortalUrl}`, 'info'),
                            );
                        }}
                        data-testid={`copy-field-link-${member.id}`}
                      >
                        {isCopied ? 'Copied!' : 'Copy Field Portal Link'}
                      </Button>
                      <p className={`text-right text-xs ${TEXT_SUBTLE}`}>
                        To re-invite, use "Invite team member" above.
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={KPI_CARD}>
      <p className={`text-xs font-medium uppercase tracking-wide ${TEXT_SUBTLE}`}>{label}</p>
      <p className={`mt-1 text-lg font-semibold ${TEXT_FOREGROUND}`}>{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${BORDER_DEFAULT} bg-slate-50 dark:bg-slate-800/80`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
        <p className={FIELD_HELPER}>{description}</p>
      </div>
    </div>
  );
}
