import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('fetchProjectClientEmail', () => {
  const source = readSource('src/services/projectClientEmailService.ts');

  it('selects client_info only from projects', () => {
    expect(source).toContain(".select('client_info')");
    expect(source).not.toContain('client_portal_access');
  });

  it('returns empty string when client_info column is missing', () => {
    expect(source).toContain('isClientInfoColumnError');
    expect(source).toContain("return ''");
  });
});
