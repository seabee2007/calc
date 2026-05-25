import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import ReadyMixDelivery from '../../calculations/ReadyMixDelivery';
import DeliveryClock from '../DeliveryClock';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { getMapboxTravelTime } from '../../../services/mapboxTravelService';
import { isShortLoad } from '../../../utils/readyMixDelivery';

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
    deliveryPlan,
    plannedTruckCount,
    truckCapacityYd,
    isShortLoadPour,
    suggestedTruckTypeId,
  } = planner;

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<{
    plantName: string;
    jobsiteName: string;
  } | null>(null);
  const lastFetchedRef = useRef('');

  const plantAddress = form.batchPlantAddress.trim();
  const jobsiteAddress = form.jobsiteAddress.trim();
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

    const key = `${plantAddress}|${jobsiteAddress}`;
    if (key === lastFetchedRef.current) return;

    let cancelled = false;

    (async () => {
      const hasExistingData = Boolean(form.travelTimeMinutes && form.travelDistance);
      if (!hasExistingData) {
        setRouteLoading(true);
      }
      setRouteError(null);

      try {
        const result = await getMapboxTravelTime(plantAddress, jobsiteAddress);
        if (cancelled) return;

        lastFetchedRef.current = key;
        setField('travelDistance', String(result.distanceMiles));
        setField('travelTimeMinutes', String(result.travelMinutes));
        if (result.avgSpeedMph > 0) {
          setField('truckSpeed', String(result.avgSpeedMph));
        }
        setRouteSummary({
          plantName: result.plant.placeName,
          jobsiteName: result.jobsite.placeName,
        });
      } catch (err) {
        if (cancelled) return;
        setRouteError(
          err instanceof Error ? err.message : 'Could not calculate route.',
        );
        setRouteSummary(null);
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canCalculateRoute, plantAddress, jobsiteAddress, setField]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Plant → jobsite
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Travel time is calculated automatically from Mapbox when both addresses are set.
          Adjust buffers and onsite wait against the ASTM C94 discharge window.
        </p>

        <Card className="p-4 mb-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Route addresses
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500 dark:text-gray-400">Batch plant</span>
                <p className="text-gray-900 dark:text-white">
                  {plantAddress || 'Enter in Step 1 — Project overview'}
                </p>
                {routeSummary?.plantName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {routeSummary.plantName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500 dark:text-gray-400">Jobsite</span>
                <p className="text-gray-900 dark:text-white">
                  {jobsiteAddress || 'Enter in Step 1 — Project overview'}
                </p>
                {routeSummary?.jobsiteName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {routeSummary.jobsiteName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {routeLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Calculating traffic-aware route…
            </div>
          )}

          {!canCalculateRoute && !routeLoading && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Add both addresses in Step 1 to calculate travel time automatically.
            </p>
          )}

          {routeError && (
            <div className="mt-3 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {routeError}
            </div>
          )}

          {(routeSummary || hasRouteData) && !routeError && !routeLoading && (
            <div className="mt-3 p-3 rounded-md bg-green-50 dark:bg-green-900/25 text-green-800 dark:text-green-200 text-sm flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Traffic-aware route: {form.travelDistance} mi · {form.travelTimeMinutes}{' '}
                min
                {form.truckSpeed ? ` · ~${form.truckSpeed} mph avg` : ''}
              </span>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Travel distance (miles)"
            type="number"
            min="0"
            step="0.1"
            value={form.travelDistance}
            onChange={(e) => setField('travelDistance', e.target.value)}
          />
          <Input
            label="Estimated travel time (min)"
            type="number"
            min="0"
            value={form.travelTimeMinutes}
            onChange={(e) => setField('travelTimeMinutes', e.target.value)}
          />
          <Input
            label="Traffic delay buffer (min)"
            type="number"
            min="0"
            value={form.trafficBufferMinutes}
            onChange={(e) => setField('trafficBufferMinutes', e.target.value)}
          />
          <Input
            label="Average truck speed (mph)"
            type="number"
            min="0"
            step="0.1"
            value={form.truckSpeed}
            onChange={(e) => setField('truckSpeed', e.target.value)}
          />
          <Input
            label="Onsite wait (min)"
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
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Truck information
        </h4>

        {deliveryPlan.volumeYd > 0 && (
          <Card className="p-4 mb-4 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Truck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p>
                  <strong className="text-gray-900 dark:text-white">
                    {plannedTruckCount} truck{plannedTruckCount !== 1 ? 's' : ''}
                  </strong>{' '}
                  for {deliveryPlan.volumeYd.toFixed(1)} yd³
                  {isShortLoadPour && (
                    <span className="text-amber-700 dark:text-amber-300">
                      {' '}
                      (short load — less than one full {truckCapacityYd} yd³ truck)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Load size: up to {truckCapacityYd} yd³ per truck ·{' '}
                  {multiTruck
                    ? `recommended arrival spacing ~${spacingRecommended} min (set in Step 5)`
                    : 'single delivery — no truck spacing needed'}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label="Truck capacity (yd³)"
            type="number"
            min="0"
            step="0.5"
            value={form.truckCapacityYd}
            onChange={(e) => setField('truckCapacityYd', e.target.value)}
            helperText={
              deliveryPlan.volumeYd > 0 && isShortLoad(deliveryPlan.volumeYd, truckCapacityYd)
                ? 'Consider a short-load truck (3–6 yd³) for small pours'
                : undefined
            }
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
                ? `Recommended: ${spacingRecommended} min between arrivals`
                : 'Not used for a single-truck pour'
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

        {volume > 0 && (
          <ReadyMixDelivery
            volume={volume}
            volumeUnit={preferences.volumeUnit}
            defaultTruckTypeId={suggestedTruckTypeId}
          />
        )}
      </section>

      <DeliveryClock analysis={deliveryWindow} drumRpm={form.drumRpm} />
    </div>
  );
};

export default StepDeliveryLogistics;
