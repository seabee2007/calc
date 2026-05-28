import type { CallSheetFields } from '../types/callSheet';
import { DEFAULT_CALL_SHEET_FIELDS } from '../types/callSheet';
import type { PourPlannerFormState } from '../types/pourPlanner';

const CALL_SHEET_KEYS = Object.keys(DEFAULT_CALL_SHEET_FIELDS) as (keyof CallSheetFields)[];

export function callSheetFieldsFromForm(
  form: PourPlannerFormState,
): CallSheetFields {
  const out = { ...DEFAULT_CALL_SHEET_FIELDS };
  for (const key of CALL_SHEET_KEYS) {
    (out as Record<string, unknown>)[key] = form[key];
  }
  // Legacy call-sheet field — keep in sync with planner project name
  out.projectNumber = form.projectName.trim();
  return out;
}

export function applyCallSheetToForm(
  partial: Partial<CallSheetFields> | undefined,
): Partial<PourPlannerFormState> {
  if (!partial) return {};
  const patch: Partial<PourPlannerFormState> = {};
  for (const key of CALL_SHEET_KEYS) {
    if (partial[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = partial[key];
    }
  }
  return patch;
}
