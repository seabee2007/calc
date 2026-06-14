import { describe, expect, it } from 'vitest';
import { resolveScopeActivityDivisionCode } from './scopeActivityDivisionClassifier';

describe('resolveScopeActivityDivisionCode', () => {
  it('maps excavation activities to Division 31 Earthwork', () => {
    expect(resolveScopeActivityDivisionCode('Excavate for Foundation', '03')).toBe('31');
    expect(resolveScopeActivityDivisionCode('Foundation Excavation', '03')).toBe('31');
    expect(resolveScopeActivityDivisionCode('Footing Excavation', '03')).toBe('31');
    expect(resolveScopeActivityDivisionCode('Site Grading and Excavation', '03')).toBe('31');
    expect(resolveScopeActivityDivisionCode('Trenching and Backfill', '01')).toBe('31');
  });

  it('maps concrete placement activities to Division 03 Concrete', () => {
    expect(resolveScopeActivityDivisionCode('Place Footing Concrete', '31')).toBe('03');
    expect(resolveScopeActivityDivisionCode('Slab on Grade Concrete', '31')).toBe('03');
    expect(resolveScopeActivityDivisionCode('Reinforcement and Formwork', '31')).toBe('03');
    expect(resolveScopeActivityDivisionCode('Continuous Footings', '31')).toBe('03');
  });

  it('does not map bare foundation wording to Division 03 when proposed differently', () => {
    expect(resolveScopeActivityDivisionCode('Foundation Work Package', '31')).toBe('31');
  });

  it('preserves non earthwork/concrete divisions', () => {
    expect(resolveScopeActivityDivisionCode('Electrical Rough-In', '26')).toBe('26');
    expect(resolveScopeActivityDivisionCode('Drywall and Finishes', '09')).toBe('09');
  });
});
