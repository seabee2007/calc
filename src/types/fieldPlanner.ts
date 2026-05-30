export type UserRole =
  | 'owner'
  | 'admin'
  | 'project_manager'
  | 'foreman'
  | 'employee'
  | 'client';

export type TaskStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Submitted'
  | 'Needs Revision'
  | 'Approved'
  | 'Completed';

export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export const TASK_STATUSES: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Submitted',
  'Needs Revision',
  'Approved',
  'Completed',
];

export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Normal', 'High', 'Urgent'];

export const DEFAULT_BUCKET_TITLES = [
  'Estimating',
  'Pre-Pour',
  'Pour Day',
  'QC / Inspection',
  'Closeout',
] as const;

export interface Profile {
  id: string;
  role: UserRole;
  employerId: string | null;
  displayName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeInvite {
  id: string;
  employerId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface EmployeeProjectAssignment {
  id: string;
  employeeId: string;
  projectId: string;
  role: string;
  assignedBy: string | null;
  createdAt: string;
}

export interface PlannerBoard {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerBucket {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerTask {
  id: string;
  boardId: string;
  bucketId: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  submittedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  linkedCalculationId: string | null;
  linkedQcRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  attachmentCount?: number;
  checklistTotal?: number;
  checklistDone?: number;
  assigneeName?: string | null;
  previewImageUrl?: string | null;
  checklistPreview?: { title: string; isCompleted: boolean }[];
  rfiCount?: number;
  adjustmentCount?: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  comment: string;
  isOwnerVisible: boolean;
  createdAt: string;
  authorName?: string | null;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  attachmentType: string;
  createdAt: string;
}

export interface FieldMessage {
  id: string;
  projectId: string;
  taskId: string | null;
  senderId: string;
  recipientId: string | null;
  message: string;
  urgency: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string | null;
  projectName?: string | null;
}

export interface RfiRequest {
  id: string;
  projectId: string;
  taskId: string | null;
  submittedBy: string;
  title: string;
  question: string;
  suggestedSolution: string | null;
  urgency: string;
  status: string;
  ownerResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldAdjustmentRequest {
  id: string;
  projectId: string;
  taskId: string | null;
  submittedBy: string;
  title: string;
  description: string;
  reason: string | null;
  laborImpact: number | null;
  materialImpact: number | null;
  scheduleImpact: string | null;
  estimatedCost: number | null;
  status: string;
  ownerResponse: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FieldActivityType =
  | 'comment'
  | 'task_created'
  | 'task_submitted'
  | 'task_approved'
  | 'task_completed'
  | 'attachment'
  | 'message'
  | 'rfi'
  | 'field_adjustment'
  | 'owner_response';

export interface FieldActivityItem {
  id: string;
  type: FieldActivityType;
  projectId: string;
  projectName: string;
  employeeName: string;
  summary: string;
  timestamp: string;
  status: string;
  href: string;
}

export interface FieldNotification {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PlannerBoardBundle {
  board: PlannerBoard;
  buckets: PlannerBucket[];
  tasks: PlannerTask[];
}

export const OWNER_ROLES: UserRole[] = ['owner', 'admin'];
export const EMPLOYEE_ROLES: UserRole[] = ['employee', 'foreman', 'project_manager'];
export const FIELD_ROLES: UserRole[] = [...EMPLOYEE_ROLES];

export function isOwnerRole(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function isEmployeeRole(role: UserRole | undefined): boolean {
  return role !== undefined && FIELD_ROLES.includes(role);
}
