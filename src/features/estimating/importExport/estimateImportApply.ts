import { reindexDraftLines, type EstimateDraftLine } from '../application/estimateDraftLine';
import { normalizeSelectedDivisions } from '../application/estimateWorkBreakdown';
import type { EstimateSelectedDivision } from '../domain/estimateTypes';
import type { ImportedEstimateData } from './estimateImportParser';

export type EstimateImportApplyMode = 'replace' | 'add';

export interface ApplyImportedEstimateParams {
  mode: EstimateImportApplyMode;
  currentDraftLines: EstimateDraftLine[];
  currentSelectedDivisions: EstimateSelectedDivision[];
  imported: ImportedEstimateData;
}

export interface AppliedImportedEstimate {
  draftLines: EstimateDraftLine[];
  selectedDivisions: EstimateSelectedDivision[];
  importedDivisionCodes: string[];
}

export function applyImportedEstimate({
  mode,
  currentDraftLines,
  currentSelectedDivisions,
  imported,
}: ApplyImportedEstimateParams): AppliedImportedEstimate {
  const importedDivisionCodes = imported.selectedDivisions.map((division) => division.code);

  if (mode === 'replace') {
    return {
      draftLines: reindexDraftLines(imported.draftLines),
      selectedDivisions: normalizeSelectedDivisions(imported.selectedDivisions),
      importedDivisionCodes,
    };
  }

  const mergedDivisions = normalizeSelectedDivisions([
    ...currentSelectedDivisions,
    ...imported.selectedDivisions,
  ]);

  const appendedDraftLines = reindexDraftLines([
    ...currentDraftLines,
    ...imported.draftLines.map((line, offset) => ({
      ...line,
      task: {
        ...line.task,
        position: currentDraftLines.length + offset,
      },
    })),
  ]);

  return {
    draftLines: appendedDraftLines,
    selectedDivisions: mergedDivisions,
    importedDivisionCodes,
  };
}
