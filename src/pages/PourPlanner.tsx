import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  getWorkflowCalculation,
  navigateToProjectDetail,
  type WorkflowLocationState,
} from '../utils/workflow';
import { hydratePourPlannerFromProject } from '../utils/workflowPourHydration';
import { useWorkflowDraftStore } from '../store/workflowDraftStore';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PlacementScoringGuide from '../components/weather/PlacementScoringGuide';
import PlacementScoringLink from '../components/weather/PlacementScoringLink';
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
import {
  placementOrderFromForm,
  applyPlannerPlacementOrderDispatchFields,
} from '../utils/placementOrderForm';
import { syncPlacementPourToSchedule } from '../services/placementScheduleSyncService';
import {
  buildPlacementPourDateIso,
  resolvePlacementDateYmd,
} from '../utils/placementPourDate';
import type { ScheduleWeatherRisk } from '../types/scheduleEvent';
import type { PourRating } from '../utils/pourScoring';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../theme/pageTypography';
import { PREMIUM_PAGE_MAX_WIDTH, PREMIUM_PANEL } from '../theme/appTheme';

function pourRatingToScheduleWeatherRisk(
  rating?: PourRating,
): ScheduleWeatherRisk | null {
  if (!rating) return null;
  if (rating === 'excellent' || rating === 'good') return 'low';
  if (rating === 'fair') return 'medium';
  return 'high';
}

const FORECAST_DAYS = 5;

const PourPlanner: React.FC = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const workflowState = routerLocation.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(routerLocation.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(routerLocation.search, workflowState);

  const { user } = useAuth();
  const { updateProject, projects, setCurrentProject, loadProjects } = useProjectStore();
  const [location, setLocation] = useState<ForecastLocation | null>(null);
  const [jobsiteLocation, setJobsiteLocation] = useState<ForecastLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [savePourDateLoading, setSavePourDateLoading] = useState(false);
  const [savePourDateMessage, setSavePourDateMessage] = useState<string | null>(null);
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
    if (!planner.form.projectId || selectedDate) return;
    const project = projects.find((p) => p.id === planner.form.projectId);
    const ymd = resolvePlacementDateYmd(null, project);
    if (ymd) setSelectedDate(ymd);
  }, [planner.form.projectId, projects, selectedDate]);

  useEffect(() => {
    if (!inWorkflow || !workflowProjectId) return;
    const project = projects.find((p) => p.id === workflowProjectId);
    if (!project) return;

    const calc = getWorkflowCalculation(project, workflowState, routerLocation.search);
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

  const isLastStep = planner.activeStepId === 'risk';
  const resolvedPlacementDateYmd = resolvePlacementDateYmd(
    selectedDate,
    planner.project,
  );
  const canFinish = Boolean(
    user && planner.form.projectId && Boolean(resolvedPlacementDateYmd),
  );

  const savePlacementOrderToProject = async (placementDateYmd: string) => {
    if (!planner.form.projectId) {
      throw new Error('No project selected');
    }

    const pourDateIso = buildPlacementPourDateIso(
      placementDateYmd,
      planner.form.pourStartTime,
    );
    const dayForSummary =
      selectedDay ?? displayDays.find((d) => d.date === placementDateYmd);

    const dispatchNotes =
      planner.form.orderNotes.trim() ||
      planner.project?.placementOrder?.orderNotes?.trim() ||
      '';
    const summaryLines = buildPourOrderCallSheet({
      form:
        dispatchNotes !== planner.form.orderNotes.trim()
          ? { ...planner.form, orderNotes: dispatchNotes }
          : planner.form,
      volumeYd: planner.deliveryPlan.volumeYd,
      truckCount: planner.truckCount,
      truckCapacityYd: planner.truckCapacityYd,
      pourDurationHours: planner.production.placementDurationHours,
      travelTimeMin: parseFloat(planner.form.travelTimeMinutes) || 0,
      travelDistanceMi: parseFloat(planner.form.travelDistance) || 0,
      deliveryStatus: planner.deliveryWindow.statusLabel,
      preferences: planner.preferences,
      selectedDay: dayForSummary,
      projectPourDateIso: pourDateIso,
      hotWeatherRiskLevel: planner.hotWeather.riskLevel,
    });

    const order = applyPlannerPlacementOrderDispatchFields(
      placementOrderFromForm(planner.form, {
        productionEstimate: planner.placementRateEstimate,
        volumeYd: planner.deliveryPlan.volumeYd,
        preserveProduction: planner.project?.placementOrder?.production,
      }),
      planner.project?.placementOrder,
    );
    order.summaryLines = summaryLines;
    order.jobsiteAddress = jobsiteDisplayAddress(planner.form);
    order.pourDateIso = pourDateIso;
    order.pourStartTime = planner.form.pourStartTime.trim() || undefined;

    return { order, pourDateIso };
  };

  const handleFinish = async () => {
    if (!planner.form.projectId || !user) return;
    const placementDateYmd = resolvePlacementDateYmd(selectedDate, planner.project);
    if (!placementDateYmd) {
      setError(
        'Choose a placement day in Step 4 (Weather & conditions) before saving.',
      );
      return;
    }

    setSavePourDateLoading(true);
    setSavePourDateMessage(null);
    setError(null);
    try {
      const { order, pourDateIso } = await savePlacementOrderToProject(placementDateYmd);
      await updateProject(planner.form.projectId, {
        placementOrder: order,
        pourDate: pourDateIso,
      });
      await syncPlacementPourToSchedule({
        projectId: planner.form.projectId,
        projectName: planner.project?.name ?? 'Project',
        pourDateIso,
        userId: user.id,
        location: jobsiteDisplayAddress(planner.form) || null,
        startTime: planner.form.pourStartTime || null,
        weatherRisk: pourRatingToScheduleWeatherRisk(selectedDay?.rating),
        volumeYd: planner.deliveryPlan.volumeYd,
      });
      await loadProjects();
      if (inWorkflow) {
        navigateToProjectDetail(navigate, planner.form.projectId);
        return;
      }
      setSavePourDateMessage(
        'Call sheet and placement date saved. The pour appears on the project planner calendar.',
      );
    } catch (err) {
      console.error('Placement planner save failed:', err);
      setError(
        'Failed to save to project. Confirm placement_order and pour_date columns exist in Supabase.',
      );
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
        return <StepRiskAnalysis planner={planner} selectedDay={selectedDay} />;
      default:
        return null;
    }
  };

  return (
    <div className={`mx-auto space-y-6 pb-12 ${inWorkflow ? PREMIUM_PAGE_MAX_WIDTH : 'max-w-5xl'}`}>
      <WorkflowStepHeader />

      {inWorkflow && (
        <div className="mb-6">
          <h1 className={CC_PAGE_HERO_TITLE}>
            Placement Planner
          </h1>
          <p className={CC_PAGE_HERO_SUBTITLE}>
            Plan delivery, weather, crew production, and field-ready placement details for this project.
          </p>
        </div>
      )}

      <Card
        className={`p-6 ${PREMIUM_PANEL}`}
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
            'Review the batch plant forecast, pick a placement day, and confirm field conditions.'}
          {planner.activeStep === 4 &&
            'Size crew and coordinate truck spacing with placement rate.'}
          {planner.activeStep === 5 &&
            'Review risk, build the call sheet, and save it to your project. Update order status on the project Next actions panel after you call the plant.'}
        </p>

        {savePourDateMessage && isLastStep && !inWorkflow && (
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
          onFinish={isLastStep ? handleFinish : undefined}
          finishDisabled={!canFinish}
          finishLoading={savePourDateLoading}
          finishLabel={
            inWorkflow && isLastStep
              ? 'Save call sheet & return to project'
              : isLastStep
                ? 'Save call sheet to project'
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
