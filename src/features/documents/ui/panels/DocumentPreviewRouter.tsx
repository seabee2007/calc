import { useMemo, useState, useEffect, type ReactNode } from 'react';
import type { Project } from '../../../../types/index';
import type { ContractDocumentVersionRow } from '../../services/contractDocumentTypes';
import type { DocumentComplianceIssue, DocumentRiskScore } from '../../types';
import ChangeOrderDocument from '../../../../components/change-order/ChangeOrderDocument';
import { buildChangeOrderPreviewFromDocumentAnswers } from '../adapters/changeOrderPreviewAdapter';
import { buildRfiPreviewFromDocumentAnswers } from '../adapters/rfiPreviewAdapter';
import { buildSubmittalPreviewFromDocumentAnswers } from '../adapters/submittalPreviewAdapter';
import { buildDailyReportPreviewFromDocumentAnswers } from '../adapters/dailyReportPreviewAdapter';
import { buildQcReportPreviewFromDocumentAnswers } from '../adapters/qcReportPreviewAdapter';
import { buildWarrantyCloseoutPreviewFromDocumentAnswers } from '../adapters/warrantyCloseoutPreviewAdapter';
import { buildPunchListPreviewFromDocumentAnswers } from '../adapters/punchListPreviewAdapter';
import DailyReportDocument from '../renderers/DailyReportDocument';
import PunchListDocument from '../renderers/PunchListDocument';
import QcReportDocument from '../renderers/QcReportDocument';
import WarrantyCloseoutDocument from '../renderers/WarrantyCloseoutDocument';
import ResidentialContractDocument from '../renderers/ResidentialContractDocument';
import RfiDocument from '../renderers/RfiDocument';
import FarDocument from '../renderers/FarDocument';
import { buildFarPreviewFromDocumentAnswers } from '../adapters/farPreviewAdapter';
import SubmittalDocument from '../renderers/SubmittalDocument';
import PreviewPanel, { type PreviewPanelProps } from './PreviewPanel';
import type { DocumentCompanySettings } from '../documentCompanySettings';

interface DocumentPreviewRouterProps extends PreviewPanelProps {
  /** `assembly.documentType` — primary signal for renderer selection. */
  documentType: string;
  /** `packKey` — secondary signal; 'GENERIC_CHANGE_ORDER' also triggers CO renderer. */
  packKey: string;
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: DocumentCompanySettings;
  /** Document title from the builder state — forwarded to dedicated renderers. */
  title?: string;
  disclaimer?: string;
  risk?: DocumentRiskScore;
  complianceIssues?: DocumentComplianceIssue[];
  /**
   * When a saved version is being previewed, fall back to `PreviewPanel` so
   * historical section snapshots remain faithful and read-only.
   */
  previewVersion?: ContractDocumentVersionRow | null;
  /** Audience forwarded to ChangeOrderDocument. Defaults to 'client'. */
  audience?: 'client' | 'internal';
  /**
   * Accepted recommendation clause keys from the builder. Their language is
   * appended to `order.terms` so accepted clauses are visible in the preview.
   */
  accepted?: string[];
}

function PaperPreviewShell({
  audience,
  children,
}: {
  audience?: 'client' | 'internal';
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Paper preview
        </span>
        {audience === 'internal' && (
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
            Internal view
          </span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/**
 * Selects the correct preview renderer based on document type / pack key.
 *
 * - `change_order` or `GENERIC_CHANGE_ORDER` pack (live preview) →
 *     professional `ChangeOrderDocument` wrapped in a paper-preview shell
 * - `residential_contract` (live preview) → `ResidentialContractDocument`
 * - `rfi` (live preview) → professional `RfiDocument`
 * - `submittal` (live preview) → professional `SubmittalDocument`
 * - `daily_report` (live preview) → professional `DailyReportDocument`
 * - `qc_report` (live preview) → professional `QcReportDocument`
 * - `warranty_letter` (live preview) → professional `WarrantyCloseoutDocument`
 * - `punch_list` (live preview) → professional `PunchListDocument`
 * - historical version selected → `PreviewPanel` (clause-list snapshot)
 * - everything else → `PreviewPanel`
 */
export default function DocumentPreviewRouter({
  documentType,
  packKey,
  answers,
  selectedProject,
  companySettings,
  title,
  disclaimer,
  risk,
  complianceIssues,
  previewVersion,
  audience = 'client',
  accepted = [],
  previewHeading,
  previewSections,
}: DocumentPreviewRouterProps) {
  const isChangeOrder =
    documentType === 'change_order' || packKey === 'GENERIC_CHANGE_ORDER';
  const isResidentialContract = documentType === 'residential_contract';
  const isRfi = documentType === 'rfi' || packKey === 'GENERIC_RFI';
  const isFar = documentType === 'far' || packKey === 'GENERIC_FAR';
  const isSubmittal = documentType === 'submittal' || packKey === 'GENERIC_SUBMITTAL';
  const isDailyReport = documentType === 'daily_report' || packKey === 'GENERIC_DAILY_REPORT';
  const isQcReport = documentType === 'qc_report' || packKey === 'GENERIC_QC_REPORT';
  const isWarrantyCloseout =
    documentType === 'warranty_letter' || packKey === 'GENERIC_WARRANTY_CLOSEOUT';
  const isPunchList = documentType === 'punch_list' || packKey === 'GENERIC_PUNCH_LIST';

  const [adapterError, setAdapterError] = useState<string | null>(null);

  useEffect(() => {
    setAdapterError(null);
  }, [
    isChangeOrder,
    isRfi,
    isFar,
    isSubmittal,
    isDailyReport,
    isQcReport,
    isWarrantyCloseout,
    isPunchList,
    selectedProject,
  ]);

  const changeOrderPreview = useMemo(() => {
    if (!isChangeOrder || previewVersion) return null;
    try {
      return buildChangeOrderPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
        accepted,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] Change Order adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isChangeOrder, previewVersion, answers, selectedProject, companySettings, title, accepted]);

  const rfiPreview = useMemo(() => {
    if (!isRfi || previewVersion) return null;
    try {
      return buildRfiPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] RFI adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isRfi, previewVersion, answers, selectedProject, companySettings, title]);

  const farPreview = useMemo(() => {
    if (!isFar || previewVersion) return null;
    try {
      return buildFarPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] FAR adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isFar, previewVersion, answers, selectedProject, companySettings, title]);

  const submittalPreview = useMemo(() => {
    if (!isSubmittal || previewVersion) return null;
    try {
      return buildSubmittalPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] Submittal adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isSubmittal, previewVersion, answers, selectedProject, companySettings, title]);

  const dailyReportPreview = useMemo(() => {
    if (!isDailyReport || previewVersion) return null;
    try {
      return buildDailyReportPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] Daily Report adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isDailyReport, previewVersion, answers, selectedProject, companySettings, title]);

  const qcReportPreview = useMemo(() => {
    if (!isQcReport || previewVersion) return null;
    try {
      return buildQcReportPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] QC Report adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isQcReport, previewVersion, answers, selectedProject, companySettings, title]);

  const warrantyCloseoutPreview = useMemo(() => {
    if (!isWarrantyCloseout || previewVersion) return null;
    try {
      return buildWarrantyCloseoutPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] Warranty / Closeout adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isWarrantyCloseout, previewVersion, answers, selectedProject, companySettings, title]);

  const punchListPreview = useMemo(() => {
    if (!isPunchList || previewVersion) return null;
    try {
      return buildPunchListPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[DocumentPreviewRouter] Punch List adapter error:', err);
      }
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isPunchList, previewVersion, answers, selectedProject, companySettings, title]);

  if (adapterError) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-semibold">Document preview could not load.</p>
        <p className="mt-1 text-xs opacity-80">
          Check project and company settings, then try again.
        </p>
      </div>
    );
  }

  if (changeOrderPreview) {
    return (
      <PaperPreviewShell audience={audience}>
        <ChangeOrderDocument
          order={changeOrderPreview.order}
          audience={audience}
          context={changeOrderPreview.context}
        />
      </PaperPreviewShell>
    );
  }

  if (rfiPreview) {
    return (
      <PaperPreviewShell>
        <RfiDocument view={rfiPreview} />
      </PaperPreviewShell>
    );
  }

  if (farPreview) {
    return (
      <PaperPreviewShell>
        <FarDocument view={farPreview} />
      </PaperPreviewShell>
    );
  }

  if (submittalPreview) {
    return (
      <PaperPreviewShell>
        <SubmittalDocument view={submittalPreview} />
      </PaperPreviewShell>
    );
  }

  if (dailyReportPreview) {
    return (
      <PaperPreviewShell>
        <DailyReportDocument view={dailyReportPreview} />
      </PaperPreviewShell>
    );
  }

  if (qcReportPreview) {
    return (
      <PaperPreviewShell>
        <QcReportDocument view={qcReportPreview} />
      </PaperPreviewShell>
    );
  }

  if (warrantyCloseoutPreview) {
    return (
      <PaperPreviewShell>
        <WarrantyCloseoutDocument view={warrantyCloseoutPreview} />
      </PaperPreviewShell>
    );
  }

  if (punchListPreview) {
    return (
      <PaperPreviewShell>
        <PunchListDocument view={punchListPreview} />
      </PaperPreviewShell>
    );
  }

  if (isResidentialContract && !previewVersion) {
    return (
      <PaperPreviewShell>
        <ResidentialContractDocument
          sections={previewSections}
          documentTitle={title ?? previewHeading}
          answers={answers}
          selectedProject={selectedProject}
          companySettings={companySettings}
          disclaimer={disclaimer ?? 'Draft document only. Not legal advice.'}
          risk={risk}
          complianceIssues={complianceIssues}
        />
      </PaperPreviewShell>
    );
  }

  return <PreviewPanel previewHeading={previewHeading} previewSections={previewSections} />;
}
