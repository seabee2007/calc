import type { CanonicalProductionRate, CanonicalProductionRateVariant } from './canonicalProductionRateTypes';
import type { NormalizedProductionRateRecord, ProductionRateLibraryEntry } from './productionRateTypes';
import { mapRecordToLibraryEntry } from './mapToLibraryEntry';
import { buildSourceRecordLookup } from './canonicalProductionRateGrouping';

function pickDefaultVariant(canonical: CanonicalProductionRate): CanonicalProductionRateVariant {
  return canonical.variants[0];
}

export function resolveVariantSourceRecord(
  canonical: CanonicalProductionRate,
  variant: CanonicalProductionRateVariant,
  sourceLookup: Map<string, NormalizedProductionRateRecord>,
): NormalizedProductionRateRecord | null {
  return sourceLookup.get(variant.sourceProductionRateKey) ?? null;
}

export function mapCanonicalToLibraryEntry(
  canonical: CanonicalProductionRate,
  sourceLookup: Map<string, NormalizedProductionRateRecord>,
  variant: CanonicalProductionRateVariant = pickDefaultVariant(canonical),
): ProductionRateLibraryEntry | null {
  const sourceRecord = resolveVariantSourceRecord(canonical, variant, sourceLookup);
  if (!sourceRecord) return null;

  const base = mapRecordToLibraryEntry(sourceRecord);
  return {
    ...base,
    id: variant.sourceProductionRateKey,
    manHoursPerUnit: variant.manHoursPerUnit,
    unitOfMeasure: variant.unitOfMeasure,
    activityName: canonical.canonicalTitle,
    description: canonical.canonicalDescription || base.description,
    canonicalId: canonical.id,
    canonicalTitle: canonical.canonicalTitle,
    canonicalDescription: canonical.canonicalDescription,
    variantLabel: variant.label,
    sourceReferences: canonical.sourceReferences,
    allVariants: canonical.variants,
    confidence: canonical.confidence,
    keywords: [...new Set([...canonical.keywords, ...base.keywords])],
  };
}

export function mapCanonicalRatesToLibraryEntries(
  canonicalRates: CanonicalProductionRate[],
  sourceRecords: NormalizedProductionRateRecord[],
): ProductionRateLibraryEntry[] {
  const lookup = buildSourceRecordLookup(sourceRecords);
  return canonicalRates.flatMap((canonical) => {
    const entry = mapCanonicalToLibraryEntry(canonical, lookup);
    return entry ? [entry] : [];
  });
}

export function applyVariantFromEntry(
  entry: ProductionRateLibraryEntry,
  variantSourceKey: string,
): ProductionRateLibraryEntry | null {
  const variant = entry.allVariants?.find((item) => item.sourceProductionRateKey === variantSourceKey);
  if (!variant) return null;

  const sourceRef = entry.sourceReferences?.find(
    (ref) => ref.sourceProductionRateKey === variantSourceKey,
  );

  return {
    ...entry,
    id: variant.sourceProductionRateKey,
    manHoursPerUnit: variant.manHoursPerUnit,
    unitOfMeasure: variant.unitOfMeasure,
    variantLabel: variant.label,
    activityName: entry.canonicalTitle ?? entry.activityName,
    description: entry.canonicalDescription ?? entry.description,
    ...(sourceRef && {
      figure: sourceRef.figure,
      sourcePage: sourceRef.sourcePage,
      sourcePdfPage: sourceRef.sourcePdfPage,
      workElementNumber: sourceRef.workElementNumber,
      workElementLineNumber: sourceRef.workElementLineNumber,
    }),
  };
}

export function applyVariantToLibraryEntry(
  entry: ProductionRateLibraryEntry,
  variantSourceKey: string,
  sourceLookup: Map<string, NormalizedProductionRateRecord>,
): ProductionRateLibraryEntry | null {
  const variant = entry.allVariants?.find((item) => item.sourceProductionRateKey === variantSourceKey);
  if (!variant || !entry.canonicalId) return null;
  const sourceRecord = sourceLookup.get(variant.sourceProductionRateKey);
  if (!sourceRecord) return null;
  const base = mapRecordToLibraryEntry(sourceRecord);
  const fromEntry = applyVariantFromEntry(entry, variantSourceKey);
  if (!fromEntry) return null;
  return {
    ...fromEntry,
    ...base,
    id: variant.sourceProductionRateKey,
    manHoursPerUnit: variant.manHoursPerUnit,
    unitOfMeasure: variant.unitOfMeasure,
    activityName: entry.canonicalTitle ?? entry.activityName,
    description: entry.canonicalDescription ?? entry.description,
    variantLabel: variant.label,
  };
}
