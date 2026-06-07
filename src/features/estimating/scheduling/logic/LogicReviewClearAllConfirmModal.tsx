interface Props {
  isOpen: boolean;
  linkCount: number;
  clearing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogicReviewClearAllConfirmModal({
  isOpen,
  linkCount,
  clearing,
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10090] flex items-center justify-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
        role="dialog"
        aria-labelledby="logic-clear-all-title"
        aria-modal="true"
      >
        <h3 id="logic-clear-all-title" className="text-base font-semibold text-white">
          Clear all logic links?
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          This will remove all {linkCount} logic links and reset the Logic Network relationships.
          Activity data will remain. Continue?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            disabled={clearing}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-rose-700 bg-rose-950 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-900 disabled:opacity-60"
            disabled={clearing}
            onClick={onConfirm}
          >
            {clearing ? 'Clearing…' : 'Clear all logic links'}
          </button>
        </div>
      </div>
    </div>
  );
}
