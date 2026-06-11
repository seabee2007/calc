#!/usr/bin/env node
/**
 * End-to-end Adobe rejected-row recovery workflow:
 * 1) recovery report + review-fixed suggestions
 * 2) re-import with review-fixed overlays
 * 3) regenerate source + canonical libraries
 * 4) production build
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  run('npm', ['run', 'generate:adobe-rejected-recovery', '--', '--write-review-fixed']);
  run('npm', ['run', 'import:adobe-production-rates']);
  run('npm', ['run', 'validate:production-rates', '--', '--all-stages']);
  run('npm', ['run', 'generate:production-rates']);
  run('npm', ['run', 'generate:canonical-production-rates']);
  run('npm', ['run', 'build']);
}

main();
