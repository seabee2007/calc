#!/usr/bin/env node
/**
 * Bootstrap approved JSON from curated manualRates files (Div 03 + 31).
 * Use until full raw→reviewed→approved pipeline is complete for all divisions.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReviewedProductionRateEntry, ReviewedRateFile } from '../src/features/estimating/rates/manualRateTypes';
import {
  SOURCE_DOCUMENT_CODE,
  SOURCE_DOCUMENT_FULL,
  SOURCE_DOCUMENT_TITLE,
  SOURCE_EDITION,
  type NormalizedProductionRateFile,
  type NormalizedProductionRateRecord,
} from '../src/features/estimating/data/productionRates/productionRateTypes';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const approvedDir = join(repoRoot, 'data/estimating/production-rates/approved');

const SOURCES = [
  {
    path: join(repoRoot, 'src/features/estimating/data/manualRates/division03Concrete.reviewed.json'),
    outName: 'division03Concrete.approved.json',
  },
  {
    path: join(repoRoot, 'src/features/estimating/data/manualRates/division31Earthwork.reviewed.json'),
    outName: 'division31Earthwork.approved.json',
  },
];

function mapEntry(entry: ReviewedProductionRateEntry, file: ReviewedRateFile): NormalizedProductionRateRecord {
  const now = new Date().toISOString();
  const notes = entry.sourceNotes ?? [];
  const crewNote = notes.find((n) => /crew/i.test(n));

  return {
    id: entry.id,
    sourceDocumentCode: SOURCE_DOCUMENT_CODE,
    sourceDocumentTitle: SOURCE_DOCUMENT_TITLE,
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    division: file.batchMeta.divisionCode,
    divisionName: file.batchMeta.divisionName,
    figure: entry.sourceFigure,
    figureTitle: entry.sourceFigure.replace('Figure ', 'Figure ') + ' Production',
    sourcePage: entry.sourcePage,
    sourcePdfPage: entry.sourcePdfPage ?? null,
    workElementNumber: entry.masterFormatCode,
    workElementLineNumber: entry.workElementLineNumber,
    category: entry.applicableActivityTypes[0] ?? null,
    subcategory: null,
    activityName: entry.description,
    description: entry.description,
    unitOfMeasure: entry.unit,
    manHoursPerUnit: entry.manHoursPerUnit ?? entry.equipmentHoursPerUnit ?? null,
    fabricateHours: null,
    erectStripHours: null,
    cleanMoveHours: null,
    crewSize: entry.minimumCrewSize ?? null,
    skilledTrade: null,
    skilledCount: null,
    laborerCount: entry.crewComposition?.laborer ?? null,
    equipmentOperatorCount: entry.crewComposition?.equipmentOperator ?? null,
    equipment: entry.rateType === 'equipment_production' ? entry.description : null,
    figureCrewNotes: crewNote ? [crewNote] : null,
    figureNotes: notes.length ? notes : null,
    rowNotes: null,
    qaStatus: 'approved',
    extractionWarnings: [],
    createdAt: now,
    updatedAt: now,
  };
}

function main(): void {
  mkdirSync(approvedDir, { recursive: true });

  for (const source of SOURCES) {
    const file = JSON.parse(readFileSync(source.path, 'utf8')) as ReviewedRateFile;
    const payload: NormalizedProductionRateFile = {
      batchMeta: {
        sourceDocumentCode: SOURCE_DOCUMENT_CODE,
        sourceDocumentTitle: SOURCE_DOCUMENT_TITLE,
        sourceDocumentFull: SOURCE_DOCUMENT_FULL,
        sourceEdition: SOURCE_EDITION,
        division: file.batchMeta.divisionCode,
        divisionName: file.batchMeta.divisionName,
        figure: `Figure 5-${file.batchMeta.divisionCode === '03' ? 'C' : 'R'}-*`,
        figureTitle: `${file.batchMeta.divisionName} — curated manual import`,
        extractedAt: file.batchMeta.importedAt,
        reviewedBy: file.batchMeta.reviewedBy,
        approvedBy: file.batchMeta.reviewedBy,
        notes: file.batchMeta.notes,
      },
      records: file.rates.map((entry) => mapEntry(entry, file)),
    };

    const outPath = join(approvedDir, source.outName);
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Wrote ${outPath} (${payload.records.length} approved records)`);
  }
}

main();
