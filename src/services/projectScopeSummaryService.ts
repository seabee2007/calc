import { fallbackScopeSummary, normalizeScopeSummaryTitle } from '../utils/projectNumbering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function summarizeProjectScope(scope: string): Promise<string> {
  const trimmed = scope.trim();
  if (!trimmed) return 'Concrete placement';

  if (!FN_BASE || !ANON_KEY) {
    return fallbackScopeSummary(trimmed);
  }

  try {
    const res = await fetch(`${FN_BASE}/summarize-project-scope`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ scope: trimmed }),
    });

    const data = (await res.json()) as { title?: string; error?: string };

    if (!res.ok) {
      return fallbackScopeSummary(trimmed);
    }

    if (data.title?.trim()) {
      return normalizeScopeSummaryTitle(data.title);
    }
  } catch (err) {
    console.warn('summarizeProjectScope failed, using fallback', err);
  }

  return fallbackScopeSummary(trimmed);
}
