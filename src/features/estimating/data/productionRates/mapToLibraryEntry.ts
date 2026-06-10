import type { ProductionRate } from '../../domain/constructionActivityTypes';
import {
  SOURCE_DOCUMENT_FULL,
  SOURCE_EDITION,
  type NormalizedProductionRateRecord,
  type ProductionRateLibraryEntry,
} from './productionRateTypes';

export const PRODUCTION_RATE_REFERENCE_NOTE =
  'Reference rate from NTRP/MCRP Construction Estimating. Adjust for site conditions, crew skill, weather, and project constraints.';

function buildKeywords(record: NormalizedProductionRateRecord): string[] {
  const tokens = [
    record.division,
    record.divisionName,
    record.figure,
    record.figureTitle,
    record.category,
    record.subcategory,
    record.activityName,
    record.description,
    record.workElementNumber,
    record.unitOfMeasure,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  return [...new Set(tokens)];
}

export function mapRecordToLibraryEntry(
  record: NormalizedProductionRateRecord,
): ProductionRateLibraryEntry {
  return {
    id: record.id,
    divisionCode: record.division,
    divisionName: record.divisionName,
    figure: record.figure,
    figureTitle: record.figureTitle,
    sourcePage: record.sourcePage,
    sourcePdfPage: record.sourcePdfPage,
    workElementNumber: record.workElementNumber,
    workElementLineNumber: record.workElementLineNumber,
    category: record.category,
    subcategory: record.subcategory,
    activityName: record.activityName,
    description: record.description,
    unitOfMeasure: record.unitOfMeasure,
    manHoursPerUnit: record.manHoursPerUnit,
    fabricateHours: record.fabricateHours,
    erectStripHours: record.erectStripHours,
    cleanMoveHours: record.cleanMoveHours,
    crewSize: record.crewSize,
    figureCrewNotes: record.figureCrewNotes,
    figureNotes: record.figureNotes,
    rowNotes: record.rowNotes,
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    referenceNote: PRODUCTION_RATE_REFERENCE_NOTE,
    keywords: buildKeywords(record),
  };
}

export function mapRecordToProductionRate(
  record: NormalizedProductionRateRecord,
  importBatchId: string,
): ProductionRate {
  const notes: string[] = [];
  if (record.rowNotes) notes.push(record.rowNotes);
  if (record.figureNotes?.length) notes.push(...record.figureNotes);
  if (record.figureCrewNotes?.length) notes.push(...record.figureCrewNotes);

  return {
    id: record.id,
    divisionCode: record.division,
    divisionName: record.divisionName,
    masterFormatCode: record.workElementNumber ?? '00 00 00.00',
    workElementLineNumber: record.workElementLineNumber ?? '0000',
    description: record.description ?? record.activityName,
    unit: record.unitOfMeasure,
    rateType: record.equipment && !record.manHoursPerUnit ? 'equipment_production' : 'labor_production',
    manHoursPerUnit: record.manHoursPerUnit ?? undefined,
    minimumCrewSize: record.crewSize ?? undefined,
    crewComposition: record.laborerCount ? { laborer: record.laborerCount } : undefined,
    sourceManual: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    sourceDivision: record.division,
    sourceFigure: record.figure,
    sourcePage: record.sourcePage,
    sourcePdfPage: record.sourcePdfPage ?? undefined,
    sourceNotes: notes.length ? notes : undefined,
    directLaborOnly: true,
    militaryAdjusted: false,
    tags: buildKeywords(record).slice(0, 8),
    applicableActivityTypes: [record.category ?? record.activityName].filter(Boolean) as string[],
    importBatchId,
    isActive: true,
  };
}
