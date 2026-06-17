import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOnboardingDraftKey,
  getOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
  mergeOnboardingDraftValues,
  isValidOnboardingStep,
  type OnboardingDraft,
} from '../onboardingDraft';

const USER_ID = 'user-abc-123';
const KEY = getOnboardingDraftKey(USER_ID);

const baseDraft: Omit<OnboardingDraft, 'updatedAt'> = {
  schemaVersion: 1,
  userId: USER_ID,
  currentStep: 'company-name',
  completedSteps: ['welcome'],
  values: {
    companyName: 'Acme Construction',
    email: 'acme@example.com',
    phone: '(555) 123-4567',
    address: '119 Grand Rock Road||Santa Rita|GU|96915',
  },
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ── Key helpers ───────────────────────────────────────────────────────────────

describe('getOnboardingDraftKey', () => {
  it('returns a user-specific key', () => {
    expect(getOnboardingDraftKey('u1')).toBe('arden:onboarding:draft:u1');
    expect(getOnboardingDraftKey('u2')).toBe('arden:onboarding:draft:u2');
  });
});

// ── isValidOnboardingStep ─────────────────────────────────────────────────────

describe('isValidOnboardingStep', () => {
  it('accepts all valid steps', () => {
    const valid = ['welcome', 'company-name', 'email', 'phone', 'address', 'license', 'motto', 'theme'];
    for (const step of valid) {
      expect(isValidOnboardingStep(step)).toBe(true);
    }
  });

  it('rejects invalid values', () => {
    expect(isValidOnboardingStep('unknown')).toBe(false);
    expect(isValidOnboardingStep(null)).toBe(false);
    expect(isValidOnboardingStep(undefined)).toBe(false);
    expect(isValidOnboardingStep(42)).toBe(false);
  });
});

// ── saveOnboardingDraft / getOnboardingDraft ──────────────────────────────────

describe('saveOnboardingDraft + getOnboardingDraft', () => {
  it('persists and retrieves a draft', () => {
    saveOnboardingDraft(USER_ID, baseDraft);
    const retrieved = getOnboardingDraft(USER_ID);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.currentStep).toBe('company-name');
    expect(retrieved?.values.companyName).toBe('Acme Construction');
    expect(retrieved?.values.address).toBe('119 Grand Rock Road||Santa Rita|GU|96915');
  });

  it('sets updatedAt automatically', () => {
    saveOnboardingDraft(USER_ID, baseDraft);
    const retrieved = getOnboardingDraft(USER_ID);
    expect(retrieved?.updatedAt).toBeTruthy();
    expect(new Date(retrieved!.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it('returns null when no draft exists', () => {
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });

  it('returns null for a different userId', () => {
    saveOnboardingDraft(USER_ID, baseDraft);
    expect(getOnboardingDraft('other-user')).toBeNull();
  });

  it('rejects drafts with mismatched userId', () => {
    const corrupt = { ...baseDraft, userId: 'someone-else' };
    localStorage.setItem(KEY, JSON.stringify({ ...corrupt, updatedAt: new Date().toISOString() }));
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });

  it('rejects drafts with wrong schemaVersion', () => {
    const corrupt = { ...baseDraft, schemaVersion: 2 };
    localStorage.setItem(KEY, JSON.stringify({ ...corrupt, updatedAt: new Date().toISOString() }));
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });

  it('rejects drafts with invalid step', () => {
    const corrupt = { ...baseDraft, currentStep: 'not-a-step' };
    localStorage.setItem(KEY, JSON.stringify({ ...corrupt, updatedAt: new Date().toISOString() }));
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(KEY, 'not-valid-json{{');
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });
});

// ── clearOnboardingDraft ──────────────────────────────────────────────────────

describe('clearOnboardingDraft', () => {
  it('removes the draft from localStorage', () => {
    saveOnboardingDraft(USER_ID, baseDraft);
    expect(getOnboardingDraft(USER_ID)).not.toBeNull();
    clearOnboardingDraft(USER_ID);
    expect(getOnboardingDraft(USER_ID)).toBeNull();
  });

  it('does nothing when no draft exists (no throw)', () => {
    expect(() => clearOnboardingDraft(USER_ID)).not.toThrow();
  });

  it('only clears the specific user draft', () => {
    saveOnboardingDraft(USER_ID, baseDraft);
    saveOnboardingDraft('other-user', { ...baseDraft, userId: 'other-user' });
    clearOnboardingDraft(USER_ID);
    expect(getOnboardingDraft(USER_ID)).toBeNull();
    expect(getOnboardingDraft('other-user')).not.toBeNull();
  });
});

// ── mergeOnboardingDraftValues ────────────────────────────────────────────────

describe('mergeOnboardingDraftValues', () => {
  const server = {
    companyName: 'Server Co',
    email: 'server@example.com',
    phone: '',
    address: '',
    licenseNumber: '',
    motto: '',
    theme: 'dark',
  };

  it('draft values override server values', () => {
    const result = mergeOnboardingDraftValues(server, {
      companyName: 'Typed Co',
      email: 'typed@example.com',
    });
    expect(result.companyName).toBe('Typed Co');
    expect(result.email).toBe('typed@example.com');
  });

  it('server values fill in fields not in the draft', () => {
    const result = mergeOnboardingDraftValues(server, { companyName: 'Typed Co' });
    expect(result.email).toBe('server@example.com');
    expect(result.theme).toBe('dark');
  });

  it('empty string in draft still overrides (allows clearing a field)', () => {
    const result = mergeOnboardingDraftValues(server, { companyName: '' });
    // empty string is falsy but undefined check (??), so '' overrides
    expect(result.companyName).toBe('');
  });

  it('undefined draft field falls back to server', () => {
    const result = mergeOnboardingDraftValues(server, {});
    expect(result.companyName).toBe('Server Co');
  });
});
