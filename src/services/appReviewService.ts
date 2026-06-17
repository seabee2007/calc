import { supabase } from '../lib/supabase';
import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export const REVIEW_REWARD_QUANTITY = 25;
export const REVIEW_REWARD_UNIT = 'ai_request';
export const REVIEW_MIN_TEXT_LENGTH = 20;
export const REVIEW_MAX_TEXT_LENGTH = 2000;
export const REVIEW_ELIGIBILITY_DAYS = 7;
export const REVIEW_DISMISS_DAYS = 7;

export interface ReviewPayload {
  rating: number;
  reviewText: string;
  publicConsent: boolean;
  reviewerName?: string;
  reviewerCompany?: string;
  reviewerRole?: string;
}

export interface ReviewRewardResult {
  usageUnit: string;
  quantity: number;
  expiresAt: string;
}

export interface SubmitReviewResponse {
  ok: true;
  reviewId: string;
  reward: ReviewRewardResult;
}

export interface SubmitReviewError {
  error: string;
  code?: string;
  daysRemaining?: number;
  reviewId?: string;
}

export interface ReviewStatusResult {
  claimed: boolean;
  reviewId?: string;
}

function resolveEmployerId(userId: string, employerId: string | null | undefined): string {
  return employerId ?? userId;
}

export async function fetchMyReviewStatus(
  userId: string,
  employerId: string | null | undefined,
): Promise<ReviewStatusResult> {
  const billingEmployerId = resolveEmployerId(userId, employerId);

  const { data, error } = await supabase
    .from('app_reviews')
    .select('id')
    .eq('employer_id', billingEmployerId)
    .eq('reward_granted', true)
    .maybeSingle();

  if (error) throw error;

  if (data?.id) {
    return { claimed: true, reviewId: data.id as string };
  }

  return { claimed: false };
}

export async function submitReview(payload: ReviewPayload): Promise<SubmitReviewResponse> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const res = await fetch(`${FN_BASE}/submit-app-review`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseEdgeFunctionJson<SubmitReviewResponse & SubmitReviewError>(res);

  if ('error' in data && data.error) {
    const err = new Error(data.error);
    if (data.code) {
      (err as Error & { code?: string; daysRemaining?: number }).code = data.code;
      if (typeof data.daysRemaining === 'number') {
        (err as Error & { daysRemaining?: number }).daysRemaining = data.daysRemaining;
      }
    }
    throw err;
  }

  if (!('ok' in data) || !data.ok) {
    throw new Error('Unexpected response from review submission.');
  }

  return data as SubmitReviewResponse;
}

export function reviewDismissStorageKey(employerOrUserId: string): string {
  return `arden:review-reward-dismissed:${employerOrUserId}`;
}

export function isReviewDismissed(employerOrUserId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(reviewDismissStorageKey(employerOrUserId));
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  const msSinceDismiss = Date.now() - dismissedAt;
  return msSinceDismiss < REVIEW_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function dismissReviewReward(employerOrUserId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(reviewDismissStorageKey(employerOrUserId), String(Date.now()));
}

export function daysSinceDate(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  const created = new Date(isoDate).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
}

export function daysUntilReviewEligible(createdAt: string | null | undefined): number {
  const age = daysSinceDate(createdAt);
  return Math.max(0, REVIEW_ELIGIBILITY_DAYS - age);
}
