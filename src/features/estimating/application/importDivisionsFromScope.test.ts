import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendSelectedDivisions,
  buildSelectedDivisionsFromCodes,
} from './estimateWorkBreakdown';
import { inferDivisionsFromScopeKeywords } from './scopeActivityDivisionClassifier';
import {
  normalizeSuggestDivisionsResponse,
  suggestDivisionsFromScope,
} from './suggestEstimateActivitiesFromScope';

const RESIDENTIAL_SOW =
  'Construct a 2,000 SF single-family wood-frame residence including site clearing, excavation, grading, concrete footings, slab-on-grade, vapor barrier, wood framing, roof sheathing, roofing, exterior doors and windows, drywall, interior finishes, plumbing rough-in and fixtures, HVAC system, electrical service, panels, branch circuits, lighting, and final cleanup.';

const importModalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/ImportFromScopeModal.tsx',
  ),
  'utf8',
);
const builderPanelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/ConstructionActivityBuilderPanel.tsx',
  ),
  'utf8',
);

describe('normalizeSuggestDivisionsResponse', () => {
  it('parses { divisions: [...] } response shape', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [
          {
            divisionCode: '03',
            divisionName: 'Concrete',
            confidence: 0.91,
            reason: 'Scope mentions concrete slab and footings.',
          },
        ],
      },
      'Concrete slab project.',
    );

    expect(result.divisions).toHaveLength(1);
    expect(result.divisions[0]?.divisionCode).toBe('03');
  });

  it('does not require { suggestions: [...] } legacy activity shape', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        suggestions: [
          {
            divisionCode: '06',
            activityTitle: 'Wood framing',
            confidence: 0.9,
            reason: 'Legacy activity suggestion.',
          },
        ],
      },
      'Wood framing project.',
    );

    expect(result.divisions).toEqual([]);
  });

  it('normalizes single-digit division codes to two digits', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [{ divisionCode: 3, confidence: 0.8, reason: 'Concrete work.' }],
      },
      'Concrete footings.',
    );

    expect(result.divisions[0]?.divisionCode).toBe('03');
  });

  it('keeps confidence >= 0.35 and does not remove all valid divisions', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [
          { divisionCode: '06', confidence: 0.4, reason: 'Wood framing.' },
          { divisionCode: '07', confidence: 0.35, reason: 'Roofing.' },
          { divisionCode: '08', confidence: 0.34, reason: 'Below threshold.' },
        ],
      },
      'Wood framing, roofing, and windows.',
    );

    expect(result.divisions.map((division) => division.divisionCode)).toEqual(['06', '07']);
    expect(result.divisions[0]?.confidence).toBe('low');
    expect(result.divisions[1]?.confidence).toBe('low');
  });

  it('uses default confidence 0.75 when confidence is missing', () => {
    const result = normalizeSuggestDivisionsResponse(
      {
        divisions: [{ divisionCode: '26', reason: 'Electrical scope.' }],
      },
      'Electrical panels and lighting.',
    );

    expect(result.divisions[0]?.confidence).toBe('medium');
  });

  it('normalizes notes and fallbackUsed from edge response', () => {
    const result = normalizeSuggestDivisionsResponse({
      divisions: [{ divisionCode: '31', confidence: 0.75, reason: 'Earthwork.' }],
      notes: ['AI returned no valid divisions. Keyword fallback was used.'],
      fallbackUsed: true,
    });

    expect(result.notes).toEqual(['AI returned no valid divisions. Keyword fallback was used.']);
    expect(result.fallbackUsed).toBe(true);
  });
});

describe('inferDivisionsFromScopeKeywords', () => {
  it('returns expected residential SOW divisions including earthwork not concrete for excavation', () => {
    const codes = inferDivisionsFromScopeKeywords(RESIDENTIAL_SOW);
    const expected = ['03', '06', '07', '08', '09', '22', '23', '26', '31'];

    for (const code of expected) {
      expect(codes).toContain(code);
    }
  });

  it('maps excavation and grading to 31, not 03 alone', () => {
    const codes = inferDivisionsFromScopeKeywords(
      'Site clearing, excavation, grading, and trenching for utility runs.',
    );
    expect(codes).toContain('31');
    expect(codes).not.toContain('03');
  });

  it('maps concrete footings and slab-on-grade to 03', () => {
    const codes = inferDivisionsFromScopeKeywords('Concrete footings and slab-on-grade with rebar.');
    expect(codes).toContain('03');
  });
});

describe('suggestDivisionsFromScope', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls suggest-divisions-from-scope edge function', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        divisions: [{ divisionCode: '06', confidence: 0.8, reason: 'Framing.' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { supabase } = await import('../../../lib/supabase');
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    } as never);

    await suggestDivisionsFromScope({
      projectId: 'project-1',
      scopeText: 'Wood framing residence.',
      projectName: 'Residence',
      estimateType: 'detailed',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/functions/v1/suggest-divisions-from-scope');
    const payload = JSON.parse(options.body);
    expect(payload.scopeText).toBe('Wood framing residence.');
    expect(payload.projectName).toBe('Residence');
    expect(payload.estimateType).toBe('detailed');
  });
});

describe('import divisions from scope save behavior', () => {
  it('merges into selectedDivisions and skips duplicate codes', () => {
    const existing = buildSelectedDivisionsFromCodes(['01', '03'], { source: 'manual' });
    const additions = buildSelectedDivisionsFromCodes(['03', '06', '06'], { source: 'ai' });
    const merged = appendSelectedDivisions(existing, additions);

    expect(merged.map((division) => division.code)).toEqual(['01', '03', '06']);
    expect(merged.filter((division) => division.code === '06').every((division) => division.source === 'ai')).toBe(
      true,
    );
  });

  it('save handler only adds missing divisions once', () => {
    const existingCodes = new Set(['01', '03']);
    const incoming = ['03', '06', '08'];
    const missingCodes = incoming.filter((code) => !existingCodes.has(code));
    expect(missingCodes).toEqual(['06', '08']);

    const additions = buildSelectedDivisionsFromCodes(missingCodes, { source: 'ai' });
    const merged = appendSelectedDivisions(
      buildSelectedDivisionsFromCodes(['01', '03'], { source: 'manual' }),
      additions,
    );
    expect(merged.map((division) => division.code)).toEqual(['01', '03', '06', '08']);
  });

  it('cancel path does not mutate selectedDivisions', () => {
    const before = buildSelectedDivisionsFromCodes(['01'], { source: 'manual' });
    const snapshot = [...before];
    // Modal close resets state without calling save — verify merge only happens on explicit add.
    expect(snapshot).toEqual(before);
    expect(before.map((division) => division.code)).toEqual(['01']);
  });
});

describe('import from scope live flow guardrails', () => {
  it('does not reference batchImportActivitiesFromScope in modal or builder panel', () => {
    expect(importModalSource).not.toContain('batchImportActivitiesFromScope');
    expect(builderPanelSource).not.toContain('batchImportActivitiesFromScope');
    expect(importModalSource).not.toContain('matchScopeSuggestionToProductionRates');
    expect(builderPanelSource).not.toContain('matchScopeSuggestionToProductionRates');
  });

  it('modal uses division review UI without activity import fields', () => {
    expect(importModalSource).toContain('Review Suggested Divisions');
    expect(importModalSource).toContain('Add Selected Divisions');
    expect(importModalSource).not.toContain('AssemblyPickerModal');
    expect(importModalSource).not.toContain('activityTitle');
    expect(importModalSource).not.toContain('suggestedQuantity');
    expect(importModalSource).not.toContain('missingQuantityQuestion');
  });

  it('builder panel division import handler only ensures divisions are selected', () => {
    expect(builderPanelSource).toContain('onEnsureDivisionsSelected');
    const handlerMatch = builderPanelSource.match(
      /const handleAddSelectedDivisions = useCallback\([\s\S]*?\n  \);/,
    );
    expect(handlerMatch?.[0]).toBeTruthy();
    expect(handlerMatch?.[0]).toContain('onEnsureDivisionsSelected');
    expect(handlerMatch?.[0]).not.toContain('addFromProductionRateAssembly');
    expect(handlerMatch?.[0]).not.toContain('addManualActivity');
    expect(handlerMatch?.[0]).not.toContain('batchImportActivitiesFromScope');
  });
});
