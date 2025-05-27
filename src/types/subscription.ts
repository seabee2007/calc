export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  features: string[];
  limits: {
    projects: number;
    calculationsPerMonth: number;
  };
}

export interface Subscription {
  id: string;
  userId: string;
  tierId: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithTier extends Subscription {
  tier: SubscriptionTier;
}