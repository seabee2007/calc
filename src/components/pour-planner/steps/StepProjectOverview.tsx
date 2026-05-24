import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Factory, Loader2, MapPin } from 'lucide-react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { findBatchPlant, BatchPlantNotFoundError } from '../../../services/batchPlantService';
import { getMapboxTravelTime } from '../../../services/mapboxTravelService';
import { verifyJobsiteAddress } from '../../../services/geocodeService';
import type { BatchPlantResult } from '../../../services/batchPlantService';
import type { GeocodedAddressResult } from '../../../services/geocodeService';

interface StepProps {
  planner: PourPlannerContext;
}

const CUSTOM_PROJECT_VALUE = '__custom__';

export const StepProjectOverview: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, projects, preferences, calculation } = planner;
  const selectedProject = projects.find((p) => p.id === form.projectId);
  const projectCalculations = selectedProject?.calculations ?? [];
  const usingSavedProject = Boolean(form.projectId);

  const [findPlantLoading, setFindPlantLoading] = useState(false);
  const [findPlantError, setFindPlantError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [foundPlant, setFoundPlant] = useState<BatchPlantResult | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedJobsite, setVerifiedJobsite] = useState<GeocodedAddressResult | null>(null);

  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  const hasJobsiteAddress = form.jobsiteAddress.trim().length > 0;
  const jobsiteReady = Boolean(verifiedJobsite);

  const clearLocationState = () => {
    setFoundPlant(null);
    setFindPlantError(null);
    setRouteError(null);
    setVerifiedJobsite(null);
    setVerifyError(null);
  };

  const handleProjectChange = (value: string) => {
    if (value === CUSTOM_PROJECT_VALUE || value === '') {
      setField('projectId', '');
      setField('calculationId', '');
      setField('projectName', '');
      return;
    }

    const project = projects.find((p) => p.id === value);
    setField('projectId', value);
    setField('calculationId', '');
    if (project) {
      setField('projectName', project.name);
    }
  };

  const handleVerifyJobsite = async () => {
    if (!hasJobsiteAddress) return;

    setVerifyLoading(true);
    setVerifyError(null);
    setVerifiedJobsite(null);
    setFoundPlant(null);
    setFindPlantError(null);
    setRouteError(null);

    try {
      const verified = await verifyJobsiteAddress(form.jobsiteAddress);
      setVerifiedJobsite(verified);
      setField('jobsiteAddress', verified.formattedAddress);
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Could not verify jobsite address.',
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleFindBatchPlant = async () => {
    if (!hasJobsiteAddress) return;

    setFindPlantLoading(true);
    setFindPlantError(null);
    setRouteError(null);
    setFoundPlant(null);

    try {
      let jobsite = verifiedJobsite;
      if (!jobsite) {
        jobsite = await verifyJobsiteAddress(form.jobsiteAddress);
        setVerifiedJobsite(jobsite);
        setField('jobsiteAddress', jobsite.formattedAddress);
      }

      const plant = await findBatchPlant(jobsite.formattedAddress, {
        latitude: jobsite.latitude,
        longitude: jobsite.longitude,
      });
      setFoundPlant(plant);
      setField('batchPlantAddress', plant.formattedAddress);

      setTravelLoading(true);
      try {
        const route = await getMapboxTravelTime(
          plant.formattedAddress,
          jobsite.formattedAddress,
        );
        setField('travelDistance', String(route.distanceMiles));
        setField('travelTimeMinutes', String(route.travelMinutes));
        if (route.avgSpeedMph > 0) {
          setField('truckSpeed', String(route.avgSpeedMph));
        }
      } catch (routeErr) {
        setRouteError(
          routeErr instanceof Error
            ? routeErr.message
            : 'Could not calculate route.',
        );
      } finally {
        setTravelLoading(false);
      }
    } catch (err) {
      if (err instanceof BatchPlantNotFoundError) {
        setFindPlantError(err.message);
      } else {
        setFindPlantError(
          err instanceof Error ? err.message : 'Could not find a nearby batch plant.',
        );
      }
    } finally {
      setFindPlantLoading(false);
    }
  };

  const isSearching = findPlantLoading || travelLoading;

  return (
    <div>
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Project overview
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose a saved project or enter a pour name, verify the jobsite location, then find or
          enter the batch plant address.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.length > 0 ? (
            <>
              <Select
                label="Project"
                options={[
                  { value: CUSTOM_PROJECT_VALUE, label: 'Enter project name manually…' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={form.projectId || CUSTOM_PROJECT_VALUE}
                onChange={handleProjectChange}
              />
              {!usingSavedProject && (
                <Input
                  label="Project name"
                  value={form.projectName}
                  onChange={(e) => setField('projectName', e.target.value)}
                  placeholder="e.g. Main St slab pour"
                />
              )}
            </>
          ) : (
            <Input
              label="Project name"
              value={form.projectName}
              onChange={(e) => setField('projectName', e.target.value)}
              placeholder="e.g. Main St slab pour"
            />
          )}

          {usingSavedProject && projectCalculations.length > 0 && (
            <Select
              label="Calculation"
              options={[
                { value: '', label: 'Select a calculation…' },
                ...projectCalculations.map((c) => ({
                  value: c.id,
                  label: `${c.type.replace(/_/g, ' ')} — ${c.result.volume.toFixed(2)} ${volumeLabel}`,
                })),
              ]}
              value={form.calculationId}
              onChange={(v) => setField('calculationId', v)}
            />
          )}

          {!calculation && (
            <Input
              label={`Volume (${volumeLabel})`}
              type="number"
              min="0"
              step="0.01"
              value={form.manualVolume}
              onChange={(e) => setField('manualVolume', e.target.value)}
              placeholder="e.g. 40"
              className={
                usingSavedProject && projectCalculations.length > 0
                  ? 'sm:col-span-2'
                  : undefined
              }
            />
          )}

          <Input
            label="Pour start time"
            type="time"
            value={form.pourStartTime}
            onChange={(e) => setField('pourStartTime', e.target.value)}
          />

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-gray-300">
              Jobsite address
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  value={form.jobsiteAddress}
                  onChange={(e) => {
                    setField('jobsiteAddress', e.target.value);
                    clearLocationState();
                  }}
                  placeholder="119 Grand Rock Rd, Santa Rita, GU 96915"
                  fullWidth
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleVerifyJobsite}
                disabled={!hasJobsiteAddress || verifyLoading || isSearching}
                className="sm:self-end whitespace-nowrap"
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
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Include street, city, and ZIP. For Guam use GU or Guam (e.g. Santa Rita, GU 96915).
            </p>
            {verifyError && (
              <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {verifyError}
              </div>
            )}
            {jobsiteReady && verifiedJobsite && (
              <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/25 text-blue-900 dark:text-blue-100 text-sm flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Verified: {verifiedJobsite.formattedAddress}</span>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-gray-300">
              Batch plant address
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  value={form.batchPlantAddress}
                  onChange={(e) => {
                    setField('batchPlantAddress', e.target.value);
                    setFoundPlant(null);
                    setFindPlantError(null);
                    setRouteError(null);
                  }}
                  placeholder="Ready-mix plant"
                  fullWidth
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFindBatchPlant}
                disabled={!hasJobsiteAddress || isSearching || verifyLoading}
                className="sm:self-end whitespace-nowrap"
                icon={
                  isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Factory className="h-4 w-4" />
                  )
                }
              >
                {findPlantLoading
                  ? 'Searching…'
                  : travelLoading
                    ? 'Calculating route…'
                    : 'Find Batch Plant'}
              </Button>
            </div>
            {!hasJobsiteAddress && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter and verify the jobsite address first to search for nearby batch plants.
              </p>
            )}
            {findPlantError && (
              <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/25 text-amber-900 dark:text-amber-100 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {findPlantError}
              </div>
            )}
            {routeError && (
              <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/25 text-amber-900 dark:text-amber-100 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Plant found, but route calculation failed: {routeError}
              </div>
            )}
            {foundPlant && (
              <div className="mt-2 p-3 rounded-md bg-green-50 dark:bg-green-900/25 text-green-800 dark:text-green-200 text-sm flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Found {foundPlant.plantName} ({foundPlant.distanceMiles} mi away,{' '}
                  {foundPlant.confidence} confidence)
                  {form.travelTimeMinutes && form.travelDistance
                    ? ` · ${form.travelDistance} mi · ${form.travelTimeMinutes} min drive`
                    : ''}
                </span>
              </div>
            )}
          </div>

          <Select
            label="Placement method"
            options={[
              { value: '', label: 'Select method…' },
              { value: 'chute', label: 'Chute' },
              { value: 'pump', label: 'Pump truck' },
              { value: 'conveyor', label: 'Conveyor' },
              { value: 'buggy', label: 'Buggy' },
              { value: 'bucket', label: 'Crane bucket' },
            ]}
            value={form.placementMethod}
            onChange={(v) =>
              setField('placementMethod', v as typeof form.placementMethod)
            }
          />
        </div>
      </section>
    </div>
  );
};

export default StepProjectOverview;
