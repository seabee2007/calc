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
    expect(resolvePostLoginDest('owner')).toBe('/');
  });

  it('routes admin to dashboard root', () => {
    expect(resolvePostLoginDest('admin')).toBe('/');
  });

  it('routes client to dashboard root', () => {
    expect(resolvePostLoginDest('client')).toBe('/');
  });

  it('routes undefined role to dashboard root', () => {
    expect(resolvePostLoginDest(undefined)).toBe('/');
  });

  it('owner respects safe returnTo', () => {
    expect(resolvePostLoginDest('owner', '/projects/123')).toBe('/projects/123');
  });

  it('employee ignores returnTo and always goes to Field Portal', () => {
    expect(resolvePostLoginDest('employee', '/projects/123')).toBe('/employee/dashboard');
  });

  it('rejects protocol-relative returnTo as unsafe', () => {
    expect(resolvePostLoginDest('owner', '//evil.com')).toBe('/');
  });

  it('rejects non-path returnTo', () => {
    expect(resolvePostLoginDest('owner', 'https://evil.com')).toBe('/');
  });
});
