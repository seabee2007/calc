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

export const DEFAULT_BUCKET_TITLES = ['Estimates', 'Planning'] as const;

export interface Profile {
  id: string;
  role: UserRole;
  employerId: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  businessAddressStreet: string | null;
  businessAddressStreet2: string | null;
  businessAddressCity: string | null;
  businessAddressState: string | null;
  businessAddressPostalCode: string | null;
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
  onboardingCompletedAt: string | null;
  onboardingVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeInvite {
  id: string;
  employerId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  emailStatus: 'pending' | 'sent' | 'failed';
  emailSentAt: string | null;
  emailLastError: string | null;
  emailSendCount: number;
  emailLastAttemptAt: string | null;
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
  /** All assignee user ids (includes assignedTo when set). */
  assignedToIds: string[];
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
  assigneeNames?: string[];
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

export type RfiPriority = TaskPriority;

export const RFI_PRIORITIES: RfiPriority[] = ['Low', 'Normal', 'High', 'Urgent'];

export const RFI_STATUSES = [
  'Open',
  'Pending Response',
  'Answered',
  'Closed',
  'Rejected',
  'Need More Information',
] as const;

export type RfiStatus = (typeof RFI_STATUSES)[number];

export const RFI_RESPONSE_STATUSES: RfiStatus[] = [
  'Answered',
  'Closed',
  'Need More Information',
  'Rejected',
];

export const FAR_REASONS = [
  'Existing Conditions',
  'Utility Conflict',
  'Safety Concern',
  'Constructability Issue',
  'Material Availability',
  'Owner Request',
  'Other',
] as const;

export type FarReason = (typeof FAR_REASONS)[number];

export const FAR_SCHEDULE_IMPACTS = [
  'None',
  'Less Than 1 Day',
  '1-3 Days',
  'More Than 3 Days',
] as const;

export type FarScheduleImpact = (typeof FAR_SCHEDULE_IMPACTS)[number];

export const FAR_STATUSES = [
  'Pending',
  'Needs More Information',
  'Approved',
  'Rejected',
  'Convert to Change Order',
] as const;

export type FarStatus = (typeof FAR_STATUSES)[number];

export const FAR_REVIEW_STATUSES: FarStatus[] = [
  'Approved',
  'Rejected',
  'Needs More Information',
];

export interface RfiRequest {
  id: string;
  projectId: string;
  taskId: string | null;
  submittedBy: string;
  displayNumber: string | null;
  title: string;
  question: string;
  suggestedSolution: string | null;
  location: string | null;
  drawingReference: string | null;
  specReference: string | null;
  urgency: string;
  impactSchedule: boolean;
  impactCost: boolean;
  impactQuality: boolean;
  impactSafety: boolean;
  status: string;
  ownerResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submitterName?: string | null;
}

export interface FieldAdjustmentRequest {
  id: string;
  projectId: string;
  taskId: string | null;
  submittedBy: string;
  displayNumber: string | null;
  title: string;
  description: string;
  location: string | null;
  conditionDescription: string | null;
  proposedAdjustment: string | null;
  reason: string | null;
  laborImpact: number | null;
  materialImpact: number | null;
  equipmentCost: number | null;
  scheduleImpact: string | null;
  estimatedCost: number | null;
  potentialCostImpact: boolean;
  potentialScheduleImpact: boolean;
  recommendedAction: string | null;
  requiresChangeOrder: boolean;
  impactSafety: boolean;
  impactQuality: boolean;
  changeOrderId: string | null;
  convertedToChangeOrder: boolean;
  status: string;
  ownerResponse: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submitterName?: string | null;
}

export interface FieldRecordAttachment {
  id: string;
  projectId: string;
  taskId: string | null;
  rfiId: string | null;
  adjustmentId: string | null;
  uploadedBy: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  attachmentType: string;
  createdAt: string;
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

/** Field-only roles that should not see owner/admin profile menu items. */
export function isFieldOnlyRole(role: UserRole | undefined): boolean {
  return role === 'employee' || role === 'foreman';
}
