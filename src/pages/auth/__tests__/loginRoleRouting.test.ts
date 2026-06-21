import { describe, expect, it } from 'vitest';
import { resolvePostLoginDest } from '../Login';

describe('resolvePostLoginDest', () => {
  it('routes employee to Field Portal', () => {
    expect(resolvePostLoginDest('employee')).toBe('/employee/dashboard');
  });

  it('routes foreman to Field Portal', () => {
    expect(resolvePostLoginDest('foreman')).toBe('/employee/dashboard');
  });

  it('routes project_manager to Field Portal', () => {
    expect(resolvePostLoginDest('project_manager')).toBe('/employee/dashboard');
  });

  it('routes owner to dashboard root', () => {
    expect(resolvePostLoginDest('owner')).toBe('/dashboard');
  });

  it('routes admin to dashboard root', () => {
    expect(resolvePostLoginDest('admin')).toBe('/dashboard');
  });

  it('routes client to onboarding', () => {
    expect(resolvePostLoginDest('client')).toBe('/onboarding');
  });

  it('routes undefined role to onboarding', () => {
    expect(resolvePostLoginDest(undefined)).toBe('/onboarding');
  });

  it('owner respects safe returnTo', () => {
    expect(resolvePostLoginDest('owner', '/projects/123')).toBe('/projects/123');
  });

  it('employee ignores owner-app returnTo and goes to Field Portal', () => {
    expect(resolvePostLoginDest('employee', '/projects/123')).toBe('/employee/dashboard');
  });

  it('employee preserves employee portal returnTo', () => {
    expect(resolvePostLoginDest('employee', '/employee/tasks')).toBe('/employee/tasks');
  });

  it('owner does not preserve employee portal returnTo', () => {
    expect(resolvePostLoginDest('owner', '/employee/dashboard')).toBe('/dashboard');
  });

  it('rejects protocol-relative returnTo as unsafe', () => {
    expect(resolvePostLoginDest('owner', '//evil.com')).toBe('/dashboard');
  });

  it('rejects non-path returnTo', () => {
    expect(resolvePostLoginDest('owner', 'https://evil.com')).toBe('/dashboard');
  });
});
