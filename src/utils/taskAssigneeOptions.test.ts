import { describe, expect, it } from 'vitest';
import {
  buildTaskAssigneeOptions,
  buildTaskAssigneeMultiSelectOptions,
  formatCurrentUserAssigneeLabel,
  getAssigneeInitials,
  isUserAssignedToTask,
  normalizeAssigneeIds,
  resolveSelectedAssignees,
} from './taskAssigneeOptions';
import type { Profile } from '../types/fieldPlanner';

const ownerProfile: Profile = {
  id: 'owner-1',
  role: 'owner',
  employerId: null,
  displayName: 'Andrew Terrell',
  phone: null,
  createdAt: '',
  updatedAt: '',
};

const fieldUser: Profile = {
  id: 'field-1',
  role: 'employee',
  employerId: 'owner-1',
  displayName: 'test',
  phone: null,
  createdAt: '',
  updatedAt: '',
};

describe('taskAssigneeOptions', () => {
  it('includes current user even when not in team list', () => {
    const options = buildTaskAssigneeOptions([fieldUser], { id: 'owner-1', email: 'a@example.com' }, ownerProfile);

    expect(options.map((o) => o.label)).toEqual([
      'Unassigned',
      'Andrew Terrell (me)',
      'test',
    ]);
    expect(options.find((o) => o.source === 'current_user')?.id).toBe('owner-1');
  });

  it('dedupes current user when already present in team', () => {
    const options = buildTaskAssigneeOptions(
      [ownerProfile, fieldUser],
      { id: 'owner-1', email: 'a@example.com' },
      ownerProfile,
    );

    expect(options.filter((o) => o.id === 'owner-1')).toHaveLength(1);
    expect(options.find((o) => o.id === 'owner-1')?.label).toBe('Andrew Terrell (me)');
  });

  it('formats label from email when profile name is missing', () => {
    expect(
      formatCurrentUserAssigneeLabel(null, { email: 'owner@ardenprojectos.com' }),
    ).toBe('owner@ardenprojectos.com (me)');
  });

  it('falls back to Me when no profile name or email', () => {
    expect(formatCurrentUserAssigneeLabel(null, null)).toBe('Me');
  });

  it('excludes unassigned from multi-select options', () => {
    const options = buildTaskAssigneeMultiSelectOptions(
      [fieldUser],
      { id: 'owner-1', email: 'a@example.com' },
      ownerProfile,
    );
    expect(options.some((o) => o.source === 'unassigned')).toBe(false);
    expect(options).toHaveLength(2);
  });

  it('detects multi-assignee membership', () => {
    expect(
      isUserAssignedToTask({ assignedToIds: ['a', 'b'], assignedTo: 'a' }, 'b'),
    ).toBe(true);
    expect(isUserAssignedToTask({ assignedToIds: [], assignedTo: 'a' }, 'a')).toBe(true);
    expect(isUserAssignedToTask({ assignedToIds: ['a'], assignedTo: 'a' }, 'c')).toBe(false);
  });

  it('normalizes duplicate assignee ids', () => {
    expect(normalizeAssigneeIds(['a', 'a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('builds initials from assignee labels', () => {
    expect(getAssigneeInitials('Andrew Terrell (me)')).toBe('AT');
    expect(getAssigneeInitials('test')).toBe('TE');
  });

  it('resolves selected assignees from ids', () => {
    const options = buildTaskAssigneeMultiSelectOptions(
      [fieldUser],
      { id: 'owner-1', email: 'a@example.com' },
      ownerProfile,
    );
    const selected = resolveSelectedAssignees(['owner-1', 'field-1'], options);
    expect(selected).toHaveLength(2);
    expect(selected[0]?.label).toBe('Andrew Terrell (me)');
  });
});

describe('planner task assignment field alignment', () => {
  it('uses profile user id as assignee id (matches assigned_to / fetchTasksForEmployee)', () => {
    const options = buildTaskAssigneeOptions([], { id: 'owner-1' }, ownerProfile);
    const me = options.find((o) => o.source === 'current_user');
    expect(me?.id).toBe(ownerProfile.id);
  });
});
