import { Lock } from 'lucide-react';
import type {
  DocumentComplianceIssue,
  DocumentRiskScore,
  DocumentSection,
} from '../../types';
import { cleanDocumentBody } from '../previewDisplay';
import {
  buildResidentialContractDisplayContext,
  filterVisibleRows,
} from './residentialContractContext';
import { DOCUMENT_HEADER_LOGO_CLASS } from '../components/documentHeaderTheme';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';

const RISK_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  extreme: 'Extreme',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-xs font-semibold uppercase text-slate-500 sm:w-40">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
    </div>
  );
}

function SignatureBlock({ role, name }: { role: string; name: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>
      <p className="mt-2 text-sm text-slate-900">
        <span className="font-medium">Printed name:</span>{' '}
        {name?.trim() ? name : <span className="italic text-slate-400">Not provided</span>}
      </p>
      <div className="mt-3 min-h-[3rem] border-b border-slate-300">
        <p className="text-xs text-slate-400">Signature</p>
      </div>
      <p className="mt-2 text-xs text-slate-400">Date</p>
    </div>
  );
}

function renderSectionBody(body: string) {
  const cleaned = cleanDocumentBody(body);
  if (!cleaned) {
    return <p className="mt-2 text-sm italic text-slate-400">Not provided</p>;
  }

  const paragraphs = cleaned.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="mt-2 space-y-3">
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n');
        const isList = lines.every((line) => line.trim().startsWith('-'));
        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-800">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineText(line.replace(/^\s*-\s*/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? '\n' : null}
                {renderInlineText(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineText(text: string) {
  const marker = 'Not provided';
  if (!text.includes(marker)) return text;
  const parts = text.split(marker);
  return parts.map((part, index) => (
    <span key={index}>
      {part}
      {index < parts.length - 1 && (
        <span className="italic text-slate-400">{marker}</span>
      )}
    </span>
  ));
}

export interface ResidentialContractDocumentProps {
  sections: DocumentSection[];
  documentTitle: string;
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  disclaimer: string;
  risk?: DocumentRiskScore;
  complianceIssues?: DocumentComplianceIssue[];
}

export default function ResidentialContractDocument({
  sections,
  documentTitle,
  answers,
  selectedProject,
  companySettings,
  disclaimer,
  risk,
  complianceIssues = [],
}: ResidentialContractDocumentProps) {
  const context = buildResidentialContractDisplayContext({
    answers,
    companySettings,
    selectedProject,
  });
  const partyRows = filterVisibleRows(context.parties);
  const summaryRows = filterVisibleRows(context.summary);
  const majorWarnings = complianceIssues.filter(
    (issue) => issue.severity === 'warning' || issue.severity === 'blocker',
  ).length;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden bg-white p-6 text-slate-950 print:bg-white print:text-black">
      {/* Header */}
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {context.company.logoUrl ? (
              <img
                src={context.company.logoUrl}
                alt=""
                className={DOCUMENT_HEADER_LOGO_CLASS}
              />
            ) : null}
            <p className="text-lg font-bold text-slate-900">{context.company.name}</p>
            {context.company.address ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {context.company.address}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {context.company.phone ? <span>{context.company.phone}</span> : null}
              {context.company.email ? <span>{context.company.email}</span> : null}
              {context.company.licenseNumber ? (
                <span>License {context.company.licenseNumber}</span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
              Residential Contract
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Draft</p>
            <p className="mt-1 text-xs text-slate-600">Date: {context.documentDate}</p>
          </div>
        </div>
      </header>

      {/* Document title */}
      {documentTitle?.trim() ? (
        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Document
          </p>
          <p className="mt-1 text-base font-semibold text-slate-950">{documentTitle.trim()}</p>
        </section>
      ) : null}

      {/* Parties card */}
      {partyRows.length > 0 ? (
        <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project &amp; parties
          </p>
          <div className="mt-2">
            {partyRows.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Summary boxes */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {summaryRows.length > 0 ? (
          <section className="rounded-lg border border-slate-200 p-4 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contract summary
            </p>
            <div className="mt-2 space-y-2">
              {summaryRows.map((row) => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-500">{row.label}</span>
                  <span className="text-sm text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={`rounded-lg border border-amber-200 bg-amber-50/80 p-4 ${
            summaryRows.length > 0 ? 'lg:col-span-1' : 'lg:col-span-2'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Legal / draft notice
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-950">{disclaimer}</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
            Attorney review is recommended. Verify all state, local, licensing, permit, lien,
            notice, warranty, and cancellation requirements before use.
          </p>
        </section>

        {risk ? (
          <section className="rounded-lg border border-slate-200 p-4 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Risk summary
            </p>
            <div className="mt-2 space-y-2 text-sm text-slate-900">
              <p>
                <span className="font-medium">Score:</span> {risk.score} / 100
              </p>
              <p>
                <span className="font-medium">Level:</span>{' '}
                {RISK_LABEL[risk.level] ?? risk.level}
              </p>
              {majorWarnings > 0 ? (
                <p>
                  <span className="font-medium">Compliance flags:</span> {majorWarnings}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {/* Contract sections */}
      <section className="mt-8 space-y-8">
        {sections.map((section) => {
          const isLockedNotice = section.clauseKey.startsWith('notice.');
          return (
            <article
              key={section.clauseKey}
              className={
                isLockedNotice
                  ? 'rounded-lg border border-amber-300 bg-amber-50/60 p-4'
                  : 'border-t border-slate-200 pt-6 first:border-t-0 first:pt-0'
              }
            >
              <div className="flex items-center gap-2">
                {isLockedNotice ? (
                  <Lock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                ) : null}
                <h3 className="text-base font-semibold text-slate-950">{section.title}</h3>
              </div>
              {renderSectionBody(section.body)}
            </article>
          );
        })}
      </section>

      {/* Signatures */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <SignatureBlock role="Contractor" name={context.signatures.contractorName} />
        <SignatureBlock role="Owner / Client" name={context.signatures.ownerName} />
      </section>
    </div>
  );
}
