import type { LaborEstimate } from '../../../types/laborEstimate';
import type { GeneralTradeLaborInput } from '../../../types/generalTradeLabor';
import {
  createEmptyDraftLine,
  syncDraftLineDescription,
  type EstimateDraftLine,
} from '../application/estimateDraftLine';
import type { ProductionRateType } from '../domain/estimateTypes';
import type { EstimateAdapterResult } from './fromConcreteCalculation';
import {
  CONCRETE_CSI_DIVISION,
  CONCRETE_CSI_SECTION,
  CONCRETE_SCOPE_NAME,
} from './fromConcreteCalculation';

export interface LaborEstimateAdapterInput {
  label?: string;
  volumeYd?: number;
  areaSqFt?: number;
  laborCost?: number;
  adjustedLaborHours?: number;
  inputs?: Partial<LaborEstimate['inputs']>;
  production?: LaborEstimate['production'];
  professionalLabor?: LaborEstimate['professionalLabor'];
  generalTradeLabor?: GeneralTradeLaborInput;
}

function safeFinite(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
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

function mapGeneralTradeProductionType(
  type: GeneralTradeLaborInput['productionRateType'],
): ProductionRateType {
  return type === 'laborHoursPerUnit' ? 'labor_hours_per_unit' : 'units_per_labor_hour';
}

function generalTradeProductionRate(input: GeneralTradeLaborInput): number {
  if (input.productionRateType === 'laborHoursPerUnit') {
    return safeFinite(input.productionRate);
  }
  if (input.productionRateType === 'unitsPerLaborDay') {
    const hoursPerDay = Math.max(1, safeFinite(input.hoursPerDay, 8));
    return safeFinite(input.productionRate) / hoursPerDay;
  }
  return safeFinite(input.productionRate);
}

function buildConcreteLaborDraftLine(
  position: number,
  config: {
    title: string;
    activity: string;
    quantity: number;
    unit: string;
    wastePercent?: number;
    productionRate?: number;
    laborRate?: number;
    crewSize?: number;
    hoursPerDay?: number;
    burdenPercent?: number;
    lineLabel: string;
  },
  warnings: string[],
): EstimateDraftLine {
  const draft = createEmptyDraftLine(position);
  draft.unit = config.unit;
  draft.task.title = config.title;
  draft.task.description = config.title;
  draft.task.scopeName = CONCRETE_SCOPE_NAME;
  draft.task.trade = 'Concrete';
  draft.task.activity = config.activity;
  draft.task.lineItem.csiDivision = CONCRETE_CSI_DIVISION;
  draft.task.lineItem.csiSection = CONCRETE_CSI_SECTION;
  draft.task.lineItem.description = config.title;
  draft.task.lineItem.quantity = {
    formula: 'quantity_with_waste',
    quantity: safeFinite(config.quantity),
    wastePercent: safeFinite(config.wastePercent),
  };
  draft.task.lineItem.labor = {
    ...draft.task.lineItem.labor,
    productionRate: resolveProductionRate(config.productionRate, config.lineLabel, warnings),
    productionRateType: 'units_per_labor_hour',
    laborRate: resolveLaborRate(config.laborRate, config.lineLabel, warnings),
    crewSize: Math.max(1, safeFinite(config.crewSize, 2)),
    hoursPerDay: Math.max(1, safeFinite(config.hoursPerDay, 8)),
    burdenPercent: safeFinite(config.burdenPercent),
  };
  return syncDraftLineDescription(draft);
}

function buildGeneralTradeDraftLine(
  position: number,
  input: GeneralTradeLaborInput,
  warnings: string[],
): EstimateDraftLine {
  const draft = createEmptyDraftLine(position);
  const title =
    [input.trade, input.activity].filter((part) => part && String(part).trim()).join(' — ') ||
    'General trade labor';

  draft.unit = input.unit.trim() || 'EA';
  draft.task.title = title;
  draft.task.description = input.notes.trim() || title;
  draft.task.scopeName = input.trade.trim() || 'General Trade Labor';
  draft.task.trade = input.trade.trim() || 'General Labor';
  draft.task.activity = input.activity.trim() || 'Labor';
  draft.task.lineItem.csiDivision = CONCRETE_CSI_DIVISION;
  draft.task.lineItem.csiSection = CONCRETE_CSI_SECTION;
  draft.task.lineItem.description = title;
  draft.task.lineItem.quantity = {
    formula: 'quantity_with_waste',
    quantity: safeFinite(input.quantity),
    wastePercent: 0,
  };
  draft.task.lineItem.labor = {
    ...draft.task.lineItem.labor,
    productionRate: resolveProductionRate(
      generalTradeProductionRate(input),
      'General trade labor',
      warnings,
    ),
    productionRateType: mapGeneralTradeProductionType(input.productionRateType),
    laborRate: resolveLaborRate(input.laborRate, 'General trade labor', warnings),
    crewSize: Math.max(1, safeFinite(input.crewSize, 2)),
    hoursPerDay: Math.max(1, safeFinite(input.hoursPerDay, 8)),
    burdenPercent: safeFinite(input.burdenPercent),
    difficultyFactor: safeFinite(input.difficultyFactor, 1) || 1,
    locationFactor: safeFinite(input.locationFactor, 1) || 1,
  };
  draft.task.overheadPercent = safeFinite(input.overheadPercent);
  draft.task.profitPercent = safeFinite(input.profitPercent);

  return syncDraftLineDescription(draft);
}

function buildCrewDurationDraftLine(
  position: number,
  config: {
    title: string;
    durationHours: number;
    crewSize: number;
    laborRate: number;
    hoursPerDay: number;
    burdenPercent: number;
    lineLabel: string;
  },
  warnings: string[],
): EstimateDraftLine {
  const draft = createEmptyDraftLine(position);
  draft.unit = 'HR';
  draft.task.title = config.title;
  draft.task.description = config.title;
  draft.task.scopeName = CONCRETE_SCOPE_NAME;
  draft.task.trade = 'Concrete';
  draft.task.activity = 'Crew duration';
  draft.task.lineItem.csiDivision = CONCRETE_CSI_DIVISION;
  draft.task.lineItem.csiSection = CONCRETE_CSI_SECTION;
  draft.task.lineItem.description = config.title;
  draft.task.lineItem.quantity = {
    formula: 'quantity_with_waste',
    quantity: safeFinite(config.durationHours),
    wastePercent: 0,
  };
  draft.task.lineItem.labor = {
    ...draft.task.lineItem.labor,
    productionRate: resolveProductionRate(1, config.lineLabel, warnings),
    productionRateType: 'labor_hours_per_unit',
    laborRate: resolveLaborRate(config.laborRate, config.lineLabel, warnings),
    crewSize: Math.max(1, safeFinite(config.crewSize, 2)),
    hoursPerDay: Math.max(1, safeFinite(config.hoursPerDay, 8)),
    burdenPercent: safeFinite(config.burdenPercent),
  };
  return syncDraftLineDescription(draft);
}

export function adaptLaborEstimateToDraftLines(
  input: LaborEstimateAdapterInput,
): EstimateAdapterResult {
  const warnings: string[] = [];
  const draftLines: EstimateDraftLine[] = [];
  let position = 0;

  const label = input.label?.trim() || 'Concrete labor';
  const volumeYd = safeFinite(input.volumeYd);
  const production = input.production;
  const professional = input.professionalLabor;
  const inputs = input.inputs;

  const crewSize =
    safeFinite(professional?.crewSize) ||
    safeFinite(inputs?.crewSize) ||
    safeFinite(production?.crewSize) ||
    2;
  const hoursPerDay = 8;
  const burdenPercent =
    safeFinite(inputs?.burdenMultiplier) > 0
      ? (safeFinite(inputs?.burdenMultiplier) - 1) * 100
      : 0;

  const placingRate =
    safeFinite(production?.placingProductivityCYPerLaborHour) ||
    safeFinite(inputs?.placingProductivityCYPerLaborHour);
  const placingLaborRate =
    safeFinite(inputs?.laborerRateCYHr) || safeFinite(professional?.burdenedRates?.laborer);

  if (volumeYd > 0) {
    draftLines.push(
      buildConcreteLaborDraftLine(
        position++,
        {
          title: `${label} — placement labor`,
          activity: 'Placement',
          quantity: volumeYd,
          unit: 'CY',
          wastePercent: 0,
          productionRate: placingRate,
          laborRate: placingLaborRate,
          crewSize,
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Concrete placement labor',
        },
        warnings,
      ),
    );
  }

  const areaSqFt = safeFinite(input.areaSqFt);
  const finishingRate =
    safeFinite(production?.finishingProductivitySFPerLaborHour) ||
    safeFinite(inputs?.finishingProductivitySFPerLaborHour);
  const finishingLaborRate =
    safeFinite(inputs?.finisherRateSFHr) || safeFinite(professional?.burdenedRates?.finisher);

  if (areaSqFt > 0) {
    draftLines.push(
      buildConcreteLaborDraftLine(
        position++,
        {
          title: `${label} — finishing labor`,
          activity: 'Finishing',
          quantity: areaSqFt,
          unit: 'SF',
          wastePercent: 0,
          productionRate: finishingRate,
          laborRate: finishingLaborRate,
          crewSize: Math.max(1, safeFinite(inputs?.finishers, 2)),
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Concrete finishing labor',
        },
        warnings,
      ),
    );
  } else if (volumeYd > 0) {
    warnings.push('Finishing labor skipped: area (SF) not provided.');
  }

  if (input.generalTradeLabor) {
    draftLines.push(
      buildGeneralTradeDraftLine(position++, input.generalTradeLabor, warnings),
    );
  }

  const durationHours =
    safeFinite(professional?.estimatedJobDurationHours) ||
    safeFinite(professional?.billableJobDurationHours) ||
    safeFinite(production?.estimatedCrewDurationHours);

  if (durationHours > 0) {
    const averageRate =
      safeFinite(professional?.averageCrewRate) ||
      safeFinite(placingLaborRate) ||
      safeFinite(finishingLaborRate);

    draftLines.push(
      buildCrewDurationDraftLine(
        position++,
        {
          title: `${label} — crew duration`,
          durationHours,
          crewSize,
          laborRate: averageRate,
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Crew duration',
        },
        warnings,
      ),
    );
  }

  if (draftLines.length === 0) {
    warnings.push('No labor lines generated; volume and trade inputs were empty.');
  }

  return { draftLines, warnings };
}

export function adaptLaborEstimateRecordToDraftLines(
  estimate: Pick<
    LaborEstimate,
    | 'label'
    | 'volumeYd'
    | 'inputs'
    | 'production'
    | 'professionalLabor'
    | 'adjustedLaborHours'
    | 'laborCost'
  >,
  options: {
    areaSqFt?: number;
    generalTradeLabor?: GeneralTradeLaborInput;
  } = {},
): EstimateAdapterResult {
  return adaptLaborEstimateToDraftLines({
    label: estimate.label,
    volumeYd: estimate.volumeYd,
    areaSqFt: options.areaSqFt,
    laborCost: estimate.laborCost,
    adjustedLaborHours: estimate.adjustedLaborHours,
    inputs: estimate.inputs,
    production: estimate.production,
    professionalLabor: estimate.professionalLabor,
    generalTradeLabor: options.generalTradeLabor,
  });
}
