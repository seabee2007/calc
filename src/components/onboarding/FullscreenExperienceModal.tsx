import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onConfirm: (dontShowAgain: boolean) => void;
}

export default function FullscreenExperienceModal({ isOpen, onConfirm }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const dontShowAgainRef = useRef(dontShowAgain);

  useEffect(() => {
    dontShowAgainRef.current = dontShowAgain;
  }, [dontShowAgain]);

  useEffect(() => {
    if (!isOpen) {
      setDontShowAgain(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onConfirm(dontShowAgainRef.current);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onConfirm]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
        role="dialog"
        aria-labelledby="fullscreen-experience-title"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <Monitor className="h-5 w-5" aria-hidden />
          </div>
          <h2 id="fullscreen-experience-title" className="text-lg font-semibold text-white">
            Best Viewing Experience
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          Concrete Calc works best in full screen, especially when using estimates, schedules, Gantt
          charts, and logic networks.
        </p>

        <div className="mt-4 space-y-1 text-sm text-slate-300">
          <p>
            <span className="font-medium text-slate-100">Windows / Linux:</span> Press F11
          </p>
          <p>
            <span className="font-medium text-slate-100">Mac:</span> Press Control + Command + F
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          You can exit full screen using the same shortcut or Esc depending on your browser.
        </p>

        <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          Don&apos;t show again
        </label>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            onClick={() => onConfirm(dontShowAgain)}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
