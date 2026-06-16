import path from 'node:path';
import dotenv from 'dotenv';
import { qaLogAlways, qaStep } from './qaLog';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let cachedAppUrl: string | null = null;

export function requireAppUrl(): string {
  if (cachedAppUrl) return cachedAppUrl;

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error('APP_URL is missing. Set APP_URL=http://localhost:5173 in .env.local.');
  }

  cachedAppUrl = appUrl.replace(/\/$/, '');
  return cachedAppUrl;
}

export async function assertAppReachable(appUrl = requireAppUrl()): Promise<void> {
  qaStep(`Health check: GET ${appUrl}`);
  try {
    const response = await fetch(appUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `App is not reachable at ${appUrl}. Start npm run dev in another terminal.\nDetails: ${detail}`,
    );
  }
  qaLogAlways(`App reachable at ${appUrl}`);
}

export function buildAppRoute(route: string): string {
  const appUrl = requireAppUrl();
  if (route.startsWith('http://') || route.startsWith('https://')) {
    return route;
  }
  return `${appUrl}${route.startsWith('/') ? route : `/${route}`}`;
}
