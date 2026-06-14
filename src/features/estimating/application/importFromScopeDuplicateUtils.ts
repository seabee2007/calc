import { normalizeCsiDivisionCode } from '../domain/csiDivisions';

export type ImportDuplicateStatus =
  | 'none'
  | 'alreadyInEstimate'
  | 'duplicateSuggestion'
  | 'needsInstanceLabel';

export interface ImportScopeExistingActivityRef {
  divisionCode: string;
  title: string;
  instanceLabel?: string | null;
}

export interface ImportScopeSuggestionRef {
  divisionCode: string;
  activityTitle: string;
  instanceLabel?: string | null;
}

export function normalizeImportActivityTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildImportActivityKey(
  divisionCode: string,
  activityTitle: string,
  instanceLabel?: string | null,
): string {
  const division = normalizeCsiDivisionCode(divisionCode) ?? divisionCode.trim();
  const title = normalizeImportActivityTitle(activityTitle);
  const label = instanceLabel?.trim().toLowerCase() ?? '';
  return `${division}::${title}::${label}`;
}

/** Unique source template key per scope-import activity (avoids shared manual_activity collisions). */
export function buildScopeImportSourceTemplateKey(
  divisionCode: string,
  activityTitle: string,
): string {
  const division = normalizeCsiDivisionCode(divisionCode) ?? divisionCode.trim();
  const slug = normalizeImportActivityTitle(activityTitle)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `scope_import:${division}:${slug || 'activity'}`;
}

export interface PreparedImportSuggestion<T extends ImportScopeSuggestionRef> {
  item: T;
  duplicateStatus: ImportDuplicateStatus;
}

export function resolveImportDuplicateStatus(
  suggestion: ImportScopeSuggestionRef,
  existingActivities: readonly ImportScopeExistingActivityRef[],
): ImportDuplicateStatus {
  const labeledKey = buildImportActivityKey(
    suggestion.divisionCode,
    suggestion.activityTitle,
    suggestion.instanceLabel,
  );
  const baseKey = buildImportActivityKey(suggestion.divisionCode, suggestion.activityTitle);

  const existingKeys = new Set(
    existingActivities.flatMap((activity) => [
      buildImportActivityKey(activity.divisionCode, activity.title),
      buildImportActivityKey(activity.divisionCode, activity.title, activity.instanceLabel),
    ]),
  );

  if (existingKeys.has(labeledKey)) {
    return suggestion.instanceLabel?.trim() ? 'needsInstanceLabel' : 'alreadyInEstimate';
  }

  if (!suggestion.instanceLabel?.trim() && existingKeys.has(baseKey)) {
    return 'alreadyInEstimate';
  }

  return 'none';
}

export function dedupeImportSuggestions<T extends ImportScopeSuggestionRef>(
  suggestions: readonly T[],
  existingActivities: readonly ImportScopeExistingActivityRef[],
): PreparedImportSuggestion<T>[] {
  const seenBaseKeys = new Set<string>();
  const prepared: PreparedImportSuggestion<T>[] = [];

  for (const item of suggestions) {
    const baseKey = buildImportActivityKey(item.divisionCode, item.activityTitle);
    if (seenBaseKeys.has(baseKey)) {
      continue;
    }
    seenBaseKeys.add(baseKey);

    prepared.push({
      item,
      duplicateStatus: resolveImportDuplicateStatus(item, existingActivities),
    });
  }

  return prepared;
}

export function duplicateStatusLabel(status: ImportDuplicateStatus): string | null {
  switch (status) {
    case 'alreadyInEstimate':
      return 'Already in estimate';
    case 'duplicateSuggestion':
      return 'Duplicate suggestion';
    case 'needsInstanceLabel':
      return 'Needs instance label';
    default:
      return null;
  }
}
