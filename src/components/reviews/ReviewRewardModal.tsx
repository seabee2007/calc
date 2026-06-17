import React, { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import {
  REVIEW_MAX_TEXT_LENGTH,
  REVIEW_MIN_TEXT_LENGTH,
  REVIEW_REWARD_QUANTITY,
  submitReview,
} from '../../services/appReviewService';
import { FOCUS_RING, TEXT_BODY, TEXT_MUTED } from '../../theme/appTheme';

export interface ReviewRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function StarRatingRow({
  rating,
  onChange,
}: {
  rating: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2" data-testid="review-reward-star-rating">
      <p className={`text-sm font-medium ${TEXT_BODY}`}>Your rating</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(0)}
          aria-label="Rate 0 stars"
          aria-pressed={rating === 0}
          data-testid="review-reward-rating-0"
          className={`rounded-md border px-2 py-1 text-sm ${rating === 0 ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100' : 'border-slate-300 dark:border-slate-600'} ${FOCUS_RING}`}
        >
          0
        </button>
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = rating !== null && value <= rating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={rating === value}
              data-testid={`review-reward-rating-${value}`}
              className={`rounded-md p-1 ${FOCUS_RING}`}
            >
              <Star
                className={`h-7 w-7 ${filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ReviewRewardModal({
  isOpen,
  onClose,
  onSuccess,
}: ReviewRewardModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerCompany, setReviewerCompany] = useState('');
  const [reviewerRole, setReviewerRole] = useState('');
  const [publicConsent, setPublicConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastId, setToastId] = useState<string | null>(null);

  const trimmedText = reviewText.trim();
  const textLengthOk =
    trimmedText.length >= REVIEW_MIN_TEXT_LENGTH &&
    trimmedText.length <= REVIEW_MAX_TEXT_LENGTH;
  const canSubmit = rating !== null && textLengthOk && !busy;

  const validationMessage = useMemo(() => {
    if (rating === null) return 'Select a rating from 0 to 5 stars.';
    if (trimmedText.length < REVIEW_MIN_TEXT_LENGTH) {
      return `Feedback must be at least ${REVIEW_MIN_TEXT_LENGTH} characters.`;
    }
    if (trimmedText.length > REVIEW_MAX_TEXT_LENGTH) {
      return `Feedback must be at most ${REVIEW_MAX_TEXT_LENGTH} characters.`;
    }
    return null;
  }, [rating, trimmedText]);

  const resetForm = () => {
    setRating(null);
    setReviewText('');
    setReviewerName('');
    setReviewerCompany('');
    setReviewerRole('');
    setPublicConsent(false);
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (rating === null || !textLengthOk) {
      setError(validationMessage);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await submitReview({
        rating,
        reviewText: trimmedText,
        publicConsent,
        reviewerName: reviewerName.trim() || undefined,
        reviewerCompany: reviewerCompany.trim() || undefined,
        reviewerRole: reviewerRole.trim() || undefined,
      });
      setToastId(`review-reward-success-${Date.now()}`);
      resetForm();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit feedback.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={handleClose}
        title="Share feedback, get free credits"
        subtitle="Tell us what is working and what needs improvement. Any honest feedback qualifies."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={busy}
              className="min-h-11"
              data-testid="review-reward-not-now"
            >
              Not now
            </Button>
            <Button
              type="submit"
              form="review-reward-form"
              variant="accent"
              disabled={!canSubmit}
              className="min-h-11"
              data-testid="review-reward-submit"
            >
              Submit feedback
            </Button>
          </>
        }
      >
        <form
          id="review-reward-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
          data-testid="review-reward-modal"
        >
          <StarRatingRow rating={rating} onChange={setRating} />

          <div>
            <label htmlFor="review-reward-text" className={`mb-1 block text-sm font-medium ${TEXT_BODY}`}>
              Written feedback
            </label>
            <textarea
              id="review-reward-text"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              rows={5}
              required
              maxLength={REVIEW_MAX_TEXT_LENGTH}
              placeholder="What is working well? What should we improve?"
              className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 ${TEXT_BODY}`}
              data-testid="review-reward-text"
            />
            <p className={`mt-1 text-xs ${TEXT_MUTED}`}>
              {trimmedText.length}/{REVIEW_MAX_TEXT_LENGTH} characters (minimum {REVIEW_MIN_TEXT_LENGTH})
            </p>
          </div>

          <Input
            label="Display name (optional)"
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
            fullWidth
            data-testid="review-reward-name"
          />
          <Input
            label="Company (optional)"
            value={reviewerCompany}
            onChange={(event) => setReviewerCompany(event.target.value)}
            fullWidth
            data-testid="review-reward-company"
          />
          <Input
            label="Role / title (optional)"
            value={reviewerRole}
            onChange={(event) => setReviewerRole(event.target.value)}
            fullWidth
            data-testid="review-reward-role"
          />

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={publicConsent}
              onChange={(event) => setPublicConsent(event.target.checked)}
              className="mt-1"
              data-testid="review-reward-public-consent"
            />
            <span className={`text-sm ${TEXT_BODY}`}>
              Arden Project OS may use my review publicly on its website or marketing materials.
            </span>
          </label>

          <p className={`text-xs ${TEXT_MUTED}`} data-testid="review-reward-disclosure">
            You&apos;ll receive free usage credits for submitting honest feedback, regardless of your
            rating. Public use of your review is optional.
          </p>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="review-reward-error">
              {error}
            </p>
          ) : null}
        </form>
      </ModalShell>

      {toastId ? (
        <Toast
          id={toastId}
          type="success"
          title={`Thanks — ${REVIEW_REWARD_QUANTITY} AI credits were added to your account.`}
          duration={5000}
          onClose={() => setToastId(null)}
        />
      ) : null}
    </>
  );
}
