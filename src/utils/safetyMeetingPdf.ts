import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import type { SafetyMeeting } from '../types/fieldTools';
import { savePDFWithPlatformSupport } from './pdf';
import {
  addCompanyHeader,
  addTextSection,
  type FieldToolCompanyHeader,
} from './fieldToolPdfCommon';

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso + 'T12:00:00'), 'MMMM d, yyyy');
  } catch {
    return iso;
  }
}

export async function exportSafetyMeetingPdf(
  meeting: SafetyMeeting,
  company: FieldToolCompanyHeader,
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const y = { value: margin };

  addCompanyHeader(doc, y, margin, pageWidth, company, 'Daily Safety Meeting');

  addTextSection(doc, y, margin, pageWidth, pageHeight, 'Project information', [
    `Project: ${meeting.projectName || '—'}`,
    `Address: ${meeting.projectAddress || '—'}`,
    `Date: ${formatDate(meeting.meetingDate)}`,
    `Foreman / supervisor: ${meeting.supervisor || '—'}`,
    `Company: ${meeting.companyName || '—'}`,
    `Weather: ${meeting.weather || '—'}`,
    `Work activity: ${meeting.workActivity || '—'}`,
  ]);

  const jhaBody = meeting.jhaRows.map((r) => [
    r.task || '—',
    r.hazards || '—',
    r.controls || '—',
    r.ppe || '—',
    r.responsible || '—',
  ]);

  if (jhaBody.length > 0) {
    if (y.value > pageHeight - 40) {
      doc.addPage();
      y.value = margin;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Job Hazard Analysis', margin, y.value);
    y.value += 4;

    doc.autoTable({
      startY: y.value,
      head: [['Task / activity', 'Hazards', 'Controls', 'PPE', 'Responsible']],
      body: jhaBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [14, 116, 144] },
    });
    y.value = doc.lastAutoTable.finalY + 8;
  }

  const talk = meeting.toolboxContent;
  if (talk?.title) {
    addTextSection(doc, y, margin, pageWidth, pageHeight, `Toolbox talk — ${talk.title}`, [
      talk.explanation,
      '',
      'Key hazards:',
      ...talk.keyHazards.map((h) => `• ${h}`),
      '',
      'Safe work practices:',
      ...talk.safePractices.map((p) => `• ${p}`),
      '',
      `Crew reminder: ${talk.crewReminder}`,
      '',
      `Supervisor question: ${talk.supervisorQuestion}`,
    ]);
  }

  const attBody = meeting.attendees.map((a) => [
    a.workerName || '—',
    a.company || '—',
    a.signature?.trim() ? '(signed)' : '—',
    a.time || '—',
  ]);

  if (attBody.length > 0) {
    if (y.value > pageHeight - 40) {
      doc.addPage();
      y.value = margin;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance', margin, y.value);
    y.value += 4;

    doc.autoTable({
      startY: y.value,
      head: [['Worker name', 'Company', 'Signature', 'Time']],
      body: attBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [14, 116, 144] },
    });
    y.value = doc.lastAutoTable.finalY + 10;
  }

  if (y.value > pageHeight - 50) {
    doc.addPage();
    y.value = margin;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Supervisor acknowledgment', margin, y.value);
  y.value += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Supervisor: ${meeting.supervisor || '_________________________'}`, margin, y.value);
  y.value += 12;
  doc.text('Signature: _________________________   Date: _______________', margin, y.value);

  const slug = (meeting.projectName || 'safety-meeting').replace(/\s+/g, '-').slice(0, 40);
  const filename = `safety-meeting-${slug}-${Date.now()}.pdf`;
  await savePDFWithPlatformSupport(doc, filename, 'Daily Safety Meeting');
}
