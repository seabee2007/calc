import { describe, expect, it } from 'vitest';
import { isLegalGateBypassRoute } from './legalGateRoutes';

describe('isLegalGateBypassRoute', () => {
  it('allows public legal document routes without legal acceptance', () => {
    expect(isLegalGateBypassRoute('/terms')).toBe(true);
    expect(isLegalGateBypassRoute('/privacy-policy')).toBe(true);
    expect(isLegalGateBypassRoute('/privacy')).toBe(true);
    expect(isLegalGateBypassRoute('/contact')).toBe(true);
  });

  it('allows public proposal and client routes without legal acceptance', () => {
    expect(isLegalGateBypassRoute('/proposal/abc-token')).toBe(true);
    expect(isLegalGateBypassRoute('/change-order/co-token')).toBe(true);
    expect(isLegalGateBypassRoute('/contract/contract-token')).toBe(true);
    expect(isLegalGateBypassRoute('/client/project/portal-token')).toBe(true);
    expect(isLegalGateBypassRoute('/invite/invite-token')).toBe(true);
  });

  it('allows auth routes without legal acceptance', () => {
    expect(isLegalGateBypassRoute('/login')).toBe(true);
    expect(isLegalGateBypassRoute('/signup')).toBe(true);
    expect(isLegalGateBypassRoute('/auth/callback')).toBe(true);
    expect(isLegalGateBypassRoute('/reset-password')).toBe(true);
  });

  it('does not bypass protected app routes', () => {
    expect(isLegalGateBypassRoute('/')).toBe(false);
    expect(isLegalGateBypassRoute('/projects')).toBe(false);
    expect(isLegalGateBypassRoute('/projects/abc/planner/schedule')).toBe(false);
    expect(isLegalGateBypassRoute('/settings')).toBe(false);
    expect(isLegalGateBypassRoute('/proposals')).toBe(false);
  });
});
