import type { ComponentType, LazyExoticComponent } from 'react';
import type { FeatureKey } from '../../lib/entitlements';
import { LazyRoute } from '../../routes/lazyPages';
import FeatureGate from './FeatureGate';

interface GatedLazyRouteProps {
  feature: FeatureKey;
  Page: LazyExoticComponent<ComponentType<object>>;
}

export function GatedLazyRoute({ feature, Page }: GatedLazyRouteProps) {
  return (
    <FeatureGate feature={feature}>
      <LazyRoute Page={Page} />
    </FeatureGate>
  );
}
