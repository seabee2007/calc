import { describe, expect, it, vi } from 'vitest';
import {
  buildDivisionReason,
  mergeRecommendedDivisionCodes,
  normalizeRecommendEstimateDivisionsResponse,
  recommendEstimateDivisions,
  RECOMMEND_DIVISIONS_ERROR_MESSAGE,
  scoreDivisionConfidence,
} from '../application/recommendEstimateDivisions';

describe('recommendEstimateDivisions', () => {
  it('normalizes AI response and drops unknown division codes', () => {
    const result = normalizeRecommendEstimateDivisionsResponse({
      recommendedDivisionCodes: ['03', '99', '26'],
      recommendations: [
        {
          code: '03',
          name: 'Concrete',
          confidence: 0.92,
          reason: 'Scope mentions concrete slab and footing work.',
        },
        {
          code: '99',
          name: 'Invalid',
          confidence: 0.5,
          reason: 'Should be ignored.',
        },
        {
          code: '26',
          name: 'Electrical',
          confidence: 0.88,
          reason: 'Scope includes electrical.',
        },
      ],
      warnings: ['Scope is detailed enough for recommendations.'],
    });

    expect(result.recommendedDivisionCodes).toEqual(['03', '26']);
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]).toEqual(
      expect.objectContaining({
        code: '03',
        name: 'Concrete',
        reason: 'Scope mentions concrete slab and footing work.',
      }),
    );
    expect(result.warnings).toEqual(['Scope is detailed enough for recommendations.']);
  });

  it('merges recommended divisions without removing manually selected codes', () => {
    const merged = mergeRecommendedDivisionCodes(['01', '05'], ['03', '26', '05']);
    expect(merged).toEqual(['01', '05', '03', '26']);
  });

  it('handles missing scope warning shape with only general requirements', () => {
    const result = normalizeRecommendEstimateDivisionsResponse({
      recommendedDivisionCodes: ['01'],
      recommendations: [
        {
          code: '01',
          name: 'General Requirements',
          confidence: 0.5,
          reason: 'Baseline division when scope is missing.',
        },
      ],
      warnings: ['Project scope is missing.'],
    });

    expect(result.recommendedDivisionCodes).toEqual(['01']);
    expect(result.warnings).toContain('Project scope is missing.');
  });

  it('scores direct concrete scope above 90%', () => {
    const confidence = scoreDivisionConfidence(
      '03',
      'Build a new office building with concrete slab and foundations.',
    );

    expect(confidence).toBeGreaterThan(0.9);
  });

  it('scores general requirements above 85% for a real project scope', () => {
    const confidence = scoreDivisionConfidence(
      '01',
      'Build a new 1,200 sf office building with slab, roof, and finishes.',
    );

    expect(confidence).toBeGreaterThan(0.85);
  });

  it('scores implied divisions lower than directly named divisions', () => {
    const scope = 'Build a new office building with concrete slab.';

    expect(scoreDivisionConfidence('03', scope)).toBeGreaterThan(
      scoreDivisionConfidence('09', scope),
    );
  });

  it('recalculates equal AI confidences so recommendations do not all show 70%', () => {
    const scope =
      'Build a 1,200 sf single-story office building with concrete slab, plumbing, HVAC, electrical, finishes, and site paving.';
    const result = normalizeRecommendEstimateDivisionsResponse(
      {
        recommendedDivisionCodes: ['01', '03', '09', '22', '23', '26', '32'],
        recommendations: [
          { code: '01', confidence: 0.7, reason: 'Recommended for this project scope under General Requirements.' },
          { code: '03', confidence: 0.7, reason: 'Recommended for this project scope under Concrete.' },
          { code: '09', confidence: 0.7, reason: 'Recommended for this project scope under Finishes.' },
          { code: '22', confidence: 0.7, reason: 'Recommended for this project scope under Plumbing.' },
          { code: '23', confidence: 0.7, reason: 'Recommended for this project scope under HVAC.' },
          { code: '26', confidence: 0.7, reason: 'Recommended for this project scope under Electrical.' },
          { code: '32', confidence: 0.7, reason: 'Recommended for this project scope under Exterior Improvements.' },
        ],
      },
      scope,
    );

    const confidences = result.recommendations.map((item) => item.confidence);
    expect(new Set(confidences).size).toBeGreaterThan(1);
    expect(confidences.every((confidence) => confidence === 0.7)).toBe(false);
    expect(result.recommendations.find((item) => item.code === '03')?.confidence).toBeGreaterThan(0.9);
    expect(result.recommendations.find((item) => item.code === '09')?.confidence).toBeGreaterThan(0.9);
  });

  it('uses scope-specific fallback reasons instead of generic text', () => {
    const reason = buildDivisionReason(
      '22',
      'Build a small office with plumbing fixtures, water service, and sewer tie-in.',
    );

    expect(reason).toContain('plumbing');
    expect(reason).not.toContain('Recommended for this project scope');
  });

  it('throws a user-safe error when the Edge Function fails', async () => {
    const getSession = vi.fn(async () => ({
      data: { session: { access_token: 'token-123' } },
    }));
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    }));

    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');

    const { supabase } = await import('../../../lib/supabase');
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(getSession);

    await expect(
      recommendEstimateDivisions({
        projectId: 'proj-1',
        projectName: 'Office build',
      }),
    ).rejects.toThrow('Forbidden');

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws when user is not authenticated', async () => {
    const { supabase } = await import('../../../lib/supabase');
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      recommendEstimateDivisions({
        projectId: 'proj-1',
      }),
    ).rejects.toThrow(RECOMMEND_DIVISIONS_ERROR_MESSAGE);
  });
});
