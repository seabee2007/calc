/**
 * AI scope division suggestions — divisions only, no activities or production rates.
 */
export interface ScopeDivisionSuggestion {
  id: string;
  divisionCode: string;
  divisionName: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  sourceExcerpt?: string | null;
  suggestedWorkAreas?: string[];
  estimatingNotes?: string[];
  status: 'suggested' | 'accepted' | 'rejected';
}

export type SuggestEstimateActivitiesFilterMode = 'allFromScope' | 'selectedDivisionsOnly';

export interface SuggestDivisionsFromScopeRequest {
  projectId: string;
  scopeText: string;
  /** Existing estimate divisions — context only unless filterMode is selectedDivisionsOnly. */
  acceptedDivisions?: string[];
  filterMode?: SuggestEstimateActivitiesFilterMode;
  projectName?: string;
  location?: string;
}

export interface SuggestDivisionsFromScopeResponse {
  divisions: ScopeDivisionSuggestion[];
  warnings?: string[];
  fallbackUsed?: boolean;
}

/** @deprecated Legacy activity suggestion types — no longer used by Import from Scope. */
export interface AiActivitySuggestionDraft {
  id: string;
  divisionCode: string;
  divisionName?: string;
  activityTitle: string;
  instanceLabel?: string | null;
  location?: string | null;
  drawingReference?: string | null;
  suggestedAssemblyTemplateId?: string | null;
  suggestedQuantity?: number | null;
  quantityUnit?: string | null;
  missingQuantityQuestion?: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  sourceExcerpt?: string | null;
  isAssumption?: boolean;
  needsQuantity: boolean;
  needsLabor: boolean;
  needsMaterial: boolean;
  needsEquipment: boolean;
  status: 'suggested' | 'accepted' | 'rejected' | 'edited';
}

/** @deprecated */
export interface SuggestEstimateActivitiesRequest extends SuggestDivisionsFromScopeRequest {}

/** @deprecated */
export interface SuggestEstimateActivitiesResponse {
  suggestions: AiActivitySuggestionDraft[];
  warnings?: string[];
  fallbackUsed?: boolean;
}
