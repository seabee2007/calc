import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import {
  assignEmployeeToProject,
  fetchAssignmentsForProject,
  removeEmployeeFromProject,
} from '../../services/employeeService';
import { fetchTeamProfiles, DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import type { EmployeeProjectAssignment, Profile } from '../../types/fieldPlanner';
import Button from '../../components/ui/Button';
import UserAvatar from '../../components/planner/UserAvatar';
import { PLANNER_MUTED, PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerTeamPage() {
  const { user } = useAuth();
  const { projectId, team, isOwner, reload } = usePlannerProject();
  const [assignments, setAssignments] = useState<EmployeeProjectAssignment[]>([]);
  const [available, setAvailable] = useState<Profile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const loadAssignments = async () => {
    const rows = await fetchAssignmentsForProject(projectId);
    setAssignments(rows);
  };

  useEffect(() => {
    void loadAssignments();
  }, [projectId]);

  useEffect(() => {
    if (!user || !isOwner) return;
    void fetchTeamProfiles(user.id).then((members) => {
      const assigned = new Set(assignments.map((a) => a.employeeId));
      setAvailable(members.filter((m) => !assigned.has(m.id)));
    });
  }, [user, isOwner, assignments]);

  const profileFor = (employeeId: string) => team.find((p) => p.id === employeeId);

  const handleAssign = async () => {
    if (!user || !selectedEmployee) return;
    await assignEmployeeToProject(selectedEmployee, projectId, user.id);
    setSelectedEmployee('');
    await loadAssignments();
    void reload();
  };

  const handleRemove = async (assignmentId: string) => {
    await removeEmployeeFromProject(assignmentId);
    await loadAssignments();
    void reload();
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <h2 className={`mb-4 ${PLANNER_SECTION_TITLE}`}>Team</h2>

      {isOwner && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-slate-300">
              Assign employee
            </span>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select team member…</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName ?? m.id}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={() => void handleAssign()} disabled={!selectedEmployee}>
            Assign
          </Button>
        </div>
      )}

      {assignments.length === 0 && <p className={PLANNER_MUTED}>No employees assigned to this project.</p>}

      <ul className="space-y-2">
        {assignments.map((a) => {
          const profile = profileFor(a.employeeId);
          const name = profile?.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <UserAvatar name={name} size="md" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                  <p className="text-xs capitalize text-gray-500 dark:text-slate-400">{a.role}</p>
                </div>
              </div>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => void handleRemove(a.id)}>
                  Remove
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
