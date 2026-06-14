import { supabase } from '../lib/supabase';
import { parseClientInfoFromDb } from '../types/projectClient';

function isClientInfoColumnError(message: string): boolean {
  return message.includes('client_info');
}

/** Client email from project.client_info JSON — does not query portal-only columns. */
export async function fetchProjectClientEmail(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('projects')
    .select('client_info')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    if (isClientInfoColumnError(error.message ?? '')) {
      return '';
    }
    return '';
  }

  if (!data) return '';

  const clientInfo = parseClientInfoFromDb(data.client_info);
  return clientInfo?.clientEmail?.trim() ?? '';
}
