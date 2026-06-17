import { describe, it, expect } from 'vitest';
import { checkUsageWithCreditsPure } from '../usageCredits';

describe('checkUsageWithCreditsPure — base allowance consumed before credits', () => {
  it('allows when base monthly allowance is not exhausted', () => {
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 10, 50, 1);
    expect(result.allowed).toBe(true);
    // base remaining = 50 - 10 = 40; no credit needed
    expect(result.creditRemaining).toBe(50);
  });

  it('allows when base is exhausted but credits remain', () => {
    // ai_request limit for starter = 50; used = 50 means exhausted
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 50, 80, 1);
    expect(result.allowed).toBe(true);
    expect(result.creditRemaining).toBe(80);
  });

  it('blocks when both base and credits are exhausted', () => {
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 50, 0, 1);
    expect(result.allowed).toBe(false);
    expect(result.creditRemaining).toBe(0);
  });

  it('totalRemaining equals base remaining + creditRemaining', () => {
    // starter ai limit = 50, used = 30 → base remaining = 20; credits = 15
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 30, 15, 1);
    expect(result.remaining).toBe(20);
    expect(result.creditRemaining).toBe(15);
    expect(result.totalRemaining).toBe(35);
  });

  it('allows exactly at base limit using credits for the remainder', () => {
    // base limit = 50, used = 50, requesting 1 → needs 1 from credits; credits = 1
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 50, 1, 1);
    expect(result.allowed).toBe(true);
  });

  it('blocks when requesting more than base + credits combined', () => {
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 49, 0, 5);
    // base remaining = 1, credits = 0; requesting 5
    expect(result.allowed).toBe(false);
  });

  it('buyMoreAvailable is true for paid plans', () => {
    const result = checkUsageWithCreditsPure('starter', 'ai_request', 50, 0, 1);
    expect(result.buyMoreAvailable).toBe(true);
  });

  it('buyMoreAvailable is false for free plan', () => {
    const result = checkUsageWithCreditsPure('free', 'ai_request', 0, 0, 1);
    expect(result.buyMoreAvailable).toBe(false);
  });
});
