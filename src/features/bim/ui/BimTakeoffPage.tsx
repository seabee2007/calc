import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { buildAssemblyGroupForRate } from '../../estimating/application/productionRateAssemblyBuilder';
import { loadProjectActivitiesWithLineItems } from '../../estimating/application/constructionActivityService';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import { useProjectLaborRates } from '../../estimating/ui/hooks/useProjectLaborRates';
import { addBimTakeoffToEstimate } from '../application/bimTakeoffToEstimate';
import type {
  BimModelObject,
  BimModelUnit,
  BimSelectedObjectSnapshot,
  BimTakeoffType,
  TakeoffConfidence,
  TakeoffSource,
} from '../types';
import BimModelUpload from './components/BimModelUpload';
import BimViewer from './components/BimViewer';
import BimObjectPropertiesPanel from './components/BimObjectPropertiesPanel';
import BimTakeoffMappingPanel from './components/BimTakeoffMappingPanel';
import BimObjectTreePanel from './components/BimObjectTreePanel';
import { useBimModels } from './hooks/useBimModels';
import { useEstimateWorkspaceHeaderCollapse } from '../../estimating/ui/EstimateWorkspaceHeaderCollapseContext';
import type { BimCalibrationSample } from '../viewer/bimViewerEngine';
import { isViewerReadyBimFormat } from '../services/bimModelFormatRegistry';
import {
  calculateCalibrationScaleFactor,
  convertModelUnitsToFeet,
  type BimMeasurementResult,
  type BimScaleCalibration,
  type CalibrationDistanceUnit,
} from '../measurement/bimMeasurementMath';
import {
  BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH,
  BIM_VIEWER_MAX_RIGHT_PANEL_WIDTH,
  BIM_VIEWER_MIN_HEIGHT,
  BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH,
  clampNumber,
  getMaxViewerHeight,
  readViewerPanelSize,
  resolveViewerHeightPreset,
  viewerSizeStorageKey,
  writeViewerPanelSize,
  type BimViewerHeightPreset,
  type BimViewerPanelSize,
} from './bimViewerPanelSize';

interface Props {
  projectId: string;
  estimateId: string | null;
  onTakeoffAdded?: () => void;
}

type ConfirmAction = { type: 'delete-model'; modelId: string; fileName: string } | null;

function warningDismissedKey(projectId: string, estimateId: string | null, userId: string | null | undefined): string {
  return `arden:3dTakeoff:quantityWarningDismissed:${userId ?? 'anonymous'}:${projectId}:${estimateId ?? 'project'}`;
}

function leftPanelCollapsedKey(projectId: string, estimateId: string | null): string {
  return `arden:3dTakeoff:leftPanelCollapsed:${projectId}:${estimateId ?? 'project'}`;
}

function readLeftPanelCollapsed(projectId: string, estimateId: string | null): boolean {
  try {
    const stored = localStorage.getItem(leftPanelCollapsedKey(projectId, estimateId));
    if (stored != null) return stored === 'true';
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  } catch {
    return false;
  }
}

function calibrationStorageKey(projectId: string, modelId: string): string {
  return `arden:3dTakeoff:modelCalibration:${projectId}:${modelId}`;
}

function readCalibration(projectId: string, modelId: string | null): BimScaleCalibration | null {
  if (!modelId) return null;
  try {
    const raw = localStorage.getItem(calibrationStorageKey(projectId, modelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BimScaleCalibration;
    return parsed.scaleFactor > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCalibration(projectId: string, modelId: string, calibration: BimScaleCalibration): void {
  localStorage.setItem(calibrationStorageKey(projectId, modelId), JSON.stringify(calibration));
}

export default function BimTakeoffPage({ projectId, estimateId, onTakeoffAdded }: Props) {
  const { user } = useAuth();
  const headerCollapse = useEstimateWorkspaceHeaderCollapse();
  const isFocusMode = Boolean(headerCollapse?.focusMode);
  const { projectRates, ensureProjectLaborRatesReady } = useProjectLaborRates(projectId);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [parsedObjects, setParsedObjects] = useState<BimSelectedObjectSnapshot[]>([]);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<Set<string>>(new Set());
  const [measurement, setMeasurement] = useState<BimMeasurementResult | null>(null);
  const [appliedMeasurement, setAppliedMeasurement] = useState<BimMeasurementResult | null>(null);
  const [modelUnit, setModelUnit] = useState<BimModelUnit>('meters');
  const [modelScaleConfirmed, setModelScaleConfirmed] = useState(false);
  const [scaleCalibration, setScaleCalibration] = useState<BimScaleCalibration | null>(null);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationSample, setCalibrationSample] = useState<BimCalibrationSample | null>(null);
  const [knownDistance, setKnownDistance] = useState('3');
  const [knownDistanceUnit, setKnownDistanceUnit] = useState<CalibrationDistanceUnit>('feet');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() =>
    readLeftPanelCollapsed(projectId, estimateId),
  );
  const [viewerLayoutResizeSignal, setViewerLayoutResizeSignal] = useState(0);
  const storageMode = isFocusMode ? 'focus' : 'normal';
  const storageKey = viewerSizeStorageKey(estimateId, projectId, storageMode);
  const [viewerPanelSize, setViewerPanelSize] = useState<BimViewerPanelSize>(() =>
    readViewerPanelSize(storageKey, isFocusMode),
  );
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  const {
    models,
    activeModelId,
    setActiveModelId,
    activeModel,
    objectIdByExternal,
    objects,
    signedUrl,
    uploading,
    loading,
    error,
    selected,
    setSelected,
    uploadModel,
    deleteModel,
    persistParsedObjects,
    markObjectAdded,
  } = useBimModels({
    projectId,
    estimateId,
    userId: user?.id ?? null,
  });

  const warningKey = warningDismissedKey(projectId, estimateId, user?.id);

  useEffect(() => {
    setWarningDismissed(localStorage.getItem(warningKey) === 'true');
  }, [warningKey]);

  useEffect(() => {
    setLeftPanelCollapsed(readLeftPanelCollapsed(projectId, estimateId));
  }, [projectId, estimateId]);

  useEffect(() => {
    setViewerPanelSize(readViewerPanelSize(storageKey, isFocusMode));
  }, [storageKey, isFocusMode]);

  useEffect(() => {
    setScaleCalibration(readCalibration(projectId, activeModelId));
    setCalibrationActive(false);
    setCalibrationSample(null);
  }, [projectId, activeModelId]);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
    };
  }, []);

  const updateViewerPanelSize = useCallback(
    (updater: (current: BimViewerPanelSize) => BimViewerPanelSize) => {
      setViewerPanelSize((current) => {
        const nextRaw = updater(current);
        const next = {
          height: clampNumber(nextRaw.height, BIM_VIEWER_MIN_HEIGHT, getMaxViewerHeight(isFocusMode)),
          rightPanelWidth: clampNumber(
            nextRaw.rightPanelWidth,
            BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH,
            BIM_VIEWER_MAX_RIGHT_PANEL_WIDTH,
          ),
        };
        writeViewerPanelSize(storageKey, next);
        return next;
      });
    },
    [storageKey, isFocusMode],
  );

  const applyHeightPreset = useCallback(
    (preset: BimViewerHeightPreset) => {
      updateViewerPanelSize((current) => ({
        ...current,
        height: resolveViewerHeightPreset(preset, isFocusMode),
      }));
    },
    [isFocusMode, updateViewerPanelSize],
  );

  const beginHeightResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = viewerPanelSize.height;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY;
        if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = requestAnimationFrame(() => {
          updateViewerPanelSize((current) => ({
            ...current,
            height: startHeight + delta,
          }));
        });
      };

      const cleanup = () => {
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', cleanup);
        resizeCleanupRef.current = null;
      };

      resizeCleanupRef.current?.();
      resizeCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', cleanup);
    },
    [updateViewerPanelSize, viewerPanelSize.height],
  );

  const beginWidthResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = viewerPanelSize.rightPanelWidth;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = requestAnimationFrame(() => {
          updateViewerPanelSize((current) => ({
            ...current,
            rightPanelWidth: startWidth - delta,
          }));
        });
      };

      const cleanup = () => {
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', cleanup);
        resizeCleanupRef.current = null;
      };

      resizeCleanupRef.current?.();
      resizeCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', cleanup);
    },
    [updateViewerPanelSize, viewerPanelSize.rightPanelWidth],
  );

  const parsedObjectByExternalId = useMemo(() => {
    const map = new Map<string, BimSelectedObjectSnapshot>();
    for (const object of parsedObjects) {
      map.set(object.externalObjectId, object);
    }
    return map;
  }, [parsedObjects]);

  const persistedObjectByExternalId = useMemo(() => {
    const map = new Map<string, BimModelObject>();
    for (const object of objects) {
      map.set(object.externalObjectId, object);
    }
    return map;
  }, [objects]);

  const hiddenObjectIdList = useMemo(() => [...hiddenObjectIds], [hiddenObjectIds]);

  const selectObjectByExternalId = useCallback(
    (externalObjectId: string) => {
      const persisted = persistedObjectByExternalId.get(externalObjectId);
      if (persisted) {
        setSelected({
          externalObjectId: persisted.externalObjectId,
          name: persisted.name,
          takeoffName: (persisted.properties?.takeoffName as string | undefined) ?? null,
          objectType: persisted.objectType,
          category: persisted.category,
          material: persisted.material,
          level: persisted.level,
          properties: persisted.properties,
          geometryMetrics: persisted.geometryMetrics,
        });
        return;
      }

      const parsed = parsedObjectByExternalId.get(externalObjectId);
      if (parsed) setSelected(parsed);
    },
    [persistedObjectByExternalId, parsedObjectByExternalId, setSelected],
  );

  const toggleObjectVisibility = useCallback((externalObjectId: string) => {
    setHiddenObjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalObjectId)) {
        next.delete(externalObjectId);
      } else {
        next.add(externalObjectId);
      }
      return next;
    });
  }, []);

  const handleViewerVisibilityChange = useCallback((state: Record<string, boolean>) => {
    setHiddenObjectIds(
      new Set(
        Object.entries(state)
          .filter(([, visible]) => !visible)
          .map(([objectId]) => objectId),
      ),
    );
  }, []);

  const isSupportedModel = useCallback((model: { fileName: string; fileType: string }) => {
    return isViewerReadyBimFormat(model.fileName, model.fileType);
  }, []);

  const clearLoadedModelUiState = useCallback(() => {
    setParsedObjects([]);
    setHiddenObjectIds(new Set());
    setMeasurement(null);
    setAppliedMeasurement(null);
    setScaleCalibration(null);
    setCalibrationActive(false);
    setCalibrationSample(null);
    setSelected(null);
  }, [setSelected]);

  const calibrationScaleFactor = scaleCalibration?.scaleFactor ?? 1;
  const effectiveScaleConfirmed = modelScaleConfirmed || Boolean(scaleCalibration);

  const applyCalibration = useCallback(() => {
    if (!activeModelId || !calibrationSample?.rawDistance) return;
    const known = Number(knownDistance);
    const calibration = calculateCalibrationScaleFactor({
      knownDistance: known,
      knownDistanceUnit,
      rawModelDistance: calibrationSample.rawDistance,
      modelUnit,
    });
    if (!calibration) {
      setActionError('Enter a valid known distance and pick two calibration points.');
      return;
    }
    writeCalibration(projectId, activeModelId, calibration);
    setScaleCalibration(calibration);
    setModelScaleConfirmed(true);
    setCalibrationActive(false);
    setActionError(null);
  }, [activeModelId, calibrationSample?.rawDistance, knownDistance, knownDistanceUnit, modelUnit, projectId]);

  const resetCalibration = useCallback(() => {
    if (activeModelId) localStorage.removeItem(calibrationStorageKey(projectId, activeModelId));
    setScaleCalibration(null);
    setCalibrationSample(null);
    setCalibrationActive(false);
    setModelScaleConfirmed(false);
  }, [activeModelId, projectId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmAction) return;
    setActionError(null);
    setSuccessMessage(null);

    const deletingActive = activeModelId === confirmAction.modelId;
    const result = await deleteModel(confirmAction.modelId);
    setConfirmAction(null);
    if (!result.ok) {
      setActionError(result.error ?? 'Could not delete model.');
      return;
    }
    if (deletingActive) clearLoadedModelUiState();
    setSuccessMessage(result.warning ?? 'Model deleted.');
  }, [
    confirmAction,
    activeModelId,
    deleteModel,
    clearLoadedModelUiState,
  ]);

  const dismissWarningBanner = useCallback(() => {
    localStorage.setItem(warningKey, 'true');
    setWarningDismissed(true);
  }, [warningKey]);

  const toggleLeftPanelCollapsed = useCallback(() => {
    setLeftPanelCollapsed((current) => {
      const next = !current;
      localStorage.setItem(leftPanelCollapsedKey(projectId, estimateId), String(next));
      return next;
    });
    setViewerLayoutResizeSignal((current) => current + 1);
  }, [projectId, estimateId]);

  const handleAddToEstimate = useCallback(
    async (params: {
      rate: ProductionRateLibraryEntry;
      takeoffType: BimTakeoffType;
      takeoffName: string;
      quantity: number;
      unit: string;
      source: TakeoffSource;
      confidence: TakeoffConfidence;
      notes?: string | null;
      measurement?: BimMeasurementResult | null;
    }) => {
      if (!estimateId || !activeModel || !selected) {
        window.alert('Save an estimate and select a model object before adding takeoff.');
        return;
      }

      setSaving(true);
      setSuccessMessage(null);
      try {
        await ensureProjectLaborRatesReady();
        const loaded = await loadProjectActivitiesWithLineItems(projectId, estimateId);
        if (loaded.error || !loaded.data) {
          throw new Error(loaded.error ?? 'Could not load existing activities.');
        }

        const group = buildAssemblyGroupForRate(params.rate);
        const rateId = params.rate.id;
        const bimObjectId = objectIdByExternal.get(selected.externalObjectId) ?? null;
        const takeoffNotes = [
          `3D Takeoff: ${params.takeoffName}`,
          `Mode: ${params.takeoffType}`,
          `Model unit: ${modelUnit}`,
          params.notes,
        ]
          .filter(Boolean)
          .join(' | ');

        const result = await addBimTakeoffToEstimate({
          projectId,
          estimateId,
          modelId: activeModel.id,
          bimObjectId,
          group,
          selectedLineItems: [{ rateId, quantity: params.quantity }],
          quantity: params.quantity,
          unit: params.unit,
          takeoffName: params.takeoffName,
          takeoffType: params.takeoffType,
          source: params.source,
          confidence: params.confidence,
          notes: takeoffNotes,
          metadata: params.measurement
            ? {
                measurement_type: params.measurement.mode,
                measurement_points: params.measurement.points,
                model_unit: params.measurement.modelUnit,
                converted_quantity: params.measurement.quantity,
                converted_unit: params.measurement.unit,
                scale_confirmed: params.measurement.scaleConfirmed,
                perimeter: params.measurement.perimeter,
                area: params.measurement.area,
                total_length: params.measurement.totalLength,
                approximate: params.measurement.approximate,
                calibration_scale_factor: params.measurement.calibrationScaleFactor,
                calibrated: params.measurement.calibrated,
                calibration_known_distance: scaleCalibration?.knownDistance ?? null,
                calibration_unit: scaleCalibration?.knownDistanceUnit ?? null,
                calibration_raw_distance: scaleCalibration?.rawDistance ?? null,
                calibrated_at: scaleCalibration?.calibratedAt ?? null,
              }
            : {},
          identity: {
            activityName: params.takeoffName || group.defaultTitle,
            instanceLabel: selected.name ?? undefined,
            notes: `3D Takeoff object ${selected.externalObjectId}`,
          },
          existingActivities: loaded.data.map((entry) => entry.activity),
          projectLaborRates: projectRates,
        });

        if (result.error || !result.data) {
          throw new Error(result.error ?? 'Could not add takeoff to estimate.');
        }

        markObjectAdded(selected.externalObjectId);
        setSuccessMessage('Takeoff item added to estimate.');
        onTakeoffAdded?.();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Could not add to estimate.');
      } finally {
        setSaving(false);
      }
    },
    [
      estimateId,
      activeModel,
      selected,
      projectId,
      objectIdByExternal,
      ensureProjectLaborRatesReady,
      projectRates,
      modelUnit,
      scaleCalibration,
      markObjectAdded,
      onTakeoffAdded,
    ],
  );

  return (
    <div className="min-h-[calc(100vh-220px)] space-y-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950 sm:p-4">
      {!warningDismissed ? (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <strong>Verify model quantities before bidding.</strong> Geometry-derived values are
            approximate bounding-box estimates. Confirm every quantity before adding to your
            Detailed Estimate.
          </p>
          <button
            type="button"
            onClick={dismissWarningBanner}
            className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={dismissWarningBanner}
            aria-label="Dismiss quantity warning"
            className="shrink-0 rounded-md p-1 text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      ) : null}

      {!estimateId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          Save this estimate before linking BIM takeoff rows to estimate line items.
        </div>
      ) : null}

      <div
        className="relative grid gap-4 transition-[grid-template-columns] duration-300 ease-in-out lg:grid-cols-[var(--bim-left-panel-width)_minmax(0,1fr)_var(--bim-right-panel-width)]"
        style={
          {
            '--bim-left-panel-width': leftPanelCollapsed ? '0px' : '320px',
            '--bim-right-panel-width': `${viewerPanelSize.rightPanelWidth}px`,
          } as CSSProperties
        }
      >
        <aside
          aria-hidden={leftPanelCollapsed}
          className={`min-w-0 space-y-4 overflow-hidden transition-[opacity,transform,width] duration-300 ease-in-out ${
            leftPanelCollapsed
              ? 'pointer-events-none -translate-x-4 opacity-0 lg:w-0'
              : 'translate-x-0 opacity-100'
          }`}
        >
          <BimModelUpload uploading={uploading} onUpload={uploadModel} />
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Project models
            </p>
            {loading && models.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-500">Loading models…</p>
            ) : models.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-500">No models uploaded yet.</p>
            ) : (
              <ul className="space-y-1">
                {models.map((model) => {
                  const supported = isSupportedModel(model);
                  return (
                    <li key={model.id}>
                      <div
                        className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                          model.id === activeModelId
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-500/15 dark:text-cyan-100'
                            : supported
                              ? 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-500'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (supported) setActiveModelId(model.id);
                            }}
                            disabled={!supported}
                            className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                          >
                            <span className="block truncate font-medium">{model.fileName}</span>
                            {!supported ? (
                              <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                Unsupported MVP format
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${model.fileName}`}
                            title="Delete model"
                            onClick={() =>
                              setConfirmAction({
                                type: 'delete-model',
                                modelId: model.id,
                                fileName: model.fileName,
                              })
                            }
                            className="rounded-md p-1 text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Model settings
            </p>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Model unit
              <select
                value={modelUnit}
                onChange={(event) => {
                  setModelUnit(event.target.value as BimModelUnit);
                  setModelScaleConfirmed(false);
                  setScaleCalibration(null);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="meters">Meters</option>
                <option value="feet">Feet</option>
                <option value="inches">Inches</option>
                <option value="millimeters">Millimeters</option>
              </select>
            </label>
            <label className="mt-3 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={modelScaleConfirmed}
                onChange={(event) => setModelScaleConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              I confirmed model scale before using geometry-derived quantities.
            </label>
            {!modelScaleConfirmed ? (
              <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                Model scale not confirmed. Verify quantities before bidding.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-500">
              Conversion preview: area → SF, volume → CY, count → EA.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Model Scale Calibration
            </p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              If a known object is available, calibrate the model before measuring. Example: measure a 3 ft door opening.
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {scaleCalibration ? (
                <>
                  <p className="font-semibold">
                    Scale calibrated: 1 model unit ={' '}
                    {(convertModelUnitsToFeet(modelUnit) * scaleCalibration.scaleFactor).toFixed(4)} ft
                  </p>
                  <p className="mt-1">
                    Calibrated from known {scaleCalibration.knownDistance}{' '}
                    {scaleCalibration.knownDistanceUnit} measurement.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Scale not calibrated</p>
                  <p className="mt-1">Model scale not confirmed. Measurements may be inaccurate.</p>
                </>
              )}
            </div>
            <button
              type="button"
              disabled={!activeModelId}
              onClick={() => {
                setCalibrationActive(true);
                setCalibrationSample(null);
              }}
              className="mt-3 w-full rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              Calibrate from known distance
            </button>
            {calibrationActive ? (
              <p className="mt-2 text-xs font-medium text-cyan-700 dark:text-cyan-200">
                Click two points on a known distance in the model.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Known distance
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={knownDistance}
                  onChange={(event) => setKnownDistance(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Unit
                <select
                  value={knownDistanceUnit}
                  onChange={(event) => setKnownDistanceUnit(event.target.value as CalibrationDistanceUnit)}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="feet">Feet</option>
                  <option value="inches">Inches</option>
                  <option value="meters">Meters</option>
                </select>
              </label>
            </div>
            {calibrationSample?.rawDistance ? (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Picked model distance: {calibrationSample.rawDistance.toFixed(4)} raw units.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!calibrationSample?.rawDistance || Number(knownDistance) <= 0}
                onClick={applyCalibration}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:bg-cyan-500 dark:text-slate-950 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                Apply scale
              </button>
              <button
                type="button"
                onClick={resetCalibration}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Reset calibration
              </button>
            </div>
          </div>

          <BimObjectTreePanel
            objects={objects}
            parsedObjects={parsedObjects}
            selectedExternalId={selected?.externalObjectId ?? null}
            hiddenExternalIds={hiddenObjectIds}
            onSelect={selectObjectByExternalId}
            onToggleVisibility={toggleObjectVisibility}
          />
        </aside>

        <button
          type="button"
          aria-label={leftPanelCollapsed ? 'Expand 3D Takeoff panel' : 'Collapse 3D Takeoff panel'}
          title={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          onClick={toggleLeftPanelCollapsed}
          className={`absolute top-[260px] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300 bg-white text-cyan-700 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/10 transition-all duration-300 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-cyan-500/50 dark:bg-slate-900 dark:text-cyan-100 dark:shadow-cyan-950/30 dark:ring-cyan-500/20 dark:hover:bg-slate-800 ${
            leftPanelCollapsed ? 'left-0 lg:left-0' : 'left-[calc(var(--bim-left-panel-width)-1.125rem)]'
          }`}
        >
          {leftPanelCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        <main className="min-w-0">
          <div
            className="relative min-h-[360px] rounded-xl"
            style={{ height: viewerPanelSize.height }}
            data-testid="bim-viewer-resizable-panel"
          >
            <BimViewer
              signedUrl={signedUrl}
              selectedExternalId={selected?.externalObjectId ?? null}
              hiddenExternalIds={hiddenObjectIdList}
              onSelect={setSelected}
              modelUnit={modelUnit}
              scaleConfirmed={effectiveScaleConfirmed}
              calibrationActive={calibrationActive}
              calibrationScaleFactor={calibrationScaleFactor}
              calibrated={Boolean(scaleCalibration)}
              onCalibrationSampleChange={setCalibrationSample}
              onMeasurementChange={setMeasurement}
              onUseMeasurement={setAppliedMeasurement}
              layoutResizeSignal={viewerLayoutResizeSignal}
              onObjectsParsed={(snapshots) => {
                setParsedObjects(snapshots);
                if (objects.length === 0) {
                  void persistParsedObjects(snapshots);
                }
              }}
              onObjectTreeParsed={() => undefined}
              onVisibilityChange={handleViewerVisibilityChange}
              onHeightPreset={applyHeightPreset}
              className="h-full min-h-0"
            />
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize 3D viewer height"
              tabIndex={0}
              data-testid="bim-viewer-height-resize-handle"
              onPointerDown={beginHeightResize}
              onDoubleClick={() => applyHeightPreset('fit')}
              className="absolute inset-x-8 -bottom-1.5 h-3 cursor-ns-resize rounded-full border border-cyan-400/20 bg-slate-800/80 opacity-70 transition hover:border-cyan-300/60 hover:bg-cyan-500/30 hover:opacity-100"
            />
          </div>
        </main>

        <aside className="relative min-w-[320px] space-y-4">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize 3D takeoff side panel"
            tabIndex={0}
            data-testid="bim-viewer-width-resize-handle"
            onPointerDown={beginWidthResize}
            onDoubleClick={() =>
              updateViewerPanelSize((current) => ({
                ...current,
                rightPanelWidth: BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH,
              }))
            }
            className="absolute -left-3 top-0 hidden h-full w-3 cursor-ew-resize rounded-full bg-transparent transition hover:bg-cyan-500/20 lg:block"
          />
          <BimObjectPropertiesPanel
            selected={selected}
            modelUnit={modelUnit}
            isHidden={selected ? hiddenObjectIds.has(selected.externalObjectId) : false}
          />
          <BimMeasurementSummaryCard
            measurement={measurement}
            scaleConfirmed={effectiveScaleConfirmed}
            onUse={() => {
              if (measurement) setAppliedMeasurement(measurement);
            }}
          />
          <BimTakeoffMappingPanel
            selected={selected}
            modelUnit={modelUnit}
            appliedMeasurement={appliedMeasurement}
            saving={saving}
            onAddToEstimate={handleAddToEstimate}
          />
        </aside>
      </div>

      {(error || actionError) ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          {actionError ?? error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
          {successMessage}
        </div>
      ) : null}
      <DeleteBimModelConfirmDialog
        action={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

function BimMeasurementSummaryCard({
  measurement,
  scaleConfirmed,
  onUse,
}: {
  measurement: BimMeasurementResult | null;
  scaleConfirmed: boolean;
  onUse: () => void;
}) {
  if (!measurement) return null;
  const canUse = measurement.mode === 'line' || measurement.closed;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">Measurement</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="capitalize">{measurement.mode}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Points</dt>
          <dd>{measurement.points.length}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Length</dt>
          <dd>{measurement.totalLength} LF</dd>
        </div>
        {measurement.area != null ? (
          <div>
            <dt className="text-slate-500">Area</dt>
            <dd>{measurement.area} SF</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">Scale</dt>
          <dd>{measurement.calibrated ? 'Calibrated' : 'Uncalibrated'}</dd>
        </div>
      </dl>
      {!measurement.calibrated ? (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Scale not calibrated. Verify before bidding.
        </p>
      ) : null}
      {!scaleConfirmed ? (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Confirm model scale before using measured quantities.
        </p>
      ) : null}
      {measurement.mode === 'area' && !measurement.closed ? (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Close shape to calculate area.
        </p>
      ) : null}
      {measurement.approximate ? (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Area is approximate because points are not on a flat plane.
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canUse}
        onClick={onUse}
        className="mt-3 w-full rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        Use quantity
      </button>
    </div>
  );
}

function DeleteBimModelConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!action) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Delete this model?</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This removes the model from this project’s 3D Takeoff list. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            Delete model
          </button>
        </div>
      </div>
    </div>
  );
}
