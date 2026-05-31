import { describe, expect, it } from 'vitest';
import {
  buildPlacementPourDateIso,
  parsePlacementPourMoment,
  parsePlacementStartTimeFromOrder,
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

  it('uses order start time instead of UTC offset from legacy noon ISO', () => {
    const legacyNoonUtc = '2026-06-15T12:00:00.000Z';
    const moment = parsePlacementPourMoment(legacyNoonUtc, {
      pourStartTime: '07:00',
      summaryLines: [],
    });
    expect(moment).not.toBeNull();
    expect(moment!.getHours()).toBe(7);
    expect(moment!.getMinutes()).toBe(0);
    expect(moment!.getDate()).toBe(15);
  });

  it('reads start time from call sheet summary', () => {
    expect(
      parsePlacementStartTimeFromOrder({
        summaryLines: ['Requested Start Time: 6:30 AM (06:30)'],
      }),
    ).toBe('06:30');
  });
});
