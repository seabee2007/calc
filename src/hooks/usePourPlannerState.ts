import { useCallback, useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../store';
import { usePreferencesStore } from '../store';
import {
  DEFAULT_POUR_PLANNER_STATE,
  PourPlannerFormState,
  PourPlannerStepId,
} from '../types/pourPlanner';
import { calculateReadyMixDelivery } from '../utils/readyMixDelivery';
import {
  analyzeDeliveryWindow,
  analyzeHotWeather,
  analyzePlacementProduction,
  analyzeSlumpRisk,
} from '../utils/placementWindow';
import {
  estimatePlacementProductionRate,
} from '../utils/placementProduction';
import {
  isShortLoad,
  recommendedTruckCount,
  suggestTruckTypeId,
} from '../utils/readyMixDelivery';
import { ratingLabel } from '../utils/pourScoring';
import type { ScoredPourDay } from '../utils/pourScoring';

export const POUR_PLANNER_STEPS: {
  id: PourPlannerStepId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'project', label: 'Project overview', shortLabel: 'Project' },
  { id: 'mix', label: 'Mix & specs', shortLabel: 'Mix' },
  { id: 'delivery', label: 'Delivery logistics', shortLabel: 'Delivery' },
  { id: 'environment', label: 'Weather & conditions', shortLabel: 'Weather' },
  { id: 'production', label: 'Crew & production', shortLabel: 'Production' },
  { id: 'risk', label: 'Risk analysis', shortLabel: 'Risk' },
  { id: 'qc', label: 'QC & report', shortLabel: 'QC' },
];

function patchField<K extends keyof PourPlannerFormState>(
  prev: PourPlannerFormState,
  key: K,
  value: PourPlannerFormState[K],
): PourPlannerFormState {
  return { ...prev, [key]: value };
}

export function usePourPlannerState(selectedDay: ScoredPourDay | undefined) {
  const { projects } = useProjectStore();
  const { preferences } = usePreferencesStore();
  const [form, setForm] = useState<PourPlannerFormState>({
    ...DEFAULT_POUR_PLANNER_STATE,
    psi: preferences.defaultPSI || '3000',
  });
  const [activeStep, setActiveStep] = useState(0);

  const setField = useCallback(
    <K extends keyof PourPlannerFormState>(key: K, value: PourPlannerFormState[K]) => {
      setForm((prev) => patchField(prev, key, value));
    },
    [],
  );

  const project = projects.find((p) => p.id === form.projectId);
  const calculation = project?.calculations?.find((c) => c.id === form.calculationId);

  const volume = calculation
    ? calculation.result.volume
    : parseFloat(form.manualVolume) || 0;

  const deliveryPlan = useMemo(
    () => calculateReadyMixDelivery(volume, preferences.volumeUnit),
    [volume, preferences.volumeUnit],
  );

  const ambientTemp = form.ambientTemp || (selectedDay ? String(Math.round(selectedDay.avgTemp)) : '70');
  const humidity =
    form.relativeHumidity ||
    (selectedDay?.avgHumidity != null ? String(Math.round(selectedDay.avgHumidity)) : '50');
  const wind =
    form.windSpeed ||
    (selectedDay ? String(Math.round(selectedDay.maxWindSpeed)) : '5');
  const concreteTemp =
    form.expectedConcreteTempAtArrival ||
    form.concreteTempAtPlant ||
    (selectedDay ? String(Math.round(selectedDay.avgTemp + 8)) : '75');

  const hotWeather = useMemo(
    () =>
      analyzeHotWeather({
        airTempF: ambientTemp,
        humidityPercent: humidity,
        windMph: wind,
        concreteTempF: concreteTemp,
      }),
    [ambientTemp, humidity, wind, concreteTemp],
  );

  const placementRateEstimate = useMemo(
    () =>
      estimatePlacementProductionRate({
        crewSize: form.crewSize,
        finishers: form.finishers,
        vibrators: form.vibrators,
        placementMethod: form.placementMethod,
        pumpRateYdPerHr: form.pumpRate,
        calculation,
        slabSize: form.slabSize,
        slabThicknessIn: form.slabThicknessIn,
        laborerRateCYHr: form.laborerRateCYHr,
        finisherRateSFHr: form.finisherRateSFHr,
        placingProductivityCYPerLaborHour: form.placingProductivityCYPerLaborHour,
        finishingProductivitySFPerLaborHour: form.finishingProductivitySFPerLaborHour,
        crewEfficiency: form.crewEfficiency,
        complexityFactor:
          form.complexityFactor === 'auto'
            ? undefined
            : form.complexityFactor,
        accessFactorMode: form.accessFactorMode,
        weatherFactorMode: form.weatherFactorMode,
        ambientTempF: ambientTemp,
        rainForecast: form.rainForecast,
        nightPour: form.nightPour,
        hotWeatherRisk: hotWeather.riskLevel,
        concreteVolumeYd: deliveryPlan.volumeYd,
        burdenedHourlyRate: form.burdenedHourlyRate,
        setupHours: form.setupHours,
        cleanupHours: form.cleanupHours,
      }),
    [
      form.crewSize,
      form.finishers,
      form.vibrators,
      form.placementMethod,
      form.pumpRate,
      form.slabSize,
      form.slabThicknessIn,
      form.laborerRateCYHr,
      form.finisherRateSFHr,
      form.placingProductivityCYPerLaborHour,
      form.finishingProductivitySFPerLaborHour,
      form.crewEfficiency,
      form.complexityFactor,
      form.accessFactorMode,
      form.weatherFactorMode,
      form.rainForecast,
      form.nightPour,
      form.burdenedHourlyRate,
      form.setupHours,
      form.cleanupHours,
      calculation,
      deliveryPlan.volumeYd,
      ambientTemp,
      hotWeather.riskLevel,
    ],
  );

  const effectivePlacementRateYdPerHr = form.placementRateManualOverride
    ? parseFloat(form.placementRateYdPerHr) || placementRateEstimate.effectiveRateYdPerHr
    : placementRateEstimate.effectiveRateYdPerHr;

  const production = useMemo(
    () =>
      analyzePlacementProduction({
        totalVolumeYd: deliveryPlan.volumeYd,
        placementRateYdPerHr: effectivePlacementRateYdPerHr,
        truckCapacityYd: form.truckCapacityYd || deliveryPlan.planningCapacityYd,
        dischargeRateYdPerHr: form.dischargeRateYdPerHr,
        recommendedTrucks: deliveryPlan.recommendedTrucks,
      }),
    [
      deliveryPlan,
      effectivePlacementRateYdPerHr,
      form.truckCapacityYd,
      form.dischargeRateYdPerHr,
    ],
  );

  const truckCapacityYd =
    parseFloat(form.truckCapacityYd) || deliveryPlan.planningCapacityYd || 10;

  const plannedTruckCount = recommendedTruckCount(
    deliveryPlan.volumeYd,
    truckCapacityYd,
  );

  const truckCount = (() => {
    const manual = parseInt(form.numberOfTrucks, 10);
    if (Number.isFinite(manual) && manual > 0) return manual;
    return plannedTruckCount;
  })();

  const dischargeMin = useMemo(
    () => production.truckDischargeMinutes,
    [production.truckDischargeMinutes],
  );

  const deliveryWindow = useMemo(
    () =>
      analyzeDeliveryWindow({
        travelTimeMin: form.travelTimeMinutes,
        trafficBufferMin: form.trafficBufferMinutes,
        siteWaitMin: form.siteWaitMinutes,
        dischargeMin,
      }),
    [
      form.travelTimeMinutes,
      form.trafficBufferMinutes,
      form.siteWaitMinutes,
      dischargeMin,
    ],
  );

  const slumpRisk = useMemo(
    () =>
      analyzeSlumpRisk({
        requiredSlump: form.requiredSlumpAtPlacement || form.specifiedSlump,
        placementMethod: form.placementMethod,
        elapsedMinutes: deliveryWindow.totalElapsedMin,
        concreteTempF: parseFloat(concreteTemp) || 70,
        isPump: form.placementMethod === 'pump',
      }),
    [form, deliveryWindow.totalElapsedMin, concreteTemp],
  );

  const weatherRiskLabel = selectedDay ? ratingLabel(selectedDay.rating) : '—';

  const overview = useMemo(
    () => ({
      volume,
      volumeYd: deliveryPlan.volumeYd,
      truckCount,
      pourDurationHours: production.placementDurationHours,
      weatherRisk: weatherRiskLabel,
      deliveryStatus: deliveryWindow.statusLabel,
      timeRemainingMin: deliveryWindow.remainingMinutes,
    }),
    [volume, deliveryPlan, production, truckCount, weatherRiskLabel, deliveryWindow],
  );

  const goNext = () => setActiveStep((s) => Math.min(s + 1, POUR_PLANNER_STEPS.length - 1));
  const goBack = () => setActiveStep((s) => Math.max(s - 1, 0));
  const goToStep = (index: number) =>
    setActiveStep(Math.max(0, Math.min(index, POUR_PLANNER_STEPS.length - 1)));

  useEffect(() => {
    if (deliveryPlan.volumeYd <= 0) return;

    const cap = deliveryPlan.planningCapacityYd;
    const trucks = deliveryPlan.recommendedTrucks;

    setForm((prev) => {
      const manualTrucks = parseInt(prev.numberOfTrucks, 10);
      const manualCap = parseFloat(prev.truckCapacityYd);
      const next: Partial<PourPlannerFormState> = {};

      if (!Number.isFinite(manualCap) || manualCap <= 0) {
        next.truckCapacityYd = String(cap);
      }

      if (!Number.isFinite(manualTrucks) || manualTrucks <= 0) {
        next.numberOfTrucks = String(trucks);
      } else if (manualTrucks > trucks && trucks > 0) {
        next.numberOfTrucks = String(trucks);
      }

      if (Object.keys(next).length === 0) return prev;
      return { ...prev, ...next };
    });
  }, [deliveryPlan.volumeYd, deliveryPlan.recommendedTrucks, deliveryPlan.planningCapacityYd]);

  return {
    form,
    setForm,
    setField,
    activeStep,
    activeStepId: POUR_PLANNER_STEPS[activeStep].id,
    goNext,
    goBack,
    goToStep,
    projects,
    preferences,
    project,
    calculation,
    volume,
    deliveryPlan,
    production,
    placementRateEstimate,
    effectivePlacementRateYdPerHr,
    truckCount,
    plannedTruckCount,
    truckCapacityYd,
    isShortLoadPour: isShortLoad(deliveryPlan.volumeYd, truckCapacityYd),
    suggestedTruckTypeId: suggestTruckTypeId(deliveryPlan.volumeYd),
    deliveryWindow,
    hotWeather,
    slumpRisk,
    overview,
  };
}

export type PourPlannerContext = ReturnType<typeof usePourPlannerState>;
