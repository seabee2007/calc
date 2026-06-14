import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

import {
  CONTRACTOR_FURNISH_PREFIX,
  PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE,
  PROFESSIONALIZE_SCOPE_ERROR_MESSAGE,
  PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE,
  ProfessionalizeScopeEmptyError,
  ProfessionalizeScopeFailedError,
  applyContractorFurnishPrefix,
  buildProfessionalizeScopeUserPrompt,
  improvedScopePreservesUserDetails,
  isScopeTextEmpty,
  parseProfessionalizeScopeResponse,
  professionalizeProjectScope,
} from '../application/professionalizeProjectScope';

const projectFormSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../components/projects/ProjectForm.tsx',
  ),
  'utf8',
);

const exampleScope =
  'construct a new approximately 2,000 square foot residential home in accordance with the approved plans, specifications, local building codes, and permit requirements. Work shall include site preparation, foundation, framing, roofing, exterior and interior finishes, plumbing, electrical, HVAC, insulation, drywall, flooring, cabinets, fixtures, painting, final cleanup, inspections, punch list completion, and final turnover to the owner.';

describe('professionalizeProjectScope helpers', () => {
  it('detects empty scope text', () => {
    expect(isScopeTextEmpty('')).toBe(true);
    expect(isScopeTextEmpty('   ')).toBe(true);
    expect(isScopeTextEmpty('Residential slab')).toBe(false);
  });

  it('applies contractor furnish language when appropriate', () => {
    const improved = applyContractorFurnishPrefix(exampleScope);
    expect(improved.startsWith(CONTRACTOR_FURNISH_PREFIX)).toBe(true);
    expect(improved).toContain('2,000 square foot');
    expect(improved).toContain('plumbing, electrical, HVAC');
  });

  it('preserves dimensions and quantities in improved output checks', () => {
    const improved = applyContractorFurnishPrefix(exampleScope);
    expect(improvedScopePreservesUserDetails(exampleScope, improved)).toBe(true);
  });

  it('builds the professionalize prompt with project context', () => {
    const prompt = buildProfessionalizeScopeUserPrompt({
      scopeText: exampleScope,
      projectName: 'GA26-201',
      projectType: 'Residential',
    });
    expect(prompt).toContain('Original scope:');
    expect(prompt).toContain(exampleScope);
    expect(prompt).toContain('Project name:');
    expect(prompt).toContain('GA26-201');
    expect(prompt).toContain('Preserve all quantities');
  });

  it('parses improved scope responses', () => {
    expect(parseProfessionalizeScopeResponse({ improvedScope: 'Improved text' })).toBe(
      'Improved text',
    );
    expect(() => parseProfessionalizeScopeResponse({})).toThrow(ProfessionalizeScopeFailedError);
  });
});

describe('professionalizeProjectScope service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    getSessionMock.mockReset();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('does not call AI for empty scope', async () => {
    await expect(professionalizeProjectScope({ scopeText: '   ' })).rejects.toThrow(
      ProfessionalizeScopeEmptyError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the edge function and returns improved scope', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        improvedScope: applyContractorFurnishPrefix(exampleScope),
      }),
    });

    const improved = await professionalizeProjectScope({
      scopeText: exampleScope,
      projectName: 'Test Project',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/professionalize-project-scope',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(improved.startsWith(CONTRACTOR_FURNISH_PREFIX)).toBe(true);
    expect(improvedScopePreservesUserDetails(exampleScope, improved)).toBe(true);
  });

  it('throws when the edge function fails', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Could not improve scope' }),
    });

    await expect(professionalizeProjectScope({ scopeText: exampleScope })).rejects.toThrow(
      ProfessionalizeScopeFailedError,
    );
  });
});

describe('Project form professionalize scope UI', () => {
  it('exposes Clean up scope action with loading and toast messages', () => {
    expect(projectFormSource).toContain('Clean up scope');
    expect(projectFormSource).toContain('Cleaning up…');
    expect(projectFormSource).toContain('professionalizeProjectScope');
    expect(PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE).toBe('Scope improved');
    expect(projectFormSource).toContain('PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE');
    expect(projectFormSource).toContain('PROFESSIONALIZE_SCOPE_ERROR_MESSAGE');
    expect(projectFormSource).toContain('PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE');
    expect(projectFormSource).toContain("setValue('description'");
  });

  it('keeps create project submit flow using description field', () => {
    expect(projectFormSource).toContain('scopeDescription: data.description');
    expect(projectFormSource).toContain('Create Project');
  });
});
