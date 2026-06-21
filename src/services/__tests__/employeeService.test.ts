import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  employeeInviteLoginHref,
  employeeInviteSignupHref,
  removeEmployeeFromWorkspace,
  resolveEmployeeInviteAppOrigin,
} from '../employeeService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('employee invite URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses configured app URL for signup links by default', () => {
    expect(employeeInviteSignupHref('token-abc')).toContain('/signup?invite=token-abc');
    expect(employeeInviteSignupHref('token-abc')).not.toContain('window.location');
  });

  it('honors an explicit localhost origin override for local dev', () => {
    expect(employeeInviteSignupHref('token-abc', 'http://localhost:5173')).toBe(
      'http://localhost:5173/signup?invite=token-abc',
    );
  });

  it('does not fall back to window.location for invite links', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' },
    });

    expect(employeeInviteSignupHref('token-abc')).not.toBe(
      'http://localhost:5173/signup?invite=token-abc',
    );
  });

  it('builds login invite links from the same app origin', () => {
    expect(employeeInviteLoginHref('token-abc')).toContain('/login?invite=token-abc');
  });

  it('honors an explicit origin override', () => {
    expect(resolveEmployeeInviteAppOrigin('https://custom.example.com/')).toBe(
      'https://custom.example.com',
    );
  });
});

describe('removeEmployeeFromWorkspace', () => {
  it('calls the secure RPC and maps the response', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        ok: true,
        employeeId: 'employee-1',
        workspaceId: 'owner-1',
        assignmentsRemoved: 2,
        invitesRevoked: 1,
        teamMemberCount: 0,
        pendingInviteCount: 0,
        seatReleased: true,
      },
      error: null,
    });

    const result = await removeEmployeeFromWorkspace('employee-1');

    expect(supabase.rpc).toHaveBeenCalledWith('remove_employee_from_workspace', {
      p_employee_id: 'employee-1',
    });
    expect(result.assignmentsRemoved).toBe(2);
    expect(result.invitesRevoked).toBe(1);
    expect(result.seatReleased).toBe(true);
  });

  it('does not delete auth users', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        ok: true,
        employeeId: 'employee-1',
        workspaceId: 'owner-1',
        assignmentsRemoved: 0,
        teamMemberCount: 0,
        pendingInviteCount: 0,
        seatReleased: true,
      },
      error: null,
    });

    await removeEmployeeFromWorkspace('employee-1');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'remove_employee_from_workspace',
      expect.objectContaining({ p_employee_id: 'employee-1' }),
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      expect.stringMatching(/delete.*auth/i),
      expect.anything(),
    );
  });
});
