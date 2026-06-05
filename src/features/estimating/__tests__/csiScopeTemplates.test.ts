import { describe, expect, it } from 'vitest';
import {
  CUSTOM_UNASSIGNED_SCOPE_LABEL,
  getDefaultScopeForDivision,
  getScopeTemplateOptions,
  getScopeTemplatesForDivision,
  isKnownScopeTemplate,
  normalizeScopeName,
} from '../domain/csiScopeTemplates';

describe('csiScopeTemplates', () => {
  it('returns concrete scopes for division 03', () => {
    const scopes = getScopeTemplatesForDivision('03');
    const names = scopes.map((scope) => scope.scopeName);

    expect(names).toContain('Cast-in-Place Concrete');
    expect(names).toContain('Concrete Reinforcement');
    expect(names).toContain('Slab on Grade');
    expect(scopes.every((scope) => scope.divisionCode === '03')).toBe(true);
    expect(scopes.every((scope) => scope.label === scope.scopeName)).toBe(true);
  });

  it('returns earthwork scopes for division 31', () => {
    const names = getScopeTemplateOptions('31').map((scope) => scope.scopeName);

    expect(names).toEqual([
      'Clearing and Grubbing',
      'Excavation',
      'Grading',
      'Trenching',
      'Backfill',
      'Compaction',
      'Hauling',
    ]);
  });

  it('returns an empty array for unknown divisions', () => {
    expect(getScopeTemplatesForDivision('99')).toEqual([]);
    expect(getScopeTemplateOptions('CUSTOM')).toEqual([]);
    expect(getScopeTemplateOptions('')).toEqual([]);
  });

  it('returns a safe concrete default for division 03', () => {
    expect(getDefaultScopeForDivision('03')).toBe('Cast-in-Place Concrete');
    expect(getDefaultScopeForDivision('3')).toBe('Cast-in-Place Concrete');
    expect(getDefaultScopeForDivision('99')).toBe('');
  });

  it('handles custom scope values without crashing', () => {
    expect(normalizeScopeName('  Custom   Scope  ')).toBe('Custom Scope');
    expect(isKnownScopeTemplate('03', 'My Custom Pour')).toBe(false);
    expect(isKnownScopeTemplate('03', 'Cast-in-Place Concrete')).toBe(true);
    expect(isKnownScopeTemplate('03', ' cast-in-place concrete ')).toBe(true);
    expect(isKnownScopeTemplate('99', 'Anything')).toBe(false);
    expect(normalizeScopeName(null)).toBe('');
    expect(CUSTOM_UNASSIGNED_SCOPE_LABEL).toBeTruthy();
  });

  it('returns scope options in catalog definition order', () => {
    const electrical = getScopeTemplateOptions('26').map((scope) => scope.scopeName);
    expect(electrical[0]).toBe('Electrical Service');
    expect(electrical[electrical.length - 1]).toBe('Conduit and Wiring');

    const plumbing = getScopeTemplateOptions('22').map((scope) => scope.scopeName);
    expect(plumbing).toEqual([
      'Domestic Water',
      'Sanitary Waste',
      'Storm Drainage',
      'Plumbing Fixtures',
      'Water Heaters',
    ]);
  });
});
