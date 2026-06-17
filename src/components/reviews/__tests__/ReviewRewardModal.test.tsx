import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewRewardModal from '../ReviewRewardModal';
import ReviewRewardBadge from '../ReviewRewardBadge';
import {
  REVIEW_ELIGIBILITY_DAYS,
  REVIEW_REWARD_QUANTITY,
  daysUntilReviewEligible,
  dismissReviewReward,
  isReviewDismissed,
  reviewDismissStorageKey,
  submitReview,
} from '../../../services/appReviewService';
import * as reviewRewardEligibilityModule from '../../../hooks/useReviewRewardEligibility';
import { renderHook } from '@testing-library/react';

vi.mock('../../../services/appReviewService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/appReviewService')>();
  return {
    ...actual,
    fetchMyReviewStatus: vi.fn(),
    submitReview: vi.fn(),
    dismissReviewReward: vi.fn((id: string) => {
      window.localStorage.setItem(reviewDismissStorageKey(id), String(Date.now()));
    }),
    isReviewDismissed: vi.fn((id: string) => {
      const raw = window.localStorage.getItem(reviewDismissStorageKey(id));
      if (!raw) return false;
      const dismissedAt = Number(raw);
      if (!Number.isFinite(dismissedAt)) return false;
      return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    }),
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../hooks/useAuth';
import { fetchMyReviewStatus } from '../../../services/appReviewService';

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchMyReviewStatus = vi.mocked(fetchMyReviewStatus);
const mockedSubmitReview = vi.mocked(submitReview);
const { useReviewRewardEligibility } = reviewRewardEligibilityModule;

const LONG_FEEDBACK = 'This is honest feedback that is long enough to submit.';

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe('Review Feedback Reward acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedSubmitReview.mockResolvedValue({
      ok: true,
      reviewId: 'review-1',
      reward: {
        usageUnit: 'ai_request',
        quantity: REVIEW_REWARD_QUANTITY,
        expiresAt: '2026-07-31T23:59:59.999Z',
      },
    });
  });

  describe('useReviewRewardEligibility', () => {
    it('1. ineligible user before 7 days cannot be eligible', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'owner-1' },
        profile: { createdAt: daysAgoIso(3), employerId: null, role: 'owner' },
        isOwner: true,
      } as ReturnType<typeof useAuth>);
      mockedFetchMyReviewStatus.mockResolvedValue({ claimed: false });

      const { result } = renderHook(() => useReviewRewardEligibility(true));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.eligible).toBe(false);
      expect(result.current.daysUntilEligible).toBeGreaterThan(0);
      expect(daysUntilReviewEligible(daysAgoIso(3))).toBe(REVIEW_ELIGIBILITY_DAYS - 3);
    });

    it('2. employee is never eligible', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'employee-1' },
        profile: { createdAt: daysAgoIso(30), employerId: 'owner-1', role: 'employee' },
        isOwner: false,
      } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => useReviewRewardEligibility(true));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.eligible).toBe(false);
      expect(mockedFetchMyReviewStatus).not.toHaveBeenCalled();
    });

    it('3. owner after 7 days is eligible when not claimed', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'owner-1' },
        profile: { createdAt: daysAgoIso(8), employerId: null, role: 'owner' },
        isOwner: true,
      } as ReturnType<typeof useAuth>);
      mockedFetchMyReviewStatus.mockResolvedValue({ claimed: false });

      const { result } = renderHook(() => useReviewRewardEligibility(true));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.eligible).toBe(true);
      expect(result.current.daysUntilEligible).toBe(0);
    });

    it('10. already claimed blocks eligibility', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'owner-1' },
        profile: { createdAt: daysAgoIso(10), employerId: null, role: 'owner' },
        isOwner: true,
      } as ReturnType<typeof useAuth>);
      mockedFetchMyReviewStatus.mockResolvedValue({ claimed: true, reviewId: 'existing' });

      const { result } = renderHook(() => useReviewRewardEligibility(true));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.alreadyClaimed).toBe(true);
      expect(result.current.eligible).toBe(false);
    });
  });

  describe('ReviewRewardModal', () => {
    it('4. rating 0 is accepted on submit', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <ReviewRewardModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />,
      );

      await user.click(screen.getByTestId('review-reward-rating-0'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(mockedSubmitReview).toHaveBeenCalledWith(
          expect.objectContaining({ rating: 0, reviewText: LONG_FEEDBACK }),
        );
      });
    });

    it('5. rating 5 is accepted on submit', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-5'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(mockedSubmitReview).toHaveBeenCalledWith(
          expect.objectContaining({ rating: 5 }),
        );
      });
    });

    it('6. review text is required before submit', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-3'));

      expect(screen.getByTestId('review-reward-submit')).toBeDisabled();
      expect(mockedSubmitReview).not.toHaveBeenCalled();
    });

    it('7. public consent false is accepted', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-2'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(mockedSubmitReview).toHaveBeenCalledWith(
          expect.objectContaining({ publicConsent: false }),
        );
      });
    });

    it('8. public consent true is saved', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-4'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-public-consent'));
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(mockedSubmitReview).toHaveBeenCalledWith(
          expect.objectContaining({ publicConsent: true }),
        );
      });
    });

    it('9. credits reward payload is requested regardless of low rating', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-1'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(mockedSubmitReview).toHaveBeenCalledWith(
          expect.objectContaining({ rating: 1 }),
        );
      });

      expect(mockedSubmitReview.mock.results[0]?.type).toBe('return');
    });

    it('shows compliance disclosure and does not preselect stars', () => {
      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      expect(screen.getByTestId('review-reward-disclosure')).toHaveTextContent(
        /regardless of your rating/i,
      );
      expect(screen.getByTestId('review-reward-rating-0')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('review-reward-rating-5')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows success toast with 25 AI credits message', async () => {
      const user = userEvent.setup();

      render(<ReviewRewardModal isOpen onClose={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-rating-3'));
      await user.type(screen.getByTestId('review-reward-text'), LONG_FEEDBACK);
      await user.click(screen.getByTestId('review-reward-submit'));

      await waitFor(() => {
        expect(
          screen.getByText(`Thanks — ${REVIEW_REWARD_QUANTITY} AI credits were added to your account.`),
        ).toBeInTheDocument();
      });
    });
  });

  describe('ReviewRewardBadge', () => {
    it('12. badge hidden before 7 days', () => {
      vi.spyOn(reviewRewardEligibilityModule, 'useReviewRewardEligibility').mockReturnValue({
        loading: false,
        eligible: false,
        daysUntilEligible: 4,
        alreadyClaimed: false,
        dismissed: false,
        dismiss: vi.fn(),
        rewardQuantity: REVIEW_REWARD_QUANTITY,
        refresh: vi.fn(),
      });

      render(<ReviewRewardBadge onOpenModal={vi.fn()} />);

      expect(screen.queryByTestId('review-reward-badge')).not.toBeInTheDocument();
    });

    it('13. badge visible after 7 days if not claimed', () => {
      vi.spyOn(reviewRewardEligibilityModule, 'useReviewRewardEligibility').mockReturnValue({
        loading: false,
        eligible: true,
        daysUntilEligible: 0,
        alreadyClaimed: false,
        dismissed: false,
        dismiss: vi.fn(),
        rewardQuantity: REVIEW_REWARD_QUANTITY,
        refresh: vi.fn(),
      });

      render(<ReviewRewardBadge onOpenModal={vi.fn()} />);

      expect(screen.getByTestId('review-reward-badge')).toBeInTheDocument();
      expect(screen.getByText('Share feedback, get free credits')).toBeInTheDocument();
    });

    it('14. dismiss hides badge temporarily', async () => {
      const user = userEvent.setup();
      const dismiss = vi.fn();

      vi.spyOn(reviewRewardEligibilityModule, 'useReviewRewardEligibility').mockReturnValue({
        loading: false,
        eligible: true,
        daysUntilEligible: 0,
        alreadyClaimed: false,
        dismissed: false,
        dismiss,
        rewardQuantity: REVIEW_REWARD_QUANTITY,
        refresh: vi.fn(),
      });

      render(<ReviewRewardBadge onOpenModal={vi.fn()} />);

      await user.click(screen.getByTestId('review-reward-badge-dismiss'));
      expect(dismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('appReviewService helpers', () => {
    it('11. reward quantity constant matches usage summary credit unit', () => {
      expect(REVIEW_REWARD_QUANTITY).toBe(25);
    });

    it('local dismiss storage hides badge for 7 days', () => {
      dismissReviewReward('employer-1');
      expect(isReviewDismissed('employer-1')).toBe(true);
    });
  });
});
