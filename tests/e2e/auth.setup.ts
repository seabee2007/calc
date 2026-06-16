import { test as setup } from '@playwright/test';
import { loginAndSaveStorageState } from './helpers/auth';
import { attachPageDiagnostics } from './helpers/pageDiagnostics';
import { requireAppUrl } from './helpers/qaEnv';
import { qaLogAlways, qaStep } from './helpers/qaLog';
import { AUTH_USERS } from './helpers/tierGateFixtures';

setup.describe.configure({ mode: 'serial' });

setup.beforeAll(() => {
  qaStep('Auth setup: logging in each QA tier once and saving browser storageState files');
  qaLogAlways(`APP_URL=${requireAppUrl()}`);
  qaStep('Output directory: tests/e2e/.auth/{free,starter,professional,business,pastdue,canceled}.json');
});

for (const user of AUTH_USERS) {
  setup(`authenticate ${user.plan} (${user.email})`, async ({ page }) => {
    attachPageDiagnostics(page);
    await loginAndSaveStorageState(page, {
      tier: user.plan,
      email: user.email,
    });
  });
}
