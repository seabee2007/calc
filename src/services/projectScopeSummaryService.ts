import { fallbackScopeSummary, normalizeScopeSummaryTitle } from '../utils/projectNumbering';
import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { isUsageLimitError, parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export async function summarizeProjectScope(scope: string): Promise<string> {
  const trimmed = scope.trim();
  if (!trimmed) return 'Concrete placement';

  if (!FN_BASE) {
    return fallbackScopeSummary(trimmed);
  }

  try {
    const res = await fetch(`${FN_BASE}/summarize-project-scope`, {
      method: 'POST',
      headers: await getMeteredAuthHeaders(),
      body: JSON.stringify({ scope: trimmed }),
    });

    const data = await parseEdgeFunctionJson<{ title?: string; error?: string }>(res);

    if (data.title?.trim()) {
      return normalizeScopeSummaryTitle(data.title);
    }
  } catch (err) {
    if (isUsageLimitError(err)) throw err;
    console.warn('summarizeProjectScope failed, using fallback', err);
  }

  return fallbackScopeSummary(trimmed);
}
