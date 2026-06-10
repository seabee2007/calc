/**
 * Maps approved extracted pipeline records into the existing ReviewedRateFile shape
 * used by buildProductionRateSeedBundle.
 */
import type { ReviewedProductionRateEntry, ReviewedRateFile } from '../../rates/manualRateTypes';
import type { ExtractedProductionRateFile, ExtractedProductionRateRecord } from './productionRateTypes';
import { assertApprovedProductionRateFile } from './validateExtractedProductionRates';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildRateId(record: ExtractedProductionRateRecord): string {
  const mf = (record.workElementNumber ?? '00 00 00.00').replace(/\s+/g, '-');
  const line = record.workElementLineNumber ?? '0000';
  return `${mf}-${line}`;
}

function inferTags(record: ExtractedProductionRateRecord): string[] {
  const tokens = [
    record.divisionName,
    record.figure,
    record.activityName,
    record.description ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);

  return [...new Set(tokens)].slice(0, 6);
}

function mapRecord(record: ExtractedProductionRateRecord): ReviewedProductionRateEntry {
  const notes: string[] = [];
  if (record.fabricateHours != null) notes.push(`Fabricate: ${record.fabricateHours}`);
  if (record.erectStripHours != null) notes.push(`Erect/Strip: ${record.erectStripHours}`);
  if (record.cleanMoveHours != null) notes.push(`Clean/Move: ${record.cleanMoveHours}`);
  if (record.notes) notes.push(record.notes);
  if (record.extractionWarnings?.length) notes.push(...record.extractionWarnings);

  const rateType =
    record.equipment && !record.manHoursPerUnit ? 'equipment_production' : 'labor_production';

  return {
    id: buildRateId(record),
    masterFormatCode: record.workElementNumber ?? '00 00 00.00',
    workElementLineNumber: record.workElementLineNumber ?? '0000',
    description: record.description ?? record.activityName,
    unit: record.unitOfMeasure,
    rateType,
    manHoursPerUnit: record.manHoursPerUnit ?? undefined,
    minimumCrewSize: record.crewSize ?? undefined,
    crewComposition: record.laborerCount ? { laborer: record.laborerCount } : undefined,
    sourceFigure: record.figure,
    sourcePage: record.sourcePage,
    sourcePdfPage: record.sourcePdfPage ?? undefined,
    sourceNotes: notes.length ? notes : undefined,
    directLaborOnly: rateType === 'labor_production',
    militaryAdjusted: false,
    tags: inferTags(record),
    applicableActivityTypes: [record.activityName],
  };
}

export function mapExtractedFileToReviewedRateFile(
  file: ExtractedProductionRateFile,
  reviewedBy: string,
): ReviewedRateFile {
  assertApprovedProductionRateFile(file);

  return {
    batchMeta: {
      sourceManual: file.batchMeta.sourceDocumentFull,
      sourceEdition: file.batchMeta.sourceEdition,
      divisionCode: file.batchMeta.division,
      divisionName: file.batchMeta.divisionName,
      importedAt: file.batchMeta.approvedBy ? file.batchMeta.promotedAt ?? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      reviewedBy,
      notes: file.batchMeta.notes,
    },
    rates: file.records.map(mapRecord),
  };
}

export function divisionSeedExportName(divisionCode: string, divisionName: string): string {
  return `division${divisionCode}${slugify(divisionName).replace(/-/g, '')}Rates`;
}
