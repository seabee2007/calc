import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './envSafety';

export function createQaAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function deleteWhereIn(
  admin: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<void> {
  if (values.length === 0) return;
  const { error } = await admin.from(table).delete().in(column, values);
  if (error) {
    if (isMissingTableError(error.message)) {
      console.log(`Skipped ${table}: table not found`);
      return;
    }
    throw new Error(`Failed deleting ${table}: ${error.message}`);
  }
}

export async function deleteWhereUserIds(
  admin: SupabaseClient,
  table: string,
  userColumn: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await admin.from(table).delete().in(userColumn, userIds);
  if (error) {
    if (isMissingTableError(error.message)) {
      console.log(`Skipped ${table}: table not found`);
      return;
    }
    throw new Error(`Failed deleting ${table} by ${userColumn}: ${error.message}`);
  }
}

export function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('schema cache') ||
    lower.includes('relation') && lower.includes('does not exist')
  );
}

export async function tryInsert<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  row: T,
): Promise<{ id?: string } | null> {
  const { data, error } = await admin.from(table).insert(row).select('id').maybeSingle();
  if (error) {
    if (isMissingTableError(error.message)) {
      console.log(`Skipped ${table}: table not found`);
      return null;
    }
    throw new Error(`Failed inserting into ${table}: ${error.message}`);
  }
  return data as { id?: string } | null;
}
