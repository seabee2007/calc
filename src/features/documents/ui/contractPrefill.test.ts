import { describe, expect, it } from 'vitest';
import {
  buildContractPrefillFromProject,
  jobsitePrefillFingerprint,
  resolveProjectJobsiteAddress,
} from './contractPrefill';
import type { Project } from '../../../types';
import { EMPTY_US_ADDRESS } from '../../../types/address';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'Concrete driveway',
    jobsiteAddress: {
      ...EMPTY_US_ADDRESS,
      street: '123 Main St',
      city: 'Tamuning',
      state: 'GU',
      zip: '96913',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    calculations: [],
    ...overrides,
  };
}

describe('resolveProjectJobsiteAddress', () => {
  it('returns sanitized structured jobsite with zip', () => {
    const addr = resolveProjectJobsiteAddress(makeProject());
    expect(addr?.zip).toBe('96913');
    expect(addr?.street).toBe('123 Main St');
  });

  it('fills missing zip from legacy placement order string', () => {
    const project = makeProject({
      jobsiteAddress: {
        ...EMPTY_US_ADDRESS,
        street: '123 Main St',
        city: 'Tamuning',
        state: 'GU',
        zip: '',
      },
      placementOrder: {
        status: 'draft',
        contact: {
          phone: '',
          email: '',
          dispatchContact: '',
          source: 'manual',
        },
        orderNotes: '',
        updatedAt: '2026-01-01T00:00:00Z',
        jobsiteAddress: '123 Main St, Tamuning, GU 96913',
      },
    });
    const addr = resolveProjectJobsiteAddress(project);
    expect(addr?.zip).toBe('96913');
  });
});

describe('buildContractPrefillFromProject', () => {
  it('maps property and owner mailing zip from project jobsite', () => {
    const result = buildContractPrefillFromProject(makeProject());
    expect(result.values.propertyAddressZip).toBe('96913');
    expect(result.values.ownerMailingAddressZip).toBe('96913');
    expect(result.sources.propertyAddressZip).toBe('project');
  });

  it('uses separate client address zip when not same as jobsite', () => {
    const project = makeProject({
      clientInfo: {
        clientName: 'Jane Doe',
        clientAddressSameAsJobsite: false,
        clientAddress: {
          ...EMPTY_US_ADDRESS,
          street: '456 Oak Ave',
          city: 'Dededo',
          state: 'GU',
          zip: '96929',
        },
      },
    });
    const result = buildContractPrefillFromProject(project);
    expect(result.values.propertyAddressZip).toBe('96913');
    expect(result.values.ownerMailingAddressZip).toBe('96929');
  });
});

describe('jobsitePrefillFingerprint', () => {
  it('changes when zip is added to jobsite', () => {
    const withoutZip = jobsitePrefillFingerprint(
      makeProject({
        jobsiteAddress: { ...EMPTY_US_ADDRESS, street: '123 Main St', city: 'Tamuning', state: 'GU' },
      }),
    );
    const withZip = jobsitePrefillFingerprint(makeProject());
    expect(withoutZip).not.toBe(withZip);
  });
});
