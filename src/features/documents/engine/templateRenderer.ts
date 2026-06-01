/**
 * Minimal, deterministic template renderer for clause/addendum bodies.
 *
 * Supports a small Handlebars-style subset that the catalogs actually use:
 *   - `{{path.to.value}}`            scalar interpolation
 *   - `{{currency path.to.value}}`   USD currency formatting
 *   - `{{#each path}} ... {{/each}}` single-level iteration over arrays
 *
 * Inside an `{{#each}}` block, tokens resolve against the current item first,
 * then fall back to the root data. Missing scalars render as a visible
 * fill-in marker (`[path]`) so draft documents clearly flag blanks rather than
 * silently dropping content. No React, no Supabase, fully synchronous.
 */

type TemplateData = Record<string, unknown>;

const EACH_BLOCK = /{{#each\s+([\w.]+)}}([\s\S]*?){{\/each}}/g;
const CURRENCY_TOKEN = /{{\s*currency\s+([\w.]+)\s*}}/g;
const SCALAR_TOKEN = /{{\s*([\w.]+)\s*}}/g;

function resolvePath(data: unknown, path: string): unknown {
  if (data == null) return undefined;
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, data);
}

function formatCurrency(value: unknown): string | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
        ? Number(value)
        : undefined;
  if (numeric === undefined) return undefined;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numeric);
}

function scalarToString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/**
 * Render scalar and currency tokens against a context, falling back to root.
 * Missing values render as `[path]`.
 */
function renderScalars(
  template: string,
  context: unknown,
  root: TemplateData,
): string {
  const withCurrency = template.replace(CURRENCY_TOKEN, (_match, path: string) => {
    const value = resolvePath(context, path) ?? resolvePath(root, path);
    return formatCurrency(value) ?? `[${path}]`;
  });

  return withCurrency.replace(SCALAR_TOKEN, (_match, path: string) => {
    const value = resolvePath(context, path) ?? resolvePath(root, path);
    return scalarToString(value) ?? `[${path}]`;
  });
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  const root = data ?? {};

  const withBlocks = template.replace(
    EACH_BLOCK,
    (_match, path: string, inner: string) => {
      const collection = resolvePath(root, path);
      if (!Array.isArray(collection) || collection.length === 0) return '';
      return collection
        .map((item) => renderScalars(inner, item, root))
        .join('')
        .replace(/^\n/, '');
    },
  );

  return renderScalars(withBlocks, root, root);
}
