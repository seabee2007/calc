import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
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
import { useLocation } from '../hooks/useLocation';
import {
  getExtendedForecast,
  getForecastByQuery,
  ForecastLocation,
} from '../services/weatherService';
import {
  scoreForecastDays,
  PlacementType,
  pruneMitigationSelections,
} from '../utils/pourScoring';
import { useProjectStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import {
  usePourPlannerState,
  POUR_PLANNER_STEPS,
} from '../hooks/usePourPlannerState';

const FORECAST_DAYS = 5;

const PourPlanner: React.FC = () => {
  const { user } = useAuth();
  const { projects, updateProject } = useProjectStore();
  const [location, setLocation] = useState<ForecastLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const {
    requestLocation,
    isLoading: locationLoading,
    permission,
    error: locationError,
  } = useLocation();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [placementType, setPlacementType] = useState<PlacementType | ''>('');
  const [mitigationsByDate, setMitigationsByDate] = useState<Record<string, string[]>>({});
  const [rawForecastDays, setRawForecastDays] = useState<
    (import('../types').ForecastDay & { avgHumidity?: number })[]
  >([]);
  const loadRequestIdRef = useRef(0);

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

  const { calculation, setField } = planner;

  useEffect(() => {
    if (calculation?.psi) {
      setField('psi', calculation.psi);
    }
  }, [calculation?.psi, calculation?.id, setField]);

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

  const loadForecast = useCallback(
    async (opts: { lat?: number; lon?: number; query?: string }) => {
      const requestId = ++loadRequestIdRef.current;
      setLoading(true);
      setError(null);
      setSaveMessage(null);

      let result = null;
      if (opts.query) {
        result = await getForecastByQuery(opts.query, FORECAST_DAYS);
      } else if (opts.lat != null && opts.lon != null) {
        result = await getExtendedForecast(opts.lat, opts.lon, FORECAST_DAYS);
      }

      if (requestId !== loadRequestIdRef.current) return;

      if (!result) {
        setError(
          'Could not load forecast. Check your connection and that WEATHER_API_KEY is set on the edge function.',
        );
        setRawForecastDays([]);
        setLoading(false);
        return;
      }

      setLocation(result.location);
      setRawForecastDays(result.forecast);
      setLoading(false);
    },
    [],
  );

  const handleMitigationsChange = (date: string, ids: string[]) => {
    const day = rawForecastDays.find((d) => d.date === date);
    if (day) {
      const pruned = pruneMitigationSelections(day, ids, placementType || undefined);
      setMitigationsByDate((prev) => ({ ...prev, [date]: pruned }));
      return;
    }
    setMitigationsByDate((prev) => ({ ...prev, [date]: ids }));
  };

  const handleUseMyLocation = async () => {
    setError(null);
    const pos = await requestLocation();
    if (pos) {
      await loadForecast({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    }
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = locationQuery.trim();
    if (!q) return;
    await loadForecast({ query: q });
  };

  const showLocationHelp = permission === 'denied' || Boolean(locationError);

  const handleSavePourDate = async () => {
    if (!selectedDate || !planner.form.projectId || !user) return;
    const isoDate = `${selectedDate}T12:00:00.000Z`;
    try {
      await updateProject(planner.form.projectId, { pourDate: isoDate });
      setSaveMessage(`Pour date saved for ${format(parseISO(selectedDate), 'MMM d, yyyy')}`);
    } catch {
      setError('Failed to save pour date to project.');
    }
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
            location={location}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            loading={loading}
            locationLoading={locationLoading}
            error={error}
            showLocationHelp={showLocationHelp}
            displayDays={displayDays}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            placementType={placementType}
            setPlacementType={setPlacementType}
            mitigationsByDate={mitigationsByDate}
            onMitigationsChange={handleMitigationsChange}
            onUseMyLocation={handleUseMyLocation}
            onLocationSearch={handleLocationSearch}
            onLocationReceived={(lat, lon) => loadForecast({ lat, lon })}
            onLocationError={(msg) => setError(msg)}
          />
        );
      case 'production':
        return <StepPlacementProduction planner={planner} />;
      case 'risk':
        return <StepRiskAnalysis planner={planner} selectedDay={selectedDay} />;
      case 'qc':
        return (
          <StepQcExport
            planner={planner}
            selectedDate={selectedDate}
            selectedDay={selectedDay}
            onSavePourDate={handleSavePourDate}
            saveMessage={saveMessage}
            canSavePourDate={Boolean(user && projects.length > 0 && selectedDate && planner.form.projectId)}
          />
        );
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
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
            'Compare forecast days and override with field temperature readings.'}
          {planner.activeStep === 4 &&
            'Size crew and coordinate truck spacing with placement rate.'}
          {planner.activeStep === 5 &&
            'Review combined risk and recommended mitigations.'}
          {planner.activeStep === 6 &&
            'Record QC data and export the pour plan.'}
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
