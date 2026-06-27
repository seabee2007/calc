import type { PointerEvent as ReactPointerEvent } from 'react';
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

export function DesignBuilderLinkedQuantitiesPanel({
  linkedPreviewLines,
}: {
  linkedPreviewLines: DesignEstimatePreviewLine[];
}) {
  return (
    <Panel title="Linked Quantities">
      {linkedPreviewLines.length > 0 ? (
        <div className="space-y-2">
          {linkedPreviewLines.map((line) => (
            <div key={line.id} className="rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">
              <div className="font-medium">{line.description}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {line.quantity} {line.unit}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select a quantity card or estimate line to see linked quantities for this object.
        </p>
      )}
    </Panel>
  );
}

export function DesignBuilderEstimatePanel({
  rightPanelCollapsed,
  focusMode,
  quantityCards,
  selectedObjectType,
  visiblePreviewLines,
  persistenceCanPersist,
  busy,
  previewLineCount,
  generatedPreviewLineCount,
  moduleWarnings,
  onToggleRightPanel,
  onBeginRightPanelResize,
  onSelectObjectType,
  onGeneratePreview,
  onCommitPreview,
}: {
  rightPanelCollapsed: boolean;
  focusMode: boolean;
  quantityCards: DesignBuilderQuantityCard[];
  selectedObjectType: DesignObjectType | null;
  visiblePreviewLines: DesignEstimatePreviewLine[];
  persistenceCanPersist: boolean;
  busy: boolean;
  previewLineCount: number;
  generatedPreviewLineCount: number;
  moduleWarnings: string[];
  onToggleRightPanel: () => void;
  onBeginRightPanelResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectObjectType: (objectType: DesignObjectType) => void;
  onGeneratePreview: () => void;
  onCommitPreview: () => void;
}) {
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

        <Panel title="Estimate Preview - not committed yet">
          <div className="space-y-2">
            {visiblePreviewLines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {persistenceCanPersist
                  ? 'Draw walls or load a template, then generate an estimate preview from the current design parameters.'
                  : 'Open this tool from a saved Detailed Estimate to generate and commit estimate-ready quantities.'}
              </div>
            ) : null}
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
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onGeneratePreview}
              disabled={busy}
              className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/60"
            >
              {DESIGN_BUILDER_COPY.actions.generatePreview}
            </button>
            <button
              type="button"
              onClick={onCommitPreview}
              disabled={busy || previewLineCount === 0 || generatedPreviewLineCount === 0}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              Commit to Estimate
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
