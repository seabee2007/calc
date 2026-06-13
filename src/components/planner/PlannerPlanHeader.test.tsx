import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const headerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'PlannerPlanHeader.tsx'),
  'utf8',
);

describe('PlannerPlanHeader actions menu layering', () => {
  it('renders the overflow menu in a body portal above tab content', () => {
    expect(headerSource).toContain('createPortal(planActionsMenu, document.body)');
    expect(headerSource).toContain('fixed z-[1000]');
    expect(headerSource).not.toContain('absolute right-0 top-full');
  });
});
