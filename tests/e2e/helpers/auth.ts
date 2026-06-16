import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { manualStep } from './manualStep';
import {
  attachPageDiagnostics,
  assertNotAboutBlank,
  captureScreenshot,
  formatDiagnostics,
  logNavigationState,
  type PageDiagnostics,
} from './pageDiagnostics';
import { buildAppRoute } from './qaEnv';
import { qaLog, qaLogAlways, qaStep } from './qaLog';
import { QA_TEST_PASSWORD } from './tierGateFixtures';

export const AUTH_DIR = path.join(process.cwd(), 'tests', 'e2e', '.auth');

const LOGIN_FORM_TIMEOUT_MS = 15_000;
const APP_READY_TIMEOUT_MS = 60_000;
const NAVIGATION_TIMEOUT_MS = 30_000;

export function authStoragePath(plan: string): string {
  return path.join(AUTH_DIR, `${plan}.json`);
}

export function authStorageExists(plan: string): boolean {
  return fs.existsSync(authStoragePath(plan));
}

function ensureAuthDir(): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export interface LoginContext {
  tier: string;
  email: string;
  password?: string;
}

export interface LoginFormLocators {
  emailInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;
}

export async function captureAuthSetupScreenshot(page: Page, tier: string): Promise<string> {
  const dir = path.join(process.cwd(), 'qa-reports', 'tier-gates');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `auth-setup-${tier}-stuck.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return file;
}

function emailInputLocator(page: Page): Locator {
  return page
    .getByLabel('Email address')
    .or(page.locator('input[type="email"]'))
    .or(page.locator('[name="email"]'))
    .or(page.getByTestId('email-input'))
    .first();
}

function passwordInputLocator(page: Page): Locator {
  return page
    .getByLabel('Password')
    .or(page.locator('input[type="password"]'))
    .or(page.locator('[name="password"]'))
    .or(page.getByTestId('password-input'))
    .first();
}

function submitButtonLocator(page: Page): Locator {
  return page
    .locator('button[type="submit"]')
    .or(page.getByRole('button', { name: /sign in|log in/i }))
    .first();
}

export async function isLoggedInAppShell(page: Page): Promise<boolean> {
  return page.getByRole('button', { name: 'Profile menu' }).isVisible().catch(() => false);
}

export async function navigateToLoginPage(
  page: Page,
  ctx: LoginContext,
  diagnostics?: PageDiagnostics,
): Promise<void> {
  const loginUrl = buildAppRoute('/login');
  qaStep(`Navigating to login: ${loginUrl}`);
  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  await logNavigationState(page);

  if (page.url() === 'about:blank' || page.url().startsWith('about:')) {
    const screenshot = await captureAuthSetupScreenshot(page, ctx.tier);
    throw new Error(
      `Page stayed ${page.url()} after navigating to ${loginUrl}. Screenshot: ${screenshot}`,
    );
  }

  assertNotAboutBlank(page);
  qaLog('login page loaded', { url: page.url(), diagnostics: diagnostics ? 'attached' : 'none' });
}

export async function waitForLoginForm(
  page: Page,
  ctx: LoginContext,
  diagnostics?: PageDiagnostics,
): Promise<LoginFormLocators | null> {
  qaStep(`Waiting for login form or existing session (${ctx.tier}, ${LOGIN_FORM_TIMEOUT_MS / 1000}s max)`);

  const deadline = Date.now() + LOGIN_FORM_TIMEOUT_MS;
  const emailInput = emailInputLocator(page);

  while (Date.now() < deadline) {
    if (await isLoggedInAppShell(page)) {
      qaStep(`Already logged in as ${ctx.email} — will save storageState without submitting login`);
      return null;
    }

    if (await emailInput.isVisible().catch(() => false)) {
      qaStep('Login form found');
      return {
        emailInput,
        passwordInput: passwordInputLocator(page),
        submitButton: submitButtonLocator(page),
      };
    }

    await page.waitForTimeout(250);
  }

  const url = page.url();
  const title = await page.title().catch(() => '(no title)');
  const screenshot = await captureAuthSetupScreenshot(page, ctx.tier);
  const diagText = diagnostics ? formatDiagnostics(diagnostics) : '';

  throw new Error(
    `Login form not found within ${LOGIN_FORM_TIMEOUT_MS / 1000}s for ${ctx.email} (${ctx.tier}). ` +
      `URL: ${url}. Title: "${title}". Screenshot: ${screenshot}` +
      (diagText ? `\n\n${diagText}` : ''),
  );
}

export async function waitForAppReady(
  page: Page,
  ctx: LoginContext,
  diagnostics?: PageDiagnostics,
): Promise<void> {
  qaStep(
    `Waiting for dashboard (tier: ${ctx.tier}, email: ${ctx.email}, timeout: ${APP_READY_TIMEOUT_MS / 1000}s)`,
  );
  qaLog('waitForAppReady start', { url: page.url() });

  const deadline = Date.now() + APP_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    assertNotAboutBlank(page);

    const url = page.url();
    qaLog('polling app state', { url });

    if (url.includes('/login')) {
      const loginError = page.locator('[role="alert"], .text-red-300, .text-red-600').first();
      if (await loginError.isVisible().catch(() => false)) {
        const text = (await loginError.textContent())?.trim();
        if (text) {
          const shot = await captureAuthSetupScreenshot(page, ctx.tier);
          throw new Error(`Login failed for ${ctx.email}: ${text}. Screenshot: ${shot}`);
        }
      }
      await page.waitForTimeout(500);
      continue;
    }

    const legalLoading = page.getByTestId('legal-acceptance-loading');
    if (await legalLoading.isVisible().catch(() => false)) {
      qaStep('Legal acceptance check in progress…');
      await page.waitForTimeout(500);
      continue;
    }

    const legalModal = page.getByTestId('legal-acceptance-modal');
    if (await legalModal.isVisible().catch(() => false)) {
      qaStep('Legal acceptance gate detected — auto-accepting terms');
      await page.getByTestId('legal-acceptance-checkbox').check();
      await page.getByTestId('legal-acceptance-submit').click();
      await page.waitForTimeout(1000);
      continue;
    }

    const onboardingWelcome = page.getByText('Welcome to Arden Project OS');
    if (await onboardingWelcome.isVisible().catch(() => false)) {
      const shot = await captureAuthSetupScreenshot(page, ctx.tier);
      throw new Error(
        `Onboarding gate blocked ${ctx.email}. Seed users should have onboarding_completed_at set. ` +
          `Run: npm run qa:seed-gates. Screenshot: ${shot}`,
      );
    }

    const loadingWorkspace = page.getByText('Loading your workspace');
    if (await loadingWorkspace.isVisible().catch(() => false)) {
      qaLog('bootstrap/loading screen visible');
      await page.waitForTimeout(500);
      continue;
    }

    if (await isLoggedInAppShell(page)) {
      qaStep(`Dashboard ready for ${ctx.email} (${ctx.tier})`);
      qaLog('app ready', { url: page.url() });
      return;
    }

    await page.waitForTimeout(500);
  }

  const shot = await captureAuthSetupScreenshot(page, ctx.tier);
  const diagText = diagnostics ? formatDiagnostics(diagnostics) : '';
  throw new Error(
    `Timed out waiting for dashboard for ${ctx.email} (${ctx.tier}). ` +
      `Last URL: ${page.url()}. ` +
      `Check dev server (npm run dev), seed data (npm run qa:seed-gates), legal/onboarding gates. ` +
      `Screenshot: ${shot}` +
      (diagText ? `\n\n${diagText}` : ''),
  );
}

export async function automatedLogin(
  page: Page,
  ctx: LoginContext,
  diagnostics?: PageDiagnostics,
): Promise<void> {
  const password = ctx.password ?? QA_TEST_PASSWORD;

  await navigateToLoginPage(page, ctx, diagnostics);

  const form = await waitForLoginForm(page, ctx, diagnostics);
  if (form === null) {
    qaStep(`Already authenticated as ${ctx.email} — skipping login submit`);
    return;
  }

  qaStep(`Filling credentials for ${ctx.email}`);
  await form.emailInput.fill(ctx.email);
  await form.passwordInput.fill(password);

  qaStep(`Submitting sign-in for ${ctx.email}`);
  await form.submitButton.click();

  await waitForAppReady(page, ctx, diagnostics);
}

async function saveStorageState(page: Page, ctx: LoginContext): Promise<void> {
  ensureAuthDir();
  const storagePath = authStoragePath(ctx.tier);
  await page.context().storageState({ path: storagePath });
  qaStep(`Saved auth storage state → ${storagePath}`);
}

export async function loginAndSaveStorageState(
  page: Page,
  ctx: LoginContext,
): Promise<void> {
  const storagePath = authStoragePath(ctx.tier);
  const password = ctx.password ?? QA_TEST_PASSWORD;
  const diagnostics = attachPageDiagnostics(page);

  if (authStorageExists(ctx.tier) && process.env.QA_REFRESH_AUTH !== 'true') {
    qaStep(`Using existing storage state: ${storagePath}`);
    qaLog('skip login — storage state present (set QA_REFRESH_AUTH=true to re-login)');
    return;
  }

  if (!authStorageExists(ctx.tier)) {
    qaStep(`Storage state missing for ${ctx.tier}: ${storagePath} — logging in now`);
  } else {
    qaStep(`QA_REFRESH_AUTH=true — re-authenticating ${ctx.email}`);
  }

  try {
    await automatedLogin(page, ctx, diagnostics);
    await saveStorageState(page, ctx);
  } catch (autoError) {
    qaStep(`Automated login failed for ${ctx.email} — manual sign-in required`);
    qaLogAlways('automated login error', {
      error: autoError instanceof Error ? autoError.message : String(autoError),
    });

    await navigateToLoginPage(page, ctx, diagnostics);
    await manualStep(
      `Manual step required: Sign in as ${ctx.email} / ${password}, wait for Dashboard, then press Enter in this terminal.`,
    );
    await waitForAppReady(page, ctx, diagnostics);
    await saveStorageState(page, ctx);
  }
}

export async function openProfileMenu(page: Page): Promise<void> {
  qaStep('Opening profile menu');
  qaLog('openProfileMenu', { url: page.url() });
  assertNotAboutBlank(page);

  const profileButton = page.getByRole('button', { name: 'Profile menu' });
  try {
    await profileButton.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    const shot = await captureScreenshot(page, 'profile-menu-missing');
    throw new Error(
      `Profile menu button not found — user may not be logged in. URL: ${page.url()}. Screenshot: ${shot}`,
    );
  }

  await profileButton.click();
  await page.getByTestId('profile-menu-user-header').waitFor({ state: 'visible', timeout: 10_000 });
}

export async function waitForTestId(
  page: Page,
  testId: string,
  options?: { timeout?: number; label?: string },
): Promise<void> {
  assertNotAboutBlank(page);

  const timeout = options?.timeout ?? 15_000;
  qaStep(
    options?.label ??
      `Waiting for [data-testid="${testId}"] (timeout ${timeout / 1000}s) at ${page.url()}`,
  );

  try {
    await page.getByTestId(testId).waitFor({ state: 'visible', timeout });
  } catch {
    const shot = await captureScreenshot(page, `missing-${testId}`);
    throw new Error(
      `Required selector [data-testid="${testId}"] not found within ${timeout / 1000}s at ${page.url()}. ` +
        `Screenshot: ${shot}`,
    );
  }
}

export { navigateToApp } from './pageDiagnostics';
