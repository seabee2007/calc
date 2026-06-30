import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { DESIGN_BUILDER_COPY } from '../domain/designBuilderCopy';
import type {
  DesignEstimatePreviewLine,
  DesignObjectType,
} from '../types';
import {
  OBJECT_TREE_ITEMS,
  objectTypeForPreviewLine,
} from './DesignBuilderPageMappings';
import { Panel } from './DesignBuilderPageShell';

export type DesignBuilderQuantityCard = {
  label: string;
  value: number;
  unit: string;
  objectType: DesignObjectType;
};

export type EstimatePreviewState = 'idle' | 'saving' | 'saved' | 'local' | 'stale' | 'error';

function formatPreviewSavedAt(savedAt: string | null): string {
  if (!savedAt) return '';
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function estimatePreviewBadgeClass(state: EstimatePreviewState): string {
  switch (state) {
    case 'saved':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'saving':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200';
    case 'stale':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
    case 'error':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
    case 'local':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function estimatePreviewStatusCopy(params: {
  state: EstimatePreviewState;
  livePreviewLineCount: number;
  savedPreviewLineCount: number;
  savedAt: string | null;
  error: string | null;
  persistenceCanPersist: boolean;
}): { title: string; badge: string; message: string } {
  const savedAtLabel = formatPreviewSavedAt(params.savedAt);
  switch (params.state) {
    case 'saving':
      return {
        title: 'Saving Preview',
        badge: 'Saving...',
        message: 'Writing preview quantities...',
      };
    case 'saved':
      return {
        title: 'Saved Preview',
        badge: 'Scope review',
        message: `Saved ${params.savedPreviewLineCount} quantities${
          savedAtLabel ? ` at ${savedAtLabel}` : ''
        }. Ready for scope review.`,
      };
    case 'local':
      return {
        title: 'Local Preview',
        badge: 'Local only',
        message: 'Local preview saved in this browser. Save the design before committing.',
      };
    case 'stale':
      return {
        title: 'Out of Date',
        badge: 'Regenerate',
        message: 'Design quantities changed after the preview was saved. Regenerate before committing.',
      };
    case 'error':
      return {
        title: 'Needs Attention',
        badge: 'Error',
        message: params.error ?? 'Could not save estimate preview.',
      };
    default:
      return {
        title: params.livePreviewLineCount > 0 ? 'Live Preview' : 'No Preview',
        badge: params.livePreviewLineCount > 0 ? 'Not saved' : 'No quantities',
        message:
          params.livePreviewLineCount > 0
            ? 'Review live quantities, then save preview before committing.'
            : params.persistenceCanPersist
              ? 'Draw walls or load a template to calculate estimate quantities.'
              : 'Open this tool from a saved Detailed Estimate to save and commit quantities.',
      };
  }
}

export function DesignBuilderEstimatePanel({
  rightPanelCollapsed,
  focusMode,
  quantityCards,
  selectedObjectType,
  visiblePreviewLines,
  persistenceCanPersist,
  busy,
  estimatePreviewState,
  estimatePreviewSavedAt,
  estimatePreviewError,
  livePreviewLineCount,
  savedPreviewLineCount,
  persistedQuantityItemCount,
  canCommitPreview,
  moduleWarnings,
  onToggleRightPanel,
  onBeginRightPanelResize,
  onSelectObjectType,
  onGeneratePreview,
  onCommitPreview,
  onDownloadPreview,
}: {
  rightPanelCollapsed: boolean;
  focusMode: boolean;
  quantityCards: DesignBuilderQuantityCard[];
  selectedObjectType: DesignObjectType | null;
  visiblePreviewLines: DesignEstimatePreviewLine[];
  persistenceCanPersist: boolean;
  busy: boolean;
  estimatePreviewState: EstimatePreviewState;
  estimatePreviewSavedAt: string | null;
  estimatePreviewError: string | null;
  livePreviewLineCount: number;
  savedPreviewLineCount: number;
  persistedQuantityItemCount: number;
  canCommitPreview: boolean;
  moduleWarnings: string[];
  onToggleRightPanel: () => void;
  onBeginRightPanelResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectObjectType: (objectType: DesignObjectType) => void;
  onGeneratePreview: () => void;
  onCommitPreview: () => void;
  onDownloadPreview: () => void;
}) {
  const [previewRowsExpanded, setPreviewRowsExpanded] = useState(false);
  const statusCopy = estimatePreviewStatusCopy({
    state: estimatePreviewState,
    livePreviewLineCount,
    savedPreviewLineCount,
    savedAt: estimatePreviewSavedAt,
    error: estimatePreviewError,
    persistenceCanPersist,
  });
  const generateButtonLabel =
    estimatePreviewState === 'saving'
      ? 'Saving Preview...'
      : estimatePreviewState === 'saved' ||
          estimatePreviewState === 'stale' ||
          estimatePreviewState === 'local'
        ? 'Regenerate Preview'
        : DESIGN_BUILDER_COPY.actions.generatePreview;

  return (
    <>
      <button
        type="button"
        onClick={onToggleRightPanel}
        className="absolute right-0 top-1/2 z-20 translate-x-1/2 rounded-full border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label={rightPanelCollapsed ? 'Expand Design Builder estimate panel' : 'Collapse Design Builder estimate panel'}
      >
        {rightPanelCollapsed ? '<' : '>'}
      </button>

      <aside
        className={`relative space-y-4 overflow-hidden transition-opacity ${
          rightPanelCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        } ${focusMode ? 'min-h-0 overflow-y-auto pr-1' : ''}`}
      >
        {!rightPanelCollapsed ? (
          <div
            role="separator"
            aria-label="Resize Design Builder estimate panel"
            className="absolute -left-2 top-0 hidden h-full w-3 cursor-col-resize xl:block"
            onPointerDown={onBeginRightPanelResize}
          />
        ) : null}
        <Panel title="Quantity Summary">
          <div className="grid grid-cols-2 gap-2">
            {quantityCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => onSelectObjectType(card.objectType)}
                className={`rounded-xl p-3 text-left transition ${
                  selectedObjectType === card.objectType
                    ? 'bg-cyan-100 ring-2 ring-cyan-400 dark:bg-cyan-950/60'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{card.label}</div>
                <div className="mt-1 font-semibold">
                  {card.value} {card.unit}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Estimate Preview">
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {statusCopy.title}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${estimatePreviewBadgeClass(estimatePreviewState)}`}>
                {statusCopy.badge}
              </span>
            </div>
            <div className="mt-1 text-slate-600 dark:text-slate-400">{statusCopy.message}</div>
            {persistedQuantityItemCount > 0 ? (
              <div className="mt-1 text-slate-500 dark:text-slate-500">
                Saved rows: {persistedQuantityItemCount}
              </div>
            ) : null}
          </div>
          {visiblePreviewLines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {persistenceCanPersist
                ? 'Draw walls or load a template, then generate an estimate preview from the current design parameters.'
                : 'Open this tool from a saved Detailed Estimate to generate and commit estimate-ready quantities.'}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                aria-expanded={previewRowsExpanded}
                onClick={() => setPreviewRowsExpanded((expanded) => !expanded)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-700 dark:hover:text-cyan-200"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {previewRowsExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">
                    {previewRowsExpanded ? 'Hide preview rows' : 'Show preview rows'}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {visiblePreviewLines.length} rows
                </span>
              </button>
              {previewRowsExpanded ? (
                <div className="space-y-2">
                  {visiblePreviewLines.map((line) => {
                    const objectType = objectTypeForPreviewLine(line);
                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => onSelectObjectType(objectType)}
                        className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">{line.description}</div>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            Calculated from parameters
                          </span>
                        </div>
                        <div className="mt-1 text-slate-600 dark:text-slate-300">
                          {line.quantity} {line.unit} - Division {line.divisionCode} {line.divisionName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Source object: {OBJECT_TREE_ITEMS.find((item) => item.objectType === objectType)?.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{line.formula}</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onGeneratePreview}
              disabled={busy || livePreviewLineCount === 0}
              className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/60"
            >
              {generateButtonLabel}
            </button>
            <button
              type="button"
              onClick={onCommitPreview}
              disabled={busy || !canCommitPreview}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              Commit to Estimate
            </button>
            <button
              type="button"
              onClick={onDownloadPreview}
              disabled={busy || visiblePreviewLines.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download
            </button>
          </div>
        </Panel>

        <Panel title="Warnings">
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              CMU layout is conceptual for estimating. Verify block layout, lintels, reinforcement, bond beams, and structural requirements before pricing.
            </p>
            <p>This tool does not provide structural engineering or code compliance.</p>
            {moduleWarnings.map((warning) => (
              <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {warning}
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </>
  );
}
