import { defineConfig, devices } from '@playwright/test';
import { requireAppUrl } from './tests/e2e/helpers/qaEnv';

const baseURL = requireAppUrl();

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa-reports/tier-gates/latest.json' }],
  ],
  outputDir: 'qa-reports/tier-gates/test-results',
  use: {
    baseURL,
    headless: process.env.PW_HEADLESS === 'true',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'tier-gates',
      testMatch: /tier-gates\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
});
