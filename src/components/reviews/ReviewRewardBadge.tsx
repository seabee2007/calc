import React from 'react';
import { Star, X } from 'lucide-react';
import { useReviewRewardEligibility } from '../../hooks/useReviewRewardEligibility';
import { FOCUS_RING, TEXT_BODY, TEXT_MUTED } from '../../theme/appTheme';

interface ReviewRewardBadgeProps {
  onOpenModal: () => void;
  enabled?: boolean;
}

export default function ReviewRewardBadge({
  onOpenModal,
  enabled = true,
}: ReviewRewardBadgeProps) {
  const { eligible, dismissed, dismiss, loading } = useReviewRewardEligibility(enabled);

  if (loading || !eligible || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-30 flex items-end gap-2"
      data-testid="review-reward-badge"
    >
      <div className="relative">
        <span
          aria-hidden
          className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-amber-400/40"
        />
        <button
          type="button"
          onClick={onOpenModal}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition hover:bg-amber-600 ${FOCUS_RING}`}
          aria-label="Share feedback, get free credits"
          data-testid="review-reward-badge-open"
        >
          <Star className="h-5 w-5 fill-current" aria-hidden />
        </button>
      </div>

      <div className="mb-1 flex max-w-[11rem] flex-col gap-1">
        <button
          type="button"
          onClick={onOpenModal}
          className={`rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${TEXT_BODY}`}
          data-testid="review-reward-badge-label"
        >
          Share feedback, get free credits
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            dismiss();
          }}
          className={`inline-flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs ${TEXT_MUTED} hover:text-slate-700 dark:hover:text-slate-200 ${FOCUS_RING}`}
          aria-label="Dismiss feedback badge for now"
          data-testid="review-reward-badge-dismiss"
        >
          <X className="h-3 w-3" aria-hidden />
          Not now
        </button>
      </div>
    </div>
  );
}
