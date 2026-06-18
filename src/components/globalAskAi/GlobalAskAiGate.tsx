import React, { Suspense } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { LazyConcreteChat } from '../../routes/lazyPages';

export default function GlobalAskAiGate() {
  const { hasFeature, loading } = useSubscription();

  if (loading || !hasFeature('global_ask_ai')) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyConcreteChat />
    </Suspense>
  );
}
