import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { ConcreteInspectionChecklist, InspectionItem } from '../types/fieldTools';
import { savePDFWithPlatformSupport } from './pdf';
import {
  addCompanyHeader,
  addTextSection,
  statusLabel,
  type FieldToolCompanyHeader,
} from './fieldToolPdfCommon';
import { format } from 'date-fns';

const ACI_NOTE =
  'This checklist is general field guidance based on common concrete quality practices and references ACI 301 and ACI 318 concepts. Always follow the project specifications, approved drawings, local code, and engineer of record requirements.';

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso + 'T12:00:00'), 'MMMM d, yyyy');
  } catch {
    return iso;
  }
}

function itemsToTableBody(items: InspectionItem[]): string[][] {
  return items.map((item) => [item.label, statusLabel(item.status), item.notes || '—']);
}

function addChecklistTable(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageHeight: number,
  title: string,
  items: InspectionItem[],
) {
  if (items.length === 0) return;

  if (y.value > pageHeight - 40) {
    doc.addPage();
    y.value = margin;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y.value);
  y.value += 4;

  doc.autoTable({
    startY: y.value,
    head: [['Item', 'Status', 'Notes']],
    body: itemsToTableBody(items),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [14, 116, 144] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 18 },
      2: { cellWidth: 'auto' },
    },
  });
  y.value = doc.lastAutoTable.finalY + 8;
}

function addSignatureLine(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageHeight: number,
  role: string,
  signature: string,
) {
  if (y.value > pageHeight - 45) {
    doc.addPage();
    y.value = margin;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(role, margin, y.value);
  y.value += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (signature?.startsWith('data:image')) {
    try {
      doc.addImage(signature, 'PNG', margin, y.value, 60, 20);
      y.value += 24;
    } catch {
      doc.text('Signature: (on file)', margin, y.value);
      y.value += 6;
    }
  } else if (signature?.trim()) {
    doc.setFont('helvetica', 'italic');
    doc.text(signature.trim(), margin, y.value);
    doc.setFont('helvetica', 'normal');
    y.value += 8;
  } else {
    doc.text('Signature: _________________________', margin, y.value);
    y.value += 12;
  }
}

export async function exportConcreteInspectionPdf(
  checklist: ConcreteInspectionChecklist,
  company: FieldToolCompanyHeader,
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const y = { value: margin };

  addCompanyHeader(doc, y, margin, pageWidth, company, 'Concrete Inspection Checklist');

  addTextSection(doc, y, margin, pageWidth, pageHeight, 'Project information', [
    `Project: ${checklist.projectName || '—'}`,
    `Address: ${checklist.projectAddress || '—'}`,
    `Date: ${formatDate(checklist.inspectionDate)}`,
    `Inspector: ${checklist.inspector || '—'}`,
    `Contractor: ${checklist.contractor || '—'}`,
    `Mix design / PSI: ${checklist.mixDesign || '—'}`,
    `Placement type: ${checklist.placementType || '—'}`,
    `Pour area: ${checklist.pourArea || '—'}`,
    `Estimated CY: ${checklist.estimatedYards || '—'}`,
  ]);

  addChecklistTable(doc, y, margin, pageHeight, 'Pre-pour checklist', checklist.prePourItems);
  addChecklistTable(
    doc,
    y,
    margin,
    pageHeight,
    'During placement checklist',
    checklist.duringPlacementItems,
  );
  addChecklistTable(
    doc,
    y,
    margin,
    pageHeight,
    'Post-placement checklist',
    checklist.postPlacementItems,
  );

  if (checklist.notes?.trim()) {
    addTextSection(doc, y, margin, pageWidth, pageHeight, 'General notes', [checklist.notes]);
  }

  if (y.value > pageHeight - 50) {
    doc.addPage();
    y.value = margin;
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const noteLines = doc.splitTextToSize(ACI_NOTE, pageWidth - margin * 2);
  doc.text(noteLines, margin, y.value);
  y.value += noteLines.length * 4 + 10;

  addSignatureLine(doc, y, margin, pageHeight, 'Inspector', checklist.inspectorSignature);
  addSignatureLine(doc, y, margin, pageHeight, 'Contractor', checklist.contractorSignature);

  const slug = (checklist.projectName || 'inspection').replace(/\s+/g, '-').slice(0, 40);
  const filename = `concrete-inspection-${slug}-${Date.now()}.pdf`;
  await savePDFWithPlatformSupport(doc, filename, 'Concrete Inspection Checklist');
}
