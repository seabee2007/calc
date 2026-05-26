import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { CloudSun } from 'lucide-react';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  getWorkflowCalculation,
  type WorkflowLocationState,
} from '../utils/workflow';
import { hydratePourPlannerFromProject } from '../utils/workflowPourHydration';
import { useWorkflowDraftStore } from '../store/workflowDraftStore';
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
import StepRiskAnalysis from '../components/pour-planner/steps/StepRiskAnalysis';
import {
  getForecastByQuery,
  getExtendedForecast,
  ForecastLocation,
} from '../services/weatherService';
import {
  scoreForecastDays,
  PlacementType,
  pruneMitigationSelections,
} from '../utils/pourScoring';
import {
  jobsiteDisplayAddress,
  parsePlannerCoord,
} from '../utils/addressForm';
import { useProjectStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import {
  usePourPlannerState,
  POUR_PLANNER_STEPS,
} from '../hooks/usePourPlannerState';
import { formatCalculationSlabSize, getCalculationPsi } from '../utils/calculationDimensions';
import { applySelectedPourDayToForm } from '../utils/pourWeatherFields';
import { findBestPourWindow } from '../utils/pourScoring';
import { buildPourOrderCallSheet } from '../utils/pourOrderSummary';
import { placementOrderFromForm } from '../utils/placementOrderForm';

const FORECAST_DAYS = 5;

const PourPlanner: React.FC = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const workflowState = routerLocation.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(routerLocation.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(routerLocation.search, workflowState);

  const { user } = useAuth();
  const { updateProject, projects, setCurrentProject } = useProjectStore();
  const [location, setLocation] = useState<ForecastLocation | null>(null);
  const [jobsiteLocation, setJobsiteLocation] = useState<ForecastLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [savePourDateLoading, setSavePourDateLoading] = useState(false);
  const [savePourDateMessage, setSavePourDateMessage] = useState<string | null>(null);
  const [saveOrderLoading, setSaveOrderLoading] = useState(false);
  const [saveOrderMessage, setSaveOrderMessage] = useState<string | null>(null);
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
  const planner = usePourPlannerState(selectedDay, {
    workflowProjectId: inWorkflow ? workflowProjectId : undefined,
  });
  const getPourPlannerDraft = useWorkflowDraftStore((s) => s.getPourPlannerDraft);
  const workflowHydrationKeyRef = useRef('');

  const { calculation, setField, preferences, setForm } = planner;

  useEffect(() => {
    if (inWorkflow && workflowProjectId) {
      setCurrentProject(workflowProjectId);
    }
  }, [inWorkflow, workflowProjectId, setCurrentProject]);

  useEffect(() => {
    if (!inWorkflow || !workflowProjectId) return;
    const project = projects.find((p) => p.id === workflowProjectId);
    if (!project) return;

    const calc = getWorkflowCalculation(project, workflowState);
    const hydrationKey = `${workflowProjectId}:${calc?.id ?? ''}:${project.updatedAt}`;
    if (workflowHydrationKeyRef.current === hydrationKey) return;

    const patch = hydratePourPlannerFromProject(project, calc);
    const draft = getPourPlannerDraft(workflowProjectId);

    setForm((prev) => {
      const merged = {
        ...prev,
        ...(draft?.form ?? {}),
        ...patch,
        projectId: workflowProjectId,
        projectName: project.name,
        calculationId: calc?.id ?? patch.calculationId ?? prev.calculationId,
      };
      if (patch.psi) merged.psi = patch.psi;
      if (patch.slabSize) merged.slabSize = patch.slabSize;
      if (patch.placementAreaType) merged.placementAreaType = patch.placementAreaType;
      if (patch.slabThicknessIn) merged.slabThicknessIn = patch.slabThicknessIn;
      return merged;
    });

    workflowHydrationKeyRef.current = hydrationKey;
  }, [
    inWorkflow,
    workflowProjectId,
    workflowState?.calculationId,
    projects,
    getPourPlannerDraft,
    setForm,
  ]);

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
    async (
      batchPlantAddress: string,
      jobsiteAddress: string,
      jobsiteCoords?: { lat: number; lng: number },
      plantCoords?: { lat: number; lng: number },
    ) => {
      const plant = batchPlantAddress.trim();
      const jobsite = jobsiteAddress.trim();
      const fetchKey = `${plant}|${jobsite}|${jobsiteCoords?.lat ?? ''}|${jobsiteCoords?.lng ?? ''}`;

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
          plantCoords
            ? getExtendedForecast(plantCoords.lat, plantCoords.lng, FORECAST_DAYS)
            : plant
              ? getForecastByQuery(plant, FORECAST_DAYS)
              : Promise.resolve(null),
          jobsiteCoords
            ? getExtendedForecast(jobsiteCoords.lat, jobsiteCoords.lng, FORECAST_DAYS)
            : jobsite
              ? getForecastByQuery(jobsite, FORECAST_DAYS)
              : Promise.resolve(null),
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
    const jobsiteLine = jobsiteDisplayAddress(planner.form);
    const jobsiteLat = parsePlannerCoord(planner.form.jobsiteLatitude);
    const jobsiteLng = parsePlannerCoord(planner.form.jobsiteLongitude);
    const plantLat = parsePlannerCoord(planner.form.batchPlantLatitude);
    const plantLng = parsePlannerCoord(planner.form.batchPlantLongitude);

    loadStep4Weather(
      planner.form.batchPlantAddress,
      jobsiteLine,
      jobsiteLat != null && jobsiteLng != null
        ? { lat: jobsiteLat, lng: jobsiteLng }
        : undefined,
      plantLat != null && plantLng != null
        ? { lat: plantLat, lng: plantLng }
        : undefined,
    );
  }, [
    planner.activeStepId,
    planner.form.batchPlantAddress,
    planner.form.batchPlantLatitude,
    planner.form.batchPlantLongitude,
    planner.form.jobsiteAddress,
    planner.form.jobsiteLatitude,
    planner.form.jobsiteLongitude,
    planner.form.jobsiteStreet,
    planner.form.jobsiteCity,
    planner.form.jobsiteState,
    planner.form.jobsiteZip,
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

  const canSavePlacementDate = Boolean(
    user && planner.form.projectId && selectedDate,
  );

  const canSaveToProject = Boolean(user && planner.form.projectId);

  const handleSavePlacementOrder = async () => {
    if (!planner.form.projectId) return;
    setSaveOrderLoading(true);
    setSaveOrderMessage(null);
    setError(null);

    const summaryLines = buildPourOrderCallSheet({
      form: planner.form,
      volumeYd: planner.deliveryPlan.volumeYd,
      truckCount: planner.truckCount,
      truckCapacityYd: planner.truckCapacityYd,
      pourDurationHours: planner.production.placementDurationHours,
      travelTimeMin: parseFloat(planner.form.travelTimeMinutes) || 0,
      travelDistanceMi: parseFloat(planner.form.travelDistance) || 0,
      deliveryStatus: planner.deliveryWindow.statusLabel,
      preferences: planner.preferences,
      selectedDay,
      projectPourDateIso: planner.project?.pourDate,
      hotWeatherRiskLevel: planner.hotWeather.riskLevel,
    });

    const order = placementOrderFromForm(planner.form, {
      productionEstimate: planner.placementRateEstimate,
      volumeYd: planner.deliveryPlan.volumeYd,
      preserveProduction: planner.project?.placementOrder?.production,
    });
    order.summaryLines = summaryLines;
    order.jobsiteAddress = jobsiteDisplayAddress(planner.form);
    order.pourDateIso = selectedDate
      ? `${selectedDate}T12:00:00.000Z`
      : planner.project?.pourDate;

    try {
      await updateProject(planner.form.projectId, { placementOrder: order });
      setSaveOrderMessage('Order saved to project.');
    } catch {
      setError('Failed to save order to project. Run DB migration if placement_order column is missing.');
    } finally {
      setSaveOrderLoading(false);
    }
  };

  const handleSavePlacementDate = async () => {
    if (!selectedDate || !planner.form.projectId) return;
    setSavePourDateLoading(true);
    setSavePourDateMessage(null);
    setError(null);
    const isoDate = `${selectedDate}T12:00:00.000Z`;
    try {
      if (inWorkflow && planner.activeStepId === 'risk') {
        await handleSavePlacementOrder();
      }
      await updateProject(planner.form.projectId, { pourDate: isoDate });
      setSavePourDateMessage('Placement date saved to project.');
      if (inWorkflow) {
        navigate('/');
      }
    } catch {
      setError('Failed to save placement date to project.');
    } finally {
      setSavePourDateLoading(false);
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
            batchPlantLocation={location}
            jobsiteLocation={jobsiteLocation}
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
      case 'risk':
        return (
          <StepRiskAnalysis
            planner={planner}
            selectedDay={selectedDay}
            canSaveToProject={canSaveToProject}
            onSaveOrder={handleSavePlacementOrder}
            saveOrderLoading={saveOrderLoading}
            saveOrderMessage={saveOrderMessage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`mx-auto space-y-6 pb-12 ${inWorkflow ? 'max-w-6xl' : 'max-w-5xl'}`}>
      <WorkflowStepHeader />
      {!inWorkflow && (
        <>
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
        </>
      )}

      {inWorkflow && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Placement Planner
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Plan delivery, weather, crew production, and field-ready pour details for this project.
          </p>
        </div>
      )}

      <Card
        className={`p-6 ${
          inWorkflow
            ? 'bg-white/90 dark:bg-gray-800 backdrop-blur-sm shadow-lg'
            : 'bg-white/95 dark:bg-gray-900/95'
        }`}
      >
        <h2
          ref={stepTopRef}
          className="text-xl font-semibold text-gray-900 dark:text-white mb-1 scroll-mt-4"
        >
          {inWorkflow ? stepTitle : `Step ${planner.activeStep + 1}: ${stepTitle}`}
        </h2>
        {inWorkflow && planner.activeStep === 3 && (
          <div className="mb-4">
            <PlacementScoringLink onClick={() => setShowScoringModal(true)} />
          </div>
        )}
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
            'Review risk, order ready-mix using the compiled call sheet, then save placement date and order status to your project.'}
        </p>

        {savePourDateMessage && planner.activeStep === POUR_PLANNER_STEPS.length - 1 && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-4">
            {savePourDateMessage}
          </p>
        )}

        {renderStep()}

        <StepNavigation
          activeStep={planner.activeStep}
          totalSteps={POUR_PLANNER_STEPS.length}
          onBack={planner.goBack}
          onNext={planner.goNext}
          onFinish={handleSavePlacementDate}
          finishDisabled={!canSavePlacementDate}
          finishLoading={savePourDateLoading}
          finishLabel={
            inWorkflow
              ? 'Save call sheet & return to dashboard'
              : 'Save placement date'
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
