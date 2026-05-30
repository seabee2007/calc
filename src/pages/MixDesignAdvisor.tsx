import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Beaker, Thermometer, Droplets, Wind, SkipForward, Info, CheckCircle2 } from 'lucide-react';
import StepNavigation from '../components/pour-planner/StepNavigation';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import { useProjectStore } from '../store';
import { useWorkflowDraftStore } from '../store/workflowDraftStore';
import { getCalculationPsi } from '../utils/calculationDimensions';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  getWorkflowCalculation,
  getWorkflowCalculationId,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../utils/workflow';
import {
  buildMixDesignApprovalSnapshot,
  getMixDesignWorkflowContext,
} from '../utils/mixDesignWorkflow';
import {
  formatPlacementCalculationLabel,
  getPlacementCalculations,
  isMixDesignApproved,
} from '../utils/placementCalculations';
import { MIX_DESIGN_PSI_OPTIONS, weatherToMixInputs } from '../utils/mixDesign';
import { buildProfessionalMixRecommendation } from '../utils/mixDesignProfessional';
import type { ProfessionalMixDesignResult } from '../types/mixDesignAdvisor';
import type { MixDesignAdvisorFormState } from '../types/mixDesignAdvisor';
import { copyUSAddress, repairJobsiteAddress } from '../types/address';
import type { Project } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import MixAdvisorWeatherLocation from '../components/mix/MixAdvisorWeatherLocation';
import { type USAddress } from '../types/address';
import { Weather } from '../types';
import AdmixtureCalculator from '../components/mix/AdmixtureCalculator';
import SpecGenerator from '../components/mix/SpecGenerator';
import MixDesignOutputCards from '../components/mix/MixDesignOutputCards';
import { generateMixSpecPDF } from '../utils/pdf';
import {
  DEFAULT_MIX_ADVISOR_FORM,
  MIX_ADVISOR_STEPS,
} from '../constants/mixDesignAdvisorDefaults';
import { isExteriorFlatworkUse } from '../utils/mixDesignProfessional';
import {
  draftHasCustomHaulTime,
  resolveHaulTimeMinutesFromProject,
} from '../utils/mixDesignHaulTime';
import { projectJobsiteLine } from '../utils/projectLocation';
import { getMapboxTravelTime } from '../services/mapboxTravelService';
import { CC_PAGE_SUBTITLE, CC_PAGE_TITLE } from '../theme/pageTypography';

const MIX_DISCLAIMER =
  'Planning-level recommendation only. Final mix design must comply with project specifications, approved submittals, local code, and supplier trial batch data. This is not an engineered stamped mix design.';

function jobsiteFromProject(project: Project | undefined): USAddress | null {
  if (!project?.jobsiteAddress) return null;
  const addr = copyUSAddress(repairJobsiteAddress(project.jobsiteAddress));
  if (!addr.street?.trim() && !addr.city?.trim() && !addr.state?.trim()) {
    return null;
  }
  return addr;
}

function draftHasJobsite(addr: USAddress | undefined): boolean {
  if (!addr) return false;
  return Boolean(
    (addr.street?.trim() || addr.city?.trim()) && addr.state?.trim(),
  );
}

function mergeFormWithDraft(
  draft: Partial<MixDesignAdvisorFormState> | undefined,
): MixDesignAdvisorFormState {
  if (!draft) return { ...DEFAULT_MIX_ADVISOR_FORM };
  return {
    ...DEFAULT_MIX_ADVISOR_FORM,
    ...draft,
    jobsiteAddress: draft.jobsiteAddress
      ? copyUSAddress(draft.jobsiteAddress)
      : DEFAULT_MIX_ADVISOR_FORM.jobsiteAddress,
  };
}

const LargeCheckbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-3 min-h-[48px] py-2 cursor-pointer">
    <input
      type="checkbox"
      className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-base text-gray-800 dark:text-gray-200">{label}</span>
  </label>
);

const MixDesignAdvisor: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, setCurrentProject, updateCalculation } = useProjectStore();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  const [form, setForm] = useState<MixDesignAdvisorFormState>(DEFAULT_MIX_ADVISOR_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<ProfessionalMixDesignResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const getMixDesignDraft = useWorkflowDraftStore((s) => s.getMixDesignDraft);
  const saveMixDesignDraft = useWorkflowDraftStore((s) => s.saveMixDesignDraft);
  const getPourPlannerDraft = useWorkflowDraftStore((s) => s.getPourPlannerDraft);
  const lastHydrationKeyRef = useRef('');
  const haulRouteFetchedRef = useRef('');

  const setField = <K extends keyof MixDesignAdvisorFormState>(
    key: K,
    value: MixDesignAdvisorFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setRecommendation(null);
  };

  const workflowProject = workflowProjectId
    ? projects.find((p) => p.id === workflowProjectId)
    : undefined;

  const placementCalcs = workflowProject
    ? getPlacementCalculations(workflowProject)
    : [];
  const mixContext = workflowProject
    ? getMixDesignWorkflowContext(workflowProject)
    : undefined;

  const urlCalcId = getWorkflowCalculationId(location.search, workflowState);
  const activeCalculationId =
    urlCalcId ??
    mixContext?.nextPendingCalculationId ??
    placementCalcs[0]?.id;

  const activeCalculation = placementCalcs.find((c) => c.id === activeCalculationId);

  useEffect(() => {
    if (workflowProjectId) {
      setCurrentProject(workflowProjectId);
    }
  }, [workflowProjectId, setCurrentProject]);

  const persistMixApproval = useCallback(
    async (rec: ProfessionalMixDesignResult) => {
      if (!workflowProjectId || !activeCalculationId) return;
      const approval = buildMixDesignApprovalSnapshot(form, rec);
      try {
        await updateCalculation(workflowProjectId, activeCalculationId, {
          mixDesignApproval: approval,
        });
      } catch {
        /* non-blocking — draft still saved locally */
      }
    },
    [workflowProjectId, activeCalculationId, form, updateCalculation],
  );

  useEffect(() => {
    if (!workflowProjectId) return;
    const project = projects.find((p) => p.id === workflowProjectId);
    const draft = getMixDesignDraft(workflowProjectId, activeCalculationId);
    const projectAddr = jobsiteFromProject(project);
    const workflowCalc = getWorkflowCalculation(
      project,
      workflowState,
      location.search,
    );
    const psiFromCalc = getCalculationPsi(workflowCalc);
    const pourDraft = getPourPlannerDraft(workflowProjectId);
    const resolvedHaul = resolveHaulTimeMinutesFromProject(project, pourDraft?.form);
    const haulKey = resolvedHaul ?? '';
    const key = `project:${workflowProjectId}:${activeCalculationId ?? ''}:${project?.updatedAt ?? ''}:${project?.placementOrder?.updatedAt ?? ''}:${workflowCalc?.id ?? ''}:${psiFromCalc ?? ''}:${haulKey}`;
    if (lastHydrationKeyRef.current === key) return;
    if (!project) return;

    let next = mergeFormWithDraft(draft ?? undefined);
    if (draft && draftHasJobsite(draft.jobsiteAddress)) {
      next = { ...next, jobsiteAddress: copyUSAddress(draft.jobsiteAddress) };
    } else if (projectAddr) {
      next = { ...next, jobsiteAddress: projectAddr };
    }
    if (psiFromCalc) next = { ...next, selectedPsi: psiFromCalc };
    if (resolvedHaul && !draftHasCustomHaulTime(draft?.haulTimeMinutes)) {
      next = { ...next, haulTimeMinutes: resolvedHaul };
    }
    if (isExteriorFlatworkUse(next.projectUse)) {
      next = { ...next, airEntrainmentRequired: true };
    }
    setForm(next);
    setRecommendation(null);
    lastHydrationKeyRef.current = key;
  }, [
    workflowProjectId,
    activeCalculationId,
    projects,
    getMixDesignDraft,
    getPourPlannerDraft,
    workflowState,
    location.search,
  ]);

  useEffect(() => {
    if (!workflowProjectId) return;
    const project = projects.find((p) => p.id === workflowProjectId);
    const mixDraft = getMixDesignDraft(workflowProjectId, activeCalculationId);
    if (draftHasCustomHaulTime(mixDraft?.haulTimeMinutes)) return;

    const pourDraft = getPourPlannerDraft(workflowProjectId);
    const syncHaul = resolveHaulTimeMinutesFromProject(project, pourDraft?.form);
    if (syncHaul) return;

    const plantAddress = project?.placementOrder?.batchPlantAddress?.trim();
    const jobsiteLine = projectJobsiteLine(project);
    if (!plantAddress || !jobsiteLine) return;

    const routeKey = `${workflowProjectId}:${plantAddress}:${jobsiteLine}`;
    if (haulRouteFetchedRef.current === routeKey) return;
    haulRouteFetchedRef.current = routeKey;

    let cancelled = false;
    void getMapboxTravelTime(plantAddress, jobsiteLine)
      .then((route) => {
        if (cancelled) return;
        const minutes = String(Math.round(route.travelMinutes));
        setForm((prev) => {
          if (draftHasCustomHaulTime(prev.haulTimeMinutes)) return prev;
          return { ...prev, haulTimeMinutes: minutes };
        });
      })
      .catch(() => {
        /* keep default or prior value */
      });

    return () => {
      cancelled = true;
    };
  }, [workflowProjectId, activeCalculationId, projects, getMixDesignDraft, getPourPlannerDraft]);

  useEffect(() => {
    if (!workflowProjectId) return;
    saveMixDesignDraft(workflowProjectId, activeCalculationId, form);
  }, [workflowProjectId, activeCalculationId, form, saveMixDesignDraft]);

  const workflowCalc = workflowProject
    ? getWorkflowCalculation(workflowProject, workflowState, location.search)
    : undefined;
  const psiFromWorkflowCalc = getCalculationPsi(workflowCalc);

  const goToPlacementPlanner = () => {
    if (!workflowProjectId) return;
    navigate(
      {
        pathname: '/pour-planner',
        search: workflowQuery(workflowProjectId, activeCalculationId),
      },
      {
        state: workflowNavigateState(workflowProjectId, {
          calculationId: activeCalculationId ?? workflowCalc?.id,
        }),
      },
    );
  };

  const switchPlacement = (calculationId: string) => {
    if (!workflowProjectId) return;
    navigate(
      {
        pathname: '/mix-design-advisor',
        search: workflowQuery(workflowProjectId, calculationId),
      },
      { state: workflowNavigateState(workflowProjectId, { calculationId }) },
    );
    setStepIndex(0);
    setRecommendation(null);
    lastHydrationKeyRef.current = '';
  };

  const generateRecommendation = useCallback(
    (weatherData: Weather): ProfessionalMixDesignResult => {
      const { tempF, humidityPercent, windMph } = weatherToMixInputs(
        weatherData.temperature,
        weatherData.humidity,
        weatherData.windSpeed,
      );
      return buildProfessionalMixRecommendation({
        form,
        tempF,
        humidityPercent,
        windMph,
      });
    },
    [form],
  );

  const applyWeatherData = useCallback(
    (weatherData: Weather) => {
      setWeather(weatherData);
      setLocationError(null);
    },
    [],
  );

  useEffect(() => {
    if (!weather || stepIndex < MIX_ADVISOR_STEPS.length - 1) return;
    setRecommendation(generateRecommendation(weather));
  }, [weather, form, stepIndex, generateRecommendation]);

  const handleGenerate = async () => {
    if (!weather) {
      setLocationError('Load jobsite weather before generating a recommendation.');
      setStepIndex(3);
      return;
    }
    const rec = generateRecommendation(weather);
    setRecommendation(rec);
    setStepIndex(MIX_ADVISOR_STEPS.length - 1);
    await persistMixApproval(rec);
  };

  const formatTemperature = (temp: number) =>
    form.unitSystem === 'metric'
      ? `${(((temp - 32) * 5) / 9).toFixed(1)}°C`
      : `${temp}°F`;

  const formatWindSpeed = (speed: number) =>
    form.unitSystem === 'metric'
      ? `${(speed * 1.60934).toFixed(1)} km/h`
      : `${speed} mph`;

  const aeDosageRange = () => {
    if (!recommendation) return [0.5, 1.0];
    return [0.5, 1.0].map((d) => d * recommendation.aeFactor);
  };

  const recommendedTargetAir = recommendation
    ? (recommendation.targetAir[0] + recommendation.targetAir[1]) / 2
    : undefined;

  const handleDownloadSpec = async () => {
    if (!recommendation) return;
    try {
      await generateMixSpecPDF(
        form.selectedPsi,
        recommendation.targetAir,
        recommendation.waterCementRatio,
        recommendation.admixtureRecommendations.slice(0, 5),
      );
    } catch {
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const step = MIX_ADVISOR_STEPS[stepIndex];
  const totalSteps = MIX_ADVISOR_STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const weatherStepIndex = MIX_ADVISOR_STEPS.findIndex((s) => s.id === 'weather');
  const isWeatherStep = stepIndex === weatherStepIndex;

  const goNext = () => {
    if (isWeatherStep) {
      handleGenerate();
      return;
    }
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
  };

  const renderStep = () => {
    switch (step.id) {
      case 'project':
        return (
          <div className="space-y-4">
            <Select
              label="Project use"
              value={form.projectUse}
              onChange={(v) => {
                setField('projectUse', v as MixDesignAdvisorFormState['projectUse']);
                if (isExteriorFlatworkUse(v as MixDesignAdvisorFormState['projectUse'])) {
                  setField('airEntrainmentRequired', true);
                }
              }}
              options={[
                { value: 'slab_on_grade', label: 'Slab on grade' },
                { value: 'driveway', label: 'Driveway' },
                { value: 'sidewalk', label: 'Sidewalk' },
                { value: 'footing', label: 'Footing' },
                { value: 'wall', label: 'Wall' },
                { value: 'curb_gutter', label: 'Curb / gutter' },
                { value: 'structural_slab', label: 'Structural slab' },
                { value: 'exterior_flatwork', label: 'Exterior flatwork' },
                { value: 'marine_coastal', label: 'Marine / coastal' },
              ]}
            />
            <Select
              label="Design PSI"
              value={form.selectedPsi}
              onChange={(v) => setField('selectedPsi', v)}
              options={MIX_DESIGN_PSI_OPTIONS.map((o) => ({
                value: o.value,
                label: form.unitSystem === 'metric' ? o.labelMetric : o.labelImperial,
              }))}
            />
            {psiFromWorkflowCalc && (
              <p className="text-xs text-cyan-800 dark:text-cyan-300">
                Imported from calculator: {psiFromWorkflowCalc} PSI
              </p>
            )}
            <Select
              label="Exposure class (freeze-thaw)"
              value={form.exposure}
              onChange={(v) => setField('exposure', v as MixDesignAdvisorFormState['exposure'])}
              options={[
                { value: 'none', label: 'None' },
                { value: 'F1', label: 'F1 — Moderate' },
                { value: 'F2', label: 'F2 — Severe' },
                { value: 'F3', label: 'F3 — Very severe' },
              ]}
            />
            <Input
              label="Slump target (in)"
              type="number"
              min="2"
              max="8"
              step="0.5"
              value={form.slumpTargetIn}
              onChange={(e) => setField('slumpTargetIn', e.target.value)}
            />
            <Select
              label="Max aggregate size"
              value={form.maxAggregateIn}
              onChange={(v) => setField('maxAggregateIn', v)}
              options={[
                { value: '0.75', label: '3/4 in (#57)' },
                { value: '1', label: '1 in' },
                { value: '1.5', label: '1-1/2 in' },
              ]}
            />
            <LargeCheckbox
              label="Air entrainment required"
              checked={form.airEntrainmentRequired}
              onChange={(v) => setField('airEntrainmentRequired', v)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Units"
                value={form.unitSystem}
                onChange={(v) => setField('unitSystem', v as 'imperial' | 'metric')}
                options={[
                  { value: 'imperial', label: 'Imperial' },
                  { value: 'metric', label: 'Metric' },
                ]}
              />
              <Select
                label="Climate"
                value={form.climate}
                onChange={(v) => setField('climate', v as MixDesignAdvisorFormState['climate'])}
                options={[
                  { value: 'temperate', label: 'Temperate' },
                  { value: 'tropical', label: 'Tropical' },
                ]}
              />
            </div>
          </div>
        );

      case 'placement':
        return (
          <div className="space-y-4">
            <Select
              label="Placement method"
              value={form.placementMethod}
              onChange={(v) => {
                const method = v as MixDesignAdvisorFormState['placementMethod'];
                setForm((prev) => ({
                  ...prev,
                  placementMethod: method,
                  pumpRequired: method === 'pump' ? true : prev.pumpRequired,
                }));
                setRecommendation(null);
              }}
              options={[
                { value: 'chute', label: 'Chute' },
                { value: 'pump', label: 'Pump' },
                { value: 'buggy', label: 'Buggy' },
                { value: 'wheelbarrow', label: 'Wheelbarrow' },
                { value: 'conveyor', label: 'Conveyor' },
              ]}
            />
            <Select
              label="Finish type"
              value={form.finishType}
              onChange={(v) => setField('finishType', v as MixDesignAdvisorFormState['finishType'])}
              options={[
                { value: 'broom', label: 'Broom' },
                { value: 'hard_trowel', label: 'Hard trowel' },
                { value: 'burnished', label: 'Burnished' },
                { value: 'stamp', label: 'Stamp' },
                { value: 'exposed_aggregate', label: 'Exposed aggregate' },
              ]}
            />
            <LargeCheckbox
              label="Pump required"
              checked={form.pumpRequired}
              onChange={(v) => setField('pumpRequired', v)}
            />
            <Input
              label="Haul time (minutes)"
              type="number"
              min="0"
              step="15"
              value={form.haulTimeMinutes}
              onChange={(e) => setField('haulTimeMinutes', e.target.value)}
            />
          </div>
        );

      case 'materials':
        return (
          <div className="space-y-4">
            <Select
              label="Cement type"
              value={form.cementType}
              onChange={(v) => setField('cementType', v as MixDesignAdvisorFormState['cementType'])}
              options={[
                { value: 'type_i', label: 'Type I — General' },
                { value: 'type_ii', label: 'Type II — Moderate sulfate' },
                { value: 'type_iii', label: 'Type III — High early' },
                { value: 'type_v', label: 'Type V — Sulfate resistant' },
              ]}
            />
            <Select
              label="SCM option"
              value={form.scmOption}
              onChange={(v) => setField('scmOption', v as MixDesignAdvisorFormState['scmOption'])}
              options={[
                { value: 'none', label: 'None' },
                { value: 'fly_ash', label: 'Fly ash' },
                { value: 'slag', label: 'Slag' },
                { value: 'silica_fume', label: 'Silica fume' },
                { value: 'fly_ash_slag', label: 'Fly ash + slag' },
              ]}
            />
            <LargeCheckbox
              label="Chloride / deicing exposure"
              checked={form.chlorideExposure}
              onChange={(v) => setField('chlorideExposure', v)}
            />
            <LargeCheckbox
              label="Sulfate exposure"
              checked={form.sulfateExposure}
              onChange={(v) => {
                setField('sulfateExposure', v);
                if (v) setField('cementType', 'type_v');
              }}
            />
            <LargeCheckbox
              label="Freeze-thaw exposure"
              checked={form.freezeThawExposure}
              onChange={(v) => setField('freezeThawExposure', v)}
            />
          </div>
        );

      case 'weather':
        return (
          <div className="space-y-4">
            <MixAdvisorWeatherLocation
              value={form.jobsiteAddress}
              onChange={(addr) => setField('jobsiteAddress', addr)}
              projects={projects}
              workflowProject={workflowProject}
              weather={weather}
              loading={loading}
              locationError={locationError}
              onWeatherLoaded={applyWeatherData}
              onError={setLocationError}
              onLoadingChange={setLoading}
            />
            {weather && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/40 p-3 rounded-lg">
                  <Thermometer className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatTemperature(weather.temperature)}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/40 p-3 rounded-lg">
                  <Droplets className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {weather.humidity}% RH
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/40 p-3 rounded-lg col-span-2">
                  <Wind className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatWindSpeed(weather.windSpeed)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {weather.location.city}, {weather.location.country}
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'results':
        return recommendation && weather ? (
          <div className="space-y-6">
            <MixDesignOutputCards
              result={recommendation}
              selectedPsi={form.selectedPsi}
            />
            <div className="grid grid-cols-1 gap-4">
              <AdmixtureCalculator
                temperature={weather.temperature}
                unitsImperial={form.unitSystem === 'imperial'}
                recommendedTargetAir={recommendedTargetAir}
              />
              <SpecGenerator
                psi={form.selectedPsi}
                airContent={recommendation.targetAir}
                waterCementRatio={recommendation.waterCementRatio}
                admixtures={recommendation.admixtureRecommendations.slice(0, 4)}
                onDownload={handleDownloadSpec}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generate a recommendation after loading weather on the previous step.
          </p>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <WorkflowStepHeader />

        {workflowProjectId && placementCalcs.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-cyan-400/90 mb-2 font-medium">
              Placements on this project
            </p>
            <div className="flex flex-col gap-2">
              {placementCalcs.map((calc, idx) => {
                const approved = isMixDesignApproved(calc);
                const active = calc.id === activeCalculationId;
                return (
                  <button
                    key={calc.id}
                    type="button"
                    onClick={() => switchPlacement(calc.id)}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-cyan-600/25 text-cyan-100 ring-1 ring-cyan-500/50'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">
                      {formatPlacementCalculationLabel(calc, idx)}
                    </span>
                    {approved ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] uppercase text-amber-400/90 shrink-0">
                        Pending
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {mixContext && mixContext.totalPlacements > 1 && (
              <p className="text-xs text-slate-400 mt-2">
                {mixContext.approvedCount} of {mixContext.totalPlacements} mix designs approved
              </p>
            )}
          </div>
        )}

        {inWorkflow && (
          <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={goToPlacementPlanner}
              icon={<SkipForward size={18} />}
              className="dark:text-white dark:border-slate-600"
            >
              Skip to placement planner
            </Button>
          </div>
        )}

        <div className="mb-6">
          <h1 className={`${CC_PAGE_TITLE} flex items-center gap-2`}>
            <Beaker className="h-8 w-8" />
            Mix Design Advisor
          </h1>
          <p className={`${CC_PAGE_SUBTITLE} mt-2`}>
            Field placement and submittal planning — strength, durability, and weather
          </p>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto pb-1 scrollbar-hide rounded-lg bg-white/90 dark:bg-gray-800 backdrop-blur-sm p-2 shadow-lg border border-slate-200/80 dark:border-gray-700">
          {MIX_ADVISOR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(i)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium min-h-[40px] transition-colors ${
                i === stepIndex
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>

        <Card
          className={`p-4 sm:p-6 ${
            inWorkflow
              ? 'bg-white/90 dark:bg-gray-800 backdrop-blur-sm shadow-lg border border-slate-200/80 dark:border-gray-700'
              : ''
          }`}
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            {step.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Step {stepIndex + 1} of {totalSteps}
            {isWeatherStep && ' — load and verify jobsite weather before generating.'}
          </p>

          {renderStep()}

          <p className="mt-6 mb-4 flex gap-2 items-start text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
            {MIX_DISCLAIMER}
          </p>

          <StepNavigation
            activeStep={stepIndex}
            totalSteps={totalSteps}
            onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
            onNext={goNext}
            nextLabel={isWeatherStep ? 'Generate recommendation' : 'Continue'}
            nextDisabled={isWeatherStep && !weather}
            onFinish={
              inWorkflow && recommendation
                ? async () => {
                    await persistMixApproval(recommendation);
                    const freshProject = useProjectStore
                      .getState()
                      .projects.find((p) => p.id === workflowProjectId);
                    const ctx = freshProject
                      ? getMixDesignWorkflowContext(freshProject)
                      : undefined;
                    if (ctx?.nextPendingCalculationId) {
                      switchPlacement(ctx.nextPendingCalculationId);
                      return;
                    }
                    goToPlacementPlanner();
                  }
                : undefined
            }
            finishLabel={
              mixContext && mixContext.pendingCount > 1 && recommendation
                ? 'Approve & next placement'
                : 'Continue to placement planner'
            }
            finishDisabled={!recommendation}
          />
        </Card>
      </div>
    </motion.div>
  );
};

export default MixDesignAdvisor;
