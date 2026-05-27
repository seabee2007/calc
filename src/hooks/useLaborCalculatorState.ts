import { useMemo, useState, useCallback } from 'react';
import type { Calculation } from '../types';
import type { LaborEstimateInputs } from '../types/laborEstimate';
import { DEFAULT_POUR_PLANNER_STATE } from '../types/pourPlanner';
import { usePreferencesStore } from '../store';
import {
  buildConcreteLaborEstimateInput,
  mapProjectType,
} from '../utils/concreteLaborInputMapper';
import { estimateProfessionalConcreteLabor } from '../utils/professionalConcreteLabor';
import { formatCalculationSlabSize } from '../utils/calculationDimensions';
import { LABOR_RATES_2026 } from '../data/nationalLaborRates2026';

const { concreteLaborer } = LABOR_RATES_2026.laborRates;
const DEFAULT_BURDEN =
  concreteLaborer.hourlyRateWithBurden / concreteLaborer.hourlyRateBase;

export const DEFAULT_LABOR_INPUTS: LaborEstimateInputs = {
  crewSize: DEFAULT_POUR_PLANNER_STATE.crewSize,
  finishers: DEFAULT_POUR_PLANNER_STATE.finishers,
  foremen: '1',
  vibrators: DEFAULT_POUR_PLANNER_STATE.vibrators,
  complexityFactor: DEFAULT_POUR_PLANNER_STATE.complexityFactor,
  accessFactorMode: DEFAULT_POUR_PLANNER_STATE.accessFactorMode,
  weatherFactorMode: DEFAULT_POUR_PLANNER_STATE.weatherFactorMode,
  placementMethod: DEFAULT_POUR_PLANNER_STATE.placementMethod || 'chute',
  manualVolume: '',
  slabSize: '',
  slabThicknessIn: DEFAULT_POUR_PLANNER_STATE.slabThicknessIn,
  projectType: 'slab_on_grade',
  finishType: 'broom',
  accessDifficulty: 'auto',
  weatherCondition: 'auto',
  reinforcementType: 'auto',
  burdenMultiplier: String(DEFAULT_BURDEN),
  overtimeMultiplier: String(concreteLaborer.overtimeMultiplier),
  vaporBarrier: 'false',
  curingCompound: 'true',
  sawCutJoints: 'true',
  smallJobMinimum: 'false',
  includeCleanup: 'true',
  includeContingency: 'true',
};

export function useLaborCalculatorState(calculation?: Calculation) {
  const { preferences } = usePreferencesStore();
  const [inputs, setInputs] = useState<LaborEstimateInputs>(DEFAULT_LABOR_INPUTS);

  const setField = useCallback(
    <K extends keyof LaborEstimateInputs>(key: K, value: LaborEstimateInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const volumeYd = useMemo(() => {
    const manual = parseFloat(inputs.manualVolume);
    if (Number.isFinite(manual) && manual > 0) return manual;
    return calculation?.result?.volume ?? 0;
  }, [inputs.manualVolume, calculation]);

  const laborInput = useMemo(
    () =>
      buildConcreteLaborEstimateInput(inputs, {
        volumeYd,
        calculation,
      }),
    [inputs, calculation, volumeYd],
  );

  const professionalLabor = useMemo(() => {
    if (volumeYd <= 0) return null;
    return estimateProfessionalConcreteLabor(laborInput);
  }, [laborInput, volumeYd]);

  const applyFromCalculation = useCallback(
    (calc: Calculation) => {
      const slabSize = formatCalculationSlabSize(calc, preferences.lengthUnit);
      setInputs((prev) => ({
        ...prev,
        manualVolume: String(calc.result.volume),
        slabSize: slabSize || prev.slabSize,
        projectType: mapProjectType(calc),
      }));
    },
    [preferences.lengthUnit],
  );

  const buildSavePayload = useCallback(() => {
    const laborCost = professionalLabor?.costs.totalLaborCost ?? 0;
    return {
      volumeYd,
      inputs,
      laborCost,
      adjustedLaborHours: professionalLabor?.billableCrewHours,
      professionalLabor: professionalLabor ?? undefined,
    };
  }, [inputs, professionalLabor, volumeYd]);

  return {
    inputs,
    setField,
    setInputs,
    volumeYd,
    laborInput,
    professionalLabor,
    applyFromCalculation,
    buildSavePayload,
    preferences,
  };
}
