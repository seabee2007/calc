import type jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface FieldToolCompanyHeader {
  companyName: string;
  address: string;
  phone: string;
  email?: string;
}

export function addCompanyHeader(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageWidth: number,
  company: FieldToolCompanyHeader,
  documentTitle: string,
) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(company.companyName || 'Concrete Calc', margin, y.value);
  y.value += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (company.address?.trim()) {
    const lines = doc.splitTextToSize(company.address, pageWidth - margin * 2);
    doc.text(lines, margin, y.value);
    y.value += lines.length * 4 + 2;
  }
  const contact: string[] = [];
  if (company.phone?.trim()) contact.push(company.phone);
  if (company.email?.trim()) contact.push(company.email);
  if (contact.length) {
    doc.text(contact.join(' · '), margin, y.value);
    y.value += 5;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(documentTitle, margin, y.value);
  y.value += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, y.value);
  y.value += 10;
}

export function addTextSection(
  doc: jsPDF,
  y: { value: number },
  margin: number,
  pageWidth: number,
  pageHeight: number,
  title: string,
  lines: string[],
) {
  const maxWidth = pageWidth - margin * 2;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y.value);
  y.value += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const line of lines) {
    if (!line.trim()) continue;
    const wrapped = doc.splitTextToSize(line, maxWidth);
    for (const w of wrapped) {
      if (y.value > pageHeight - margin) {
        doc.addPage();
        y.value = margin;
      }
      doc.text(w, margin, y.value);
      y.value += 5;
    }
  }
  y.value += 4;
}

export function statusLabel(status: string | null): string {
  if (status === 'pass') return 'Pass';
  if (status === 'fail') return 'Fail';
  if (status === 'na') return 'N/A';
  return '—';
}
