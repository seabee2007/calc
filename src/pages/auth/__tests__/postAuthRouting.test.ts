import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  FIELD_PORTAL_NO_ASSIGNMENT_MESSAGE,
  FIELD_PORTAL_OWNER_ACCOUNT_MESSAGE,
  resolveFieldPortalLoginError,
} from '../postAuthRouting';
import { syncEmployeeProfileFromInvites } from '../../../services/employeeService';

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '../../../lib/supabase';

describe('syncEmployeeProfileFromInvites', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it('returns membership_removed when sync RPC reports a prior workspace removal', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ok: false, reason: 'membership_removed' },
      error: null,
    } as never);

    const result = await syncEmployeeProfileFromInvites();
    expect(result).toEqual({ ok: false, reason: 'membership_removed' });
  });

  it('returns rpc_unavailable when function is missing from schema cache', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.sync_employee_profile_from_invites without parameters in the schema cache',
      },
    } as never);

    const result = await syncEmployeeProfileFromInvites();
    expect(result).toEqual({ ok: false, reason: 'rpc_unavailable' });
  });
});

describe('resolveFieldPortalLoginError', () => {
  it('returns null for employee profiles', () => {
    expect(
      resolveFieldPortalLoginError(
        {
          id: 'u1',
          role: 'employee',
          employerId: 'e1',
          displayName: 'Pat',
          phone: null,
          createdAt: '',
          updatedAt: '',
        },
        'field',
      ),
    ).toBeNull();
  });

  it('returns owner message when admin selects field portal', () => {
    expect(
      resolveFieldPortalLoginError(
        {
          id: 'u1',
          role: 'owner',
          employerId: null,
          displayName: 'Owner',
          phone: null,
          createdAt: '',
          updatedAt: '',
        },
        'field',
      ),
    ).toBe(FIELD_PORTAL_OWNER_ACCOUNT_MESSAGE);
  });

  it('returns no assignment message when profile is missing', () => {
    expect(resolveFieldPortalLoginError(null, 'field')).toBe(
      FIELD_PORTAL_NO_ASSIGNMENT_MESSAGE,
    );
  });
});
