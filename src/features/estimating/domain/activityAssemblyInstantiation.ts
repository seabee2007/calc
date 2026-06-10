/**
 * Converts an ActivityAssemblySpec + user inputs into a fully instantiated
 * ProjectConstructionActivity, ProjectActivityLineItem[], and ActivityRollupResult.
 *
 * Flow:
 *   ActivityAssemblySpec + AssemblyUserInputs
 *     → quantityMap (keyed by lineItemTemplateId)
 *     → instantiateConstructionActivity(...)
 *     → InstantiateConstructionActivityResult
 */
import type { ActivityLineItemTemplate, EstimateDivision, ProductionRate } from './constructionActivityTypes';
import type { ActivityAssemblySpec, AssemblyUserInputs } from './activityAssemblyTypes';
import {
  instantiateConstructionActivity,
  type InstantiateConstructionActivityResult,
} from './constructionActivityInstantiation';

export interface InstantiateFromAssemblyInput {
  assembly: ActivityAssemblySpec;
  userInputs: AssemblyUserInputs;
  division: EstimateDivision;
  lineItemTemplates: readonly ActivityLineItemTemplate[];
  productionRates: readonly ProductionRate[] | Map<string, ProductionRate>;
  projectId: string;
  estimateId?: string;
  crewSize?: number;
  hoursPerDay?: number;
  productionFactor?: number;
  durationDaysOverride?: number | null;
  activityTitleOverride?: string;
  projectActivityId?: string;
}

export interface AssemblyInstantiationResult extends InstantiateConstructionActivityResult {
  /** Resolved quantity map used for instantiation. */
  resolvedQuantities: Record<string, number>;
  /** Warnings from quantity resolution (missing inputs, unknown IDs). */
  quantityWarnings: string[];
}

/**
 * Build the line item quantity map from user inputs and the assembly's
 * lineItemQuantityMap, then call instantiateConstructionActivity.
 */
export function instantiateFromAssemblySpec(
  input: InstantiateFromAssemblyInput,
): AssemblyInstantiationResult {
  const { assembly, userInputs } = input;
  const quantityWarnings: string[] = [];
  const resolvedQuantities: Record<string, number> = {};

  for (const mapping of assembly.lineItemQuantityMap) {
    const rawValue = userInputs[mapping.quantityInputId];

    if (rawValue == null || !Number.isFinite(rawValue)) {
      quantityWarnings.push(
        `Assembly input "${mapping.quantityInputId}" not provided — defaulting to 0 for line item "${mapping.lineItemTemplateId}"`,
      );
      resolvedQuantities[mapping.lineItemTemplateId] = 0;
    } else {
      const multiplier =
        mapping.quantityMultiplier != null && Number.isFinite(mapping.quantityMultiplier)
          ? mapping.quantityMultiplier
          : 1;
      resolvedQuantities[mapping.lineItemTemplateId] = rawValue * multiplier;
    }
  }

  const baseResult = instantiateConstructionActivity({
    projectId: input.projectId,
    estimateId: input.estimateId,
    division: input.division,
    template: {
      ...assembly,
      id: assembly.activityTemplateId,
      code: assembly.activityTemplateId,
      name: assembly.displayName,
      scheduleEnabled: true,
      divisionId: input.division.id,
    },
    lineItemTemplates: input.lineItemTemplates,
    productionRates: input.productionRates,
    quantityMap: resolvedQuantities,
    crewSize: input.crewSize ?? assembly.defaultCrewSize,
    hoursPerDay: input.hoursPerDay ?? assembly.defaultHoursPerDay,
    productionFactor: input.productionFactor ?? assembly.defaultProductionFactor ?? 1,
    durationDaysOverride: input.durationDaysOverride,
    activityTitleOverride: input.activityTitleOverride,
    projectActivityId: input.projectActivityId,
  });

  return {
    ...baseResult,
    resolvedQuantities,
    quantityWarnings,
    rollup: {
      ...baseResult.rollup,
      warnings: [...quantityWarnings, ...baseResult.rollup.warnings],
    },
  };
}

/**
 * Convenience: returns only the summary numbers for display.
 */
export interface AssemblyRollupSummary {
  totalManHours: number;
  totalManDays: number;
  calculatedDurationDays: number;
  effectiveDurationDays: number;
  lineItemCount: number;
  warnings: string[];
}

export function summariseAssemblyRollup(result: AssemblyInstantiationResult): AssemblyRollupSummary {
  return {
    totalManHours: result.rollup.totalManHours,
    totalManDays: result.rollup.totalManDays,
    calculatedDurationDays: result.rollup.calculatedDurationDays,
    effectiveDurationDays: result.rollup.effectiveDurationDays,
    lineItemCount: result.rollup.lineItemCount,
    warnings: result.rollup.warnings,
  };
}
