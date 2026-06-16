import { describe, expect, it } from 'vitest';
import {
  COMPACT_ACTION_CARD_WIDTH,
  isCompactDashboardCard,
} from './dashboardCardLayout';

describe('isCompactDashboardCard', () => {
  it('uses full labels for wide cards (w > 6)', () => {
    expect(isCompactDashboardCard(12)).toBe(false);
    expect(isCompactDashboardCard(8)).toBe(false);
    expect(isCompactDashboardCard(COMPACT_ACTION_CARD_WIDTH + 1)).toBe(false);
  });

  it('uses compact labels for half-width and smaller (w <= 6)', () => {
    expect(isCompactDashboardCard(6)).toBe(true);
    expect(isCompactDashboardCard(4)).toBe(true);
  });

  it('uses compact labels on mobile regardless of card width', () => {
    expect(isCompactDashboardCard(12, true)).toBe(true);
    expect(isCompactDashboardCard(undefined, true)).toBe(true);
  });

  it('defaults to full labels when width is unknown on desktop', () => {
    expect(isCompactDashboardCard(undefined)).toBe(false);
    expect(isCompactDashboardCard(undefined, false)).toBe(false);
  });
});
