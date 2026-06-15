import { useCallback, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import { usePrefersTouchLayout } from '../hooks/usePrefersTouchLayout';
import ArdenCalcOverlay from './ArdenCalcOverlay';

interface ArdenCalcLauncherProps {
  onUseResult?: (value: number) => boolean | void;
  className?: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function ArdenCalcLauncher({
  onUseResult,
  className = '',
  compact = false,
  open: openProp,
  onOpenChange,
  returnFocusRef,
}: ArdenCalcLauncherProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prefersTouch = usePrefersTouchLayout();
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setUncontrolledOpen(next);
      }
    },
    [isControlled, onOpenChange],
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const focusRef = returnFocusRef ?? buttonRef;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={
          compact
            ? `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400 ${className}`
            : `inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-800/80 ${className}`
        }
        aria-label="Open Arden Calc"
        data-testid={compact ? 'arden-calc-launcher-compact' : 'arden-calc-launcher'}
      >
        <Calculator className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
        {!compact && <span>Arden Calc</span>}
      </button>

      <ArdenCalcOverlay
        open={open}
        onClose={handleClose}
        prefersTouch={prefersTouch}
        onUseResult={onUseResult}
        returnFocusRef={focusRef}
      />
    </>
  );
}
