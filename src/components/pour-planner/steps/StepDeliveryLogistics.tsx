import React, { useState } from 'react';
import { MapPin, Route, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import ReadyMixDelivery from '../../calculations/ReadyMixDelivery';
import DeliveryClock from '../DeliveryClock';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { getMapboxTravelTime } from '../../../services/mapboxTravelService';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepDeliveryLogistics: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, volume, preferences, deliveryWindow, production } =
    planner;

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<{
    plantName: string;
    jobsiteName: string;
  } | null>(null);

  const canCalculateRoute =
    form.batchPlantAddress.trim().length > 0 &&
    form.jobsiteAddress.trim().length > 0;

  const handleCalculateRoute = async () => {
    if (!canCalculateRoute) return;

    setRouteLoading(true);
    setRouteError(null);

    try {
      const result = await getMapboxTravelTime(
        form.batchPlantAddress,
        form.jobsiteAddress,
      );

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
      setRouteError(
        err instanceof Error ? err.message : 'Could not calculate route.',
      );
      setRouteSummary(null);
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Plant → jobsite
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Calculate traffic-aware travel time from Mapbox, then plan onsite wait against
          the ASTM C94 discharge window.
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
                  {form.batchPlantAddress.trim() || 'Enter in Step 1 — Project overview'}
                </p>
                {routeSummary?.plantName && (
                  <p className="text-xs text-gray-500 mt-0.5">{routeSummary.plantName}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500 dark:text-gray-400">Jobsite</span>
                <p className="text-gray-900 dark:text-white">
                  {form.jobsiteAddress.trim() || 'Enter in Step 1 — Project overview'}
                </p>
                {routeSummary?.jobsiteName && (
                  <p className="text-xs text-gray-500 mt-0.5">{routeSummary.jobsiteName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleCalculateRoute}
              disabled={!canCalculateRoute || routeLoading}
              icon={
                routeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Route className="h-4 w-4" />
                )
              }
            >
              {routeLoading ? 'Calculating route…' : 'Calculate route (Mapbox)'}
            </Button>
            {!canCalculateRoute && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add both addresses in Step 1 first.
              </p>
            )}
          </div>

          {routeError && (
            <div className="mt-3 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {routeError}
            </div>
          )}

          {routeSummary && !routeError && (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label="Truck capacity (yd³)"
            type="number"
            min="0"
            step="0.5"
            value={form.truckCapacityYd}
            onChange={(e) => setField('truckCapacityYd', e.target.value)}
          />
          <Input
            label="Number of trucks"
            type="number"
            min="0"
            placeholder={String(production.recommendedTrucks || '')}
            value={form.numberOfTrucks}
            onChange={(e) => setField('numberOfTrucks', e.target.value)}
          />
          <Input
            label="Truck spacing interval (min)"
            type="number"
            min="0"
            placeholder={String(Math.round(production.truckSpacingMinutes) || '')}
            value={form.truckSpacingMinutes}
            onChange={(e) => setField('truckSpacingMinutes', e.target.value)}
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
          <ReadyMixDelivery volume={volume} volumeUnit={preferences.volumeUnit} />
        )}
      </section>

      <DeliveryClock analysis={deliveryWindow} drumRpm={form.drumRpm} />
    </div>
  );
};

export default StepDeliveryLogistics;
