import type { CpmLogicLink } from '../cpmTypes';

/**
 * Resource-dummy link construction — the SINGLE place that turns resource-leveling
 * provider records into explicit FS logic links. Both the leveling algorithm
 * (for its persisted result) and the effective-schedule analysis (for the live
 * leveled CPM) call this so the two can never diverge.
 *
 * A resource-dummy link is `provider -> delayed` FS+0. Running CPM on
 * `baseline logicLinks + resourceDummyLinks` reproduces the leveled schedule,
 * because the provider's leveled finish is exactly when the delayed activity's
 * crew frees up. Provenance is pure metadata — links are NEVER derived from
 * titles, trade, division, CSI code, card position, or date adjacency.
 */

export interface ResourceDummyDelayRecord {
  /** The activity that resource leveling delayed. */
  activityCode: string;
  /** Activities that freed the constrained crew so the delayed activity could start. */
  resourceProviderActivityCodes: string[];
}

export interface BuildResourceDummyLinksParams {
  delayRecords: ResourceDummyDelayRecord[];
  /** Leveled (early) start day-index per activity code. */
  leveledStartByCode: Map<string, number>;
  /** Leveled (early) finish day-index per activity code (exclusive). */
  leveledFinishByCode: Map<string, number>;
  /** True when a baseline link already connects predecessor -> successor (any type). */
  hasBaselineEdge: (predecessorActivityCode: string, successorActivityCode: string) => boolean;
  /** True when the code maps to a real activity in the current schedule. */
  isValidCode: (activityCode: string) => boolean;
}

/**
 * Builds the provider-derived FS+0 resource-dummy links. A link is emitted only
 * when:
 *  - the target was actually delayed (present in a delay record),
 *  - both provider and target are valid, distinct activity codes,
 *  - the provider's leveled finish is no later than the target's leveled start
 *    (it genuinely frees the crew before the target needs it),
 *  - it does not duplicate an existing baseline link.
 *
 * Cycle filtering is left to the caller (it requires a CPM pass); by construction
 * provider.finish <= target.start so a forward FS edge cannot create a cycle in a
 * consistent schedule.
 */
export function buildResourceDummyLinks(params: BuildResourceDummyLinksParams): CpmLogicLink[] {
  const { delayRecords, leveledStartByCode, leveledFinishByCode, hasBaselineEdge, isValidCode } =
    params;
  const out: CpmLogicLink[] = [];
  const seen = new Set<string>();

  for (const record of delayRecords) {
    const target = record.activityCode;
    if (!isValidCode(target)) continue;
    const targetStart = leveledStartByCode.get(target);
    if (targetStart === undefined) continue;

    for (const provider of record.resourceProviderActivityCodes ?? []) {
      if (provider === target || !isValidCode(provider)) continue;
      const providerFinish = leveledFinishByCode.get(provider);
      if (providerFinish === undefined) continue;
      // Provider must free the crew no later than the target's leveled start.
      if (providerFinish > targetStart) continue;
      // Never duplicate an existing saved/baseline relationship.
      if (hasBaselineEdge(provider, target)) continue;

      const key = `${provider}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        predecessorActivityCode: provider,
        successorActivityCode: target,
        relationshipType: 'FS',
        lagDays: 0,
        generated: true,
        source: 'resource_leveling',
        reason: 'crew_limit',
        resourceProviderActivityCode: provider,
        delayedActivityCode: target,
      });
    }
  }

  return out;
}
