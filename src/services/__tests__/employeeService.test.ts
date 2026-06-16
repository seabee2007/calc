import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  employeeInviteLoginHref,
  employeeInviteSignupHref,
  resolveEmployeeInviteAppOrigin,
} from '../employeeService';

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
