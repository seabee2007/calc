import {
  instantiateAndSaveFromProductionRateAssembly,
  instantiateAndSaveManualActivity,
  type SaveManualActivityInput,
} from '../../estimating/application/constructionActivityService';
import type { ActivityInstanceIdentityInput } from '../../estimating/application/constructionActivityCoding';
import type { ProductionRateAssemblyGroup } from '../../estimating/application/productionRateAssemblyBuilder';
import {
  areProductionRateUnitsCompatible,
  convertQuantityForProductionRateUnit,
} from '../../estimating/application/matchQuantityToProductionRates';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import type { ProjectConstructionActivity } from '../../estimating/domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../../estimating/domain/laborRateTypes';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import {
  updateProjectLineItemFromDesignPreview,
  type SavedActivityBundle,
} from '../../estimating/infrastructure/activityRepository';
import {
  markDesignQuantityItemsCommitted,
  replaceDesignQuantityItems,
} from '../services/designBuilderService';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { DesignBuilderScheduleGroupRule } from './designBuilderImportRules';

export interface PersistDesignEstimatePreviewInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  lines: readonly DesignEstimatePreviewLine[];
}

export async function persistDesignEstimatePreview(
  input: PersistDesignEstimatePreviewInput,
): Promise<RepositoryResult<DesignQuantityItem[]>> {
  return replaceDesignQuantityItems(
    input.designModelId,
    input.lines.map((line) => ({
      designModelId: line.designModelId,
      designObjectId: line.designObjectId,
      projectId: input.projectId,
      estimateId: input.estimateId ?? null,
      quantityType: line.quantityType,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      formula: line.formula,
      parameterSnapshot: line.parameterSnapshot,
      metadata: {
        previewLineId: line.id,
        source: line.source,
        confidence: line.confidence,
      },
    })),
  );
}

export interface CommitDesignEstimatePreviewInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  previewLines: readonly DesignEstimatePreviewLine[];
  persistedQuantityItems: readonly DesignQuantityItem[];
  existingActivities: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
  productionRates: readonly ProductionRateLibraryEntry[];
  assignments: readonly DesignBuilderImportCommitAssignment[];
}

export interface CommitDesignEstimatePreviewResult {
  bundles: SavedActivityBundle[];
  committedQuantityItems: DesignQuantityItem[];
}

export type DesignBuilderImportResolvedStatus =
  | 'auto_matched'
  | 'verified_rate'
  | 'manual_override'
  | 'excluded';

export interface DesignBuilderImportCommitAssignment {
  previewLineId: string;
  status: DesignBuilderImportResolvedStatus;
  productionRateId?: string | null;
  scheduleGroup: DesignBuilderScheduleGroupRule;
  matchConfidence?: number | null;
  matchReason?: string | null;
  manualOverride?: {
    manHoursPerUnit: number;
    reason: string;
    sourceNote: string;
  } | null;
}

export async function commitDesignEstimatePreview(
  input: CommitDesignEstimatePreviewInput,
): Promise<RepositoryResult<CommitDesignEstimatePreviewResult>> {
  if (input.previewLines.length === 0) {
    return { data: null, error: 'Generate an estimate preview before committing.' };
  }

  const persistedByPreviewId = new Map(
    input.persistedQuantityItems.map((item) => [String(item.metadata.previewLineId ?? item.quantityType), item]),
  );
  const uncommittedLines: DesignEstimatePreviewLine[] = [];
  const committedQuantityItems: DesignQuantityItem[] = [];

  for (const line of input.previewLines) {
    const quantityItem = persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType);
    if (quantityItem?.estimateLineId) {
      const updateResult = await updateProjectLineItemFromDesignPreview(quantityItem.estimateLineId, {
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
      });
      if (updateResult.error || !updateResult.data) {
        return {
          data: null,
          error: updateResult.error ?? 'Could not update linked Design Builder estimate line.',
        };
      }
      committedQuantityItems.push(quantityItem);
    } else {
      uncommittedLines.push(line);
    }
  }

  if (uncommittedLines.length === 0) {
    return { data: { bundles: [], committedQuantityItems }, error: null };
  }

  const assignmentByPreviewId = new Map(
    input.assignments.map((assignment) => [assignment.previewLineId, assignment]),
  );
  const includedEntries: Array<{
    line: DesignEstimatePreviewLine;
    quantityItem: DesignQuantityItem | undefined;
    assignment: DesignBuilderImportCommitAssignment;
  }> = [];

  for (const line of uncommittedLines) {
    const assignment = assignmentByPreviewId.get(line.id);
    if (!assignment) {
      return {
        data: null,
        error: `Resolve or exclude "${line.description}" before creating estimate activities.`,
      };
    }
    if (assignment.status === 'excluded') continue;

    if (assignment.status === 'manual_override') {
      const manual = assignment.manualOverride;
      if (
        !manual ||
        manual.manHoursPerUnit <= 0 ||
        !manual.reason.trim() ||
        !manual.sourceNote.trim()
      ) {
        return {
          data: null,
          error: `Manual override for "${line.description}" requires MH/unit, reason, and source note.`,
        };
      }
    } else if (!assignment.productionRateId) {
      return {
        data: null,
        error: `Assign an approved production rate to "${line.description}" before creating activities.`,
      };
    }

    includedEntries.push({
      line,
      quantityItem: persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType),
      assignment,
    });
  }

  if (includedEntries.length === 0) {
    return { data: { bundles: [], committedQuantityItems }, error: null };
  }

  const productionRateById = new Map(input.productionRates.map((rate) => [rate.id, rate]));
  const bundles: SavedActivityBundle[] = [];
  const productionEntries = includedEntries.filter(
    (entry) => entry.assignment.status === 'auto_matched' || entry.assignment.status === 'verified_rate',
  );
  const manualEntries = includedEntries.filter(
    (entry) => entry.assignment.status === 'manual_override',
  );

  for (const group of groupAssignedEntries(productionEntries)) {
    const rates = group.entries.map((entry) => productionRateById.get(entry.assignment.productionRateId ?? ''));
    if (rates.some((rate) => !rate)) {
      const missing = group.entries.find((entry) => !productionRateById.get(entry.assignment.productionRateId ?? ''));
      return {
        data: null,
        error: `Selected production rate for "${missing?.line.description ?? 'Design Builder quantity'}" was not found.`,
      };
    }

    const resolvedRates = rates as ProductionRateLibraryEntry[];
    for (let index = 0; index < group.entries.length; index += 1) {
      const entry = group.entries[index];
      const rate = resolvedRates[index];
      if (rate.divisionCode !== entry.line.divisionCode) {
        return {
          data: null,
          error: `Selected production rate for "${entry.line.description}" is not in Division ${entry.line.divisionCode}.`,
        };
      }
      if ((rate.manHoursPerUnit ?? 0) <= 0) {
        return {
          data: null,
          error: `Selected production rate for "${entry.line.description}" has no positive MH/unit.`,
        };
      }
      if (!areProductionRateUnitsCompatible(entry.line.unit, rate.unitOfMeasure)) {
        return {
          data: null,
          error: `Selected production rate unit ${rate.unitOfMeasure} is not compatible with ${entry.line.unit} for "${entry.line.description}".`,
        };
      }
    }
    const assemblyGroup = buildProductionRateGroup(group.scheduleGroup, resolvedRates);
    const saveResult = await instantiateAndSaveFromProductionRateAssembly({
      projectId: input.projectId,
      estimateId: input.estimateId ?? undefined,
      group: assemblyGroup,
      selectedLineItems: group.entries.map((entry) => {
        const rate = productionRateById.get(entry.assignment.productionRateId ?? '')!;
        return {
          rateId: rate.id,
          quantity: convertQuantityForProductionRateUnit(
            entry.line.quantity,
            entry.line.unit,
            rate.unitOfMeasure,
          ),
          assignmentStatus: entry.assignment.status,
          matchConfidence: entry.assignment.matchConfidence ?? null,
          matchReason: entry.assignment.matchReason ?? null,
        };
      }),
      scheduleEnabled: true,
      identity: buildIdentityFromScheduleGroup(group.scheduleGroup),
      existingActivities: input.existingActivities,
      projectLaborRates: input.projectLaborRates,
      sourceTemplateKey: `design_builder:${group.scheduleGroup.key}`,
    });

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not commit Design Builder preview.' };
    }

    bundles.push(saveResult.data);
    for (let index = 0; index < group.entries.length; index += 1) {
      const { quantityItem } = group.entries[index];
      const estimateLine = saveResult.data.lineItems[index];
      if (!estimateLine || !quantityItem) continue;

      const markResult = await markDesignQuantityItemsCommitted({
        quantityItemIds: [quantityItem.id],
        estimateLineId: estimateLine.id,
      });
      if (markResult.error || !markResult.data) {
        return { data: null, error: markResult.error ?? 'Could not link Design Builder quantity to estimate line.' };
      }
      committedQuantityItems.push(...markResult.data);
    }
  }

  for (const group of groupAssignedEntries(manualEntries)) {
    const saveResult = await instantiateAndSaveManualActivity({
      divisionCode: group.scheduleGroup.divisionCode,
      divisionName: group.scheduleGroup.divisionName,
      lineItems: group.entries.map(({ line, assignment }) => ({
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        manHoursPerUnit: assignment.manualOverride?.manHoursPerUnit ?? 0,
        manualProductionRateReason: assignment.manualOverride?.reason ?? null,
        manualProductionRateSourceNote: assignment.manualOverride?.sourceNote ?? null,
        productionRateMatchReason: assignment.matchReason ?? 'Manual Design Builder production-rate override.',
      })),
      projectId: input.projectId,
      estimateId: input.estimateId ?? undefined,
      scheduleEnabled: true,
      identity: buildIdentityFromScheduleGroup({
        ...group.scheduleGroup,
        title: `${group.scheduleGroup.title} - Manual Overrides`,
      }),
      existingActivities: input.existingActivities,
      projectLaborRates: input.projectLaborRates,
      sourceTemplateKey: `design_builder:${group.scheduleGroup.key}:manual`,
    } satisfies SaveManualActivityInput);

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not commit Design Builder manual override.' };
    }

    bundles.push(saveResult.data);
    for (let index = 0; index < group.entries.length; index += 1) {
      const { quantityItem } = group.entries[index];
      const estimateLine = saveResult.data.lineItems[index];
      if (!estimateLine || !quantityItem) continue;
      const markResult = await markDesignQuantityItemsCommitted({
        quantityItemIds: [quantityItem.id],
        estimateLineId: estimateLine.id,
      });
      if (markResult.error || !markResult.data) {
        return { data: null, error: markResult.error ?? 'Could not link Design Builder quantity to estimate line.' };
      }
      committedQuantityItems.push(...markResult.data);
    }
  }

  return { data: { bundles, committedQuantityItems }, error: null };
}

type AssignedEntry = {
  line: DesignEstimatePreviewLine;
  quantityItem: DesignQuantityItem | undefined;
  assignment: DesignBuilderImportCommitAssignment;
};

function groupAssignedEntries(entries: readonly AssignedEntry[]): Array<{
  scheduleGroup: DesignBuilderScheduleGroupRule;
  entries: AssignedEntry[];
}> {
  const grouped = new Map<string, { scheduleGroup: DesignBuilderScheduleGroupRule; entries: AssignedEntry[] }>();
  for (const entry of entries) {
    const key = entry.assignment.scheduleGroup.key;
    const existing = grouped.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      grouped.set(key, {
        scheduleGroup: entry.assignment.scheduleGroup,
        entries: [entry],
      });
    }
  }
  return [...grouped.values()];
}

function buildProductionRateGroup(
  scheduleGroup: DesignBuilderScheduleGroupRule,
  rates: ProductionRateLibraryEntry[],
): ProductionRateAssemblyGroup {
  const crewSizes = rates
    .map((rate) => rate.crewSize)
    .filter((value): value is number => value != null && value > 0);
  return {
    divisionCode: scheduleGroup.divisionCode,
    divisionName: scheduleGroup.divisionName,
    category: scheduleGroup.category,
    rates,
    defaultTitle: scheduleGroup.title,
    suggestedCrewSize: crewSizes.length > 0 ? Math.max(...crewSizes) : 4,
    suggestedHoursPerDay: 8,
  };
}

function buildIdentityFromScheduleGroup(group: DesignBuilderScheduleGroupRule): ActivityInstanceIdentityInput {
  return {
    activityName: group.title,
    instanceLabel: 'Parametric',
    location: '5m x 6m CMU Template',
    notes: 'Generated from Arden Design Builder parametric quantities. Verify quantities and structural requirements before pricing.',
  };
}
