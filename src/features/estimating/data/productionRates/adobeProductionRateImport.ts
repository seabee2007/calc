/**
 * Adobe Chapter 5 final-reviewed → approved production-rate import helpers.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOURCE_DOCUMENT_CODE,
  SOURCE_DOCUMENT_FULL,
  SOURCE_DOCUMENT_TITLE,
  SOURCE_EDITION,
  type NormalizedProductionRateFile,
  type NormalizedProductionRateRecord,
} from './productionRateTypes';
import type { AdobeFinalReviewedRow } from './adobeProductionRateRowTypes';
import { validateProductionRateRecord } from './validateExtractedProductionRates';

export type { AdobeFinalReviewedRow } from './adobeProductionRateRowTypes';

export const ADOBE_FINAL_REVIEWED_RELATIVE_PATH =
  'data/estimating/production-rates/normalized/chapter5-production-rates.final-reviewed.json';

export const ADOBE_APPROVED_OUTPUT = 'adobe-chapter5.approved.json';
export const ADOBE_REJECTED_OUTPUT = 'adobe-chapter5.rejected.json';

export interface FigureMetadata {
  figure: string;
  figureTitle: string;
  sourcePage: string;
  sourcePdfPage: number;
}

export interface ImportAdobeOptions {
  repoRoot: string;
  now?: string;
}

export interface ImportAdobeResult {
  approved: NormalizedProductionRateFile;
  rejected: {
    generatedAt: string;
    sourceFile: string;
    inputRowCount: number;
    rejectedRowCount: number;
    records: Array<AdobeFinalReviewedRow & { rejectionReasons: string[] }>;
  };
  stats: {
    inputRowCount: number;
    approvedRowCount: number;
    rejectedRowCount: number;
    duplicateIdSuffixes: number;
  };
}

const DIVISION_TO_ANNEX: Record<string, string> = {
  '01': 'A',
  '02': 'B',
  '03': 'C',
  '04': 'D',
  '05': 'E',
  '06': 'F',
  '07': 'G',
  '08': 'H',
  '09': 'J',
  '10': 'K',
  '11': 'K',
  '12': 'K',
  '13': 'L',
  '21': 'M',
  '22': 'N',
  '23': 'P',
  '26': 'Q',
  '31': 'R',
  '32': 'S',
  '33': 'T',
  '34': 'U',
  '35': 'V',
  '41': 'W',
  '46': 'X',
  '27': 'Q',
  '28': 'Q',
};

function annexForDivision(division: string): string {
  if (DIVISION_TO_ANNEX[division]) return DIVISION_TO_ANNEX[division];
  const code = parseInt(division, 10);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return letters[Number.isFinite(code) ? code % letters.length : 0];
}

const UNIT_DISPLAY_MAP: Record<string, string> = {
  EA: 'Each',
  SF: 'SF',
  SF_WALL_SURFACE: 'SF of wall surface',
  SF_FLOOR: 'SF of floor',
  SF_CONTACT_SURFACE: 'SF of contact surface',
  SF_SHELF: 'SF of shelf',
  LF: 'LF',
  CY: 'CYD',
  CYD: 'CYD',
  BCY: 'Bank CYD',
  CF: 'CF',
  TON: 'Ton',
  ACRE: 'Acre',
  LB: 'LB',
  PAIR: 'Pair',
  OPENING: 'Opening',
  SQUARE: 'Square',
  KIT: 'Kit',
  BF: 'BF',
  SY: 'SY',
};

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeSectionCode(sectionCode: string): string {
  const collapsed = collapseWhitespace(sectionCode);
  if (/^\d{2}\s+\d{2}\s+\d{2}$/.test(collapsed)) {
    return `${collapsed}.00`;
  }
  return collapsed;
}

function normalizeWorkElementKey(sectionCode: string): string {
  return normalizeSectionCode(sectionCode).replace(/\s+/g, '-');
}

export function buildDeterministicProductionRateId(
  division: string,
  sectionCode: string,
  itemCode: string,
  sourceTableFile?: string,
  useTableSuffix = false,
): string {
  const base = `${division}-${normalizeWorkElementKey(sectionCode)}-${itemCode}`;
  if (!useTableSuffix || !sourceTableFile) return base;
  const stem = sourceTableFile.replace(/\.xlsx$/i, '').toLowerCase();
  return `${base}-${stem}`;
}

export function normalizeAdobeUnit(unit: string | null | undefined): string {
  const raw = collapseWhitespace(unit ?? '').toUpperCase();
  if (!raw) return '';
  return UNIT_DISPLAY_MAP[raw] ?? raw.replace(/_/g, ' ');
}

function splitCategory(sectionTitle: string, workElementDescription: string): {
  category: string;
  subcategory: string | null;
} {
  const title = collapseWhitespace(sectionTitle);
  const description = collapseWhitespace(workElementDescription);
  if (!title) {
    return { category: description || 'Uncategorized', subcategory: null };
  }
  if (description && title !== description && !title.includes(description)) {
    return { category: title, subcategory: description };
  }
  return { category: title, subcategory: null };
}

function loadTableFilePageIndex(repoRoot: string): Map<string, number> {
  const refsPath = join(
    repoRoot,
    'data/estimating/production-rates/adobe/chapter5/inspection/table-file-references.json',
  );
  if (!existsSync(refsPath)) return new Map();

  const refs = JSON.parse(readFileSync(refsPath, 'utf8')) as Array<{
    page?: number;
    filePaths?: string[];
  }>;

  const map = new Map<string, number>();
  for (const ref of refs) {
    for (const filePath of ref.filePaths ?? []) {
      const fileName = filePath.split(/[/\\]/).pop();
      if (!fileName || map.has(fileName)) continue;
      map.set(fileName, typeof ref.page === 'number' ? ref.page + 1 : 0);
    }
  }
  return map;
}

function loadLegacyFigureIndex(repoRoot: string): Map<string, FigureMetadata> {
  const index = new Map<string, FigureMetadata>();
  const rawDir = join(repoRoot, 'data/estimating/production-rates/raw');
  if (!existsSync(rawDir)) return index;

  for (const name of readdirSync(rawDir).filter((file) => file.endsWith('.json'))) {
    const payload = JSON.parse(readFileSync(join(rawDir, name), 'utf8')) as {
      batchMeta?: { figure?: string; figureTitle?: string; sourcePage?: string };
      records?: Array<{
        workElementNumber?: string | null;
        workElementLineNumber?: string | null;
        figure?: string;
        figureTitle?: string;
        sourcePage?: string;
        sourcePdfPage?: number | null;
      }>;
    };

    for (const record of payload.records ?? []) {
      if (!record.workElementNumber || !record.workElementLineNumber) continue;
      const key = `${record.workElementNumber}|${record.workElementLineNumber}`;
      index.set(key, {
        figure: record.figure ?? payload.batchMeta?.figure ?? '',
        figureTitle: record.figureTitle ?? payload.batchMeta?.figureTitle ?? '',
        sourcePage: record.sourcePage ?? payload.batchMeta?.sourcePage ?? '',
        sourcePdfPage: record.sourcePdfPage ?? 1,
      });
    }
  }

  return index;
}

function loadDivisionFigureCatalog(repoRoot: string): Map<string, FigureMetadata[]> {
  const catalog = new Map<string, FigureMetadata[]>();
  const rawDir = join(repoRoot, 'data/estimating/production-rates/raw');
  if (!existsSync(rawDir)) return catalog;

  for (const name of readdirSync(rawDir).filter((file) => file.endsWith('.json'))) {
    const payload = JSON.parse(readFileSync(join(rawDir, name), 'utf8')) as {
      batchMeta?: {
        division?: string;
        figure?: string;
        figureTitle?: string;
      };
      records?: Array<{ sourcePdfPage?: number | null; sourcePage?: string }>;
    };

    const division = payload.batchMeta?.division;
    const figure = payload.batchMeta?.figure;
    if (!division || !figure) continue;

    const pages = (payload.records ?? [])
      .map((record) => record.sourcePdfPage)
      .filter((page): page is number => typeof page === 'number' && page > 0);
    const sourcePdfPage = pages.length ? Math.min(...pages) : 1;
    const sourcePage =
      payload.records?.[0]?.sourcePage ??
      figure.replace(/^Figure\s+/i, '') ??
      figure;

    const entry: FigureMetadata = {
      figure,
      figureTitle: payload.batchMeta?.figureTitle ?? figure,
      sourcePage,
      sourcePdfPage,
    };

    const bucket = catalog.get(division) ?? [];
    if (!bucket.some((item) => item.figure === entry.figure)) {
      bucket.push(entry);
      catalog.set(division, bucket);
    }
  }

  for (const bucket of catalog.values()) {
    bucket.sort((a, b) => a.sourcePdfPage - b.sourcePdfPage);
  }

  return catalog;
}

function resolveFigureMetadata(
  row: AdobeFinalReviewedRow,
  legacyIndex: Map<string, FigureMetadata>,
  divisionCatalog: Map<string, FigureMetadata[]>,
  tableFilePages: Map<string, number>,
  tableOrdinalByDivision: Map<string, Map<string, number>>,
): FigureMetadata | null {
  const sectionCode = normalizeSectionCode(row.sectionCode ?? '');
  const itemCode = collapseWhitespace(row.itemCode ?? '');
  const legacyKey = sectionCode && itemCode ? `${sectionCode}|${itemCode}` : '';
  const legacy = legacyKey ? legacyIndex.get(legacyKey) : undefined;
  if (legacy?.figure && legacy.figureTitle && legacy.sourcePage && legacy.sourcePdfPage) {
    return legacy;
  }

  const division = collapseWhitespace(row.division ?? sectionCode.slice(0, 2));
  const pdfPage =
    row.sourcePageNumberApprox ??
    (row.sourceTableFile ? tableFilePages.get(row.sourceTableFile) : null) ??
    null;

  if (division && pdfPage != null) {
    const candidates = divisionCatalog.get(division) ?? [];
    let best: FigureMetadata | null = null;
    for (const candidate of candidates) {
      if (candidate.sourcePdfPage <= pdfPage) {
        best = candidate;
      } else {
        break;
      }
    }
    if (best) return { ...best, sourcePdfPage: pdfPage };
    if (candidates[0]) return { ...candidates[0], sourcePdfPage: pdfPage };
  }

  const annex = annexForDivision(division);
  const tableFile = row.sourceTableFile ?? '';
  if (!tableFile) return null;

  const perDivision = tableOrdinalByDivision.get(division) ?? new Map<string, number>();
  if (!tableOrdinalByDivision.has(division)) {
    tableOrdinalByDivision.set(division, perDivision);
  }
  if (!perDivision.has(tableFile)) {
    perDivision.set(tableFile, perDivision.size + 1);
  }
  const figureNumber = perDivision.get(tableFile) ?? 1;
  const figure = `Figure 5-${annex}-${figureNumber}`;
  return {
    figure,
    figureTitle: collapseWhitespace(row.sectionTitle ?? row.workElementDescription ?? figure),
    sourcePage: `5-${annex}-${figureNumber}`,
    sourcePdfPage: pdfPage ?? 1,
  };
}

function extractComponentHours(
  components: AdobeFinalReviewedRow['rateComponents'],
): {
  fabricateHours: number | null;
  erectStripHours: number | null;
  cleanMoveHours: number | null;
} {
  const lookup = new Map((components ?? []).map((item) => [item.name, item.manHoursPerUnit ?? null]));
  return {
    fabricateHours: lookup.get('fabricate') ?? null,
    erectStripHours: lookup.get('erectAndStrip') ?? lookup.get('erectStrip') ?? null,
    cleanMoveHours: lookup.get('cleanAndMove') ?? lookup.get('cleanMove') ?? null,
  };
}

function extractItemCode(row: AdobeFinalReviewedRow): string {
  if (row.itemCode) return collapseWhitespace(String(row.itemCode));
  const fromDescription = row.workElementDescription?.match(/\((\d{4})\)/);
  if (fromDescription) return fromDescription[1];
  if (Array.isArray(row.rawRow) && typeof row.rawRow[0] === 'string') {
    const fromRaw = row.rawRow[0].match(/\((\d{4})\)/);
    if (fromRaw) return fromRaw[1];
  }
  return '';
}

function validateAdobeRow(row: AdobeFinalReviewedRow): string[] {
  const reasons: string[] = [];
  const division = collapseWhitespace(row.division ?? row.sectionCode?.slice(0, 2) ?? '');
  const sectionCode = normalizeSectionCode(row.sectionCode ?? '');
  const itemCode = extractItemCode(row);
  const description = collapseWhitespace(row.workElementDescription ?? '');
  const unit = normalizeAdobeUnit(row.unit);
  const manHours = row.manHoursPerUnit;

  if (!division) reasons.push('divisionCode missing');
  if (!collapseWhitespace(row.divisionName ?? '')) reasons.push('divisionName missing');
  if (!sectionCode) reasons.push('workElementNumber missing');
  if (!itemCode) reasons.push('workElementLineNumber missing');
  if (!description) reasons.push('description/activityName missing');
  if (!unit) reasons.push('unitOfMeasure missing');
  if (unit.toLowerCase() === 'surface') reasons.push('unitOfMeasure cannot be "surface"');
  if (manHours == null || !Number.isFinite(manHours) || manHours <= 0) {
    reasons.push('manHoursPerUnit must be numeric and > 0');
  }
  if (!row.sourceTableFile) reasons.push('sourceTableFile missing');
  if (row.sourcePageNumberApprox == null && row.sourceAdobePageIndex == null && !row.sourceTableFile) {
    reasons.push('sourcePdfPage/sourcePage missing');
  }

  return reasons;
}

export function mapAdobeRowToApprovedRecord(
  row: AdobeFinalReviewedRow,
  figure: FigureMetadata,
  id: string,
  itemCode: string,
  now: string,
): NormalizedProductionRateRecord {
  const sectionCode = normalizeSectionCode(row.sectionCode ?? '');
  const division = collapseWhitespace(row.division ?? sectionCode.slice(0, 2));
  const { category, subcategory } = splitCategory(
    row.sectionTitle ?? '',
    row.workElementDescription ?? '',
  );
  const unitOfMeasure = normalizeAdobeUnit(row.unit);
  const activityName = collapseWhitespace(row.workElementDescription ?? '');
  const componentHours = extractComponentHours(row.rateComponents);
  const sourcePdfPage =
    row.sourcePageNumberApprox ??
    (typeof row.sourceAdobePageIndex === 'number' ? row.sourceAdobePageIndex + 1 : null);

  const notes: string[] = [];
  if (row.reviewNotes) notes.push(row.reviewNotes);
  if (row.reviewStatus) notes.push(`reviewStatus=${row.reviewStatus}`);

  return {
    id,
    sourceDocumentCode: SOURCE_DOCUMENT_CODE,
    sourceDocumentTitle: SOURCE_DOCUMENT_TITLE,
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    division,
    divisionName: collapseWhitespace(row.divisionName ?? ''),
    figure: figure.figure,
    figureTitle: figure.figureTitle,
    sourcePage: figure.sourcePage,
    sourcePdfPage: sourcePdfPage ?? figure.sourcePdfPage,
    workElementNumber: sectionCode,
    workElementLineNumber: itemCode,
    category,
    subcategory,
    activityName,
    description: activityName,
    unitOfMeasure,
    manHoursPerUnit: row.manHoursPerUnit ?? null,
    fabricateHours: componentHours.fabricateHours,
    erectStripHours: componentHours.erectStripHours,
    cleanMoveHours: componentHours.cleanMoveHours,
    crewSize: null,
    skilledTrade: null,
    skilledCount: null,
    laborerCount: null,
    equipmentOperatorCount: null,
    equipment: null,
    figureCrewNotes: null,
    figureNotes: row.sourceTableFile ? [`Adobe table ${row.sourceTableFile}`] : null,
    rowNotes: notes.length ? notes.join(' · ') : null,
    qaStatus: 'approved',
    extractionWarnings: [],
    extractionSource: 'adobe_pdf_extract',
    reviewStatus: 'final_reviewed',
    createdAt: now,
    updatedAt: now,
  };
}

export function importAdobeFinalReviewedProductionRates(
  rows: AdobeFinalReviewedRow[],
  options: ImportAdobeOptions,
): ImportAdobeResult {
  const now = options.now ?? new Date().toISOString();
  const legacyIndex = loadLegacyFigureIndex(options.repoRoot);
  const divisionCatalog = loadDivisionFigureCatalog(options.repoRoot);
  const tableFilePages = loadTableFilePageIndex(options.repoRoot);
  const tableOrdinalByDivision = new Map<string, Map<string, number>>();

  const approvedRecords: NormalizedProductionRateRecord[] = [];
  const rejectedRecords: ImportAdobeResult['rejected']['records'] = [];
  const idCounts = new Map<string, number>();
  let duplicateIdSuffixes = 0;

  for (const row of rows) {
    const validationReasons = validateAdobeRow(row);
    if (validationReasons.length > 0) {
      rejectedRecords.push({ ...row, rejectionReasons: validationReasons });
      continue;
    }

    const division = collapseWhitespace(row.division ?? row.sectionCode!.slice(0, 2));
    const sectionCode = normalizeSectionCode(row.sectionCode!);
    const itemCode = extractItemCode(row);
    if (!itemCode) {
      rejectedRecords.push({ ...row, rejectionReasons: ['workElementLineNumber missing'] });
      continue;
    }
    const baseId = buildDeterministicProductionRateId(division, sectionCode, itemCode);
    const seen = idCounts.get(baseId) ?? 0;
    idCounts.set(baseId, seen + 1);
    const id =
      seen > 0
        ? (duplicateIdSuffixes++, buildDeterministicProductionRateId(
            division,
            sectionCode,
            itemCode,
            row.sourceTableFile,
            true,
          ))
        : baseId;

    const figure = resolveFigureMetadata(
      row,
      legacyIndex,
      divisionCatalog,
      tableFilePages,
      tableOrdinalByDivision,
    );
    if (!figure?.figure || !figure.figureTitle || !figure.sourcePage || !figure.sourcePdfPage) {
      rejectedRecords.push({
        ...row,
        rejectionReasons: ['Could not resolve figure/sourcePage/sourcePdfPage metadata'],
      });
      continue;
    }

    const record = mapAdobeRowToApprovedRecord(row, figure, id, itemCode, now);
    const schemaResult = validateProductionRateRecord(record, approvedRecords.length, {
      expectedQaStatus: 'approved',
    });
    if (!schemaResult.valid) {
      rejectedRecords.push({
        ...row,
        rejectionReasons: schemaResult.errors.map((error) => `${error.field}: ${error.message}`),
      });
      continue;
    }

    approvedRecords.push(record);
  }

  const approved: NormalizedProductionRateFile = {
    batchMeta: {
      sourceDocumentCode: SOURCE_DOCUMENT_CODE,
      sourceDocumentTitle: SOURCE_DOCUMENT_TITLE,
      sourceDocumentFull: SOURCE_DOCUMENT_FULL,
      sourceEdition: SOURCE_EDITION,
      division: '03',
      divisionName: 'Chapter 5 — Adobe PDF Extract',
      figure: 'Figure 5-*',
      figureTitle: 'MCRP/NTRP Chapter 5 Production Rates (Adobe Extract)',
      extractedAt: now.slice(0, 10),
      promotedAt: now.slice(0, 10),
      approvedBy: 'adobe_pdf_extract',
      sourceCsv: ADOBE_FINAL_REVIEWED_RELATIVE_PATH,
      notes:
        'Imported from Adobe PDF Extract final-reviewed dataset. extractionSource=adobe_pdf_extract; reviewStatus=final_reviewed.',
    },
    records: approvedRecords,
  };

  return {
    approved,
    rejected: {
      generatedAt: now,
      sourceFile: ADOBE_FINAL_REVIEWED_RELATIVE_PATH,
      inputRowCount: rows.length,
      rejectedRowCount: rejectedRecords.length,
      records: rejectedRecords,
    },
    stats: {
      inputRowCount: rows.length,
      approvedRowCount: approvedRecords.length,
      rejectedRowCount: rejectedRecords.length,
      duplicateIdSuffixes,
    },
  };
}

export function loadAdobeFinalReviewedRows(repoRoot: string): AdobeFinalReviewedRow[] {
  const inputPath = join(repoRoot, ADOBE_FINAL_REVIEWED_RELATIVE_PATH);
  const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (Array.isArray(payload)) return payload as AdobeFinalReviewedRow[];
  if (Array.isArray(payload.records)) return payload.records as AdobeFinalReviewedRow[];
  throw new Error('Adobe final-reviewed dataset must be a JSON array or { records: [] }.');
}

export function resolveApprovedProductionRateFiles(approvedDir: string): string[] {
  const adobePath = join(approvedDir, ADOBE_APPROVED_OUTPUT);
  if (existsSync(adobePath)) {
    return [ADOBE_APPROVED_OUTPUT];
  }
  return readdirSync(approvedDir).filter((name) => name.endsWith('.approved.json'));
}
