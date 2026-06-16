import fs from 'node:fs';
import path from 'node:path';
import {
  COVERAGE_FEATURES,
  OVER_LIMIT_SEED_NOTE,
  TEST_TITLE_TO_FEATURE,
  expectedForFeature,
  type CoverageFeature,
} from '../../tests/e2e/helpers/tierGateCoverage';
import { GATE_TIERS, type TierFixture } from '../../tests/e2e/helpers/tierGateFixtures';

interface PlaywrightAttachment {
  name?: string;
  path?: string;
  contentType?: string;
}

interface PlaywrightTestResult {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted' | 'expected' | 'unexpected' | 'flaky';
  errors?: { message?: string }[];
  attachments?: PlaywrightAttachment[];
  annotations?: { type?: string; description?: string }[];
}

interface PlaywrightTestCase {
  projectName?: string;
  results?: PlaywrightTestResult[];
  status?: string;
}

interface PlaywrightSpecNode {
  title?: string;
  file?: string;
  specs?: PlaywrightSpecNode[];
  suites?: PlaywrightSpecNode[];
  tests?: PlaywrightTestCase[];
}

interface PlaywrightReport {
  suites?: PlaywrightSpecNode[];
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
    duration?: number;
  };
}

interface ReportRow {
  tier: string;
  feature: string;
  testTitle: string;
  expected: string;
  actual: string;
  passFail: 'PASS' | 'FAIL' | 'SKIP' | 'NOT RUN';
  reason: string;
  screenshot: string;
}

function tierFromChain(chain: string[]): string {
  const match = chain.find((part) => part.endsWith(' tier gates'));
  return match ? match.replace(' tier gates', '') : 'unknown';
}

function tierFixture(tierId: string): TierFixture | undefined {
  return GATE_TIERS.find((tier) => tier.tierId === tierId);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function parseSkipReason(result?: PlaywrightTestResult): string {
  const annotation = result?.annotations?.find((entry) => entry.type === 'skip');
  if (annotation?.description) return annotation.description.trim();

  const message = result?.errors?.[0]?.message ?? '';
  const skippedPrefix = 'Test skipped:';
  if (message.includes(skippedPrefix)) {
    return message.split(skippedPrefix)[1]?.trim() ?? message.trim();
  }
  return message.trim();
}

function screenshotFromResult(result?: PlaywrightTestResult): string {
  if (!result?.attachments?.length) return '';
  const shot = result.attachments.find(
    (attachment) =>
      attachment.name === 'screenshot' ||
      attachment.contentType?.startsWith('image/') ||
      attachment.path?.endsWith('.png'),
  );
  return shot?.path ?? result.attachments[0]?.path ?? '';
}

function actualFromStatus(status: PlaywrightTestResult['status'] | undefined): string {
  switch (status) {
    case 'passed':
    case 'expected':
      return 'passed';
    case 'skipped':
      return 'skipped';
    case 'flaky':
      return 'flaky';
    default:
      return 'failed';
  }
}

function passFailFromStatus(status: PlaywrightTestResult['status'] | undefined): ReportRow['passFail'] {
  switch (status) {
    case 'passed':
    case 'expected':
      return 'PASS';
    case 'skipped':
      return 'SKIP';
    default:
      return 'FAIL';
  }
}

function recordResult(
  chain: string[],
  testTitle: string,
  testCase: PlaywrightTestCase,
  rows: ReportRow[],
): void {
  const result = testCase.results?.[testCase.results.length - 1];
  const resultStatus = result?.status ?? 'failed';
  const tier = tierFromChain(chain);
  const feature = TEST_TITLE_TO_FEATURE[testTitle] ?? testTitle;
  const fixture = tierFixture(tier);

  rows.push({
    tier,
    feature,
    testTitle,
    expected:
      fixture && testTitle in TEST_TITLE_TO_FEATURE
        ? expectedForFeature(fixture, feature as CoverageFeature)
        : 'pass',
    actual: actualFromStatus(resultStatus),
    passFail: passFailFromStatus(resultStatus),
    reason:
      resultStatus === 'skipped'
        ? parseSkipReason(result)
        : (result?.errors?.[0]?.message ?? ''),
    screenshot: resultStatus === 'failed' || resultStatus === 'unexpected' ? screenshotFromResult(result) : '',
  });
}

function walk(node: PlaywrightSpecNode, chain: string[], rows: ReportRow[]): void {
  const nextChain = node.title ? [...chain, node.title] : chain;

  for (const child of node.suites ?? []) {
    walk(child, nextChain, rows);
  }

  for (const spec of node.specs ?? []) {
    const testTitle = spec.title ?? 'unknown';
    for (const testCase of spec.tests ?? []) {
      recordResult(nextChain, testTitle, testCase, rows);
    }
    for (const nestedSuite of spec.suites ?? []) {
      walk(nestedSuite, nextChain, rows);
    }
  }

  for (const testCase of node.tests ?? []) {
    recordResult(nextChain, node.title ?? 'unknown', testCase, rows);
  }
}

function buildCoverageMatrix(rows: ReportRow[]): string[] {
  const tierIds = GATE_TIERS.map((tier) => tier.tierId);
  const lookup = new Map<string, ReportRow>();

  for (const row of rows) {
    if (row.tier === 'unknown' || row.tier === 'setup') continue;
    lookup.set(`${row.tier}::${row.feature}`, row);
  }

  const lines = [
    '## Coverage by tier and feature',
    '',
    `| Feature | ${tierIds.join(' | ')} |`,
    `| --- | ${tierIds.map(() => '---').join(' | ')} |`,
  ];

  for (const feature of COVERAGE_FEATURES) {
    const cells = tierIds.map((tierId) => {
      const row = lookup.get(`${tierId}::${feature}`);
      if (!row) return 'NOT RUN';
      if (row.passFail === 'PASS') return 'PASS';
      if (row.passFail === 'SKIP') return 'SKIP';
      return 'FAIL';
    });
    lines.push(`| ${feature} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  return lines;
}

function buildDetailedTable(rows: ReportRow[]): string[] {
  const gateRows = rows.filter((row) => row.tier !== 'unknown' && row.tier !== 'setup');
  const lines = [
    '## Detailed results',
    '',
    '| Tier | Feature | Expected | Actual | Pass/Fail | Skip/fail reason | Screenshot |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const feature of COVERAGE_FEATURES) {
    for (const tier of GATE_TIERS) {
      const row =
        gateRows.find((entry) => entry.tier === tier.tierId && entry.feature === feature) ??
        ({
          tier: tier.tierId,
          feature,
          testTitle: '',
          expected: expectedForFeature(tier, feature),
          actual: 'not run',
          passFail: 'NOT RUN',
          reason: 'No matching Playwright test result in latest.json',
          screenshot: '',
        } satisfies ReportRow);

      lines.push(
        `| ${row.tier} | ${row.feature} | ${escapeCell(row.expected)} | ${row.actual} | ${row.passFail} | ${escapeCell(row.reason)} | ${escapeCell(row.screenshot)} |`,
      );
    }
  }

  lines.push('');
  return lines;
}

function buildSkipSummary(rows: ReportRow[]): string[] {
  const seen = new Set<string>();
  const skipped = rows.filter((row) => {
    if (row.passFail !== 'SKIP' || row.tier === 'setup') return false;
    const key = `${row.tier}::${row.feature}::${row.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (skipped.length === 0) {
    return ['## Skipped tests', '', 'No skipped tier-gate tests in this run.', ''];
  }

  const lines = ['## Skipped tests', '', '| Tier | Feature | Reason |', '| --- | --- | --- |'];
  for (const row of skipped) {
    lines.push(`| ${row.tier} | ${row.feature} | ${escapeCell(row.reason)} |`);
  }
  lines.push('');
  return lines;
}

function toMarkdown(rows: ReportRow[], stats?: PlaywrightReport['stats']): string {
  const lines = [
    '# Tier Gate QA Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  if (stats) {
    lines.push(
      `Summary: ${stats.expected ?? 0} passed, ${stats.unexpected ?? 0} failed, ${stats.skipped ?? 0} skipped (${stats.duration ?? 0}ms)`,
      '',
    );
  }

  lines.push(`> ${OVER_LIMIT_SEED_NOTE}`, '');
  lines.push(
    'This report maps each tier gate check to a feature row. **SKIP** usually means the test is not applicable to that tier (for example, past-due-only checks) or seed manifest data is missing.',
    '',
  );

  lines.push(...buildCoverageMatrix(rows));
  lines.push(...buildSkipSummary(rows));
  lines.push(...buildDetailedTable(rows));

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const jsonPath = path.join(process.cwd(), 'qa-reports', 'tier-gates', 'latest.json');
  const mdPath = path.join(process.cwd(), 'qa-reports', 'tier-gates', 'latest.md');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Playwright JSON report not found: ${jsonPath}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as PlaywrightReport;
  const rows: ReportRow[] = [];
  for (const suite of report.suites ?? []) {
    walk(suite, [], rows);
  }

  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, toMarkdown(rows, report.stats), 'utf8');

  console.log(`Wrote ${mdPath} (${rows.length} test results)`);
}

main();
