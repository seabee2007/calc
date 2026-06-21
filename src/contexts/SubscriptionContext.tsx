import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAppAccess } from './AppAccessContext';
import { useAuth } from '../hooks/useAuth';
import {
  canCreateProject as canCreateProjectEntitlement,
  canInviteFieldSeat as canInviteFieldSeatEntitlement,
  canInviteTeamMember as canInviteTeamMemberEntitlement,
  canUseFeature,
  getEffectiveLimits,
  minPlanForFeature,
  isSubscriptionStatusActive,
  type FeatureKey,
  type LimitKey,
  type PlanId,
} from '../lib/entitlements';
import {
  fetchSubscription,
  resolveEffectivePlanFromRow,
  type SubscriptionRow,
} from '../services/subscriptionService';
import { subscriptionOwnerIdFromAccess } from '../services/appAccessService';

export interface SubscriptionContextValue {
  plan: PlanId;
  status: string | null;
  isActive: boolean;
  limits: Record<LimitKey, number>;
  subscription: SubscriptionRow | null;
  hasFeature: (feature: FeatureKey) => boolean;
  getLimit: (key: LimitKey) => number;
  canCreateProject: (activeCount: number) => boolean;
  canInviteFieldSeat: (currentCount: number) => boolean;
  canInviteTeamMember: (seatUsageCount: number) => boolean;
  requiresUpgrade: (feature: FeatureKey) => boolean;
  minPlanRequired: (feature: FeatureKey) => PlanId;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, profileLoading } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const accessReady =
    authSessionResolved &&
    accessResolutionState === 'resolved' &&
    (!user || !profileLoading);

  const subscriptionOwnerId = useMemo(
    () => subscriptionOwnerIdFromAccess(user?.id, access),
    [access, user?.id],
  );

  const refresh = useCallback(async () => {
    if (!subscriptionOwnerId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const row = await fetchSubscription(subscriptionOwnerId);
      setSubscription(row);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionOwnerId]);

  useEffect(() => {
    if (!accessReady) {
      setSubscription(null);
      setLoading(Boolean(user));
      return;
    }

    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [accessReady, accessResolutionState, authSessionResolved, refresh, user]);

  const plan = useMemo(
    () => resolveEffectivePlanFromRow(subscription),
    [subscription],
  );

  const status = subscription?.status ?? null;
  const isActive = isSubscriptionStatusActive(status);

  const limits = useMemo(
    () =>
      getEffectiveLimits(plan, {
        activeProjectLimit: subscription?.activeProjectLimit,
        includedFieldSeats: subscription?.includedFieldSeats,
      }),
    [plan, subscription?.activeProjectLimit, subscription?.includedFieldSeats],
  );

  const hasFeature = useCallback(
    (feature: FeatureKey) => canUseFeature(plan, feature),
    [plan],
  );

  const getLimit = useCallback((key: LimitKey) => limits[key], [limits]);

  const canCreateProject = useCallback(
    (activeCount: number) =>
      canCreateProjectEntitlement(plan, activeCount, subscription?.activeProjectLimit),
    [plan, subscription?.activeProjectLimit],
  );

  const canInviteFieldSeat = useCallback(
    (currentCount: number) =>
      canInviteFieldSeatEntitlement(plan, currentCount, subscription?.includedFieldSeats),
    [plan, subscription?.includedFieldSeats],
  );

  const canInviteTeamMember = useCallback(
    (seatUsageCount: number) =>
      canInviteTeamMemberEntitlement(plan, seatUsageCount, subscription?.includedFieldSeats),
    [plan, subscription?.includedFieldSeats],
  );

  const requiresUpgrade = useCallback(
    (feature: FeatureKey) => !canUseFeature(plan, feature),
    [plan],
  );

  const minPlanRequired = useCallback((feature: FeatureKey) => minPlanForFeature(feature), []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      plan,
      status,
      isActive,
      limits,
      subscription,
      hasFeature,
      getLimit,
      canCreateProject,
      canInviteFieldSeat,
      canInviteTeamMember,
      requiresUpgrade,
      minPlanRequired,
      loading,
      refresh,
    }),
    [
      plan,
      status,
      isActive,
      limits,
      subscription,
      hasFeature,
      getLimit,
      canCreateProject,
      canInviteFieldSeat,
      canInviteTeamMember,
      requiresUpgrade,
      minPlanRequired,
      loading,
      refresh,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
