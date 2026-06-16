import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { buildAppRoute, requireAppUrl } from './qaEnv';
import { qaLog, qaLogAlways, qaStep } from './qaLog';

export interface PageDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

function screenshotDir(): string {
  const dir = path.join(process.cwd(), 'qa-reports', 'tier-gates', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function captureScreenshot(page: Page, label: string): Promise<string> {
  const file = path.join(screenshotDir(), `${label}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return file;
}

export function attachPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  page.on('console', (message) => {
    const type = message.type();
    const text = message.text();
    if (type === 'error' || type === 'warning') {
      diagnostics.consoleErrors.push(`[${type}] ${text}`);
      console.error(`[QA:browser:console:${type}] ${text}`);
    } else {
      qaLog(`browser console ${type}`, { text });
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
    console.error(`[QA:browser:pageerror] ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown failure';
    const line = `${request.method()} ${request.url()} — ${failure}`;
    diagnostics.failedRequests.push(line);
    console.error(`[QA:browser:requestfailed] ${line}`);
  });

  return diagnostics;
}

export function formatDiagnostics(diagnostics: PageDiagnostics): string {
  const sections: string[] = [];
  if (diagnostics.pageErrors.length > 0) {
    sections.push(`Page errors:\n${diagnostics.pageErrors.join('\n')}`);
  }
  if (diagnostics.consoleErrors.length > 0) {
    sections.push(`Console messages:\n${diagnostics.consoleErrors.join('\n')}`);
  }
  if (diagnostics.failedRequests.length > 0) {
    sections.push(
      `Failed requests:\n${diagnostics.failedRequests.slice(0, 15).join('\n')}`,
    );
  }
  return sections.join('\n\n') || 'No browser console/page errors captured yet.';
}

export async function logNavigationState(page: Page): Promise<void> {
  const url = page.url();
  const title = await page.title().catch(() => '(no title)');
  qaLogAlways('Navigation state', { url, title });
}

export function assertNotAboutBlank(page: Page): void {
  const url = page.url();
  if (url === 'about:blank' || url.startsWith('about:')) {
    throw new Error(
      `Browser page is ${url}. Navigation did not reach the app. APP_URL=${requireAppUrl()}`,
    );
  }
}

export async function assertPageUsable(
  page: Page,
  diagnostics?: PageDiagnostics,
  label = 'blank-page',
): Promise<void> {
  assertNotAboutBlank(page);

  const bodyText = (await page.locator('body').innerText().catch(() => '')).trim();
  const root = page.locator('#root');
  const rootCount = await root.count();
  const rootHtml = rootCount > 0 ? (await root.innerHTML().catch(() => '')).trim() : '';
  const hasVisibleContent = bodyText.length > 0 || rootHtml.length > 0;

  if (!hasVisibleContent) {
    const screenshot = await captureScreenshot(page, label);
    const details = diagnostics ? formatDiagnostics(diagnostics) : '';
    throw new Error(
      `App loaded a blank page at ${page.url()} (title: "${await page.title()}"). ` +
        `APP_URL=${requireAppUrl()}. Screenshot: ${screenshot}` +
        (details ? `\n\n${details}` : ''),
    );
  }
}

export async function navigateToApp(
  page: Page,
  route = '/',
  diagnostics?: PageDiagnostics,
): Promise<void> {
  const target = route === '/' ? requireAppUrl() : buildAppRoute(route);
  qaStep(`Navigating to ${target}`);
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await logNavigationState(page);

  if (page.url() === 'about:blank' || page.url().startsWith('about:')) {
    const screenshot = await captureScreenshot(page, 'about-blank');
    throw new Error(
      `Page stayed ${page.url()} after navigating to ${target}. ` +
        `APP_URL=${requireAppUrl()}. Screenshot: ${screenshot}`,
    );
  }

  await assertPageUsable(page, diagnostics, 'blank-after-goto');
}
