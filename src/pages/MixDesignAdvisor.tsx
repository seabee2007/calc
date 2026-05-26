import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Beaker, Thermometer, Droplets, Wind, AlertTriangle, Info, MapPin, Scale, Clock, CheckCircle, XCircle, Search, CloudSun, SkipForward } from 'lucide-react';
import WorkflowStepHeader from '../components/workflow/WorkflowStepHeader';
import { useProjectStore } from '../store';
import { useWorkflowDraftStore } from '../store/workflowDraftStore';
import { getCalculationPsi } from '../utils/calculationDimensions';
import {
  isWorkflowActive,
  getWorkflowProjectId,
  getWorkflowCalculation,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../utils/workflow';
import {
  MIX_DESIGN_PSI_OPTIONS,
  getEvaporationRiskLevel,
  parseMixDesignPsi,
  suggestConcreteParameters,
  weatherToMixInputs,
  type MixDesignRecommendation,
  type MixExposure,
} from '../utils/mixDesign';
import {
  copyUSAddress,
  formatUSAddress,
  hasProjectJobsite,
  repairJobsiteAddress,
} from '../types/address';
import type { Project } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { getWeatherByLocation, getWeatherByQuery } from '../services/weatherService';
import { geocodeAddress } from '../utils/location';
import USAddressFields from '../components/address/USAddressFields';
import {
  EMPTY_US_ADDRESS,
  isUSAddressGeocodable,
  validateUSAddress,
  type USAddress,
} from '../types/address';
import { Weather } from '../types';
import AdmixtureCalculator from '../components/mix/AdmixtureCalculator';
import SpecGenerator from '../components/mix/SpecGenerator';
import { generateMixSpecPDF } from '../utils/pdf';

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

/** Compact city/state query — WeatherAPI handles this better than full street lines. */
function weatherQueryFromJobsite(addr: USAddress): string {
  const city = addr.city.trim();
  const state = addr.state.trim();
  const zip = addr.zip.trim();
  if (city && state) {
    return zip ? `${city}, ${state} ${zip}` : `${city}, ${state}`;
  }
  return formatUSAddress(addr);
}

const MixDesignAdvisor: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, setCurrentProject } = useProjectStore();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<string>('3000');
  const [exposure, setExposure] = useState<MixExposure>('F1');
  const [recommendation, setRecommendation] = useState<MixDesignRecommendation | null>(null);
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial');
  const [climate, setClimate] = useState<'temperate' | 'tropical'>('temperate');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [jobsiteAddress, setJobsiteAddress] = useState<USAddress>({ ...EMPTY_US_ADDRESS });
  const getMixDesignDraft = useWorkflowDraftStore((s) => s.getMixDesignDraft);
  const saveMixDesignDraft = useWorkflowDraftStore((s) => s.saveMixDesignDraft);
  const lastHydrationKeyRef = useRef('');
  const weatherAutoKeyRef = useRef('');

  const workflowProject = workflowProjectId
    ? projects.find((p) => p.id === workflowProjectId)
    : undefined;

  useEffect(() => {
    if (inWorkflow && workflowProjectId) {
      setCurrentProject(workflowProjectId);
    }
  }, [inWorkflow, workflowProjectId, setCurrentProject]);

  useEffect(() => {
    if (!workflowProjectId) return;

    const project = projects.find((p) => p.id === workflowProjectId);
    const draft = getMixDesignDraft(workflowProjectId);
    const projectAddr = jobsiteFromProject(project);
    const workflowCalc = getWorkflowCalculation(project, workflowState);
    const psiFromCalc = getCalculationPsi(workflowCalc);

    const key = `project:${workflowProjectId}:${project?.updatedAt ?? ''}:${workflowCalc?.id ?? ''}:${psiFromCalc ?? ''}`;
    if (lastHydrationKeyRef.current === key) return;

    if (!project) return;

    if (draft && draftHasJobsite(draft.jobsiteAddress)) {
      setJobsiteAddress(copyUSAddress(draft.jobsiteAddress));
      setExposure(draft.exposure);
      setUnitSystem(draft.unitSystem);
      setClimate(draft.climate);
      if (!psiFromCalc) setSelectedPsi(draft.selectedPsi);
    } else if (projectAddr) {
      setJobsiteAddress(projectAddr);
      if (draft) {
        setExposure(draft.exposure);
        setUnitSystem(draft.unitSystem);
        setClimate(draft.climate);
      }
    }

    if (psiFromCalc) setSelectedPsi(psiFromCalc);

    lastHydrationKeyRef.current = key;
  }, [workflowProjectId, projects, getMixDesignDraft, workflowState]);

  const projectJobsiteImported =
    inWorkflow &&
    workflowProject &&
    hasProjectJobsite(jobsiteAddress) &&
    hasProjectJobsite(workflowProject.jobsiteAddress);

  useEffect(() => {
    if (!inWorkflow || !workflowProjectId) return;
    saveMixDesignDraft(workflowProjectId, {
      selectedPsi,
      exposure,
      unitSystem,
      climate,
      jobsiteAddress,
    });
  }, [
    inWorkflow,
    workflowProjectId,
    selectedPsi,
    exposure,
    unitSystem,
    climate,
    jobsiteAddress,
    saveMixDesignDraft,
  ]);

  const workflowCalc = workflowProject
    ? getWorkflowCalculation(workflowProject, workflowState)
    : undefined;
  const psiFromWorkflowCalc = getCalculationPsi(workflowCalc);

  const goToPlacementPlanner = () => {
    if (!workflowProjectId) return;
    navigate(
      { pathname: '/pour-planner', search: workflowQuery(workflowProjectId) },
      {
        state: workflowNavigateState(workflowProjectId, {
          calculationId: workflowCalc?.id,
        }),
      },
    );
  };

  const buildRecommendation = useCallback(
    (weatherData: Weather): MixDesignRecommendation => {
      const { tempF, humidityPercent, windMph } = weatherToMixInputs(
        weatherData.temperature,
        weatherData.humidity,
        weatherData.windSpeed,
      );
      return suggestConcreteParameters({
        tempF,
        humidityPercent,
        windMph,
        psi: parseMixDesignPsi(selectedPsi),
        exposure,
        climate,
      });
    },
    [selectedPsi, exposure, climate],
  );

  const applyWeatherData = useCallback(
    (weatherData: Weather) => {
      setWeather(weatherData);
      setLocationError(null);
      setRecommendation(buildRecommendation(weatherData));
    },
    [buildRecommendation],
  );

  useEffect(() => {
    if (!weather) return;
    setRecommendation(buildRecommendation(weather));
  }, [weather, buildRecommendation]);

  const fetchWeatherForLocation = async (
    fetcher: () => Promise<Weather | null>,
    notFoundMessage: string,
  ) => {
    setLoading(true);
    setLocationError(null);

    try {
      const weatherData = await fetcher();
      if (weatherData) {
        applyWeatherData(weatherData);
      } else {
        setLocationError(notFoundMessage);
      }
    } catch (error) {
      console.error('Error getting weather:', error);
      setLocationError(
        'Error getting weather data. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resolveWeatherForJobsite = useCallback(
    async (addr: USAddress): Promise<Weather | null> => {
      const geocoded = await geocodeAddress(addr);
      if (geocoded) {
        const byCoords = await getWeatherByLocation(
          geocoded.latitude,
          geocoded.longitude,
        );
        if (byCoords) return byCoords;
      }
      return getWeatherByQuery(weatherQueryFromJobsite(addr));
    },
    [],
  );

  const loadWeatherForJobsite = useCallback(
    async (addr: USAddress) => {
      if (!isUSAddressGeocodable(addr)) return;
      await fetchWeatherForLocation(
        () => resolveWeatherForJobsite(addr),
        'Could not find weather for this jobsite. Check city, state, and ZIP, then try again.',
      );
    },
    [resolveWeatherForJobsite],
  );

  useEffect(() => {
    if (!inWorkflow || !isUSAddressGeocodable(jobsiteAddress)) return;
    const key = formatUSAddress(jobsiteAddress);
    if (weatherAutoKeyRef.current === key) return;
    weatherAutoKeyRef.current = key;
    void loadWeatherForJobsite(jobsiteAddress);
  }, [inWorkflow, jobsiteAddress, loadWeatherForJobsite]);

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateUSAddress(jobsiteAddress, {
      requireStreet: false,
      requireZip: false,
    });
    if (!validation.ok) {
      setLocationError(validation.errors[0]);
      return;
    }

    weatherAutoKeyRef.current = formatUSAddress(jobsiteAddress);
    await loadWeatherForJobsite(jobsiteAddress);
  };

  const formatTemperature = (temp: number): string => {
    if (unitSystem === 'metric') {
      const celsius = (temp - 32) * 5/9;
      return `${celsius.toFixed(1)}°C`;
    }
    return `${temp}°F`;
  };

  const formatWindSpeed = (speed: number): string => {
    if (unitSystem === 'metric') {
      const kmh = speed * 1.60934;
      return `${kmh.toFixed(1)} km/h`;
    }
    return `${speed} mph`;
  };

  const evaporationRiskDisplay = (metricRate: number) => {
    const risk = getEvaporationRiskLevel(metricRate);
    const icon =
      risk.level === 'Low' ? (
        <CheckCircle className="h-6 w-6 text-green-500" />
      ) : risk.level === 'Moderate' ? (
        <AlertTriangle className="h-6 w-6 text-yellow-500" />
      ) : (
        <XCircle className="h-6 w-6 text-red-500" />
      );
    return { ...risk, icon };
  };

  const aeDosageRange = () => {
    const baseRange = [0.5, 1.0];
    return baseRange.map(dose => dose * recommendation!.aeFactor);
  };

  const recommendedTargetAir =
    recommendation != null
      ? (recommendation.targetAir[0] + recommendation.targetAir[1]) / 2
      : undefined;

  const wrDosage = () => {
    return [3.0, 5.0];
  };

  const getAccelRetarder = () => {
    const temp = weather?.temperature || 70;
    if (temp < 50) {
      return { type: 'Accelerator', range: '16-32' };
    }
    return { type: 'Retarder', range: '2-4' };
  };

  const handleDownloadSpec = async () => {
    if (recommendation) {
      console.log('Download button clicked, calling generateMixSpecPDF');
      try {
        const success = await generateMixSpecPDF(
          selectedPsi,
          recommendation.targetAir,
          recommendation.waterCementRatio,
          [
            `Air-Entraining Agent (${aeDosageRange()[0].toFixed(2)}-${aeDosageRange()[1].toFixed(2)} oz/cwt)`,
            `Water Reducer (${wrDosage()[0].toFixed(1)}-${wrDosage()[1].toFixed(1)} oz/cwt)`,
            `${getAccelRetarder().type} (${getAccelRetarder().range} oz/cwt)`
          ]
        );
        
        if (success) {
          console.log('PDF generation successful');
        } else {
          console.log('PDF generation failed, fallback used');
        }
      } catch (error) {
        console.error('Error in handleDownloadSpec:', error);
        alert('Failed to generate PDF. Please try again.');
      }
    } else {
      console.log('No recommendation available for download');
      alert('Please calculate mix design first to download specifications.');
    }
  };

  const StepCircle: React.FC<{ number: number }> = ({ number }) => (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-medium">
      {number}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-6xl mx-auto">
        <WorkflowStepHeader />
        {inWorkflow && (
          <div className="mb-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={goToPlacementPlanner}
              icon={<SkipForward size={18} />}
              className="dark:text-white dark:border-slate-600"
            >
              Skip to placement planner
            </Button>
            <Button onClick={goToPlacementPlanner} icon={<CloudSun size={18} />}>
              Continue to placement planner
            </Button>
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Mix-Design Advisor
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Get ACI-based concrete mix recommendations based on current weather conditions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mix Design Parameters</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={1} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Choose Unit System</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    options={[
                      { value: 'imperial', label: 'Imperial (°F, mph)' },
                      { value: 'metric', label: 'Metric (°C, km/h)' }
                    ]}
                    value={unitSystem}
                    onChange={(value) => setUnitSystem(value as 'imperial' | 'metric')}
                    fullWidth
                  />
                  <Select
                    options={[
                      { value: 'temperate', label: 'Temperate (Freeze-Thaw)' },
                      { value: 'tropical', label: 'Tropical (No Freeze)' }
                    ]}
                    value={climate}
                    onChange={(value) => setClimate(value as 'temperate' | 'tropical')}
                    fullWidth
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={2} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Design Strength</h3>
                </div>
                <Select
                  options={MIX_DESIGN_PSI_OPTIONS.map((o) => ({
                    value: o.value,
                    label: unitSystem === 'metric' ? o.labelMetric : o.labelImperial,
                  }))}
                  value={selectedPsi}
                  onChange={setSelectedPsi}
                  fullWidth
                />
                {psiFromWorkflowCalc && (
                  <p className="mt-2 text-xs text-cyan-800 dark:text-cyan-300">
                    Imported from calculator: {psiFromWorkflowCalc} PSI
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={3} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Set Exposure Condition</h3>
                </div>
                <Select
                  options={[
                    { value: 'none', label: 'No Exposure' },
                    { value: 'F1', label: 'F1 - Moderate' },
                    { value: 'F2', label: 'F2 - Severe' },
                    { value: 'F3', label: 'F3 - Very Severe' }
                  ]}
                  value={exposure}
                  onChange={(value) => setExposure(value as 'F1' | 'F2' | 'F3' | 'none')}
                  fullWidth
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={4} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Get Weather-Based Recommendations</h3>
                </div>
                
                <div className="space-y-4">
                  <form onSubmit={handleLocationSearch} className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {inWorkflow
                        ? 'Jobsite weather (from project address)'
                        : weather
                          ? 'Update jobsite for weather'
                          : 'Enter a US jobsite address for weather'}
                    </p>
                    {inWorkflow && isUSAddressGeocodable(jobsiteAddress) && !weather && loading && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Loading weather for your project jobsite…
                      </p>
                    )}
                    {projectJobsiteImported && (
                      <p className="text-xs text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-lg px-3 py-2 flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Loaded from step 1:{' '}
                          <span className="font-medium">
                            {formatUSAddress(jobsiteAddress)}
                          </span>
                        </span>
                      </p>
                    )}
                    <USAddressFields
                      value={jobsiteAddress}
                      onChange={setJobsiteAddress}
                      idPrefix="mix-advisor"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={loading || !isUSAddressGeocodable(jobsiteAddress)}
                      icon={<Search className="h-4 w-4" />}
                    >
                      {weather ? 'Refresh weather' : 'Get weather'}
                    </Button>
                  </form>

                  {locationError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>
                  )}

                  {loading && (
                    <div className="flex items-center justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                        Getting weather data...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {weather && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Conditions</h3>
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <MapPin size={16} className="mr-1" />
                    <span className="text-sm">{weather.location.city}, {weather.location.country}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Temperature</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {formatTemperature(weather.temperature)}
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Humidity</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {weather.humidity}%
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Wind Speed</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {formatWindSpeed(weather.windSpeed)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {recommendation && (
            <>
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mix Design Recommendations</h2>
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Evaporation Rate Risk</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Current Rate</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.evaporationRate.metric.toFixed(2)} kg/m²·hr
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const evap = evaporationRiskDisplay(
                            recommendation.evaporationRate.metric,
                          );
                          return (
                            <>
                              {evap.icon}
                              <span
                                className={`font-medium text-${evap.color}-600 dark:text-${evap.color}-400`}
                              >
                                {evap.level} Risk
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">Low Risk (≤ 0.5): Standard curing adequate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">Moderate Risk (0.5-1.0): Take precautions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">High Risk (&gt; 1.0): Immediate action required</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Mix Properties</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Water-Cement Ratio</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.waterCementRatio.toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Target Air Content</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.targetAir[0]}% - {recommendation.targetAir[1]}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Required Actions</h3>
                    <div className="space-y-2">
                      {recommendation.recommendations.map((rec, index) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg flex items-start gap-2 ${
                            rec.startsWith('CRITICAL') || rec.startsWith('IMMEDIATE')
                              ? 'bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200' 
                              : rec.includes('Consider') || rec.includes('Monitor')
                              ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {rec.startsWith('CRITICAL') || rec.startsWith('IMMEDIATE') ? (
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          ) : rec.includes('Consider') || rec.includes('Monitor') ? (
                            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Important Note</h4>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Start curing immediately when bleed water sheen disappears (typically 30-60 minutes after placement).
                      Maintain chosen curing method for at least 7 days, or 14 days if exposure is severe.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <AdmixtureCalculator
                  temperature={weather?.temperature || 70}
                  unitsImperial={unitSystem === 'imperial'}
                  recommendedTargetAir={recommendedTargetAir}
                />
                
                <SpecGenerator
                  psi={selectedPsi}
                  airContent={recommendation.targetAir}
                  waterCementRatio={recommendation.waterCementRatio}
                  admixtures={[
                    `Air-Entraining Agent (${aeDosageRange()[0].toFixed(2)}-${aeDosageRange()[1].toFixed(2)} oz/cwt)`,
                    `Water Reducer (${wrDosage()[0].toFixed(1)}-${wrDosage()[1].toFixed(1)} oz/cwt)`,
                    `${getAccelRetarder().type} (${getAccelRetarder().range} oz/cwt)`
                  ]}
                  onDownload={handleDownloadSpec}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MixDesignAdvisor;