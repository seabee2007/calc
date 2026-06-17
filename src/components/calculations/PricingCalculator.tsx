import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DollarSign, Truck, Clock, Calendar, MapPin, Factory, Loader2, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { calculateConcreteCost, formatPrice } from '../../utils/readyMixCost';
import { volumeToCubicYards } from '../../utils/readyMixDelivery';
import type { LocationPricing, VolumeUnit } from '../../types';
import { GeocodedLocation } from '../../utils/location';
import JobsiteLocationSection from '../address/JobsiteLocationSection';
import { EMPTY_US_ADDRESS, type USAddress } from '../../types/address';
import ReadyMixDelivery from './ReadyMixDelivery';
import { findBatchPlant, BatchPlantNotFoundError, type BatchPlantResult } from '../../services/batchPlantService';
import { lookupBatchPlantPricing } from '../../services/batchPlantPricingService';
import { getMapboxTravelTime } from '../../services/mapboxTravelService';
import {
  buildSupplierFromPlant,
  mapPricingApiResponse,
  regionalDefaultsFromLocation,
} from '../../utils/supplierPricing';
import { useProjectStore } from '../../store';
import { isUsageLimitError } from '../../lib/usageMetering';
import {
  DEFAULT_BATCH_PLANT_CONTACT,
  type PlacementOrder,
} from '../../types/placementOrder';
import {
  CALCULATOR_SECTION_SUBTITLE,
  CALCULATOR_SECTION_TITLE,
} from '../../theme/appTheme';

export type PricingCalculatorVariant = 'calculator' | 'planner';

interface PricingCalculatorProps {
  volume: number;
  volumeUnit?: VolumeUnit;
  psi?: string;
  variant?: PricingCalculatorVariant;
  initialLocation?: GeocodedLocation | null;
  projectJobsite?: USAddress;
  projectName?: string;
  projectId?: string;
  onPricingCalculated?: (pricing: {
    concreteCost: number;
    pricePerYard: number;
    deliveryFees: {
      baseDeliveryFee: number;
      smallLoadFee: number;
      distanceFee: number;
      totalDeliveryFees: number;
    };
    additionalServices: {
      pumpTruckFee: number;
      saturdayFee: number;
      afterHoursFee: number;
      totalAdditionalFees: number;
    };
    totalCost: number;
    supplier?: {
      id: string;
      name: string;
      location: string;
    };
  } | null) => void;
}

interface JobsiteCoords {
  latitude: number;
  longitude: number;
  address: string;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  volume,
  volumeUnit = 'cubic_yards',
  psi = '3000',
  variant = 'calculator',
  initialLocation = null,
  projectJobsite,
  projectName,
  projectId,
  onPricingCalculated,
}) => {
  const isPlanner = variant === 'planner';
  const { projects, updateProject } = useProjectStore();

  const [distance, setDistance] = useState(10);
  const [needsPumpTruck, setNeedsPumpTruck] = useState(false);
  const [isSaturday, setIsSaturday] = useState(false);
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [supplier, setSupplier] = useState<LocationPricing | null>(null);
  const [jobsiteAddress, setJobsiteAddress] = useState<USAddress>({ ...EMPTY_US_ADDRESS });
  const [jobsiteCoords, setJobsiteCoords] = useState<JobsiteCoords | null>(null);
  const [batchPlant, setBatchPlant] = useState<BatchPlantResult | null>(null);
  const [plantSearchLoading, setPlantSearchLoading] = useState(false);
  const [plantSearchError, setPlantSearchError] = useState<string | null>(null);
  const [aiPricingLoading, setAiPricingLoading] = useState(false);
  const [aiPricingError, setAiPricingError] = useState<string | null>(null);
  const [pricingSourceLabel, setPricingSourceLabel] = useState<string | null>(null);
  const [pricingNotes, setPricingNotes] = useState<string | null>(null);

  const mapLocationLimitMessage = () =>
    "You've reached your monthly map/location lookup limit.";
  const aiLimitMessage = () => "You've reached your monthly AI request limit.";

  const applyRegionalPricing = useCallback(
    (
      plant: BatchPlantResult,
      coords: JobsiteCoords,
      travelMiles: number,
    ) => {
      const { defaults } = regionalDefaultsFromLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      const pricingLookup = mapPricingApiResponse({
        usedAiPricing: false,
        basePrice: defaults!.basePrice,
        psiPriceAdjustments: defaults!.psiPriceAdjustments,
        deliveryFees: {
          baseDeliveryFee: defaults!.baseDeliveryFee,
          minimumOrder: defaults!.minimumOrder,
          smallLoadFee: defaults!.smallLoadFee,
          distanceFee: defaults!.distanceFeePerMile,
          baseDistance: defaults!.baseDistanceMiles,
        },
        additionalServices: {
          saturdayDeliveryFee: defaults!.saturdayDeliveryFee,
          afterHoursFee: defaults!.afterHoursFee,
          pumpTruckFee: defaults!.pumpTruckFee,
        },
        confidence: 'medium',
        notes: `Using regional default pricing (${defaults!.regionLabel}). Tap AI pricing for a plant-specific estimate.`,
        source: 'regional_default',
      });
      const bundle = buildSupplierFromPlant(plant, pricingLookup, coords, travelMiles);
      setSupplier(bundle.supplier);
      setPricingSourceLabel('Regional default pricing');
      setPricingNotes(bundle.pricingNotes);
    },
    [],
  );

  const applyJobsiteCoords = useCallback((loc: GeocodedLocation) => {
    setJobsiteCoords({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
    });
    setBatchPlant(null);
    setSupplier(null);
    setPricingSourceLabel(null);
    setPricingNotes(null);
    setPlantSearchError(null);
    setAiPricingError(null);
  }, []);

  const initialLocationKey =
    initialLocation != null
      ? `${initialLocation.latitude.toFixed(5)},${initialLocation.longitude.toFixed(5)}`
      : '';

  useEffect(() => {
    if (!initialLocation) return;
    applyJobsiteCoords(initialLocation);
    // Only re-run when coordinates change, not when parent passes a new object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocationKey, applyJobsiteCoords]);

  const persistBatchPlantToProject = useCallback(
    async (
      plant: BatchPlantResult,
      travel?: { travelTimeMinutes: number; travelDistanceMi: number },
    ) => {
      if (!projectId) return;
      const project = projects.find((p) => p.id === projectId);
      const existing: PlacementOrder | undefined = project?.placementOrder;
      const order: PlacementOrder = {
        ...existing,
        status: existing?.status ?? 'draft',
        contact: existing?.contact ?? { ...DEFAULT_BATCH_PLANT_CONTACT },
        orderNotes: existing?.orderNotes ?? '',
        updatedAt: new Date().toISOString(),
        batchPlantName: plant.plantName,
        batchPlantAddress: plant.formattedAddress,
        ...(travel
          ? {
              travelTimeMinutes: Math.round(travel.travelTimeMinutes),
              travelDistanceMi: travel.travelDistanceMi,
            }
          : {}),
      };
      try {
        await updateProject(projectId, { placementOrder: order });
      } catch {
        /* non-blocking */
      }
    },
    [projectId, projects, updateProject],
  );

  const runBatchPlantSearch = useCallback(
    async (coords: JobsiteCoords) => {
      setPlantSearchLoading(true);
      setPlantSearchError(null);
      setAiPricingError(null);

      try {
        const plant = await findBatchPlant(coords.address, {
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setBatchPlant(plant);
        if (plant.distanceMiles > 0) {
          setDistance(Math.max(1, Math.round(plant.distanceMiles * 10) / 10));
        }

        let travelMiles = plant.distanceMiles ?? 10;
        let routeTravel: { travelTimeMinutes: number; travelDistanceMi: number } | undefined;
        try {
          const route = await getMapboxTravelTime(
            plant.formattedAddress,
            coords.address,
            {
              plant: { latitude: plant.latitude, longitude: plant.longitude },
              jobsite: { latitude: coords.latitude, longitude: coords.longitude },
            },
          );
          travelMiles = route.distanceMiles;
          routeTravel = {
            travelTimeMinutes: route.travelMinutes,
            travelDistanceMi: route.distanceMiles,
          };
          setDistance(Math.max(1, Math.round(route.distanceMiles * 10) / 10));
        } catch {
          setDistance(Math.max(1, Math.round((plant.distanceMiles ?? 10) * 10) / 10));
        }

        await persistBatchPlantToProject(plant, routeTravel);
        applyRegionalPricing(plant, coords, travelMiles);
      } catch (err) {
        setBatchPlant(null);
        setSupplier(null);
        if (isUsageLimitError(err)) {
          setPlantSearchError(mapLocationLimitMessage());
        } else if (err instanceof BatchPlantNotFoundError) {
          setPlantSearchError(err.message);
        } else {
          setPlantSearchError(
            err instanceof Error ? err.message : 'Could not find a nearby batch plant.',
          );
        }
      } finally {
        setPlantSearchLoading(false);
      }
    },
    [applyRegionalPricing, persistBatchPlantToProject],
  );

  const runAiPricingEstimate = useCallback(async () => {
    if (!batchPlant || !jobsiteCoords) return;
    setAiPricingLoading(true);
    setAiPricingError(null);

    try {
      const { defaults } = regionalDefaultsFromLocation({
        latitude: jobsiteCoords.latitude,
        longitude: jobsiteCoords.longitude,
      });
      const pricingLookup = await lookupBatchPlantPricing({
        plantName: batchPlant.plantName,
        plantAddress: batchPlant.formattedAddress,
        plantLatitude: batchPlant.latitude,
        plantLongitude: batchPlant.longitude,
        jobsiteAddress: jobsiteCoords.address,
        regionalDefaults: defaults,
      });
      const bundle = buildSupplierFromPlant(
        batchPlant,
        pricingLookup,
        jobsiteCoords,
        distance,
      );
      setSupplier(bundle.supplier);
      setPricingSourceLabel(
        bundle.pricingSource === 'ai_estimate'
          ? 'AI-estimated plant pricing'
          : 'Regional default pricing',
      );
      setPricingNotes(bundle.pricingNotes);
    } catch (err) {
      if (isUsageLimitError(err)) {
        setAiPricingError(aiLimitMessage());
      } else {
        setAiPricingError(
          err instanceof Error ? err.message : 'Could not estimate supplier pricing.',
        );
      }
    } finally {
      setAiPricingLoading(false);
    }
  }, [batchPlant, jobsiteCoords, distance]);

  const linkedProject = projectId
    ? projects.find((p) => p.id === projectId)
    : undefined;
  const wasteFactorPercent = linkedProject?.wasteFactor ?? 10;

  const volumeYd = useMemo(
    () => volumeToCubicYards(volume, volumeUnit),
    [volume, volumeUnit],
  );

  const orderVolumeYd = useMemo(
    () => volumeYd * (1 + wasteFactorPercent / 100),
    [volumeYd, wasteFactorPercent],
  );

  const pricing = useMemo(() => {
    return calculateConcreteCost(
      volumeYd,
      psi,
      distance,
      {
        needsPumpTruck,
        isSaturdayDelivery: isSaturday,
        isAfterHoursDelivery: isAfterHours,
        wasteFactorPercent,
      },
      supplier,
    );
  }, [
    volumeYd,
    psi,
    distance,
    needsPumpTruck,
    isSaturday,
    isAfterHours,
    supplier,
    wasteFactorPercent,
  ]);

  const serviceFeeRates = useMemo(() => {
    if (!supplier) return null;
    const add = supplier.pricing.additionalServices;
    const pump =
      add.pumpTruckFees[supplier.id] ?? Object.values(add.pumpTruckFees)[0] ?? 0;
    return {
      pump,
      saturday: add.saturdayDeliveryFee,
      afterHours: add.afterHoursFee,
    };
  }, [supplier]);

  const hasAdditionalLineItems =
    needsPumpTruck || isSaturday || isAfterHours;

  const onPricingCalculatedRef = useRef(onPricingCalculated);
  onPricingCalculatedRef.current = onPricingCalculated;

  const lastPricingNotifyRef = useRef<string | null>(null);

  useEffect(() => {
    const notify = onPricingCalculatedRef.current;
    if (!notify) return;

    if (!supplier) {
      if (lastPricingNotifyRef.current === 'none') return;
      lastPricingNotifyRef.current = 'none';
      notify(null);
      return;
    }

    const signature = [
      pricing.totalCost,
      pricing.concreteCost,
      pricing.pricePerYard,
      pricing.deliveryFees.totalDeliveryFees,
      pricing.additionalServices.totalAdditionalFees,
      supplier.id,
      needsPumpTruck,
      isSaturday,
      isAfterHours,
      distance,
      wasteFactorPercent,
    ].join('|');

    if (lastPricingNotifyRef.current === signature) return;
    lastPricingNotifyRef.current = signature;

    notify({
      ...pricing,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        location: supplier.address,
      },
    });
  }, [
    pricing.totalCost,
    pricing.concreteCost,
    pricing.pricePerYard,
    pricing.deliveryFees.totalDeliveryFees,
    pricing.additionalServices.totalAdditionalFees,
    supplier?.id,
    supplier?.name,
    supplier?.address,
    needsPumpTruck,
    isSaturday,
    isAfterHours,
    distance,
    wasteFactorPercent,
  ]);

  const volumeUnitLabel =
    volumeUnit === 'cubic_yards' ? 'yd³' : volumeUnit === 'cubic_feet' ? 'ft³' : 'm³';

  return (
    <Card className="p-4">
      {isPlanner ? (
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h3 className={CALCULATOR_SECTION_TITLE}>
              Ready-Mixed Concrete
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Delivery planning, supplier location, and cost estimate
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      ) : (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Price Breakdown
        </h3>
      )}

      {isPlanner && <ReadyMixDelivery volume={volume} volumeUnit={volumeUnit} />}

      {isPlanner && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            Cost Estimate
          </h3>
            <p className={`${CALCULATOR_SECTION_SUBTITLE} mb-4`}>
            {volume.toFixed(2)} {volumeUnitLabel}
            <span className="text-gray-500 dark:text-gray-500">
              {' '}
              ({volumeYd.toFixed(2)} yd³ net · {orderVolumeYd.toFixed(2)} yd³ order @{' '}
              {wasteFactorPercent}% waste)
            </span>
          </p>
        </div>
      )}

      <div className={isPlanner ? '' : 'mb-4'}>
        {!isPlanner && (
            <p className={`${CALCULATOR_SECTION_SUBTITLE} mb-4`}>
            {volume.toFixed(2)} {volumeUnitLabel}
            <span className="text-gray-500 dark:text-gray-500">
              {' '}
              ({volumeYd.toFixed(2)} yd³)
            </span>
          </p>
        )}

        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Jobsite & batch plant
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Verify the jobsite, then find the nearest ready-mix plant to price this estimate.
        </p>

        <JobsiteLocationSection
          projectName={projectName}
          projectJobsite={projectJobsite}
          value={jobsiteAddress}
          onChange={setJobsiteAddress}
          onLocationApplied={applyJobsiteCoords}
          idPrefix="pricing-jobsite"
          applyButtonLabel="Verify jobsite"
          helperText="Enter or verify the jobsite address, then use Supplier tools below to find a batch plant."
          showUseCurrentLocation
        />

        {/* ── Supplier tools ── */}
        <div className="mt-4 rounded-lg border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 space-y-4">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Factory className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Supplier tools
          </h5>

          {/* Find batch plant */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!jobsiteCoords || plantSearchLoading}
                onClick={() => jobsiteCoords && void runBatchPlantSearch(jobsiteCoords)}
                data-testid="find-batch-plant-button"
                icon={
                  plantSearchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Factory className="h-4 w-4" />
                  )
                }
              >
                {plantSearchLoading
                  ? 'Searching…'
                  : batchPlant
                    ? 'Find batch plants again'
                    : 'Find nearby batch plants'}
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Uses map/location credits.
              </span>
            </div>

            {!jobsiteCoords && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Verify the jobsite address above to search for nearby batch plants.
              </p>
            )}

            {plantSearchError && (
              <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                <p>{plantSearchError}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Mapbox may not list every ready-mix plant. If you know a local supplier, enter
                  their address manually on the placement planner call sheet.
                </p>
              </div>
            )}

            {batchPlant && (
              <div className="space-y-1 text-sm pt-1">
                <p className="font-medium text-gray-900 dark:text-white">{batchPlant.plantName}</p>
                <p className="text-gray-600 dark:text-gray-400">{batchPlant.formattedAddress}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {batchPlant.distanceMiles.toFixed(1)} mi drive to jobsite
                  {batchPlant.driveMinutes ? ` · ~${batchPlant.driveMinutes} min` : ''}
                </p>
                {pricingSourceLabel && (
                  <p className="text-xs text-cyan-700 dark:text-cyan-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {pricingSourceLabel}
                  </p>
                )}
                {pricingNotes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{pricingNotes}</p>
                )}
              </div>
            )}
          </div>

          {/* AI pricing — only shown once a batch plant is found */}
          {batchPlant ? (
            <div className="space-y-2 border-t border-cyan-200 dark:border-cyan-800/60 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={aiPricingLoading}
                  onClick={() => void runAiPricingEstimate()}
                  data-testid="ai-pricing-button"
                  icon={
                    aiPricingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )
                  }
                >
                  {aiPricingLoading ? 'Estimating…' : 'Estimate supplier pricing with AI'}
                </Button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Uses AI credits.
                </span>
              </div>
              {aiPricingError && (
                <p className="text-sm text-red-600 dark:text-red-400">{aiPricingError}</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Delivery distance (plant → jobsite, miles)
          </label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
            fullWidth
          />
        </div>

        {(jobsiteCoords || batchPlant) && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
            {jobsiteCoords && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Jobsite</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{jobsiteCoords.address}</p>
                </div>
              </div>
            )}
            {batchPlant && supplier && (
              <div className="flex items-start">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pricing supplier
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.name}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Additional services
        </h4>
        {!supplier && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Verify the jobsite and find a batch plant to price pump, Saturday, and after-hours
            delivery options.
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <input
              type="checkbox"
              id={isPlanner ? 'planner-pumpTruck' : 'pumpTruck'}
              checked={needsPumpTruck}
              disabled={!supplier}
              onChange={(e) => setNeedsPumpTruck(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded disabled:opacity-50"
            />
            <label
              htmlFor={isPlanner ? 'planner-pumpTruck' : 'pumpTruck'}
              className={`text-sm flex items-center min-w-0 ${
                supplier
                  ? 'text-gray-600 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Truck className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400 shrink-0" />
              Need Pump Truck
            </label>
          </div>
          {serviceFeeRates && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
              {formatPrice(serviceFeeRates.pump)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <input
              type="checkbox"
              id={isPlanner ? 'planner-saturdayDelivery' : 'saturdayDelivery'}
              checked={isSaturday}
              disabled={!supplier}
              onChange={(e) => setIsSaturday(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded disabled:opacity-50"
            />
            <label
              htmlFor={isPlanner ? 'planner-saturdayDelivery' : 'saturdayDelivery'}
              className={`text-sm flex items-center min-w-0 ${
                supplier
                  ? 'text-gray-600 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Calendar className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400 shrink-0" />
              Saturday Delivery
            </label>
          </div>
          {serviceFeeRates && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
              {formatPrice(serviceFeeRates.saturday)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <input
              type="checkbox"
              id={isPlanner ? 'planner-afterHoursDelivery' : 'afterHoursDelivery'}
              checked={isAfterHours}
              disabled={!supplier}
              onChange={(e) => setIsAfterHours(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded disabled:opacity-50"
            />
            <label
              htmlFor={isPlanner ? 'planner-afterHoursDelivery' : 'afterHoursDelivery'}
              className={`text-sm flex items-center min-w-0 ${
                supplier
                  ? 'text-gray-600 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Clock className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400 shrink-0" />
              After Hours Delivery
            </label>
          </div>
          {serviceFeeRates && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
              {formatPrice(serviceFeeRates.afterHours)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        {isPlanner && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Price Breakdown
          </h3>
        )}

        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-300">Concrete ({psi} PSI)</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatPrice(pricing?.pricePerYard || 0)}/yd³
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span className="text-gray-900 dark:text-white">
                Concrete Cost ({volumeYd.toFixed(2)} yd³)
              </span>
              <span className="text-blue-700 dark:text-blue-300">
                {formatPrice(pricing?.concreteCost || 0)}
              </span>
            </div>
          </div>

          {pricing?.deliveryFees && supplier && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Delivery Fees</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Base delivery</span>
                  <span>{formatPrice(pricing.deliveryFees.baseDeliveryFee)}</span>
                </div>
                {pricing.deliveryFees.smallLoadFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Small load</span>
                    <span>{formatPrice(pricing.deliveryFees.smallLoadFee)}</span>
                  </div>
                )}
                {pricing.deliveryFees.distanceFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Distance ({distance} mi)</span>
                    <span>{formatPrice(pricing.deliveryFees.distanceFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total Delivery Fees</span>
                <span>{formatPrice(pricing.deliveryFees.totalDeliveryFees)}</span>
              </div>
            </div>
          )}

          {supplier && hasAdditionalLineItems && pricing?.additionalServices && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Additional Services
              </h4>
              <div className="space-y-1 text-sm">
                {needsPumpTruck && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" />
                      Pump truck
                    </span>
                    <span>{formatPrice(pricing.additionalServices.pumpTruckFee)}</span>
                  </div>
                )}
                {isSaturday && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Saturday delivery
                    </span>
                    <span>{formatPrice(pricing.additionalServices.saturdayFee)}</span>
                  </div>
                )}
                {isAfterHours && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      After hours delivery
                    </span>
                    <span>{formatPrice(pricing.additionalServices.afterHoursFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total additional services</span>
                <span>{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900 dark:text-white">Total Estimated Cost</span>
              <span className="text-blue-700 dark:text-blue-300">
                {formatPrice(pricing?.totalCost || 0)}
              </span>
            </div>
            {!supplier ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Verify the jobsite and find a batch plant to see pricing for your area.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * Estimates only — confirm with the batch plant before bidding.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PricingCalculator;
