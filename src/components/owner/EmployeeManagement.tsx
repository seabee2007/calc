import React, { useEffect, useState } from 'react';
import { UserPlus, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  assignEmployeeToProject,
  createEmployeeInvite,
  employeeInviteLoginHref,
  employeeInviteSignupHref,
  fetchAssignmentsForProject,
  fetchPendingInvites,
  sendEmployeeInviteEmail,
} from '../../services/employeeService';
import { fetchTeamProfiles, DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import type { EmployeeInvite, Profile } from '../../types/fieldPlanner';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useProjectStore } from '../../store';

export default function EmployeeManagement() {
  const { user } = useAuth();
  const { projects } = useProjectStore();
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!user) return;
    const [inv, members] = await Promise.all([
      fetchPendingInvites(user.id),
      fetchTeamProfiles(user.id),
    ]);
    setInvites(inv);
    setTeam(members);
  };

  useEffect(() => {
    void reload();
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const invite = await createEmployeeInvite(user.id, email, role as import('../../types/fieldPlanner').UserRole);
      const signupLink = employeeInviteSignupHref(invite.token);
      try {
        const result = await sendEmployeeInviteEmail(invite.id, {
          siteUrl: window.location.origin,
        });
        const link = result.inviteLink || signupLink;
        if (result.existingUser) {
          setMessage(
            `Account already exists for ${email}. Share this login link: ${result.inviteLink || employeeInviteLoginHref(invite.token)}`,
          );
        } else {
          setMessage(`Invite email sent to ${email}. Backup link: ${link}`);
        }
      } catch (err) {
        setMessage(
          `Invite created. Share this signup link: ${signupLink}${
            err instanceof Error ? ` (${err.message})` : ''
          }`,
        );
      }
      setEmail('');
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!user || !assignProjectId || !assignEmployeeId) return;
    setBusy(true);
    try {
      await assignEmployeeToProject(assignEmployeeId, assignProjectId, user.id);
      setMessage('Employee assigned to project');
      await fetchAssignmentsForProject(assignProjectId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6 bg-white/95 dark:bg-slate-800/95">
        <h2 className="text-lg font-semibold mb-4 flex dark:text-white items-center gap-2">
          <UserPlus className="h-5 w-5 text-cyan-600" />
          Invite team member
        </h2>
        <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
          />
          <Button type="submit" disabled={busy} icon={<Mail className="h-4 w-4" />}>
            Send invite
          </Button>
        </form>
        {message && <p className="mt-3 text-sm text-cyan-700 dark:text-cyan-300">{message}</p>}
      </Card>

      <Card className="p-6 bg-white/95 dark:bg-slate-800/95 dark:text-white">
        <h2 className="text-lg font-semibold mb-4">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invites.</p>
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="text-sm text-slate-600 dark:text-slate-300">
                <span>
                  {inv.email} · {inv.role}
                </span>
                <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  {employeeInviteSignupHref(inv.token)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 bg-white/95 dark:bg-slate-800/95 dark:text-white">
        <h2 className="text-lg font-semibold mb-4">Assign to project</h2>
        <div className="space-y-4">
          <Select
            label="Employee"
            value={assignEmployeeId}
            onChange={setAssignEmployeeId}
            options={[
              { value: '', label: 'Select employee' },
              ...team.map((m) => ({
                value: m.id,
                label: m.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME,
              })),
            ]}
          />
          <Select
            label="Project"
            value={assignProjectId}
            onChange={setAssignProjectId}
            options={[
              { value: '', label: 'Select project' },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Button onClick={() => void handleAssign()} disabled={busy}>
            Assign
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-white/95 dark:bg-slate-800/95 dark:text-white">
        <h2 className="text-lg font-semibold mb-4">Team</h2>
        {team.length === 0 ? (
          <p className="text-sm text-slate-500">No team members yet.</p>
        ) : (
          <ul className="space-y-2">
            {team.map((m) => (
              <li key={m.id} className="text-sm">
                {m.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME} · {m.role}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
