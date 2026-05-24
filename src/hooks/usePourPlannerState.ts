import { useCallback, useMemo, useState } from 'react';
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

  const production = useMemo(
    () =>
      analyzePlacementProduction({
        totalVolumeYd: deliveryPlan.volumeYd,
        placementRateYdPerHr: form.placementRateYdPerHr,
        truckCapacityYd: form.truckCapacityYd || deliveryPlan.planningCapacityYd,
        dischargeRateYdPerHr: form.dischargeRateYdPerHr,
        recommendedTrucks: deliveryPlan.recommendedTrucks,
      }),
    [deliveryPlan, form.placementRateYdPerHr, form.truckCapacityYd, form.dischargeRateYdPerHr],
  );

  const dischargeMin = useMemo(() => {
    const trucks =
      parseInt(form.numberOfTrucks, 10) || production.recommendedTrucks || 1;
  return production.truckDischargeMinutes * trucks;
  }, [form.numberOfTrucks, production]);

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
      truckCount: production.recommendedTrucks,
      pourDurationHours: production.placementDurationHours,
      weatherRisk: weatherRiskLabel,
      deliveryStatus: deliveryWindow.statusLabel,
      timeRemainingMin: deliveryWindow.remainingMinutes,
    }),
    [volume, deliveryPlan, production, weatherRiskLabel, deliveryWindow],
  );

  const goNext = () => setActiveStep((s) => Math.min(s + 1, POUR_PLANNER_STEPS.length - 1));
  const goBack = () => setActiveStep((s) => Math.max(s - 1, 0));
  const goToStep = (index: number) =>
    setActiveStep(Math.max(0, Math.min(index, POUR_PLANNER_STEPS.length - 1)));

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
    deliveryWindow,
    hotWeather,
    slumpRisk,
    overview,
  };
}

export type PourPlannerContext = ReturnType<typeof usePourPlannerState>;
