import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { NavigateFunction } from 'react-router-dom';
import {
  BRAND_NAME,
  BRAND_SHORT_NAME,
  SUPPORT_EMAIL,
  getAppLoginUrl,
  getAppSignupUrl,
  getAppUrl,
  goToAppAuth,
  isMarketingHost,
} from './brand';

describe('brand config', () => {
  it('exports Arden brand name', () => {
    expect(BRAND_NAME).toBe('Arden Project OS');
    expect(BRAND_SHORT_NAME).toBe('Arden');
    expect(SUPPORT_EMAIL).toBe('support@ardenprojectos.com');
  });

  it('builds app auth URLs', () => {
    expect(getAppLoginUrl()).toBe('https://app.ardenprojectos.com/login');
    expect(getAppSignupUrl()).toBe('https://app.ardenprojectos.com/signup');
    expect(getAppUrl('/projects')).toBe('https://app.ardenprojectos.com/projects');
  });

  it('detects marketing hosts', () => {
    expect(isMarketingHost('ardenprojectos.com')).toBe(true);
    expect(isMarketingHost('www.ardenprojectos.com')).toBe(true);
    expect(isMarketingHost('concrete-calc.com')).toBe(true);
    expect(isMarketingHost('app.ardenprojectos.com')).toBe(false);
    expect(isMarketingHost('localhost')).toBe(false);
  });

  describe('goToAppAuth', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('redirects auth navigation to the app host from marketing', () => {
      const assign = vi.fn();
      const navigate = vi.fn() as NavigateFunction;

      vi.stubGlobal('window', {
        location: { hostname: 'ardenprojectos.com', assign },
      });

      goToAppAuth('/login', navigate);
      expect(assign).toHaveBeenCalledWith('https://app.ardenprojectos.com/login');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('uses SPA navigation on the app host', () => {
      const assign = vi.fn();
      const navigate = vi.fn() as NavigateFunction;

      vi.stubGlobal('window', {
        location: { hostname: 'app.ardenprojectos.com', assign },
      });

      goToAppAuth('/signup', navigate);
      expect(assign).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/signup');
    });
  });
});
