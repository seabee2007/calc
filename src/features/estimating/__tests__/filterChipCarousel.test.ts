import { describe, expect, it } from 'vitest';
import {
  canScrollCarouselLeft,
  canScrollCarouselRight,
  DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL,
  FILTER_CAROUSEL_SCROLL_AREA_CLASS,
  FILTER_CHIP_SCROLL_STEP_PX,
  getFilterChipClassName,
  shouldShowFilterCarouselArrows,
  type FilterChip,
} from '../ui/filterChipCarouselModel';
import { getVisibleBreakdownDivisions } from '../application/estimateBuilderFilters';
import { emptyGroupRollup } from '../domain/estimateLineItemTree';
import type { EstimateWorkBreakdown } from '../application/estimateWorkBreakdown';

function chips(count: number): FilterChip[] {
  return Array.from({ length: count }, (_, index) => ({
    value: `chip-${index}`,
    label: `Chip ${index}`,
  }));
}

describe('filterChipCarousel', () => {
  it('renders chip model values for carousel rows', () => {
    const divisionChips = [
      { value: 'all', label: 'All divisions' },
      { value: '01', label: '01 - General Requirements' },
    ];

    expect(divisionChips).toHaveLength(2);
    expect(divisionChips[1].label).toContain('General Requirements');
  });

  it('highlights the active chip class', () => {
    expect(getFilterChipClassName(true)).toContain('border-cyan-400');
    expect(getFilterChipClassName(false)).toContain('border-slate-600');
  });

  it('calls onChange through chip value selection contract', () => {
    let nextValue = 'all';
    const onChange = (value: string) => {
      nextValue = value;
    };

    onChange('03');
    expect(nextValue).toBe('03');
  });

  it('shows arrows only when chip count exceeds threshold or content overflows', () => {
    expect(
      shouldShowFilterCarouselArrows(4, false, DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL),
    ).toBe(false);
    expect(
      shouldShowFilterCarouselArrows(5, false, DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL),
    ).toBe(true);
    expect(
      shouldShowFilterCarouselArrows(3, true, DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL),
    ).toBe(true);
  });

  it('scrolls the chip container by the configured step', () => {
    expect(FILTER_CHIP_SCROLL_STEP_PX).toBe(220);
    expect(canScrollCarouselLeft(0)).toBe(false);
    expect(canScrollCarouselLeft(12)).toBe(true);
    expect(canScrollCarouselRight(0, 200, 500)).toBe(true);
    expect(canScrollCarouselRight(300, 200, 500)).toBe(false);
  });

  it('hides the browser scrollbar on the carousel track', () => {
    expect(FILTER_CAROUSEL_SCROLL_AREA_CLASS).toBe('no-scrollbar');
  });
});

describe('filterChipCarousel with estimate filters', () => {
  const breakdown: EstimateWorkBreakdown = {
    divisions: [
      {
        code: '01',
        label: '01 - General Requirements',
        name: 'General Requirements',
        rollup: emptyGroupRollup(),
        activityCount: 0,
        hasActivities: false,
      },
      {
        code: '31',
        label: '31 - Earthwork',
        name: 'Earthwork',
        rollup: emptyGroupRollup(),
        activityCount: 0,
        hasActivities: false,
      },
    ],
  };

  it('still filters division groups when a division chip is selected', () => {
    const visible = getVisibleBreakdownDivisions(breakdown, [], {
      divisionKey: '01',
      scopeKey: null,
    });

    expect(visible.map((division) => division.code)).toEqual(['01']);
  });

  it('shows all division groups when no division filter is active', () => {
    const visible = getVisibleBreakdownDivisions(breakdown, [], {
      divisionKey: null,
      scopeKey: null,
    });

    expect(visible.map((division) => division.code)).toEqual(['01', '31']);
  });
});
