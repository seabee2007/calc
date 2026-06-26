import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/fieldPlanner';
import { getNotificationPreferences } from './notificationPreferenceService';
import { getUserPreferences } from './userPreferencesService';

export type EmployeeCompanyContext = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
};

export type EmployeeEmployerContact = {
  displayName: string | null;
  phone: string | null;
  email: string | null;
};

export type EmployeeMembershipContext = {
  role: UserRole;
  status: 'active' | 'removed';
};

export type EmployeeAssignmentsContext = {
  projectCount: number;
  taskCount: number;
  projectNames: string[];
};

export type EmployeeFieldContext = {
  profile: Pick<
    Profile,
    | 'id'
    | 'role'
    | 'employerId'
    | 'displayName'
    | 'firstName'
    | 'lastName'
    | 'phone'
    | 'jobTitle'
    | 'onboardingCompletedAt'
  >;
  company: EmployeeCompanyContext;
  employerContact: EmployeeEmployerContact | null;
  membership: EmployeeMembershipContext;
  assignments: EmployeeAssignmentsContext;
  preferences: {
    notificationPreferences: Awaited<ReturnType<typeof getNotificationPreferences>>;
    userPreferences: Awaited<ReturnType<typeof getUserPreferences>>;
  } | null;
};

function mapRpcProfile(row: Record<string, unknown>): EmployeeFieldContext['profile'] {
  return {
    id: row.id as string,
    role: row.role as UserRole,
    employerId: (row.employerId as string) ?? null,
    displayName: (row.displayName as string) ?? null,
    firstName: (row.firstName as string) ?? null,
    lastName: (row.lastName as string) ?? null,
    phone: (row.phone as string) ?? null,
    jobTitle: (row.jobTitle as string) ?? null,
    onboardingCompletedAt: (row.onboardingCompletedAt as string) ?? null,
  };
}

export function mapEmployeeFieldContextRpc(data: Record<string, unknown>): EmployeeFieldContext {
  const company = data.company as Record<string, unknown>;
  const employerContactRaw = data.employerContact as Record<string, unknown> | null;
  const membership = data.membership as Record<string, unknown>;
  const assignments = data.assignments as Record<string, unknown>;

  const employerContact =
    employerContactRaw &&
    (employerContactRaw.displayName || employerContactRaw.phone || employerContactRaw.email)
      ? {
          displayName: (employerContactRaw.displayName as string) ?? null,
          phone: (employerContactRaw.phone as string) ?? null,
          email: (employerContactRaw.email as string) ?? null,
        }
      : null;

  return {
    profile: mapRpcProfile(data.profile as Record<string, unknown>),
    company: {
      companyName: (company.companyName as string) ?? '',
      address: (company.address as string) ?? '',
      phone: (company.phone as string) ?? '',
      email: (company.email as string) ?? '',
      logoUrl: (company.logoUrl as string | null) ?? null,
    },
    employerContact,
    membership: {
      role: membership.role as UserRole,
      status: membership.status === 'removed' ? 'removed' : 'active',
    },
    assignments: {
      projectCount: Number(assignments.projectCount ?? 0),
      taskCount: Number(assignments.taskCount ?? 0),
      projectNames: Array.isArray(assignments.projectNames)
        ? (assignments.projectNames as string[])
        : [],
    },
    preferences: null,
  };
}

export async function getEmployeeFieldContext(): Promise<EmployeeFieldContext | null> {
  const { data, error } = await supabase.rpc('get_employee_field_context');
  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('get_employee_field_context')) {
      return null;
    }
    throw error;
  }
  if (!data || typeof data !== 'object') return null;

  const context = mapEmployeeFieldContextRpc(data as Record<string, unknown>);

  try {
    const [notificationPreferences, userPreferences] = await Promise.all([
      getNotificationPreferences(),
      getUserPreferences(),
    ]);
    context.preferences = { notificationPreferences, userPreferences };
  } catch {
    context.preferences = null;
  }

  return context;
}

export function roleLabelForFieldPortal(role: UserRole): string {
  switch (role) {
    case 'employee':
      return 'Employee';
    case 'foreman':
      return 'Foreman';
    case 'project_manager':
      return 'Project Manager';
    case 'admin':
      return 'Admin';
    default:
      return role;
  }
}
