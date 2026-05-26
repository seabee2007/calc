import { useMemo, useState, useCallback } from 'react';
import type { Calculation } from '../types';
import type { LaborEstimateInputs } from '../types/laborEstimate';
import { DEFAULT_POUR_PLANNER_STATE } from '../types/pourPlanner';
import type { CrewEfficiency, PlacementMethod } from '../types/pourPlanner';
import { usePreferencesStore } from '../store';
import { estimatePlacementProductionRate } from '../utils/placementProduction';
import { buildProductionSnapshot } from '../utils/placementOrderForm';
import { formatCalculationSlabSize } from '../utils/calculationDimensions';

export const DEFAULT_LABOR_INPUTS: LaborEstimateInputs = {
  crewSize: DEFAULT_POUR_PLANNER_STATE.crewSize,
  finishers: DEFAULT_POUR_PLANNER_STATE.finishers,
  vibrators: DEFAULT_POUR_PLANNER_STATE.vibrators,
  laborerRateCYHr: DEFAULT_POUR_PLANNER_STATE.laborerRateCYHr,
  finisherRateSFHr: DEFAULT_POUR_PLANNER_STATE.finisherRateSFHr,
  placingProductivityCYPerLaborHour:
    DEFAULT_POUR_PLANNER_STATE.placingProductivityCYPerLaborHour,
  finishingProductivitySFPerLaborHour:
    DEFAULT_POUR_PLANNER_STATE.finishingProductivitySFPerLaborHour,
  setupHours: DEFAULT_POUR_PLANNER_STATE.setupHours,
  cleanupHours: DEFAULT_POUR_PLANNER_STATE.cleanupHours,
  crewEfficiency: DEFAULT_POUR_PLANNER_STATE.crewEfficiency,
  complexityFactor: DEFAULT_POUR_PLANNER_STATE.complexityFactor,
  placementMethod: DEFAULT_POUR_PLANNER_STATE.placementMethod,
  manualVolume: '',
  slabSize: '',
  slabThicknessIn: DEFAULT_POUR_PLANNER_STATE.slabThicknessIn,
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

  const placementRateEstimate = useMemo(
    () =>
      estimatePlacementProductionRate({
        crewSize: inputs.crewSize,
        finishers: inputs.finishers,
        vibrators: inputs.vibrators,
        placementMethod: (inputs.placementMethod || '') as PlacementMethod,
        calculation,
        slabSize: inputs.slabSize,
        slabThicknessIn: inputs.slabThicknessIn,
        laborerRateCYHr: inputs.laborerRateCYHr,
        finisherRateSFHr: inputs.finisherRateSFHr,
        placingProductivityCYPerLaborHour: inputs.placingProductivityCYPerLaborHour,
        finishingProductivitySFPerLaborHour: inputs.finishingProductivitySFPerLaborHour,
        crewEfficiency: inputs.crewEfficiency as CrewEfficiency,
        complexityFactor:
          inputs.complexityFactor === 'auto'
            ? undefined
            : (inputs.complexityFactor as import('../types/pourPlanner').ComplexityLevel),
        concreteVolumeYd: volumeYd,
        setupHours: inputs.setupHours,
        cleanupHours: inputs.cleanupHours,
      }),
    [inputs, calculation, volumeYd],
  );

  const applyFromCalculation = useCallback((calc: Calculation) => {
    const slabSize = formatCalculationSlabSize(calc, preferences.lengthUnit);
    setInputs((prev) => ({
      ...prev,
      manualVolume: String(calc.result.volume),
      slabSize: slabSize || prev.slabSize,
    }));
  }, [preferences.lengthUnit]);

  const buildSavePayload = useCallback(() => {
    const production = buildProductionSnapshot(
      {
        ...DEFAULT_POUR_PLANNER_STATE,
        ...inputs,
        crewEfficiency: inputs.crewEfficiency as CrewEfficiency,
        complexityFactor: inputs.complexityFactor as typeof DEFAULT_POUR_PLANNER_STATE.complexityFactor,
        placementMethod: inputs.placementMethod as PlacementMethod,
      },
      placementRateEstimate,
      volumeYd,
    );
    return {
      volumeYd,
      inputs,
      laborCost: placementRateEstimate.laborCost ?? 0,
      adjustedLaborHours: placementRateEstimate.adjustedLaborHours,
      production: production ?? undefined,
    };
  }, [inputs, placementRateEstimate, volumeYd]);

  return {
    inputs,
    setField,
    setInputs,
    volumeYd,
    placementRateEstimate,
    applyFromCalculation,
    buildSavePayload,
    preferences,
  };
}
