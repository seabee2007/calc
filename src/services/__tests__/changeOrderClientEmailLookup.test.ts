import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('change order client email lookup', () => {
  it('does not query client_portal_access from changeOrderService', () => {
    const source = readSource('src/services/changeOrderService.ts');
    expect(source).not.toContain('client_portal_access');
    expect(source).not.toContain('fetchProjectClientEmail');
  });

  it('loads client email through projectClientEmailService in builder page', () => {
    const source = readSource('src/pages/planner/ChangeOrderBuilderPage.tsx');
    expect(source).toContain("from '../../services/projectClientEmailService'");
    expect(source).not.toContain('client_portal_access');
  });
});
