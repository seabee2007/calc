import readline from 'node:readline';
import { loadQaEnv } from './loadQaEnv';

function isLocalhostUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function looksLikeProductionSupabase(url: string | undefined): boolean {
  if (!url) return false;
  if (url.includes('localhost')) return false;
  return url.includes('supabase.co');
}

function assertNoBrowserServiceRoleKey(): void {
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'BLOCKED: Do not use VITE_SUPABASE_SERVICE_ROLE_KEY. Service role keys must never be exposed to the browser. Use SUPABASE_SERVICE_ROLE_KEY instead.',
    );
    console.error('Rename the variable in .env.local (remove the VITE_ prefix).');
    process.exit(1);
  }
}

function assertNoBrowserMapboxSecretTokens(): void {
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('VITE_MAPBOX_') || !value?.trim()) continue;
    if (value.trim().startsWith('sk.')) {
      console.error(
        `BLOCKED: ${name} appears to be a Mapbox secret token (sk. prefix). Secret Mapbox tokens must stay server-side and must not use a VITE_ prefix.`,
      );
      console.error(
        'Use a pk.-prefixed public token under VITE_MAPBOX_* only if the frontend needs Mapbox directly, or keep secret tokens in server-only env vars.',
      );
      process.exit(1);
    }
  }
}

async function askConfirmation(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(question, (value) => {
      rl.close();
      resolve(value.trim());
    });
  });
  return answer === 'ALLOW QA SEED';
}

export async function assertSafeQaEnvironment(): Promise<void> {
  loadQaEnv();
  assertNoBrowserServiceRoleKey();
  assertNoBrowserMapboxSecretTokens();

  if (process.env.NODE_ENV === 'production') {
    console.error('BLOCKED: NODE_ENV=production');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL;

  if (!supabaseUrl) {
    console.error('BLOCKED: Missing SUPABASE_URL or VITE_SUPABASE_URL');
    process.exit(1);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('BLOCKED: Missing SUPABASE_SERVICE_ROLE_KEY');
    console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Node scripts only — never use a VITE_ prefix).');
    process.exit(1);
  }

  const prodLike = looksLikeProductionSupabase(supabaseUrl);
  const localApp = isLocalhostUrl(appUrl);

  if (prodLike && process.env.ALLOW_QA_SEED_PRODUCTION !== 'true') {
    console.error('BLOCKED: production-like Supabase URL detected.');
    console.error('Set ALLOW_QA_SEED_PRODUCTION=true only if you explicitly intend to seed production.');
    process.exit(1);
  }

  if (!localApp && !prodLike && process.env.ALLOW_QA_SEED_PRODUCTION !== 'true') {
    console.warn('Warning: APP_URL is not localhost. Proceeding only for staging with explicit flag.');
    const confirmed = await askConfirmation(
      'Type "ALLOW QA SEED" to continue seeding a non-localhost environment: ',
    );
    if (!confirmed) {
      console.error('BLOCKED: confirmation phrase not entered.');
      process.exit(1);
    }
  }
}

export function getSupabaseAdminConfig(): { url: string; serviceRoleKey: string } {
  loadQaEnv();
  assertNoBrowserServiceRoleKey();
  assertNoBrowserMapboxSecretTokens();

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY in .env.local)');
  }

  return { url, serviceRoleKey };
}
