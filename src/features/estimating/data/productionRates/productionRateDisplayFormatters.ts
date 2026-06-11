import type { ProjectActivityLineItem } from '../../domain/constructionActivityTypes';
import type { ProductionRateLibraryEntry } from './productionRateTypes';

const FIGURE_PAREN_SUFFIX = /\s*\(Figure\s+5-[^)]+\)/gi;
const FIGURE_INLINE = /\s*Figure\s+5-[A-Z0-9-]+/gi;
const PAGE_DOT_REF = /\s*p\.\s*5-[A-Z0-9-]+/gi;
const PAGE_WORD_REF = /\s*Page\s+5-[A-Z0-9-]+/gi;
const CREW_TRAILING = /\s*crew\s*[-—:]\s*.+$/i;
const PDF_PAGE_REF = /\s*PDF\s+p\.?\s*\d+/gi;

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Strip manual/source traceability fragments from contractor-facing display text. */
export function stripSourceMetadataFromDisplayText(text: string): string {
  return collapseWhitespace(
    text
      .replace(FIGURE_PAREN_SUFFIX, '')
      .replace(FIGURE_INLINE, '')
      .replace(PAGE_DOT_REF, '')
      .replace(PAGE_WORD_REF, '')
      .replace(PDF_PAGE_REF, '')
      .replace(CREW_TRAILING, '')
      .replace(/\s*·\s*$/g, '')
      .replace(/\(\s*\)/g, ''),
  );
}

export function parseWorkElementFromProductionRateKey(key: string): {
  workElementNumber: string | null;
  workElementLineNumber: string | null;
} {
  const parts = key.split('-').filter(Boolean);
  if (parts.length < 3) {
    return { workElementNumber: null, workElementLineNumber: null };
  }

  const division = parts[0];
  const workElementLineNumber = parts[parts.length - 1] ?? null;
  let sectionParts = parts.slice(1, -1);
  if (sectionParts[0] === division) {
    sectionParts = sectionParts.slice(1);
  }

  const workElementNumber = collapseWhitespace([division, ...sectionParts].join(' '));
  return {
    workElementNumber: workElementNumber || null,
    workElementLineNumber,
  };
}

export function resolveWorkElementNumber(
  entry: Pick<ProductionRateLibraryEntry, 'workElementNumber' | 'id'>,
): string | null {
  const explicit = entry.workElementNumber?.trim();
  if (explicit) return explicit;
  return parseWorkElementFromProductionRateKey(entry.id).workElementNumber;
}

export function resolveWorkElementLineNumber(
  entry: Pick<ProductionRateLibraryEntry, 'workElementLineNumber' | 'id'>,
): string | null {
  const explicit = entry.workElementLineNumber?.trim();
  if (explicit) return explicit;
  return parseWorkElementFromProductionRateKey(entry.id).workElementLineNumber;
}

export function formatProductionRateDisplayTitle(entry: ProductionRateLibraryEntry): string {
  const raw =
    entry.canonicalTitle?.trim() ||
    entry.activityName?.trim() ||
    entry.description?.trim() ||
    'Production rate';
  return stripSourceMetadataFromDisplayText(raw);
}

export function formatProductionRateWorkElementLabel(
  entry: Pick<ProductionRateLibraryEntry, 'workElementNumber' | 'id'>,
): string | null {
  return resolveWorkElementNumber(entry);
}

export interface ProductionRateSubtitleOptions {
  includeCrew?: boolean;
  includeLineNumber?: boolean;
}

export function formatProductionRateSubtitle(
  entry: ProductionRateLibraryEntry,
  options: ProductionRateSubtitleOptions = {},
): string {
  const parts: string[] = [];
  const workElement = formatProductionRateWorkElementLabel(entry);
  if (workElement) {
    parts.push(`Work Element ${workElement}`);
  }

  if (options.includeLineNumber !== false) {
    const lineNumber = resolveWorkElementLineNumber(entry);
    if (lineNumber) {
      parts.push(`Line ${lineNumber}`);
    }
  }

  if (entry.manHoursPerUnit != null && Number.isFinite(entry.manHoursPerUnit)) {
    parts.push(`${entry.manHoursPerUnit.toFixed(3)} MH/${entry.unitOfMeasure}`);
  }

  if (options.includeCrew && entry.crewSize != null) {
    parts.push(`Crew ${entry.crewSize}`);
  }

  return parts.join(' · ');
}

export function formatActivityLineItemReference(item: ProjectActivityLineItem): string {
  if (item.pricingSource === 'manual') return 'Manual';

  const parsed = item.sourceProductionRateKey
    ? parseWorkElementFromProductionRateKey(item.sourceProductionRateKey)
    : { workElementNumber: null, workElementLineNumber: null };

  const parts: string[] = [];
  if (parsed.workElementNumber) {
    parts.push(`Work Element ${parsed.workElementNumber}`);
  }
  if (parsed.workElementLineNumber) {
    parts.push(`Line ${parsed.workElementLineNumber}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Production rate';
}

/** @deprecated use formatProductionRateDisplayTitle */
export function getProductionRateDisplayTitle(entry: ProductionRateLibraryEntry): string {
  return formatProductionRateDisplayTitle(entry);
}

export function formatVariantDisplayLabel(label: string): string {
  return stripSourceMetadataFromDisplayText(label);
}
