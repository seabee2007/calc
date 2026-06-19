import type { ReactNode } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import type { FeatureKey } from '../../lib/entitlements';
import UpgradeRequiredCard from './UpgradeRequiredCard';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  inline?: boolean;
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  inline = false,
}: FeatureGateProps) {
  const { hasFeature, loading } = useSubscription();
  const allowed = hasFeature(feature);

  if (loading) {
    return null;
  }

  if (allowed) {
    return <>{children}</>;
  }

  const blocked = fallback ?? <UpgradeRequiredCard feature={feature} />;

  if (inline) {
    return <>{blocked}</>;
  }

  return (
    <div className="w-full" data-testid={`feature-gate-blocked-${feature}`}>
      {blocked}
    </div>
  );
}
