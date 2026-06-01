import { describe, expect, it } from 'vitest';
import { renderTemplate } from './templateRenderer';

describe('renderTemplate', () => {
  it('interpolates scalar tokens', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'Bob' })).toBe('Hello Bob');
  });

  it('resolves nested paths', () => {
    expect(renderTemplate('{{owner.fullName}}', { owner: { fullName: 'Jane' } })).toBe('Jane');
  });

  it('renders missing scalars as visible fill-in markers', () => {
    expect(renderTemplate('Owner: {{owner.fullName}}', {})).toBe('Owner: [owner.fullName]');
  });

  it('formats currency tokens as USD', () => {
    expect(renderTemplate('Price: {{currency pricing.contractPrice}}', {
      pricing: { contractPrice: 1000 },
    })).toBe('Price: $1,000.00');
  });

  it('marks missing currency tokens', () => {
    expect(renderTemplate('{{currency price}}', {})).toBe('[price]');
  });

  it('iterates over arrays in #each blocks', () => {
    const out = renderTemplate('{{#each items}}- {{label}}\n{{/each}}', {
      items: [{ label: 'A' }, { label: 'B' }],
    });
    expect(out).toContain('- A');
    expect(out).toContain('- B');
  });

  it('renders nothing for empty or missing collections', () => {
    expect(renderTemplate('{{#each items}}x{{/each}}', {})).toBe('');
    expect(renderTemplate('{{#each items}}x{{/each}}', { items: [] })).toBe('');
  });

  it('is deterministic for identical input', () => {
    const template = 'Owner {{owner.fullName}} pays {{currency pricing.contractPrice}}';
    const data = { owner: { fullName: 'Jane' }, pricing: { contractPrice: 500 } };
    expect(renderTemplate(template, data)).toBe(renderTemplate(template, data));
  });
});
