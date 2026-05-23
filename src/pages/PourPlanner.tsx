import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  MapPin,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CloudSun,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import LocationPermissionAlert from '../components/ui/LocationPermissionAlert';
import PourDayCard from '../components/weather/PourDayCard';
import MitigationSelector from '../components/weather/MitigationSelector';
import Modal from '../components/ui/Modal';
import PlacementScoringGuide from '../components/weather/PlacementScoringGuide';
import PlacementScoringLink from '../components/weather/PlacementScoringLink';
import { useLocation } from '../hooks/useLocation';
import {
  getExtendedForecast,
  getForecastByQuery,
  ForecastLocation,
} from '../services/weatherService';
import {
  scoreForecastDays,
  findBestPourWindow,
  PlacementType,
  pruneMitigationSelections,
  buildWeatherContext,
} from '../utils/pourScoring';
import {
  getApplicableMitigations,
  getMaxMitigationRecovery,
  getMitigationOption,
} from '../utils/pourMitigations';
import { useProjectStore } from '../store';
import { useAuth } from '../hooks/useAuth';

const FORECAST_DAYS = 5;

const PLACEMENT_TYPE_OPTIONS = [
  { value: '', label: 'General placement' },
  { value: 'flatwork', label: 'Slab / flatwork (more sensitive)' },
  { value: 'footing', label: 'Footing (less surface exposure)' },
  { value: 'wall', label: 'Vertical wall' },
  { value: 'mass', label: 'Mass concrete (thermal-sensitive)' },
];

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
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [placementType, setPlacementType] = useState<PlacementType | ''>('');
  const [mitigationsByDate, setMitigationsByDate] = useState<Record<string, string[]>>({});
  const [rawForecastDays, setRawForecastDays] = useState<
    (import('../types').ForecastDay & { avgHumidity?: number })[]
  >([]);
  const loadRequestIdRef = useRef(0);

  const closeScoringModal = useCallback(() => setShowScoringModal(false), []);
  const openScoringModal = useCallback(() => setShowScoringModal(true), []);

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

  const displayDays = useMemo(
    () =>
      scoreForecastDays(rawForecastDays, {
        placementType: placementType || undefined,
        mitigationsByDate,
      }),
    [rawForecastDays, placementType, mitigationsByDate],
  );

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

  const handleMitigationsChange = (date: string, ids: string[]) => {
    const day = rawForecastDays.find((d) => d.date === date);
    if (day) {
      const pruned = pruneMitigationSelections(
        day,
        ids,
        placementType || undefined,
      );
      setMitigationsByDate((prev) => ({ ...prev, [date]: pruned }));
      return;
    }
    setMitigationsByDate((prev) => ({ ...prev, [date]: ids }));
  };

  const selectedDay = displayDays.find((d) => d.date === selectedDate);

  const selectedMitigationContext = useMemo(() => {
    if (!selectedDay) return null;
    return buildWeatherContext(selectedDay, {
      evaporationRateKgM2H: selectedDay.evaporationRateKgM2H ?? 0,
      evaporationRisk: selectedDay.evaporationRisk,
      criticalFail: selectedDay.criticalFail,
    });
  }, [selectedDay]);

  const applicableMitigations = selectedMitigationContext
    ? getApplicableMitigations(selectedMitigationContext)
    : [];
  const maxMitigationRecovery = selectedMitigationContext
    ? getMaxMitigationRecovery(selectedMitigationContext)
    : 0;

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

  const showLocationHelp =
    permission === 'denied' || Boolean(locationError);

  const bestWindow = findBestPourWindow(displayDays);

  const handleSavePourDate = async () => {
    if (!selectedDate || !selectedProjectId || !user) return;
    const isoDate = `${selectedDate}T12:00:00.000Z`;
    try {
      await updateProject(selectedProjectId, { pourDate: isoDate });
      setSaveMessage(`Pour date saved for ${format(parseISO(selectedDate), 'MMM d, yyyy')}`);
    } catch {
      setError('Failed to save pour date to project.');
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
        <h1 className="text-3xl font-bold text-white drop-shadow-md">Placement Planner</h1>
        <p className="text-white/90 mt-2 max-w-2xl mx-auto drop-shadow">
          Compare the next five days to pick the best window for placing concrete — based on
          temperature, rain, and wind.
        </p>
        <div className="mt-3">
          <PlacementScoringLink onClick={openScoringModal} />
        </div>
      </motion.div>

      <Card className="p-6 bg-white/95 dark:bg-gray-900/95">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location
        </h2>

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleUseMyLocation}
            disabled={loading || locationLoading}
            icon={<MapPin className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            {locationLoading ? 'Getting location…' : 'Use my location'}
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <form onSubmit={handleLocationSearch} className="flex flex-col sm:flex-row gap-2">
            <Input
              label="ZIP, city, or country"
              placeholder="e.g. 97201 or Portland, OR or London, UK"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="flex-1"
            />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="outline"
                disabled={loading || !locationQuery.trim()}
                icon={<Search className="h-4 w-4" />}
              >
                Search
              </Button>
            </div>
          </form>
        </div>

        {showLocationHelp && (
          <div className="mt-4">
            <LocationPermissionAlert
              onLocationReceived={(lat, lon) => loadForecast({ lat, lon })}
              onError={(msg) => setError(msg)}
            />
          </div>
        )}

        {location && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {location.city}, {location.country}
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {!loading && displayDays.length > 0 && (
        <>
          <Card className="p-4 bg-white/95 dark:bg-gray-900/95">
            <Select
              label="Placement type (optional sensitivity adjustment)"
              options={PLACEMENT_TYPE_OPTIONS}
              value={placementType}
              onChange={(v) => setPlacementType(v as PlacementType | '')}
            />
          </Card>

          {bestWindow ? (
            <Card className="p-4 bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Best placement window
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    {bestWindow.start === bestWindow.end
                      ? format(parseISO(bestWindow.start), 'EEEE, MMMM d')
                      : `${format(parseISO(bestWindow.start), 'MMM d')} – ${format(parseISO(bestWindow.end), 'MMM d')}`}
                    {' '}
                    ({bestWindow.days.length} day{bestWindow.days.length > 1 ? 's' : ''} rated Good or Excellent)
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-4 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  No Excellent or Good days in the next five days. Review each day below or adjust your schedule.
                </p>
              </div>
            </Card>
          )}

          <div>
            <h2 className="text-lg font-semibold text-white drop-shadow mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Day-by-day outlook
            </h2>
            <p className="text-sm text-white/80 mb-4 drop-shadow">
              Tap a day to select a pour date. Green = Excellent/Good, yellow = Caution, red = Delay recommended.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {displayDays.map((day) => {
                const isSelected = selectedDate === day.date;
                return (
                  <PourDayCard
                    key={day.date}
                    day={day}
                    expanded={isSelected}
                    selected={isSelected}
                    placementType={placementType || undefined}
                    onSelect={() =>
                      setSelectedDate((d) => (d === day.date ? null : day.date))
                    }
                  />
                );
              })}
            </div>
          </div>

          {selectedDate && selectedDay && (
            <Card className="p-6 bg-white/95 dark:bg-gray-900/95">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Mitigations for {format(parseISO(selectedDate), 'MMM d')}
              </h3>
              <MitigationSelector
                options={applicableMitigations}
                selected={mitigationsByDate[selectedDate] ?? []}
                onChange={(ids) => handleMitigationsChange(selectedDate, ids)}
                maxRecovery={maxMitigationRecovery}
                disabled={maxMitigationRecovery === 0}
              />
              {selectedDay.appliedMitigations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Base score: {selectedDay.baseScore} → Adjusted: {selectedDay.score}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Mitigations applied to score (+{selectedDay.mitigationCredit} of{' '}
                    {maxMitigationRecovery} max):
                  </p>
                  <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    {selectedDay.appliedMitigations.map((id) => {
                      const opt = getMitigationOption(id);
                      return (
                        <li key={id}>
                          + {opt?.label ?? id} (+{opt?.credit ?? 0})
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {user && projects.length > 0 && selectedDate && (
            <Card className="p-6 bg-white/95 dark:bg-gray-900/95">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Save pour date to project
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  label="Project"
                  options={[
                    { value: '', label: 'Select a project…' },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button
                    onClick={handleSavePourDate}
                    disabled={!selectedProjectId}
                  >
                    Save {format(parseISO(selectedDate), 'MMM d')}
                  </Button>
                </div>
              </div>
              {saveMessage && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">{saveMessage}</p>
              )}
            </Card>
          )}

          <Card className="p-4 bg-white/90 dark:bg-gray-800/90 text-sm text-gray-600 dark:text-gray-400">
            <p className="text-gray-700 dark:text-gray-300">
              Scores are based on forecast weather data and estimated field conditions. Actual site
              conditions, mix design, concrete temperature, placement methods, and project
              specifications may significantly affect performance. Always follow project
              specifications, engineer requirements, and applicable ACI guidance.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Scores follow ACI 305R (hot weather) and 306R (cold weather). Tap a day for risks,
              finishability, and recommended actions. Select mitigations to model score recovery.
            </p>
            <div className="mt-3">
              <PlacementScoringLink
                variant="onLight"
                onClick={openScoringModal}
              />
            </div>
          </Card>
        </>
      )}

      {!loading && displayDays.length === 0 && !error && (
        <Card className="p-8 text-center bg-white/90 dark:bg-gray-900/90">
          <CloudSun className="h-10 w-10 mx-auto text-cyan-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Use my location or search by ZIP, city, or country to see day ratings.
          </p>
          <div className="mt-4">
            <PlacementScoringLink
              variant="onLight"
              onClick={() => setShowScoringModal(true)}
            />
          </div>
        </Card>
      )}

      <Modal
        isOpen={showScoringModal}
        onClose={closeScoringModal}
        title="Placement scoring & ACI references"
        size="lg"
      >
        <PlacementScoringGuide />
      </Modal>
    </div>
  );
};

export default PourPlanner;
