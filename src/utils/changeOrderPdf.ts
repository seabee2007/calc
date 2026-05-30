import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { ChangeOrder } from '../types/changeOrder';
import {
  computeChangeOrderBreakdown,
  formatChangeOrderMoney,
} from './changeOrderFinancials';
import { savePDFWithPlatformSupport } from './pdf';

function formatSignedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy h:mm a');
  } catch {
    return iso;
  }
}

function addSection(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageWidth: number,
  pageHeight: number,
  title: string,
  body: string,
) {
  const maxWidth = pageWidth - margin * 2;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y.value);
  y.value += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(body, maxWidth);
  for (const line of lines) {
    if (y.value > pageHeight - margin) {
      doc.addPage();
      y.value = margin;
    }
    doc.text(line, margin, y.value);
    y.value += 5;
  }
  y.value += 4;
}

function addSignatureSection(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageWidth: number,
  pageHeight: number,
  role: string,
  name: string | null,
  signature: string | null,
  signedAt: string | null,
) {
  if (y.value > pageHeight - 50) {
    doc.addPage();
    y.value = margin;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(role, margin, y.value);
  y.value += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${name?.trim() || '—'}`, margin, y.value);
  y.value += 5;
  if (signature?.startsWith('data:image')) {
    try {
      doc.addImage(signature, 'PNG', margin, y.value, 60, 20);
      y.value += 24;
    } catch {
      doc.text('Signature: (image)', margin, y.value);
      y.value += 5;
    }
  } else if (signature?.trim()) {
    doc.setFont('helvetica', 'italic');
    doc.text(signature.trim(), margin, y.value);
    doc.setFont('helvetica', 'normal');
    y.value += 6;
  } else {
    doc.text('Signature: —', margin, y.value);
    y.value += 5;
  }
  doc.text(`Signed: ${formatSignedAt(signedAt)}`, margin, y.value);
  y.value += 10;
}

export async function generateChangeOrderPDF(order: ChangeOrder): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const y = { value: margin };

  const breakdown = computeChangeOrderBreakdown(
    order.laborItems,
    order.materialItems,
    order.equipmentItems,
    {
      feesAmount: order.feesAmount,
      permitsAmount: order.permitsAmount,
      overheadPercent: order.overheadPercent,
      profitPercent: order.profitPercent,
      markupPercent: order.markupPercent,
    },
  );

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(order.displayNumber ?? 'Change Order', margin, y.value);
  y.value += 8;
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(order.title, pageWidth - margin * 2);
  doc.text(titleLines, margin, y.value);
  y.value += titleLines.length * 6 + 4;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${format(new Date(), 'MMMM d, yyyy')}`, margin, y.value);
  y.value += 10;

  if (order.scopeDescription.trim()) {
    addSection(doc, y, margin, pageWidth, pageHeight, 'Scope of change', order.scopeDescription);
  }
  if (order.reasonForChange.trim()) {
    addSection(doc, y, margin, pageWidth, pageHeight, 'Reason for change', order.reasonForChange);
  }
  if (order.scheduleImpact?.trim()) {
    addSection(doc, y, margin, pageWidth, pageHeight, 'Schedule impact', order.scheduleImpact);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pricing summary', margin, y.value);
  y.value += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const totals = [
    `Total Direct Costs: ${formatChangeOrderMoney(breakdown.directCost)}`,
    `Total Indirect costs: ${formatChangeOrderMoney(breakdown.indirectCost)}`,
    `Total Change Order: ${formatChangeOrderMoney(breakdown.totalPrice)}`,
  ];
  for (const line of totals) {
    doc.text(line, margin, y.value);
    y.value += 6;
  }
  y.value += 4;

  if (order.terms?.trim()) {
    addSection(doc, y, margin, pageWidth, pageHeight, 'Terms', order.terms);
  }

  addSignatureSection(
    doc,
    y,
    margin,
    pageWidth,
    pageHeight,
    'Contractor',
    order.contractorName,
    order.contractorSignature,
    order.contractorSignedAt,
  );
  addSignatureSection(
    doc,
    y,
    margin,
    pageWidth,
    pageHeight,
    'Client',
    order.clientName,
    order.clientSignature,
    order.clientSignedAt,
  );

  const filename = `${(order.displayNumber ?? 'change-order').replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  await savePDFWithPlatformSupport(doc, filename, `Change Order — ${order.title}`);
}
