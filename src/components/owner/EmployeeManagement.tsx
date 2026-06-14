import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Mail, Users, Clock, FolderKanban, Link2, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  assignEmployeeToProject,
  createEmployeeInvite,
  employeeInviteLoginHref,
  employeeInviteSignupHref,
  fetchAssignmentsForProject,
  fetchPendingInvites,
  removeEmployeeFromProject,
  sendEmployeeInviteEmail,
} from '../../services/employeeService';
import { fetchTeamProfiles, DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import type { EmployeeInvite, EmployeeProjectAssignment, Profile } from '../../types/fieldPlanner';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import InlineNotice from '../ui/InlineNotice';
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

export default function EmployeeManagement() {
  const { user } = useAuth();
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

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const assignedProjectCount = useMemo(
    () => new Set(assignments.map((row) => row.projectId)).size,
    [assignments],
  );

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const invite = await createEmployeeInvite(
        user.id,
        email,
        role as import('../../types/fieldPlanner').UserRole,
      );
      const signupLink = employeeInviteSignupHref(invite.token);
      try {
        const result = await sendEmployeeInviteEmail(invite.id, {
          siteUrl: window.location.origin,
        });
        const link = result.inviteLink || signupLink;
        if (result.existingUser) {
          showMessage(
            `Account already exists for ${email}. Share this login link: ${result.inviteLink || employeeInviteLoginHref(invite.token)}`,
            'warning',
          );
        } else {
          showMessage(`Invite email sent to ${email}. Backup link: ${link}`, 'success');
        }
      } catch (err) {
        showMessage(
          `Invite created. Share this signup link: ${signupLink}${
            err instanceof Error ? ` (${err.message})` : ''
          }`,
          'warning',
        );
      }
      setEmail('');
      await reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to send invite', 'warning');
    } finally {
      setBusy(false);
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

  return (
    <div className="space-y-6">
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
        <form onSubmit={(e) => void handleInvite(e)} className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
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
          />
          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              icon={<Mail className="h-4 w-4" />}
              data-testid="send-invite-button"
            >
              Send invite
            </Button>
          </div>
        </form>
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
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className={`font-medium ${TEXT_FOREGROUND}`}>{inv.email}</p>
                    <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
                      {formatRoleLabel(inv.role)} · Sent {formatSentDate(inv.createdAt)} · Pending
                    </p>
                    <p className={`mt-2 break-all text-xs ${TEXT_SUBTLE}`}>
                      {employeeInviteSignupHref(inv.token)}
                    </p>
                  </div>
                </li>
              ))}
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
