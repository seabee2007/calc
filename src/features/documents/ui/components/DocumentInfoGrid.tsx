import type { DocumentInfoRow } from './professionalDocumentTypes';
import { displayValue } from '../previewDisplay';

interface DocumentInfoGridProps {
  title?: string;
  rows: DocumentInfoRow[];
  /**
   * How to handle rows with an empty/missing value.
   * - '—' (default): show an em-dash placeholder.
   * - 'hide': omit the row entirely.
   */
  emptyDisplay?: '—' | 'hide';
}

/**
 * Renders label/value rows inside a bordered card.
 *
 * Matches the Change Order "Project information" card layout.
 * Never renders raw undefined/null — all values pass through `displayValue()`.
 */
export default function DocumentInfoGrid({
  title,
  rows,
  emptyDisplay = '—',
}: DocumentInfoGridProps) {
  const visibleRows =
    emptyDisplay === 'hide'
      ? rows.filter((r) => Boolean(r.value?.trim()))
      : rows;

  if (visibleRows.length === 0 && emptyDisplay === 'hide') {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      {title ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
      ) : null}
      <div>
        {visibleRows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:gap-4"
          >
            <span className="shrink-0 text-xs font-semibold uppercase text-slate-500 sm:w-36">
              {row.label}
            </span>
            <span className="min-w-0 break-words text-sm text-slate-900">
              {displayValue(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
