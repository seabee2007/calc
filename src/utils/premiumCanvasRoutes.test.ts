import { describe, expect, it } from 'vitest';
import { usesPremiumCanvas } from './premiumCanvasRoutes';

describe('usesPremiumCanvas', () => {
  it('matches in-scope main app routes', () => {
    expect(usesPremiumCanvas('/')).toBe(true);
    expect(usesPremiumCanvas('/projects')).toBe(true);
    expect(usesPremiumCanvas('/projects/abc-123')).toBe(true);
    expect(usesPremiumCanvas('/resources')).toBe(true);
    expect(usesPremiumCanvas('/resources/mix-designs')).toBe(true);
    expect(usesPremiumCanvas('/planner/hub')).toBe(true);
    expect(usesPremiumCanvas('/proposals')).toBe(true);
    expect(usesPremiumCanvas('/proposal-generator')).toBe(true);
    expect(usesPremiumCanvas('/calculator')).toBe(true);
    expect(usesPremiumCanvas('/calculator/concrete')).toBe(true);
    expect(usesPremiumCanvas('/tools/safety-meeting')).toBe(true);
    expect(usesPremiumCanvas('/mix-design-advisor')).toBe(true);
    expect(usesPremiumCanvas('/pour-planner')).toBe(true);
    expect(usesPremiumCanvas('/settings')).toBe(true);
    expect(usesPremiumCanvas('/owner/review')).toBe(true);
  });

  it('excludes out-of-scope routes', () => {
    expect(usesPremiumCanvas('/financials')).toBe(false);
    expect(usesPremiumCanvas('/employees')).toBe(false);
    expect(usesPremiumCanvas('/login')).toBe(false);
    expect(usesPremiumCanvas('/planner/schedule')).toBe(false);
    expect(usesPremiumCanvas('/projects/x/planner/board')).toBe(false);
  });
});
