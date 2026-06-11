import type { NormalizedProductionRateRecord } from './productionRateTypes';
import type {
  CanonicalConfidence,
  CanonicalProductionRate,
  CanonicalProductionRateVariant,
  CanonicalSourceReference,
  CanonicalizationReport,
} from './canonicalProductionRateTypes';
import {
  buildStrongMatchKey,
  buildVariantStemKey,
  extractDimensionTokens,
  getRecordDescription,
  hasConflictingProductionConditions,
  jaccardSimilarity,
  manHoursWithinTolerance,
  normalizeCategory,
  normalizeUnitKey,
  roundManHours,
  stableHash,
} from './canonicalProductionRateNormalization';
import {
  buildCanonicalDescription,
  buildCanonicalTitle,
  buildVariantLabel,
} from './canonicalProductionRateTitles';
import { mapRecordToLibraryEntry } from './mapToLibraryEntry';

const NEAR_MH_TOLERANCE = 0.01;
const NEAR_SIMILARITY_THRESHOLD = 0.85;

function buildKeywords(records: NormalizedProductionRateRecord[]): string[] {
  const tokens = records.flatMap((record) => mapRecordToLibraryEntry(record).keywords);
  return [...new Set(tokens)];
}

function toSourceReference(record: NormalizedProductionRateRecord): CanonicalSourceReference {
  return {
    sourceProductionRateKey: record.id,
    figure: record.figure,
    sourcePage: record.sourcePage,
    sourcePdfPage: record.sourcePdfPage,
    workElementNumber: record.workElementNumber,
    workElementLineNumber: record.workElementLineNumber,
    originalDescription: getRecordDescription(record),
    originalManHoursPerUnit: record.manHoursPerUnit ?? 0,
    originalUnitOfMeasure: record.unitOfMeasure,
  };
}

function toVariant(record: NormalizedProductionRateRecord): CanonicalProductionRateVariant {
  const notes: string[] = [];
  if (record.rowNotes) notes.push(record.rowNotes);
  return {
    label: buildVariantLabel(record),
    sourceProductionRateKey: record.id,
    manHoursPerUnit: record.manHoursPerUnit ?? 0,
    unitOfMeasure: record.unitOfMeasure,
    notes: notes.length ? notes : undefined,
  };
}

function pickPrimaryRecord(records: NormalizedProductionRateRecord[]): NormalizedProductionRateRecord {
  return [...records].sort((a, b) => getRecordDescription(b).length - getRecordDescription(a).length)[0];
}

function canNearMerge(a: NormalizedProductionRateRecord, b: NormalizedProductionRateRecord): boolean {
  if (a.division !== b.division) return false;
  if (normalizeCategory(a) !== normalizeCategory(b)) return false;
  if (normalizeUnitKey(a.unitOfMeasure) !== normalizeUnitKey(b.unitOfMeasure)) return false;
  const descA = getRecordDescription(a);
  const descB = getRecordDescription(b);
  if (hasConflictingProductionConditions(descA, descB)) return false;
  if (!manHoursWithinTolerance(a.manHoursPerUnit, b.manHoursPerUnit, NEAR_MH_TOLERANCE)) return false;
  return jaccardSimilarity(descA, descB) >= NEAR_SIMILARITY_THRESHOLD;
}

function isVariantFamily(records: NormalizedProductionRateRecord[]): boolean {
  if (records.length < 2) return false;
  const stem = buildVariantStemKey(records[0]);
  if (!records.every((record) => buildVariantStemKey(record) === stem)) return false;
  const dimensionSets = records.map((record) =>
    extractDimensionTokens(getRecordDescription(record)).join(','),
  );
  const uniqueDims = new Set(dimensionSets.filter(Boolean));
  if (uniqueDims.size <= 1 && records.length > 1) {
    const mhValues = records.map((record) => roundManHours(record.manHoursPerUnit));
    return new Set(mhValues).size > 1;
  }
  return uniqueDims.size > 1;
}

function buildCanonicalFromGroup(
  records: NormalizedProductionRateRecord[],
  confidence: CanonicalConfidence,
  notes: string[],
  groupKind: 'merged' | 'variant' | 'separate',
): CanonicalProductionRate {
  const primary = pickPrimaryRecord(records);
  const variants =
    groupKind === 'variant' || records.length > 1
      ? records.map(toVariant)
      : [toVariant(primary)];
  const canonicalKey =
    groupKind === 'variant' ? buildVariantStemKey(primary) : buildStrongMatchKey(primary);
  const id = `canonical-${stableHash(canonicalKey)}`;

  return {
    id,
    canonicalKey,
    qaStatus: 'approved',
    divisionCode: primary.division,
    divisionName: primary.divisionName,
    category: primary.category ?? primary.subcategory ?? primary.activityName,
    canonicalTitle: buildCanonicalTitle(records),
    canonicalDescription: buildCanonicalDescription(records),
    unitOfMeasure: primary.unitOfMeasure,
    manHoursPerUnit: primary.manHoursPerUnit ?? 0,
    crewSize: primary.crewSize,
    sourceRecordIds: records.map((record) => record.id),
    sourceReferences: records.map(toSourceReference),
    variants,
    confidence,
    canonicalizationNotes: notes.length ? notes : undefined,
    keywords: buildKeywords(records),
  };
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]);
    }
    return this.parent[index];
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}

export interface CanonicalizeProductionRatesOptions {
  includeReview?: boolean;
}

export interface CanonicalizeProductionRatesResult {
  canonicalRates: CanonicalProductionRate[];
  report: CanonicalizationReport;
}

export function canonicalizeProductionRates(
  records: NormalizedProductionRateRecord[],
  options: CanonicalizeProductionRatesOptions = {},
): CanonicalizeProductionRatesResult {
  const n = records.length;
  const uf = new UnionFind(n);
  const groupNotes = new Map<number, string[]>();

  const addNote = (index: number, note: string) => {
    const existing = groupNotes.get(index) ?? [];
    existing.push(note);
    groupNotes.set(index, existing);
  };

  const strongBuckets = new Map<string, number[]>();
  records.forEach((record, index) => {
    const key = buildStrongMatchKey(record);
    const bucket = strongBuckets.get(key) ?? [];
    bucket.push(index);
    strongBuckets.set(key, bucket);
  });
  for (const bucket of strongBuckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 1; i < bucket.length; i += 1) {
      uf.union(bucket[0], bucket[i]);
      addNote(bucket[i], 'autoMergedHighConfidence:strongMatch');
    }
  }

  const contextBuckets = new Map<string, number[]>();
  records.forEach((record, index) => {
    const key = [record.division, normalizeCategory(record), normalizeUnitKey(record.unitOfMeasure)].join(
      '|',
    );
    const bucket = contextBuckets.get(key) ?? [];
    bucket.push(index);
    contextBuckets.set(key, bucket);
  });

  for (const bucket of contextBuckets.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = records[bucket[i]];
        const b = records[bucket[j]];
        if (uf.find(bucket[i]) === uf.find(bucket[j])) continue;
        if (!canNearMerge(a, b)) continue;
        uf.union(bucket[i], bucket[j]);
        addNote(bucket[j], 'autoMergedHighConfidence:nearDuplicate');
      }
    }
  }

  for (const bucket of contextBuckets.values()) {
    const stemBuckets = new Map<string, number[]>();
    for (const index of bucket) {
      const stem = buildVariantStemKey(records[index]);
      const stemBucket = stemBuckets.get(stem) ?? [];
      stemBucket.push(index);
      stemBuckets.set(stem, stemBucket);
    }
    for (const stemBucket of stemBuckets.values()) {
      if (stemBucket.length < 2) continue;
      const groupRecords = stemBucket.map((index) => records[index]);
      if (!isVariantFamily(groupRecords)) continue;
      for (let i = 1; i < stemBucket.length; i += 1) {
        if (uf.find(stemBucket[0]) !== uf.find(stemBucket[i])) {
          uf.union(stemBucket[0], stemBucket[i]);
          addNote(stemBucket[i], 'variantGroupsCreated:dimensionFamily');
        }
      }
    }
  }

  const grouped = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = uf.find(i);
    const group = grouped.get(root) ?? [];
    group.push(i);
    grouped.set(root, group);
  }

  const autoMergedHighConfidence: CanonicalizationReport['autoMergedHighConfidence'] = [];
  const keptSeparateHighConfidence: CanonicalizationReport['keptSeparateHighConfidence'] = [];
  const variantGroupsCreated: CanonicalizationReport['variantGroupsCreated'] = [];
  const needsHumanReview: CanonicalizationReport['needsHumanReview'] = [];
  const blockedFromCanonical: CanonicalizationReport['blockedFromCanonical'] = [];
  const canonicalRates: CanonicalProductionRate[] = [];

  for (const indices of grouped.values()) {
    const groupRecords = indices.map((index) => records[index]);
    const notes = indices.flatMap((index) => groupNotes.get(index) ?? []);
    const hasVariantNote = notes.some((note) => note.startsWith('variantGroupsCreated'));
    const hasMergeNote = notes.some((note) => note.startsWith('autoMergedHighConfidence'));
    const variantFamily = isVariantFamily(groupRecords);

    let confidence: CanonicalConfidence = 'high';
    let groupKind: 'merged' | 'variant' | 'separate' = 'separate';

    if (variantFamily || hasVariantNote) {
      groupKind = 'variant';
      confidence = 'medium';
    } else if (hasMergeNote || groupRecords.length > 1) {
      groupKind = 'merged';
      confidence = hasMergeNote ? 'high' : 'medium';
    }

    if (groupRecords.length > 1 && !hasMergeNote && !variantFamily) {
      const descriptions = groupRecords.map(getRecordDescription);
      const sim = jaccardSimilarity(descriptions[0], descriptions[1]);
      if (sim < NEAR_SIMILARITY_THRESHOLD) {
        confidence = 'low';
        notes.push('needsHumanReview:ambiguousGrouping');
      }
    }

    const primary = pickPrimaryRecord(groupRecords);
    if ((primary.manHoursPerUnit ?? 0) <= 0) {
      blockedFromCanonical.push({
        canonicalId: `blocked-${primary.id}`,
        canonicalKey: primary.id,
        canonicalTitle: getRecordDescription(primary),
        sourceRecordIds: groupRecords.map((record) => record.id),
        confidence: 'low',
        notes: ['blockedFromCanonical:missingManHoursPerUnit'],
      });
      continue;
    }

    const canonical = buildCanonicalFromGroup(groupRecords, confidence, notes, groupKind);
    const bucketEntry = {
      canonicalId: canonical.id,
      canonicalKey: canonical.canonicalKey,
      canonicalTitle: canonical.canonicalTitle,
      sourceRecordIds: canonical.sourceRecordIds,
      confidence: canonical.confidence,
      notes: canonical.canonicalizationNotes,
    };

    if (confidence === 'low') {
      needsHumanReview.push(bucketEntry);
      if (options.includeReview) canonicalRates.push(canonical);
      continue;
    }

    if (groupKind === 'variant') {
      variantGroupsCreated.push(bucketEntry);
    } else if (groupKind === 'merged') {
      autoMergedHighConfidence.push(bucketEntry);
    } else {
      keptSeparateHighConfidence.push(bucketEntry);
    }

    canonicalRates.push(canonical);
  }

  return {
    canonicalRates,
    report: {
      generatedAt: new Date().toISOString(),
      sourceRecordCount: records.length,
      canonicalRecordCount: canonicalRates.length,
      autoMergedHighConfidence,
      keptSeparateHighConfidence,
      variantGroupsCreated,
      needsHumanReview,
      blockedFromCanonical,
    },
  };
}

export function buildSourceRecordLookup(
  records: NormalizedProductionRateRecord[],
): Map<string, NormalizedProductionRateRecord> {
  return new Map(records.map((record) => [record.id, record]));
}
