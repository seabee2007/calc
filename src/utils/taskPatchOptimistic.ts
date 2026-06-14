import type { PlannerTask } from '../types/fieldPlanner';
import type { TaskAssigneeOption } from './taskAssigneeOptions';
import {
  formatAssigneeNames,
  normalizeAssigneeIds,
  resolveSelectedAssignees,
} from './taskAssigneeOptions';

type TaskPatch = Partial<{
  title: string;
  description: string | null;
  bucketId: string;
  assignedTo: string | null;
  assignedToIds: string[];
  status: PlannerTask['status'];
  priority: PlannerTask['priority'];
  startDate: string | null;
  dueDate: string | null;
}>;

export function applyTaskPatchOptimistic(
  task: PlannerTask,
  patch: TaskPatch,
  assigneeOptions: readonly TaskAssigneeOption[],
): PlannerTask {
  const next: PlannerTask = {
    ...task,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.bucketId !== undefined ? { bucketId: patch.bucketId } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
  };

  if (patch.assignedToIds !== undefined) {
    const assignedToIds = normalizeAssigneeIds(patch.assignedToIds);
    const selected = resolveSelectedAssignees(assignedToIds, assigneeOptions);
    const assigneeNames = selected.map((option) => option.label);
    next.assignedToIds = assignedToIds;
    next.assignedTo = assignedToIds[0] ?? null;
    next.assigneeNames = assigneeNames;
    next.assigneeName = formatAssigneeNames(assigneeNames);
  } else if (patch.assignedTo !== undefined) {
    const assignedToIds = patch.assignedTo ? [patch.assignedTo] : [];
    const selected = resolveSelectedAssignees(assignedToIds, assigneeOptions);
    const assigneeNames = selected.map((option) => option.label);
    next.assignedTo = patch.assignedTo;
    next.assignedToIds = assignedToIds;
    next.assigneeNames = assigneeNames;
    next.assigneeName = formatAssigneeNames(assigneeNames);
  }

  return next;
}
