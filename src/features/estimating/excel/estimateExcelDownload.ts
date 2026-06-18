import * as XLSX from 'xlsx';
import type ExcelJS from 'exceljs';

export function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return output;
}

export async function downloadExcelJsWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  const buffer = workbookToArrayBuffer(workbook);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
