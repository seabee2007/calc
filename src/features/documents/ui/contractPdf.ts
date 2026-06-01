import jsPDF from 'jspdf';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import {
  addCompanyHeader,
  addTextSection,
  type FieldToolCompanyHeader,
} from '../../../utils/fieldToolPdfCommon';
import type { DocumentAssemblyResult, DocumentRiskScore } from '../index';

const RISK_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  extreme: 'Extreme',
};

/**
 * Export an assembled draft contract to PDF. Display/formatting only - all
 * document content comes from the engine's assembly result. Always stamps the
 * draft disclaimer and a contract risk summary.
 */
export async function exportContractDraftPdf(
  result: DocumentAssemblyResult,
  risk: DocumentRiskScore,
  company: FieldToolCompanyHeader,
): Promise<boolean> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 18;
  const y = { value: margin };

  addCompanyHeader(
    doc,
    y,
    margin,
    pageWidth,
    company,
    result.title || 'Residential Construction Agreement',
  );

  addTextSection(doc, y, margin, pageWidth, pageHeight, 'DRAFT - NOT LEGAL ADVICE', [
    result.disclaimer,
  ]);

  addTextSection(doc, y, margin, pageWidth, pageHeight, 'Contract risk summary', [
    `Score: ${risk.score} / 100 (${RISK_LABEL[risk.level] ?? risk.level})`,
    ...risk.factors.map((f) => `- ${f.label} (+${f.points})`),
  ]);

  for (const section of result.sections) {
    addTextSection(
      doc,
      y,
      margin,
      pageWidth,
      pageHeight,
      section.title,
      section.body.split('\n'),
    );
  }

  const clauseCount = Object.keys(result.manifest.clauseVersions).length;
  const addendumCount = Object.keys(result.manifest.addendumVersions).length;
  addTextSection(doc, y, margin, pageWidth, pageHeight, 'Document manifest', [
    `Pack: ${result.manifest.packKey} v${result.manifest.packVersion}`,
    `Generated: ${result.manifest.generatedAt}`,
    `Clauses: ${clauseCount} · Addenda: ${addendumCount}`,
  ]);

  const slug = (result.packKey || 'contract').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const filename = `contract-draft-${slug}-${Date.now()}.pdf`;
  return savePDFWithPlatformSupport(doc, filename, 'Residential Contract Draft');
}
