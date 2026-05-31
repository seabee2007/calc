import { describe, expect, it } from 'vitest';
import {
  buildPlacementPourDateIso,
  placementDateYmdFromIso,
  resolvePlacementDateYmd,
} from './placementPourDate';

describe('placementPourDate', () => {
  it('builds ISO from local date and time', () => {
    const iso = buildPlacementPourDateIso('2026-06-15', '07:30');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(30);
  });

  it('round-trips calendar date in local timezone', () => {
    const iso = buildPlacementPourDateIso('2026-06-15', '07:00');
    expect(placementDateYmdFromIso(iso)).toBe('2026-06-15');
  });

  it('resolves from project pour date when selection empty', () => {
    const iso = buildPlacementPourDateIso('2026-08-01', '08:00');
    expect(
      resolvePlacementDateYmd(null, {
        pourDate: iso,
        placementOrder: undefined,
      }),
    ).toBe('2026-08-01');
  });
});
