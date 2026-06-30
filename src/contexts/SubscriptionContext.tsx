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
  type FeatureKey,
  type LimitKey,
  type PlanId,
} from '../lib/entitlements';
import {
  fetchEntitlementForUser,
  type AccessSource,
  type InternalAccessOverride,
  type ResolvedEntitlement,
  type SubscriptionRow,
} from '../services/subscriptionService';
import { subscriptionOwnerIdFromAccess } from '../services/appAccessService';

export interface SubscriptionContextValue {
  plan: PlanId;
  status: string | null;
  isActive: boolean;
  accessSource: AccessSource;
  limits: Record<LimitKey, number>;
  features: FeatureKey[];
  subscription: SubscriptionRow | null;
  internalOverride: InternalAccessOverride | null;
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
  const [entitlement, setEntitlement] = useState<ResolvedEntitlement | null>(null);
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
      setEntitlement(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const resolved = await fetchEntitlementForUser(subscriptionOwnerId);
      setEntitlement(resolved);
    } catch {
      setEntitlement(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionOwnerId]);

  useEffect(() => {
    if (!accessReady) {
      setEntitlement(null);
      setLoading(Boolean(user));
      return;
    }

    if (!user) {
      setEntitlement(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [accessReady, accessResolutionState, authSessionResolved, refresh, user]);

  const subscription = entitlement?.subscription ?? null;
  const internalOverride = entitlement?.internalOverride ?? null;
  const plan = entitlement?.planId ?? 'free';
  const accessSource = entitlement?.accessSource ?? 'none';
  const status = subscription?.status ?? null;
  const isActive =
    accessSource === 'stripe' ||
    accessSource === 'trial' ||
    accessSource === 'internal_override';

  const limits = useMemo(
    () => entitlement?.limits ?? getEffectiveLimits(plan),
    [entitlement?.limits, plan],
  );

  const features = useMemo(() => entitlement?.features ?? [], [entitlement?.features]);
  const subscriptionLimitOverrides =
    accessSource === 'internal_override'
      ? { activeProjectLimit: null, includedFieldSeats: null }
      : {
          activeProjectLimit: subscription?.activeProjectLimit,
          includedFieldSeats: subscription?.includedFieldSeats,
        };

  const hasFeature = useCallback(
    (feature: FeatureKey) => canUseFeature(plan, feature),
    [plan],
  );

  const getLimit = useCallback((key: LimitKey) => limits[key], [limits]);

  const canCreateProject = useCallback(
    (activeCount: number) =>
      canCreateProjectEntitlement(
        plan,
        activeCount,
        subscriptionLimitOverrides.activeProjectLimit,
      ),
    [plan, subscriptionLimitOverrides.activeProjectLimit],
  );

  const canInviteFieldSeat = useCallback(
    (currentCount: number) =>
      canInviteFieldSeatEntitlement(
        plan,
        currentCount,
        subscriptionLimitOverrides.includedFieldSeats,
      ),
    [plan, subscriptionLimitOverrides.includedFieldSeats],
  );

  const canInviteTeamMember = useCallback(
    (seatUsageCount: number) =>
      canInviteTeamMemberEntitlement(
        plan,
        seatUsageCount,
        subscriptionLimitOverrides.includedFieldSeats,
      ),
    [plan, subscriptionLimitOverrides.includedFieldSeats],
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
      accessSource,
      limits,
      features,
      subscription,
      internalOverride,
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
      accessSource,
      limits,
      features,
      subscription,
      internalOverride,
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
