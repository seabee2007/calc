import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Checkbox from '../../ui/Checkbox';
import Card from '../../ui/Card';
import PourDayCard from '../../weather/PourDayCard';
import MitigationSelector from '../../weather/MitigationSelector';
import EvapGauge from '../../calculations/EvapGauge';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import {
  PlacementType,
  ScoredPourDay,
  findBestPourWindow,
} from '../../../utils/pourScoring';
import {
  getApplicableMitigations,
  getMaxMitigationRecovery,
  getMitigationOption,
  buildWeatherContext,
} from '../../../utils/pourMitigations';
import { ForecastLocation } from '../../../services/weatherService';
import PlannerStepLocationsCard from '../PlannerStepLocationsCard';
import {
  batchPlantDisplayLine,
  hasVerifiedJobsiteCoords,
  jobsiteDisplayAddress,
} from '../../../utils/addressForm';

const PLACEMENT_TYPE_OPTIONS = [
  { value: '', label: 'General placement' },
  { value: 'flatwork', label: 'Slab / flatwork (more sensitive)' },
  { value: 'footing', label: 'Footing (less surface exposure)' },
  { value: 'wall', label: 'Vertical wall' },
  { value: 'mass', label: 'Mass concrete (thermal-sensitive)' },
];

export interface StepEnvironmentalProps {
  planner: PourPlannerContext;
  batchPlantLocation: ForecastLocation | null;
  jobsiteLocation: ForecastLocation | null;
  loading: boolean;
  error: string | null;
  displayDays: ScoredPourDay[];
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
  placementType: PlacementType | '';
  setPlacementType: (t: PlacementType | '') => void;
  mitigationsByDate: Record<string, string[]>;
  onMitigationsChange: (date: string, ids: string[]) => void;
}

export const StepEnvironmental: React.FC<StepEnvironmentalProps> = ({
  planner,
  batchPlantLocation,
  jobsiteLocation,
  loading,
  error,
  displayDays,
  selectedDate,
  setSelectedDate,
  placementType,
  setPlacementType,
  mitigationsByDate,
  onMitigationsChange,
}) => {
  const { form, setField, hotWeather } = planner;
  const selectedDay = displayDays.find((d) => d.date === selectedDate);
  const bestWindow = findBestPourWindow(displayDays);
  const [mitigationsExpanded, setMitigationsExpanded] = useState(false);

  const hasBatchPlant = batchPlantDisplayLine(form).length > 0;
  const hasJobsite = jobsiteDisplayAddress(form).length > 0;
  const jobsiteCoordsVerified = hasVerifiedJobsiteCoords(form);
  const selectedMitigationCount = selectedDate
    ? (mitigationsByDate[selectedDate]?.length ?? 0)
    : 0;

  useEffect(() => {
    setMitigationsExpanded(false);
  }, [selectedDate]);

  const mitigationContext = selectedDay
    ? (() => {
        const ctx = buildWeatherContext(selectedDay, {
          evaporationRateKgM2H: selectedDay.evaporationRateKgM2H ?? 0,
          evaporationRisk: selectedDay.evaporationRisk,
          criticalFail: selectedDay.criticalFail,
        });
        return {
          options: getApplicableMitigations(ctx),
          maxRecovery: getMaxMitigationRecovery(ctx),
        };
      })()
    : null;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Weather locations
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Placement-day scoring uses the batch plant forecast from Step 1. Field conditions
          below mirror the selected day card — same temp, wind, and humidity values.
        </p>

        <PlannerStepLocationsCard
          form={form}
          batchPlantNote={
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Placement-day scoring uses weather at the batch plant location above.
            </p>
          }
          jobsiteNote={
            jobsiteCoordsVerified ? (
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Jobsite forecast uses your verified map coordinates from Step 1.
              </p>
            ) : jobsiteLocation && hasJobsite ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Verify jobsite in Step 1 so weather uses your map pin, not text search.
              </p>
            ) : undefined
          }
        />

        {!hasBatchPlant && !hasJobsite && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Enter jobsite and batch plant addresses in Step 1 to load weather automatically.
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </section>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && displayDays.length > 0 && (
        <>
          <Select
            label="Placement type (sensitivity adjustment)"
            options={PLACEMENT_TYPE_OPTIONS}
            value={placementType}
            onChange={(v) => setPlacementType(v as PlacementType | '')}
          />

          {bestWindow ? (
            <Card className="p-4 bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Best window:{' '}
                  {bestWindow.start === bestWindow.end
                    ? format(parseISO(bestWindow.start), 'EEEE, MMMM d')
                    : `${format(parseISO(bestWindow.start), 'MMM d')} – ${format(parseISO(bestWindow.end), 'MMM d')}`}
                </p>
              </div>
            </Card>
          ) : null}

          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Day-by-day outlook
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayDays.map((day) => (
                <PourDayCard
                  key={day.date}
                  day={day}
                  expanded={selectedDate === day.date}
                  selected={selectedDate === day.date}
                  placementType={placementType || undefined}
                  onSelect={() =>
                    setSelectedDate(selectedDate === day.date ? null : day.date)
                  }
                />
              ))}
            </div>
          </div>

          {selectedDate && selectedDay && mitigationContext && (
            <Card className="p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setMitigationsExpanded((open) => !open)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                aria-expanded={mitigationsExpanded}
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Optional mitigations — {format(parseISO(selectedDate), 'MMM d')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedMitigationCount > 0
                      ? `${selectedMitigationCount} selected`
                      : 'Tap to adjust score with planned mitigations'}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${
                    mitigationsExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {mitigationsExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <MitigationSelector
                    options={mitigationContext.options}
                    selected={mitigationsByDate[selectedDate] ?? []}
                    onChange={(ids) => onMitigationsChange(selectedDate, ids)}
                    maxRecovery={mitigationContext.maxRecovery}
                    disabled={mitigationContext.maxRecovery === 0}
                  />
                  {selectedDay.appliedMitigations.length > 0 && (
                    <ul className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {selectedDay.appliedMitigations.map((id) => {
                        const opt = getMitigationOption(id);
                        return (
                          <li key={id}>
                            + {opt?.label ?? id} (+{opt?.credit ?? 0})
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-1">
          Field conditions
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {selectedDay
            ? `Matches selected day: ${Math.round(selectedDay.minTemp)}–${Math.round(selectedDay.maxTemp)}°F · ${Math.round(selectedDay.maxWindSpeed)} mph wind · ${selectedDay.avgHumidity != null ? `${Math.round(selectedDay.avgHumidity)}% RH` : 'RH n/a'}. Edit if field readings differ.`
            : 'Select a placement day above to auto-fill from forecast, or enter readings manually.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Ambient air temp (°F)"
            type="number"
            value={form.ambientTemp}
            onChange={(e) => setField('ambientTemp', e.target.value)}
          />
          <Input
            label="Concrete temp at plant (°F)"
            type="number"
            value={form.concreteTempAtPlant}
            onChange={(e) => setField('concreteTempAtPlant', e.target.value)}
          />
          <Input
            label="Expected temp at arrival (°F)"
            type="number"
            value={form.expectedConcreteTempAtArrival}
            onChange={(e) => setField('expectedConcreteTempAtArrival', e.target.value)}
          />
          <Input
            label="Relative humidity (%)"
            type="number"
            min="0"
            max="100"
            value={form.relativeHumidity}
            onChange={(e) => setField('relativeHumidity', e.target.value)}
          />
          <Input
            label="Wind speed (mph)"
            type="number"
            min="0"
            value={form.windSpeed}
            onChange={(e) => setField('windSpeed', e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <Checkbox
            label="Night placement"
            checked={form.nightPour}
            onChange={(e) => setField('nightPour', e.target.checked)}
          />
          <Checkbox
            label="Rain in forecast"
            checked={form.rainForecast}
            onChange={(e) => setField('rainForecast', e.target.checked)}
          />
        </div>

        <Card className="p-4 mt-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            ACI 305 hot weather — evaporation rate
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {hotWeather.evaporationRateLbFt2Hr.toFixed(3)} lb/ft²/hr · Risk:{' '}
            {hotWeather.riskLabel}
          </p>
          <EvapGauge
            value={hotWeather.evaporationRateKgM2H}
            thresholds={[0.5, 1.0]}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Action threshold ~0.2 lb/ft²/hr for plastic shrinkage cracking risk.
          </p>
        </Card>
      </section>
    </div>
  );
};

export default StepEnvironmental;
