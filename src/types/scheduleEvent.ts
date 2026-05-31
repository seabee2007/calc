export const SCHEDULE_EVENT_TYPES = [
  'bid_due_date',
  'proposal_due',
  'client_meeting',
  'contract_award',
  'site_visit',
  'preconstruction_meeting',
  'mobilization',
  'crew_work_day',
  'material_delivery',
  'equipment_delivery',
  'inspection',
  'subcontractor_meeting',
  'weather_delay',
  'change_order_deadline',
  'permit_deadline',
  'submittal_due',
  'rfi_due',
  'punch_list',
  'closeout',
  'warranty_follow_up',
  'general_task',
] as const;

export type ScheduleEventType = (typeof SCHEDULE_EVENT_TYPES)[number];

export const SCHEDULE_EVENT_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'delayed',
  'cancelled',
  'needs_attention',
] as const;

export type ScheduleEventStatus = (typeof SCHEDULE_EVENT_STATUSES)[number];

export const SCHEDULE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type SchedulePriority = (typeof SCHEDULE_PRIORITIES)[number];

export const SCHEDULE_WEATHER_RISKS = ['low', 'medium', 'high'] as const;
export type ScheduleWeatherRisk = (typeof SCHEDULE_WEATHER_RISKS)[number];

export const PROJECT_MILESTONE_KEYS = [
  'bid_due',
  'contract_award',
  'notice_to_proceed',
  'mobilization',
  'material_delivery',
  'start_work',
  'inspection',
  'substantial_completion',
  'punch_list',
  'closeout',
  'warranty_end',
] as const;

export type ProjectMilestoneKey = (typeof PROJECT_MILESTONE_KEYS)[number];

/** Legacy DB value maps to warranty_end in UI */
export const LEGACY_MILESTONE_WARRANTY = 'warranty' as const;

export const SCHEDULE_VIEWS = ['calendar', 'timeline', 'list', 'milestone'] as const;
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number];

export const CALENDAR_SUB_VIEWS = ['month', 'week', 'work_week', 'day', 'agenda'] as const;
export type CalendarSubView = (typeof CALENDAR_SUB_VIEWS)[number];

export const TIMELINE_SCALES = ['day', 'week', 'month'] as const;
export type TimelineScale = (typeof TIMELINE_SCALES)[number];

export interface ScheduleEventDocument {
  id: string;
  name: string;
  url: string;
}

export interface ScheduleEventActivityEntry {
  id: string;
  at: string;
  userId: string;
  action: string;
  detail?: string;
}

export interface ScheduleEventComment {
  id: string;
  at: string;
  userId: string;
  body: string;
}

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom',
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_END_TYPES = ['never', 'on_date', 'after_count'] as const;
export type RecurrenceEndType = (typeof RECURRENCE_END_TYPES)[number];

export const RECURRENCE_CUSTOM_UNITS = ['day', 'week', 'month'] as const;
export type RecurrenceCustomUnit = (typeof RECURRENCE_CUSTOM_UNITS)[number];

export const RECURRENCE_EDIT_SCOPES = [
  'this',
  'this_and_future',
  'entire_series',
] as const;
export type RecurrenceEditScope = (typeof RECURRENCE_EDIT_SCOPES)[number];

export type RecurrenceExceptionType = 'deleted' | 'modified';

/** Monday = 0 … Sunday = 6 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[];
  endType: RecurrenceEndType;
  endDate?: string | null;
  occurrenceCount?: number | null;
  customInterval?: number;
  customUnit?: RecurrenceCustomUnit;
}

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export const RECURRENCE_END_TYPE_LABELS: Record<RecurrenceEndType, string> = {
  never: 'Never ends',
  on_date: 'End on date',
  after_count: 'End after occurrences',
};

export const RECURRENCE_EDIT_SCOPE_LABELS: Record<RecurrenceEditScope, string> = {
  this: 'This event',
  this_and_future: 'This and future events',
  entire_series: 'Entire series',
};

export interface ScheduleEvent {
  id: string;
  projectId: string;
  projectName?: string;
  taskId: string | null;
  createdBy: string;
  title: string;
  notes: string | null;
  eventType: ScheduleEventType;
  status: ScheduleEventStatus;
  priority: SchedulePriority;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  trade: string | null;
  crew: string | null;
  location: string | null;
  assignedTo: string[];
  relatedDocuments: ScheduleEventDocument[];
  relatedPhotos: ScheduleEventDocument[];
  activityLog: ScheduleEventActivityEntry[];
  comments: ScheduleEventComment[];
  weatherRisk: ScheduleWeatherRisk | null;
  milestoneKey: ProjectMilestoneKey | string | null;
  syncMetadata: Record<string, unknown> | null;
  recurrenceRule: RecurrenceRule | null;
  recurrenceSeriesId: string | null;
  recurrenceInstanceDate: string | null;
  recurrenceExceptionType: RecurrenceExceptionType | null;
  /** Set when expanded from a series for calendar display */
  isRecurringInstance?: boolean;
  seriesMasterId?: string;
  occurrenceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEventInput {
  projectId: string;
  taskId?: string | null;
  createdBy: string;
  title: string;
  notes?: string | null;
  eventType: ScheduleEventType;
  status?: ScheduleEventStatus;
  priority?: SchedulePriority;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  trade?: string | null;
  crew?: string | null;
  location?: string | null;
  assignedTo?: string[];
  relatedDocuments?: ScheduleEventDocument[];
  relatedPhotos?: ScheduleEventDocument[];
  weatherRisk?: ScheduleWeatherRisk | null;
  milestoneKey?: ProjectMilestoneKey | string | null;
  recurrenceRule?: RecurrenceRule | null;
  syncMetadata?: Record<string, unknown> | null;
}

export interface ScheduleEventSavePayload extends ScheduleEventInput {
  recurrenceEditScope?: RecurrenceEditScope;
  /** ISO date of selected occurrence when editing a recurring instance */
  occurrenceDate?: string;
}

export interface ScheduleFilters {
  projectId: string;
  trade: string;
  crew: string;
  status: string;
  eventType: string;
  priority: string;
  assignedUser: string;
  weatherRisk: string;
  dateFrom: string;
  dateTo: string;
}

export const SCHEDULE_EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  bid_due_date: 'Bid due date',
  proposal_due: 'Proposal due',
  client_meeting: 'Client meeting',
  contract_award: 'Contract award',
  site_visit: 'Site visit',
  preconstruction_meeting: 'Pre-construction meeting',
  mobilization: 'Mobilization',
  crew_work_day: 'Crew work day',
  material_delivery: 'Material delivery',
  equipment_delivery: 'Equipment delivery',
  inspection: 'Inspection',
  subcontractor_meeting: 'Subcontractor meeting',
  weather_delay: 'Weather delay',
  change_order_deadline: 'Change order deadline',
  permit_deadline: 'Permit deadline',
  submittal_due: 'Submittal due',
  rfi_due: 'RFI due',
  punch_list: 'Punch list',
  closeout: 'Closeout',
  warranty_follow_up: 'Warranty follow-up',
  general_task: 'General task',
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleEventStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
  needs_attention: 'Needs attention',
};

export const SCHEDULE_PRIORITY_LABELS: Record<SchedulePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const MILESTONE_LABELS: Record<ProjectMilestoneKey, string> = {
  bid_due: 'Bid due',
  contract_award: 'Contract award',
  notice_to_proceed: 'Notice to proceed',
  mobilization: 'Mobilization',
  material_delivery: 'Material delivery',
  start_work: 'Start work',
  inspection: 'Inspection',
  substantial_completion: 'Substantial completion',
  punch_list: 'Punch list',
  closeout: 'Closeout',
  warranty_end: 'Warranty end',
};

export const MILESTONE_DEFAULT_EVENT_TYPES: Partial<
  Record<ProjectMilestoneKey, ScheduleEventType>
> = {
  bid_due: 'bid_due_date',
  contract_award: 'contract_award',
  mobilization: 'mobilization',
  material_delivery: 'material_delivery',
  inspection: 'inspection',
  punch_list: 'punch_list',
  closeout: 'closeout',
  warranty_end: 'warranty_follow_up',
};

export function normalizeMilestoneKey(
  key: string | null | undefined,
): ProjectMilestoneKey | null {
  if (!key) return null;
  if (key === 'warranty') return 'warranty_end';
  if ((PROJECT_MILESTONE_KEYS as readonly string[]).includes(key)) {
    return key as ProjectMilestoneKey;
  }
  return null;
}
