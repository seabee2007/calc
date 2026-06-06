import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import { sanitizeEstimateExportFileStem } from '../importExport/estimateExportBuilder';

export interface DownloadLevelThreeGanttPdfParams {
  chartElement: HTMLElement;
  projectName: string;
  fileName?: string;
}

export function buildLevelThreeGanttPdfFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${stem}-level-iii-gantt-${year}-${month}-${day}.pdf`;
}

export async function downloadLevelThreeGanttPdfFromElement(
  params: DownloadLevelThreeGanttPdfParams,
): Promise<void> {
  const canvas = await html2canvas(params.chartElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: typeof window !== 'undefined' ? -window.scrollY : 0,
    windowWidth: params.chartElement.scrollWidth,
    width: params.chartElement.scrollWidth,
    height: params.chartElement.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= usableHeight;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    doc.addPage();
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  const fileName = params.fileName ?? buildLevelThreeGanttPdfFileName(params.projectName);
  await savePDFWithPlatformSupport(doc, fileName, 'Level III Gantt');
}
