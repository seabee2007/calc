import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Eye, EyeOff, Focus, Info } from 'lucide-react';
import {
  BimViewerEngine,
  type BimCalibrationSample,
  type BimViewerObjectNode,
} from '../../viewer/bimViewerEngine';
import { BIM_MODEL_LOAD_ERROR } from '../../services/bimModelUploadValidation';
import type { BimMeasurementMode, BimModelUnit, BimSelectedObjectSnapshot } from '../../types';
import type { BimViewerHeightPreset } from '../bimViewerPanelSize';
import type { BimMeasurementResult } from '../../measurement/bimMeasurementMath';

interface Props {
  signedUrl: string | null;
  selectedExternalId?: string | null;
  hiddenExternalIds?: readonly string[];
  onSelect: (snapshot: BimSelectedObjectSnapshot | null) => void;
  onObjectsParsed?: (snapshots: BimSelectedObjectSnapshot[]) => void;
  onObjectTreeParsed?: (nodes: BimViewerObjectNode[]) => void;
  onVisibilityChange?: (state: Record<string, boolean>) => void;
  onMeasurementChange?: (result: BimMeasurementResult | null) => void;
  onUseMeasurement?: (result: BimMeasurementResult) => void;
  calibrationActive?: boolean;
  calibrationScaleFactor?: number;
  calibrated?: boolean;
  onCalibrationSampleChange?: (sample: BimCalibrationSample | null) => void;
  modelUnit: BimModelUnit;
  scaleConfirmed: boolean;
  layoutResizeSignal?: number;
  onHeightPreset?: (preset: BimViewerHeightPreset) => void;
  className?: string;
}

export default function BimViewer({
  signedUrl,
  selectedExternalId,
  hiddenExternalIds = [],
  onSelect,
  onObjectsParsed,
  onObjectTreeParsed,
  onVisibilityChange,
  onMeasurementChange,
  onUseMeasurement,
  calibrationActive = false,
  calibrationScaleFactor = 1,
  calibrated = false,
  onCalibrationSampleChange,
  modelUnit,
  scaleConfirmed,
  layoutResizeSignal = 0,
  onHeightPreset,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BimViewerEngine | null>(null);
  const onSelectRef = useRef(onSelect);
  const onObjectsParsedRef = useRef(onObjectsParsed);
  const onObjectTreeParsedRef = useRef(onObjectTreeParsed);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  const onMeasurementChangeRef = useRef(onMeasurementChange);
  const onCalibrationSampleChangeRef = useRef(onCalibrationSampleChange);
  const previousHiddenIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measurementMode, setMeasurementMode] = useState<BimMeasurementMode>('off');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [measurement, setMeasurement] = useState<BimMeasurementResult | null>(null);
  const [showMeasureHelp, setShowMeasureHelp] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onObjectsParsedRef.current = onObjectsParsed;
  }, [onObjectsParsed]);

  useEffect(() => {
    onObjectTreeParsedRef.current = onObjectTreeParsed;
  }, [onObjectTreeParsed]);

  useEffect(() => {
    onVisibilityChangeRef.current = onVisibilityChange;
  }, [onVisibilityChange]);

  useEffect(() => {
    onMeasurementChangeRef.current = onMeasurementChange;
  }, [onMeasurementChange]);

  useEffect(() => {
    onCalibrationSampleChangeRef.current = onCalibrationSampleChange;
  }, [onCalibrationSampleChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new BimViewerEngine({
      container,
      onSelect: (snapshot) => onSelectRef.current(snapshot),
      onVisibilityChange: (state) => onVisibilityChangeRef.current?.(state),
      onMeasurementChange: (result) => {
        setMeasurement(result);
        onMeasurementChangeRef.current?.(result);
      },
      onCalibrationSampleChange: (sample) => onCalibrationSampleChangeRef.current?.(sample),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMeasurementContext(modelUnit, scaleConfirmed, calibrationScaleFactor, calibrated);
  }, [modelUnit, scaleConfirmed, calibrationScaleFactor, calibrated]);

  useEffect(() => {
    engineRef.current?.setMeasurementMode(measurementMode);
  }, [measurementMode]);

  useEffect(() => {
    engineRef.current?.setSnapEnabled(snapEnabled);
  }, [snapEnabled]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => engineRef.current?.resize());
    const timeout = window.setTimeout(() => engineRef.current?.resize(), 320);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [layoutResizeSignal]);

  useEffect(() => {
    engineRef.current?.setCalibrationActive(calibrationActive);
  }, [calibrationActive]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!signedUrl) {
      engine.unloadModel();
      onObjectTreeParsedRef.current?.([]);
      onObjectsParsedRef.current?.([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void engine
      .loadModel(signedUrl)
      .then((result) => {
        if (cancelled) return;
        onObjectTreeParsedRef.current?.(result.objectTree);
        onObjectsParsedRef.current?.(result.snapshots);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : BIM_MODEL_LOAD_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  useEffect(() => {
    engineRef.current?.selectByExternalId(selectedExternalId ?? null);
  }, [selectedExternalId]);

  useEffect(() => {
    const hidden = new Set(hiddenExternalIds);
    for (const previousId of previousHiddenIdsRef.current) {
      if (!hidden.has(previousId)) {
        engineRef.current?.setObjectVisibility(previousId, true);
      }
    }
    for (const id of hiddenExternalIds) {
      engineRef.current?.setObjectVisibility(id, false);
    }
    previousHiddenIdsRef.current = hidden;
  }, [hiddenExternalIds, selectedExternalId]);

  return (
    <div className={`relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 dark:border-slate-700 dark:shadow-black/30 ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2">
        <button
          type="button"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          onClick={() => engineRef.current?.fitModel()}
          title="Fit 3D model in view"
        >
          Fit view
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          onClick={() => engineRef.current?.resetView()}
          title="Reset view"
        >
          <RotateCcw className="inline h-3.5 w-3.5" /> Reset
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          onClick={() => engineRef.current?.hideSelected()}
          title="Hide selected"
        >
          <EyeOff className="inline h-3.5 w-3.5" /> Hide
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          onClick={() => engineRef.current?.isolateSelected()}
          title="Isolate selected"
        >
          <Focus className="inline h-3.5 w-3.5" /> Isolate
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          onClick={() => engineRef.current?.resetVisibility()}
          title="Show all"
        >
          <Eye className="inline h-3.5 w-3.5" /> Show all
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Measure controls"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            onMouseEnter={() => setShowMeasureHelp(true)}
            onMouseLeave={() => setShowMeasureHelp(false)}
            onClick={() => setShowMeasureHelp((value) => !value)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {showMeasureHelp ? (
            <div
              role="tooltip"
              className="absolute left-0 top-9 z-20 w-56 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl"
            >
              <p className="font-semibold text-cyan-100">Measure controls</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>Left click: add point</li>
                <li>Right click: undo last point</li>
                <li>Esc: stop measuring</li>
                <li>Clear: remove measurement</li>
                <li>Snap: toggle point snapping</li>
              </ul>
            </div>
          ) : null}
        </div>
        {onHeightPreset ? (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
            {[
              ['fit', 'Fit height'],
              ['60', '60%'],
              ['80', '80%'],
              ['full', 'Full height'],
            ].map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-cyan-500/10 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                onClick={() => onHeightPreset(preset as BimViewerHeightPreset)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-slate-200">
        <span className="font-medium text-slate-400">Measure:</span>
        {(['off', 'line', 'area'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`rounded-md border px-2 py-1 font-medium capitalize transition ${
              measurementMode === mode
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100'
            }`}
            onClick={() => setMeasurementMode(mode)}
          >
            {mode}
          </button>
        ))}
        <button
          type="button"
          className={`rounded-md border px-2 py-1 font-medium transition ${
            snapEnabled
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
          onClick={() => setSnapEnabled((value) => !value)}
        >
          Snap: {snapEnabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-medium text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-100"
          onClick={() => engineRef.current?.clearMeasurement()}
        >
          Clear measure
        </button>
        {measurementMode === 'area' ? (
          <button
            type="button"
            disabled={!measurement || measurement.points.length < 3 || measurement.closed}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-medium text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-slate-600"
            onClick={() => engineRef.current?.closeMeasurement()}
          >
            Close shape
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {measurement ? (
            <span className="text-slate-300">
              {measurement.mode === 'line'
                ? `${measurement.totalLength} LF`
                : measurement.closed
                  ? `${measurement.area ?? 0} SF`
                  : `${measurement.points.length} pts`}
            </span>
          ) : null}
          <button
            type="button"
            disabled={!measurement || (measurement.mode === 'area' && !measurement.closed)}
            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-600"
            onClick={() => {
              if (measurement) onUseMeasurement?.(measurement);
            }}
          >
            Use quantity
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1" data-testid="bim-viewer-canvas" />

      {!signedUrl && !loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-slate-300">
          Upload a GLB model to begin 3D takeoff.
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-cyan-200">
          Loading model…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-x-0 bottom-0 bg-red-950/90 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

    </div>
  );
}
