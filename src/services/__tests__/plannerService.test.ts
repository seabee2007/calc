import { describe, expect, it } from 'vitest';
import { isPlannerBoardUniqueViolation } from '../plannerService';

describe('plannerService board creation', () => {
  it('detects planner_boards unique constraint violations', () => {
    expect(isPlannerBoardUniqueViolation({ code: '23505' })).toBe(true);
    expect(isPlannerBoardUniqueViolation({ code: '42P01' })).toBe(false);
    expect(isPlannerBoardUniqueViolation(null)).toBe(false);
  });
});
