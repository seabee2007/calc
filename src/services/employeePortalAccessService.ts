import type { PlanId } from '../lib/entitlements';
import { supabase } from '../lib/supabase';

export type EmployeePortalAccessReason =
  | 'allowed'
  | 'no_accepted_membership'
  | 'workspace_not_found'
  | 'seat_not_assigned'
  | 'seat_limit_reached'
  | 'employer_subscription_not_found'
  | 'field_portal_not_in_employer_plan'
  | 'invite_acceptance_incomplete'
  | 'access_resolution_failed'
  | 'owner_or_admin';

export type EmployeePortalAccessResult = {
  allowed: boolean;
  reason: EmployeePortalAccessReason;
  workspaceId: string | null;
  employerPlanId: PlanId | null;
  employeeMembershipId: string | null;
  seatAssigned: boolean;
  repaired: boolean;
};

const VALID_REASONS = new Set<EmployeePortalAccessReason>([
  'allowed',
  'no_accepted_membership',
  'workspace_not_found',
  'seat_not_assigned',
  'seat_limit_reached',
  'employer_subscription_not_found',
  'field_portal_not_in_employer_plan',
  'invite_acceptance_incomplete',
]);

function mapRpcResult(row: Record<string, unknown>): EmployeePortalAccessResult {
  const reasonRaw = typeof row.reason === 'string' ? row.reason : 'access_resolution_failed';
  const reason = VALID_REASONS.has(reasonRaw as EmployeePortalAccessReason)
    ? (reasonRaw as EmployeePortalAccessReason)
    : 'access_resolution_failed';

  const employerPlanRaw =
    typeof row.employerPlanId === 'string' ? row.employerPlanId : null;

  return {
    allowed: row.allowed === true,
    reason,
    workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : null,
    employerPlanId: employerPlanRaw as PlanId | null,
    employeeMembershipId:
      typeof row.employeeMembershipId === 'string' ? row.employeeMembershipId : null,
    seatAssigned: row.seatAssigned === true,
    repaired: row.repaired === true,
  };
}

export async function fetchEmployeePortalAccess(
  attemptRepair = true,
): Promise<EmployeePortalAccessResult | null> {
  const { data, error } = await supabase.rpc('get_employee_portal_access', {
    p_attempt_repair: attemptRepair,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message ?? '';
    const rpcUnavailable =
      code === 'PGRST202' ||
      code === '42883' ||
      /get_employee_portal_access/i.test(message);
    if (rpcUnavailable) {
      return null;
    }
    throw error;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const mapped = mapRpcResult(data as Record<string, unknown>);

  if (import.meta.env.DEV && mapped.repaired) {
    console.info('[employee-membership-repair]', mapped);
  }

  return mapped;
}

export function logEmployeePortalAccessDiagnostics(params: {
  authUserId: string;
  authEmail?: string | null;
  acceptedMembershipId: string | null;
  workspaceId: string | null;
  employerPlanId: PlanId | null;
  seatAssigned: boolean;
  allowed: boolean;
  reason: EmployeePortalAccessReason;
}): void {
  if (!import.meta.env.DEV) return;
  console.table({
    authUserId: params.authUserId,
    authEmail: params.authEmail ?? '—',
    acceptedMembershipId: params.acceptedMembershipId ?? '—',
    workspaceId: params.workspaceId ?? '—',
    employerPlanId: params.employerPlanId ?? '—',
    seatAssigned: params.seatAssigned,
    allowed: params.allowed,
    reason: params.reason,
  });
}
