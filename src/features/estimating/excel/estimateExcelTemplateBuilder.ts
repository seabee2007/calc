import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { ActivityExcelEstimateType } from './estimateExcelTypes';
import {
  ESTIMATE_EXCEL_COMMON_UNITS,
  ESTIMATE_EXCEL_INSTRUCTIONS,
  ESTIMATE_EXCEL_LINE_COLUMNS,
  ESTIMATE_EXCEL_SHEET_NAMES,
  buildLookupValuesRows,
  buildSampleLineRow,
  getSchemaForEstimateType,
} from './estimateExcelSchemas';
import { ESTIMATE_EXCEL_SCHEMA_VERSION } from './estimateExcelTypes';
import { CSI_DIVISIONS } from '../domain/csiDivisions';
import { downloadExcelJsWorkbook } from './estimateExcelDownload';

function buildInstructionsSheet(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(ESTIMATE_EXCEL_INSTRUCTIONS.map((line) => [line]));
}

function buildEstimateInfoSheet(
  estimateType: ActivityExcelEstimateType,
  projectName: string,
): XLSX.WorkSheet {
  const generatedAt = new Date().toISOString();
  return XLSX.utils.aoa_to_sheet([
    ['Field', 'Value'],
    ['schema_version', ESTIMATE_EXCEL_SCHEMA_VERSION],
    ['estimate_type', estimateType],
    ['template_generated_at', generatedAt],
    ['project_name', projectName],
  ]);
}

function buildEstimateLinesSheet(estimateType: ActivityExcelEstimateType): XLSX.WorkSheet {
  const headers = ESTIMATE_EXCEL_LINE_COLUMNS.map((column) => column.key);
  const sample = buildSampleLineRow(estimateType);
  const sampleRow = headers.map((key) => sample[key] ?? '');
  return XLSX.utils.aoa_to_sheet([headers, sampleRow]);
}

function buildImportNotesSheet(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ['Import Notes'],
    ['Reserved for export round-trip notes.'],
  ]);
}

export function buildEstimateExcelTemplateWorkbook(
  estimateType: ActivityExcelEstimateType,
  projectName: string,
): XLSX.WorkBook {
  void getSchemaForEstimateType(estimateType);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildInstructionsSheet(), ESTIMATE_EXCEL_SHEET_NAMES.instructions);
  XLSX.utils.book_append_sheet(
    workbook,
    buildEstimateInfoSheet(estimateType, projectName),
    ESTIMATE_EXCEL_SHEET_NAMES.estimateInfo,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildEstimateLinesSheet(estimateType),
    ESTIMATE_EXCEL_SHEET_NAMES.estimateLines,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildLookupValuesRows()),
    ESTIMATE_EXCEL_SHEET_NAMES.lookupValues,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildImportNotesSheet(),
    ESTIMATE_EXCEL_SHEET_NAMES.importNotes,
  );
  return workbook;
}

// ---------------------------------------------------------------------------
// Styled ExcelJS template (download path only — parser/import unchanged)
// ---------------------------------------------------------------------------

const ARDEN_COLORS = {
  darkHeader:   'FF0F172A',
  accentHeader: 'FF0891B2',
  requiredFill: 'FFCFFAFE',
  optionalFill: 'FFF1F5F9',
  sectionFill:  'FF1E293B',
  lockedFill:   'FFE2E8F0',
  bodyFill:     'FFF8FAFC',
  guidanceFill: 'FFFFF9C4',
  white:        'FFFFFFFF',
  darkText:     'FF0F172A',
  mutedText:    'FF94A3B8',
} as const;

function applyHeaderCellStyle(
  cell: ExcelJS.Cell,
  argb: string,
  fontColor: string = ARDEN_COLORS.white,
  fontSize: number = 11,
): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.font = { bold: true, color: { argb: fontColor }, size: fontSize };
  cell.alignment = { vertical: 'middle', wrapText: false };
}

function applyBodyCellStyle(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  return { top: side, bottom: side, left: side, right: side };
}

function buildStyledInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const ws = workbook.addWorksheet(ESTIMATE_EXCEL_SHEET_NAMES.instructions);
  ws.getColumn(1).width = 90;

  ws.addRow(['Arden Project OS']);
  applyHeaderCellStyle(ws.getCell('A1'), ARDEN_COLORS.darkHeader, ARDEN_COLORS.white, 14);
  ws.getRow(1).height = 28;

  ws.addRow(['Detailed / Bid Estimate Template']);
  applyHeaderCellStyle(ws.getCell('A2'), ARDEN_COLORS.accentHeader, ARDEN_COLORS.white, 11);
  ws.getRow(2).height = 22;

  ws.addRow(['']);

  const sections: [string, string[]][] = [
    ['Before you start', [
      'Do not edit schema_version, estimate_type, or sheet names.',
      'Fill in the Estimate Lines sheet only. Arden recalculates all totals on import.',
      'Do not add Excel formulas or enter totals — they are ignored on import.',
      'Delete the sample row (row 3 of Estimate Lines) before importing.',
    ]],
    ['Required columns', [
      'division_code, division_name, activity_name, line_item_description, quantity, unit.',
      'All six must be present and non-blank for a row to be imported.',
    ]],
    ['How activities are grouped', [
      'Rows with the same division_code + activity_code become one construction activity.',
      'If activity_code is blank, rows are grouped by division_code + activity_name instead.',
    ]],
    ['Production rates and pricing', [
      'production_rate_id is optional. Leave blank to provide man_hours_per_unit directly.',
      'If both are blank the row is imported as an unpriced shell.',
      'material_unit_cost, equipment_unit_cost, subcontractor_unit_cost are also optional.',
    ]],
    ['Import step', [
      'Use File → Import Estimate Lines in the Estimate workspace.',
      'Use the matching template for your estimate type (detailed or bid).',
      'Arden will show you a preview before any data is saved.',
    ]],
    ['Need help?', [
      'See the Lookup Values sheet for CSI division codes and unit abbreviations.',
      'See the Import Notes sheet for common import errors and troubleshooting.',
    ]],
  ];

  for (const [heading, bullets] of sections) {
    ws.addRow(['']);
    const headRow = ws.addRow([`  ${heading}`]);
    applyHeaderCellStyle(headRow.getCell(1), ARDEN_COLORS.sectionFill, ARDEN_COLORS.white, 10);
    headRow.height = 18;
    for (const bullet of bullets) {
      const bodyRow = ws.addRow([`     • ${bullet}`]);
      applyBodyCellStyle(bodyRow.getCell(1), ARDEN_COLORS.bodyFill);
      bodyRow.height = 16;
    }
  }

  void ESTIMATE_EXCEL_INSTRUCTIONS;
}

function buildStyledEstimateInfoSheet(
  workbook: ExcelJS.Workbook,
  estimateType: ActivityExcelEstimateType,
  projectName: string,
): void {
  const ws = workbook.addWorksheet(ESTIMATE_EXCEL_SHEET_NAMES.estimateInfo);
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 38;

  const headerRow = ws.addRow(['Field', 'Value']);
  applyHeaderCellStyle(headerRow.getCell(1), ARDEN_COLORS.sectionFill);
  applyHeaderCellStyle(headerRow.getCell(2), ARDEN_COLORS.sectionFill);
  headerRow.height = 20;

  const generatedAt = new Date().toISOString();

  const lockedRows: [string, string][] = [
    ['schema_version', ESTIMATE_EXCEL_SCHEMA_VERSION],
    ['estimate_type', estimateType],
    ['template_generated_at', generatedAt],
  ];

  for (const [field, value] of lockedRows) {
    const row = ws.addRow([field, value]);
    applyBodyCellStyle(row.getCell(1), ARDEN_COLORS.bodyFill);
    row.getCell(1).font = { color: { argb: ARDEN_COLORS.darkText } };
    applyBodyCellStyle(row.getCell(2), ARDEN_COLORS.lockedFill);
    row.getCell(2).font = { italic: true, color: { argb: ARDEN_COLORS.darkText } };
    row.height = 18;
  }

  const projectRow = ws.addRow(['project_name', projectName]);
  applyBodyCellStyle(projectRow.getCell(1), ARDEN_COLORS.bodyFill);
  projectRow.getCell(1).font = { color: { argb: ARDEN_COLORS.darkText } };
  applyBodyCellStyle(projectRow.getCell(2), ARDEN_COLORS.white);
  projectRow.getCell(2).font = { color: { argb: ARDEN_COLORS.darkText } };
  projectRow.height = 18;
}

function buildStyledEstimateLinesSheet(
  workbook: ExcelJS.Workbook,
  estimateType: ActivityExcelEstimateType,
): void {
  const ws = workbook.addWorksheet(ESTIMATE_EXCEL_SHEET_NAMES.estimateLines);
  const colCount = ESTIMATE_EXCEL_LINE_COLUMNS.length;

  // Set column widths
  for (let i = 0; i < ESTIMATE_EXCEL_LINE_COLUMNS.length; i++) {
    const col = ESTIMATE_EXCEL_LINE_COLUMNS[i]!;
    ws.getColumn(i + 1).width = col.columnWidth ?? 14;
  }

  // --- Row 1: column headers (schema keys as header text for parser compatibility,
  //     displayed as human-readable labels — normalizeHeaderKey maps them back to keys)
  const headerLabels = ESTIMATE_EXCEL_LINE_COLUMNS.map((c) => c.label);
  const headerRow = ws.addRow(headerLabels);
  headerRow.height = 20;
  for (let i = 0; i < ESTIMATE_EXCEL_LINE_COLUMNS.length; i++) {
    const col = ESTIMATE_EXCEL_LINE_COLUMNS[i]!;
    const cell = headerRow.getCell(i + 1);
    applyHeaderCellStyle(
      cell,
      col.required ? ARDEN_COLORS.requiredFill : ARDEN_COLORS.optionalFill,
      ARDEN_COLORS.darkText,
      10,
    );
    cell.border = thinBorder();
  }

  // --- Row 2: inline guidance note (merged across all columns)
  const lastColLetter = ws.getColumn(colCount).letter;
  ws.mergeCells(`A2:${lastColLetter}2`);
  const guidanceCell = ws.getCell('A2');
  guidanceCell.value =
    '↑ Blue = required  |  Delete this row and the sample row below before importing  |  ' +
    'Totals are recalculated in Arden — do not add Excel formulas  |  Do not rename column headers';
  guidanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARDEN_COLORS.guidanceFill } };
  guidanceCell.font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
  guidanceCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  ws.getRow(2).height = 18;

  // --- Row 3: sample data row (italic, muted)
  const sample = buildSampleLineRow(estimateType);
  const sampleValues = ESTIMATE_EXCEL_LINE_COLUMNS.map((c) => sample[c.key] ?? '');
  const sampleRow = ws.addRow(sampleValues);
  sampleRow.height = 18;
  for (let i = 0; i < colCount; i++) {
    const cell = sampleRow.getCell(i + 1);
    cell.font = { italic: true, color: { argb: ARDEN_COLORS.mutedText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARDEN_COLORS.bodyFill } };
    cell.border = thinBorder();
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // AutoFilter on header row
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } };

  // Data validations — apply from row 4 onwards (rows 1-3 are header/guidance/sample)
  const unitColIdx = ESTIMATE_EXCEL_LINE_COLUMNS.findIndex((c) => c.key === 'unit') + 1;
  const schedColIdx = ESTIMATE_EXCEL_LINE_COLUMNS.findIndex((c) => c.key === 'schedule_enabled') + 1;
  const divColIdx = ESTIMATE_EXCEL_LINE_COLUMNS.findIndex((c) => c.key === 'division_code') + 1;

  const unitColLetter = ws.getColumn(unitColIdx).letter;
  const schedColLetter = ws.getColumn(schedColIdx).letter;
  const divColLetter = ws.getColumn(divColIdx).letter;

  ws.dataValidations.add(`${unitColLetter}4:${unitColLetter}10000`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${ESTIMATE_EXCEL_COMMON_UNITS.join(',')}"`],
  });

  ws.dataValidations.add(`${schedColLetter}4:${schedColLetter}10000`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"TRUE,FALSE"'],
  });

  const divisionCodes = CSI_DIVISIONS.slice(0, 20).map((d) => d.code).join(',');
  ws.dataValidations.add(`${divColLetter}4:${divColLetter}10000`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${divisionCodes}"`],
  });
}

function buildStyledLookupValuesSheet(workbook: ExcelJS.Workbook): void {
  const ws = workbook.addWorksheet(ESTIMATE_EXCEL_SHEET_NAMES.lookupValues);
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 40;

  const addSectionHeader = (label: string) => {
    const row = ws.addRow([label]);
    applyHeaderCellStyle(row.getCell(1), ARDEN_COLORS.sectionFill, ARDEN_COLORS.white, 10);
    ws.mergeCells(`A${row.number}:C${row.number}`);
    row.height = 18;
  };

  const addBodyRow = (values: (string | number)[], shade: boolean) => {
    const row = ws.addRow(values);
    const argb = shade ? ARDEN_COLORS.bodyFill : ARDEN_COLORS.white;
    for (let i = 1; i <= 3; i++) {
      applyBodyCellStyle(row.getCell(i), argb);
      row.getCell(i).font = { size: 10, color: { argb: ARDEN_COLORS.darkText } };
    }
    row.height = 16;
  };

  // CSI Divisions
  addSectionHeader('CSI Divisions');
  const subHeaderRow = ws.addRow(['', 'Code', 'Name']);
  applyHeaderCellStyle(subHeaderRow.getCell(2), ARDEN_COLORS.accentHeader, ARDEN_COLORS.white, 10);
  applyHeaderCellStyle(subHeaderRow.getCell(3), ARDEN_COLORS.accentHeader, ARDEN_COLORS.white, 10);
  subHeaderRow.height = 18;

  CSI_DIVISIONS.slice(0, 20).forEach((division, idx) => {
    addBodyRow(['', division.code, division.name], idx % 2 === 0);
  });

  ws.addRow(['']);

  // Common Units
  addSectionHeader('Common Units');
  ESTIMATE_EXCEL_COMMON_UNITS.forEach((unit, idx) => {
    addBodyRow(['', unit, ''], idx % 2 === 0);
  });

  ws.addRow(['']);

  // Example production_rate_id values
  addSectionHeader('Example production_rate_id values');
  const exampleRates = [
    '03-31-00-footings-direct-chute',
    '03-11-13.65-0040',
    '06-10-00-0100',
  ];
  exampleRates.forEach((id, idx) => {
    addBodyRow(['', id, ''], idx % 2 === 0);
  });
}

function buildStyledImportNotesSheet(workbook: ExcelJS.Workbook): void {
  const ws = workbook.addWorksheet(ESTIMATE_EXCEL_SHEET_NAMES.importNotes);
  ws.getColumn(1).width = 100;

  const addHeading = (text: string) => {
    const row = ws.addRow([`  ${text}`]);
    applyHeaderCellStyle(row.getCell(1), ARDEN_COLORS.sectionFill, ARDEN_COLORS.white, 10);
    row.height = 20;
  };

  const addBody = (text: string, shade = false) => {
    const row = ws.addRow([`     ${text}`]);
    applyBodyCellStyle(row.getCell(1), shade ? ARDEN_COLORS.bodyFill : ARDEN_COLORS.white);
    row.getCell(1).font = { size: 10, color: { argb: ARDEN_COLORS.darkText } };
    row.getCell(1).alignment = { vertical: 'middle', wrapText: true };
    row.height = 16;
  };

  const addBlank = () => ws.addRow(['']);

  ws.addRow(['Import Notes — Arden Project OS Estimate Template']);
  applyHeaderCellStyle(ws.getCell('A1'), ARDEN_COLORS.darkHeader, ARDEN_COLORS.white, 12);
  ws.getRow(1).height = 26;
  addBlank();

  addHeading('How rows become activities');
  addBody('Rows with the same division_code + activity_code are grouped into one construction activity.', true);
  addBody('If activity_code is blank, rows are grouped by division_code + activity_name.', false);
  addBody('Each group becomes one activity with multiple line items.', true);
  addBlank();

  addHeading('Totals are recalculated on import');
  addBody('Do not enter total costs or totals into any column.', true);
  addBody('Arden calculates all totals from quantity × unit costs and production rates.', false);
  addBody('Any Excel formula in the sheet is ignored — only cell values are read.', true);
  addBlank();

  addHeading('Required vs optional columns');
  addBody('Required (highlighted blue): division_code, division_name, activity_name, line_item_description, quantity, unit.', true);
  addBody('Optional: activity_code, production_rate_id, man_hours_per_unit, crew_size, labor_role,', false);
  addBody('         material_unit_cost, equipment_unit_cost, subcontractor_unit_cost, schedule_enabled, notes.', true);
  addBlank();

  addHeading('Unpriced rows');
  addBody('If production_rate_id and man_hours_per_unit are both blank, the row imports as an unpriced shell.', true);
  addBody('Unpriced rows are importable but will show a warning in the preview.', false);
  addBlank();

  addHeading('Common import errors');
  addBody('• Missing required column: all six required columns must be present as column headers.', true);
  addBody('• Wrong estimate_type: the template estimate type must match the estimate you are importing into.', false);
  addBody('• Bad division_code: use two-digit CSI codes (00–48). See the Lookup Values sheet.', true);
  addBody('• Renamed headers: do not rename column headers. The importer matches them by name.', false);
  addBody('• Blank activity_name with blank activity_code: at least one must be present.', true);
  addBlank();

  addHeading('Do not modify these fields in Estimate Info');
  addBody('schema_version and estimate_type control how the file is parsed.', true);
  addBody('Changing them will cause the import to fail or produce incorrect results.', false);
  addBlank();

  addHeading('Before importing');
  addBody('Delete row 2 (guidance note) and row 3 (sample row) from the Estimate Lines sheet.', true);
  addBody('Or leave them — the importer will skip blank/guidance rows automatically.', false);
}

export async function buildStyledEstimateExcelTemplate(
  estimateType: ActivityExcelEstimateType,
  projectName: string,
): Promise<ExcelJS.Workbook> {
  void getSchemaForEstimateType(estimateType);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Arden Project OS';
  workbook.created = new Date();

  buildStyledInstructionsSheet(workbook);
  buildStyledEstimateInfoSheet(workbook, estimateType, projectName);
  buildStyledEstimateLinesSheet(workbook, estimateType);
  buildStyledLookupValuesSheet(workbook);
  buildStyledImportNotesSheet(workbook);

  return workbook;
}

export async function downloadEstimateExcelTemplate(
  estimateType: ActivityExcelEstimateType,
  projectName: string,
): Promise<void> {
  const safeProject = projectName.trim() || 'project';
  const workbook = await buildStyledEstimateExcelTemplate(estimateType, safeProject);
  await downloadExcelJsWorkbook(
    workbook,
    `${safeProject}-${estimateType}-estimate-template.xlsx`,
  );
}
