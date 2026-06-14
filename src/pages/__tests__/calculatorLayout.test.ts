import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync(
  resolve(process.cwd(), 'src/components/calculators/ProjectCalculatorShell.tsx'),
  'utf8',
);
const hubSource = readFileSync(
  resolve(process.cwd(), 'src/pages/CalculatorHub.tsx'),
  'utf8',
);
const proposalsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Proposals.tsx'),
  'utf8',
);

describe('calculator page layout', () => {
  it('uses AppPage and PageHeader like Proposal Pipeline', () => {
    expect(shellSource).toContain('AppPage');
    expect(shellSource).toContain('PageHeader');
    expect(shellSource).toContain('className="w-full !max-w-none pt-6"');
    expect(shellSource).not.toContain('PREMIUM_PAGE_MAX_WIDTH');
    expect(proposalsSource).toContain('className="w-full !max-w-none pt-6"');
  });

  it('splits helper and legacy tools on the hub', () => {
    expect(hubSource).toContain('HELPER_CALCULATORS');
    expect(hubSource).toContain('LEGACY_CALCULATORS');
    expect(hubSource).toContain('Legacy tools');
    expect(hubSource).toContain('General Trade Labor Calculator');
    expect(hubSource).toContain('Custom Estimate');
  });

  it('shows estimate workspace guidance on helper tools', () => {
    expect(shellSource).toContain('CalculatorToolNotice');
    expect(shellSource).toContain("toolKind = 'helper'");
  });
});
