import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Copy, X } from 'lucide-react';
import ConstructionCalculator from '../../../tools/construction-calculator/ui/ConstructionCalculator';
import type { CalculatorInputController } from '../../../tools/construction-calculator/ui/hooks/useCalculatorInputController';
import {
  getCalculatorResultText,
  getUsableScalarResult,
} from '../../../tools/construction-calculator/domain/ardenCalcResultUtils';

interface ArdenCalcOverlayProps {
  open: boolean;
  onClose: () => void;
  prefersTouch: boolean;
  onUseResult?: (value: number) => boolean | void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function ArdenCalcOverlay({
  open,
  onClose,
  prefersTouch,
  onUseResult,
  returnFocusRef,
}: ArdenCalcOverlayProps) {
  const controllerRef = useRef<CalculatorInputController | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setActionMessage(null);
    onClose();
    window.requestAnimationFrame(() => {
      returnFocusRef?.current?.focus();
    });
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handleClose();
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [open]);

  const handleCopyResult = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    const text = getCalculatorResultText(controller.state);
    try {
      await navigator.clipboard.writeText(text);
      setActionMessage('Result copied to clipboard.');
    } catch {
      setActionMessage('Could not copy result.');
    }
  }, []);

  const handleUseResult = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !onUseResult) return;
    const parsed = getUsableScalarResult(controller.state);
    if ('error' in parsed) {
      setActionMessage(parsed.error);
      return;
    }
    if (onUseResult) {
      const applied = onUseResult(parsed.value);
      if (applied === false) {
        setActionMessage('Focus a quantity field before using the result.');
        return;
      }
    }
    handleClose();
  }, [handleClose, onUseResult]);

  if (!open) return null;

  const layout = prefersTouch ? 'field' : 'desktop';

  const footer = (
    <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/95">
      {actionMessage ? (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-300" role="status">
          {actionMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCopyResult()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="arden-calc-copy-result"
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copy Result
        </button>
        {onUseResult ? (
          <button
            type="button"
            onClick={handleUseResult}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            data-testid="arden-calc-use-result"
          >
            Use Result
          </button>
        ) : null}
      </div>
    </div>
  );

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {prefersTouch ? (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Close calculator"
              data-testid="arden-calc-close"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : null}
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Arden Calc</h2>
        </div>
        {!prefersTouch ? (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close calculator"
            data-testid="arden-calc-close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        <ConstructionCalculator
          layout={layout}
          embedded
          onControllerReady={(controller) => {
            controllerRef.current = controller;
          }}
        />
      </div>
      {footer}
    </div>
  );

  const overlay = prefersTouch ? (
    <div
      className="fixed inset-0 z-[10050] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="Arden Calculator"
      data-testid="arden-calc-overlay"
    >
      {panel}
    </div>
  ) : (
    <div
      className="fixed inset-0 z-[10050] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Arden Calculator"
      data-testid="arden-calc-overlay"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        aria-label="Close calculator overlay"
        onClick={handleClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {panel}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
