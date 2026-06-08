/**
 * Lookup + search helpers over the Residential Baseline Activity Master.
 *
 * The master dataset is the source of truth for activity identity (fixed code +
 * fixed title). These helpers let the UI select an activity instead of
 * free-typing it, and let import/legacy enrichment match by code.
 */

import { normalizeCsiDivisionCode } from '../domain/csiDivisions';
import {
  residentialActivityMaster,
  type EstimateActivityTemplate,
} from './residentialActivityMaster';

const BY_CODE: Map<string, EstimateActivityTemplate> = new Map(
  residentialActivityMaster.map((row) => [row.activityCode, row]),
);

function pad2Division(value: string | undefined | null): string {
  const normalized = normalizeCsiDivisionCode(value ?? '');
  const numeric = Number(String(normalized).replace(/\D/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return '00';
  return String(Math.trunc(numeric)).padStart(2, '0').slice(-2);
}

/** Returns the master activity for an exact DD-PP-SS code, if present. */
export function getMasterActivityByCode(
  code: string | undefined | null,
): EstimateActivityTemplate | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.trim());
}

/** True when the code corresponds to a real master activity. */
export function isMasterActivityCode(code: string | undefined | null): boolean {
  return getMasterActivityByCode(code) !== undefined;
}

/** CSI classification linked from the master activity, when annotated. */
export function getMasterActivityCsiContext(code: string | undefined | null): {
  csiDivisionCode?: string;
  csiSectionCode?: string;
} {
  const master = getMasterActivityByCode(code);
  if (!master) return {};
  return {
    csiDivisionCode: master.csiDivisionCode,
    csiSectionCode: master.csiSectionCode,
  };
}

/** All master activities within a CSI division, sorted by code. */
export function getMasterActivitiesByDivision(
  divisionCode: string | undefined | null,
): EstimateActivityTemplate[] {
  const target = pad2Division(divisionCode);
  return residentialActivityMaster
    .filter((row) => pad2Division(row.divisionCode) === target)
    .sort((a, b) => a.activityCode.localeCompare(b.activityCode, undefined, { numeric: true }));
}

const SEARCH_FIELDS: Array<(row: EstimateActivityTemplate) => string> = [
  (row) => row.activityCode,
  (row) => row.title,
  (row) => row.divisionName,
  (row) => row.workPackageName,
  (row) => row.sequencingCategory,
  (row) => row.logicAnchor,
  (row) => row.primaryTrade,
];

function rowMatchesQuery(row: EstimateActivityTemplate, query: string): boolean {
  return SEARCH_FIELDS.some((accessor) => accessor(row).toLowerCase().includes(query));
}

export interface SearchMasterActivitiesOptions {
  /** Restrict results to a single CSI division. */
  divisionCode?: string | null;
  /** Cap the number of returned rows (default 50). */
  limit?: number;
}

/**
 * Searches the master across activityCode, title, divisionName, workPackageName,
 * sequencingCategory, logicAnchor, and primaryTrade. An empty query returns the
 * (optionally division-filtered) list in code order.
 */
export function searchMasterActivities(
  query: string,
  options: SearchMasterActivitiesOptions = {},
): EstimateActivityTemplate[] {
  const normalizedQuery = query.trim().toLowerCase();
  const base =
    options.divisionCode != null && options.divisionCode !== ''
      ? getMasterActivitiesByDivision(options.divisionCode)
      : [...residentialActivityMaster].sort((a, b) =>
          a.activityCode.localeCompare(b.activityCode, undefined, { numeric: true }),
        );

  const matched = normalizedQuery
    ? base.filter((row) => rowMatchesQuery(row, normalizedQuery))
    : base;

  const limit = options.limit ?? 50;
  return matched.slice(0, limit);
}

/** Display label for a master activity option, e.g. "03-01-03 — Footing concrete placement". */
export function formatMasterActivityOption(row: EstimateActivityTemplate): string {
  return `${row.activityCode} — ${row.title}`;
}
