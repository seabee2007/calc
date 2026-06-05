import {
  DEFAULT_ESTIMATE_METHOD,
  getEstimateMethod,
  isEstimateType,
  listEstimateMethods,
  type EstimateMethodDefinition,
} from '../domain/estimateMethods';
import type { EstimateType } from '../domain/estimateTypes';
import { formatEstimateBlank } from './estimateFormatters';

export function formatEstimateMethodLabel(type: EstimateType | string | null | undefined): string {
  return getEstimateMethod(type).label;
}

export function formatEstimateMethodShortDescription(
  type: EstimateType | string | null | undefined,
): string {
  return getEstimateMethod(type).shortDescription;
}

export function getEstimateMethodWorkflowNote(
  type: EstimateType | string | null | undefined,
): string {
  return getEstimateMethod(type).workflowNote;
}

export function isSchedulePreviewRecommended(
  type: EstimateType | string | null | undefined,
): boolean {
  return getEstimateMethod(type).schedulePreviewRecommended;
}

export function isProposalGenerationRecommended(
  type: EstimateType | string | null | undefined,
): boolean {
  return getEstimateMethod(type).proposalGenerationRecommended;
}

export function shouldShowRoughSchedulePreviewNote(
  type: EstimateType | string | null | undefined,
): boolean {
  const method = getEstimateMethod(type);
  return !method.schedulePreviewRecommended;
}

export const ROUGH_SCHEDULE_PREVIEW_NOTE =
  'Schedule preview may be rough because this estimate type may not include task-level labor detail.';

export function getEstimateMethodDisplay(
  type: EstimateType | string | null | undefined,
): EstimateMethodDefinition {
  return getEstimateMethod(type);
}

export function listEstimateMethodOptions(): Array<{
  value: EstimateType;
  label: string;
  description: string;
  workflowNote: string;
}> {
  return listEstimateMethods().map((method) => ({
    value: method.id,
    label: method.label,
    description: method.shortDescription,
    workflowNote: method.workflowNote,
  }));
}

export function safeEstimateMethodLabel(type: unknown): string {
  if (isEstimateType(type)) {
    return formatEstimateMethodLabel(type);
  }
  return formatEstimateMethodLabel(DEFAULT_ESTIMATE_METHOD);
}

export function safeEstimateMethodNote(type: unknown): string {
  if (isEstimateType(type)) {
    return getEstimateMethodWorkflowNote(type);
  }
  return getEstimateMethodWorkflowNote(DEFAULT_ESTIMATE_METHOD);
}

export function formatEstimateMethodSummary(
  type: EstimateType | string | null | undefined,
): string {
  const method = getEstimateMethod(type);
  const label = formatEstimateBlank(method.label);
  return `${label} — ${method.workflowNote}`;
}
