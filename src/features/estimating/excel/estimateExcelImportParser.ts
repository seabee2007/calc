import * as XLSX from 'xlsx';
import { loadApprovedProductionRateLibrary } from '../data/productionRates/productionRateLibrary';
import { getProductionRateLibraryEntryById } from '../data/productionRates/productionRateLibrary';
import type { ActivityExcelEstimateType, ActivityExcelImportPreview, ActivityExcelParseResult } from './estimateExcelTypes';
import { ESTIMATE_EXCEL_SCHEMA_VERSION } from './estimateExcelTypes';
import { ESTIMATE_EXCEL_SHEET_NAMES } from './estimateExcelSchemas';
import {
  collectExistingDuplicateKeys,
  countRowsByStatus,
  finalizeGroupImportability,
  groupLineRowsIntoActivities,
  importableRowCount,
  mapRawRowToLineRow,
  parseEstimateLinesSheetRows,
  validateLineRows,
} from './estimateExcelValidation';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
}

function readEstimateInfo(workbook: XLSX.WorkBook) {
  const rows = readSheetRows(workbook, ESTIMATE_EXCEL_SHEET_NAMES.estimateInfo);
  const info: Record<string, string> = {};
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const key = String(row[0] ?? '').trim().toLowerCase();
    const value = String(row[1] ?? '').trim();
    if (key) info[key] = value;
  }
  return {
    schemaVersion: info.schema_version ?? '',
    estimateType: (info.estimate_type as ActivityExcelEstimateType | undefined) ?? null,
    templateGeneratedAt: info.template_generated_at ?? null,
    projectName: info.project_name ?? null,
  };
}

export interface ParseActivityExcelFileInput {
  file: File;
  expectedEstimateType: ActivityExcelEstimateType;
  existingActivities?: readonly ProjectConstructionActivity[];
  existingLineItemsByActivityId?: ReadonlyMap<string, readonly ProjectActivityLineItem[]>;
}

export async function parseActivityExcelFile(
  input: ParseActivityExcelFileInput,
): Promise<ActivityExcelParseResult> {
  const errors: string[] = [];
  const buffer = await input.file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    return { preview: null, importableGroups: [], errors: ['Could not read the selected Excel file.'] };
  }

  const workbookInfo = readEstimateInfo(workbook);
  if (!workbookInfo.schemaVersion) {
    errors.push('Missing schema_version in Estimate Info sheet.');
  } else if (workbookInfo.schemaVersion !== ESTIMATE_EXCEL_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schema_version "${workbookInfo.schemaVersion}". Expected "${ESTIMATE_EXCEL_SCHEMA_VERSION}".`,
    );
  }

  if (!workbookInfo.estimateType) {
    errors.push('Missing estimate_type in Estimate Info sheet.');
  } else if (workbookInfo.estimateType !== input.expectedEstimateType) {
    errors.push(
      `Workbook estimate_type "${workbookInfo.estimateType}" does not match current estimate type "${input.expectedEstimateType}".`,
    );
  }

  const sheetRows = readSheetRows(workbook, ESTIMATE_EXCEL_SHEET_NAMES.estimateLines);
  if (sheetRows.length === 0) {
    errors.push(`Missing "${ESTIMATE_EXCEL_SHEET_NAMES.estimateLines}" sheet or it is empty.`);
  }

  if (errors.length > 0) {
    return {
      preview: {
        workbookInfo,
        activityCount: 0,
        lineItemCount: 0,
        validCount: 0,
        warningCount: 0,
        blockedCount: 0,
        duplicateCount: 0,
        unpricedCount: 0,
        groups: [],
        rowResults: [],
        warnings: [],
        errors,
      },
      importableGroups: [],
      errors,
    };
  }

  const { rows: rawRows, missingColumns } = parseEstimateLinesSheetRows(sheetRows);
  if (missingColumns.length > 0) {
    errors.push(`Missing required columns: ${missingColumns.join(', ')}.`);
    return {
      preview: {
        workbookInfo,
        activityCount: 0,
        lineItemCount: 0,
        validCount: 0,
        warningCount: 0,
        blockedCount: 0,
        duplicateCount: 0,
        unpricedCount: 0,
        groups: [],
        rowResults: [],
        warnings: [],
        errors,
      },
      importableGroups: [],
      errors,
    };
  }

  await loadApprovedProductionRateLibrary();

  const existingDuplicateKeys = collectExistingDuplicateKeys(
    input.existingActivities ?? [],
    input.existingLineItemsByActivityId ?? new Map(),
  );

  const lineRows = validateLineRows({
    rows: rawRows.map(mapRawRowToLineRow),
    existingDuplicateKeys,
    productionRateLookup: (id) => getProductionRateLibraryEntryById(id),
  });

  const groups = finalizeGroupImportability(groupLineRowsIntoActivities(lineRows));
  const counts = countRowsByStatus(lineRows);
  const importableGroups = groups.filter((group) => group.importable);
  const importableRows = importableRowCount(lineRows);

  const preview: ActivityExcelImportPreview = {
    workbookInfo,
    activityCount: groups.length,
    lineItemCount: lineRows.filter((row) => row.lineItemDescription || row.activityName).length,
    validCount: counts.valid,
    warningCount: counts.warning,
    blockedCount: counts.blocked,
    duplicateCount: counts.duplicate,
    unpricedCount: counts.unpriced,
    groups,
    rowResults: lineRows,
    warnings: [],
    errors,
  };

  return {
    preview,
    importableGroups,
    errors,
  };
}

export function previewImportableRowCount(preview: ActivityExcelImportPreview): number {
  return importableRowCount(preview.rowResults);
}
