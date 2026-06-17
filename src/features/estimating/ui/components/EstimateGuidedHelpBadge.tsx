import { Info, X } from 'lucide-react';

interface Props {
  onOpenGuide: () => void;
  onDismiss: () => void;
}

export default function EstimateGuidedHelpBadge({ onOpenGuide, onDismiss }: Props) {
  return (
    <>
      <div className="relative hidden sm:block">
        <div
          className="pointer-events-none absolute -right-1 -top-11 z-10 flex items-center gap-1"
          aria-hidden
        >
          <span className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-cyan-500/80" />
        </div>
        <div className="absolute -right-1 -top-14 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenGuide}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/60 bg-slate-900 text-cyan-300 shadow-lg shadow-cyan-950/40 transition hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Open estimate help"
            title="How to fill out this estimate"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
            <Info className="relative h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Dismiss estimate help"
            title="Dismiss help tip"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2 sm:hidden">
        <button
          type="button"
          onClick={onOpenGuide}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Open estimate help"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
          Need help? Guide
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Dismiss estimate help"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </>
  );
}
