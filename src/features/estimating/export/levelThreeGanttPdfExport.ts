import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import { sanitizeEstimateExportFileStem } from '../importExport/estimateExportBuilder';

export const LEVEL_THREE_GANTT_PDF_TITLE = 'Level III Gantt';

export interface DownloadLevelThreeGanttPdfParams {
  chartElement: HTMLElement;
  projectName: string;
  fileName?: string;
}

export function createLevelThreeGanttPdf(): jsPDF {
  return new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'legal',
  });
}

export function isLandscapePdf(doc: jsPDF): boolean {
  return doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight();
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
  const doc = createLevelThreeGanttPdf();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerHeight = 12;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - headerHeight;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(LEVEL_THREE_GANTT_PDF_TITLE, margin, margin + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Project: ${params.projectName}`, margin, margin + 10);

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imageTop = margin + headerHeight;

  let heightLeft = imgHeight;
  let position = imageTop;

  doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= usableHeight;

  while (heightLeft > 0) {
    position = imageTop - (imgHeight - heightLeft);
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(LEVEL_THREE_GANTT_PDF_TITLE, margin, margin + 4);
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  const fileName = params.fileName ?? buildLevelThreeGanttPdfFileName(params.projectName);
  await savePDFWithPlatformSupport(doc, fileName, LEVEL_THREE_GANTT_PDF_TITLE);
}
