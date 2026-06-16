import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  canCreateProject as canCreateProjectEntitlement,
  canInviteFieldSeat as canInviteFieldSeatEntitlement,
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
import { isOwnerRole } from '../types/fieldPlanner';

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
  requiresUpgrade: (feature: FeatureKey) => boolean;
  minPlanRequired: (feature: FeatureKey) => PlanId;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function resolveSubscriptionOwnerId(
  userId: string | undefined,
  profile: ReturnType<typeof useAuth>['profile'],
): string | null {
  if (!userId || !profile) return null;
  if (isOwnerRole(profile.role)) return userId;
  return profile.employerId ?? null;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const subscriptionOwnerId = resolveSubscriptionOwnerId(user?.id, profile);

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
    if (authLoading || profileLoading || !user || !profile) {
      setSubscription(null);
      setLoading(Boolean(user && (authLoading || profileLoading)));
      return;
    }

    void refresh();
  }, [authLoading, profileLoading, user?.id, profile?.id, refresh]);

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
