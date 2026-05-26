import type { RebarSize } from '../utils/reinforcement';
import type { RegionalMultiplierKey } from '../data/regionalMultipliers';

/** Stored in `reinforcement_sets.pricing` (jsonb). */
export interface ReinforcementPricing {
  estimatedCost: number;
  notes?: string;
  catalog?: 'rebarPricing2026';
  currency?: string;
  unit?: string;
  grade?: string;
  barSize?: RebarSize;
  regionalKey?: RegionalMultiplierKey;
  regionalMultiplier?: number;
  regionalLabel?: string;
  sticksRequired?: number;
  costPerStick?: number;
  subtotalBeforeRegional?: number;
  totalLinearFt?: number;
  lineItems?: ReinforcementPricingLineItem[];
}

export interface ReinforcementPricingLineItem {
  lengthFt: number;
  qty: number;
  sticksPerPiece: number;
  sticksTotal: number;
  cost: number;
}
