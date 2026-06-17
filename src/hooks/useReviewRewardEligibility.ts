import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  REVIEW_REWARD_QUANTITY,
  daysUntilReviewEligible,
  dismissReviewReward,
  fetchMyReviewStatus,
  isReviewDismissed,
} from '../services/appReviewService';

export interface ReviewRewardEligibility {
  loading: boolean;
  eligible: boolean;
  daysUntilEligible: number;
  alreadyClaimed: boolean;
  dismissed: boolean;
  dismiss: () => void;
  rewardQuantity: number;
  refresh: () => Promise<void>;
}

export function useReviewRewardEligibility(enabled = true): ReviewRewardEligibility {
  const { user, profile, isOwner } = useAuth();
  const [loading, setLoading] = useState(enabled);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const employerOrUserId = useMemo(() => {
    if (!user) return null;
    return profile?.employerId ?? user.id;
  }, [user, profile?.employerId]);

  const daysUntilEligible = useMemo(
    () => daysUntilReviewEligible(profile?.createdAt),
    [profile?.createdAt],
  );

  const refresh = useCallback(async () => {
    if (!enabled || !user || !isOwner || !employerOrUserId) {
      setAlreadyClaimed(false);
      setDismissed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const status = await fetchMyReviewStatus(user.id, profile?.employerId);
      setAlreadyClaimed(status.claimed);
      setDismissed(isReviewDismissed(employerOrUserId));
    } catch {
      setAlreadyClaimed(false);
      setDismissed(isReviewDismissed(employerOrUserId));
    } finally {
      setLoading(false);
    }
  }, [enabled, user, isOwner, employerOrUserId, profile?.employerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(() => {
    if (!employerOrUserId) return;
    dismissReviewReward(employerOrUserId);
    setDismissed(true);
  }, [employerOrUserId]);

  const eligible =
    Boolean(enabled && user && isOwner && employerOrUserId) &&
    daysUntilEligible === 0 &&
    !alreadyClaimed;

  return {
    loading,
    eligible,
    daysUntilEligible,
    alreadyClaimed,
    dismissed,
    dismiss,
    rewardQuantity: REVIEW_REWARD_QUANTITY,
    refresh,
  };
}
