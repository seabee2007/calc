import { describe, expect, it } from 'vitest';
import {
  defaultJobsiteProjectId,
  projectJobsiteQuery,
  projectsWithJobsite,
} from '../weatherWidgetProjects';
import type { Project } from '../../types';
import { US_COUNTRY_LABEL } from '../../types/address';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Alpha',
    description: '',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    calculations: [],
    jobsiteAddress: {
      street: '100 Main St',
      street2: '',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      country: US_COUNTRY_LABEL,
    },
    ...overrides,
  };
}

describe('weatherWidgetProjects', () => {
  it('builds a geocode query from jobsite address', () => {
    const query = projectJobsiteQuery(project());
    expect(query).toContain('Portland');
    expect(query).toContain('OR');
  });

  it('lists only projects with enough jobsite data', () => {
    const rows = projectsWithJobsite([
      project(),
      project({ id: 'p2', name: 'No site', jobsiteAddress: undefined }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alpha');
  });

  it('picks the most recently updated project by default', () => {
    const id = defaultJobsiteProjectId([
      project({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
      project({ id: 'new', updatedAt: '2026-06-15T00:00:00Z' }),
    ]);
    expect(id).toBe('new');
  });
});
