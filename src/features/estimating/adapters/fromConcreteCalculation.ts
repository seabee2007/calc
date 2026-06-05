import type { Calculation } from '../../../types';
import {
  createEmptyDraftLine,
  syncDraftLineDescription,
  type EstimateDraftLine,
} from '../application/estimateDraftLine';
import type { ProductionRateType } from '../domain/estimateTypes';

export interface EstimateAdapterResult {
  draftLines: EstimateDraftLine[];
  warnings: string[];
}

export const CONCRETE_CSI_DIVISION = '03';
export const CONCRETE_CSI_SECTION = '03 30 00';
export const CONCRETE_SCOPE_NAME = 'Cast-in-Place Concrete';

export interface ConcreteCalculationAdapterInput {
  label?: string;
  calculationType?: string;
  volumeCubicYards: number;
  wastePercent?: number;
  areaSqFt?: number;
  psi?: string;
  pricePerYard?: number;
  pumpTruckFee?: number;
  formworkAreaSqFt?: number;
  formworkUnitCostPerSf?: number;
  placementProductionRate?: number;
  placementLaborRate?: number;
  placementCrewSize?: number;
  finishingProductionRate?: number;
  finishingLaborRate?: number;
  finishingCrewSize?: number;
  hoursPerDay?: number;
  burdenPercent?: number;
}

function safeFinite(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatCalculationLabel(calculation: Pick<Calculation, 'type'>, override?: string): string {
  if (override?.trim()) return override.trim();
  const type = calculation.type?.trim();
  return type ? `${type.charAt(0).toUpperCase()}${type.slice(1)} concrete` : 'Concrete placement';
}

function areaSqFtFromCalculation(calculation: Pick<Calculation, 'dimensions'>): number | null {
  const d = calculation.dimensions;
  if (!d) return null;
  const length = safeFinite(d.length);
  const width = safeFinite(d.width);
  if (length > 0 && width > 0) return length * width;
  const diameter = safeFinite(d.diameter);
  if (diameter > 0) {
    const radius = diameter / 2;
    return Math.PI * radius * radius;
  }
  return null;
}

function resolveProductionRate(
  value: number | undefined,
  lineLabel: string,
  warnings: string[],
): number {
  const rate = safeFinite(value);
  if (rate <= 0) {
    warnings.push(`${lineLabel}: production rate missing; set to 0.`);
    return 0;
  }
  return rate;
}

function resolveLaborRate(
  value: number | undefined,
  lineLabel: string,
  warnings: string[],
): number {
  const rate = safeFinite(value);
  if (rate <= 0) {
    warnings.push(`${lineLabel}: labor rate missing; set to 0.`);
    return 0;
  }
  return rate;
}

interface DraftLineConfig {
  title: string;
  description?: string;
  trade?: string;
  activity?: string;
  quantity: number;
  unit: string;
  wastePercent: number;
  materialUnitCost?: number;
  productionRate?: number;
  productionRateType?: ProductionRateType;
  laborRate?: number;
  crewSize?: number;
  hoursPerDay?: number;
  burdenPercent?: number;
  equipmentRate?: number;
  equipmentRateType?: 'lump_sum' | 'hour' | 'day';
  equipmentUsageUnits?: number;
  lineLabel: string;
}

function buildDraftLine(position: number, config: DraftLineConfig, warnings: string[]): EstimateDraftLine {
  const draft = createEmptyDraftLine(position);
  const {
    title,
    description,
    trade = 'Concrete',
    activity,
    quantity,
    unit,
    wastePercent,
    materialUnitCost = 0,
    productionRate,
    productionRateType = 'units_per_labor_hour',
    laborRate,
    crewSize = 1,
    hoursPerDay = 8,
    burdenPercent = 0,
    equipmentRate = 0,
    equipmentRateType = 'lump_sum',
    equipmentUsageUnits = 1,
    lineLabel,
  } = config;

  draft.unit = unit;
  draft.task.title = title;
  draft.task.description = description ?? title;
  draft.task.scopeName = CONCRETE_SCOPE_NAME;
  draft.task.trade = trade;
  draft.task.activity = activity ?? '';
  draft.task.lineItem.csiDivision = CONCRETE_CSI_DIVISION;
  draft.task.lineItem.csiSection = CONCRETE_CSI_SECTION;
  draft.task.lineItem.description = description ?? title;
  draft.task.lineItem.quantity = {
    formula: 'quantity_with_waste',
    quantity: safeFinite(quantity),
    wastePercent: safeFinite(wastePercent),
  };
  draft.task.lineItem.material.unitCost = safeFinite(materialUnitCost);
  draft.task.lineItem.equipment = {
    rate: safeFinite(equipmentRate),
    rateType: equipmentRateType,
    usageUnits: safeFinite(equipmentUsageUnits, 1),
  };

  if (productionRate !== undefined || laborRate !== undefined) {
    draft.task.lineItem.labor = {
      ...draft.task.lineItem.labor,
      productionRate: resolveProductionRate(productionRate, lineLabel, warnings),
      productionRateType,
      laborRate: resolveLaborRate(laborRate, lineLabel, warnings),
      crewSize: Math.max(1, safeFinite(crewSize, 1)),
      hoursPerDay: Math.max(1, safeFinite(hoursPerDay, 8)),
      burdenPercent: safeFinite(burdenPercent),
    };
  }

  return syncDraftLineDescription(draft);
}

export function adaptConcreteCalculationToDraftLines(
  input: ConcreteCalculationAdapterInput,
): EstimateAdapterResult {
  const warnings: string[] = [];
  const draftLines: EstimateDraftLine[] = [];
  let position = 0;

  const volume = safeFinite(input.volumeCubicYards);
  const wastePercent = safeFinite(input.wastePercent);
  const labelPrefix = input.label?.trim() || 'Concrete';
  const hoursPerDay = safeFinite(input.hoursPerDay, 8);
  const burdenPercent = safeFinite(input.burdenPercent);

  if (volume <= 0) {
    warnings.push('Concrete volume is zero; material and placement lines use quantity 0.');
  }

  draftLines.push(
    buildDraftLine(
      position++,
      {
        title: `${labelPrefix} — ready-mix concrete`,
        description: input.psi ? `${labelPrefix} @ ${input.psi} PSI` : `${labelPrefix} ready-mix`,
        activity: 'Material',
        quantity: volume,
        unit: 'CY',
        wastePercent,
        materialUnitCost: safeFinite(input.pricePerYard),
        lineLabel: 'Ready-mix concrete',
      },
      warnings,
    ),
  );

  draftLines.push(
    buildDraftLine(
      position++,
      {
        title: `${labelPrefix} — placement labor`,
        activity: 'Placement',
        quantity: volume,
        unit: 'CY',
        wastePercent,
        productionRate: input.placementProductionRate,
        laborRate: input.placementLaborRate,
        crewSize: input.placementCrewSize ?? 2,
        hoursPerDay,
        burdenPercent,
        lineLabel: 'Placement labor',
      },
      warnings,
    ),
  );

  const areaSqFt = safeFinite(input.areaSqFt);
  if (areaSqFt > 0) {
    draftLines.push(
      buildDraftLine(
        position++,
        {
          title: `${labelPrefix} — finishing labor`,
          activity: 'Finishing',
          quantity: areaSqFt,
          unit: 'SF',
          wastePercent: 0,
          productionRate: input.finishingProductionRate,
          laborRate: input.finishingLaborRate,
          crewSize: input.finishingCrewSize ?? 2,
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Finishing labor',
        },
        warnings,
      ),
    );
  } else {
    warnings.push('Finishing labor skipped: area (SF) not provided.');
  }

  const formworkArea = safeFinite(input.formworkAreaSqFt);
  if (formworkArea > 0) {
    draftLines.push(
      buildDraftLine(
        position++,
        {
          title: `${labelPrefix} — formwork`,
          activity: 'Formwork',
          quantity: formworkArea,
          unit: 'SF',
          wastePercent: 0,
          materialUnitCost: safeFinite(input.formworkUnitCostPerSf),
          lineLabel: 'Formwork',
        },
        warnings,
      ),
    );
  }

  const pumpFee = safeFinite(input.pumpTruckFee);
  if (pumpFee > 0) {
    draftLines.push(
      buildDraftLine(
        position++,
        {
          title: `${labelPrefix} — concrete pump`,
          activity: 'Pumping',
          quantity: 1,
          unit: 'LS',
          wastePercent: 0,
          equipmentRate: pumpFee,
          equipmentRateType: 'lump_sum',
          equipmentUsageUnits: 1,
          lineLabel: 'Concrete pump',
        },
        warnings,
      ),
    );
  }

  return { draftLines, warnings };
}

export function adaptCalculationToDraftLines(
  calculation: Pick<Calculation, 'type' | 'dimensions' | 'result' | 'psi'>,
  options: Omit<ConcreteCalculationAdapterInput, 'volumeCubicYards' | 'calculationType'> = {},
): EstimateAdapterResult {
  const pricing = calculation.result?.pricing;
  const areaSqFt = options.areaSqFt ?? areaSqFtFromCalculation(calculation) ?? undefined;

  return adaptConcreteCalculationToDraftLines({
    label: options.label ?? formatCalculationLabel(calculation),
    calculationType: calculation.type,
    volumeCubicYards: safeFinite(calculation.result?.volume),
    wastePercent: options.wastePercent,
    areaSqFt,
    psi: options.psi ?? calculation.psi,
    pricePerYard: options.pricePerYard ?? pricing?.pricePerYard,
    pumpTruckFee:
      options.pumpTruckFee ?? pricing?.additionalServices?.pumpTruckFee,
    formworkAreaSqFt: options.formworkAreaSqFt,
    formworkUnitCostPerSf: options.formworkUnitCostPerSf,
    placementProductionRate: options.placementProductionRate,
    placementLaborRate: options.placementLaborRate,
    placementCrewSize: options.placementCrewSize,
    finishingProductionRate: options.finishingProductionRate,
    finishingLaborRate: options.finishingLaborRate,
    finishingCrewSize: options.finishingCrewSize,
    hoursPerDay: options.hoursPerDay,
    burdenPercent: options.burdenPercent,
  });
}
