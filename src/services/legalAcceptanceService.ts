import { supabase } from '../lib/supabase';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';
import type { UserLegalAcceptance } from '../types/legalAcceptance';

function mapRow(row: Record<string, unknown>): UserLegalAcceptance {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    termsVersion: row.terms_version as string,
    privacyVersion: row.privacy_version as string,
    termsAcceptedAt: row.terms_accepted_at as string,
    privacyAcceptedAt: row.privacy_accepted_at as string,
    acceptedIp: (row.accepted_ip as string | null) ?? null,
    acceptedUserAgent: (row.accepted_user_agent as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function sessionCacheKey(userId: string): string {
  return `legal_accepted_${userId}_${CURRENT_TERMS_VERSION}_${CURRENT_PRIVACY_VERSION}`;
}

export function readLegalAcceptanceSessionCache(userId: string): boolean {
  try {
    return sessionStorage.getItem(sessionCacheKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function writeLegalAcceptanceSessionCache(userId: string): void {
  try {
    sessionStorage.setItem(sessionCacheKey(userId), 'true');
  } catch {
    // sessionStorage unavailable — DB remains source of truth
  }
}

export function clearLegalAcceptanceSessionCache(userId: string): void {
  try {
    sessionStorage.removeItem(sessionCacheKey(userId));
  } catch {
    // ignore
  }
}

export async function getCurrentLegalAcceptance(
  userId: string,
): Promise<UserLegalAcceptance | null> {
  const { data, error } = await supabase
    .from('user_legal_acceptances')
    .select('*')
    .eq('user_id', userId)
    .eq('terms_version', CURRENT_TERMS_VERSION)
    .eq('privacy_version', CURRENT_PRIVACY_VERSION)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  writeLegalAcceptanceSessionCache(userId);
  return mapRow(data as Record<string, unknown>);
}

export async function getLatestLegalAcceptance(
  userId: string,
): Promise<UserLegalAcceptance | null> {
  const { data, error } = await supabase
    .from('user_legal_acceptances')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapRow(data as Record<string, unknown>);
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || (error.message ?? '').includes('duplicate key');
}

export async function acceptCurrentLegalDocuments(userId: string): Promise<UserLegalAcceptance> {
  const now = new Date().toISOString();
  const acceptedUserAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : null;

  const { data, error } = await supabase
    .from('user_legal_acceptances')
    .insert({
      user_id: userId,
      terms_version: CURRENT_TERMS_VERSION,
      privacy_version: CURRENT_PRIVACY_VERSION,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      accepted_ip: null,
      accepted_user_agent: acceptedUserAgent,
    })
    .select('*')
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const existing = await getCurrentLegalAcceptance(userId);
      if (existing) {
        return existing;
      }
    }
    throw new Error(error.message);
  }

  writeLegalAcceptanceSessionCache(userId);
  return mapRow(data as Record<string, unknown>);
}
