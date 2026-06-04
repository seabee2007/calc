import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import ReadyMixDelivery from '../../calculations/ReadyMixDelivery';
import DeliveryClock from '../DeliveryClock';
import PlannerStepLocationsCard from '../PlannerStepLocationsCard';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { getMapboxTravelTime } from '../../../services/mapboxTravelService';
import {
  batchPlantDisplayLine,
  jobsiteDisplayAddress,
  plannerTravelCoords,
} from '../../../utils/addressForm';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepDeliveryLogistics: React.FC<StepProps> = ({ planner }) => {
  const {
    form,
    setField,
    volume,
    preferences,
    deliveryWindow,
    production,
    plannedTruckCount,
    suggestedTruckTypeId,
  } = planner;

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const lastFetchedRef = useRef('');

  const plantAddress = batchPlantDisplayLine(form);
  const jobsiteAddress = jobsiteDisplayAddress(form);
  const travelCoords = plannerTravelCoords(form);
  const canCalculateRoute = plantAddress.length > 0 && jobsiteAddress.length > 0;
  const hasRouteData =
    Boolean(form.travelTimeMinutes && form.travelDistance) &&
    !routeError &&
    !routeLoading;

  const spacingRecommended = Math.round(production.truckSpacingMinutes);
  const multiTruck = plannedTruckCount > 1;

  useEffect(() => {
    if (!canCalculateRoute) {
      lastFetchedRef.current = '';
      return;
    }

    const key = [
      plantAddress,
      jobsiteAddress,
      travelCoords.plant?.lat,
      travelCoords.plant?.lng,
      travelCoords.jobsite?.lat,
      travelCoords.jobsite?.lng,
    ].join('|');
    if (key === lastFetchedRef.current) return;

    let cancelled = false;

    (async () => {
      const hasExistingData = Boolean(form.travelTimeMinutes && form.travelDistance);
      if (!hasExistingData) {
        setRouteLoading(true);
      }
      setRouteError(null);

      try {
        const result = await getMapboxTravelTime(plantAddress, jobsiteAddress, {
          plant: travelCoords.plant
            ? {
                latitude: travelCoords.plant.lat,
                longitude: travelCoords.plant.lng,
              }
            : undefined,
          jobsite: travelCoords.jobsite
            ? {
                latitude: travelCoords.jobsite.lat,
                longitude: travelCoords.jobsite.lng,
              }
            : undefined,
        });
        if (cancelled) return;

        lastFetchedRef.current = key;
        setField('travelDistance', String(result.distanceMiles));
        setField('travelTimeMinutes', String(result.travelMinutes));
        if (result.avgSpeedMph > 0) {
          setField('truckSpeed', String(result.avgSpeedMph));
        }
      } catch (err) {
        if (cancelled) return;
        setRouteError(
          err instanceof Error ? err.message : 'Could not calculate route.',
        );
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canCalculateRoute,
    plantAddress,
    jobsiteAddress,
    travelCoords.plant?.lat,
    travelCoords.plant?.lng,
    travelCoords.jobsite?.lat,
    travelCoords.jobsite?.lng,
    setField,
    form.travelTimeMinutes,
    form.travelDistance,
  ]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Plant → jobsite
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Travel time uses your verified Step 1 map locations when available. Adjust
          buffers and onsite wait against the ASTM C94 discharge window.
        </p>

        <PlannerStepLocationsCard form={form} className="mb-4" />

        {routeLoading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Calculating traffic-aware route…
          </div>
        )}

        {!canCalculateRoute && !routeLoading && (
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Complete Step 1 (verify jobsite and set batch plant) to calculate travel time.
          </p>
        )}

        {routeError && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {routeError}
          </div>
        )}

        {hasRouteData && !routeLoading && (
          <div className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-900/25 text-green-800 dark:text-green-200 text-sm flex gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Route: {form.travelDistance} mi · {form.travelTimeMinutes} min drive
              {form.truckSpeed ? ` · avg ${form.truckSpeed} mph` : ''}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Travel distance (mi)"
            type="number"
            min="0"
            step="0.1"
            value={form.travelDistance}
            onChange={(e) => setField('travelDistance', e.target.value)}
          />
          <Input
            label="Travel time (min)"
            type="number"
            min="0"
            value={form.travelTimeMinutes}
            onChange={(e) => setField('travelTimeMinutes', e.target.value)}
          />
          <Input
            label="Avg truck speed (mph)"
            type="number"
            min="0"
            value={form.truckSpeed}
            onChange={(e) => setField('truckSpeed', e.target.value)}
          />
          <Input
            label="Traffic buffer (min)"
            type="number"
            min="0"
            value={form.trafficBufferMinutes}
            onChange={(e) => setField('trafficBufferMinutes', e.target.value)}
          />
          <Input
            label="Site wait (min)"
            type="number"
            min="0"
            value={form.siteWaitMinutes}
            onChange={(e) => setField('siteWaitMinutes', e.target.value)}
          />
          <Input
            label="Washout delay (min)"
            type="number"
            min="0"
            value={form.washoutDelayMinutes}
            onChange={(e) => setField('washoutDelayMinutes', e.target.value)}
          />
        </div>

        <div className="mt-6">
          <DeliveryClock
            analysis={deliveryWindow}
            drumRpm={form.drumRpm}
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Truck schedule
        </h3>
        <ReadyMixDelivery
          volume={volume}
          volumeUnit={preferences.volumeUnit}
          defaultTruckTypeId={suggestedTruckTypeId}
        />

        <Card className="p-4 mt-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Truck capacity (yd³)"
              type="number"
              min="0"
              value={form.truckCapacityYd}
              onChange={(e) => setField('truckCapacityYd', e.target.value)}
            />
            <Input
              label="Number of trucks"
              type="number"
              min="1"
              value={form.numberOfTrucks}
              onChange={(e) => setField('numberOfTrucks', e.target.value)}
              helperText={
                plannedTruckCount > 0
                  ? `Recommended: ${plannedTruckCount} for this volume`
                  : undefined
              }
            />
            <Input
              label="Truck spacing interval (min)"
              type="number"
              min="0"
              value={form.truckSpacingMinutes}
              onChange={(e) => setField('truckSpacingMinutes', e.target.value)}
              disabled={!multiTruck}
              placeholder={multiTruck ? String(spacingRecommended) : 'N/A'}
              helperText={
                multiTruck
                  ? `Recommended: ~${spacingRecommended} min between arrivals (per-truck discharge time)`
                  : 'Not used for a single-truck placement'
              }
            />
            <Input
              label="Drum RPM"
              type="number"
              min="0"
              step="0.5"
              value={form.drumRpm}
              onChange={(e) => setField('drumRpm', e.target.value)}
            />
          </div>
        </Card>
      </section>
    </div>
  );
};

export default StepDeliveryLogistics;
