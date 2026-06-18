import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Settings.tsx'),
  'utf8',
);

const proposalsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Proposals.tsx'),
  'utf8',
);

const collapsibleSource = readFileSync(
  resolve(process.cwd(), 'src/components/settings/SettingsCollapsibleSection.tsx'),
  'utf8',
);

describe('Settings page layout', () => {
  it('uses the shared AppPage container like Proposal Pipeline', () => {
    expect(settingsSource).toContain('<AppPage');
    expect(settingsSource).toContain('data-testid="settings-page"');
    expect(settingsSource).toContain('className="w-full !max-w-none pt-6"');
    expect(settingsSource).not.toContain('PREMIUM_PAGE_MAX_WIDTH');
  });

  it('uses PageHeader with the same typography pattern as Proposal Pipeline', () => {
    expect(settingsSource).toContain('PageHeader');
    expect(settingsSource).toContain('title="Settings"');
    expect(settingsSource).toContain(
      'subtitle="Customize your account and application preferences."',
    );
    expect(settingsSource).toContain(
      '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300',
    );
    expect(proposalsSource).toContain(
      '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300',
    );
    expect(settingsSource).not.toContain('CC_PAGE_HERO_TITLE');
  });

  it('declares expandedSections state for collapsible sections', () => {
    expect(settingsSource).toContain('const [expandedSections, setExpandedSections]');
    expect(settingsSource).toContain('readExpandedSettingsSections()');
  });

  it('uses collapsible settings sections collapsed by default', () => {
    expect(settingsSource).toContain('SettingsCollapsibleSection');
    expect(settingsSource).toContain('readExpandedSettingsSections');
    expect(collapsibleSource).toContain('settings_expanded_sections');
  });
});
