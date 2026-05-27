import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  PenLine,
  Search,
} from 'lucide-react';
import type { Project } from '../../types';
import type { Weather } from '../../types';
import USAddressFields from '../address/USAddressFields';
import Button from '../ui/Button';
import Select from '../ui/Select';
import {
  copyUSAddress,
  formatUSAddress,
  hasProjectJobsite,
  isUSAddressGeocodable,
  mergeVerifiedJobsiteAddress,
  repairJobsiteAddress,
  validateUSAddress,
  type USAddress,
} from '../../types/address';
import { verifyJobsiteAddress } from '../../services/geocodeService';
import { getWeatherByLocation, getWeatherByQuery } from '../../services/weatherService';

type LocationMode = 'import' | 'manual';

export interface MixAdvisorWeatherLocationProps {
  value: USAddress;
  onChange: (addr: USAddress) => void;
  projects: Project[];
  workflowProject?: Project;
  weather: Weather | null;
  loading: boolean;
  locationError: string | null;
  onWeatherLoaded: (weather: Weather) => void;
  onError: (message: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}

function jobsiteFromProject(project: Project | undefined): USAddress | null {
  if (!project?.jobsiteAddress) return null;
  const addr = copyUSAddress(repairJobsiteAddress(project.jobsiteAddress));
  if (!isUSAddressGeocodable(addr) && !addr.city?.trim()) return null;
  return addr;
}

const MixAdvisorWeatherLocation: React.FC<MixAdvisorWeatherLocationProps> = ({
  value,
  onChange,
  projects,
  workflowProject,
  weather,
  loading,
  locationError,
  onWeatherLoaded,
  onError,
  onLoadingChange,
}) => {
  const projectsWithJobsite = useMemo(
    () =>
      projects.filter((p) => hasProjectJobsite(p.jobsiteAddress) || jobsiteFromProject(p)),
    [projects],
  );

  const workflowJobsite = jobsiteFromProject(workflowProject);
  const workflowUsable = Boolean(workflowJobsite);

  const [mode, setMode] = useState<LocationMode>(
    workflowUsable ? 'import' : 'manual',
  );
  const [importProjectId, setImportProjectId] = useState(
    workflowProject?.id ?? '',
  );
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedLine, setVerifiedLine] = useState<string | null>(null);
  const [verifiedCoords, setVerifiedCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const selectedImportProject = projectsWithJobsite.find(
    (p) => p.id === importProjectId,
  );
  const importJobsite = jobsiteFromProject(selectedImportProject);

  useEffect(() => {
    if (workflowProject?.id && workflowUsable) {
      setImportProjectId(workflowProject.id);
      setMode('import');
    }
  }, [workflowProject?.id, workflowUsable]);

  const applyAddress = useCallback(
    (addr: USAddress) => {
      onChange(copyUSAddress(addr));
      setVerifiedLine(null);
      setVerifiedCoords(null);
      onError(null);
    },
    [onChange, onError],
  );

  const runVerify = useCallback(
    async (
      addr: USAddress,
    ): Promise<{ normalized: USAddress; lat: number; lon: number } | null> => {
      const validation = validateUSAddress(addr, {
        requireStreet: true,
        requireZip: false,
      });
      if (!validation.ok) {
        onError(validation.errors.join(' '));
        setVerifiedLine(null);
        setVerifiedCoords(null);
        return null;
      }

      setVerifyLoading(true);
      onError(null);

      try {
        const result = await verifyJobsiteAddress(addr);
        const normalized = result.addressParts
          ? copyUSAddress(result.addressParts)
          : mergeVerifiedJobsiteAddress(copyUSAddress(addr), result.formattedAddress);
        onChange(normalized);
        setVerifiedLine(result.formattedAddress);
        const coords = { lat: result.latitude, lon: result.longitude };
        setVerifiedCoords(coords);
        return { normalized, ...coords };
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not verify address.');
        setVerifiedLine(null);
        setVerifiedCoords(null);
        return null;
      } finally {
        setVerifyLoading(false);
      }
    },
    [onChange, onError],
  );

  const fetchWeather = useCallback(
    async (addr: USAddress, coords?: { lat: number; lon: number } | null) => {
      onLoadingChange(true);
      onError(null);

      try {
        let lat = coords?.lat;
        let lon = coords?.lon;

        if (lat == null || lon == null) {
          const verified = await runVerify(addr);
          if (!verified) {
            onLoadingChange(false);
            return;
          }
          lat = verified.lat;
          lon = verified.lon;
        }

        let weatherData = await getWeatherByLocation(lat, lon);
        if (!weatherData) {
          const query = formatUSAddress(addr);
          weatherData = query ? await getWeatherByQuery(query) : null;
        }
        if (!weatherData) {
          const city = addr.city.trim();
          const state = addr.state.trim();
          const zip = addr.zip.trim();
          const fallback =
            city && state
              ? zip
                ? `${city}, ${state} ${zip}, United States`
                : `${city}, ${state}, United States`
              : '';
          if (fallback) {
            weatherData = await getWeatherByQuery(fallback);
          }
        }

        if (weatherData) {
          onWeatherLoaded(weatherData);
        } else {
          onError(
            'Weather not found for this jobsite. Verify the address (street, city, GU for Guam, ZIP 969xx), then try again.',
          );
        }
      } catch {
        onError('Error loading weather. Check your connection and try again.');
      } finally {
        onLoadingChange(false);
      }
    },
    [onLoadingChange, onError, onWeatherLoaded, runVerify],
  );

  const handleImportProject = (projectId: string) => {
    setImportProjectId(projectId);
    const project = projectsWithJobsite.find((p) => p.id === projectId);
    const addr = jobsiteFromProject(project);
    if (addr) {
      applyAddress(addr);
      setMode('import');
    }
  };

  const handleUseWorkflowProject = () => {
    if (!workflowJobsite || !workflowProject) return;
    setImportProjectId(workflowProject.id);
    setMode('import');
    applyAddress(workflowJobsite);
  };

  const handleGetWeather = (e?: React.FormEvent) => {
    e?.preventDefault();
    void fetchWeather(value, verifiedCoords);
  };

  const busy = loading || verifyLoading;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Use the same jobsite format as Start New Project: street, city, state/territory
        (e.g. GU for Guam), and ZIP when known (969xx). Verify before loading weather.
      </p>

      {projectsWithJobsite.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('import')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border transition-colors ${
                mode === 'import'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Import from project
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border transition-colors ${
                mode === 'manual'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
            >
              <PenLine className="h-4 w-4" />
              Enter address
            </button>
          </div>

          {mode === 'import' && (
            <div className="space-y-3 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/30 p-3">
              <Select
                label="Saved project"
                value={importProjectId}
                onChange={handleImportProject}
                options={[
                  { value: '', label: 'Select a project…' },
                  ...projectsWithJobsite.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ]}
              />
              {workflowUsable && workflowProject && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={handleUseWorkflowProject}
                >
                  Use current workflow project: {workflowProject.name}
                </Button>
              )}
              {importJobsite && (
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <MapPin className="inline h-4 w-4 mr-1 text-cyan-600 dark:text-cyan-400" />
                  {formatUSAddress(importJobsite)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <USAddressFields
          value={value}
          onChange={(addr) => {
            applyAddress(addr);
          }}
          showStreet2
          idPrefix="mix-advisor"
        />
      )}

      {mode === 'import' && !importJobsite && importProjectId && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This project has no jobsite on file. Add one on the Projects page or enter an
          address manually.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 min-h-[48px]"
          disabled={busy || !isUSAddressGeocodable(value)}
          onClick={() => void runVerify(value)}
          icon={
            verifyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )
          }
        >
          {verifyLoading ? 'Verifying…' : 'Verify location'}
        </Button>
        <Button
          type="button"
          className="flex-1 min-h-[48px]"
          disabled={busy || !isUSAddressGeocodable(value)}
          onClick={handleGetWeather}
          icon={<Search className="h-4 w-4" />}
        >
          {loading ? 'Loading weather…' : weather ? 'Refresh weather' : 'Get weather'}
        </Button>
      </div>

      {verifiedLine && (
        <p className="text-xs text-green-700 dark:text-green-400 flex items-start gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Verified: {verifiedLine}
        </p>
      )}

      {locationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>
      )}
    </div>
  );
};

export default MixAdvisorWeatherLocation;
