import type { DesignEstimatePreviewLine } from '../types';
import {
  OBJECT_TREE_ITEMS,
  objectTypeForPreviewLine,
} from './DesignBuilderPageMappings';

function formatTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', 'Z');
}

function formatParameterSnapshot(snapshot: Record<string, unknown>): string {
  return JSON.stringify(snapshot, null, 2)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

export function estimatePreviewTextFilename(date = new Date()): string {
  return `design-builder-estimate-preview-${formatTimestamp(date)}.txt`;
}

export function buildEstimatePreviewText(params: {
  lines: readonly DesignEstimatePreviewLine[];
  generatedAt?: Date;
}): string {
  const generatedAt = params.generatedAt ?? new Date();
  const rows = params.lines.map((line, index) => {
    const objectType = objectTypeForPreviewLine(line);
    const sourceObject =
      OBJECT_TREE_ITEMS.find((item) => item.objectType === objectType)?.label ??
      objectType;

    return [
      `${index + 1}. ${line.description}`,
      `   Quantity: ${line.quantity} ${line.unit}`,
      `   Division: ${line.divisionCode} ${line.divisionName}`,
      `   Source object: ${sourceObject}`,
      `   Quantity type: ${line.quantityType}`,
      `   Formula: ${line.formula}`,
      `   Source: ${line.source}`,
      `   Confidence: ${line.confidence}`,
      `   Design model ID: ${line.designModelId}`,
      `   Design object ID: ${line.designObjectId}`,
      `   Parameter snapshot:`,
      formatParameterSnapshot(line.parameterSnapshot),
    ].join('\n');
  });

  return [
    'Design Builder Estimate Preview',
    `Generated: ${generatedAt.toISOString()}`,
    `Rows: ${params.lines.length}`,
    '',
    ...rows.flatMap((row) => [row, '']),
  ].join('\n');
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
