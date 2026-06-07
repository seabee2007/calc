/**
 * Standalone validator for the Residential Baseline Activity Master.
 *
 * Pure functions only: no I/O, no saved estimate data. Enforces the
 * data-integrity rules required for a single-responsibility activity master
 * (one trade, one action, one phase per card).
 */

import { findConstructionUnitByCode } from './constructionUnits';
import type {
  ActivityType,
  EstimateActivityTemplate,
} from './residentialActivityMaster';

export type ActivityMasterValidationResult = {
  errors: string[];
  ok: boolean;
};

const ACTIVITY_CODE_PATTERN = /^\d{2}-\d{2}-\d{2}$/;

const ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>([
  'work',
  'inspection',
  'milestone',
  'curing_lag',
  'procurement_lead_time',
  'testing',
]);

const VARIANTS: ReadonlySet<NonNullable<EstimateActivityTemplate['variant']>> =
  new Set(['baseline', 'slab_on_grade', 'crawlspace', 'optional']);

/**
 * Lower-cased substrings that usually signal a compound (multi-action) card
 * that should have been split into single-responsibility rows.
 */
const SUSPICIOUS_COMPOUND_PHRASES: readonly string[] = [
  'templating and fabrication',
  'sod and irrigation',
  'driveway and walks',
  'rectification walkthrough',
  'hang and finish',
  'hang and tape',
  'rough and trim',
  'rough-in and trim',
  'supply and install',
  'furnish and install',
  'demo and',
  'and demolition',
];

/**
 * Titles that legitimately contain an "X and Y" phrase because they describe a
 * single intentional step. These are exempt from the compound-phrase scan.
 */
const ALLOWED_COMPOUND_TITLES: ReadonlySet<string> = new Set([
  'Tape and finish drywall',
  'Install landscaping and sod',
  'Brace and tie roof trusses',
  'Plumb and line walls',
  'Set tubs and shower pans',
  'Install devices and cover plates',
  'Install refrigerant and condensate lines',
  'Install supply and return ductwork',
  'Install baseboard and casing',
  'Install thermostats and controls',
  'Install registers and grilles',
  'Install gutters and downspouts',
  'Set girders and support columns',
  'Final turnover and warranty handoff',
  'Energize and label panel',
  'Install hardwood or laminate flooring',
  'Site control and benchmark staking',
]);

function containsSuspiciousCompoundPhrase(title: string): string | null {
  if (ALLOWED_COMPOUND_TITLES.has(title)) return null;
  const lower = title.toLowerCase();
  for (const phrase of SUSPICIOUS_COMPOUND_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function validateActivityMasterDataset(
  rows: readonly EstimateActivityTemplate[],
): ActivityMasterValidationResult {
  const errors: string[] = [];

  const seenCodes = new Map<string, number>();
  const seenTitleKeys = new Set<string>();

  rows.forEach((row, index) => {
    const where = `[${index}] ${row.activityCode || '<no code>'} "${row.title || '<no title>'}"`;

    // Required string fields.
    const requiredStrings: Array<[keyof EstimateActivityTemplate, string]> = [
      ['activityCode', row.activityCode],
      ['title', row.title],
      ['divisionCode', row.divisionCode],
      ['divisionName', row.divisionName],
      ['workPackageCode', row.workPackageCode],
      ['workPackageName', row.workPackageName],
      ['sequencingCategory', row.sequencingCategory],
      ['logicAnchor', row.logicAnchor],
      ['defaultUnit', row.defaultUnit],
      ['primaryTrade', row.primaryTrade],
      ['actionDescription', row.actionDescription],
    ];
    for (const [field, value] of requiredStrings) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${where}: missing required field "${String(field)}".`);
      }
    }

    // Code format + uniqueness.
    if (!ACTIVITY_CODE_PATTERN.test(row.activityCode)) {
      errors.push(`${where}: activityCode must match DD-PP-SS (got "${row.activityCode}").`);
    } else {
      if (seenCodes.has(row.activityCode)) {
        errors.push(
          `${where}: duplicate activityCode (first seen at index ${seenCodes.get(row.activityCode)}).`,
        );
      } else {
        seenCodes.set(row.activityCode, index);
      }

      // divisionCode / workPackageCode must derive from the activityCode.
      const expectedDivision = row.activityCode.slice(0, 2);
      const expectedWorkPackage = row.activityCode.slice(0, 5);
      if (row.divisionCode !== expectedDivision) {
        errors.push(
          `${where}: divisionCode "${row.divisionCode}" does not match code prefix "${expectedDivision}".`,
        );
      }
      if (row.workPackageCode !== expectedWorkPackage) {
        errors.push(
          `${where}: workPackageCode "${row.workPackageCode}" does not match code prefix "${expectedWorkPackage}".`,
        );
      }
    }

    // activityType.
    if (!ACTIVITY_TYPES.has(row.activityType)) {
      errors.push(`${where}: invalid activityType "${row.activityType}".`);
    }

    // Numeric fields.
    if (!Number.isFinite(row.defaultCrewSize) || row.defaultCrewSize < 0) {
      errors.push(`${where}: defaultCrewSize must be >= 0 (got ${row.defaultCrewSize}).`);
    }
    if (!Number.isFinite(row.defaultHoursPerDay) || row.defaultHoursPerDay <= 0) {
      errors.push(`${where}: defaultHoursPerDay must be > 0 (got ${row.defaultHoursPerDay}).`);
    }
    if (!Number.isFinite(row.defaultDurationDays) || row.defaultDurationDays < 0) {
      errors.push(`${where}: defaultDurationDays must be >= 0 (got ${row.defaultDurationDays}).`);
    }

    // Milestones are zero-duration markers.
    if (row.activityType === 'milestone' && row.defaultDurationDays !== 0) {
      errors.push(`${where}: milestone rows must have defaultDurationDays === 0.`);
    }
    // Lag / lead-time / milestone rows carry no crew demand.
    if (
      (row.activityType === 'curing_lag' ||
        row.activityType === 'procurement_lead_time') &&
      row.defaultCrewSize !== 0
    ) {
      errors.push(
        `${where}: ${row.activityType} rows must have defaultCrewSize === 0.`,
      );
    }

    // Unit must be a known construction unit code.
    if (row.defaultUnit && !findConstructionUnitByCode(row.defaultUnit)) {
      errors.push(`${where}: unknown defaultUnit "${row.defaultUnit}".`);
    }

    // scheduleEnabled is a required boolean (and the master always schedules).
    if (typeof row.scheduleEnabled !== 'boolean') {
      errors.push(`${where}: scheduleEnabled must be a boolean.`);
    } else if (row.scheduleEnabled !== true) {
      errors.push(`${where}: scheduleEnabled must be true in the master.`);
    }

    // Optional flag types.
    if (row.inspectionRequired !== undefined && typeof row.inspectionRequired !== 'boolean') {
      errors.push(`${where}: inspectionRequired must be a boolean when present.`);
    }
    if (row.weatherSensitive !== undefined && typeof row.weatherSensitive !== 'boolean') {
      errors.push(`${where}: weatherSensitive must be a boolean when present.`);
    }
    if (row.variant !== undefined && !VARIANTS.has(row.variant)) {
      errors.push(`${where}: invalid variant "${row.variant}".`);
    }

    // No duplicate title within the same division + work package.
    const titleKey = `${row.divisionCode}|${row.workPackageCode}|${row.title.trim().toLowerCase()}`;
    if (seenTitleKeys.has(titleKey)) {
      errors.push(
        `${where}: duplicate title within division ${row.divisionCode} work package ${row.workPackageCode}.`,
      );
    } else {
      seenTitleKeys.add(titleKey);
    }

    // Compound-phrase scan.
    const compoundPhrase = containsSuspiciousCompoundPhrase(row.title);
    if (compoundPhrase) {
      errors.push(
        `${where}: title contains unapproved compound phrase "${compoundPhrase}" (split into single-responsibility rows).`,
      );
    }
  });

  return { errors, ok: errors.length === 0 };
}
