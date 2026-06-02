import { useMemo, useState, useEffect } from 'react';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import type { ContractDocumentVersionRow } from '../../services/contractDocumentTypes';
import ChangeOrderDocument from '../../../../components/change-order/ChangeOrderDocument';
import { buildChangeOrderPreviewFromDocumentAnswers } from '../adapters/changeOrderPreviewAdapter';
import PreviewPanel, { type PreviewPanelProps } from './PreviewPanel';

interface DocumentPreviewRouterProps extends PreviewPanelProps {
  /** `assembly.documentType` — primary signal for renderer selection. */
  documentType: string;
  /** `packKey` — secondary signal; 'GENERIC_CHANGE_ORDER' also triggers CO renderer. */
  packKey: string;
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  /** Document title from the builder state — forwarded to the adapter for the CO header. */
  title?: string;
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

/**
 * Selects the correct preview renderer based on document type / pack key.
 *
 * - `change_order` or `GENERIC_CHANGE_ORDER` pack (live preview) →
 *     professional `ChangeOrderDocument` wrapped in a paper-preview shell
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
  previewVersion,
  audience = 'client',
  accepted = [],
  previewHeading,
  previewSections,
}: DocumentPreviewRouterProps) {
  const isChangeOrder =
    documentType === 'change_order' || packKey === 'GENERIC_CHANGE_ORDER';

  // Track whether the adapter threw so we can show a safe fallback card instead
  // of letting a React error boundary blank the entire page.
  const [adapterError, setAdapterError] = useState<string | null>(null);

  // Reset the error state whenever the pack type or project changes so the user
  // can retry after fixing project data without a hard page reload.
  useEffect(() => {
    setAdapterError(null);
  }, [isChangeOrder, selectedProject]);

  const changeOrderPreview = useMemo(() => {
    // Show historical snapshots via PreviewPanel so the read-only view stays
    // faithful to what was actually saved.
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
      // Schedule the error state update outside the render cycle.
      setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
      return null;
    }
  }, [isChangeOrder, previewVersion, answers, selectedProject, companySettings, title, accepted]);

  if (adapterError) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-semibold">Change Order preview could not load.</p>
        <p className="mt-1 text-xs opacity-80">
          Check project address data or use Planner → Change Orders for production change orders.
        </p>
      </div>
    );
  }

  if (changeOrderPreview) {
    return (
      // Paper-preview shell: the outer card uses app dark-mode colours; the
      // inner ChangeOrderDocument always renders as white paper with dark text.
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
        <div className="p-3">
          <ChangeOrderDocument
            order={changeOrderPreview.order}
            audience={audience}
            context={changeOrderPreview.context}
          />
        </div>
      </div>
    );
  }

  return <PreviewPanel previewHeading={previewHeading} previewSections={previewSections} />;
}
