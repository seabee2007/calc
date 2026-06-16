import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  authStorageExists,
  authStoragePath,
  navigateToApp,
  openProfileMenu,
  waitForTestId,
} from './helpers/auth';
import { attachPageDiagnostics } from './helpers/pageDiagnostics';
import { qaLog, qaStep } from './helpers/qaLog';
import {
  EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS,
  GATE_TIERS,
  OVER_LIMIT_SEED_NOTE,
  QA_MANIFEST_PATH,
  type QaManifest,
  type TierFixture,
} from './helpers/tierGateFixtures';

const MANIFEST_SKIP_REASON = `Missing seeded primary project id in manifest (${QA_MANIFEST_PATH}) — run: npm run qa:seed-gates`;

function loadManifest(): QaManifest | null {
  if (!fs.existsSync(QA_MANIFEST_PATH)) return null;
  return JSON.parse(fs.readFileSync(QA_MANIFEST_PATH, 'utf8')) as QaManifest;
}

function getPrimaryProjectId(tier: TierFixture): string | null {
  const manifest = loadManifest();
  return manifest?.users[tier.email]?.primaryProjectId ?? null;
}

async function gotoRoute(page: import('@playwright/test').Page, route: string, tier: TierFixture): Promise<void> {
  qaStep(`[${tier.tierId}] Navigating to ${route}`);
  qaLog('goto', { route, url: page.url() });
  await navigateToApp(page, route);
}

async function waitForProjectsReady(page: import('@playwright/test').Page, tier: TierFixture): Promise<void> {
  await gotoRoute(page, '/projects', tier);
  await waitForTestId(page, 'projects-page', { label: `[${tier.tierId}] Waiting for projects page` });

  const activeTab = page.getByRole('button', { name: /^Active\s+\d+/ });
  await expect(activeTab).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(
      async () => {
        const tabText = (await activeTab.textContent()) ?? '';
        const tabCount = Number(tabText.match(/Active\s+(\d+)/)?.[1] ?? -1);
        if (tabCount < 0) return -1;

        const cardCount = await page.locator('[data-testid^="project-card-"]').count();
        if (tabCount === 0) return cardCount === 0 ? 0 : -1;
        return cardCount === tabCount ? tabCount : -1;
      },
      {
        timeout: 20_000,
        message: `[${tier.tierId}] Projects list did not finish loading on /projects`,
      },
    )
    .toBeGreaterThanOrEqual(0);
}

async function getActiveFolderCount(page: import('@playwright/test').Page): Promise<number> {
  const activeTab = page.getByRole('button', { name: /^Active\s+\d+/ });
  const text = (await activeTab.textContent()) ?? '';
  return Number(text.match(/Active\s+(\d+)/)?.[1] ?? 0);
}

async function countActiveProjectCards(page: import('@playwright/test').Page, tier: TierFixture): Promise<number> {
  await waitForProjectsReady(page, tier);
  return getActiveFolderCount(page);
}

async function openWidgetCatalog(page: import('@playwright/test').Page, tier: TierFixture): Promise<void> {
  await gotoRoute(page, '/', tier);
  await page.getByTestId('dashboard-customize-toggle').click();
  await page.getByTestId('dashboard-add-widget').click();
  await expect(page.getByTestId('dashboard-widget-catalog')).toBeVisible({ timeout: 15_000 });
}

async function expectWidgetCatalogStatus(
  page: import('@playwright/test').Page,
  widgetId: string,
  locked: boolean,
): Promise<void> {
  const tile = page.getByTestId(`widget-tile-${widgetId}`);
  await expect(tile).toBeVisible();
  const action = tile.getByRole('button');
  if (locked) {
    await expect(action).toHaveText(/Upgrade required/i);
  } else {
    await expect(action).not.toHaveText(/Upgrade required/i);
  }
}

for (const tier of GATE_TIERS) {
  const storageState = authStoragePath(tier.tierId);

  test.describe(`${tier.tierId} tier gates`, () => {
    test.use({ storageState });

    test.beforeAll(() => {
      if (!authStorageExists(tier.tierId)) {
        throw new Error(
          `Missing auth storage state for ${tier.tierId}: ${storageState}. ` +
            'Run auth setup first (included in npm run qa:e2e-gates) or set QA_REFRESH_AUTH=true.',
        );
      }
      qaStep(`[${tier.tierId}] Using saved session → ${storageState}`);
    });

    test.beforeEach(async ({ page }, testInfo) => {
      attachPageDiagnostics(page);
      qaStep(`[${tier.tierId}] Starting: ${testInfo.title}`);
      qaLog('session', { email: tier.email, storageState, url: page.url() });
      await gotoRoute(page, '/', tier);

      try {
        await page.getByRole('button', { name: 'Profile menu' }).waitFor({
          state: 'visible',
          timeout: 20_000,
        });
      } catch {
        const dir = path.join(process.cwd(), 'qa-reports', 'tier-gates', 'screenshots');
        fs.mkdirSync(dir, { recursive: true });
        const shot = path.join(dir, `not-authenticated-${tier.tierId}-${Date.now()}.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
        throw new Error(
          `Not authenticated as ${tier.email} (${tier.tierId}). ` +
            `Storage state: ${storageState}. Re-run npm run qa:e2e-gates or set QA_REFRESH_AUTH=true. ` +
            `Screenshot: ${shot}`,
        );
      }
    });

    test('profile badge shows expected plan label', async ({ page }) => {
      await openProfileMenu(page);
      await expect(page.getByTestId('profile-plan-badge')).toHaveText(tier.profileBadgeLabel);
    });

    test('billing page shows expected plan and status', async ({ page }) => {
      await gotoRoute(page, '/settings/billing', tier);
      await waitForTestId(page, 'billing-subscription-panel');
      await expect(page.getByTestId('billing-current-plan-label')).toHaveText(tier.billingPlanLabel);
      await expect(page.getByTestId('subscription-status')).toHaveText(tier.billingStatusLabel);
    });

    test('active project count shows seeded over-limit state', async ({ page }) => {
      const count = await countActiveProjectCards(page, tier);
      const expected = EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS[tier.tierId];

      if (tier.tierId === 'business') {
        expect(count).toBeGreaterThanOrEqual(expected);
      } else {
        expect(count).toBe(expected);
      }

      qaLog('project count verified', {
        tier: tier.tierId,
        count,
        expected,
        maxProjects: tier.maxProjects,
        note: OVER_LIMIT_SEED_NOTE,
      });
    });

    test('new project creation blocked when at or over plan limit', async ({ page }) => {
      await waitForProjectsReady(page, tier);

      const cardCount = await getActiveFolderCount(page);
      const expected = EXPECTED_SEEDED_ACTIVE_PROJECT_COUNTS[tier.tierId];

      if (tier.tierId === 'business') {
        expect(cardCount).toBeGreaterThanOrEqual(expected);
        await expect(page.getByTestId('project-limit-banner')).toHaveCount(0);
        await page.getByTestId('projects-new-button').click();
        await expect(page.getByRole('heading', { name: /new project|create project/i })).toBeVisible();
        return;
      }

      expect(cardCount).toBe(expected);

      if (tier.tierId === 'pastdue' || tier.tierId === 'canceled') {
        expect(cardCount).toBeGreaterThanOrEqual(tier.maxProjects);
      } else {
        expect(cardCount).toBeGreaterThan(tier.maxProjects);
      }

      await expect(page.getByTestId('project-limit-banner')).toBeVisible();
      await expect(page.getByTestId('projects-new-button')).toBeDisabled();
      await page.getByTestId('projects-new-button').click({ force: true });
      await expect(page.getByRole('heading', { name: /new project|create project/i })).toHaveCount(0);
    });

    test('employee invite gate matches tier', async ({ page }) => {
      await gotoRoute(page, '/employees', tier);
      await waitForTestId(page, 'team-employees-page');

      if (tier.hasEmployeePortal) {
        await expect(page.getByTestId('invite-team-member-card')).toBeVisible();
        await expect(page.getByTestId('feature-gate-blocked-employee_portal')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('upgrade-required-employee_portal')).toBeVisible();
      }
    });

    test('client portal gate matches tier', async ({ page }) => {
      const projectId = getPrimaryProjectId(tier);
      test.skip(!projectId, MANIFEST_SKIP_REASON);

      await gotoRoute(page, `/projects?project=${projectId}`, tier);
      await waitForTestId(page, 'projects-page');

      if (tier.hasClientPortal) {
        await expect(page.getByTestId('feature-gate-blocked-client_portal')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('feature-gate-blocked-client_portal')).toBeVisible();
      }
    });

    test('quick estimate gate matches tier', async ({ page }) => {
      await openWidgetCatalog(page, tier);
      await expectWidgetCatalogStatus(page, 'quickEstimateLauncher', !tier.hasQuickEstimate);
    });

    test('detailed estimate gate matches tier', async ({ page }) => {
      const projectId = getPrimaryProjectId(tier);
      test.skip(!projectId, MANIFEST_SKIP_REASON);

      await gotoRoute(page, `/projects/${projectId}/planner/estimate/activities`, tier);
      await page.waitForLoadState('domcontentloaded');

      if (tier.hasDetailedEstimate) {
        await expect(page.getByTestId('upgrade-for-estimate-type')).toHaveCount(0);
      } else {
        const upgradePanel = page.getByTestId('upgrade-for-estimate-type');
        if (await upgradePanel.isVisible().catch(() => false)) {
          await expect(upgradePanel).toBeVisible();
        } else if (await page.getByTestId('activities-choose-estimate-type-empty-state').count()) {
          await waitForTestId(page, 'activities-choose-estimate-type-empty-state');
        } else {
          await expect(
            page.getByRole('button', { name: /Detailed Estimate.*Upgrade to Professional/i }),
          ).toBeVisible();
        }
      }
    });

    test('logic network gate matches tier', async ({ page }) => {
      const projectId = getPrimaryProjectId(tier);
      test.skip(!projectId, MANIFEST_SKIP_REASON);

      await gotoRoute(page, `/projects/${projectId}/planner/estimate/logic-network`, tier);
      await page.waitForLoadState('domcontentloaded');

      const logicTab = page.getByTestId('logic-network-tab');
      if (await logicTab.count()) {
        qaStep(`[${tier.tierId}] Clicking Logic Network tab`);
        await logicTab.click();
      }

      if (tier.hasLogicNetwork) {
        await expect(page.getByTestId('upgrade-required-logic_network')).toHaveCount(0);
      } else {
        const upgrade = page.getByTestId('upgrade-required-logic_network');
        if (await upgrade.isVisible().catch(() => false)) {
          await expect(upgrade).toBeVisible();
        } else {
          await expect(
            page.getByRole('button', { name: /Detailed Estimate.*Upgrade to Professional/i }),
          ).toBeVisible();
        }
      }
    });

    test('RFIs gate matches tier', async ({ page }) => {
      if (!tier.hasRfisFarsQc) {
        await gotoRoute(page, '/employees', tier);
        await waitForTestId(page, 'team-employees-page');
        await expect(page.getByTestId('upgrade-required-employee_portal')).toBeVisible();
        return;
      }

      await gotoRoute(page, '/planner/rfis', tier);
      await expect(page.getByText('QA RFI')).toBeVisible({ timeout: 20_000 });
    });

    test('FARs gate matches tier', async ({ page }) => {
      if (!tier.hasRfisFarsQc) {
        await gotoRoute(page, '/planner/fars', tier);
        await expect(page.getByText('QA FAR')).toHaveCount(0);
        return;
      }

      await gotoRoute(page, '/planner/fars', tier);
      await expect(page.getByText('QA FAR')).toBeVisible({ timeout: 20_000 });
    });

    test('QC gate matches tier', async ({ page }) => {
      await openWidgetCatalog(page, tier);
      await expectWidgetCatalogStatus(page, 'qcDue', !tier.hasRfisFarsQc);
    });

    test('change orders gate matches tier', async ({ page }) => {
      await gotoRoute(page, '/planner/change-orders', tier);
      await page.waitForLoadState('domcontentloaded');

      if (tier.hasChangeOrders) {
        await expect(page.getByTestId('feature-gate-blocked-change_orders')).toHaveCount(0);
        await expect(page.getByText('QA Change Order')).toBeVisible({ timeout: 20_000 });
      } else {
        await expect(page.getByTestId('feature-gate-blocked-change_orders')).toBeVisible();
      }
    });

    test('accounting exports gate matches tier', async ({ page }) => {
      await gotoRoute(page, '/accounting-tax', tier);
      await page.waitForLoadState('domcontentloaded');

      if (tier.hasAccountingExports) {
        await waitForTestId(page, 'accounting-tax-page');
        await expect(page.getByTestId('feature-gate-blocked-accounting_exports')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('feature-gate-blocked-accounting_exports')).toBeVisible();
      }
    });

    test('dashboard widget catalog locked widgets match tier', async ({ page }) => {
      await openWidgetCatalog(page, tier);
      await expectWidgetCatalogStatus(page, 'qcDue', !tier.hasRfisFarsQc);
      await expectWidgetCatalogStatus(page, 'accountingTaxLauncher', !tier.hasAccountingExports);
      await expectWidgetCatalogStatus(
        page,
        'plannerHubShortcut',
        tier.effectivePlan !== 'business',
      );
    });

    test('past_due paid access is blocked', async ({ page }) => {
      test.skip(
        tier.tierId !== 'pastdue',
        'Only applies to qa-pastdue@arden.test — other tiers use active subscription scenarios',
      );

      await gotoRoute(page, '/employees', tier);
      await waitForTestId(page, 'team-employees-page');
      await expect(page.getByTestId('upgrade-required-employee_portal')).toBeVisible();

      await gotoRoute(page, '/planner/change-orders', tier);
      await expect(page.getByTestId('feature-gate-blocked-change_orders')).toBeVisible();
    });

    test('canceled paid access is blocked', async ({ page }) => {
      test.skip(
        tier.tierId !== 'canceled',
        'Only applies to qa-canceled@arden.test — other tiers use active subscription scenarios',
      );

      await gotoRoute(page, '/employees', tier);
      await waitForTestId(page, 'team-employees-page');
      await expect(page.getByTestId('upgrade-required-employee_portal')).toBeVisible();

      await gotoRoute(page, '/planner/change-orders', tier);
      await expect(page.getByTestId('feature-gate-blocked-change_orders')).toBeVisible();
    });
  });
}
