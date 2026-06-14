import { describe, expect, it } from 'vitest';
import {
  CALCULATOR_HELP_SECTIONS,
  helpContentContainsProtectedBranding,
  type CalculatorHelpSection,
} from '../constructionCalculatorHelpContent';

function section(id: string): CalculatorHelpSection {
  const found = CALCULATOR_HELP_SECTIONS.find((s) => s.id === id);
  expect(found, `expected help section "${id}" to exist`).toBeDefined();
  return found as CalculatorHelpSection;
}

function blob(s: CalculatorHelpSection): string {
  return JSON.stringify(s);
}

describe('constructionCalculatorHelpContent', () => {
  it('includes all required section ids', () => {
    const ids = CALCULATOR_HELP_SECTIONS.map((s) => s.id);
    expect(ids).toContain('core-dimension-math');
    expect(ids).toContain('unit-conversions');
    expect(ids).toContain('area');
    expect(ids).toContain('volume');
    expect(ids).toContain('board-feet');
    expect(ids).toContain('concrete-volume');
    expect(ids).toContain('blocks-masonry');
    expect(ids).toContain('drywall-sheet-goods');
    expect(ids).toContain('stairs');
    expect(ids).toContain('right-triangle-pitch');
    expect(ids).toContain('circle');
    expect(ids).toContain('cylinder-column-volume');
    expect(ids).toContain('cone-volume');
    expect(ids).toContain('cost-per-unit');
  });

  it('does not contain protected product branding', () => {
    expect(helpContentContainsProtectedBranding()).toEqual([]);
  });

  it('documents Blocks / CMU / Masonry with a block count formula', () => {
    const s = section('blocks-masonry');
    expect(s.title).toBe('Blocks / CMU / Masonry');
    expect(blob(s)).toContain('Base block count = wall area ÷ block face area');
    expect(blob(s)).toMatch(/ceiling\(base block count/);
  });

  it('documents Drywall / Sheet Goods with a sheet count formula', () => {
    const s = section('drywall-sheet-goods');
    expect(s.title).toBe('Drywall / Sheet Goods');
    expect(blob(s)).toContain('Base sheet count = total area ÷ sheet area');
    expect(blob(s)).toMatch(/ceiling\(base sheet count/);
  });

  it('documents Concrete Volume with a cubic yard formula', () => {
    const s = section('concrete-volume');
    expect(blob(s)).toContain('Volume CY = length(ft) × width(ft) × depth(ft) ÷ 27');
  });

  it('documents Board Feet with the board feet formula', () => {
    const s = section('board-feet');
    expect(blob(s)).toContain('Board feet = thickness(in) × width(in) × length(ft) ÷ 12');
  });

  it('documents Stairs with riser/tread formulas and a code warning', () => {
    const s = section('stairs');
    expect(blob(s)).toContain('Actual riser height = total rise ÷ number of risers');
    expect(blob(s)).toContain('Treads = risers − 1');
    expect(s.notes?.some((n) => /local building code/i.test(n))).toBe(true);
  });

  it('documents Cylinder / Column Volume', () => {
    const s = section('cylinder-column-volume');
    expect(s.title).toBe('Cylinder / Column Volume');
    expect(blob(s)).toContain('Volume = π × radius² × height');
  });

  it('documents Cone Volume', () => {
    const s = section('cone-volume');
    expect(s.title).toBe('Cone Volume');
    expect(blob(s)).toContain('Volume = (π × radius² × height) ÷ 3');
  });
});
