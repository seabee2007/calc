import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import ProductionRateLibraryModal from '../../../estimating/ui/components/ProductionRateLibraryModal';
import { buildAssemblyGroupForRate } from '../../../estimating/application/productionRateAssemblyBuilder';
import type { ProductionRateLibraryEntry } from '../../../estimating/data/productionRates/productionRateTypes';
import {
  formatProductionRateDisplayTitle,
  formatProductionRateSubtitle,
} from '../../../estimating/data/productionRates/productionRateDisplayFormatters';
import type {
  BimModelUnit,
  BimSelectedObjectSnapshot,
  BimTakeoffType,
  TakeoffConfidence,
  TakeoffSource,
} from '../../types';
import type { BimMeasurementResult } from '../../measurement/bimMeasurementMath';

interface Props {
  selected: BimSelectedObjectSnapshot | null;
  modelUnit: BimModelUnit;
  appliedMeasurement?: BimMeasurementResult | null;
  saving?: boolean;
  onAddToEstimate: (params: {
    rate: ProductionRateLibraryEntry;
    takeoffType: BimTakeoffType;
    takeoffName: string;
    quantity: number;
    unit: string;
    source: TakeoffSource;
    confidence: TakeoffConfidence;
    notes?: string | null;
    measurement?: BimMeasurementResult | null;
  }) => void | Promise<void>;
}

const CONFIDENCE_LABELS: Record<TakeoffConfidence, string> = {
  manual: 'Manual verified',
  calculated_from_geometry: 'Calculated from geometry',
  measured_from_model: 'Measured from model',
  model_property: 'Model property',
  needs_review: 'Needs review',
};

const CARD_CLASS =
  'space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70';
const LABEL_CLASS = 'block text-xs font-medium text-slate-600 dark:text-slate-400';
const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';
const SELECT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';

function feetPerModelUnit(unit: BimModelUnit): number {
  switch (unit) {
    case 'feet':
      return 1;
    case 'inches':
      return 1 / 12;
    case 'millimeters':
      return 0.00328084;
    case 'meters':
    default:
      return 3.28084;
  }
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getSuggestedTakeoffQuantity(
  selected: BimSelectedObjectSnapshot | null,
  takeoffType: BimTakeoffType | '',
  modelUnit: BimModelUnit,
): { quantity: number; unit: string; unavailableReason?: string } {
  if (!selected) return { quantity: 0, unit: 'EA' };
  const factor = feetPerModelUnit(modelUnit);

  switch (takeoffType) {
    case 'count':
      return { quantity: 1, unit: 'EA' };
    case 'line':
      return { quantity: 1, unit: 'LF' };
    case 'area': {
      const area = selected.geometryMetrics.approximateSurfaceArea ?? 0;
      if (area <= 0) return { quantity: 0, unit: 'SF', unavailableReason: 'Area unavailable for this object.' };
      return { quantity: roundQuantity(area * factor * factor), unit: 'SF' };
    }
    case 'volume': {
      const volume = selected.geometryMetrics.approximateVolume ?? 0;
      if (volume <= 0) {
        return {
          quantity: 0,
          unit: 'CY',
          unavailableReason: 'Volume unavailable for this object. Use manual quantity or area takeoff.',
        };
      }
      return { quantity: roundQuantity((volume * factor * factor * factor) / 27), unit: 'CY' };
    }
    case 'manual':
      return { quantity: 1, unit: 'EA' };
    default:
      return { quantity: 0, unit: '' };
  }
}

function isGeometryTakeoff(type: BimTakeoffType | ''): boolean {
  return type === 'area' || type === 'volume';
}

function displayObjectName(selected: BimSelectedObjectSnapshot): string {
  return selected.takeoffName?.trim() || selected.name?.trim() || 'Unnamed mesh';
}

export default function BimTakeoffMappingPanel({
  selected,
  modelUnit,
  appliedMeasurement = null,
  saving = false,
  onAddToEstimate,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ProductionRateLibraryEntry | null>(null);
  const [takeoffType, setTakeoffType] = useState<BimTakeoffType | ''>('');
  const [takeoffName, setTakeoffName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [source, setSource] = useState<TakeoffSource>('manual');
  const [confidence, setConfidence] = useState<TakeoffConfidence>('manual');
  const [geometryConfirmed, setGeometryConfirmed] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setTakeoffName(selected ? displayObjectName(selected) : '');
    setTakeoffType('');
    setQuantity('');
    setUnit('');
    setSource('manual');
    setConfidence('manual');
    setGeometryConfirmed(false);
    setNotes('');
  }, [selected?.externalObjectId]);

  useEffect(() => {
    if (!appliedMeasurement) return;
    setTakeoffType(appliedMeasurement.mode === 'line' ? 'line' : 'area');
    setQuantity(String(appliedMeasurement.quantity));
    setUnit(appliedMeasurement.unit);
    setSource('measured_from_model');
    setConfidence('measured_from_model');
    setGeometryConfirmed(true);
    setNotes((current) => current || 'Measured from 3D model. Verify measurement before bidding.');
  }, [appliedMeasurement]);

  const suggestion = useMemo(
    () => getSuggestedTakeoffQuantity(selected, takeoffType, modelUnit),
    [selected, takeoffType, modelUnit],
  );

  const applyTakeoffType = (nextType: BimTakeoffType) => {
    setTakeoffType(nextType);
    const nextSuggestion = getSuggestedTakeoffQuantity(selected, nextType, modelUnit);
    setQuantity(nextSuggestion.quantity > 0 ? String(nextSuggestion.quantity) : '');
    setUnit(nextSuggestion.unit);
    setGeometryConfirmed(false);
    if (isGeometryTakeoff(nextType)) {
      setSource('calculated_from_geometry');
      setConfidence('calculated_from_geometry');
    } else {
      setSource('manual');
      setConfidence('manual');
    }
  };

  const handleRateSelect = (entry: ProductionRateLibraryEntry) => {
    setSelectedRate(entry);
    setLibraryOpen(false);
  };

  const needsGeometryConfirmation = isGeometryTakeoff(takeoffType) && source === 'calculated_from_geometry';
  const geometryAllowed = !needsGeometryConfirmation || geometryConfirmed;
  const canSubmit = Boolean(
    selected &&
      selectedRate &&
      takeoffType &&
      Number(quantity) > 0 &&
      unit.trim() &&
      geometryAllowed &&
      !suggestion.unavailableReason &&
      !saving,
  );

  return (
    <div className={CARD_CLASS} data-testid="bim-takeoff-mapping">
      <div>
        <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">Create Takeoff Item</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select a model object, choose how to measure it, then map it to a production rate.
        </p>
      </div>

      {!selected ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          Select a model object to create a takeoff item.
        </div>
      ) : null}

      <label className={LABEL_CLASS}>
        Takeoff name
        <input
          value={takeoffName}
          onChange={(event) => setTakeoffName(event.target.value)}
          placeholder="Roof area, Exterior wall, Deck surface…"
          className={INPUT_CLASS}
          disabled={!selected}
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">Takeoff type</p>
        <div className="grid grid-cols-2 gap-2">
          {(['count', 'line', 'area', 'volume', 'manual'] as const).map((type) => {
            const disabled = !selected || (type === 'volume' && getSuggestedTakeoffQuantity(selected, type, modelUnit).quantity <= 0);
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => applyTakeoffType(type)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize ${
                  takeoffType === type
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-100'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-500/30 dark:hover:bg-slate-900'
                } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500`}
              >
                {type}
              </button>
            );
          })}
        </div>
        {takeoffType === 'volume' && suggestion.unavailableReason ? (
          <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">{suggestion.unavailableReason}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-slate-200">Quantity source</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={source === 'manual'}
              onChange={() => {
                setSource('manual');
                setConfidence('manual');
                setGeometryConfirmed(false);
              }}
              disabled={!selected}
            />
            Manual
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={source === 'calculated_from_geometry'}
              onChange={() => {
                setSource('calculated_from_geometry');
                setConfidence('calculated_from_geometry');
              }}
              disabled={!selected || !isGeometryTakeoff(takeoffType)}
            />
            Calculated from geometry
          </label>
          <label className="flex items-center gap-2 text-slate-500 dark:text-slate-500">
            <input type="radio" disabled checked={false} readOnly />
            Model property (later)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={source === 'measured_from_model'}
              onChange={() => {
                setSource('measured_from_model');
                setConfidence('measured_from_model');
              }}
              disabled={!selected || !appliedMeasurement}
            />
            Measured from model
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        disabled={!selected}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/15 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        <BookOpen className="h-4 w-4" />
        {selectedRate ? 'Change production rate' : 'Select production rate'}
      </button>

      {selectedRate ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
          <p className="font-medium text-slate-950 dark:text-white">{formatProductionRateDisplayTitle(selectedRate)}</p>
          <p className="text-xs text-cyan-700 dark:text-cyan-200/80">{formatProductionRateSubtitle(selectedRate)}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Division {selectedRate.divisionCode} · Unit {selectedRate.unit}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className={LABEL_CLASS}>
          Quantity
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={INPUT_CLASS}
            disabled={!selected}
          />
        </label>
        <label className={LABEL_CLASS}>
          Unit
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value.toUpperCase())}
            placeholder="EA, SF, CY"
            className={INPUT_CLASS}
            disabled={!selected}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="text-slate-600 dark:text-slate-400">
          Confidence
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value as TakeoffConfidence)}
            className={SELECT_CLASS}
            disabled={!selected}
          >
            {Object.entries(CONFIDENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-slate-600 dark:text-slate-400">
          Division
          <input
            readOnly
            value={selectedRate?.divisionCode ?? ''}
            placeholder="Select rate"
            className={SELECT_CLASS}
          />
        </label>
      </div>

      {selectedRate && unit && selectedRate.unit && selectedRate.unit !== unit ? (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          Selected production rate is measured in {selectedRate.unit}. Confirm the quantity matches that rate before adding.
        </p>
      ) : null}

      {appliedMeasurement && !appliedMeasurement.calibrated ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          This model is not calibrated. Confirm quantity before adding to estimate.
        </p>
      ) : null}

      {isGeometryTakeoff(takeoffType) ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p>
            Approximate geometry {takeoffType}. Verify before bidding. Model unit is currently{' '}
            <strong>{modelUnit}</strong>.
          </p>
          {suggestion.quantity > 0 ? (
            <p className="mt-1">
              Suggested quantity: {suggestion.quantity} {suggestion.unit}
            </p>
          ) : null}
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={geometryConfirmed}
              onChange={(event) => setGeometryConfirmed(event.target.checked)}
            />
            I verified the model scale and accept this geometry-derived quantity.
          </label>
        </div>
      ) : null}

      <label className={LABEL_CLASS}>
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={INPUT_CLASS}
          placeholder="Measurement assumptions, scale checks, or field notes"
          disabled={!selected}
        />
      </label>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          if (!selectedRate) return;
          void onAddToEstimate({
            rate: selectedRate,
            takeoffType: takeoffType as BimTakeoffType,
            takeoffName: takeoffName.trim() || (selected ? displayObjectName(selected) : '3D takeoff'),
            quantity: Number(quantity),
            unit: unit.trim(),
            source,
            confidence,
            notes: notes.trim() || null,
            measurement: appliedMeasurement,
          });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-500 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:from-cyan-400 dark:to-sky-500 dark:text-slate-950 dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Add Takeoff to Estimate
      </button>

      <ProductionRateLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleRateSelect}
        initialDivisionCode={selectedRate?.divisionCode}
      />
    </div>
  );
}

export { buildAssemblyGroupForRate };
