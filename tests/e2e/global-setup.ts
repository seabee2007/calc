import { assertAppReachable, requireAppUrl } from './helpers/qaEnv';
import { qaLogAlways, qaStep, warnPlaywrightDebugMode } from './helpers/qaLog';

export default async function globalSetup(): Promise<void> {
  const appUrl = requireAppUrl();
  qaStep('Tier gate QA runner starting');
  warnPlaywrightDebugMode();
  qaLogAlways(`APP_URL=${appUrl}`);
  await assertAppReachable(appUrl);
}
