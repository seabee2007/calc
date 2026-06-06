import type { ReinforcementSet } from '../../../types';
import { backfillActivityCodesForDraftLines } from '../application/estimateActivityCoding';
import {
  createEmptyDraftLine,
  syncDraftLineDescription,
  type EstimateDraftLine,
} from '../application/estimateDraftLine';
import type { EstimateAdapterResult } from './fromConcreteCalculation';

export const REINFORCEMENT_CSI_DIVISION = '03';
export const REINFORCEMENT_CSI_SECTION = '03 20 00';
export const REINFORCEMENT_SCOPE_NAME = 'Concrete Reinforcement';

export interface ReinforcementCalculationAdapterInput {
  label?: string;
  projectName?: string;
  reinforcementType: 'rebar' | 'mesh' | 'fiber';
  totalLinearFt?: number;
  totalBars?: number;
  barSize?: string;
  meshSheets?: number;
  meshSheetSize?: string;
  fiberTotalLb?: number;
  fiberDose?: number;
  fiberType?: string;
  materialUnitCost?: number;
  meshUnitCost?: number;
  installationProductionRate?: number;
  installationLaborRate?: number;
  installationCrewSize?: number;
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

function labelPrefix(input: ReinforcementCalculationAdapterInput): string {
  return input.label?.trim() || input.projectName?.trim() || 'Reinforcement';
}

function buildReinforcementDraftLine(
  position: number,
  config: {
    title: string;
    description?: string;
    activity: string;
    quantity: number;
    unit: string;
    materialUnitCost?: number;
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
  draft.task.description = config.description ?? config.title;
  draft.task.scopeName = REINFORCEMENT_SCOPE_NAME;
  draft.task.trade = 'Reinforcing';
  draft.task.activity = config.activity;
  draft.task.lineItem.csiDivision = REINFORCEMENT_CSI_DIVISION;
  draft.task.lineItem.csiSection = REINFORCEMENT_CSI_SECTION;
  draft.task.lineItem.description = config.description ?? config.title;
  draft.task.lineItem.quantity = {
    formula: 'quantity_with_waste',
    quantity: safeFinite(config.quantity),
    wastePercent: 0,
  };
  draft.task.lineItem.material.unitCost = safeFinite(config.materialUnitCost);

  if (config.productionRate !== undefined || config.laborRate !== undefined) {
    draft.task.lineItem.labor = {
      ...draft.task.lineItem.labor,
      productionRate: resolveProductionRate(config.productionRate, config.lineLabel, warnings),
      productionRateType: 'units_per_labor_hour',
      laborRate: resolveLaborRate(config.laborRate, config.lineLabel, warnings),
      crewSize: Math.max(1, safeFinite(config.crewSize, 2)),
      hoursPerDay: Math.max(1, safeFinite(config.hoursPerDay, 8)),
      burdenPercent: safeFinite(config.burdenPercent),
    };
  }

  return syncDraftLineDescription(draft);
}

export function adaptReinforcementCalculationToDraftLines(
  input: ReinforcementCalculationAdapterInput,
): EstimateAdapterResult {
  const warnings: string[] = [];
  const draftLines: EstimateDraftLine[] = [];
  let position = 0;
  const prefix = labelPrefix(input);
  const hoursPerDay = safeFinite(input.hoursPerDay, 8);
  const burdenPercent = safeFinite(input.burdenPercent);

  if (input.reinforcementType === 'rebar') {
    const linearFt = safeFinite(input.totalLinearFt);
    const barLabel = input.barSize?.trim() ? `#${input.barSize.replace(/^#/, '')}` : 'rebar';
    const unitCost =
      safeFinite(input.materialUnitCost) ||
      (linearFt > 0 && input.totalBars
        ? safeFinite(input.totalBars) / linearFt
        : 0);

    draftLines.push(
      buildReinforcementDraftLine(
        position++,
        {
          title: `${prefix} — ${barLabel} material`,
          description:
            input.totalBars != null
              ? `${input.totalBars} bars, ${linearFt} LF total`
              : `${linearFt} LF`,
          activity: 'Material',
          quantity: linearFt,
          unit: 'LF',
          materialUnitCost: unitCost,
          lineLabel: 'Rebar material',
        },
        warnings,
      ),
    );

    draftLines.push(
      buildReinforcementDraftLine(
        position++,
        {
          title: `${prefix} — rebar installation labor`,
          activity: 'Installation',
          quantity: linearFt,
          unit: 'LF',
          productionRate: input.installationProductionRate,
          laborRate: input.installationLaborRate,
          crewSize: input.installationCrewSize,
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Rebar installation labor',
        },
        warnings,
      ),
    );
  }

  if (input.reinforcementType === 'mesh') {
    const sheets = safeFinite(input.meshSheets);
    draftLines.push(
      buildReinforcementDraftLine(
        position++,
        {
          title: `${prefix} — wire mesh material`,
          description: input.meshSheetSize?.trim()
            ? `${sheets} sheets (${input.meshSheetSize})`
            : `${sheets} sheets`,
          activity: 'Material',
          quantity: sheets,
          unit: 'SHT',
          materialUnitCost: safeFinite(input.meshUnitCost ?? input.materialUnitCost),
          lineLabel: 'Wire mesh material',
        },
        warnings,
      ),
    );

    draftLines.push(
      buildReinforcementDraftLine(
        position++,
        {
          title: `${prefix} — wire mesh installation labor`,
          activity: 'Installation',
          quantity: sheets,
          unit: 'SHT',
          productionRate: input.installationProductionRate,
          laborRate: input.installationLaborRate,
          crewSize: input.installationCrewSize,
          hoursPerDay,
          burdenPercent,
          lineLabel: 'Wire mesh installation labor',
        },
        warnings,
      ),
    );
  }

  if (input.reinforcementType === 'fiber') {
    const fiberLb = safeFinite(input.fiberTotalLb);
    draftLines.push(
      buildReinforcementDraftLine(
        position++,
        {
          title: `${prefix} — fiber reinforcement`,
          description: input.fiberType?.trim()
            ? `${input.fiberType}${input.fiberDose ? ` @ ${input.fiberDose} lb/CY` : ''}`
            : 'Fiber reinforcement',
          activity: 'Material',
          quantity: fiberLb,
          unit: 'LB',
          materialUnitCost: safeFinite(input.materialUnitCost),
          lineLabel: 'Fiber reinforcement',
        },
        warnings,
      ),
    );
  }

  if (draftLines.length === 0) {
    warnings.push('No reinforcement lines generated for the provided type.');
  }

  return { draftLines: backfillActivityCodesForDraftLines(draftLines), warnings };
}

export function adaptReinforcementSetToDraftLines(
  reinforcement: Pick<
    ReinforcementSet,
    | 'projectName'
    | 'reinforcement_type'
    | 'total_linear_ft'
    | 'total_bars'
    | 'bar_size'
    | 'mesh_sheets'
    | 'mesh_sheet_size'
    | 'fiber_total_lb'
    | 'fiber_dose'
    | 'fiber_type'
    | 'pricing'
  >,
  options: Omit<ReinforcementCalculationAdapterInput, 'reinforcementType' | 'projectName'> = {},
): EstimateAdapterResult {
  const pricing = reinforcement.pricing;
  const linearFt = safeFinite(reinforcement.total_linear_ft);
  const materialUnitCost =
    options.materialUnitCost ??
    (linearFt > 0 && pricing?.estimatedCost
      ? safeFinite(pricing.estimatedCost) / linearFt
      : undefined);

  return adaptReinforcementCalculationToDraftLines({
    label: options.label,
    projectName: reinforcement.projectName,
    reinforcementType: reinforcement.reinforcement_type,
    totalLinearFt: reinforcement.total_linear_ft,
    totalBars: reinforcement.total_bars,
    barSize: reinforcement.bar_size,
    meshSheets: reinforcement.mesh_sheets,
    meshSheetSize: reinforcement.mesh_sheet_size,
    fiberTotalLb: reinforcement.fiber_total_lb,
    fiberDose: reinforcement.fiber_dose,
    fiberType: reinforcement.fiber_type,
    materialUnitCost,
    meshUnitCost: options.meshUnitCost,
    installationProductionRate: options.installationProductionRate,
    installationLaborRate: options.installationLaborRate,
    installationCrewSize: options.installationCrewSize,
    hoursPerDay: options.hoursPerDay,
    burdenPercent: options.burdenPercent,
  });
}
