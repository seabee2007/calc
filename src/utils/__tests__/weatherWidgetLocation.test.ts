import { describe, expect, it } from 'vitest';
import {
  hasMyWeatherLocation,
  resolveDefaultWeatherSource,
  resolveMyWeatherLocation,
  weatherSubtitleLine,
} from '../weatherWidgetLocation';
import type { Profile } from '../../types/fieldPlanner';
import type { Project } from '../../types';
import { US_COUNTRY_LABEL } from '../../types/address';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    role: 'owner',
    employerId: null,
    displayName: null,
    firstName: 'Pat',
    lastName: 'Owner',
    phone: null,
    businessAddressStreet: '123 Main St',
    businessAddressStreet2: null,
    businessAddressCity: 'Dededo',
    businessAddressState: 'GU',
    businessAddressPostalCode: '96929',
    agreementAcceptedAt: null,
    agreementVersion: null,
    onboardingCompletedAt: null,
    onboardingVersion: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function projectWithSite(id: string, updatedAt: string): Project {
  return {
    id,
    name: `Project ${id}`,
    description: '',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt,
    calculations: [],
    jobsiteAddress: {
      street: '100 Main St',
      street2: '',
      city: 'Santa Rita',
      state: 'GU',
      zip: '96915',
      country: US_COUNTRY_LABEL,
    },
  };
}

describe('weatherWidgetLocation', () => {
  it('resolves My Weather from profile address first', () => {
    const loc = resolveMyWeatherLocation(profile(), '');
    expect(loc?.query).toContain('Dededo');
    expect(loc?.label).toBe('Dededo, GU');
  });

  it('falls back to company address when profile has none', () => {
    const loc = resolveMyWeatherLocation(
      profile({
        businessAddressStreet: null,
        businessAddressCity: null,
        businessAddressState: null,
        businessAddressPostalCode: null,
      }),
      '456 Oak||Tamuning|GU|96913',
    );
    expect(loc?.query).toContain('Tamuning');
    expect(loc?.label).toBe('Tamuning, GU');
  });

  it('defaults to My Weather when profile or company location exists', () => {
    const selection = resolveDefaultWeatherSource(profile(), '', [projectWithSite('p1', '2026-06-15T00:00:00Z')]);
    expect(selection).toEqual({ source: 'my', projectId: null });
  });

  it('defaults to most recent project when My Weather is unavailable', () => {
    const selection = resolveDefaultWeatherSource(null, '', [
      projectWithSite('old', '2026-01-01T00:00:00Z'),
      projectWithSite('new', '2026-06-15T00:00:00Z'),
    ]);
    expect(selection).toEqual({ source: 'project', projectId: 'new' });
  });

  it('restores saved project selection when valid', () => {
    const selection = resolveDefaultWeatherSource(
      profile(),
      '',
      [projectWithSite('p1', '2026-06-15T00:00:00Z')],
      { selectedWeatherSource: 'project', selectedProjectId: 'p1' },
    );
    expect(selection).toEqual({ source: 'project', projectId: 'p1' });
  });

  it('returns setup when no location sources exist', () => {
    expect(hasMyWeatherLocation(null, '')).toBe(false);
    expect(resolveDefaultWeatherSource(null, '', [])).toEqual({
      source: 'setup',
      projectId: null,
    });
  });

  it('formats subtitle lines', () => {
    expect(weatherSubtitleLine('my', 'Dededo, GU')).toBe('My Weather · Dededo, GU');
    expect(weatherSubtitleLine('project', 'Santa Rita, GU')).toBe(
      'Jobsite forecast · Santa Rita, GU',
    );
  });
});
