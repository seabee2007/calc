export interface QuickFeasibilityBreakdownPreset {
  materialPercent: number;
  laborPercent: number;
  equipmentPercent: number;
  overheadPercent: number;
  profitPercent: number;
  fullyBurdenedLaborRate: number;
  hoursPerDay: number;
}

export const QUICK_FEASIBILITY_BREAKDOWN_PRESETS = {
  generalConstruction: {
    materialPercent: 0.45,
    laborPercent: 0.35,
    equipmentPercent: 0.05,
    overheadPercent: 0.10,
    profitPercent: 0.10,
    fullyBurdenedLaborRate: 65,
    hoursPerDay: 8,
  },
  concreteHeavy: {
    materialPercent: 0.50,
    laborPercent: 0.30,
    equipmentPercent: 0.07,
    overheadPercent: 0.08,
    profitPercent: 0.10,
    fullyBurdenedLaborRate: 65,
    hoursPerDay: 8,
  },
} satisfies Record<string, QuickFeasibilityBreakdownPreset>;

export const DEFAULT_QUICK_FEASIBILITY_BREAKDOWN_PRESET =
  QUICK_FEASIBILITY_BREAKDOWN_PRESETS.generalConstruction;
