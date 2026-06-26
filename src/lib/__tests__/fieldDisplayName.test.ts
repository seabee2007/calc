import { describe, expect, it } from 'vitest';
import {
  capitalizeDisplayToken,
  profileInitials,
  resolveFieldFullName,
  resolveFieldGreetingName,
} from '../fieldDisplayName';

describe('fieldDisplayName', () => {
  it('prefers display name for greeting', () => {
    expect(
      resolveFieldGreetingName({
        displayName: 'jane doe',
        firstName: 'Janet',
        email: 'jane@example.com',
      }),
    ).toBe('Jane');
  });

  it('falls back to first name then auth full name then email local part', () => {
    expect(resolveFieldGreetingName({ firstName: 'sam' })).toBe('Sam');
    expect(resolveFieldGreetingName({ authFullName: 'alex smith' })).toBe('Alex');
    expect(resolveFieldGreetingName({ email: 'field.user@example.com' })).toBe('Field User');
    expect(resolveFieldGreetingName({})).toBe('there');
  });

  it('capitalizes fallback tokens', () => {
    expect(capitalizeDisplayToken('field_user-name')).toBe('Field User Name');
  });

  it('resolves full name from profile fields', () => {
    expect(
      resolveFieldFullName({
        firstName: 'Pat',
        lastName: 'Lee',
      }),
    ).toBe('Pat Lee');
    expect(resolveFieldFullName({ displayName: 'Custom Name' })).toBe('Custom Name');
  });

  it('builds profile initials', () => {
    expect(profileInitials({ firstName: 'Pat', lastName: 'Lee' })).toBe('PL');
    expect(profileInitials({ displayName: 'Pat Lee' })).toBe('PL');
    expect(profileInitials({ displayName: 'Solo' })).toBe('S');
  });
});
