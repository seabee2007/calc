import { supabase } from '../lib/supabase';
import type { SubscriptionTier, Subscription } from '../types/subscription';

export async function getSubscriptionTiers(): Promise<SubscriptionTier[]> {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .order('id');

  if (error) throw error;
  return data;
}

export async function getCurrentSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      tier:subscription_tiers(*)
    `)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No subscription found
    throw error;
  }
  return data;
}