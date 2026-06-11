export const CONCEPTUAL_LINE_ITEM_TYPES = [
  'square_foot',
  'division_budget',
  'system_budget',
  'unit_cost',
  'lump_sum',
  'allowance',
] as const;

export type ConceptualLineItemType = (typeof CONCEPTUAL_LINE_ITEM_TYPES)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const SOURCE_BASIS_VALUES = [
  'historical',
  'allowance',
  'vendor_quote',
  'estimator_judgment',
  'owner_budget',
  'other',
] as const;
export type SourceBasis = (typeof SOURCE_BASIS_VALUES)[number];

export const SYSTEM_CATEGORIES = [
  'sitework',
  'structure',
  'envelope',
  'interiors',
  'mep',
  'general_conditions',
  'other',
] as const;
export type SystemCategory = (typeof SYSTEM_CATEGORIES)[number];

export const DESIGN_STAGES = [
  'predevelopment',
  'schematic_design',
  'design_development',
  'construction_documents',
  'bid_permit',
] as const;
export type DesignStage = (typeof DESIGN_STAGES)[number];

export const ASSUMPTION_IMPACTS = ['cost', 'schedule', 'scope', 'risk'] as const;
export type AssumptionImpact = (typeof ASSUMPTION_IMPACTS)[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface ConceptualEstimateLineItem {
  id: string;
  estimateId?: string;
  type: ConceptualLineItemType;
  divisionCode?: string | null;
  divisionName?: string | null;
  systemCategory?: SystemCategory | null;
  title: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  amount: number;
  confidenceLevel: ConfidenceLevel;
  sourceBasis?: SourceBasis | null;
  escalationPercent?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualAssumption {
  id: string;
  title: string;
  description: string;
  impact: AssumptionImpact;
  relatedDivision?: string | null;
  relatedSystem?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualExclusion {
  id: string;
  title: string;
  description: string;
  reason: string;
  potentialCostImpact?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualAllowanceNote {
  id: string;
  title: string;
  includedAmount: number;
  description: string;
  responsibility?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualRisk {
  id: string;
  title: string;
  description: string;
  probability: RiskLevel;
  impact: RiskLevel;
  costExposure: number;
  mitigation?: string | null;
  includedInContingency: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualEstimateScenario {
  id: string;
  name: string;
  description?: string | null;
  lineItemIds: string[];
  subtotal: number;
  contingency: number;
  total: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptualEstimateRevision {
  name: string;
  date: string;
  notes?: string | null;
  basisOfEstimate?: string | null;
  designStage: DesignStage;
}

export interface ConceptualEstimatePayload {
  lineItems: ConceptualEstimateLineItem[];
  assumptions: ConceptualAssumption[];
  exclusions: ConceptualExclusion[];
  allowanceNotes: ConceptualAllowanceNote[];
  risks: ConceptualRisk[];
  scenarios: ConceptualEstimateScenario[];
  revision: ConceptualEstimateRevision;
  contingencyPercent: number;
  selectedScenarioId?: string | null;
}

export interface ConceptualEstimateRollup {
  subtotal: number;
  escalationTotal: number;
  contingencyAmount: number;
  contingencyPercent: number;
  overhead: number;
  profit: number;
  tax: number;
  indirectCost: number;
  finalSellPrice: number;
  totalRiskExposure: number;
  recommendedContingencyPercent: number;
  aggregateConfidence: ConfidenceLevel;
}

export const CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE = 'conceptual_estimate' as const;

export function createEmptyConceptualEstimatePayload(): ConceptualEstimatePayload {
  const now = new Date().toISOString();
  return {
    lineItems: [],
    assumptions: [],
    exclusions: [],
    allowanceNotes: [],
    risks: [],
    scenarios: [],
    revision: {
      name: 'Initial Conceptual Budget',
      date: now.slice(0, 10),
      designStage: 'schematic_design',
      basisOfEstimate: '',
      notes: '',
    },
    contingencyPercent: 10,
    selectedScenarioId: null,
  };
}
