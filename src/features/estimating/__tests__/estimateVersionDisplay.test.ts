import { describe, expect, it } from 'vitest';
import type { EstimateVersionRow } from '../infrastructure/estimateDbTypes';
import {
  buildEstimateVersionHistoryItems,
  estimateVersionNameIncludesNumber,
  extractLaborHoursFromSnapshot,
  extractLineItemCountFromSnapshot,
  extractSellPriceFromTotalsJson,
  extractVersionDisplayMetrics,
  formatEstimateVersionLabel,
  isCurrentEstimateVersion,
  isGenericEstimateVersionName,
  sortEstimateVersionsNewestFirst,
} from '../ui/estimateVersionDisplay';

function versionRow(
  versionNumber: number,
  overrides: Partial<EstimateVersionRow> = {},
): EstimateVersionRow {
  return {
    id: `ver-${versionNumber}`,
    estimate_id: 'est-1',
    project_id: 'proj-1',
    version_number: versionNumber,
    version_name: `Version ${versionNumber}`,
    estimate_type: 'detailed',
    status: 'draft',
    snapshot: {},
    totals: {},
    notes: null,
    created_by: null,
    created_at: `2026-06-0${versionNumber}T12:00:00.000Z`,
    ...overrides,
  };
}

describe('sortEstimateVersionsNewestFirst', () => {
  it('sorts by version_number descending', () => {
    const sorted = sortEstimateVersionsNewestFirst([
      versionRow(1),
      versionRow(3),
      versionRow(2),
    ]);

    expect(sorted.map((row) => row.version_number)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const input = [versionRow(1), versionRow(2)];
    const copy = [...input];
    sortEstimateVersionsNewestFirst(input);
    expect(input).toEqual(copy);
  });
});

describe('isCurrentEstimateVersion', () => {
  it('returns true when ids match', () => {
    expect(isCurrentEstimateVersion('ver-2', 'ver-2')).toBe(true);
  });

  it('returns false for mismatched or missing current id', () => {
    expect(isCurrentEstimateVersion('ver-2', 'ver-1')).toBe(false);
    expect(isCurrentEstimateVersion('ver-2', null)).toBe(false);
    expect(isCurrentEstimateVersion('ver-2', undefined)).toBe(false);
  });
});

describe('extractSellPriceFromTotalsJson', () => {
  it('reads finalSellPrice from totals json', () => {
    expect(
      extractSellPriceFromTotalsJson({
        finalSellPrice: 12500.5,
        directCost: 9000,
      }),
    ).toBe(12500.5);
  });

  it('falls back to directCost when finalSellPrice is missing', () => {
    expect(extractSellPriceFromTotalsJson({ directCost: 4200 })).toBe(4200);
  });

  it('returns null for empty or invalid totals', () => {
    expect(extractSellPriceFromTotalsJson({})).toBeNull();
    expect(extractSellPriceFromTotalsJson(null)).toBeNull();
    expect(extractSellPriceFromTotalsJson({ finalSellPrice: 'n/a' })).toBeNull();
  });
});

describe('extractLaborHoursFromSnapshot', () => {
  it('sums adjustedLaborHours from snapshot line items', () => {
    expect(
      extractLaborHoursFromSnapshot({
        lineItems: [
          { metrics: { adjustedLaborHours: 10 } },
          { metrics: { laborHours: 5 } },
        ],
      }),
    ).toBe(15);
  });

  it('returns null when snapshot has no line items', () => {
    expect(extractLaborHoursFromSnapshot({})).toBeNull();
    expect(extractLaborHoursFromSnapshot({ lineItems: [] })).toBeNull();
  });
});

describe('extractLineItemCountFromSnapshot', () => {
  it('returns lineItems array length', () => {
    expect(
      extractLineItemCountFromSnapshot({
        lineItems: [{ id: 'a' }, { id: 'b' }],
      }),
    ).toBe(2);
  });

  it('returns null when lineItems is missing', () => {
    expect(extractLineItemCountFromSnapshot({})).toBeNull();
  });
});

describe('extractVersionDisplayMetrics', () => {
  it('combines totals and snapshot metrics safely', () => {
    const metrics = extractVersionDisplayMetrics(
      versionRow(1, {
        totals: { finalSellPrice: 1000 },
        snapshot: {
          lineItems: [{ metrics: { adjustedLaborHours: 8 } }, { id: 'b' }],
        },
      }),
    );

    expect(metrics).toEqual({
      totalSellPrice: 1000,
      laborHours: 8,
      lineItemCount: 2,
    });
  });

  it('returns null metrics when data is missing', () => {
    expect(extractVersionDisplayMetrics(versionRow(1))).toEqual({
      totalSellPrice: null,
      laborHours: null,
      lineItemCount: null,
    });
  });
});

describe('formatEstimateVersionLabel', () => {
  it('returns version name when it already includes the version number', () => {
    expect(formatEstimateVersionLabel('Draft v4', 4)).toBe('Draft v4');
    expect(formatEstimateVersionLabel('Version 2', 2)).toBe('Version 2');
  });

  it('appends version number when name does not include it', () => {
    expect(formatEstimateVersionLabel('Initial Draft', 1)).toBe('Initial Draft v1');
  });

  it('uses fallback when version name is missing or generic', () => {
    expect(formatEstimateVersionLabel(null, 3)).toBe('Version v3');
    expect(formatEstimateVersionLabel('', 3)).toBe('Version v3');
    expect(formatEstimateVersionLabel('Draft', 3)).toBe('Version v3');
    expect(formatEstimateVersionLabel('Version', 5)).toBe('Version v5');
  });
});

describe('estimateVersionNameIncludesNumber', () => {
  it('detects embedded version numbers', () => {
    expect(estimateVersionNameIncludesNumber('Draft v4', 4)).toBe(true);
    expect(estimateVersionNameIncludesNumber('Initial Draft', 1)).toBe(false);
  });
});

describe('isGenericEstimateVersionName', () => {
  it('treats blank and generic names as generic', () => {
    expect(isGenericEstimateVersionName(null)).toBe(true);
    expect(isGenericEstimateVersionName('Draft')).toBe(true);
    expect(isGenericEstimateVersionName('Initial Draft')).toBe(false);
  });
});

describe('buildEstimateVersionHistoryItems', () => {
  it('marks current version and sorts newest first', () => {
    const items = buildEstimateVersionHistoryItems(
      [versionRow(1, { id: 'ver-1' }), versionRow(2, { id: 'ver-2' })],
      'ver-2',
    );

    expect(items.map((item) => item.versionNumber)).toEqual([2, 1]);
    expect(items.find((item) => item.id === 'ver-2')?.isCurrent).toBe(true);
    expect(items.find((item) => item.id === 'ver-1')?.isCurrent).toBe(false);
  });
});
