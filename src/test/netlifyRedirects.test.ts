import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('Netlify redirects', () => {
  it('returns 404 for missing hashed asset paths instead of index.html', () => {
    const redirects = readFileSync('public/_redirects', 'utf8');
    expect(redirects).toMatch(/\/assets\/\*[^\n]*404/);
    expect(redirects).toMatch(/\/index\.html[^\n]*200/);
  });
});
