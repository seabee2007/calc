import { describe, expect, it } from 'vitest';
import {
  isPublicLegalPath,
  usesPublicMarketingShell,
} from './publicMarketingRoutes';

describe('publicMarketingRoutes', () => {
  it('identifies public legal paths', () => {
    expect(isPublicLegalPath('/privacy-policy')).toBe(true);
    expect(isPublicLegalPath('/privacy')).toBe(true);
    expect(isPublicLegalPath('/terms')).toBe(true);
    expect(isPublicLegalPath('/contact')).toBe(true);
    expect(isPublicLegalPath('/projects')).toBe(false);
  });

  it('uses the marketing shell for logged-out home and public legal pages', () => {
    expect(usesPublicMarketingShell('/', true)).toBe(true);
    expect(usesPublicMarketingShell('/', false)).toBe(false);
    expect(usesPublicMarketingShell('/privacy-policy', false)).toBe(true);
    expect(usesPublicMarketingShell('/settings', false)).toBe(false);
  });
});
