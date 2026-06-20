import {
  instantiateAndSaveManualActivity,
  type SaveManualActivityInput,
} from '../../estimating/application/constructionActivityService';
import type { ActivityInstanceIdentityInput } from '../../estimating/application/constructionActivityCoding';
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
}

export interface CommitDesignEstimatePreviewResult {
  bundles: SavedActivityBundle[];
  committedQuantityItems: DesignQuantityItem[];
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

  const groups = groupPreviewLinesByDivision(uncommittedLines);
  const bundles: SavedActivityBundle[] = [];

  for (const group of groups) {
    const saveResult = await instantiateAndSaveManualActivity({
      divisionCode: group.divisionCode,
      divisionName: group.divisionName,
      lineItems: group.lines.map((line) => ({
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        manHoursPerUnit: 0,
      })),
      projectId: input.projectId,
      estimateId: input.estimateId ?? undefined,
      scheduleEnabled: true,
      identity: buildIdentity(group),
      existingActivities: input.existingActivities,
      projectLaborRates: input.projectLaborRates,
      sourceTemplateKey: `design_builder_${group.divisionCode}`,
    } satisfies SaveManualActivityInput);

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not commit Design Builder preview.' };
    }

    bundles.push(saveResult.data);
    for (let index = 0; index < group.lines.length; index += 1) {
      const line = group.lines[index];
      const estimateLine = saveResult.data.lineItems[index];
      const quantityItem = persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType);
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

interface PreviewLineGroup {
  divisionCode: string;
  divisionName: string;
  lines: DesignEstimatePreviewLine[];
}

function groupPreviewLinesByDivision(lines: readonly DesignEstimatePreviewLine[]): PreviewLineGroup[] {
  const grouped = new Map<string, PreviewLineGroup>();
  for (const line of lines) {
    const key = `${line.divisionCode}:${line.divisionName}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.lines.push(line);
    } else {
      grouped.set(key, {
        divisionCode: line.divisionCode,
        divisionName: line.divisionName,
        lines: [line],
      });
    }
  }
  return [...grouped.values()];
}

function buildIdentity(group: PreviewLineGroup): ActivityInstanceIdentityInput {
  return {
    activityName: `Design Builder ${group.divisionName}`,
    instanceLabel: 'Parametric',
    location: '5m x 6m CMU Building Example',
    notes: 'Generated from Arden Design Builder parameterized quantities. Verify before bidding.',
  };
}
