import { supabase } from '../../../lib/supabase';

export const PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE = 'Enter a scope first';

export const PROFESSIONALIZE_SCOPE_SUCCESS_MESSAGE = 'Scope improved';

export const PROFESSIONALIZE_SCOPE_ERROR_MESSAGE = 'Could not improve scope';

export const CONTRACTOR_FURNISH_PREFIX =
  'The contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to';

export interface ProfessionalizeProjectScopeRequest {
  scopeText: string;
  projectType?: string;
  projectName?: string;
}

export class ProfessionalizeScopeEmptyError extends Error {
  constructor(message = PROFESSIONALIZE_SCOPE_EMPTY_MESSAGE) {
    super(message);
    this.name = 'ProfessionalizeScopeEmptyError';
  }
}

export class ProfessionalizeScopeFailedError extends Error {
  constructor(message = PROFESSIONALIZE_SCOPE_ERROR_MESSAGE) {
    super(message);
    this.name = 'ProfessionalizeScopeFailedError';
  }
}

export function isScopeTextEmpty(scopeText: string): boolean {
  return scopeText.trim().length === 0;
}

export function applyContractorFurnishPrefix(scopeText: string): string {
  const trimmed = scopeText.trim();
  if (!trimmed) return trimmed;

  if (
    /^the contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  let body = trimmed;
  if (/^[A-Z]/.test(body)) {
    body = body.charAt(0).toLowerCase() + body.slice(1);
  }

  return `${CONTRACTOR_FURNISH_PREFIX} ${body}`;
}

export function improvedScopePreservesUserDetails(original: string, improved: string): boolean {
  const originalNormalized = original.toLowerCase();
  const improvedNormalized = improved.toLowerCase();

  const numberMatches = original.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  for (const value of numberMatches) {
    if (!improvedNormalized.includes(value.toLowerCase())) {
      return false;
    }
  }

  const dimensionPattern =
    /\b\d[\d,]*(?:\.\d+)?\s*(?:square\s+feet|sq\.?\s*ft\.?|sf|feet|ft|foot|inches|in)\b/gi;
  const dimensions = original.match(dimensionPattern) ?? [];
  for (const dimension of dimensions) {
    if (!improvedNormalized.includes(dimension.toLowerCase())) {
      return false;
    }
  }

  if (originalNormalized.trim() && !improvedNormalized.includes(originalNormalized.slice(0, 12).trim())) {
    return false;
  }

  return improved.trim().length >= original.trim().length * 0.85;
}

export function parseProfessionalizeScopeResponse(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new ProfessionalizeScopeFailedError();
  }

  const improvedScope = (body as { improvedScope?: unknown }).improvedScope;
  if (typeof improvedScope !== 'string' || !improvedScope.trim()) {
    throw new ProfessionalizeScopeFailedError();
  }

  return improvedScope.trim();
}

export function buildProfessionalizeScopeUserPrompt(
  request: ProfessionalizeProjectScopeRequest,
): string {
  return [
    'Rewrite this project scope into professional construction SOW language.',
    '',
    'Requirements:',
    '- Start with “The contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to” when the wording fits.',
    '- Preserve all quantities, dimensions, locations, materials, trades, exclusions, and requirements.',
    '- Do not remove any user-provided detail.',
    '- Do not add unsupported scope.',
    '- Clean grammar and improve clarity.',
    '- Return only the improved scope.',
    '',
    `Project name:\n${request.projectName?.trim() || '(not provided)'}`,
    '',
    `Project type:\n${request.projectType?.trim() || '(not provided)'}`,
    '',
    `Original scope:\n${request.scopeText.trim()}`,
  ].join('\n');
}

export async function professionalizeProjectScope(
  request: ProfessionalizeProjectScopeRequest,
): Promise<string> {
  if (isScopeTextEmpty(request.scopeText)) {
    throw new ProfessionalizeScopeEmptyError();
  }

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new ProfessionalizeScopeFailedError();
  }

  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new ProfessionalizeScopeFailedError();
  }

  const res = await fetch(`${base}/functions/v1/professionalize-project-scope`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      scopeText: request.scopeText.trim(),
      projectType: request.projectType?.trim() || undefined,
      projectName: request.projectName?.trim() || undefined,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : PROFESSIONALIZE_SCOPE_ERROR_MESSAGE;
    throw new ProfessionalizeScopeFailedError(message);
  }

  return parseProfessionalizeScopeResponse(body);
}
