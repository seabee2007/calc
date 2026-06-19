import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import {
  BimViewerEngine,
  type BimViewerThemeMode,
  type BimCalibrationSample,
  type BimViewerObjectNode,
} from '../../viewer/bimViewerEngine';
import { BIM_MODEL_LOAD_ERROR } from '../../services/bimModelUploadValidation';
import type { BimMeasurementMode, BimModelUnit, BimSelectedObjectSnapshot } from '../../types';
import type { BimViewerHeightPreset } from '../bimViewerPanelSize';
import {
  formatAreaMeasurement,
  formatLengthMeasurement,
  type BimMeasurementResult,
  type MeasurementDisplayFormat,
} from '../../measurement/bimMeasurementMath';

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
  measurementDisplayFormat?: MeasurementDisplayFormat;
  onMeasurementDisplayFormatChange?: (format: MeasurementDisplayFormat) => void;
  layoutResizeSignal?: number;
  onHeightPreset?: (preset: BimViewerHeightPreset) => void;
  className?: string;
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
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
  measurementDisplayFormat = 'imperial_decimal',
  onMeasurementDisplayFormatChange,
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
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const measureMenuRef = useRef<HTMLDivElement>(null);
  const previousHiddenIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measurementMode, setMeasurementMode] = useState<BimMeasurementMode>('off');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [measurement, setMeasurement] = useState<BimMeasurementResult | null>(null);
  const [showMeasureHelp, setShowMeasureHelp] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [measureMenuOpen, setMeasureMenuOpen] = useState(false);
  const isDarkMode = useIsDarkMode();

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
    engineRef.current?.setMeasurementDisplayFormat(measurementDisplayFormat);
  }, [measurementDisplayFormat]);

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
    const mode: BimViewerThemeMode = isDarkMode ? 'dark' : 'light';
    engineRef.current?.setViewerTheme(mode);
  }, [isDarkMode]);

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

  useEffect(() => {
    if (!measureMenuOpen && !viewMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (measureMenuRef.current?.contains(target) || viewMenuRef.current?.contains(target))
      ) {
        return;
      }
      setMeasureMenuOpen(false);
      setViewMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMeasureMenuOpen(false);
      setViewMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [measureMenuOpen, viewMenuOpen]);

  return (
    <div className={`relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/30 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200">
        <div className="relative" ref={viewMenuRef}>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-cyan-100 dark:focus:ring-cyan-400/40"
            onClick={() => {
              setViewMenuOpen((value) => !value);
              setMeasureMenuOpen(false);
            }}
          >
            View <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {viewMenuOpen ? (
            <div className="absolute left-0 top-10 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 text-xs text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200">
              {[
                ['Fit view', () => engineRef.current?.fitModel()],
                ['Reset view', () => engineRef.current?.resetView()],
                ['Hide selected', () => engineRef.current?.hideSelected()],
                ['Isolate selected', () => engineRef.current?.isolateSelected()],
                ['Show all', () => engineRef.current?.resetVisibility()],
              ].map(([label, action]) => (
                <button
                  key={String(label)}
                  type="button"
                  className="flex w-full items-center rounded-md px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 dark:text-slate-200 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100"
                  onClick={() => {
                    (action as () => void)();
                    setViewMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative" ref={measureMenuRef}>
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
              measurementMode !== 'off'
                ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100'
                : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-cyan-100'
            }`}
            onClick={() => {
              setMeasureMenuOpen((value) => !value);
              setViewMenuOpen(false);
            }}
          >
            Measure: {measurementMode === 'off' ? 'Off' : measurementMode === 'line' ? 'Line' : 'Area'}
            {snapEnabled ? <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-400/20 dark:text-amber-100">Snap</span> : null}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {measureMenuOpen ? (
            <div className="absolute left-0 top-10 z-30 w-64 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Mode</p>
              {(['off', 'line', 'area'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium capitalize transition hover:bg-cyan-50 hover:text-cyan-800 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 ${
                    measurementMode === mode ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={() => setMeasurementMode(mode)}
                >
                  {mode}
                  {measurementMode === mode && mode !== 'off' ? (
                    <span className="text-cyan-600 dark:text-cyan-300">Active</span>
                  ) : null}
                </button>
              ))}
              <div className="my-2 border-t border-slate-200 dark:border-slate-800" />
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium transition hover:bg-amber-50 dark:hover:bg-amber-500/10 ${
                  snapEnabled ? 'text-amber-700 dark:text-amber-100' : 'text-slate-700 dark:text-slate-200'
                }`}
                onClick={() => setSnapEnabled((value) => !value)}
              >
                Snap {snapEnabled ? 'On' : 'Off'}
                <span className={snapEnabled ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-500'}>{snapEnabled ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 dark:text-slate-200 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100"
                onClick={() => engineRef.current?.clearMeasurement()}
              >
                Clear measurement
              </button>
              {measurementMode === 'area' ? (
                <button
                  type="button"
                  disabled={!measurement || measurement.points.length < 3 || measurement.closed}
                  className="flex w-full items-center rounded-md px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 dark:disabled:text-slate-600"
                  onClick={() => engineRef.current?.closeMeasurement()}
                >
                  Close shape
                </button>
              ) : null}
              <div className="my-2 border-t border-slate-200 dark:border-slate-800" />
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Measurement format</p>
              {[
                ['imperial_decimal', 'Imperial decimal'],
                ['feet_inches_fraction', 'Feet-inch fraction'],
                ['metric', 'Metric'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium transition hover:bg-cyan-50 hover:text-cyan-800 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 ${
                    measurementDisplayFormat === value ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={() => onMeasurementDisplayFormatChange?.(value as MeasurementDisplayFormat)}
                >
                  {label}
                  {measurementDisplayFormat === value ? <span className="text-cyan-600 dark:text-cyan-300">Selected</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Measure controls"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-cyan-200 dark:focus:ring-cyan-400/40"
            onMouseEnter={() => setShowMeasureHelp(true)}
            onMouseLeave={() => setShowMeasureHelp(false)}
            onClick={() => setShowMeasureHelp((value) => !value)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {showMeasureHelp ? (
            <div
              role="tooltip"
              className="absolute left-0 top-9 z-20 w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200"
            >
              <p className="font-semibold text-cyan-700 dark:text-cyan-100">Measure controls</p>
              <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                <li>Left click: select/add point</li>
                <li>Middle mouse drag: pan view</li>
                <li>Wheel: zoom</li>
                <li>Right click: undo point in Measure mode</li>
                <li>Esc: stop measuring</li>
                <li>Clear: remove measurement</li>
                <li>Snap: toggle point snapping</li>
              </ul>
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {measurement ? (
            <span className="text-slate-600 dark:text-slate-300">
              {measurement.mode === 'line'
                ? formatLengthMeasurement(measurement.totalLength, measurementDisplayFormat)
                : measurement.closed
                  ? formatAreaMeasurement(measurement.area ?? 0, measurementDisplayFormat)
                  : `${measurement.points.length} pts`}
            </span>
          ) : null}
          {onHeightPreset ? (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/80">
            {[
              ['fit', 'Fit height'],
              ['60', '60%'],
              ['80', '80%'],
              ['full', 'Full height'],
            ].map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:text-slate-300 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 dark:focus:ring-cyan-400/40"
                onClick={() => onHeightPreset(preset as BimViewerHeightPreset)}
              >
                {label}
              </button>
            ))}
          </div>
          ) : null}
          <button
            type="button"
            disabled={!measurement || (measurement.mode === 'area' && !measurement.closed)}
            className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20 dark:disabled:border-slate-700 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-slate-300 dark:text-slate-300">
          Upload a GLB model to begin 3D takeoff.
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-cyan-700 dark:bg-slate-950/70 dark:text-cyan-200">
          Loading model…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-x-0 bottom-0 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/90 dark:text-red-200">
          {error}
        </div>
      ) : null}

    </div>
  );
}
