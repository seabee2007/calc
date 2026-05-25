import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CloudSun } from 'lucide-react';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PlacementScoringGuide from '../components/weather/PlacementScoringGuide';
import PlacementScoringLink from '../components/weather/PlacementScoringLink';
import PourPlannerStepper from '../components/pour-planner/PourPlannerStepper';
import OverviewSummaryCard from '../components/pour-planner/OverviewSummaryCard';
import StepNavigation from '../components/pour-planner/StepNavigation';
import StepProjectOverview from '../components/pour-planner/steps/StepProjectOverview';
import StepMixSpec from '../components/pour-planner/steps/StepMixSpec';
import StepDeliveryLogistics from '../components/pour-planner/steps/StepDeliveryLogistics';
import StepEnvironmental from '../components/pour-planner/steps/StepEnvironmental';
import StepPlacementProduction from '../components/pour-planner/steps/StepPlacementProduction';
import StepRiskAnalysis from '../components/pour-planner/steps/StepRiskAnalysis';
import StepQcExport from '../components/pour-planner/steps/StepQcExport';
import {
  getForecastByQuery,
  ForecastLocation,
} from '../services/weatherService';
import {
  scoreForecastDays,
  PlacementType,
  pruneMitigationSelections,
} from '../utils/pourScoring';
import {
  usePourPlannerState,
  POUR_PLANNER_STEPS,
} from '../hooks/usePourPlannerState';
import { formatCalculationSlabSize, getCalculationPsi } from '../utils/calculationDimensions';
import { applySelectedPourDayToForm } from '../utils/pourWeatherFields';
import { findBestPourWindow } from '../utils/pourScoring';

const FORECAST_DAYS = 5;

const PourPlanner: React.FC = () => {
  const [location, setLocation] = useState<ForecastLocation | null>(null);
  const [jobsiteLocation, setJobsiteLocation] = useState<ForecastLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [placementType, setPlacementType] = useState<PlacementType | ''>('');
  const [mitigationsByDate, setMitigationsByDate] = useState<Record<string, string[]>>({});
  const [rawForecastDays, setRawForecastDays] = useState<
    (import('../types').ForecastDay & { avgHumidity?: number })[]
  >([]);
  const loadRequestIdRef = useRef(0);
  const weatherFetchKeyRef = useRef('');
  const prevForecastCountRef = useRef(0);
  const stepTopRef = useRef<HTMLHeadingElement>(null);
  const skipInitialScrollRef = useRef(true);

  const displayDays = useMemo(
    () =>
      scoreForecastDays(rawForecastDays, {
        placementType: placementType || undefined,
        mitigationsByDate,
      }),
    [rawForecastDays, placementType, mitigationsByDate],
  );

  const selectedDay = displayDays.find((d) => d.date === selectedDate);
  const planner = usePourPlannerState(selectedDay);

  const { calculation, setField, preferences } = planner;

  useEffect(() => {
    const psi = getCalculationPsi(calculation);
    if (psi) {
      setField('psi', psi);
    } else if (!calculation) {
      setField('psi', preferences.defaultPSI || '3000');
    }
  }, [calculation, preferences.defaultPSI, setField]);

  useEffect(() => {
    if (calculation) {
      const size = formatCalculationSlabSize(calculation, preferences.lengthUnit);
      if (size) setField('slabSize', size);
    } else {
      setField('slabSize', '');
    }
  }, [calculation, preferences.lengthUnit, setField]);

  useEffect(() => {
    if (skipInitialScrollRef.current) {
      skipInitialScrollRef.current = false;
      return;
    }
    stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [planner.activeStep]);

  useEffect(() => {
    if (rawForecastDays.length === 0) return;
    setMitigationsByDate((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      for (const day of rawForecastDays) {
        const ids = next[day.date];
        if (!ids?.length) continue;
        const pruned = pruneMitigationSelections(
          day,
          ids,
          placementType || undefined,
        );
        if (pruned.length !== ids.length) {
          next[day.date] = pruned;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rawForecastDays, placementType]);

  const loadStep4Weather = useCallback(
    async (batchPlantAddress: string, jobsiteAddress: string) => {
      const plant = batchPlantAddress.trim();
      const jobsite = jobsiteAddress.trim();
      const fetchKey = `${plant}|${jobsite}`;

      if (!plant && !jobsite) {
        setRawForecastDays([]);
        setLocation(null);
        setJobsiteLocation(null);
        weatherFetchKeyRef.current = '';
        return;
      }

      if (fetchKey === weatherFetchKeyRef.current) return;

      const requestId = ++loadRequestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const [plantResult, jobsiteResult] = await Promise.all([
          plant ? getForecastByQuery(plant, FORECAST_DAYS) : Promise.resolve(null),
          jobsite ? getForecastByQuery(jobsite, FORECAST_DAYS) : Promise.resolve(null),
        ]);

        if (requestId !== loadRequestIdRef.current) return;

        if (plantResult) {
          setLocation(plantResult.location);
          setRawForecastDays(plantResult.forecast);
        } else if (jobsiteResult) {
          setLocation(jobsiteResult.location);
          setRawForecastDays(jobsiteResult.forecast);
        } else {
          setLocation(null);
          setRawForecastDays([]);
        }

        if (jobsiteResult) {
          setJobsiteLocation(jobsiteResult.location);
        } else {
          setJobsiteLocation(null);
        }

        if (!plantResult && !jobsiteResult) {
          setError(
            'Could not load forecast. Check your connection and that WEATHER_API_KEY is set on the edge function.',
          );
        } else {
          weatherFetchKeyRef.current = fetchKey;
        }
      } catch {
        if (requestId !== loadRequestIdRef.current) return;
        setError('Could not load forecast for the step 1 addresses.');
        setRawForecastDays([]);
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (planner.activeStepId !== 'environment') return;
    loadStep4Weather(planner.form.batchPlantAddress, planner.form.jobsiteAddress);
  }, [
    planner.activeStepId,
    planner.form.batchPlantAddress,
    planner.form.jobsiteAddress,
    loadStep4Weather,
  ]);

  useEffect(() => {
    if (planner.activeStepId !== 'environment') return;
    if (!selectedDay) return;
    applySelectedPourDayToForm(selectedDay, setField);
  }, [planner.activeStepId, selectedDay, setField]);

  useEffect(() => {
    if (planner.activeStepId !== 'environment') return;
    if (rawForecastDays.length === 0) {
      prevForecastCountRef.current = 0;
      return;
    }

    const forecastJustLoaded =
      prevForecastCountRef.current === 0 && rawForecastDays.length > 0;
    prevForecastCountRef.current = rawForecastDays.length;

    if (!forecastJustLoaded || selectedDate) return;

    const bestWindow = findBestPourWindow(displayDays);
    if (bestWindow?.start) {
      setSelectedDate(bestWindow.start);
    }
  }, [
    planner.activeStepId,
    rawForecastDays.length,
    displayDays,
    selectedDate,
  ]);

  const handleMitigationsChange = (date: string, ids: string[]) => {
    const day = rawForecastDays.find((d) => d.date === date);
    if (day) {
      const pruned = pruneMitigationSelections(day, ids, placementType || undefined);
      setMitigationsByDate((prev) => ({ ...prev, [date]: pruned }));
      return;
    }
    setMitigationsByDate((prev) => ({ ...prev, [date]: ids }));
  };

  const stepTitle = POUR_PLANNER_STEPS[planner.activeStep].label;

  const renderStep = () => {
    switch (planner.activeStepId) {
      case 'project':
        return <StepProjectOverview planner={planner} />;
      case 'mix':
        return <StepMixSpec planner={planner} />;
      case 'delivery':
        return <StepDeliveryLogistics planner={planner} />;
      case 'environment':
        return (
          <StepEnvironmental
            planner={planner}
            batchPlantLocation={location}
            jobsiteLocation={jobsiteLocation}
            batchPlantAddress={planner.form.batchPlantAddress}
            jobsiteAddress={planner.form.jobsiteAddress}
            loading={loading}
            error={error}
            displayDays={displayDays}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            placementType={placementType}
            setPlacementType={setPlacementType}
            mitigationsByDate={mitigationsByDate}
            onMitigationsChange={handleMitigationsChange}
          />
        );
      case 'production':
        return <StepPlacementProduction planner={planner} />;
      case 'risk':
        return <StepRiskAnalysis planner={planner} selectedDay={selectedDay} />;
      case 'qc':
        return <StepQcExport planner={planner} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex justify-center mb-3">
          <CloudSun className="h-12 w-12 text-cyan-400 drop-shadow" />
        </div>
        <h1 className="text-3xl font-bold text-white drop-shadow-md">
          Ready-Mix Placement Risk Analyzer
        </h1>
        <p className="text-white/90 mt-2 max-w-2xl mx-auto drop-shadow">
          Plan the pour, check delivery feasibility, evaluate placement risk, and produce a
          field-ready plan — step by step.
        </p>
        <div className="mt-3">
          <PlacementScoringLink onClick={() => setShowScoringModal(true)} />
        </div>
      </motion.div>

      <OverviewSummaryCard planner={planner} />

      <PourPlannerStepper
        activeStep={planner.activeStep}
        onStepClick={planner.goToStep}
      />

      <Card className="p-6 bg-white/95 dark:bg-gray-900/95">
        <h2
          ref={stepTopRef}
          className="text-xl font-semibold text-gray-900 dark:text-white mb-1 scroll-mt-4"
        >
          Step {planner.activeStep + 1}: {stepTitle}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {planner.activeStep === 0 &&
            'Start with project identity, volume, and placement method.'}
          {planner.activeStep === 1 &&
            'Document mix design intent and slump requirements from specs.'}
          {planner.activeStep === 2 &&
            'Check ASTM C94 delivery window against travel and discharge time.'}
          {planner.activeStep === 3 &&
            'Review the batch plant forecast, pick a pour day, and confirm field conditions.'}
          {planner.activeStep === 4 &&
            'Size crew and coordinate truck spacing with placement rate.'}
          {planner.activeStep === 5 &&
            'Review combined risk and recommended mitigations.'}
          {planner.activeStep === 6 &&
            'Record truck ticket and field QC data.'}
        </p>

        {renderStep()}

        <StepNavigation
          activeStep={planner.activeStep}
          totalSteps={POUR_PLANNER_STEPS.length}
          onBack={planner.goBack}
          onNext={planner.goNext}
          nextLabel={
            planner.activeStep === POUR_PLANNER_STEPS.length - 1
              ? 'Done'
              : undefined
          }
        />
      </Card>

      <Modal
        isOpen={showScoringModal}
        onClose={() => setShowScoringModal(false)}
        title="Placement scoring & ACI references"
        size="lg"
      >
        <PlacementScoringGuide />
      </Modal>
    </div>
  );
};

export default PourPlanner;
