interface Props {
  isOpen: boolean;
  addedLinkCount: number;
  reverting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogicReviewRevertBatchConfirmModal({
  isOpen,
  addedLinkCount,
  reverting,
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10090] flex items-center justify-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
        role="dialog"
        aria-labelledby="logic-revert-batch-title"
        aria-modal="true"
      >
        <h3 id="logic-revert-batch-title" className="text-base font-semibold text-white">
          Revert last AI changes?
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          Restore the logic links that existed before the last AI suggestion batch? This will undo{' '}
          {addedLinkCount} added link{addedLinkCount === 1 ? '' : 's'}.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            disabled={reverting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-700 bg-amber-950 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900 disabled:opacity-60"
            disabled={reverting}
            onClick={onConfirm}
          >
            {reverting ? 'Reverting…' : 'Revert last AI changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
