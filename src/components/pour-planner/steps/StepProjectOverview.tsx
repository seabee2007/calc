import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Factory, Loader2, MapPin } from 'lucide-react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import USAddressFields from '../../address/USAddressFields';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { findBatchPlant, BatchPlantNotFoundError } from '../../../services/batchPlantService';
import { lookupBatchPlantContact } from '../../../services/batchPlantContactService';
import { hasSavedBatchPlantContact } from '../../../utils/projectLocation';
import { getMapboxTravelTime } from '../../../services/mapboxTravelService';
import { verifyJobsiteAddress } from '../../../services/geocodeService';
import type { BatchPlantResult } from '../../../services/batchPlantService';
import type { GeocodedAddressResult } from '../../../services/geocodeService';
import {
  formatUSAddress,
  isUSAddressGeocodable,
  mergeVerifiedJobsiteAddress,
  normalizeUSAddressInput,
  parseLegacyUSAddress,
  validateUSAddress,
} from '../../../types/address';
import {
  applyUSAddressToPourPlanner,
  jobsiteFromPourPlannerForm,
} from '../../../utils/addressForm';
import {
  hasSavedBatchPlant,
  getSavedPlacementOrder,
} from '../../../utils/projectLocation';

interface StepProps {
  planner: PourPlannerContext;
}

const CUSTOM_PROJECT_VALUE = '__custom__';

function applyJobsiteFields(
  setField: PourPlannerContext['setField'],
  patch: ReturnType<typeof applyUSAddressToPourPlanner>,
) {
  (Object.entries(patch) as [keyof typeof patch, string][]).forEach(([key, value]) => {
    if (value !== undefined) setField(key as keyof PourPlannerContext['form'], value);
  });
}

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

  const jobsiteAddr = jobsiteFromPourPlannerForm(form);
  const hasJobsiteAddress = isUSAddressGeocodable(jobsiteAddr);
  const jobsiteReady = Boolean(verifiedJobsite);
  const projectHasAddress = Boolean(
    selectedProject?.jobsiteAddress &&
      isUSAddressGeocodable(selectedProject.jobsiteAddress),
  );

  useEffect(() => {
    if (form.jobsiteCity || form.jobsiteState) return;
    if (!form.jobsiteAddress.trim()) return;
    const parsed = parseLegacyUSAddress(form.jobsiteAddress);
    if (parsed.city || parsed.state || parsed.street) {
      applyJobsiteFields(setField, applyUSAddressToPourPlanner({}, parsed));
    }
  }, []);

  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  const clearLocationState = () => {
    setFoundPlant(null);
    setFindPlantError(null);
    setRouteError(null);
    setVerifiedJobsite(null);
    setVerifyError(null);
    setField('jobsiteAddress', '');
    setField('jobsiteLatitude', '');
    setField('jobsiteLongitude', '');
    setField('batchPlantName', '');
    setField('batchPlantLatitude', '');
    setField('batchPlantLongitude', '');
  };

  const handleJobsiteAddressChange = (next: typeof jobsiteAddr) => {
    applyJobsiteFields(setField, applyUSAddressToPourPlanner({}, next));
    clearLocationState();
  };

  const handleUseProjectAddress = () => {
    if (!selectedProject?.jobsiteAddress) return;
    applyJobsiteFields(
      setField,
      applyUSAddressToPourPlanner({}, selectedProject.jobsiteAddress),
    );
    clearLocationState();
  };

  const handleProjectChange = (value: string) => {
    if (value === '') {
      setField('projectId', '');
      setField('calculationId', '');
      setField('projectName', '');
      return;
    }

    if (value === CUSTOM_PROJECT_VALUE) {
      setField('projectId', '');
      setField('calculationId', '');
      return;
    }

    const project = projects.find((p) => p.id === value);
    setField('projectId', value);
    setField('calculationId', '');
    if (project) {
      setField('projectName', project.name);
      if (project.jobsiteAddress && isUSAddressGeocodable(project.jobsiteAddress)) {
        applyJobsiteFields(
          setField,
          applyUSAddressToPourPlanner({}, project.jobsiteAddress),
        );
        clearLocationState();
      }
    }
  };

  const projectSelectValue = form.projectId
    ? form.projectId
    : form.projectName.trim()
      ? CUSTOM_PROJECT_VALUE
      : '';

  const resolveVerifiedJobsite = async (): Promise<GeocodedAddressResult> => {
    const normalized = normalizeUSAddressInput(jobsiteAddr);
    if (
      normalized.street !== jobsiteAddr.street ||
      normalized.city !== jobsiteAddr.city ||
      normalized.state !== jobsiteAddr.state ||
      normalized.zip !== jobsiteAddr.zip
    ) {
      applyJobsiteFields(setField, applyUSAddressToPourPlanner({}, normalized));
    }

    const validation = validateUSAddress(normalized, {
      requireStreet: true,
      requireZip: false,
    });
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }
    return verifyJobsiteAddress(normalized);
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
      const verified = await resolveVerifiedJobsite();
      const normalized = normalizeUSAddressInput(jobsiteFromPourPlannerForm(form));
      const merged =
        verified.addressParts ??
        mergeVerifiedJobsiteAddress(normalized, verified.formattedAddress);
      setVerifiedJobsite(verified);
      applyJobsiteFields(setField, applyUSAddressToPourPlanner({}, merged));
      setField('jobsiteAddress', formatUSAddress(merged));
      setField('jobsiteLatitude', String(verified.latitude));
      setField('jobsiteLongitude', String(verified.longitude));
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

    if (hasSavedBatchPlant(selectedProject) && form.batchPlantName.trim()) {
      setFindPlantError(null);
      const saved = getSavedPlacementOrder(selectedProject);
      if (saved?.batchPlantName) {
        setField('batchPlantName', saved.batchPlantName);
      }
      if (saved?.batchPlantAddress) {
        setField('batchPlantAddress', saved.batchPlantAddress);
      }
      return;
    }

    setFindPlantLoading(true);
    setFindPlantError(null);
    setRouteError(null);
    setFoundPlant(null);

    try {
      let jobsite = verifiedJobsite;
      if (!jobsite) {
        jobsite = await resolveVerifiedJobsite();
        const normalized = normalizeUSAddressInput(jobsiteFromPourPlannerForm(form));
        const merged =
          jobsite.addressParts ??
          mergeVerifiedJobsiteAddress(normalized, jobsite.formattedAddress);
        setVerifiedJobsite(jobsite);
        applyJobsiteFields(setField, applyUSAddressToPourPlanner({}, merged));
        setField('jobsiteAddress', formatUSAddress(merged));
        setField('jobsiteLatitude', String(jobsite.latitude));
        setField('jobsiteLongitude', String(jobsite.longitude));
      }

      const plant = await findBatchPlant(jobsite.formattedAddress, {
        latitude: jobsite.latitude,
        longitude: jobsite.longitude,
      });
      setFoundPlant(plant);
      setField('batchPlantName', plant.plantName);
      setField('batchPlantAddress', plant.formattedAddress);
      setField('batchPlantLatitude', String(plant.latitude));
      setField('batchPlantLongitude', String(plant.longitude));

      setTravelLoading(true);
      try {
        const route = await getMapboxTravelTime(
          plant.formattedAddress,
          jobsite.formattedAddress,
          {
            plant: { latitude: plant.latitude, longitude: plant.longitude },
            jobsite: { latitude: jobsite.latitude, longitude: jobsite.longitude },
          },
        );
        setField('travelDistance', String(route.distanceMiles));
        setField('travelTimeMinutes', String(route.travelMinutes));
        if (route.avgSpeedMph > 0) {
          setField('truckSpeed', String(route.avgSpeedMph));
        }

        if (!hasSavedBatchPlantContact(selectedProject)) {
          try {
            const contact = await lookupBatchPlantContact({
              plantName: plant.plantName,
              plantAddress: plant.formattedAddress,
              latitude: plant.latitude,
              longitude: plant.longitude,
            });
            if (contact.phone) setField('batchPlantPhone', contact.phone);
            if (contact.email) setField('batchPlantEmail', contact.email);
            if (contact.dispatchContact) {
              setField('batchPlantDispatchContact', contact.dispatchContact);
            }
            if (contact.website) setField('batchPlantWebsite', contact.website);
            setField('batchPlantContactSource', 'ai');
          } catch {
            /* contact lookup is optional; user can enter manually on call sheet */
          }
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
  const formattedPreview = formatUSAddress(jobsiteAddr);

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
                  { value: '', label: 'Select a project' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                  { value: CUSTOM_PROJECT_VALUE, label: 'Custom pour (manual name)' },
                ]}
                value={projectSelectValue}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Jobsite address
              </label>
              {usingSavedProject && projectHasAddress && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseProjectAddress}
                  className="whitespace-nowrap self-start sm:self-auto"
                >
                  Use project address
                </Button>
              )}
            </div>
            <USAddressFields
              value={jobsiteAddr}
              onChange={handleJobsiteAddressChange}
              idPrefix="pour-jobsite"
            />
            {formattedPreview && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Formatted: {formattedPreview}
              </p>
            )}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleVerifyJobsite}
                disabled={!hasJobsiteAddress || verifyLoading || isSearching}
                className="whitespace-nowrap"
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
              Street, city, and state/territory are required for verify and batch plant search. ZIP
              is optional but improves accuracy. US and territories only.
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
                    setField('batchPlantName', '');
                    setField('batchPlantLatitude', '');
                    setField('batchPlantLongitude', '');
                    setFoundPlant(null);
                    setFindPlantError(null);
                    setRouteError(null);
                  }}
                  placeholder="Ready-mix plant (from search or manual entry)"
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
                Complete and verify the jobsite address to search for nearby batch plants.
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
