import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADOBE_APPROVED_OUTPUT,
  resolveApprovedProductionRateFiles,
} from './adobeProductionRateImport';
import type { NormalizedProductionRateFile, NormalizedProductionRateRecord } from './productionRateTypes';
import { assertApprovedProductionRateFile } from './validateExtractedProductionRates';

export function loadApprovedProductionRateRecords(approvedDir: string): NormalizedProductionRateRecord[] {
  const files = resolveApprovedProductionRateFiles(approvedDir);
  const records: NormalizedProductionRateRecord[] = [];

  for (const name of files) {
    const payload = JSON.parse(
      readFileSync(join(approvedDir, name), 'utf8'),
    ) as NormalizedProductionRateFile;
    assertApprovedProductionRateFile(payload);
    records.push(...payload.records);
  }

  return records;
}

export function isAdobeApprovedLibraryActive(approvedDir: string): boolean {
  return resolveApprovedProductionRateFiles(approvedDir).includes(ADOBE_APPROVED_OUTPUT);
}

/** @internal test helper */
export function listApprovedFilesForGeneration(approvedDir: string): string[] {
  if (isAdobeApprovedLibraryActive(approvedDir)) {
    return [ADOBE_APPROVED_OUTPUT];
  }
  return readdirSync(approvedDir).filter((name) => name.endsWith('.approved.json'));
}
