export const CHANGE_ORDER_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'void',
] as const;

export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export type ChangeOrderLineItemCategory =
  | 'labor'
  | 'material'
  | 'equipment'
  | 'subcontractor';

export interface ChangeOrderLineItem {
  description: string;
  /** Labor / material quantity, or equipment count. */
  qty?: number;
  /** Optional unit label (e.g. ea, lf). */
  unit?: string;
  /** Equipment only — hours per unit or total hours. */
  hours?: number;
  /** Labor & material: unit price. Equipment: price per hour. */
  unitPrice?: number;
  /** Line total (computed from qty × unit price or qty × hrs × rate). */
  amount: number;
  /** Workflow estimate source for distinguishing manual custom lines from generated lines. */
  source?: 'general_trade_labor' | 'custom_estimate';
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  userId: string;
  linkedFarId: string | null;
  linkedRfiId: string | null;
  linkedTaskId: string | null;
  displayNumber: string | null;
  title: string;
  scopeDescription: string;
  reasonForChange: string;
  terms: string;
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  subcontractorItems: ChangeOrderLineItem[];
  markupPercent: number;
  pricingModel: 'legacy' | 'standard';
  wasteFactorPercent: number;
  wasteCost: number;
  materialCostBase: number;
  materialCostAdjusted: number;
  contingencyPercent: number;
  contingencyCost: number;
  taxSystem: string;
  taxRatePercent: number;
  taxApplication: string;
  taxCost: number;
  targetMarginPercent: number;
  grossProfit: number;
  grossMarginPercent: number;
  markupPercentReporting: number;
  costWithOverhead: number;
  totalEstimatedCost: number;
  feesAmount: number;
  permitsAmount: number;
  /** % of direct cost (default 8). */
  overheadPercent: number;
  /** % of direct cost (default 8). */
  profitPercent: number;
  /** Computed $ from overheadPercent × direct cost. */
  overheadAmount: number;
  /** Computed $ from profitPercent × direct cost. */
  profitAmount: number;
  subtotal: number;
  total: number;
  scheduleImpact: string | null;
  status: ChangeOrderStatus;
  publicToken: string;
  sentAt: string | null;
  viewedAt: string | null;
  openedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  contractorName: string | null;
  contractorSignature: string | null;
  contractorSignedAt: string | null;
  clientName: string | null;
  clientSignature: string | null;
  clientSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrderInput {
  projectId: string;
  userId: string;
  title: string;
  scopeDescription: string;
  reasonForChange: string;
  terms?: string;
  laborItems?: ChangeOrderLineItem[];
  materialItems?: ChangeOrderLineItem[];
  equipmentItems?: ChangeOrderLineItem[];
  subcontractorItems?: ChangeOrderLineItem[];
  markupPercent?: number;
  pricingModel?: 'legacy' | 'standard';
  wasteFactorPercent?: number;
  contingencyPercent?: number;
  targetMarginPercent?: number;
  taxSystem?: string;
  taxRatePercent?: number;
  taxApplication?: string;
  feesAmount?: number;
  permitsAmount?: number;
  overheadPercent?: number;
  profitPercent?: number;
  scheduleImpact?: string | null;
  linkedFarId?: string | null;
  linkedRfiId?: string | null;
  linkedTaskId?: string | null;
  contractorName?: string | null;
  contractorSignature?: string | null;
}
