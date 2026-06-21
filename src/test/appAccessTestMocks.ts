import { vi } from 'vitest';
import type { ResolvedAppAccess } from '../services/appAccessService';
import type { AccessResolutionState } from '../services/appAccessService';

export function createResolvedOwnerAccess(
  overrides: Partial<ResolvedAppAccess> = {},
): ResolvedAppAccess {
  return {
    userId: 'owner-1',
    isOwner: true,
    isWorkspaceAdmin: false,
    acceptedEmployeeMemberships: [],
    defaultRoute: '/dashboard',
    ...overrides,
  };
}

export function createAppAccessMock(
  access: ResolvedAppAccess | null = null,
  accessResolutionState: AccessResolutionState = 'resolved',
) {
  return {
    authSessionResolved: true,
    accessResolutionState,
    access,
    refreshAccess: vi.fn(),
    clearAccess: vi.fn(),
  };
}

export const signedOutAppAccessMock = createAppAccessMock(null);
export const ownerAppAccessMock = createAppAccessMock(createResolvedOwnerAccess());
