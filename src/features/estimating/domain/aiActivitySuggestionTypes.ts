/**
 * AI Activity Suggestions — future-ready draft types.
 *
 * AI reads project SOW/scope and proposes draft construction activities for user review.
 * Must NOT auto-save activities or auto-wire Logic Network.
 */
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
}

export interface AiActivitySuggestionBatch {
  generatedAt: string;
  projectId: string;
  estimateId?: string;
  sowDocumentRef?: string | null;
  suggestions: AiActivitySuggestionDraft[];
}

/** User-reviewed selection before import into Activities tab. */
export interface AiActivitySuggestionImportSelection {
  suggestionIds: string[];
  reviewedAt: string;
  reviewedBy?: string | null;
}
