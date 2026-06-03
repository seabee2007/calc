import { describe, expect, it } from 'vitest';
import type { CompanySettings } from './companySettingsService';
import { mergeCompanySettingsUpdates } from './companySettingsMerge';

const base: CompanySettings = {
  companyName: 'Acme Concrete',
  address: '100 Main St',
  phone: '(671) 555-1234',
  email: 'office@acme.test',
  licenseNumber: 'GU-123',
  motto: 'Quality pours',
  logoUrl: 'https://example.com/logo.png',
  logoPath: 'user/logo.png',
  taxSystem: 'sales_tax',
  taxRatePercent: 4,
  taxApplication: 'materials_only',
};

describe('mergeCompanySettingsUpdates', () => {
  it('blocks empty strings from overwriting non-empty protected fields by default', () => {
    const merged = mergeCompanySettingsUpdates(
      base,
      {
        companyName: '',
        address: '',
        phone: '',
        email: '',
        licenseNumber: '',
        motto: '',
      },
      { allowEmptyTextOverwrite: false },
    );
    expect(merged.companyName).toBe('Acme Concrete');
    expect(merged.email).toBe('office@acme.test');
  });

  it('allows empty overwrite when explicitly requested', () => {
    const merged = mergeCompanySettingsUpdates(
      base,
      { companyName: '', email: '' },
      { allowEmptyTextOverwrite: true },
    );
    expect(merged.companyName).toBe('');
    expect(merged.email).toBe('');
  });

  it('allows non-empty updates on protected fields', () => {
    const merged = mergeCompanySettingsUpdates(base, { companyName: 'New Co' });
    expect(merged.companyName).toBe('New Co');
  });

  it('allows logo null without affecting text fields', () => {
    const merged = mergeCompanySettingsUpdates(base, {
      logoUrl: null,
      logoPath: null,
    });
    expect(merged.logoUrl).toBeNull();
    expect(merged.logoPath).toBeNull();
    expect(merged.companyName).toBe('Acme Concrete');
  });

  it('updates tax fields normally', () => {
    const merged = mergeCompanySettingsUpdates(base, {
      taxSystem: 'vat',
      taxRatePercent: 10,
    });
    expect(merged.taxSystem).toBe('vat');
    expect(merged.taxRatePercent).toBe(10);
  });
});
