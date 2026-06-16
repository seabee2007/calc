export function isQaVerbose(): boolean {
  return process.env.QA_VERBOSE === 'true' || process.argv.includes('--debug');
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}

export function isPlaywrightDebugEnabled(): boolean {
  return (
    isTruthyEnv(process.env.PWDEBUG) || isTruthyEnv(process.env.PLAYWRIGHT_INSPECTOR)
  );
}

/** Warn when Playwright Inspector may pause navigation at about:blank. */
export function warnPlaywrightDebugMode(): void {
  if (!isPlaywrightDebugEnabled()) return;

  qaLogAlways(
    'Playwright debug mode is enabled. The browser may pause at about:blank until you click Resume in the Playwright Inspector. To run normally, clear PWDEBUG.',
  );
  qaLogAlways('PowerShell: Remove-Item Env:PWDEBUG -ErrorAction SilentlyContinue');
}

/** Always printed — use before manual or long-running steps. */
export function qaStep(message: string): void {
  console.log(`\n[QA] ${message}`);
}

/** Extra detail when QA_VERBOSE=true or --debug. */
export function qaLog(message: string, meta?: Record<string, unknown>): void {
  if (!isQaVerbose()) return;
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[QA:verbose] ${message}`, meta);
  } else {
    console.log(`[QA:verbose] ${message}`);
  }
}

export function qaLogAlways(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[QA] ${message}`, meta);
  } else {
    console.log(`[QA] ${message}`);
  }
}
