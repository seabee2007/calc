import { supabase } from '../lib/supabase';
import { parseClientInfoFromDb } from '../types/projectClient';

export async function fetchProjectClientEmail(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('projects')
    .select('client_info')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data) return '';

  const clientInfo = parseClientInfoFromDb(data.client_info);
  return clientInfo?.clientEmail?.trim() ?? '';
}
