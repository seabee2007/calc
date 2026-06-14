import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Projects/Projects.tsx'),
  'utf8',
);

const projectListSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Projects/ProjectList.tsx'),
  'utf8',
);

const settingsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Settings.tsx'),
  'utf8',
);

const layoutSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/Layout.tsx'),
  'utf8',
);

describe('Projects page layout', () => {
  it('uses the shared AppPage container like Settings', () => {
    expect(projectsSource).toContain('<AppPage');
    expect(projectsSource).toContain('data-testid="projects-page"');
    expect(projectsSource).toContain('className="w-full max-w-full overflow-x-hidden !max-w-none pb-28 pt-6 md:pb-8"');
    expect(projectsSource).not.toContain('PREMIUM_PAGE_MAX_WIDTH');
    expect(settingsSource).toContain('className="w-full !max-w-none pt-6"');
  });

  it('uses PageHeader with the same typography pattern as Settings', () => {
    expect(projectsSource).toContain('PageHeader');
    expect(projectsSource).toContain('title="Projects"');
    expect(projectsSource).toContain(
      'subtitle="Track active jobs, next actions, readiness, and financials."',
    );
    expect(projectsSource).toContain(
      '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300',
    );
    expect(projectsSource).not.toContain('CC_PAGE_HERO_TITLE');
    expect(settingsSource).toContain(
      '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300',
    );
  });

  it('uses a two-column project grid within the shared container', () => {
    expect(projectListSource).toContain('grid w-full max-w-full grid-cols-1 gap-4 lg:grid-cols-2');
    expect(projectListSource).not.toContain('lg:grid-cols-3');
  });
});

describe('Projects authenticated shell', () => {
  it('hides the marketing footer on premium canvas app routes', () => {
    expect(layoutSource).toContain('const hideMarketingFooter = Boolean(user) && premiumCanvas');
  });
});
