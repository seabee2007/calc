import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  commitDesignEstimatePreview,
  persistDesignEstimatePreview,
} from '../application/designBuilderToEstimate';
import {
  buildPresetObjects,
  createBlankCmuBuildingPreset,
  createFiveBySixCmuBuildingPreset,
  type CmuBuildingPreset,
} from '../domain/designBuilderPreset';
import { DESIGN_BUILDER_COPY } from '../domain/designBuilderCopy';
import { resolveDesignSnapPoint, type DesignSnapTarget } from '../domain/designSnapRules';
import { useConfirm } from '../../../contexts/ConfirmContext';
import {
  applyOpeningPlacementPatch,
  applyOpeningSegmentPatch,
  createOpeningDraft,
  createOpeningDraftForSegment,
  DEFAULT_DOOR_DIMENSIONS,
  DEFAULT_WINDOW_DIMENSIONS,
  openingDraftFromPlacementResolution,
  resolveOpeningPlacementForHit,
  resolveOpeningPlacementForLegacyFaceOffset,
  summarizeOpeningPlacementStatus,
} from '../domain/designBuilderInteractionRules';
import {
  resolveOpeningPlacementFromPlanPoint,
  resolveOpeningPlacementFromStoredOpening,
  segmentFrameById,
  type OpeningPlacementDefinition,
  type ResolvedOpeningPlacement,
} from '../domain/openingPlacementResolver';
import { pickOpeningAtPlanPoint } from '../domain/planOpeningGraphics';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import {
  canGenerateSlabAndRoof,
  layoutFromPreset,
  syncPresetFromLayout,
  wallParamsWithLegacyOpenings,
} from '../domain/layoutWallAdapter';
import {
  applyProjectMasonryDefaultsToLayout,
  buildMasonryGeometryKey,
  logMasonrySettingsCommit,
  syncWallBlockModuleFromScalars,
} from '../domain/masonrySettings';
import {
  summarizeManualMasonryRuns,
} from '../domain/manualMasonryRules';
import {
  addWallSegment,
  closeFootprint,
  closingSegmentWouldIntersect,
  createBlankWallLayout,
  createWallLayoutId,
  deleteWallSegment,
  deriveExteriorBounds,
  moveWallNode,
  projectExactSegmentLength,
  removeLastSegment,
  resolveDrawWallGuidance,
  resolveOrthogonalClosureAssist,
  resolveOrthogonalCornerPoint,
  resolveSegmentAtPoint,
  resolveShiftConstrainedPoint,
  snapPlanPoint,
  GUIDE_CAPTURE_RADIUS_PX,
  type OrthogonalClosureAssist,
} from '../domain/wallLayoutRules';
import {
  canRedoDesignHistory,
  canUndoDesignHistory,
  createDesignHistoryCommandId,
  createDesignHistoryState,
  createDesignSnapshot,
  patchDesignSnapshot,
  peekRedoDesignCommand,
  peekUndoDesignCommand,
  pushDesignHistoryCommand,
  redoDesignHistoryCommand,
  snapshotToPreset,
  snapshotsEqual,
  type DesignBuilderSnapshot,
  type DesignHistoryCommand,
  type DesignHistoryCommandKind,
  type DesignHistoryState,
  undoDesignHistoryCommand,
} from '../domain/designBuilderHistory';
import {
  resolveCmuModuleConfig,
  resolveClosedFootprintToCmuModules,
  snapLengthToCmuHalfModule,
  snapLengthToCmuModule,
  snapOpeningToCmuModule,
  summarizeWallModuleFits,
  validateCmuOpenings,
} from '../domain/cmuModuleRules';
import {
  buildModuleFitCandidateTable,
  evaluateRequestedDimensionModuleFit,
  nearestModularCandidate,
} from '../domain/moduleFitEngine';
import { resolveCmuOpening } from '../domain/cmuOpeningRules';
import {
  lintelCourseAssemblyRequiresCutWarning,
  summarizeLintelCourseClosureSide,
} from '../domain/lintelCourseClosureSolver';
import {
  buildDesignGeometryInputFromLayout,
  generateCmuLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { useEstimateWorkspaceHeaderCollapse } from '../../estimating/ui/EstimateWorkspaceHeaderCollapseContext';
import { buildDesignEstimatePreview } from '../quantity/designQuantityFormulas';
import {
  applyAutoFrameLayout,
  applyCornerColumns,
  applyPerimeterBeams,
  addGableEndToPreset,
  objectSaveKey,
  setBuildingSystemMode,
} from '../domain/structureActions';
import { createDefaultFoundationSettings } from '../domain/foundationElevations';
import {
  createDesignModel,
  upsertDesignModelObjects,
} from '../services/designBuilderService';
import type {
  BuilderViewMode,
  BuildingSystemMode,
  DesignBuilderCameraSnapshot,
  DesignBuilderInteractionEvent,
  DesignBuilderLayoutMode,
  DesignBuilderSelection,
  DesignBuilderToolMode,
  DesignBuilderSnapMode,
  DesignEstimatePreviewLine,
  FoundationViewMode,
  DesignModel,
  DesignModelObject,
  DesignObjectType,
  DesignQuantityItem,
  DesignUnitSystem,
  DesignWallSegment,
  DesignWallLayoutParameters,
  MasonryCourseRun,
  MasonryToolMode,
  ModuleFitMode,
  OpeningPlacementStatus,
  WallOpeningParameters,
} from '../types';
import {
  BUILDING_SYSTEM_MODE_LABELS,
  builderViewModeFromStored,
  storedViewModeFromBuilder,
} from '../types';
import {
  DEFAULT_OBJECT_TREE_EXPANSION,
  designBuilderSessionKey,
  type ObjectTreeExpansionState,
  useDesignBuilderSessionStore,
} from '../state/designBuilderStore';
import {
  DEFAULT_PLAN_VIEWPORT,
  PLAN_GRID_SCALE_PRESETS,
  type PlanViewportState,
} from '../domain/pointerPlanMapping';
import { buildLayoutFramingKey, deriveDesignLayoutBounds, logDesignFramingDiagnostics } from '../domain/designLayoutBounds';
import { formatDrawWallSnapTargetFeedback } from '../domain/designDrawWallFeedback';
import DesignBuilderViewer, { type DesignBuilderPlacementPreview } from './DesignBuilderViewer';
import DesignBuilderPlanCanvas from './DesignBuilderPlanCanvas';
import {
  closeDesignBuilderCommandMenus,
  CommandMenuAction,
  DesignBuilderCommandMenu,
  DesignBuilderCommandMenuProvider,
} from './DesignBuilderCommandMenu';

interface DesignBuilderPageProps {
  projectId: string;
  estimateId: string | null;
  onEstimateCommitted?: () => void;
}

type StatusTone = 'info' | 'success' | 'error';
type ViewerHeightPreset = 'fit' | '60' | '80' | 'full';

interface PageStatus {
  tone: StatusTone;
  message: string;
}

const VIEWER_MIN_HEIGHT = 360;
const VIEWER_DEFAULT_HEIGHT = 560;
const RIGHT_PANEL_DEFAULT_WIDTH = 360;
const RIGHT_PANEL_MIN_WIDTH = 320;
const RIGHT_PANEL_MAX_WIDTH = 520;
const DESIGN_SAVE_DEBOUNCE_MS = 1000;

function leftPanelCollapsedKey(projectId: string, estimateId: string | null): string {
  return `arden:designBuilder:leftPanelCollapsed:${projectId}:${estimateId ?? 'project'}`;
}

function rightPanelCollapsedKey(projectId: string, estimateId: string | null): string {
  return `arden:designBuilder:rightPanelCollapsed:${projectId}:${estimateId ?? 'project'}`;
}

function viewerSizeKey(projectId: string, estimateId: string | null, focusMode: boolean): string {
  return `arden:designBuilder:viewerSize:${projectId}:${estimateId ?? 'project'}:${focusMode ? 'focus' : 'normal'}`;
}

function readBooleanStorage(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored == null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

function writeBooleanStorage(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures.
  }
}

function maxViewerHeight(focusMode: boolean): number {
  const viewport = typeof window === 'undefined' ? 900 : window.innerHeight;
  return Math.max(VIEWER_MIN_HEIGHT, viewport - (focusMode ? 172 : 280));
}

function resolveViewerHeightPreset(preset: ViewerHeightPreset, focusMode: boolean): number {
  const viewport = typeof window === 'undefined' ? 900 : window.innerHeight;
  const max = maxViewerHeight(focusMode);
  if (preset === '60') return clampNumber(Math.round(viewport * 0.6), VIEWER_MIN_HEIGHT, max);
  if (preset === '80') return clampNumber(Math.round(viewport * 0.8), VIEWER_MIN_HEIGHT, max);
  if (preset === 'full') return max;
  return clampNumber(VIEWER_DEFAULT_HEIGHT, VIEWER_MIN_HEIGHT, max);
}

function readViewerSize(projectId: string, estimateId: string | null, focusMode: boolean) {
  const fallback = {
    height: resolveViewerHeightPreset(focusMode ? 'full' : 'fit', focusMode),
    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  };
  try {
    const raw = localStorage.getItem(viewerSizeKey(projectId, estimateId, focusMode));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      height: clampNumber(Number(parsed.height) || fallback.height, VIEWER_MIN_HEIGHT, maxViewerHeight(focusMode)),
      rightPanelWidth: clampNumber(Number(parsed.rightPanelWidth) || fallback.rightPanelWidth, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH),
    };
  } catch {
    return fallback;
  }
}

function writeViewerSize(projectId: string, estimateId: string | null, focusMode: boolean, size: { height: number; rightPanelWidth: number }) {
  try {
    localStorage.setItem(viewerSizeKey(projectId, estimateId, focusMode), JSON.stringify(size));
  } catch {
    // Ignore storage failures.
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function DesignBuilderPage({
  projectId,
  estimateId,
  onEstimateCommitted,
}: DesignBuilderPageProps) {
  const { user } = useAuth();
  const headerCollapse = useEstimateWorkspaceHeaderCollapse();
  const focusMode = Boolean(headerCollapse?.focusMode);
  const sessionKey = designBuilderSessionKey(projectId, estimateId);
  const storedSession = useDesignBuilderSessionStore((store) => store.sessions[sessionKey]);
  const saveDesignBuilderSession = useDesignBuilderSessionStore((store) => store.saveSession);
  const clearDesignBuilderSession = useDesignBuilderSessionStore((store) => store.clearSession);
  const confirm = useConfirm();
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const hasUserAdjustedPlanViewRef = useRef(storedSession?.hasUserAdjustedPlanView ?? false);
  const hasUserAdjusted3dViewRef = useRef(storedSession?.hasUserAdjusted3dView ?? false);
  const lastSnapTargetRef = useRef<DesignSnapTarget | null>(null);
  const pending3dFitRef = useRef(false);
  const prevFootprintClosedRef = useRef(false);
  const autoFitPlanForLayoutKeyRef = useRef<string | null>(null);
  const autoFit3dForLayoutKeyRef = useRef<string | null>(null);
  const sessionFramingValidatedRef = useRef(false);
  const orthogonalGuidesPreferenceTouchedRef = useRef(storedSession?.orthogonalGuidesPreferenceTouched ?? false);
  const resizeFrameRef = useRef<number | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const [layoutState, setLayoutState] = useState<DesignBuilderLayoutMode>(() => storedSession?.layoutState ?? 'blank');
  const [layoutEpoch, setLayoutEpoch] = useState(() => storedSession?.layoutEpoch ?? 0);
  const [preset, setPreset] = useState<CmuBuildingPreset | null>(() => storedSession?.preset ?? createBlankCmuBuildingPreset());
  const [designModel, setDesignModel] = useState<DesignModel | null>(() => storedSession?.designModel ?? null);
  const [objects, setObjects] = useState<DesignModelObject[]>(() => storedSession?.objects ?? []);
  const [unitSystem, setUnitSystem] = useState<DesignUnitSystem>(() => storedSession?.unitSystem ?? 'metric');
  const [selectedObjectType, setSelectedObjectType] = useState<DesignObjectType | null>(
    () => storedSession?.selectedObjectType ?? null,
  );
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    () => storedSession?.selectedOpeningId ?? null,
  );
  const [toolMode, setToolMode] = useState<DesignBuilderToolMode>(() => storedSession?.toolMode ?? 'select');
  const [masonryToolMode, setMasonryToolMode] = useState<MasonryToolMode>(() => storedSession?.masonryToolMode ?? 'full_block');
  void setMasonryToolMode;
  const [draftSnapTarget, setDraftSnapTarget] = useState<DesignSnapTarget | null>(null);
  const [drawWallConstraintLabel, setDrawWallConstraintLabel] = useState<string | null>(null);
  const [drawWallPreviewMetrics, setDrawWallPreviewMetrics] = useState<{ lengthMeters: number; angleDegrees: number } | null>(null);
  const [orthogonalClosureAssist, setOrthogonalClosureAssist] = useState<OrthogonalClosureAssist | null>(null);
  const [closureCornerSnap, setClosureCornerSnap] = useState<{ point: { x: number; z: number }; captured: boolean } | null>(null);
  const [manualMasonryRuns, setManualMasonryRuns] = useState<MasonryCourseRun[]>(
    () => storedSession?.preset?.wall.manualMasonryCourseRuns ?? [],
  );
  void setManualMasonryRuns;
  const [changedAfterCommit, setChangedAfterCommit] = useState(() => storedSession?.changedAfterCommit ?? false);
  const [placementPreview, setPlacementPreview] = useState<DesignBuilderPlacementPreview | null>(null);
  const [previewLines, setPreviewLines] = useState<DesignEstimatePreviewLine[]>(() => storedSession?.previewLines ?? []);
  const [persistedQuantityItems, setPersistedQuantityItems] = useState<DesignQuantityItem[]>(
    () => storedSession?.persistedQuantityItems ?? [],
  );
  const [status, setStatus] = useState<PageStatus>({
    tone: 'info',
    message: 'Load the example to generate parametric geometry and quantities.',
  });
  const [busy, setBusy] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() =>
    storedSession?.leftPanelCollapsed ?? readBooleanStorage(leftPanelCollapsedKey(projectId, estimateId), false),
  );
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    storedSession?.rightPanelCollapsed ?? readBooleanStorage(rightPanelCollapsedKey(projectId, estimateId), false),
  );
  const [viewerSize, setViewerSize] = useState(() => storedSession?.viewerSize ?? readViewerSize(projectId, estimateId, focusMode));
  const [viewCommand, setViewCommand] = useState<{ id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null>(null);
  const [cameraSnapshot, setCameraSnapshot] = useState<DesignBuilderCameraSnapshot | null>(() => storedSession?.camera ?? null);
  const [planViewport, setPlanViewport] = useState<PlanViewportState>(() => storedSession?.planViewport ?? DEFAULT_PLAN_VIEWPORT);
  const [showOpeningLayout, setShowOpeningLayout] = useState(false);
  const [showGroutCells, setShowGroutCells] = useState(false);
  const [showClosureWarnings, setShowClosureWarnings] = useState(false);
  const [showFootprintSetout, setShowFootprintSetout] = useState(false);
  const [showInfillPanelBounds, setShowInfillPanelBounds] = useState(false);
  const [foundationViewMode, setFoundationViewMode] = useState<FoundationViewMode>('full_model');
  const [viewMode, setViewMode] = useState<'plan' | '3d'>(() => storedSession?.viewMode ?? '3d');
  const builderViewMode = builderViewModeFromStored(viewMode);
  const [snapMode, setSnapMode] = useState<DesignBuilderSnapMode>(() => storedSession?.snapMode ?? 'grid');
  const [moduleFitMode, setModuleFitMode] = useState<ModuleFitMode>(() => storedSession?.moduleFitMode ?? 'exact');
  const [designHistory, setDesignHistory] = useState<DesignHistoryState>(() => createDesignHistoryState());
  const [activeDrawNodeId, setActiveDrawNodeId] = useState<string | null>(null);
  const [drawStartNodeId, setDrawStartNodeId] = useState<string | null>(null);
  const [draftPlanEnd, setDraftPlanEnd] = useState<{ x: number; z: number } | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');
  const [openingToolSettings, setOpeningToolSettings] = useState<
    Record<
      'door' | 'window',
      {
        widthMeters: string;
        heightMeters: string;
        roughOpeningAllowanceMeters: string;
        swingDirection?: 'left' | 'right';
        swingType?: 'inswing' | 'outswing';
      }
    >
  >({
    door: {
      widthMeters: '',
      heightMeters: '',
      roughOpeningAllowanceMeters: '',
      swingDirection: 'left',
      swingType: 'inswing',
    },
    window: { widthMeters: '', heightMeters: '', roughOpeningAllowanceMeters: '' },
  });
  const [objectTreeExpanded, setObjectTreeExpanded] = useState<ObjectTreeExpansionState>(
    () => storedSession?.objectTreeExpanded ?? DEFAULT_OBJECT_TREE_EXPANSION,
  );
  const modelLoaded = preset != null;

  useEffect(() => {
    if (hydratedSessionKeyRef.current === sessionKey) return;
    hydratedSessionKeyRef.current = sessionKey;
    if (storedSession) {
      setPreset(storedSession.preset);
      setLayoutState(storedSession.layoutState ?? (storedSession.preset?.wallLayout?.segments.length ? 'editing' : 'blank'));
      setLayoutEpoch(storedSession.layoutEpoch ?? 0);
      setDesignModel(storedSession.designModel);
      setObjects(storedSession.objects);
      setUnitSystem(storedSession.unitSystem);
      setSelectedObjectType(storedSession.selectedObjectType);
      setSelectedOpeningId(storedSession.selectedOpeningId ?? null);
      setToolMode(storedSession.toolMode ?? 'select');
      setMasonryToolMode(storedSession.masonryToolMode ?? 'full_block');
      setManualMasonryRuns(storedSession.preset?.wall.manualMasonryCourseRuns ?? []);
      setChangedAfterCommit(storedSession.changedAfterCommit ?? false);
      setPreviewLines(storedSession.previewLines);
      setPersistedQuantityItems(storedSession.persistedQuantityItems);
      setLeftPanelCollapsed(storedSession.leftPanelCollapsed);
      setRightPanelCollapsed(storedSession.rightPanelCollapsed);
      if (storedSession.viewerSize) setViewerSize(storedSession.viewerSize);
      setCameraSnapshot(storedSession.camera);
      setPlanViewport(storedSession.planViewport ?? DEFAULT_PLAN_VIEWPORT);
      if (storedSession.preset?.wallLayout) {
        setDesignHistory(createDesignHistoryState());
      } else if ((storedSession.layoutState ?? 'blank') === 'blank') {
        setPreset(createBlankCmuBuildingPreset());
        setDesignHistory(createDesignHistoryState());
      }
      setViewMode(storedSession.viewMode ?? '3d');
      setSnapMode(storedSession.snapMode ?? 'grid');
      setModuleFitMode(storedSession.moduleFitMode ?? 'exact');
      setObjectTreeExpanded(storedSession.objectTreeExpanded ?? DEFAULT_OBJECT_TREE_EXPANSION);
      orthogonalGuidesPreferenceTouchedRef.current = storedSession.orthogonalGuidesPreferenceTouched ?? false;
      return;
    }
    setLeftPanelCollapsed(readBooleanStorage(leftPanelCollapsedKey(projectId, estimateId), false));
    setRightPanelCollapsed(readBooleanStorage(rightPanelCollapsedKey(projectId, estimateId), false));
    setViewerSize(readViewerSize(projectId, estimateId, focusMode));
  }, [projectId, estimateId, focusMode, sessionKey, storedSession]);

  useEffect(() => {
    if (!storedSession?.viewerSize) {
      setViewerSize(readViewerSize(projectId, estimateId, focusMode));
    }
  }, [projectId, estimateId, focusMode, storedSession?.viewerSize]);

  useEffect(() => {
    saveDesignBuilderSession(sessionKey, {
      layoutState,
      layoutEpoch,
      preset,
      designModel,
      objects,
      unitSystem,
      selectedObjectType,
      selectedOpeningId,
      toolMode,
      masonryToolMode,
      changedAfterCommit,
      viewMode,
      snapMode,
      moduleFitMode,
      objectTreeExpanded,
      previewLines,
      persistedQuantityItems,
      leftPanelCollapsed,
      rightPanelCollapsed,
      viewerSize,
      camera: cameraSnapshot,
      planViewport,
      hasUserAdjustedPlanView: hasUserAdjustedPlanViewRef.current,
      hasUserAdjusted3dView: hasUserAdjusted3dViewRef.current,
      orthogonalGuidesPreferenceTouched: orthogonalGuidesPreferenceTouchedRef.current,
      dirty: modelLoaded,
    });
  }, [
    cameraSnapshot,
    designModel,
    leftPanelCollapsed,
    layoutEpoch,
    layoutState,
    masonryToolMode,
    modelLoaded,
    objects,
    persistedQuantityItems,
    planViewport,
    preset,
    previewLines,
    rightPanelCollapsed,
    saveDesignBuilderSession,
    selectedObjectType,
    selectedOpeningId,
    toolMode,
    changedAfterCommit,
    viewMode,
    snapMode,
    moduleFitMode,
    objectTreeExpanded,
    sessionKey,
    unitSystem,
    viewerSize,
  ]);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
    };
  }, []);

  const updateViewerSize = useCallback(
    (updater: (current: { height: number; rightPanelWidth: number }) => { height: number; rightPanelWidth: number }) => {
      setViewerSize((current) => {
        const raw = updater(current);
        const next = {
          height: clampNumber(raw.height, VIEWER_MIN_HEIGHT, maxViewerHeight(focusMode)),
          rightPanelWidth: clampNumber(raw.rightPanelWidth, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH),
        };
        writeViewerSize(projectId, estimateId, focusMode, next);
        return next;
      });
    },
    [estimateId, focusMode, projectId],
  );

  const applyViewerHeightPreset = useCallback(
    (preset: ViewerHeightPreset) => {
      updateViewerSize((current) => ({
        ...current,
        height: resolveViewerHeightPreset(preset, focusMode),
      }));
    },
    [focusMode, updateViewerSize],
  );

  const beginHeightResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = viewerSize.height;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY;
        if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = requestAnimationFrame(() => {
          updateViewerSize((current) => ({ ...current, height: startHeight + delta }));
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
    [updateViewerSize, viewerSize.height],
  );

  const beginRightPanelResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = viewerSize.rightPanelWidth;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      const handleMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX;
        updateViewerSize((current) => ({ ...current, rightPanelWidth: startWidth + delta }));
      };
      const cleanup = () => {
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', cleanup);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', cleanup);
    },
    [updateViewerSize, viewerSize.rightPanelWidth],
  );

  const toggleLeftPanel = useCallback(() => {
    closeDesignBuilderCommandMenus();
    setLeftPanelCollapsed((current) => {
      const next = !current;
      writeBooleanStorage(leftPanelCollapsedKey(projectId, estimateId), next);
      return next;
    });
  }, [estimateId, projectId]);

  const toggleRightPanel = useCallback(() => {
    closeDesignBuilderCommandMenus();
    setRightPanelCollapsed((current) => {
      const next = !current;
      writeBooleanStorage(rightPanelCollapsedKey(projectId, estimateId), next);
      return next;
    });
  }, [estimateId, projectId]);

  const resolvedPreset = useMemo(() => {
    const base = preset ?? createBlankCmuBuildingPreset();
    return {
      ...base,
      foundationSettings: base.foundationSettings ?? createDefaultFoundationSettings(),
    };
  }, [preset]);
  const wallLayout = resolvedPreset.wallLayout;
  const nextUndoCommand = peekUndoDesignCommand(designHistory);
  const nextRedoCommand = peekRedoDesignCommand(designHistory);
  const footprintClosed = canGenerateSlabAndRoof(wallLayout);
  const exteriorBounds = useMemo(() => deriveExteriorBounds(wallLayout), [wallLayout]);
  const effectiveWall = useMemo(
    () =>
      syncWallBlockModuleFromScalars({
        ...wallParamsWithLegacyOpenings(resolvedPreset.wall, wallLayout),
        manualMasonryCourseRuns: manualMasonryRuns,
      }),
    [manualMasonryRuns, resolvedPreset.wall, wallLayout],
  );
  const masonryGeometryKey = useMemo(
    () =>
      buildMasonryGeometryKey({
        wallLayout,
        wall: effectiveWall,
        openings: effectiveWall.openings,
        moduleFitMode,
        manualMasonryRuns,
      }),
    [effectiveWall, manualMasonryRuns, moduleFitMode, wallLayout],
  );
  const planSnapSpacingMeters = useMemo(() => {
    if (snapMode === 'cmu_module') {
      return resolveCmuModuleConfig(effectiveWall).moduleLengthMeters;
    }
    return wallLayout.gridSpacingMeters;
  }, [effectiveWall, snapMode, wallLayout.gridSpacingMeters]);
  const designGeometryInput = useMemo(
    () =>
      buildDesignGeometryInputFromLayout({
        wallLayout,
        cmuSettings: effectiveWall,
        openings: effectiveWall.openings,
        slabSettings: footprintClosed ? resolvedPreset.slab : { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 },
        roofSettings: footprintClosed ? resolvedPreset.roof : { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 },
        trussSettings: footprintClosed ? resolvedPreset.truss : { ...resolvedPreset.truss, buildingLengthMeters: 0 },
        buildingSystemMode: resolvedPreset.buildingSystemMode,
        frameSystem: resolvedPreset.frameSystem,
        foundationSettings: resolvedPreset.foundationSettings,
        infillSystem: resolvedPreset.infillSystem,
        gableEndSystem: resolvedPreset.gableEndSystem,
      }),
    [
      effectiveWall,
      footprintClosed,
      masonryGeometryKey,
      resolvedPreset.buildingSystemMode,
      resolvedPreset.frameSystem,
      resolvedPreset.foundationSettings,
      resolvedPreset.gableEndSystem,
      resolvedPreset.infillSystem,
      resolvedPreset.roof,
      resolvedPreset.slab,
      resolvedPreset.truss,
      wallLayout,
    ],
  );
  const designGeometryResult = useMemo(
    () => generateDesignGeometry(designGeometryInput),
    [designGeometryInput],
  );
  const designLayoutBounds = useMemo(
    () =>
      deriveDesignLayoutBounds({
        geometryResult: designGeometryResult,
        wallLayout,
        slab: footprintClosed ? resolvedPreset.slab : null,
        roof: footprintClosed ? resolvedPreset.roof : null,
        truss: footprintClosed ? resolvedPreset.truss : null,
        manualMasonryRuns,
      }),
    [designGeometryResult, footprintClosed, manualMasonryRuns, resolvedPreset.roof, resolvedPreset.slab, resolvedPreset.truss, wallLayout],
  );
  const layoutFramingKey = useMemo(
    () => buildLayoutFramingKey(layoutEpoch, designLayoutBounds),
    [designLayoutBounds, layoutEpoch],
  );

  const setBuilderViewMode = useCallback((mode: BuilderViewMode) => {
    const nextViewMode = storedViewModeFromBuilder(mode);
    if (nextViewMode === '3d' && viewMode === 'plan' && designLayoutBounds && !hasUserAdjusted3dViewRef.current) {
      pending3dFitRef.current = true;
    }
    setViewMode(nextViewMode);
  }, [designLayoutBounds, viewMode]);

  useEffect(() => {
    if (sessionFramingValidatedRef.current || !storedSession?.camera || !designLayoutBounds) return;
    sessionFramingValidatedRef.current = true;
    const [targetX, , targetZ] = storedSession.camera.target;
    const dx = Math.abs(targetX - designLayoutBounds.center.x);
    const dz = Math.abs(targetZ - designLayoutBounds.center.z);
    if (dx > 2 || dz > 2) {
      hasUserAdjusted3dViewRef.current = false;
      autoFit3dForLayoutKeyRef.current = null;
      if (viewMode === '3d') pending3dFitRef.current = true;
    }
  }, [designLayoutBounds, storedSession?.camera, viewMode]);
  useEffect(() => {
    if (!modelLoaded) return;
    if (footprintClosed && !prevFootprintClosedRef.current && viewMode === 'plan' && !hasUserAdjustedPlanViewRef.current) {
      issueViewCommand('fit');
    }
    prevFootprintClosedRef.current = footprintClosed;
  }, [footprintClosed, modelLoaded, viewMode]);

  useEffect(() => {
    if (!modelLoaded || !designLayoutBounds) return;
    if (wallLayout.segments.length === 0 && !footprintClosed) return;
    if (viewMode === 'plan' && !hasUserAdjustedPlanViewRef.current && autoFitPlanForLayoutKeyRef.current !== layoutFramingKey) {
      autoFitPlanForLayoutKeyRef.current = layoutFramingKey;
      issueViewCommand('fit');
      return;
    }
    if (viewMode !== '3d' || hasUserAdjusted3dViewRef.current) return;
    if (autoFit3dForLayoutKeyRef.current === layoutFramingKey && !pending3dFitRef.current) return;
    autoFit3dForLayoutKeyRef.current = layoutFramingKey;
    pending3dFitRef.current = false;
    issueViewCommand('fit');
  }, [designLayoutBounds, footprintClosed, layoutFramingKey, modelLoaded, viewMode, wallLayout.segments.length]);
  const objectIds = useMemo(() => {
    const byKey = new Map(
      objects.map((object) => [objectSaveKey(object.objectType, object.parameters as { kind?: string }), object.id]),
    );
    return {
      slabObjectId: byKey.get(objectSaveKey('thickened_edge_slab', { kind: 'thickened_edge_slab' })) ?? 'local-slab',
      wallObjectId: byKey.get(objectSaveKey('cmu_wall_system', { kind: 'cmu_wall_system' })) ?? 'local-wall',
      roofObjectId: byKey.get(objectSaveKey('gable_roof_system', { kind: 'gable_roof_system' })) ?? 'local-roof',
      trussObjectId: byKey.get(objectSaveKey('steel_truss_system', { kind: 'steel_truss_system' })) ?? 'local-truss',
      frameObjectId: byKey.get(objectSaveKey('structural_frame_system', { kind: 'structural_frame_system' })) ?? 'local-frame',
      infillObjectId: byKey.get(objectSaveKey('cmu_infill_system', { kind: 'cmu_infill_system' })) ?? 'local-infill',
      gableEndObjectId: byKey.get(objectSaveKey('gable_end_system', { kind: 'gable_end_system' })) ?? 'local-gable',
    };
  }, [objects]);

  const generatedPreview = useMemo(() => {
    const modelId = designModel?.id ?? 'local-design-model';
    return buildDesignEstimatePreview({
      designModelId: modelId,
      ...objectIds,
      wall: effectiveWall,
      slab: footprintClosed ? resolvedPreset.slab : { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 },
      roof: footprintClosed ? resolvedPreset.roof : { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 },
      truss: footprintClosed ? resolvedPreset.truss : { ...resolvedPreset.truss, buildingLengthMeters: 0 },
      buildingSystemMode: resolvedPreset.buildingSystemMode,
      frameSystem: designGeometryResult.frameSystem ?? resolvedPreset.frameSystem,
      infillSystem: designGeometryResult.infillSystem ?? resolvedPreset.infillSystem,
      gableEndSystem: designGeometryResult.gableEndSystem ?? resolvedPreset.gableEndSystem,
      geometryResult: designGeometryResult,
    });
  }, [designGeometryResult, designModel?.id, effectiveWall, footprintClosed, objectIds, resolvedPreset]);
  const visiblePreviewLines = modelLoaded ? (previewLines.length > 0 ? previewLines : generatedPreview) : [];
  const cmuModule = useMemo(() => resolveCmuModuleConfig(effectiveWall), [effectiveWall]);
  const wallModuleFits = useMemo(() => summarizeWallModuleFits(effectiveWall), [effectiveWall]);
  const planSegmentFrames = useMemo(
    () => designGeometryResult.wallCmuLayout.segmentFrames ?? getSegmentFramesForWallLayout(wallLayout, effectiveWall),
    [designGeometryResult.wallCmuLayout.segmentFrames, effectiveWall, wallLayout],
  );
  const planResolvedOpeningsById = useMemo(() => {
    const map = new Map<string, ResolvedOpeningPlacement>();
    effectiveWall.openings.forEach((opening) => {
      const segmentId = opening.wallSegmentId;
      if (!segmentId) return;
      const frame = segmentFrameById(planSegmentFrames, segmentId);
      if (!frame) return;
      map.set(
        opening.id,
        resolveOpeningPlacementFromStoredOpening({
          opening,
          segmentFrame: frame,
          wall: effectiveWall,
          slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
        }),
      );
    });
    return map;
  }, [effectiveWall, planSegmentFrames, resolvedPreset.slab.slabThicknessMeters]);
  const planOpeningItems = useMemo(
    () =>
      effectiveWall.openings.flatMap((opening) => {
        const resolved = planResolvedOpeningsById.get(opening.id);
        if (!resolved) return [];
        const status = summarizeOpeningPlacementStatus(opening, effectiveWall);
        return [{
          openingId: opening.id,
          openingType: opening.type,
          resolved,
          isValid: resolved.isValid && status.isValid,
          statusKind: status.kind,
          swingDirection: opening.swingDirection ?? 'left',
          swingType: opening.swingType ?? 'inswing',
        }];
      }),
    [effectiveWall, planResolvedOpeningsById],
  );
  const planOpeningPreview = useMemo(() => {
    if (!placementPreview?.resolvedPlacement) return null;
    const draft = placementPreview.openingDraft;
    return {
      resolvedPlacement: placementPreview.resolvedPlacement,
      openingType: placementPreview.openingType,
      isValid: placementPreview.isValid,
      statusKind: placementPreview.statusKind,
      swingDirection: draft?.swingDirection ?? openingToolSettings.door.swingDirection ?? 'left',
      swingType: draft?.swingType ?? openingToolSettings.door.swingType ?? 'inswing',
    };
  }, [openingToolSettings.door.swingDirection, openingToolSettings.door.swingType, placementPreview]);
  const cmuLayout = designGeometryResult.wallCmuLayout;
  const manualMasonrySummary = useMemo(() => summarizeManualMasonryRuns(manualMasonryRuns), [manualMasonryRuns]);
  const moduleWarnings = useMemo(
    () => [...new Set([...designGeometryResult.wallCmuLayout.warnings, ...validateCmuOpenings(effectiveWall)])],
    [designGeometryResult.wallCmuLayout.warnings, effectiveWall],
  );

  const quantityCards = useMemo(
    () => [
      {
        label: 'Thickened edge slab concrete',
        value: modelLoaded ? (generatedPreview.find((line) => line.id === 'slab-concrete')?.quantity ?? 0) : 0,
        unit: 'CY',
        objectType: 'thickened_edge_slab' as DesignObjectType,
      },
      {
        label: 'CMU blocks including waste',
        value: modelLoaded ? designGeometryResult.blockCount + manualMasonrySummary.total : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'CMU full blocks',
        value: modelLoaded ? cmuLayout.counts.full + manualMasonrySummary.full_block : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'CMU special blocks',
        value: modelLoaded
          ? cmuLayout.counts.half +
            cmuLayout.counts.corner +
            cmuLayout.counts.end +
            cmuLayout.counts.jamb +
            cmuLayout.counts.cut +
            manualMasonrySummary.half_block +
            manualMasonrySummary.end_block +
            manualMasonrySummary.jamb_block +
            manualMasonrySummary.bond_beam_block +
            manualMasonrySummary.grout_rebar_cell
          : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Lintels',
        value: modelLoaded ? cmuLayout.lintels.length : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Rough opening area',
        value: modelLoaded ? Number(cmuLayout.openingGrout.roughOpeningAreaSquareMeters.toFixed(2)) : 0,
        unit: 'M2',
        objectType: 'door_opening' as DesignObjectType,
      },
      {
        label: 'Actual opening area',
        value: modelLoaded ? Number(cmuLayout.openingGrout.actualOpeningAreaSquareMeters.toFixed(2)) : 0,
        unit: 'M2',
        objectType: 'window_opening' as DesignObjectType,
      },
      {
        label: 'Jamb grouted cells',
        value: modelLoaded ? cmuLayout.jambGroutCells.length : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Closure cut blocks',
        value: modelLoaded ? cmuLayout.openingGrout.courseClosureCutBlockCount : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Closure grout volume',
        value: modelLoaded ? Number(cmuLayout.openingGrout.closureGroutVolumeCubicMeters.toFixed(3)) : 0,
        unit: 'M3',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Bond beam length',
        value: modelLoaded ? cmuLayout.bondBeamLengthMeters : 0,
        unit: 'M',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Opening grout volume',
        value: modelLoaded ? Number(cmuLayout.openingGrout.totalGroutVolumeCubicMeters.toFixed(3)) : 0,
        unit: 'M3',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Grouted cells',
        value: modelLoaded ? cmuLayout.groutedCellCount : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Gable roof surface area',
        value: modelLoaded ? (generatedPreview.find((line) => line.id === 'roof-area')?.quantity ?? 0) : 0,
        unit: 'SF',
        objectType: 'gable_roof_system' as DesignObjectType,
      },
      {
        label: 'Steel trusses by spacing',
        value: modelLoaded ? (generatedPreview.find((line) => line.id === 'steel-trusses')?.quantity ?? 0) : 0,
        unit: 'EA',
        objectType: 'steel_truss_system' as DesignObjectType,
      },
    ],
    [cmuLayout, designGeometryResult.blockCount, generatedPreview, manualMasonrySummary, modelLoaded],
  );

  const selectedObjectLabel = selectedSegmentId
    ? 'Wall Segment'
    : selectedObjectType
      ? OBJECT_TREE_ITEMS.find((item) => item.objectType === selectedObjectType)?.label ?? 'Selected object'
      : 'Project Masonry Defaults';
  const linkedPreviewLines = selectedObjectType
    ? generatedPreview.filter((line) => line.designObjectId === objectIdForType(selectedObjectType, objectIds))
    : [];
  const selectedOpening = resolvedPreset.wall.openings.find((item) => item.id === selectedOpeningId) ?? null;
  const selectedWallSegment = selectedSegmentId
    ? wallLayout.segments.find((segment) => segment.id === selectedSegmentId) ?? null
    : null;
  const selectedOpeningStatus = useMemo<OpeningPlacementStatus | null>(() => {
    if (!selectedOpening) return null;
    return summarizeOpeningPlacementStatus(selectedOpening, resolvedPreset.wall);
  }, [resolvedPreset.wall, selectedOpening]);
  const previewPlacementStatus = useMemo<OpeningPlacementStatus | null>(() => {
    if (!placementPreview) return null;
    const draft = placementPreview.wallSegmentId
      ? createOpeningDraftForSegment(
          placementPreview.openingType,
          placementPreview.wallSegmentId,
          placementPreview.positionAlongSegment ?? placementPreview.offsetMeters,
          resolvedPreset.wall,
          wallLayout,
          placementPreview.openingId ?? 'preview',
        )
      : createOpeningDraft(
          placementPreview.openingType,
          placementPreview.wallFace,
          placementPreview.offsetMeters,
          resolvedPreset.wall,
          placementPreview.openingId ?? 'preview',
        );
    const peers = placementPreview.openingId
      ? resolvedPreset.wall.openings.filter((item) => item.id !== placementPreview.openingId)
      : resolvedPreset.wall.openings;
    return summarizeOpeningPlacementStatus({ ...draft, widthMeters: placementPreview.widthMeters, heightMeters: placementPreview.heightMeters, sillHeightMeters: placementPreview.sillHeightMeters }, resolvedPreset.wall, peers);
  }, [placementPreview, resolvedPreset.wall, wallLayout]);
  const livePlacementStatus = previewPlacementStatus ?? selectedOpeningStatus;
  const activeSelection: DesignBuilderSelection = selectedSegmentId
    ? { kind: 'wall_segment', id: selectedSegmentId }
    : selectedNodeId
      ? { kind: 'wall_node', id: selectedNodeId }
      : selectedOpeningId
        ? { kind: 'opening', id: selectedOpeningId }
        : { kind: 'none' };

  const buildObjectsForSave = useCallback(() => {
    if (!designModel || !preset) return [];
    const byKey = new Map(
      objects.map((object) => [objectSaveKey(object.objectType, object.parameters as { kind?: string }), object.id]),
    );
    return buildPresetObjects({
      designModelId: designModel.id,
      projectId,
      preset: syncPresetFromLayout(preset, preset.wallLayout),
      includeStableIds: false,
    }).map((input) => ({
      ...input,
      ...(byKey.get(objectSaveKey(input.objectType, input.parameters as { kind?: string }))
        ? { id: byKey.get(objectSaveKey(input.objectType, input.parameters as { kind?: string })) }
        : {}),
    }));
  }, [designModel, objects, preset, projectId]);

  const persistDesignObjects = useCallback(async () => {
    if (!user?.id || !designModel || !preset || savingRef.current) return;
    const payload = buildObjectsForSave();
    if (payload.length === 0) return;
    savingRef.current = true;
    try {
      const objectResult = await upsertDesignModelObjects(payload);
      if (objectResult.error || !objectResult.data) {
        setStatus({ tone: 'error', message: objectResult.error ?? 'Could not save design objects.' });
        return;
      }
      setObjects(objectResult.data);
    } finally {
      savingRef.current = false;
    }
  }, [buildObjectsForSave, designModel, preset, user?.id]);

  const scheduleDebouncedSave = useCallback(() => {
    if (!designModel || !user?.id) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      void persistDesignObjects();
    }, DESIGN_SAVE_DEBOUNCE_MS);
  }, [designModel, persistDesignObjects, user?.id]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  function issueViewCommand(action: 'fit' | 'reset' | 'grid_scale', spacingMeters?: number) {
    setViewCommand({ id: Date.now() + Math.random(), action, spacingMeters });
  }

  function resetDesignViewFraming(options?: { blank?: boolean }) {
    hasUserAdjustedPlanViewRef.current = false;
    hasUserAdjusted3dViewRef.current = false;
    autoFitPlanForLayoutKeyRef.current = null;
    autoFit3dForLayoutKeyRef.current = null;
    sessionFramingValidatedRef.current = false;
    pending3dFitRef.current = true;
    if (options?.blank) {
      setPlanViewport(DEFAULT_PLAN_VIEWPORT);
      setCameraSnapshot(null);
      issueViewCommand('reset');
      return;
    }
    issueViewCommand('fit');
  }

  function resolvePresetName(): string {
    return preset?.name ?? createBlankCmuBuildingPreset().name;
  }

  function captureDesignSnapshot(): DesignBuilderSnapshot {
    const basePreset = preset ?? createBlankCmuBuildingPreset();
    const syncedPreset = syncPresetFromLayout(basePreset, basePreset.wallLayout);
    return createDesignSnapshot({
      preset: {
        ...syncedPreset,
        wall: syncWallBlockModuleFromScalars({
          ...syncedPreset.wall,
          manualMasonryCourseRuns: manualMasonryRuns,
        }),
      },
      objects,
      layoutState,
      selectedOpeningId,
      selectedSegmentId,
      selectedNodeId,
      selectedObjectType,
    });
  }

  function applyDesignSnapshot(snapshot: DesignBuilderSnapshot) {
    setPreset(snapshotToPreset(snapshot, resolvePresetName()));
    setObjects(snapshot.designObjects);
    setLayoutState(snapshot.layoutState);
    setSelectedOpeningId(snapshot.selectedOpeningId);
    setSelectedSegmentId(snapshot.selectedSegmentId);
    setSelectedNodeId(snapshot.selectedNodeId);
    setSelectedObjectType(snapshot.selectedObjectType);
    setManualMasonryRuns(snapshot.masonryWall.manualMasonryCourseRuns ?? []);
  }

  function finalizeMutationAfterCommand() {
    setPersistedQuantityItems((current) => {
      if (current.some((item) => item.estimateLineId)) setChangedAfterCommit(true);
      return [];
    });
    setPreviewLines([]);
    scheduleDebouncedSave();
  }

  function finishUndoRedo(command: DesignHistoryCommand, direction: 'undo' | 'redo') {
    cancelPlanDraw();
    closeDesignBuilderCommandMenus();
    setToolMode('select');
    setPlacementPreview(null);
    setStatus({
      tone: 'info',
      message: `${direction === 'undo' ? 'Undid' : 'Redid'}: ${command.label.toLowerCase()}`,
    });
  }

  function executeDesignCommand(params: {
    label: string;
    kind: DesignHistoryCommandKind;
    mutate: (before: DesignBuilderSnapshot) => DesignBuilderSnapshot;
    recordHistory?: boolean;
    afterApply?: () => void;
  }) {
    const before = captureDesignSnapshot();
    const after = params.mutate(before);
    if (snapshotsEqual(before, after)) return;

    applyDesignSnapshot(after);
    finalizeMutationAfterCommand();

    if (params.recordHistory !== false) {
      setDesignHistory((current) =>
        pushDesignHistoryCommand(current, {
          id: createDesignHistoryCommandId(),
          label: params.label,
          kind: params.kind,
          before,
          after,
        }),
      );
    }

    params.afterApply?.();
  }

  function recordDesignHistoryCommand(
    label: string,
    kind: DesignHistoryCommandKind,
    before: DesignBuilderSnapshot,
    after: DesignBuilderSnapshot,
  ) {
    if (snapshotsEqual(before, after)) return;
    setDesignHistory((current) =>
      pushDesignHistoryCommand(current, {
        id: createDesignHistoryCommandId(),
        label,
        kind,
        before,
        after,
      }),
    );
  }

  function mutateWallLayoutSilent(nextLayout: DesignWallLayoutParameters) {
    setLayoutState(nextLayout.segments.length > 0 ? 'editing' : layoutState);
    setPreset((current) => {
      const base = current ?? createBlankCmuBuildingPreset();
      return syncPresetFromLayout({ ...base, wallLayout: nextLayout }, nextLayout);
    });
  }

  function applyGridScalePreset(spacingMeters: number) {
    mutateWallLayoutSilent({ ...wallLayout, gridSpacingMeters: spacingMeters });
  }

  function commitWallLayout(
    nextLayout: DesignWallLayoutParameters,
    label: string,
    kind: DesignHistoryCommandKind = 'wall_add',
  ) {
    if (import.meta.env.DEV) {
      const base = preset ?? createBlankCmuBuildingPreset();
      const nextPreset = syncPresetFromLayout({ ...base, wallLayout: nextLayout }, nextLayout);
      const nextWall = wallParamsWithLegacyOpenings(nextPreset.wall, nextLayout);
      const nextInput = buildDesignGeometryInputFromLayout({
        wallLayout: nextLayout,
        cmuSettings: nextWall,
        openings: nextWall.openings,
        slabSettings: canGenerateSlabAndRoof(nextLayout) ? nextPreset.slab : { ...nextPreset.slab, lengthMeters: 0, widthMeters: 0 },
        roofSettings: canGenerateSlabAndRoof(nextLayout) ? nextPreset.roof : { ...nextPreset.roof, lengthMeters: 0, widthMeters: 0 },
        trussSettings: canGenerateSlabAndRoof(nextLayout) ? nextPreset.truss : { ...nextPreset.truss, buildingLengthMeters: 0 },
      });
      const nextGeometry = generateDesignGeometry(nextInput);
      console.table({
        action: label,
        nodes: nextLayout.nodes.length,
        segments: nextLayout.segments.length,
        openings: nextWall.openings.length,
        sourcePath: nextGeometry.sourcePath,
        bondPattern: nextGeometry.bondPattern,
        generatedWalls: nextGeometry.wallSegments.length,
        generatedBlocks: nextGeometry.blockCount,
      });
    }
    executeDesignCommand({
      label,
      kind,
      mutate: (before) =>
        patchDesignSnapshot(before, resolvePresetName(), (current) =>
          syncPresetFromLayout({ ...current, wallLayout: nextLayout }, nextLayout),
        ),
    });
  }

  function applyPresetPatch(
    updater: (current: CmuBuildingPreset) => CmuBuildingPreset,
    label: string,
    kind: DesignHistoryCommandKind,
  ) {
    executeDesignCommand({
      label,
      kind,
      mutate: (before) => patchDesignSnapshot(before, resolvePresetName(), updater),
    });
  }

  function handleSetBuildingSystemMode(mode: BuildingSystemMode) {
    applyPresetPatch((current) => setBuildingSystemMode(current, mode), 'Change building system mode', 'structure_update');
  }

  function handleAddCornerColumns() {
    applyPresetPatch((current) => applyCornerColumns(current), 'Add corner columns', 'structure_update');
  }

  function handleAutoFrameLayout() {
    applyPresetPatch((current) => applyAutoFrameLayout(current), 'Auto frame layout', 'structure_update');
  }

  function handleAddPerimeterBeams() {
    applyPresetPatch((current) => applyPerimeterBeams(current), 'Add perimeter beams', 'structure_update');
  }

  function handleAddGableEnd() {
    const segmentId = selectedSegmentId ?? wallLayout.segments[0]?.id;
    if (!segmentId) return;
    applyPresetPatch(
      (current) => addGableEndToPreset(current, segmentId),
      'Add gable end',
      'structure_update',
    );
  }

  function addOpening(opening: WallOpeningParameters) {
    executeDesignCommand({
      label: opening.type === 'door' ? 'Place door' : 'Place window',
      kind: 'opening_add',
      mutate: (before) =>
        patchDesignSnapshot(
          before,
          resolvePresetName(),
          (current) => ({
            ...current,
            wall: {
              ...current.wall,
              openings: [...current.wall.openings, opening],
            },
          }),
          {
            selectedOpeningId: opening.id,
            selectedObjectType: opening.type === 'door' ? 'door_opening' : 'window_opening',
          },
        ),
      afterApply: () => {
        setPlacementPreview(null);
        setToolMode('select');
        closeDesignBuilderCommandMenus();
      },
    });
  }

  function applyOpeningToolSettings(opening: WallOpeningParameters): WallOpeningParameters {
    const settings = openingToolSettings[opening.type];
    const width = Number(settings.widthMeters);
    const height = Number(settings.heightMeters);
    const roughOpeningAllowance = Number(settings.roughOpeningAllowanceMeters);
    const nextOpening = snapOpeningToCmuModule(
      {
        ...opening,
        ...(Number.isFinite(width) && width > 0 ? { widthMeters: width } : {}),
        ...(Number.isFinite(height) && height > 0 ? { heightMeters: height } : {}),
        ...(Number.isFinite(roughOpeningAllowance) && roughOpeningAllowance >= 0
          ? { roughOpeningAllowanceMeters: roughOpeningAllowance }
          : {}),
        ...(opening.type === 'door'
          ? {
              swingDirection: settings.swingDirection ?? opening.swingDirection ?? 'left',
              swingType: settings.swingType ?? opening.swingType ?? 'inswing',
            }
          : {}),
      },
      resolvedPreset.wall,
    );
    return nextOpening;
  }

  function buildOpeningPlacementDefinition(type: WallOpeningParameters['type']): OpeningPlacementDefinition {
    const defaults = type === 'door' ? DEFAULT_DOOR_DIMENSIONS : DEFAULT_WINDOW_DIMENSIONS;
    const settings = openingToolSettings[type];
    const width = Number(settings.widthMeters);
    const height = Number(settings.heightMeters);
    const roughOpeningAllowance = Number(settings.roughOpeningAllowanceMeters);
    return {
      type,
      widthMeters: Number.isFinite(width) && width > 0 ? width : defaults.widthMeters,
      heightMeters: Number.isFinite(height) && height > 0 ? height : defaults.heightMeters,
      sillHeightMeters: defaults.sillHeightMeters,
      roughOpeningAllowanceMeters:
        Number.isFinite(roughOpeningAllowance) && roughOpeningAllowance >= 0 ? roughOpeningAllowance : 0.05,
    };
  }

  function setPlacementPreviewFromResolved(
    resolved: ResolvedOpeningPlacement,
    draft: WallOpeningParameters,
    openingType: WallOpeningParameters['type'],
    options?: {
      hitPoint?: { x: number; y?: number; z: number };
      openingId?: string;
      rawHitStationMeters?: number;
    },
  ) {
    const peers = options?.openingId
      ? resolvedPreset.wall.openings.filter((item) => item.id !== options.openingId)
      : resolvedPreset.wall.openings;
    const status = summarizeOpeningPlacementStatus(draft, resolvedPreset.wall, peers);
    const openingId = options?.openingId ?? draft.id;
    setPlacementPreview({
      wallFace: draft.wallFace ?? 'south',
      offsetMeters: resolved.actualOpeningStartMeters,
      positionAlongSegment: resolved.positionAlongSegmentMeters,
      openingType,
      widthMeters: draft.widthMeters,
      heightMeters: draft.heightMeters,
      sillHeightMeters: draft.sillHeightMeters,
      isValid: resolved.isValid && status.isValid,
      statusKind: status.kind,
      openingId: options?.openingId,
      wallSegmentId: resolved.hostSegmentId,
      wallRotationY: resolved.wallRotationY,
      frameOrigin: resolved.frameOrigin,
      hitPoint: options?.hitPoint,
      openingDraft: { ...draft, id: openingId },
      resolvedPlacement: resolved,
    });
  }

  function commitPlacementPreview(openingId?: string) {
    if (!placementPreview?.wallSegmentId || !placementPreview.isValid || !placementPreview.openingDraft) {
      return false;
    }
    const draft = {
      ...placementPreview.openingDraft,
      id: openingId ?? placementPreview.openingId ?? placementPreview.openingDraft.id,
    };
    if (openingId ?? placementPreview.openingId) {
      moveOpening(openingId ?? placementPreview.openingId!, draft);
    } else {
      addOpening(draft);
    }
    return true;
  }

  function moveOpening(openingId: string, nextOpening: WallOpeningParameters) {
    executeDesignCommand({
      label: 'Move opening',
      kind: 'opening_move',
      mutate: (before) =>
        patchDesignSnapshot(
          before,
          resolvePresetName(),
          (current) => ({
            ...current,
            wall: {
              ...current.wall,
              openings: current.wall.openings.map((opening) => (opening.id === openingId ? nextOpening : opening)),
            },
          }),
          {
            selectedOpeningId: openingId,
            selectedObjectType: nextOpening.type === 'door' ? 'door_opening' : 'window_opening',
          },
        ),
      afterApply: () => {
        setPlacementPreview(null);
        setToolMode('select');
        closeDesignBuilderCommandMenus();
      },
    });
  }

  function deleteOpening(openingId: string) {
    executeDesignCommand({
      label: 'Delete opening',
      kind: 'opening_delete',
      mutate: (before) =>
        patchDesignSnapshot(
          before,
          resolvePresetName(),
          (current) => ({
            ...current,
            wall: {
              ...current.wall,
              openings: current.wall.openings.filter((opening) => opening.id !== openingId),
            },
          }),
          {
            selectedOpeningId: before.selectedOpeningId === openingId ? null : before.selectedOpeningId,
          },
        ),
      afterApply: () => {
        setPlacementPreview(null);
        setToolMode('select');
      },
    });
  }

  function handleDeleteSelectedOpening() {
    if (!selectedOpeningId) {
      setStatus({ tone: 'info', message: 'Select an opening to delete.' });
      return;
    }
    const opening = resolvedPreset.wall.openings.find((item) => item.id === selectedOpeningId);
    if (!opening) return;
    void (async () => {
      const confirmed = await confirm({
        title: 'Delete opening?',
        message:
          'This will update CMU blocks, grout, lintels, and estimate preview quantities. This will not delete committed estimate lines automatically.',
        confirmLabel: 'Delete opening',
        confirmVariant: 'danger',
        showWarningIcon: true,
      });
      if (!confirmed) return;
      deleteOpening(selectedOpeningId);
      setStatus({ tone: 'success', message: `${opening.type === 'door' ? 'Door' : 'Window'} opening removed from the wall system.` });
    })();
  }

  function handleUndoDesign() {
    const { state, command } = undoDesignHistoryCommand(designHistory);
    if (!command) return;
    setDesignHistory(state);
    applyDesignSnapshot(command.before);
    finalizeMutationAfterCommand();
    finishUndoRedo(command, 'undo');
  }

  function handleRedoDesign() {
    const { state, command } = redoDesignHistoryCommand(designHistory);
    if (!command) return;
    setDesignHistory(state);
    applyDesignSnapshot(command.after);
    finalizeMutationAfterCommand();
    finishUndoRedo(command, 'redo');
  }

  function resolveActiveDrawNodeId(layout: DesignWallLayoutParameters): string | null {
    if (layout.segments.length === 0) return layout.nodes[0]?.id ?? null;
    return layout.segments[layout.segments.length - 1]?.endNodeId ?? null;
  }

  function undoLastDrawSegment() {
    if (wallLayout.segments.length === 0) return;
    const next = removeLastSegment(wallLayout);
    mutateWallLayoutSilent(next);
    const nextActiveNodeId = resolveActiveDrawNodeId(next);
    setActiveDrawNodeId(nextActiveNodeId);
    setDrawStartNodeId(next.segments.length > 0 ? drawStartNodeId : next.nodes[0]?.id ?? null);
    setDraftPlanEnd(null);
    setDraftSnapTarget(null);
    setDrawWallConstraintLabel(null);
    setDrawWallPreviewMetrics(null);
    lastSnapTargetRef.current = null;
  }

  async function handleCloseFootprint() {
    if (wallLayout.segments.length < 3 || footprintClosed) return;
    const intersects = closingSegmentWouldIntersect(wallLayout);
    const confirmed = intersects
      ? await confirm({
          title: 'Close footprint?',
          message:
            'The closing segment intersects existing wall geometry. Close this footprint with a final wall segment anyway?',
          confirmLabel: 'Close footprint',
          showWarningIcon: true,
        })
      : await confirm({
          title: 'Close footprint?',
          message: 'Close this footprint with a final wall segment?',
          confirmLabel: 'Close footprint',
        });
    if (!confirmed) return;
    commitWallLayout(closeFootprint(wallLayout), 'Close footprint', 'close_footprint');
    if (!hasUserAdjustedPlanViewRef.current) issueViewCommand('fit');
    pending3dFitRef.current = true;
  }

  function cancelPlanDraw() {
    setDraftPlanEnd(null);
    setDraftSnapTarget(null);
    setDrawWallConstraintLabel(null);
    setDrawWallPreviewMetrics(null);
    setOrthogonalClosureAssist(null);
    setClosureCornerSnap(null);
    lastSnapTargetRef.current = null;
    setSegmentLengthInput('');
    setActiveDrawNodeId(null);
    setDrawStartNodeId(null);
    setToolMode('select');
  }

  async function confirmDeleteWallSegment(segmentId: string) {
    const attachedOpenings = resolvedPreset.wall.openings.filter((opening) => opening.wallSegmentId === segmentId);
    const confirmed = await confirm({
      title: 'Delete wall segment?',
      message:
        'This will remove the wall segment and any openings attached to it. CMU quantities, corners, grout, lintels, and estimate preview quantities will update. Previously committed estimate lines will not be deleted automatically.',
      confirmLabel: 'Delete wall',
      confirmVariant: 'danger',
      showWarningIcon: true,
    });
    if (!confirmed) return;
    const nextLayout = deleteWallSegment(wallLayout, segmentId);
    executeDesignCommand({
      label: 'Delete wall segment',
      kind: 'wall_delete',
      mutate: (before) =>
        patchDesignSnapshot(
          before,
          resolvePresetName(),
          (current) => ({
            ...syncPresetFromLayout({ ...current, wallLayout: nextLayout }, nextLayout),
            wall: {
              ...current.wall,
              openings: current.wall.openings.filter((opening) => opening.wallSegmentId !== segmentId),
            },
          }),
          {
            selectedSegmentId: null,
            selectedNodeId: null,
            selectedOpeningId: null,
            selectedObjectType: null,
          },
        ),
      afterApply: () => {
        setActiveDrawNodeId(resolveActiveDrawNodeId(nextLayout));
      },
    });
    setStatus({
      tone: 'success',
      message: attachedOpenings.length > 0
        ? `Wall segment and ${attachedOpenings.length} attached opening${attachedOpenings.length === 1 ? '' : 's'} removed. ${DESIGN_BUILDER_COPY.status.estimateRequiresUpdate}`
        : `Wall segment removed. ${DESIGN_BUILDER_COPY.status.estimateRequiresUpdate}`,
    });
  }

  function handleDeleteSelectedSegment() {
    if (!selectedSegmentId) {
      setStatus({ tone: 'info', message: 'Select a wall segment to delete.' });
      return;
    }
    void confirmDeleteWallSegment(selectedSegmentId);
  }

  function resolveCurrentFootprintModuleFit(apply: boolean) {
    const bounds = deriveExteriorBounds(wallLayout);
    if (!bounds || wallLayout.nodes.length < 4) {
      setStatus({ tone: 'info', message: 'Draw a closed rectangular footprint before resolving CMU modules.' });
      return;
    }
    const report = designGeometryResult.wallCmuLayout.moduleFitReport;
    if (!apply) {
      setStatus({
        tone: moduleFitStatusTone(report.status),
        message: report.summary,
      });
      return;
    }
    const lengthCandidates = buildModuleFitCandidateTable({
      buildingSystemMode: resolvedPreset.buildingSystemMode,
      dimensionBasis: wallLayout.dimensionBasis ?? 'outside_face',
      requestedDimensionMeters: bounds.exteriorLengthMeters,
      wall: resolvedPreset.wall,
      columnWidthMeters: resolvedPreset.frameSystem.defaultColumnWidthMeters,
      layout: wallLayout,
      segmentFrames: designGeometryResult.wallCmuLayout.segmentFrames,
      columns: designGeometryResult.frameSystem?.columns ?? resolvedPreset.frameSystem.columns,
      beams: designGeometryResult.frameSystem?.beams ?? resolvedPreset.frameSystem.beams,
      dimension: 'length',
    });
    const widthCandidates = buildModuleFitCandidateTable({
      buildingSystemMode: resolvedPreset.buildingSystemMode,
      dimensionBasis: wallLayout.dimensionBasis ?? 'outside_face',
      requestedDimensionMeters: bounds.exteriorWidthMeters,
      wall: resolvedPreset.wall,
      columnWidthMeters: resolvedPreset.frameSystem.defaultColumnWidthMeters,
      layout: wallLayout,
      segmentFrames: designGeometryResult.wallCmuLayout.segmentFrames,
      columns: designGeometryResult.frameSystem?.columns ?? resolvedPreset.frameSystem.columns,
      beams: designGeometryResult.frameSystem?.beams ?? resolvedPreset.frameSystem.beams,
      dimension: 'width',
    });
    const nearestLength = nearestModularCandidate(lengthCandidates, 'bond_modular');
    const nearestWidth = nearestModularCandidate(widthCandidates, 'bond_modular');
    const resolvedLength = nearestLength?.candidateDimensionMeters ?? bounds.exteriorLengthMeters;
    const resolvedWidth = nearestWidth?.candidateDimensionMeters ?? bounds.exteriorWidthMeters;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const halfLength = resolvedLength / 2;
    const halfWidth = resolvedWidth / 2;
    const nextNodes = wallLayout.nodes.map((node) => ({
      ...node,
      x: node.x < centerX ? centerX - halfLength : centerX + halfLength,
      z: node.z < centerZ ? centerZ - halfWidth : centerZ + halfWidth,
    }));
    commitWallLayout({ ...wallLayout, nodes: nextNodes }, 'Apply module fit', 'module_fit_apply');
    if (!hasUserAdjustedPlanViewRef.current) {
      autoFitPlanForLayoutKeyRef.current = null;
      issueViewCommand('fit');
    }
    if (!hasUserAdjusted3dViewRef.current) {
      autoFit3dForLayoutKeyRef.current = null;
      pending3dFitRef.current = true;
    }
    const adjustmentMessage = [
      nearestLength
        ? `Length: requested ${bounds.exteriorLengthMeters.toFixed(2)} m → ${resolvedLength.toFixed(2)} m (${nearestLength.status}).`
        : null,
      nearestWidth
        ? `Width: requested ${bounds.exteriorWidthMeters.toFixed(2)} m → ${resolvedWidth.toFixed(2)} m (${nearestWidth.status}).`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    setStatus({
      tone: 'success',
      message: adjustmentMessage || report.summary,
    });
  }

  function resolveActivePlanSnap(
    rawPoint: { x: number; z: number },
    options?: { includeDrawContext?: boolean; shiftHeld?: boolean; altHeld?: boolean },
  ): DesignSnapTarget {
    const moduleLength = cmuModule.moduleLengthMeters;
    const effectiveSnapMode = moduleFitMode === 'snap_during_draw' && snapMode === 'cmu_module' ? 'grid' : snapMode;
    const snapTarget = resolveDesignSnapPoint({
      layout: wallLayout,
      point: rawPoint,
      snapMode: effectiveSnapMode,
      moduleLengthMeters: moduleLength,
      pixelsPerMeter: planViewport.zoom,
      altHeld: options?.altHeld,
      drawContext: options?.includeDrawContext
        ? {
            activeNodeId: activeDrawNodeId,
            drawStartNodeId,
            orthogonalLock: wallLayout.orthogonalLock,
            shiftHeld: options?.shiftHeld,
            closureCornerCandidate: activeDrawNodeId
              ? resolveOrthogonalCornerPoint({ layout: wallLayout, activeNodeId: activeDrawNodeId })
              : null,
          }
        : undefined,
      previousSnap: lastSnapTargetRef.current,
    });
    lastSnapTargetRef.current = snapTarget;
    setDraftSnapTarget(snapTarget);
    return snapTarget;
  }

  function applyDrawGuidanceAfterSnap(
    activeNodeId: string,
    snapTarget: DesignSnapTarget,
    options?: { shiftHeld?: boolean; altHeld?: boolean },
  ): { point: { x: number; z: number }; constraintLabel: string | null } {
    if (options?.altHeld) {
      return { point: snapTarget.point, constraintLabel: null };
    }
    if (snapTarget.type === 'node' || snapTarget.type === 'endpoint') {
      return { point: snapTarget.point, constraintLabel: null };
    }
    if (options?.shiftHeld) {
      if (snapTarget.type === 'guide') {
        return { point: snapTarget.point, constraintLabel: snapTarget.label ?? 'Locked 90°' };
      }
      const constrained = resolveShiftConstrainedPoint({
        layout: wallLayout,
        activeNodeId,
        rawPoint: snapTarget.point,
      });
      if (snapTarget.type === 'grid' || snapTarget.type === 'cmu_module') {
        const activeNode = wallLayout.nodes.find((node) => node.id === activeNodeId);
        if (activeNode) {
          const dx = constrained.point.x - activeNode.x;
          const dz = constrained.point.z - activeNode.z;
          const length = Math.hypot(dx, dz);
          if (length > 0) {
            const dir = { x: dx / length, z: dz / length };
            const t = (snapTarget.point.x - activeNode.x) * dir.x + (snapTarget.point.z - activeNode.z) * dir.z;
            return {
              point: { x: activeNode.x + dir.x * t, z: activeNode.z + dir.z * t },
              constraintLabel: constrained.label,
            };
          }
        }
      }
      return { point: constrained.point, constraintLabel: constrained.label };
    }
    return { point: snapTarget.point, constraintLabel: null };
  }

  const handlePlanInteraction = (event: DesignBuilderInteractionEvent) => {
    if (!modelLoaded) return;

    if (event.kind === 'cancel') {
      cancelPlanDraw();
      return;
    }

    if (event.kind === 'undo_last_segment') {
      handleUndoDesign();
      return;
    }

    const moduleLength = cmuModule.moduleLengthMeters;
    const effectiveSnapMode = moduleFitMode === 'snap_during_draw' && snapMode === 'cmu_module' ? 'grid' : snapMode;
    const layout = wallLayout;
    const snapLayout = {
      ...layout,
      snapToGrid: snapMode === 'grid' || snapMode === 'cmu_module',
      snapToModule: snapMode === 'cmu_module',
    };

    if (event.kind === 'draw_preview' && event.planX != null && event.planZ != null && activeDrawNodeId) {
      const currentActiveDrawNodeId =
        layout.nodes.some((node) => node.id === activeDrawNodeId)
          ? activeDrawNodeId
          : resolveActiveDrawNodeId(layout);
      const start = layout.nodes.find((node) => node.id === currentActiveDrawNodeId);
      if (!start) return;
      const rawPoint = { x: event.planX, z: event.planZ };
      const snapTarget = resolveActivePlanSnap(rawPoint, {
        includeDrawContext: true,
        shiftHeld: event.shiftHeld,
        altHeld: event.altHeld,
      });
      const guided = applyDrawGuidanceAfterSnap(currentActiveDrawNodeId, snapTarget, {
        shiftHeld: event.shiftHeld,
        altHeld: event.altHeld,
      });
      let point = guided.point;
      setDrawWallConstraintLabel(guided.constraintLabel);
      const guidance = resolveDrawWallGuidance({
        layout,
        activeNodeId: currentActiveDrawNodeId,
        rawPoint: point,
        orthogonalLock: layout.orthogonalLock,
      });
      setDrawWallPreviewMetrics({
        lengthMeters: guidance.lengthMeters ?? Math.hypot(point.x - start.x, point.z - start.z),
        angleDegrees: guidance.angleDegrees ?? 0,
      });
      const exactLength = segmentLengthInput ? Number(segmentLengthInput) : undefined;
      if (exactLength && exactLength > 0) {
        point = projectExactSegmentLength(start, point.x, point.z, exactLength);
      } else if (moduleFitMode === 'snap_during_draw') {
        const length = Math.hypot(point.x - start.x, point.z - start.z);
        const modularLength = snapLengthToCmuHalfModule(length, moduleLength);
        if (modularLength > 0) point = projectExactSegmentLength(start, point.x, point.z, modularLength);
      }
      setDraftPlanEnd(point);
      const assist = layout.orthogonalLock
        ? resolveOrthogonalClosureAssist({
            layout,
            activeNodeId: currentActiveDrawNodeId,
            candidatePoint: point,
          })
        : null;
      setOrthogonalClosureAssist(assist?.isEligible ? assist : null);
      const cornerPoint = resolveOrthogonalCornerPoint({
        layout,
        activeNodeId: currentActiveDrawNodeId,
      });
      setClosureCornerSnap(
        cornerPoint &&
          Math.hypot(rawPoint.x - cornerPoint.x, rawPoint.z - cornerPoint.z) * planViewport.zoom <=
            GUIDE_CAPTURE_RADIUS_PX
          ? { point: cornerPoint, captured: Boolean(event.shiftHeld) }
          : null,
      );
      return;
    }

    if (event.kind === 'draw_preview' && event.planX != null && event.planZ != null) {
      const snapTarget = resolveActivePlanSnap(
        { x: event.planX, z: event.planZ },
        { includeDrawContext: true, altHeld: event.altHeld },
      );
      setDraftPlanEnd(snapTarget.point);
      return;
    }

    if (event.kind === 'draw_point' && event.planX != null && event.planZ != null) {
      const rawPoint = { x: event.planX, z: event.planZ };
      const exactLength = segmentLengthInput ? Number(segmentLengthInput) : undefined;
      const currentActiveDrawNodeId =
        activeDrawNodeId && layout.nodes.some((node) => node.id === activeDrawNodeId)
          ? activeDrawNodeId
          : resolveActiveDrawNodeId(layout);
      const snapTarget = resolveActivePlanSnap(rawPoint, {
        includeDrawContext: true,
        shiftHeld: event.shiftHeld,
        altHeld: event.altHeld,
      });
      let point = snapTarget.point;
      if (currentActiveDrawNodeId) {
        const start = layout.nodes.find((node) => node.id === currentActiveDrawNodeId);
        if (start) {
          const guided = applyDrawGuidanceAfterSnap(currentActiveDrawNodeId, snapTarget, {
            shiftHeld: event.shiftHeld,
            altHeld: event.altHeld,
          });
          point = guided.point;
        }
        if (start && moduleFitMode === 'snap_during_draw' && !exactLength) {
          const length = Math.hypot(point.x - start.x, point.z - start.z);
          const modularLength = snapLengthToCmuHalfModule(length, moduleLength);
          if (modularLength > 0) point = projectExactSegmentLength(start, point.x, point.z, modularLength);
        }
      }
      if (!currentActiveDrawNodeId) {
        const snappedNodeId =
          (snapTarget.type === 'node' || snapTarget.type === 'endpoint') && snapTarget.sourceId
            ? snapTarget.sourceId
            : null;
        if (snappedNodeId) {
          setActiveDrawNodeId(snappedNodeId);
          setDrawStartNodeId(snappedNodeId);
          setDraftPlanEnd(null);
          return;
        }
        const nodeId = createWallLayoutId('node');
        const next = {
          ...layout,
          nodes: [...layout.nodes, { id: nodeId, x: point.x, z: point.z }],
        };
        mutateWallLayoutSilent(next);
        setActiveDrawNodeId(nodeId);
        setDrawStartNodeId(nodeId);
        setDraftPlanEnd(null);
        return;
      }
      const next = addWallSegment(layout, currentActiveDrawNodeId, point.x, point.z, {
        exactLengthMeters: exactLength,
        wallHeightMeters: layout.defaultWallHeightMeters,
      });
      commitWallLayout(next, 'Draw wall', 'wall_add');
      if (layout.segments.length === 0 && !hasUserAdjustedPlanViewRef.current) {
        issueViewCommand('fit');
        pending3dFitRef.current = true;
      }
      setActiveDrawNodeId(next.segments.at(-1)?.endNodeId ?? null);
      if (snapTarget.type === 'line') {
        setStatus({ tone: 'info', message: 'Line snap selected. Segment split coming later.' });
      }
      setDraftPlanEnd(null);
      setDrawWallConstraintLabel(null);
      setDrawWallPreviewMetrics(null);
      setOrthogonalClosureAssist(null);
      setClosureCornerSnap(null);
      setDraftSnapTarget(null);
      lastSnapTargetRef.current = null;
      setSegmentLengthInput('');
      return;
    }

    if (event.kind === 'move_node' && event.nodeId && event.planX != null && event.planZ != null) {
      let point = snapPlanPoint(event.planX, event.planZ, snapLayout, moduleLength);
      if (event.phase === 'preview') {
        setDraftPlanEnd(point);
        return;
      }
      const next = moveWallNode(layout, event.nodeId, point.x, point.z);
      commitWallLayout(next, 'Move wall node', 'wall_move');
      setDraftPlanEnd(null);
      return;
    }

    if (event.kind === 'select_node' && event.nodeId) {
      setSelectedNodeId(event.nodeId);
      setSelectedSegmentId(null);
      setSelectedOpeningId(null);
      setSelectedObjectType(null);
      if (toolMode === 'move_wall_node') setActiveDrawNodeId(event.nodeId);
      return;
    }

    if (event.kind === 'segment_pick' && event.planX != null && event.planZ != null) {
      const openingHit =
        toolMode === 'select' || toolMode === 'delete' || toolMode === 'move_opening'
          ? pickOpeningAtPlanPoint({
              planX: event.planX,
              planZ: event.planZ,
              openings: effectiveWall.openings,
              resolvedByOpeningId: planResolvedOpeningsById,
              framesBySegmentId: new Map(planSegmentFrames.map((frame) => [frame.segmentId, frame])),
            })
          : null;
      if (openingHit && toolMode === 'delete') {
        if (event.phase !== 'commit') return;
        const opening = effectiveWall.openings.find((item) => item.id === openingHit.openingId);
        if (!opening) return;
        void (async () => {
          const confirmed = await confirm({
            title: 'Delete opening?',
            message:
              'This will update CMU blocks, grout, lintels, and estimate preview quantities. This will not delete committed estimate lines automatically.',
            confirmLabel: 'Delete opening',
            confirmVariant: 'danger',
            showWarningIcon: true,
          });
          if (!confirmed) return;
          deleteOpening(openingHit.openingId);
          setStatus({
            tone: 'success',
            message: `${opening.type === 'door' ? 'Door' : 'Window'} opening removed from the wall system.`,
          });
        })();
        return;
      }
      if (openingHit && (toolMode === 'select' || toolMode === 'move_opening')) {
        if (event.phase !== 'commit') return;
        setSelectedOpeningId(openingHit.openingId);
        setSelectedSegmentId(null);
        setSelectedNodeId(null);
        const opening = effectiveWall.openings.find((item) => item.id === openingHit.openingId);
        if (opening) {
          setSelectedObjectType(opening.type === 'door' ? 'door_opening' : 'window_opening');
        }
        if (toolMode === 'move_opening') return;
        return;
      }
      const hit = resolveSegmentAtPoint(layout, event.planX, event.planZ);
      if (!hit) {
        if (toolMode === 'select' || toolMode === 'delete') clearSelection();
        return;
      }
      setSelectedSegmentId(hit.segment.id);
      setSelectedNodeId(null);
      setSelectedOpeningId(null);
      setSelectedObjectType(null);
      if (toolMode === 'delete') {
        void confirmDeleteWallSegment(hit.segment.id);
        return;
      }
      if (toolMode === 'place_door' || toolMode === 'place_window') {
        const openingType = toolMode === 'place_door' ? 'door' : 'window';
        const frames = getSegmentFramesForWallLayout(layout, effectiveWall);
        const frame = segmentFrameById(frames, hit.segment.id);
        if (!frame) return;
        const openingDefinition = buildOpeningPlacementDefinition(openingType);
        const resolved = resolveOpeningPlacementFromPlanPoint({
          planX: event.planX,
          planZ: event.planZ,
          hostSegmentId: hit.segment.id,
          segmentFrame: frame,
          openingDefinition,
          snapMode,
          gridSpacingMeters: layout.gridSpacingMeters,
          wall: effectiveWall,
          slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
        });
        const draft = applyOpeningToolSettings(
          openingDraftFromPlacementResolution(resolved, openingDefinition, effectiveWall, layout),
        );
        if (event.phase === 'preview') {
          setPlacementPreviewFromResolved(resolved, draft, openingType, {
            hitPoint: { x: event.planX, z: event.planZ },
          });
          return;
        }
        if (!resolved.isValid) {
          setStatus({ tone: 'error', message: resolved.validationMessages[0] ?? 'Opening cannot be placed there.' });
          return;
        }
        if (
          placementPreview &&
          placementPreview.isValid &&
          placementPreview.wallSegmentId === resolved.hostSegmentId &&
          placementPreview.openingType === openingType
        ) {
          commitPlacementPreview();
          return;
        }
        addOpening(draft);
        setPlacementPreview(null);
      }
      if (toolMode === 'move_opening' && selectedOpeningId) {
        const opening = effectiveWall.openings.find((item) => item.id === selectedOpeningId);
        if (!opening) return;
        const frame = segmentFrameById(planSegmentFrames, hit.segment.id);
        if (!frame) return;
        const openingDefinition: OpeningPlacementDefinition = {
          type: opening.type,
          widthMeters: opening.widthMeters,
          heightMeters: opening.heightMeters,
          sillHeightMeters: opening.sillHeightMeters,
          roughOpeningAllowanceMeters: opening.roughOpeningAllowanceMeters,
        };
        const resolved = resolveOpeningPlacementFromPlanPoint({
          planX: event.planX,
          planZ: event.planZ,
          hostSegmentId: hit.segment.id,
          segmentFrame: frame,
          openingDefinition,
          snapMode,
          gridSpacingMeters: layout.gridSpacingMeters,
          wall: effectiveWall,
          slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
        });
        const draft = applyOpeningToolSettings(
          openingDraftFromPlacementResolution(resolved, openingDefinition, effectiveWall, layout, opening.id),
        );
        if (event.phase === 'preview') {
          setPlacementPreviewFromResolved(resolved, draft, opening.type, {
            hitPoint: { x: event.planX, z: event.planZ },
            openingId: opening.id,
          });
          return;
        }
        const status = summarizeOpeningPlacementStatus(draft, effectiveWall);
        if (!resolved.isValid || !status.isValid) {
          setPlacementPreview(null);
          setStatus({ tone: 'error', message: status.warnings[0] ?? resolved.validationMessages[0] ?? 'Opening move was not valid.' });
          return;
        }
        moveOpening(opening.id, draft);
      }
    }
  };

  useEffect(() => {
    if (!modelLoaded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (event.key === 'Escape') {
        if (closeDesignBuilderCommandMenus()) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return;
        }
        if (toolMode === 'draw_wall') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          cancelPlanDraw();
          return;
        }
        if (placementPreview || toolMode !== 'select') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setPlacementPreview(null);
          setToolMode('select');
          return;
        }
        if (selectedSegmentId || selectedNodeId || selectedOpeningId || selectedObjectType) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          clearSelection();
        }
        return;
      }

      if (event.key === 'Backspace' && toolMode === 'draw_wall') {
        event.preventDefault();
        undoLastDrawSegment();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSegmentId) {
        event.preventDefault();
        void confirmDeleteWallSegment(selectedSegmentId);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [modelLoaded, selectedObjectType, selectedOpeningId, selectedNodeId, selectedSegmentId, toolMode, placementPreview, wallLayout]);

  const handleViewerInteraction = (event: DesignBuilderInteractionEvent) => {
      if (!modelLoaded) return;
      const wall = resolvedPreset.wall;

      switch (event.kind) {
        case 'cancel':
          if (placementPreview || toolMode !== 'select') {
            setPlacementPreview(null);
            setToolMode('select');
          } else {
            clearSelection();
          }
          break;
        case 'clear_selection':
          clearSelection();
          break;
        case 'select_object':
          setSelectedObjectType(event.objectType ?? null);
          setSelectedOpeningId(null);
          setSelectedSegmentId(null);
          setSelectedNodeId(null);
          setPlacementPreview(null);
          break;
        case 'select_opening':
          if (event.openingId) {
            setSelectedOpeningId(event.openingId);
            setSelectedSegmentId(null);
            setSelectedNodeId(null);
            const opening = wall.openings.find((item) => item.id === event.openingId);
            if (opening) {
              setSelectedObjectType(opening.type === 'door' ? 'door_opening' : 'window_opening');
            }
          }
          break;
        case 'wall_pick':
          if (event.toolMode !== 'place_door' && event.toolMode !== 'place_window') break;
          if (!event.openingType || !event.wallSegmentId || event.positionAlongSegment == null) break;
          {
            const openingDefinition = buildOpeningPlacementDefinition(event.openingType);
            const frames = getSegmentFramesForWallLayout(wallLayout, wall);
            const frame = segmentFrameById(frames, event.wallSegmentId);
            const hitPoint =
              event.hitPointX != null && event.hitPointZ != null
                ? { x: event.hitPointX, y: event.hitPointY, z: event.hitPointZ }
                : frame
                  ? {
                      x: frame.exteriorStart.x + frame.tangent.x * event.positionAlongSegment,
                      z: frame.exteriorStart.z + frame.tangent.z * event.positionAlongSegment,
                    }
                  : { x: 0, z: 0 };
            const resolved = resolveOpeningPlacementForHit({
              hitPoint,
              wallSegmentId: event.wallSegmentId,
              openingDefinition,
              wall,
              layout: wallLayout,
              snapMode,
              slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
            });
            if (!resolved) break;
            const draft = applyOpeningToolSettings(
              openingDraftFromPlacementResolution(resolved, openingDefinition, wall, wallLayout),
            );
            setPlacementPreviewFromResolved(resolved, draft, event.openingType, {
              hitPoint,
              rawHitStationMeters: event.positionAlongSegment,
            });
          }
          break;
        case 'place_commit':
          if (event.toolMode !== 'place_door' && event.toolMode !== 'place_window') break;
          if (
            placementPreview &&
            placementPreview.isValid &&
            placementPreview.wallSegmentId &&
            placementPreview.openingType === event.openingType
          ) {
            if (commitPlacementPreview()) {
              setStatus({
                tone: 'success',
                message: `${event.openingType === 'door' ? 'Door' : 'Window'} placed.`,
              });
            }
            break;
          }
          if (!event.openingType || !event.wallSegmentId || event.positionAlongSegment == null) {
            if (!event.openingType || !event.wallFace || event.offsetMeters == null) break;
            {
              const openingDefinition = buildOpeningPlacementDefinition(event.openingType);
              const resolved = resolveOpeningPlacementForLegacyFaceOffset({
                wallFace: event.wallFace,
                offsetMeters: event.offsetMeters,
                openingDefinition,
                wall,
                layout: wallLayout,
                slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
              });
              if (!resolved?.isValid) {
                setStatus({
                  tone: 'error',
                  message: resolved?.validationMessages[0] ?? 'Opening cannot be placed there.',
                });
                break;
              }
              const draft = applyOpeningToolSettings(
                openingDraftFromPlacementResolution(resolved, openingDefinition, wall, wallLayout),
              );
              addOpening(draft);
              setStatus({
                tone: 'success',
                message: `${event.openingType === 'door' ? 'Door' : 'Window'} placed.`,
              });
            }
            break;
          }
          {
            const openingDefinition = buildOpeningPlacementDefinition(event.openingType);
            const hitPoint =
              event.hitPointX != null && event.hitPointZ != null
                ? { x: event.hitPointX, y: event.hitPointY, z: event.hitPointZ }
                : {
                    x: 0,
                    z: 0,
                  };
            const resolved = resolveOpeningPlacementForHit({
              hitPoint,
              wallSegmentId: event.wallSegmentId,
              openingDefinition,
              wall,
              layout: wallLayout,
              snapMode,
              slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
            });
            if (!resolved?.isValid) {
              setStatus({ tone: 'error', message: resolved?.validationMessages[0] ?? 'Opening cannot be placed there.' });
              break;
            }
            const draft = applyOpeningToolSettings(
              openingDraftFromPlacementResolution(resolved, openingDefinition, wall, wallLayout),
            );
            addOpening(draft);
            setPlacementPreview(null);
            setStatus({
              tone: 'success',
              message: `${event.openingType === 'door' ? 'Door' : 'Window'} placed.`,
            });
          }
          break;
        case 'opening_move':
          if (event.openingId && (event.wallSegmentId || event.wallFace) && (event.positionAlongSegment != null || event.offsetMeters != null)) {
            const opening = wall.openings.find((item) => item.id === event.openingId);
            if (!opening) return;
            const openingDefinition: OpeningPlacementDefinition = {
              type: opening.type,
              widthMeters: opening.widthMeters,
              heightMeters: opening.heightMeters,
              sillHeightMeters: opening.sillHeightMeters,
              roughOpeningAllowanceMeters: opening.roughOpeningAllowanceMeters,
            };
            const hitPoint =
              event.hitPointX != null && event.hitPointZ != null
                ? { x: event.hitPointX, y: event.hitPointY, z: event.hitPointZ }
                : undefined;
            const resolved = hitPoint && event.wallSegmentId
              ? resolveOpeningPlacementForHit({
                  hitPoint,
                  wallSegmentId: event.wallSegmentId,
                  openingDefinition,
                  wall,
                  layout: wallLayout,
                  snapMode,
                  slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
                })
              : event.wallFace && event.offsetMeters != null
                ? resolveOpeningPlacementForLegacyFaceOffset({
                    wallFace: event.wallFace,
                    offsetMeters: event.offsetMeters,
                    openingDefinition,
                    wall,
                    layout: wallLayout,
                    slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
                  })
                : null;
            const patched = resolved
              ? openingDraftFromPlacementResolution(resolved, openingDefinition, wall, wallLayout, opening.id)
              : event.wallSegmentId && event.positionAlongSegment != null
                ? applyOpeningSegmentPatch(opening, wall, wallLayout, {
                    wallSegmentId: event.wallSegmentId,
                    positionAlongSegment: event.positionAlongSegment,
                  })
                : opening;
            const status = summarizeOpeningPlacementStatus(patched, wall);
            if (event.phase === 'commit') {
              if (status.isValid) {
                moveOpening(event.openingId, patched);
                setPlacementPreview(null);
              } else {
                setPlacementPreview(null);
                setStatus({ tone: 'error', message: status.warnings[0] ?? 'Opening move was not valid; original location restored.' });
              }
            } else if (resolved) {
              setPlacementPreviewFromResolved(resolved, applyOpeningToolSettings(patched), opening.type, {
                hitPoint,
                openingId: event.openingId,
              });
            } else {
              setPlacementPreview({
                wallFace: patched.wallFace ?? event.wallFace ?? 'south',
                offsetMeters: patched.offsetMeters ?? event.offsetMeters ?? event.positionAlongSegment ?? 0,
                positionAlongSegment: patched.positionAlongSegment ?? event.positionAlongSegment,
                openingType: patched.type,
                widthMeters: patched.widthMeters,
                heightMeters: patched.heightMeters,
                sillHeightMeters: patched.sillHeightMeters,
                isValid: status.isValid,
                statusKind: status.kind,
                openingId: event.openingId,
                wallSegmentId: patched.wallSegmentId,
              });
            }
          }
          break;
        default:
          break;
      }
  };

  async function handleSaveDesign() {
    if (!modelLoaded) {
      setStatus({ tone: 'info', message: 'Load the example before saving design parameters.' });
      return;
    }
    if (!designModel) {
      setStatus({ tone: 'info', message: 'Sign in and load the example to save design parameters to the project.' });
      return;
    }
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    setBusy(true);
    setStatus({ tone: 'info', message: 'Saving design parameters...' });
    try {
      await persistDesignObjects();
      setStatus({ tone: 'success', message: 'Design parameters saved.' });
    } finally {
      setBusy(false);
    }
  }

  function updateFootprint(field: 'lengthMeters' | 'widthMeters', value: number) {
    const rawValue = positiveOrFallback(value, resolvedPreset.footprint[field]);
    const safeValue = resolvedPreset.wall.snapToModule
      ? snapLengthToCmuModule(rawValue, cmuModule.moduleLengthMeters)
      : rawValue;
    applyPresetPatch(
      (current) => ({
        ...current,
        footprint: { ...current.footprint, [field]: safeValue },
        slab: { ...current.slab, [field]: safeValue },
        wall: { ...current.wall, [field]: safeValue },
        roof: { ...current.roof, [field]: safeValue },
        truss: field === 'lengthMeters' ? { ...current.truss, buildingLengthMeters: safeValue } : current.truss,
      }),
      'Update footprint',
      'footprint_update',
    );
  }

  function updateDesignDefaults(
    patch: Partial<CmuBuildingPreset['wall']>,
    options?: { changedSetting?: string; previousValue?: unknown },
  ) {
    const previousWall = resolvedPreset.wall;
    const layoutPatch: { heightMeters?: number; wallThicknessMeters?: number } = {};
    if (typeof patch.heightMeters === 'number') layoutPatch.heightMeters = patch.heightMeters;
    if (typeof patch.wallThicknessMeters === 'number') layoutPatch.wallThicknessMeters = patch.wallThicknessMeters;

    executeDesignCommand({
      label: 'Edit masonry settings',
      kind: 'masonry_settings_update',
      mutate: (before) => {
        const nextLayout =
          Object.keys(layoutPatch).length > 0
            ? selectedSegmentId
              ? {
                  ...before.wallLayout,
                  ...(typeof layoutPatch.heightMeters === 'number'
                    ? { defaultWallHeightMeters: layoutPatch.heightMeters }
                    : {}),
                  ...(typeof layoutPatch.wallThicknessMeters === 'number'
                    ? { defaultWallThicknessMeters: layoutPatch.wallThicknessMeters }
                    : {}),
                }
              : applyProjectMasonryDefaultsToLayout(before.wallLayout, layoutPatch)
            : before.wallLayout;

        return patchDesignSnapshot(before, resolvePresetName(), (current) => {
          let nextWall = syncWallBlockModuleFromScalars({ ...current.wall, ...patch });
          if (typeof patch.lintelBearingMeters === 'number') {
            const previousDefault = previousWall.lintelBearingMeters ?? 0.2;
            nextWall = {
              ...nextWall,
              openings: nextWall.openings.map((opening) =>
                opening.lintelBearingMeters === undefined || opening.lintelBearingMeters === previousDefault
                  ? { ...opening, lintelBearingMeters: patch.lintelBearingMeters }
                  : opening,
              ),
            };
          }
          if (typeof patch.lintelType === 'string') {
            const previousDefault = previousWall.lintelType ?? 'bond_beam';
            nextWall = {
              ...nextWall,
              openings: nextWall.openings.map((opening) =>
                opening.lintelType === undefined || opening.lintelType === previousDefault
                  ? { ...opening, lintelType: patch.lintelType }
                  : opening,
              ),
            };
          }
          return syncPresetFromLayout({ ...current, wall: nextWall, wallLayout: nextLayout }, nextLayout);
        });
      },
    });

    if (import.meta.env.DEV && options?.changedSetting) {
      const nextWall = syncWallBlockModuleFromScalars({ ...previousWall, ...patch });
      const nextInput = buildDesignGeometryInputFromLayout({
        wallLayout:
          Object.keys(layoutPatch).length > 0 && !selectedSegmentId
            ? applyProjectMasonryDefaultsToLayout(wallLayout, layoutPatch)
            : wallLayout,
        cmuSettings: nextWall,
        openings: nextWall.openings,
        slabSettings: footprintClosed ? resolvedPreset.slab : { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 },
        roofSettings: footprintClosed ? resolvedPreset.roof : { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 },
        trussSettings: footprintClosed ? resolvedPreset.truss : { ...resolvedPreset.truss, buildingLengthMeters: 0 },
      });
      const nextGeometry = generateDesignGeometry(nextInput);
      logMasonrySettingsCommit({
        changedSetting: options.changedSetting,
        previousValue: options.previousValue,
        nextValue: patch[options.changedSetting as keyof typeof patch],
        geometryKey: buildMasonryGeometryKey({
          wallLayout: nextInput.wallLayout ?? wallLayout,
          wall: nextWall,
          openings: nextWall.openings,
          moduleFitMode,
          manualMasonryRuns,
        }),
        wall: nextWall,
        generatedBlockCount: nextGeometry.blockCount,
        generatedCourseCount: nextGeometry.wallCmuLayout.courseCount,
      });
    }
  }

  function updateSelectedWallSegment(patch: Partial<Pick<DesignWallSegment, 'wallHeightMeters' | 'wallThicknessMeters'>>) {
    if (!selectedSegmentId) {
      updateDesignDefaults(
        {
          ...(typeof patch.wallHeightMeters === 'number' ? { heightMeters: patch.wallHeightMeters } : {}),
          ...(typeof patch.wallThicknessMeters === 'number' ? { wallThicknessMeters: patch.wallThicknessMeters } : {}),
        },
        {
          changedSetting: typeof patch.wallHeightMeters === 'number' ? 'heightMeters' : 'wallThicknessMeters',
          previousValue:
            typeof patch.wallHeightMeters === 'number'
              ? resolvedPreset.wall.heightMeters
              : resolvedPreset.wall.wallThicknessMeters,
        },
      );
      return;
    }
    commitWallLayout(
      {
        ...wallLayout,
        segments: wallLayout.segments.map((segment) =>
          segment.id === selectedSegmentId ? { ...segment, ...patch } : segment,
        ),
      },
      'Change wall dimensions',
      'structure_update',
    );
  }

  function updateWallField(field: keyof Pick<typeof resolvedPreset.wall, 'heightMeters' | 'wallThicknessMeters' | 'blockLengthMeters' | 'blockHeightMeters' | 'blockDepthMeters' | 'wasteFactor'>, value: number) {
    const previousValue = resolvedPreset.wall[field];
    const safeValue = field === 'wasteFactor' ? Math.max(0, value) : positiveOrFallback(value, Number(resolvedPreset.wall[field]));
    if (field === 'wasteFactor') {
      applyPresetPatch(
        (current) => ({
          ...current,
          wall: { ...current.wall, wasteFactor: safeValue },
        }),
        'Edit masonry settings',
        'masonry_settings_update',
      );
      return;
    }
    if (field === 'heightMeters') {
      updateSelectedWallSegment({ wallHeightMeters: safeValue });
      return;
    }
    if (field === 'wallThicknessMeters') {
      updateSelectedWallSegment({ wallThicknessMeters: safeValue });
      return;
    }
    updateDesignDefaults({ [field]: safeValue }, { changedSetting: field, previousValue });
  }

  function updateShowIndividualBlocks(showIndividualBlocks: boolean) {
    updateDesignDefaults({ showIndividualBlocks }, { changedSetting: 'showIndividualBlocks', previousValue: resolvedPreset.wall.showIndividualBlocks });
  }

  function updateWallOption(patch: Partial<CmuBuildingPreset['wall']>) {
    const [changedSetting] = Object.keys(patch) as Array<keyof CmuBuildingPreset['wall']>;
    updateDesignDefaults(patch, {
      changedSetting: changedSetting ?? 'wallOption',
      previousValue: changedSetting ? resolvedPreset.wall[changedSetting] : undefined,
    });
  }

  function updateBlockModuleField(field: keyof NonNullable<CmuBuildingPreset['wall']['blockModule']>, value: number | string) {
    const currentModule = resolveCmuModuleConfig(resolvedPreset.wall);
    const nextModule = {
      ...currentModule,
      [field]: typeof value === 'number' ? Math.max(0, value) : value,
    };
    updateDesignDefaults(
      {
        blockModule: nextModule,
        blockLengthMeters: nextModule.moduleLengthMeters,
        blockHeightMeters: nextModule.moduleHeightMeters,
        blockDepthMeters: nextModule.nominalDepthMeters,
        wallThicknessMeters: nextModule.nominalDepthMeters,
        mortarJointMeters: nextModule.mortarJointMeters,
      },
      { changedSetting: field, previousValue: currentModule[field] },
    );
  }

  function updateSlabField(field: keyof Pick<typeof resolvedPreset.slab, 'slabThicknessMeters' | 'edgeWidthMeters' | 'edgeDepthMeters'>, value: number) {
    applyPresetPatch(
      (current) => ({
        ...current,
        slab: { ...current.slab, [field]: positiveOrFallback(value, Number(current.slab[field])) },
      }),
      'Edit structure settings',
      'structure_update',
    );
  }

  function updateRoofField(field: keyof Pick<typeof resolvedPreset.roof, 'pitchRisePerRun' | 'overhangMeters'>, value: number) {
    applyPresetPatch(
      (current) => ({
        ...current,
        roof: { ...current.roof, [field]: Math.max(0, value) },
      }),
      'Edit structure settings',
      'structure_update',
    );
  }

  function updateTrussSpacing(value: number) {
    applyPresetPatch(
      (current) => ({
        ...current,
        truss: { ...current.truss, spacingMeters: positiveOrFallback(value, current.truss.spacingMeters) },
      }),
      'Edit structure settings',
      'structure_update',
    );
  }

  function updateStructureField(
    patch: Partial<import('../types').StructuralFrameSystemParameters> & {
      buildingSystemMode?: import('../types').BuildingSystemMode;
    },
  ) {
    applyPresetPatch(
      (current) => ({
        ...current,
        buildingSystemMode: patch.buildingSystemMode ?? current.buildingSystemMode,
        frameSystem: {
          ...current.frameSystem,
          ...patch,
          buildingSystemMode: patch.buildingSystemMode ?? current.frameSystem.buildingSystemMode,
        },
      }),
      'Edit structural frame settings',
      'structure_update',
    );
  }

  function updateFoundationField(
    patch: Partial<import('../types').GradeBeamSettings> | Partial<import('../types').IsolatedFootingSettings>,
    section: 'gradeBeam' | 'isolatedFootings',
  ) {
    applyPresetPatch(
      (current) => ({
        ...current,
        foundationSettings: {
          ...(current.foundationSettings ?? createDefaultFoundationSettings()),
          [section]: {
            ...(current.foundationSettings ?? createDefaultFoundationSettings())[section],
            ...patch,
          },
        },
      }),
      'Edit foundation settings',
      'structure_update',
    );
  }

  function updateGableField(gableId: string, patch: Partial<import('../types').GableEndSettings>) {
    applyPresetPatch(
      (current) => ({
        ...current,
        gableEndSystem: {
          ...current.gableEndSystem,
          gableEnds: current.gableEndSystem.gableEnds.map((g) =>
            g.id === gableId ? { ...g, ...patch } : g,
          ),
        },
      }),
      'Edit gable end settings',
      'structure_update',
    );
  }

  function updateSelectedOpening(openingId: string, patch: Partial<WallOpeningParameters>) {
    applyPresetPatch(
      (current) => ({
        ...current,
        wall: {
          ...current.wall,
          openings: current.wall.openings.map((opening) =>
            opening.id === openingId
              ? snapOpeningToCmuModule({ ...opening, ...patch }, current.wall)
              : opening,
          ),
        },
      }),
      'Edit opening',
      'opening_edit',
    );
  }

  function clearSelection() {
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setPlacementPreview(null);
  }

  function ensureDrawWallOrthogonalDefault(layout: DesignWallLayoutParameters = wallLayout) {
    if (orthogonalGuidesPreferenceTouchedRef.current || layout.orthogonalLock) return layout;
    const next = { ...layout, orthogonalLock: true };
    mutateWallLayoutSilent(next);
    return next;
  }

  function toggleOrthogonalGuides() {
    orthogonalGuidesPreferenceTouchedRef.current = true;
    saveDesignBuilderSession(sessionKey, { orthogonalGuidesPreferenceTouched: true });
    mutateWallLayoutSilent({ ...wallLayout, orthogonalLock: !wallLayout.orthogonalLock });
  }

  function activateDrawWallTool() {
    closeDesignBuilderCommandMenus();
    ensureDrawWallOrthogonalDefault();
    setToolMode('draw_wall');
    setViewMode('plan');
  }

  function activateToolMode(mode: DesignBuilderToolMode) {
    closeDesignBuilderCommandMenus();
    if (mode === 'draw_wall') {
      activateDrawWallTool();
      return;
    }
    setToolMode(mode);
    if (mode === 'move_wall_node') setViewMode('plan');
    if (mode === 'select') setPlacementPreview(null);
  }

  async function handleLoadTemplate() {
    const before = captureDesignSnapshot();
    setBusy(true);
    setStatus({ tone: 'info', message: DESIGN_BUILDER_COPY.status.loadingTemplate });
    try {
      const nextPreset = createFiveBySixCmuBuildingPreset();
      let nextObjects: DesignModelObject[] = [];
      let nextModel: DesignModel | null = null;

      if (!user?.id) {
        const after = createDesignSnapshot({
          preset: nextPreset,
          objects: [],
          layoutState: 'demo_loaded',
          selectedObjectType: 'building_footprint',
          selectedOpeningId: null,
          selectedSegmentId: null,
          selectedNodeId: null,
        });
        applyDesignSnapshot(after);
        setDesignModel(null);
        setMasonryToolMode('full_block');
        setChangedAfterCommit(false);
        setActiveDrawNodeId(null);
        setDrawStartNodeId(null);
        setDraftPlanEnd(null);
        setPlacementPreview(null);
        setDesignHistory(createDesignHistoryState());
        recordDesignHistoryCommand('Load template', 'layout_reset', before, after);
        finalizeMutationAfterCommand();
        resetDesignViewFraming();
        setStatus({
          tone: 'success',
          message: DESIGN_BUILDER_COPY.status.templateLoadedLocal,
        });
        return;
      }

      const modelResult = await createDesignModel({
        projectId,
        estimateId,
        name: nextPreset.name,
        unitSystem: 'metric',
        createdBy: user.id,
        metadata: {
          preset: '5m_x_6m_cmu_building',
          source: 'parametric_design_builder',
        },
      });
      if (modelResult.error || !modelResult.data) {
        setStatus({ tone: 'error', message: modelResult.error ?? 'Could not save design model.' });
        return;
      }

      const objectResult = await upsertDesignModelObjects(
        buildPresetObjects({
          designModelId: modelResult.data.id,
          projectId,
          preset: nextPreset,
          includeStableIds: false,
        }),
      );
      if (objectResult.error || !objectResult.data) {
        setStatus({ tone: 'error', message: objectResult.error ?? 'Could not save design objects.' });
        return;
      }

      nextObjects = objectResult.data;
      nextModel = modelResult.data;
      const after = createDesignSnapshot({
        preset: nextPreset,
        objects: nextObjects,
        layoutState: 'demo_loaded',
        selectedObjectType: 'building_footprint',
        selectedOpeningId: null,
        selectedSegmentId: null,
        selectedNodeId: null,
      });
      applyDesignSnapshot(after);
      setDesignModel(nextModel);
      setMasonryToolMode('full_block');
      setChangedAfterCommit(false);
      setActiveDrawNodeId(null);
      setDrawStartNodeId(null);
      setDraftPlanEnd(null);
      setPlacementPreview(null);
      setDesignHistory(createDesignHistoryState());
      recordDesignHistoryCommand('Load template', 'layout_reset', before, after);
      finalizeMutationAfterCommand();
      resetDesignViewFraming();
      setStatus({
        tone: 'success',
        message: DESIGN_BUILDER_COPY.status.templateLoaded,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleStartBlankLayout() {
    const hasDesignData =
      wallLayout.nodes.length > 0 ||
      wallLayout.segments.length > 0 ||
      resolvedPreset.wall.openings.length > 0 ||
      previewLines.length > 0 ||
      persistedQuantityItems.length > 0 ||
      layoutState !== 'blank';
    if (hasDesignData) {
      const confirmed = await confirm({
        title: 'New layout?',
        message:
          'This removes all walls, openings, generated CMU geometry, and current Design Builder preview quantities from this design. Your global CMU settings will remain. Previously committed estimate lines will not be deleted automatically.',
        confirmLabel: 'New layout',
        confirmVariant: 'danger',
        showWarningIcon: true,
      });
      if (!confirmed) return;
    }

    const before = captureDesignSnapshot();
    const blankLayout = createBlankWallLayout({
      defaultWallHeightMeters: resolvedPreset.wall.heightMeters,
      defaultWallThicknessMeters: resolvedPreset.wall.wallThicknessMeters,
      dimensionBasis: 'outside_face',
    });
    const blankPreset = createBlankCmuBuildingPreset({
      wall: {
        ...resolvedPreset.wall,
        lengthMeters: 0,
        widthMeters: 0,
        openings: [],
        manualMasonryCourseRuns: [],
        manualMasonryCellOverrides: [],
      },
      slab: { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 },
      roof: { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 },
      truss: { ...resolvedPreset.truss, buildingLengthMeters: 0 },
    });
    const committedBlankPreset = { ...blankPreset, wallLayout: blankLayout };
    const blankGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: blankLayout,
        cmuSettings: committedBlankPreset.wall,
        openings: [],
        slabSettings: committedBlankPreset.slab,
        roofSettings: committedBlankPreset.roof,
        trussSettings: committedBlankPreset.truss,
      }),
    );
    const nextEpoch = layoutEpoch + 1;
    const after = createDesignSnapshot({
      preset: committedBlankPreset,
      objects,
      layoutState: 'blank',
      selectedObjectType: null,
      selectedOpeningId: null,
      selectedSegmentId: null,
      selectedNodeId: null,
    });
    applyDesignSnapshot(after);
    setLayoutEpoch(nextEpoch);
    setMasonryToolMode('full_block');
    setActiveDrawNodeId(null);
    setDrawStartNodeId(null);
    setDraftPlanEnd(null);
    setPlacementPreview(null);
    setObjectTreeExpanded(DEFAULT_OBJECT_TREE_EXPANSION);
    setPreviewLines([]);
    setPersistedQuantityItems([]);
    setChangedAfterCommit((current) => current || persistedQuantityItems.some((item) => item.estimateLineId));
    setDesignHistory(createDesignHistoryState());
    recordDesignHistoryCommand('New layout', 'layout_reset', before, after);
    finalizeMutationAfterCommand();
    setToolMode('select');
    setViewMode('plan');
    hasUserAdjustedPlanViewRef.current = false;
    hasUserAdjusted3dViewRef.current = false;
    orthogonalGuidesPreferenceTouchedRef.current = false;
    autoFitPlanForLayoutKeyRef.current = null;
    autoFit3dForLayoutKeyRef.current = null;
    sessionFramingValidatedRef.current = false;
    setPlanViewport(DEFAULT_PLAN_VIEWPORT);
    setCameraSnapshot(null);
    issueViewCommand('reset');
    setStatus({ tone: 'success', message: DESIGN_BUILDER_COPY.status.blankReady });
    if (import.meta.env.DEV) {
      console.table({
        sourcePath: blankGeometry.sourcePath,
        nodes: blankLayout.nodes.length,
        segments: blankLayout.segments.length,
        openings: committedBlankPreset.wall.openings.length,
        manualRuns: committedBlankPreset.wall.manualMasonryCourseRuns?.length ?? 0,
        overrides: committedBlankPreset.wall.manualMasonryCellOverrides?.length ?? 0,
        generatedBlocks: blankGeometry.blockInstances.length,
      });
    }
    clearDesignBuilderSession(sessionKey);
    saveDesignBuilderSession(sessionKey, {
      layoutState: 'blank',
      layoutEpoch: nextEpoch,
      masonryToolMode: 'full_block',
      orthogonalGuidesPreferenceTouched: false,
      preset: committedBlankPreset,
      selectedObjectType: null,
      selectedOpeningId: null,
      previewLines: [],
      persistedQuantityItems: [],
      toolMode: 'select',
      viewMode: 'plan',
      objectTreeExpanded: DEFAULT_OBJECT_TREE_EXPANSION,
      camera: null,
    });
    scheduleDebouncedSave();
  }

  async function handleGeneratePreview() {
    if (!modelLoaded) {
      setStatus({ tone: 'info', message: 'Load a CMU template or create a layout before generating an estimate preview.' });
      return;
    }
    if (generatedPreview.length === 0) {
      setStatus({ tone: 'error', message: 'No valid generated quantities are available for preview.' });
      return;
    }

    if (!designModel) {
      setPreviewLines(generatedPreview);
      setStatus({ tone: 'info', message: 'Preview generated locally. Save the model before committing.' });
      return;
    }

    setBusy(true);
    setStatus({ tone: 'info', message: 'Generating estimate preview...' });
    try {
      const persistResult = await persistDesignEstimatePreview({
        projectId,
        estimateId,
        designModelId: designModel.id,
        lines: generatedPreview,
      });
      if (persistResult.error || !persistResult.data) {
        setStatus({ tone: 'error', message: persistResult.error ?? 'Could not save estimate preview.' });
        return;
      }
      setPreviewLines(generatedPreview);
      setPersistedQuantityItems(persistResult.data);
      setStatus({
        tone: 'success',
        message: 'Estimate preview generated. Review quantities before committing to Detailed Estimate.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCommitPreview() {
    if (!designModel || persistedQuantityItems.length === 0 || previewLines.length === 0 || generatedPreview.length === 0) {
      setStatus({ tone: 'error', message: 'Generate and save the estimate preview before committing.' });
      return;
    }

    setBusy(true);
    setStatus({ tone: 'info', message: 'Committing Design Builder preview to Detailed Estimate...' });
    try {
      const result = await commitDesignEstimatePreview({
        projectId,
        estimateId,
        designModelId: designModel.id,
        previewLines,
        persistedQuantityItems,
        existingActivities: [],
        projectLaborRates: [],
      });
      if (result.error || !result.data) {
        setStatus({ tone: 'error', message: result.error ?? 'Could not commit estimate preview.' });
        return;
      }
      onEstimateCommitted?.();
      setChangedAfterCommit(false);
      setStatus({
        tone: 'success',
        message: `Committed ${result.data.committedQuantityItems.length} Design Builder quantities to estimate.`,
      });
    } finally {
      setBusy(false);
    }
  }

  const activeToolLabel = TOOL_MODE_OPTIONS.find((option) => option.mode === toolMode)?.label ?? 'Select';
  const activeBuildingSystemMode = resolvedPreset.buildingSystemMode;
  const activeStructureLabel = BUILDING_SYSTEM_MODE_LABELS[activeBuildingSystemMode];
  const isFrameStructureMode = activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill';
  const drawWallInstruction = DESIGN_BUILDER_COPY.hints.drawWall;
  const drawWallSnapFeedback = formatDrawWallSnapTargetFeedback({
    snapTarget: draftSnapTarget,
    snapMode,
    gridSpacingMeters: wallLayout.gridSpacingMeters,
    shiftConstraintLabel: drawWallConstraintLabel,
    lengthMeters: drawWallPreviewMetrics?.lengthMeters,
    angleDegrees: drawWallPreviewMetrics?.angleDegrees,
  });
  const toolInstruction = toolMode === 'place_door'
    ? DESIGN_BUILDER_COPY.hints.opening
    : toolMode === 'place_window'
      ? DESIGN_BUILDER_COPY.hints.opening
      : toolMode === 'move_wall_node'
        ? 'Drag node · Esc exits'
        : toolMode === 'move_opening'
          ? 'Drag selected opening along wall segment'
          : null;
  const activeOpeningTool = toolMode === 'place_door' ? 'door' : toolMode === 'place_window' ? 'window' : null;
  const activeOpeningSettings = activeOpeningTool ? openingToolSettings[activeOpeningTool] : null;
  const closeFootprintEnabled = modelLoaded && !footprintClosed && wallLayout.segments.length >= 3;
  const hasCutBlockWarnings =
    moduleWarnings.length > 0 ||
    livePlacementStatus?.kind === 'cut_block' ||
    cmuLayout.openingCourseClosures.some((closure) => closure.closureType === 'cut_block') ||
    cmuLayout.lintelCourseAssemblies.some(lintelCourseAssemblyRequiresCutWarning);
  const cutBlockWarningText =
    livePlacementStatus?.warnings.join(' ') ||
    moduleWarnings.join(' ') ||
    'Cut-block condition detected. Review CMU module fit and opening placement.';

  return (
    <DesignBuilderCommandMenuProvider>
    <div
      className={`bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        focusMode
          ? 'flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden p-3 sm:h-[calc(100dvh-6rem)]'
          : 'min-h-[720px] p-4'
      }`}
    >
      <div className={`flex shrink-0 flex-wrap items-start justify-between gap-3 ${focusMode ? 'mb-3' : 'mb-4'}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">
            Arden Design Builder
          </p>
          <h2 className="mt-1 text-2xl font-semibold">CMU Building Design Builder</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Build construction-aware objects, edit dimensions, review generated quantities, then commit only after confirmation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleLeftPanel}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-pressed={leftPanelCollapsed}
          >
            {DESIGN_BUILDER_COPY.actions.tools}
          </button>
          <button
            type="button"
            onClick={toggleRightPanel}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-pressed={rightPanelCollapsed}
          >
            {DESIGN_BUILDER_COPY.actions.estimate}
          </button>
          <button
            type="button"
            onClick={() => void handleLoadTemplate()}
            disabled={busy}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {DESIGN_BUILDER_COPY.actions.loadTemplate}
          </button>
          <button
            type="button"
            onClick={() => void handleStartBlankLayout()}
            disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {DESIGN_BUILDER_COPY.actions.newLayout}
          </button>
        </div>
      </div>

      <div
        className={`relative grid min-h-0 gap-4 ${
          focusMode ? 'h-full flex-1 overflow-hidden' : ''
        }`}
        style={{
          gridTemplateColumns: `${leftPanelCollapsed ? '0px' : '320px'} minmax(0, 1fr) ${
            rightPanelCollapsed ? '0px' : `${viewerSize.rightPanelWidth}px`
          }`,
        }}
      >
        <button
          type="button"
          onClick={toggleLeftPanel}
          className="absolute left-0 top-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={leftPanelCollapsed ? 'Expand Design Builder tools panel' : 'Collapse Design Builder tools panel'}
        >
          {leftPanelCollapsed ? '›' : '‹'}
        </button>

        <aside
          className={`space-y-4 overflow-hidden transition-opacity ${
            leftPanelCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
          } ${focusMode ? 'min-h-0 overflow-y-auto pr-1' : ''}`}
        >
          <Panel title="Object Tree">
            {OBJECT_TREE_GROUPS.map((group) => {
              const expanded = objectTreeExpanded[group.id as keyof ObjectTreeExpansionState] ?? false;
              return (
                <div key={group.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setObjectTreeExpanded((current) => ({
                        ...current,
                        [group.id]: !expanded,
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <span>{group.label}</span>
                    <span>{expanded ? '−' : '+'}</span>
                  </button>
                  {expanded ? (
                    <div className="mt-1 space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedObjectType(item.objectType);
                            setSelectedSegmentId(null);
                            setSelectedNodeId(null);
                            setPlacementPreview(null);
                            if (item.objectType !== 'door_opening' && item.objectType !== 'window_opening') {
                              setSelectedOpeningId(null);
                            }
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            selectedObjectType === item.objectType && !selectedOpeningId
                              ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          {item.description ? (
                            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {modelLoaded && wallLayout.segments.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Wall segments</div>
                {wallLayout.segments.map((segment, index) => (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => {
                      setSelectedSegmentId(segment.id);
                      setSelectedObjectType(null);
                      setSelectedOpeningId(null);
                      setSelectedNodeId(null);
                      setPlacementPreview(null);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedSegmentId === segment.id
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    Segment {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
            {modelLoaded && resolvedPreset.wall.openings.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Placed openings
                </div>
                {resolvedPreset.wall.openings.map((opening) => (
                  <button
                    key={opening.id}
                    type="button"
                    onClick={() => {
                      setSelectedOpeningId(opening.id);
                      setSelectedObjectType(opening.type === 'door' ? 'door_opening' : 'window_opening');
                      setSelectedSegmentId(null);
                      setSelectedNodeId(null);
                      setPlacementPreview(null);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedOpeningId === opening.id
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium capitalize">
                      {opening.type}
                      {opening.wallSegmentId ? ` · segment` : opening.wallFace ? ` · ${opening.wallFace}` : ''}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      Offset {(opening.positionAlongSegment ?? opening.offsetMeters ?? 0).toFixed(2)}m
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel title={selectedObjectType || selectedSegmentId ? `Edit ${selectedObjectLabel}` : selectedObjectLabel}>
            <EditableControls
              selectedObjectType={selectedObjectType}
              preset={resolvedPreset}
              designGeometryResult={designGeometryResult}
              unitSystem={unitSystem}
              onUnitSystemChange={setUnitSystem}
              onFootprintChange={updateFootprint}
              onWallChange={updateWallField}
              onShowIndividualBlocksChange={updateShowIndividualBlocks}
              onWallOptionChange={updateWallOption}
              onBlockModuleChange={updateBlockModuleField}
              cmuModule={cmuModule}
              wallModuleFits={wallModuleFits}
              moduleWarnings={moduleWarnings}
              cmuLayout={cmuLayout}
              selectedWallSegment={selectedWallSegment}
              onSlabChange={updateSlabField}
              onRoofChange={updateRoofField}
              onTrussSpacingChange={updateTrussSpacing}
              onStructureFieldChange={updateStructureField}
              onFoundationFieldChange={updateFoundationField}
              onGableFieldChange={updateGableField}
              onOpeningChange={updateSelectedOpening}
              selectedOpeningId={selectedOpeningId}
            />
          </Panel>

          <Panel title="Linked Quantities">
            {linkedPreviewLines.length > 0 ? (
              <div className="space-y-2">
                {linkedPreviewLines.map((line) => (
                  <div key={line.id} className="rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">
                    <div className="font-medium">{line.description}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {line.quantity} {line.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a quantity card or estimate line to see linked quantities for this object.
              </p>
            )}
          </Panel>
        </aside>

        <main className={`min-h-0 ${focusMode ? 'flex flex-col overflow-hidden' : 'space-y-4'}`}>
          <div
            role="toolbar"
            aria-label="Design Builder command bar"
            className="mb-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <DesignBuilderCommandMenu
                menuKind="tools"
                label={<>{activeToolLabel} <span aria-hidden>▾</span></>}
                isActive={toolMode === 'select'}
                summaryClassName={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
                  toolMode === 'select'
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {TOOL_MODE_OPTIONS.map((option) => (
                  <CommandMenuAction
                    key={option.mode}
                    aria-label={
                      option.mode === 'place_door' || option.mode === 'place_window'
                        ? 'Activate opening placement tool'
                        : undefined
                    }
                    onClick={() => activateToolMode(option.mode)}
                    disabled={!modelLoaded}
                    aria-pressed={toolMode === option.mode}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      toolMode === option.mode
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {option.label}
                  </CommandMenuAction>
                ))}
              </DesignBuilderCommandMenu>

              <div
                role="group"
                aria-label="Switch between 2D plan and 3D view"
                className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  aria-label="Switch to 2D plan view"
                  aria-pressed={builderViewMode === '2d'}
                  onClick={() => setBuilderViewMode('2d')}
                  className={`px-3 text-xs font-semibold transition ${
                    builderViewMode === '2d'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  2D
                </button>
                <button
                  type="button"
                  aria-label="Switch to 3D view"
                  aria-pressed={builderViewMode === '3d'}
                  onClick={() => setBuilderViewMode('3d')}
                  className={`border-l border-slate-200 px-3 text-xs font-semibold transition dark:border-slate-700 ${
                    builderViewMode === '3d'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  3D
                </button>
              </div>

              <DesignBuilderCommandMenu
                menuKind="openings"
                label={<>Openings <span aria-hidden>▾</span></>}
                isActive={toolMode === 'place_door' || toolMode === 'place_window' || toolMode === 'move_opening'}
                panelClassName="w-52"
                summaryClassName={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
                  toolMode === 'place_door' || toolMode === 'place_window' || toolMode === 'move_opening'
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {([
                  ['place_door', 'Door Opening'],
                  ['place_window', 'Window Opening'],
                  ['move_opening', 'Move Opening'],
                ] as Array<[DesignBuilderToolMode, string]>).map(([mode, label]) => (
                  <CommandMenuAction
                    key={mode}
                    onClick={() => activateToolMode(mode)}
                    disabled={!modelLoaded}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                      toolMode === mode
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </CommandMenuAction>
                ))}
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="structure"
                label={<>Structure: {activeStructureLabel} <span aria-hidden>▾</span></>}
                panelClassName="w-56"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-cyan-400 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100"
              >
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">System Mode</div>
                <CommandMenuAction
                  onClick={() => handleSetBuildingSystemMode('cmu_bearing_wall')}
                  aria-pressed={activeBuildingSystemMode === 'cmu_bearing_wall'}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                    activeBuildingSystemMode === 'cmu_bearing_wall'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  CMU Bearing Wall
                </CommandMenuAction>
                <CommandMenuAction
                  onClick={() => handleSetBuildingSystemMode('reinforced_concrete_frame_with_cmu_infill')}
                  aria-pressed={activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                    activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  RC Frame + CMU Infill
                </CommandMenuAction>
                <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                <CommandMenuAction
                  onClick={() => handleAddCornerColumns()}
                  disabled={!modelLoaded || !footprintClosed || !isFrameStructureMode}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add Corner Columns
                </CommandMenuAction>
                <CommandMenuAction
                  onClick={() => handleAutoFrameLayout()}
                  disabled={!modelLoaded || !footprintClosed || !isFrameStructureMode}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Auto Frame Layout
                </CommandMenuAction>
                <CommandMenuAction
                  onClick={() => handleAddPerimeterBeams()}
                  disabled={!modelLoaded || !footprintClosed || !isFrameStructureMode}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add Grade / Ring Beams
                </CommandMenuAction>
                <CommandMenuAction
                  onClick={() => handleAddGableEnd()}
                  disabled={!modelLoaded || !footprintClosed}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:opacity-50 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add / Edit Gable End
                </CommandMenuAction>
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="snap"
                label={<>Snap: {snapMode === 'cmu_module' ? 'CMU' : snapMode === 'grid' ? 'Grid' : 'Off'} <span aria-hidden>▾</span></>}
                closeOnSelect={false}
                panelClassName="w-64 p-2"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Snap mode</div>
                  {(['grid', 'cmu_module', 'off'] as DesignBuilderSnapMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSnapMode(mode)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                        snapMode === mode
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {mode === 'cmu_module' ? 'CMU' : mode === 'grid' ? 'Grid' : 'Off'}
                    </button>
                  ))}
                  <p className="px-3 py-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Grid snaps wall endpoints to selected grid spacing. CMU snaps to CMU module stations.
                  </p>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={toggleOrthogonalGuides}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="text-slate-700 dark:text-slate-200">Orthogonal guides</span>
                    <span className={wallLayout.orthogonalLock ? 'font-bold text-cyan-600 dark:text-cyan-300' : 'text-slate-400'}>
                      {wallLayout.orthogonalLock ? 'On' : 'Off'}
                    </span>
                  </button>
                  <div className={`${snapMode === 'grid' ? '' : 'opacity-50'}`}>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Snap spacing
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-1">
                    {PLAN_GRID_SCALE_PRESETS.map((preset) => (
                      <button
                        key={preset.spacingMeters}
                        type="button"
                        onClick={() => applyGridScalePreset(preset.spacingMeters)}
                        disabled={snapMode !== 'grid'}
                        className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold disabled:cursor-not-allowed ${
                          Math.abs(wallLayout.gridSpacingMeters - preset.spacingMeters) < 0.0001
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.spacingMeters < 1 ? preset.spacingMeters.toFixed(1) : preset.spacingMeters} m
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {snapMode === 'grid'
                      ? `Active grid spacing: ${wallLayout.gridSpacingMeters < 1 ? wallLayout.gridSpacingMeters.toFixed(1) : wallLayout.gridSpacingMeters} m`
                      : 'Snap spacing applies in Grid mode only.'}
                  </div>
                  </div>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Module Fit
                  </div>
                  {([
                    ['exact', 'Exact'],
                    ['snap_during_draw', 'Snap During Draw'],
                    ['resolve_after_draw', 'Resolve After Draw'],
                  ] as Array<[ModuleFitMode, string]>).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setModuleFitMode(mode)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                        moduleFitMode === mode
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <p className="px-3 py-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Exact preserves requested dimensions. Snap During Draw snaps endpoints to compatible CMU modules.
                    Resolve After Draw keeps requested dimensions until you apply a module-fit proposal.
                  </p>
                  <button
                    type="button"
                    onClick={() => resolveCurrentFootprintModuleFit(false)}
                    className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Preview Module Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveCurrentFootprintModuleFit(true)}
                    disabled={moduleFitMode === 'exact'}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Apply Module Fit
                  </button>
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="view"
                label={<>View <span aria-hidden>▾</span></>}
                panelClassName="w-56 p-2"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                  <CommandMenuAction onClick={() => setViewCommand({ id: Date.now(), action: 'fit' })} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">Fit</CommandMenuAction>
                  <CommandMenuAction onClick={() => setViewCommand({ id: Date.now(), action: 'reset' })} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">Reset view</CommandMenuAction>
                  {(['fit', '60', '80', 'full'] as ViewerHeightPreset[]).map((preset) => (
                    <CommandMenuAction
                      key={preset}
                      onClick={() => applyViewerHeightPreset(preset)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {preset === 'fit' ? 'Fit height' : preset === 'full' ? 'Full height' : `${preset}%`}
                    </CommandMenuAction>
                  ))}
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="display"
                label={<>Display <span aria-hidden>▾</span></>}
                closeOnSelect={false}
                panelClassName="w-64 space-y-2 p-3 text-xs"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                  <ToggleField label="Show opening layout" checked={showOpeningLayout} onChange={setShowOpeningLayout} />
                  <ToggleField
                    label="Show Grout / Reinforced Cells"
                    title="Shows only calculated CMU core fills, bond-beam cells, and valid closure voids. Does not represent the rough opening itself."
                    checked={showGroutCells}
                    onChange={setShowGroutCells}
                  />
                  <ToggleField label="Show Cut-Block Conditions" checked={showClosureWarnings} onChange={setShowClosureWarnings} />
                  {import.meta.env.DEV ? (
                    <ToggleField label="Show footprint setout" checked={showFootprintSetout} onChange={setShowFootprintSetout} />
                  ) : null}
                  {import.meta.env.DEV && resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
                    <ToggleField
                      label="Show Infill Panel Bounds"
                      checked={showInfillPanelBounds}
                      onChange={setShowInfillPanelBounds}
                    />
                  ) : null}
                  {resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
                    <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Foundation View
                      </div>
                      {(
                        [
                          ['full_model', 'Full Model'],
                          ['cutaway_below_grade', 'Cutaway / Below Grade'],
                          ['structural_frame_only', 'Structural Frame Only'],
                        ] as const
                      ).map(([mode, label]) => (
                        <label key={mode} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <input
                            type="radio"
                            name="foundation-view-mode"
                            checked={foundationViewMode === mode}
                            onChange={() => setFoundationViewMode(mode)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="actions"
                label={<>Actions <span aria-hidden>▾</span></>}
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                  <CommandMenuAction
                    onClick={() => void handleCloseFootprint()}
                    disabled={!closeFootprintEnabled}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Close Footprint
                  </CommandMenuAction>
                  <CommandMenuAction
                    onClick={() => setStatus({ tone: 'info', message: DESIGN_BUILDER_COPY.hints.help })}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Help
                  </CommandMenuAction>
              </DesignBuilderCommandMenu>

              <button
                type="button"
                onClick={handleUndoDesign}
                disabled={!canUndoDesignHistory(designHistory)}
                aria-label={nextUndoCommand ? `Undo ${nextUndoCommand.label}` : 'Undo'}
                title={nextUndoCommand ? `Undo ${nextUndoCommand.label}` : 'Undo'}
                className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleRedoDesign}
                disabled={!canRedoDesignHistory(designHistory)}
                aria-label={nextRedoCommand ? `Redo ${nextRedoCommand.label}` : 'Redo'}
                title={nextRedoCommand ? `Redo ${nextRedoCommand.label}` : 'Redo'}
                className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Redo
              </button>


              <button
                type="button"
                onClick={() => setViewCommand({ id: Date.now(), action: 'fit' })}
                className="ml-auto hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex lg:items-center"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDesign()}
                disabled={busy || !modelLoaded}
                className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                {DESIGN_BUILDER_COPY.actions.saveDesign}
              </button>

              <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Outside Face
                </span>
                {exteriorBounds ? (
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {exteriorBounds.exteriorLengthMeters.toFixed(2)} m × {exteriorBounds.exteriorWidthMeters.toFixed(2)} m
                  </span>
                ) : null}
                {modelLoaded && !footprintClosed ? (
                  <span
                    className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                    title={DESIGN_BUILDER_COPY.status.footprintOpen}
                  >
                    Footprint Open
                  </span>
                ) : null}
                {hasCutBlockWarnings ? (
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                      Cut-Block Condition
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-xl dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                      {cutBlockWarningText}
                    </div>
                  </details>
                ) : null}
                {livePlacementStatus && livePlacementStatus.kind !== 'cut_block' ? <PlacementStatusBadge status={livePlacementStatus} /> : null}
              </div>
            </div>
          </div>

          {(toolInstruction || toolMode === 'delete' || toolMode === 'draw_wall') ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
              {toolInstruction ? (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                  {toolInstruction}
                </span>
              ) : null}
              {toolMode === 'draw_wall' ? (
                <>
                  <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    Length
                    <input
                      value={segmentLengthInput}
                      onChange={(event) => setSegmentLengthInput(event.target.value)}
                      className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="m"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    Wall height
                    <input
                      type="text"
                      inputMode="decimal"
                      value={wallLayout.defaultWallHeightMeters}
                      onChange={(event) =>
                        mutateWallLayoutSilent({
                          ...wallLayout,
                          defaultWallHeightMeters: Math.max(0.5, Number(event.target.value) || wallLayout.defaultWallHeightMeters),
                        })
                      }
                      className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                    m
                  </label>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Unit: {unitSystem === 'metric' ? 'meters' : 'feet/inches'}
                  </span>
                  <button
                    type="button"
                    onClick={toggleOrthogonalGuides}
                    className="flex h-8 items-center gap-2 rounded-lg px-2.5 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="text-slate-600 dark:text-slate-300">Orthogonal guides</span>
                    <span className={wallLayout.orthogonalLock ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-400'}>
                      {wallLayout.orthogonalLock ? 'On' : 'Off'}
                    </span>
                  </button>
                </>
              ) : null}
              {activeOpeningTool && activeOpeningSettings ? (
                <>
                  <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    Width
                    <input
                      value={activeOpeningSettings.widthMeters}
                      onChange={(event) =>
                        setOpeningToolSettings((current) => ({
                          ...current,
                          [activeOpeningTool]: { ...current[activeOpeningTool], widthMeters: event.target.value },
                        }))
                      }
                      className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="m"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    Height
                    <input
                      value={activeOpeningSettings.heightMeters}
                      onChange={(event) =>
                        setOpeningToolSettings((current) => ({
                          ...current,
                          [activeOpeningTool]: { ...current[activeOpeningTool], heightMeters: event.target.value },
                        }))
                      }
                      className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="m"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                    Rough allowance
                    <input
                      value={activeOpeningSettings.roughOpeningAllowanceMeters}
                      onChange={(event) =>
                        setOpeningToolSettings((current) => ({
                          ...current,
                          [activeOpeningTool]: { ...current[activeOpeningTool], roughOpeningAllowanceMeters: event.target.value },
                        }))
                      }
                      className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="m"
                    />
                  </label>
                  {activeOpeningTool === 'door' ? (
                    <>
                      <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                        Swing
                        <select
                          value={activeOpeningSettings.swingType ?? 'inswing'}
                          onChange={(event) =>
                            setOpeningToolSettings((current) => ({
                              ...current,
                              door: {
                                ...current.door,
                                swingType: event.target.value as 'inswing' | 'outswing',
                              },
                            }))
                          }
                          className="h-8 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="inswing">Inswing</option>
                          <option value="outswing">Outswing</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                        Handing
                        <select
                          value={activeOpeningSettings.swingDirection ?? 'left'}
                          onChange={(event) =>
                            setOpeningToolSettings((current) => ({
                              ...current,
                              door: {
                                ...current.door,
                                swingDirection: event.target.value as 'left' | 'right',
                              },
                            }))
                          }
                          className="h-8 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Snap to CMU: {snapMode === 'cmu_module' ? 'On' : 'Available'}
                  </span>
                </>
              ) : null}
              {toolMode === 'delete' ? (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedOpening}
                    disabled={!selectedOpeningId}
                    className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete selected opening
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedSegment}
                    disabled={activeSelection.kind !== 'wall_segment'}
                    title={activeSelection.kind !== 'wall_segment' ? 'Select a wall segment to delete.' : 'Delete selected wall'}
                    className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete selected wall
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          <div
            className={focusMode ? 'relative min-h-0 flex-1 overflow-hidden' : 'relative overflow-hidden'}
            style={focusMode ? undefined : { height: viewerSize.height }}
          >
            {viewMode === 'plan' ? (
              <DesignBuilderPlanCanvas
                layout={wallLayout}
                toolMode={toolMode}
                snapSpacingMeters={planSnapSpacingMeters}
                snapMode={snapMode}
                viewport={planViewport}
                layoutBounds={designLayoutBounds}
                viewCommand={viewCommand}
                onViewportChange={setPlanViewport}
                onUserViewportChange={() => {
                  hasUserAdjustedPlanViewRef.current = true;
                  saveDesignBuilderSession(sessionKey, { hasUserAdjustedPlanView: true });
                }}
                draftEnd={draftPlanEnd}
                activeNodeId={activeDrawNodeId}
                drawStartNodeId={drawStartNodeId}
                selectedSegmentId={selectedSegmentId}
                selectedNodeId={selectedNodeId}
                selectedOpeningId={selectedOpeningId}
                snapTarget={draftSnapTarget}
                shiftConstraintLabel={drawWallConstraintLabel}
                previewMetrics={drawWallPreviewMetrics}
                orthogonalClosureAssist={orthogonalClosureAssist}
                closureCornerSnap={closureCornerSnap}
                segmentFrames={planSegmentFrames}
                openingItems={planOpeningItems}
                openingPreview={planOpeningPreview}
                frameSystem={designGeometryResult.frameSystem}
                isolatedFootings={designGeometryResult.isolatedFootings}
                onInteraction={handlePlanInteraction}
              />
            ) : (
              <DesignBuilderViewer
                modelLoaded={modelLoaded}
                slab={footprintClosed ? resolvedPreset.slab : { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 }}
                wall={effectiveWall}
                roof={footprintClosed ? resolvedPreset.roof : { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 }}
                truss={footprintClosed ? resolvedPreset.truss : { ...resolvedPreset.truss, buildingLengthMeters: 0 }}
                geometryResult={designGeometryResult}
                layoutBounds={designLayoutBounds}
                selectedObjectType={selectedObjectType}
                selectedOpeningId={selectedOpeningId}
                toolMode={toolMode}
                placementPreview={placementPreview}
                onInteraction={handleViewerInteraction}
                onSelectObjectType={setSelectedObjectType}
                fitContainer={focusMode}
                viewCommand={viewCommand}
                initialCameraSnapshot={cameraSnapshot}
                onCameraSnapshotChange={setCameraSnapshot}
                onUserCameraChange={() => {
                  hasUserAdjusted3dViewRef.current = true;
                  saveDesignBuilderSession(sessionKey, { hasUserAdjusted3dView: true });
                }}
                showOpeningLayout={showOpeningLayout}
                showGroutCells={showGroutCells}
                showClosureWarnings={showClosureWarnings}
                showFootprintSetout={showFootprintSetout}
                showInfillPanelBounds={showInfillPanelBounds}
                foundationViewMode={foundationViewMode}
              />
            )}
            {viewMode === 'plan' && toolMode === 'draw_wall' ? (
              <div className="pointer-events-none absolute left-3 top-12 z-10 space-y-1 rounded-xl border border-amber-400/60 bg-slate-900/95 px-3 py-2 text-xs font-medium text-amber-100 shadow-lg">
                <div>{drawWallInstruction}</div>
                {drawWallSnapFeedback ? <div className="font-semibold text-cyan-200">{drawWallSnapFeedback}</div> : null}
              </div>
            ) : null}
          </div>
          {!focusMode ? (
            <div
              role="separator"
              aria-label="Resize Design Builder viewer height"
              className="group -mt-2 flex h-5 cursor-row-resize items-center justify-center rounded-b-2xl"
              onPointerDown={beginHeightResize}
            >
              <span className="h-1 w-20 rounded-full bg-slate-300 transition group-hover:bg-cyan-500 dark:bg-slate-700" />
            </div>
          ) : null}
          {changedAfterCommit ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
              {DESIGN_BUILDER_COPY.status.estimateRequiresUpdate}
            </div>
          ) : null}
          <div className={`${statusClassName(status.tone)} ${focusMode ? 'mt-3 shrink-0' : ''}`} role="status">
            {status.message}
          </div>
          {!focusMode ? (
            <Panel title="Source of Truth">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The saved model stores parametric source objects only. Individual CMU blocks are generated with THREE.InstancedMesh and are not database rows.
              </p>
            </Panel>
          ) : null}
        </main>

        <button
          type="button"
          onClick={toggleRightPanel}
          className="absolute right-0 top-1/2 z-20 translate-x-1/2 rounded-full border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-700 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={rightPanelCollapsed ? 'Expand Design Builder estimate panel' : 'Collapse Design Builder estimate panel'}
        >
          {rightPanelCollapsed ? '‹' : '›'}
        </button>

        <aside
          className={`relative space-y-4 overflow-hidden transition-opacity ${
            rightPanelCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
          } ${focusMode ? 'min-h-0 overflow-y-auto pr-1' : ''}`}
        >
          {!rightPanelCollapsed ? (
            <div
              role="separator"
              aria-label="Resize Design Builder estimate panel"
              className="absolute -left-2 top-0 hidden h-full w-3 cursor-col-resize xl:block"
              onPointerDown={beginRightPanelResize}
            />
          ) : null}
          <Panel title="Quantity Summary">
            <div className="grid grid-cols-2 gap-2">
              {quantityCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => {
                    setSelectedObjectType(card.objectType);
                    setSelectedOpeningId(null);
                    setSelectedSegmentId(null);
                    setSelectedNodeId(null);
                    setPlacementPreview(null);
                  }}
                  className={`rounded-xl p-3 text-left transition ${
                    selectedObjectType === card.objectType
                      ? 'bg-cyan-100 ring-2 ring-cyan-400 dark:bg-cyan-950/60'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400">{card.label}</div>
                  <div className="mt-1 font-semibold">
                    {card.value} {card.unit}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Estimate Preview — not committed yet">
            <div className="space-y-2">
              {visiblePreviewLines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Load the example to generate estimate-ready quantities.
                </div>
              ) : null}
              {visiblePreviewLines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => {
                    setSelectedObjectType(objectTypeForPreviewLine(line));
                    setSelectedOpeningId(null);
                    setSelectedSegmentId(null);
                    setSelectedNodeId(null);
                    setPlacementPreview(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{line.description}</div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Calculated from parameters
                    </span>
                  </div>
                  <div className="mt-1 text-slate-600 dark:text-slate-300">
                    {line.quantity} {line.unit} · Division {line.divisionCode} {line.divisionName}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Source object: {OBJECT_TREE_ITEMS.find((item) => item.objectType === objectTypeForPreviewLine(line))?.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{line.formula}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => void handleGeneratePreview()}
                disabled={busy}
                className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/60"
              >
                {DESIGN_BUILDER_COPY.actions.generatePreview}
              </button>
              <button
                type="button"
                onClick={() => void handleCommitPreview()}
                disabled={busy || previewLines.length === 0 || generatedPreview.length === 0}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                Commit to Estimate
              </button>
            </div>
          </Panel>

          <Panel title="Warnings">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                CMU layout is conceptual for estimating. Verify block layout, lintels, reinforcement, bond beams, and structural requirements before pricing.
              </p>
              <p>This tool does not provide structural engineering or code compliance.</p>
              {moduleWarnings.map((warning) => (
                <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {warning}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
    </DesignBuilderCommandMenuProvider>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function statusClassName(tone: StatusTone): string {
  const base = 'rounded-xl border px-4 py-3 text-sm';
  if (tone === 'success') {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200`;
  }
  if (tone === 'error') {
    return `${base} border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200`;
  }
  return `${base} border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200`;
}

const TOOL_MODE_OPTIONS: Array<{ mode: DesignBuilderToolMode; label: string }> = [
  { mode: 'select', label: 'Select' },
  { mode: 'draw_wall', label: 'Draw Wall' },
  { mode: 'move_wall_node', label: 'Move Node' },
  { mode: 'place_door', label: 'Place Door' },
  { mode: 'place_window', label: 'Place Window' },
  { mode: 'move_opening', label: 'Move Opening' },
  { mode: 'delete', label: 'Delete' },
];

function PlacementStatusBadge({ status }: { status: OpeningPlacementStatus }) {
  const toneClass =
    status.kind === 'invalid'
      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
      : status.kind === 'cut_block'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
        : status.kind === 'half_block'
          ? 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`} title={status.warnings.join(' ')}>
      {status.label}
    </span>
  );
}

const OBJECT_TREE_ITEMS: Array<{ id: string; objectType: DesignObjectType; label: string; description: string }> = [
  { id: 'footprint', objectType: 'building_footprint', label: 'Nodes', description: '' },
  { id: 'segments', objectType: 'cmu_wall_system', label: 'Wall Segments', description: '' },
  { id: 'corners', objectType: 'cmu_wall_system', label: 'Corners', description: '' },
  { id: 'cmu', objectType: 'cmu_wall_system', label: 'CMU Walls', description: '' },
  { id: 'openings', objectType: 'door_opening', label: 'Openings', description: '' },
  { id: 'lintels', objectType: 'cmu_wall_system', label: 'Lintels', description: '' },
  { id: 'bond-beams', objectType: 'cmu_wall_system', label: 'Bond Beams', description: '' },
  { id: 'grout-rebar', objectType: 'cmu_wall_system', label: 'Grout/Rebar Cells', description: '' },
  { id: 'manual-runs', objectType: 'cmu_wall_system', label: 'Manual Runs', description: '' },
  { id: 'slab', objectType: 'thickened_edge_slab', label: 'Slab', description: '' },
  { id: 'grade-beams', objectType: 'structural_frame_system', label: 'Grade Beams', description: '' },
  { id: 'isolated-footings', objectType: 'structural_frame_system', label: 'Isolated Footings', description: '' },
  { id: 'columns', objectType: 'structural_frame_system', label: 'RC Columns', description: '' },
  { id: 'beams', objectType: 'structural_frame_system', label: 'RC Beams', description: '' },
  { id: 'infill-panels', objectType: 'cmu_infill_system', label: 'CMU Infill Panels', description: '' },
  { id: 'roof', objectType: 'gable_roof_system', label: 'Roof', description: '' },
  { id: 'gable-ends', objectType: 'gable_end_system', label: 'Gable Ends', description: '' },
  { id: 'trusses', objectType: 'steel_truss_system', label: 'Trusses', description: '' },
  { id: 'quantity-summary', objectType: 'cmu_wall_system', label: 'Quantity Summary', description: '' },
  { id: 'estimate-preview', objectType: 'cmu_wall_system', label: 'Estimate Preview', description: '' },
  { id: 'warnings', objectType: 'cmu_wall_system', label: 'Warnings', description: '' },
];

const OBJECT_TREE_GROUPS: Array<{
  id: string;
  label: string;
  items: Array<{ id: string; objectType: DesignObjectType; label: string; description: string }>;
}> = [
  {
    id: 'layout',
    label: 'Layout',
    items: OBJECT_TREE_ITEMS.filter((item) => ['footprint', 'segments', 'corners'].includes(item.id)),
  },
  {
    id: 'masonry',
    label: 'Masonry',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['cmu', 'infill-panels', 'lintels', 'bond-beams', 'grout-rebar', 'manual-runs'].includes(item.id),
    ),
  },
  {
    id: 'foundation',
    label: 'Foundation',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['grade-beams', 'isolated-footings', 'columns'].includes(item.id),
    ),
  },
  {
    id: 'structure',
    label: 'Structure',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['beams', 'slab'].includes(item.id),
    ),
  },
  {
    id: 'openings',
    label: 'Openings',
    items: OBJECT_TREE_ITEMS.filter((item) => ['openings'].includes(item.id)),
  },
  {
    id: 'roofGable',
    label: 'Roof / Gable',
    items: OBJECT_TREE_ITEMS.filter((item) => ['roof', 'gable-ends', 'trusses'].includes(item.id)),
  },
  {
    id: 'estimate',
    label: 'Estimate',
    items: OBJECT_TREE_ITEMS.filter((item) => ['quantity-summary', 'estimate-preview', 'warnings'].includes(item.id)),
  },
];

function EditableControls({
  selectedObjectType,
  preset,
  designGeometryResult,
  unitSystem,
  onUnitSystemChange,
  onFootprintChange,
  onWallChange,
  onShowIndividualBlocksChange,
  onWallOptionChange,
  onBlockModuleChange,
  cmuModule,
  wallModuleFits,
  moduleWarnings,
  cmuLayout,
  selectedWallSegment,
  onSlabChange,
  onRoofChange,
  onTrussSpacingChange,
  onStructureFieldChange,
  onFoundationFieldChange,
  onGableFieldChange,
  onOpeningChange,
  selectedOpeningId,
}: {
  selectedObjectType: DesignObjectType | null;
  preset: CmuBuildingPreset;
  designGeometryResult: ReturnType<typeof generateDesignGeometry>;
  unitSystem: DesignUnitSystem;
  onUnitSystemChange: (unitSystem: DesignUnitSystem) => void;
  onFootprintChange: (field: 'lengthMeters' | 'widthMeters', value: number) => void;
  onWallChange: (
    field: 'heightMeters' | 'wallThicknessMeters' | 'blockLengthMeters' | 'blockHeightMeters' | 'blockDepthMeters' | 'wasteFactor',
    value: number,
  ) => void;
  onShowIndividualBlocksChange: (showIndividualBlocks: boolean) => void;
  onWallOptionChange: (patch: Partial<CmuBuildingPreset['wall']>) => void;
  onBlockModuleChange: (field: keyof NonNullable<CmuBuildingPreset['wall']['blockModule']>, value: number | string) => void;
  cmuModule: ReturnType<typeof resolveCmuModuleConfig>;
  wallModuleFits: ReturnType<typeof summarizeWallModuleFits>;
  moduleWarnings: string[];
  cmuLayout: ReturnType<typeof generateCmuLayout>;
  selectedWallSegment: DesignWallSegment | null;
  onSlabChange: (field: 'slabThicknessMeters' | 'edgeWidthMeters' | 'edgeDepthMeters', value: number) => void;
  onRoofChange: (field: 'pitchRisePerRun' | 'overhangMeters', value: number) => void;
  onTrussSpacingChange: (value: number) => void;
  onStructureFieldChange: (
    patch: Partial<import('../types').StructuralFrameSystemParameters> & {
      buildingSystemMode?: import('../types').BuildingSystemMode;
    },
  ) => void;
  onFoundationFieldChange: (
    patch: Partial<import('../types').GradeBeamSettings> | Partial<import('../types').IsolatedFootingSettings>,
    section: 'gradeBeam' | 'isolatedFootings',
  ) => void;
  onGableFieldChange: (gableId: string, patch: Partial<import('../types').GableEndSettings>) => void;
  onOpeningChange: (openingId: string, patch: Partial<WallOpeningParameters>) => void;
  selectedOpeningId: string | null;
}) {
  if (selectedObjectType === 'building_footprint') {
    return (
      <div className="space-y-3">
        <SelectField
          label="Unit system"
          value={unitSystem}
          onChange={(value) => onUnitSystemChange(value as DesignUnitSystem)}
          options={[
            { value: 'metric', label: 'Metric display' },
            { value: 'imperial', label: 'Imperial display' },
          ]}
        />
        <NumberField label="Length" value={preset.footprint.lengthMeters} suffix="m" onChange={(value) => onFootprintChange('lengthMeters', value)} />
        <NumberField label="Width" value={preset.footprint.widthMeters} suffix="m" onChange={(value) => onFootprintChange('widthMeters', value)} />
      </div>
    );
  }

  if (selectedObjectType == null || selectedObjectType === 'cmu_wall_system') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/40">
          <div className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">CMU Module Rules</div>
          <div className="mt-3 space-y-3">
            <TextField
              label="Block family"
              value={cmuModule.familyName}
              onChange={(value) => onBlockModuleChange('familyName', value)}
            />
            <NumberField label="Module length" value={cmuModule.moduleLengthMeters} suffix="m" min={0.05} max={2} step={0.01} onChange={(value) => onBlockModuleChange('moduleLengthMeters', value)} />
            <NumberField label="Module height" value={cmuModule.moduleHeightMeters} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('moduleHeightMeters', value)} />
            <NumberField label="Nominal depth" value={cmuModule.nominalDepthMeters} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('nominalDepthMeters', value)} />
            <NumberField label="Actual block length" value={cmuModule.actualLengthMeters ?? 0} suffix="m" min={0.05} max={2} step={0.01} onChange={(value) => onBlockModuleChange('actualLengthMeters', value)} />
            <NumberField label="Actual block height" value={cmuModule.actualHeightMeters ?? 0} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('actualHeightMeters', value)} />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nominal module = actual block + mortar joint ({cmuModule.moduleLengthMeters.toFixed(2)} m × {cmuModule.moduleHeightMeters.toFixed(2)} m).
            </p>
            <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">
              <span>Snap building dimensions to CMU module</span>
              <input
                type="checkbox"
                checked={preset.wall.snapToModule ?? false}
                onChange={(event) => onWallOptionChange({ snapToModule: event.currentTarget.checked })}
                className="h-4 w-4"
              />
            </label>
            <NumberField label="Mortar joint" value={cmuModule.mortarJointMeters} suffix="m" min={0} max={0.05} step={0.001} onChange={(value) => onBlockModuleChange('mortarJointMeters', value)} />
            <ModuleFitReportPanel report={cmuLayout.moduleFitReport} />
            {moduleWarnings.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {moduleWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <NumberField label="Wall height" value={selectedWallSegment?.wallHeightMeters ?? preset.wall.heightMeters} suffix="m" min={0.1} max={20} onChange={(value) => onWallChange('heightMeters', value)} />
        <NumberField label="Wall thickness" value={selectedWallSegment?.wallThicknessMeters ?? preset.wall.wallThicknessMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('wallThicknessMeters', value)} />
        <NumberField label="Block length" value={preset.wall.blockLengthMeters} suffix="m" min={0.05} max={2} onChange={(value) => onWallChange('blockLengthMeters', value)} />
        <NumberField label="Block height" value={preset.wall.blockHeightMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('blockHeightMeters', value)} />
        <NumberField label="Block depth" value={preset.wall.blockDepthMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('blockDepthMeters', value)} />
        <div>
          <NumberField label="Waste" value={preset.wall.wasteFactor * 100} suffix="%" min={0} max={100} onChange={(value) => onWallChange('wasteFactor', value / 100)} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estimate allowance — does not change model geometry.
          </p>
        </div>
        <SelectField
          label="Bond pattern"
          value={preset.wall.bondPattern ?? 'running_bond'}
          onChange={(value) => onWallOptionChange({ bondPattern: value as CmuBuildingPreset['wall']['bondPattern'] })}
          options={[
            { value: 'running_bond', label: 'Running bond' },
            { value: 'stack_bond', label: 'Stack bond' },
          ]}
        />
        <SelectField
          label="Lintel type"
          value={preset.wall.lintelType ?? 'bond_beam'}
          onChange={(value) => onWallOptionChange({ lintelType: value as CmuBuildingPreset['wall']['lintelType'] })}
          options={[
            { value: 'bond_beam', label: 'Bond beam lintel' },
            { value: 'precast_concrete', label: 'Precast concrete' },
            { value: 'none', label: 'None' },
          ]}
        />
        {preset.wall.openings.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Applies when door or window openings are added.
          </p>
        ) : null}
        <NumberField label="Lintel bearing" value={preset.wall.lintelBearingMeters ?? 0.2} suffix="m" min={0} max={2} onChange={(value) => onWallOptionChange({ lintelBearingMeters: Math.max(0, value) })} />
        <NumberField label="Lintel courses" value={preset.wall.lintelCourseCount ?? 1} suffix="courses" step={1} onChange={(value) => onWallOptionChange({ lintelCourseCount: Math.max(1, Math.round(value)) })} />
        <NumberField label="Core fill factor" value={preset.wall.coreFillFactor ?? 0.5} suffix="x" step={0.05} onChange={(value) => onWallOptionChange({ coreFillFactor: Math.max(0, Math.min(1, value)) })} />
        <NumberField label="Grout waste" value={(preset.wall.groutWastePercent ?? 0.1) * 100} suffix="%" step={1} onChange={(value) => onWallOptionChange({ groutWastePercent: Math.max(0, value / 100) })} />
        <NumberField label="Default jamb cells each side" value={preset.wall.jambCellsEachSide ?? 1} suffix="cells" step={1} onChange={(value) => onWallOptionChange({ jambCellsEachSide: Math.max(0, Math.round(value)) })} />
        <NumberField label="Grouted cell spacing" value={preset.wall.groutedCellSpacingMeters ?? 1.2} suffix="m" onChange={(value) => onWallOptionChange({ groutedCellSpacingMeters: positiveOrFallback(value, 1.2) })} />
        <NumberField label="Vertical reinforcement spacing" value={preset.wall.verticalReinforcementSpacingMeters ?? 1.2} suffix="m" onChange={(value) => onWallOptionChange({ verticalReinforcementSpacingMeters: positiveOrFallback(value, 1.2) })} />
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Lintel bond beam enabled</span>
          <input
            type="checkbox"
            checked={preset.wall.lintelBondBeamEnabled ?? true}
            onChange={(event) => onWallOptionChange({ lintelBondBeamEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Top course bond beam</span>
          <input
            type="checkbox"
            checked={preset.wall.bondBeamEnabled ?? true}
            onChange={(event) => onWallOptionChange({ bondBeamEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Conceptual columns/pilasters</span>
          <input
            type="checkbox"
            checked={preset.wall.pilasterEnabled ?? true}
            onChange={(event) => onWallOptionChange({ pilasterEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Show individual CMU blocks</span>
          <input
            type="checkbox"
            checked={preset.wall.showIndividualBlocks}
            onChange={(event) => onShowIndividualBlocksChange(event.currentTarget.checked)}
            className="h-4 w-4"
          />
        </label>
      </div>
    );
  }

  if (selectedObjectType === 'thickened_edge_slab') {
    return (
      <div className="space-y-3">
        <NumberField label="Slab thickness" value={preset.slab.slabThicknessMeters} suffix="m" onChange={(value) => onSlabChange('slabThicknessMeters', value)} />
        <NumberField label="Edge width" value={preset.slab.edgeWidthMeters} suffix="m" onChange={(value) => onSlabChange('edgeWidthMeters', value)} />
        <NumberField label="Edge depth" value={preset.slab.edgeDepthMeters} suffix="m" onChange={(value) => onSlabChange('edgeDepthMeters', value)} />
      </div>
    );
  }

  if (selectedObjectType === 'gable_roof_system') {
    return (
      <div className="space-y-3">
        <NumberField label="Pitch rise/run" value={preset.roof.pitchRisePerRun} suffix=":1" step={0.05} onChange={(value) => onRoofChange('pitchRisePerRun', value)} />
        <NumberField label="Overhang" value={preset.roof.overhangMeters} suffix="m" onChange={(value) => onRoofChange('overhangMeters', value)} />
        <SelectField label="Ridge direction" value={preset.roof.ridgeDirection} onChange={() => undefined} options={[{ value: 'length', label: 'Along building length' }]} />
      </div>
    );
  }

  if (selectedObjectType === 'structural_frame_system') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Conceptual structural frame for estimating only — not structural engineering or code compliance.
        </p>
        <SelectField
          label="Building system mode"
          value={preset.buildingSystemMode}
          onChange={(value) => onStructureFieldChange({ buildingSystemMode: value as import('../types').BuildingSystemMode })}
          options={[
            { value: 'cmu_bearing_wall', label: 'CMU Bearing Wall' },
            { value: 'reinforced_concrete_frame_with_cmu_infill', label: 'RC Frame + CMU Infill' },
          ]}
        />
        <NumberField
          label="Default column width"
          value={preset.frameSystem.defaultColumnWidthMeters}
          suffix="m"
          onChange={(value) => onStructureFieldChange({ defaultColumnWidthMeters: positiveOrFallback(value, 0.35) })}
        />
        <NumberField
          label="Default column depth"
          value={preset.frameSystem.defaultColumnDepthMeters}
          suffix="m"
          onChange={(value) => onStructureFieldChange({ defaultColumnDepthMeters: positiveOrFallback(value, 0.35) })}
        />
        {preset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Foundation (Y=0 at grade beam top)</div>
            <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              <span>Grade beam enabled</span>
              <input
                type="checkbox"
                checked={preset.foundationSettings.gradeBeam.enabled}
                onChange={(event) => onFoundationFieldChange({ enabled: event.currentTarget.checked }, 'gradeBeam')}
                className="h-4 w-4"
              />
            </label>
            <NumberField
              label="Grade Beam Width"
              value={preset.foundationSettings.gradeBeam.widthMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ widthMeters: positiveOrFallback(value, 0.3) }, 'gradeBeam')}
            />
            <NumberField
              label="Grade Beam Depth"
              value={preset.foundationSettings.gradeBeam.depthMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ depthMeters: positiveOrFallback(value, 0.45) }, 'gradeBeam')}
            />
            <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              <span>Isolated footings enabled</span>
              <input
                type="checkbox"
                checked={preset.foundationSettings.isolatedFootings.enabled}
                onChange={(event) => onFoundationFieldChange({ enabled: event.currentTarget.checked }, 'isolatedFootings')}
                className="h-4 w-4"
              />
            </label>
            <NumberField
              label="Footing Width"
              value={preset.foundationSettings.isolatedFootings.footingWidthMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ footingWidthMeters: positiveOrFallback(value, 1.2) }, 'isolatedFootings')}
            />
            <NumberField
              label="Footing Length"
              value={preset.foundationSettings.isolatedFootings.footingLengthMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ footingLengthMeters: positiveOrFallback(value, 1.2) }, 'isolatedFootings')}
            />
            <NumberField
              label="Footing Thickness"
              value={preset.foundationSettings.isolatedFootings.footingThicknessMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ footingThicknessMeters: positiveOrFallback(value, 0.45) }, 'isolatedFootings')}
            />
            <NumberField
              label="Footing Drop Below Grade Beam"
              value={preset.foundationSettings.isolatedFootings.dropBelowGradeBeamMeters}
              suffix="m"
              onChange={(value) => onFoundationFieldChange({ dropBelowGradeBeamMeters: positiveOrFallback(value, 0.6) }, 'isolatedFootings')}
            />
          </div>
        ) : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Columns: {preset.frameSystem.columns.length} · Beams: {preset.frameSystem.beams.length}
        </p>
      </div>
    );
  }

  if (selectedObjectType === 'cmu_infill_system') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Infill panels: {preset.infillSystem.panels.length}
        </p>
        {designGeometryResult.wallCmuLayout.counts ? (
          <p className="text-xs text-slate-500">
            Full {designGeometryResult.wallCmuLayout.counts.full} · Half {designGeometryResult.wallCmuLayout.counts.half} · Cut{' '}
            {designGeometryResult.wallCmuLayout.counts.cut}
          </p>
        ) : null}
      </div>
    );
  }

  if (selectedObjectType === 'gable_end_system') {
    const gable = preset.gableEndSystem.gableEnds[0];
    return (
      <div className="space-y-3">
        {gable ? (
          <>
            <NumberField label="Eave elevation" value={gable.eaveElevationMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { eaveElevationMeters: value })} />
            <NumberField label="Peak rise above eave" value={gable.peakRiseMeters ?? 0} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { peakRiseMeters: value, peakMode: 'rise_above_eave' })} />
            <NumberField label="Roof-to-masonry clearance" value={gable.roofToMasonryClearanceMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { roofToMasonryClearanceMeters: positiveOrFallback(value, 0.1016) })} />
          </>
        ) : (
          <p className="text-sm text-slate-500">No gable end configured. Use Structure → Add / Edit Gable End.</p>
        )}
      </div>
    );
  }

  if (selectedObjectType === 'steel_truss_system') {
    return (
      <div className="space-y-3">
        <NumberField label="Spacing" value={preset.truss.spacingMeters} suffix="m" onChange={onTrussSpacingChange} />
        <SelectField label="Type" value="steel_preview" onChange={() => undefined} options={[{ value: 'steel_preview', label: 'Steel truss preview' }]} />
      </div>
    );
  }

  const opening =
    (selectedOpeningId ? preset.wall.openings.find((item) => item.id === selectedOpeningId) : null) ??
    preset.wall.openings.find((item) =>
      selectedObjectType === 'door_opening' ? item.type === 'door' : item.type === 'window',
    );
  if (!opening) return <p className="text-sm text-slate-500 dark:text-slate-400">No opening selected.</p>;
  const resolvedOpening = resolveCmuOpening(preset.wall, opening);
  const openingClosures = cmuLayout.openingCourseClosures.filter((closure) => closure.openingId === opening.id);
  const leftClosures = openingClosures.filter((closure) => closure.side === 'left');
  const rightClosures = openingClosures.filter((closure) => closure.side === 'right');
  const lintelCourseAssembly =
    cmuLayout.lintelCourseAssemblies.find((assembly) => assembly.openingId === opening.id) ?? null;
  const cutWarnings = openingClosures.filter((closure) => closure.closureType === 'cut_block').length;
  const lintelCourseCutRequired = lintelCourseAssembly
    ? lintelCourseAssemblyRequiresCutWarning(lintelCourseAssembly)
    : false;
  const closureGroutVolume = openingClosures.reduce(
    (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div className="font-semibold text-slate-800 dark:text-slate-100">
          {opening.type === 'door' ? 'Door' : 'Window'} opening sizing
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div>
            Actual: {resolvedOpening.actualWidthMeters.toFixed(2)}m x {resolvedOpening.actualHeightMeters.toFixed(2)}m
          </div>
          <div>
            Rough: {resolvedOpening.roughOpeningWidthMeters.toFixed(2)}m x {resolvedOpening.roughOpeningHeightMeters.toFixed(2)}m
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <div className="font-semibold text-amber-900 dark:text-amber-100">Opening Course Layout</div>
        <div className="mt-2 grid gap-1 text-xs text-amber-800 dark:text-amber-200">
          <div>Left jamb closures: {summarizeClosures(leftClosures)}</div>
          <div>Right jamb closures: {summarizeClosures(rightClosures)}</div>
          <div>Cut block warnings: {cutWarnings}</div>
          <div>Jamb grout cells: {cmuLayout.jambGroutCells.filter((cell) => cell.openingId === opening.id).length}</div>
          <div>Lintel length: {resolvedOpening.lintelLengthMeters.toFixed(2)}m</div>
          <div>Estimated closure grout: {closureGroutVolume.toFixed(4)} m3</div>
          <div>Jamb grout volume is based on selected grouted cells and course closure conditions, not the full rough opening area.</div>
        </div>
      </div>
      {lintelCourseAssembly && resolvedOpening.lintelType !== 'none' ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-800 dark:text-slate-100">Lintel course closure</div>
          <div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <div>Left: {summarizeLintelCourseClosureSide(lintelCourseAssembly.leftPlacements)}</div>
            <div>Right: {summarizeLintelCourseClosureSide(lintelCourseAssembly.rightPlacements)}</div>
            {lintelCourseCutRequired ? (
              <div className="text-amber-700 dark:text-amber-300">Custom CMU cut required beside lintel.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      <SelectField
        label="Wall face"
        value={opening.wallFace}
        onChange={(value) => onOpeningChange(opening.id, { wallFace: value as WallOpeningParameters['wallFace'] })}
        options={[
          { value: 'north', label: 'North' },
          { value: 'east', label: 'East' },
          { value: 'south', label: 'South' },
          { value: 'west', label: 'West' },
        ]}
      />
      <NumberField label="Position along wall" value={opening.offsetMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { offsetMeters: Math.max(0, value) })} />
      <NumberField label="Actual width" value={opening.widthMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { widthMeters: positiveOrFallback(value, opening.widthMeters) })} />
      <NumberField label="Actual height" value={opening.heightMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { heightMeters: positiveOrFallback(value, opening.heightMeters) })} />
      <NumberField label="Rough opening allowance" value={opening.roughOpeningAllowanceMeters ?? 0.05} suffix="m" step={0.005} onChange={(value) => onOpeningChange(opening.id, { roughOpeningAllowanceMeters: Math.max(0, value), roughOpeningWidthMeters: undefined, roughOpeningHeightMeters: undefined })} />
      <NumberField label="Rough opening width override" value={opening.roughOpeningWidthMeters ?? resolvedOpening.roughOpeningWidthMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { roughOpeningWidthMeters: positiveOrFallback(value, resolvedOpening.roughOpeningWidthMeters) })} />
      <NumberField label="Rough opening height override" value={opening.roughOpeningHeightMeters ?? resolvedOpening.roughOpeningHeightMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { roughOpeningHeightMeters: positiveOrFallback(value, resolvedOpening.roughOpeningHeightMeters) })} />
      {opening.type === 'window' ? (
        <>
          <NumberField label="Sill height" value={opening.sillHeightMeters ?? 0} suffix="m" onChange={(value) => onOpeningChange(opening.id, { sillHeightMeters: Math.max(0, value) })} />
          <SelectField
            label="Sill condition"
            value={opening.sillCondition ?? 'none'}
            onChange={(value) => onOpeningChange(opening.id, { sillCondition: value as WallOpeningParameters['sillCondition'] })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'reinforced_sill', label: 'Reinforced sill' },
              { value: 'grouted_sill_course', label: 'Grouted sill course' },
            ]}
          />
        </>
      ) : (
        <>
          <SelectField
            label="Swing"
            value={opening.swingType ?? 'inswing'}
            onChange={(value) => onOpeningChange(opening.id, { swingType: value as WallOpeningParameters['swingType'] })}
            options={[
              { value: 'inswing', label: 'Inswing' },
              { value: 'outswing', label: 'Outswing' },
            ]}
          />
          <SelectField
            label="Handing"
            value={opening.swingDirection ?? 'left'}
            onChange={(value) => onOpeningChange(opening.id, { swingDirection: value as WallOpeningParameters['swingDirection'] })}
            options={[
              { value: 'left', label: 'Left-hand' },
              { value: 'right', label: 'Right-hand' },
            ]}
          />
        </>
      )}
      <SelectField
        label="Lintel type"
        value={opening.lintelType ?? preset.wall.lintelType ?? 'bond_beam'}
        onChange={(value) => onOpeningChange(opening.id, { lintelType: value as WallOpeningParameters['lintelType'] })}
        options={[
          { value: 'bond_beam', label: 'Bond beam lintel' },
          { value: 'precast_concrete', label: 'Precast concrete' },
          { value: 'steel_placeholder', label: 'Steel placeholder' },
          { value: 'none', label: 'None' },
        ]}
      />
      <NumberField label="Lintel bearing" value={opening.lintelBearingMeters ?? preset.wall.lintelBearingMeters ?? 0.2} suffix="m" onChange={(value) => onOpeningChange(opening.id, { lintelBearingMeters: Math.max(0, value) })} />
      <NumberField label="Jamb cells each side" value={opening.groutCellsEachSide ?? preset.wall.jambCellsEachSide ?? 1} suffix="cells" step={1} onChange={(value) => onOpeningChange(opening.id, { groutCellsEachSide: Math.max(0, Math.round(value)) })} />
      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Jamb grout enabled</span>
        <input
          type="checkbox"
          checked={opening.jambGroutEnabled ?? true}
          onChange={(event) => onOpeningChange(opening.id, { jambGroutEnabled: event.currentTarget.checked })}
          className="h-4 w-4"
        />
      </label>
      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Jamb rebar enabled</span>
        <input
          type="checkbox"
          checked={opening.jambRebarEnabled ?? false}
          onChange={(event) => onOpeningChange(opening.id, { jambRebarEnabled: event.currentTarget.checked })}
          className="h-4 w-4"
        />
      </label>
      {opening.type === 'window' ? (
        <NumberField label="Grout cells below window" value={opening.groutCellsBelowWindow ?? 0} suffix="cells" step={1} onChange={(value) => onOpeningChange(opening.id, { groutCellsBelowWindow: Math.max(0, Math.round(value)) })} />
      ) : null}
      <TextField
        label="Notes"
        value={opening.notes ?? ''}
        onChange={(value) => onOpeningChange(opening.id, { notes: value })}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatInputNumber(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.activeElement?.getAttribute('aria-label') === label) return;
    setDraft(formatInputNumber(value));
    setError(null);
  }, [label, value]);

  const commit = () => {
    const parsed = parseDecimalInput(draft);
    if (!Number.isFinite(parsed)) {
      setError('Enter a valid decimal value.');
      return;
    }
    if (typeof min === 'number' && parsed < min) {
      setError(`Minimum ${formatInputNumber(min)} ${suffix}.`);
      return;
    }
    if (typeof max === 'number' && parsed > max) {
      setError(`Maximum ${formatInputNumber(max)} ${suffix}.`);
      return;
    }
    setError(null);
    onChange(parsed);
    setDraft(formatInputNumber(parsed));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <div
        className={`flex h-10 overflow-hidden rounded-lg border bg-white transition focus-within:ring-2 focus-within:ring-cyan-400/30 dark:bg-slate-950 ${
          error
            ? 'border-red-300 dark:border-red-700'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            if (error) setError(null);
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <span className="flex min-w-12 items-center justify-center border-l border-slate-200 px-3 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {suffix}
        </span>
      </div>
      {error ? <span className="mt-1 block text-xs text-red-600 dark:text-red-300">{error}</span> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <label
      className="flex items-center gap-2 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300"
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

function ModuleFitReportPanel({ report }: { report: import('../domain/moduleFitReport').ModuleFitReport }) {
  const toneClass =
    report.status === 'fully_modular' || report.status === 'bond_modular'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
      : report.status === 'cut_required' || report.status === 'opening_conflict'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100';
  return (
    <div className={`rounded-lg border p-2 text-xs ${toneClass}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold">Modular fit</span>
        <ModuleFitStatusBadge status={report.status} />
      </div>
      {report.summaryLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function moduleFitStatusTone(status: import('../types').ModuleFitStatus): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'fully_modular' || status === 'bond_modular') return 'success';
  if (status === 'cut_required' || status === 'opening_conflict') return 'warning';
  if (status === 'unresolved') return 'error';
  return 'info';
}

function ModuleFitStatusBadge({ status }: { status: import('../types').ModuleFitStatus }) {
  const className =
    status === 'fully_modular' || status === 'bond_modular'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : status === 'cut_required' || status === 'opening_conflict'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
  const label =
    status === 'fully_modular'
      ? 'Fully modular'
      : status === 'bond_modular'
        ? 'Bond modular'
        : status === 'cut_required'
          ? 'Cut required'
          : status === 'opening_conflict'
            ? 'Opening conflict'
            : 'Unresolved';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function ModuleFitBadge({ fit }: { fit: 'full' | 'half' | 'cut' }) {
  const className =
    fit === 'full'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : fit === 'half'
        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  const label = fit === 'full' ? 'Full-module fit' : fit === 'half' ? 'Half-module fit' : 'Cut-Block Condition';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function formatModuleCount(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '');
}

function summarizeClosures(closures: ReturnType<typeof generateCmuLayout>['openingCourseClosures']): string {
  if (closures.length === 0) return 'none';
  const counts = closures.reduce<Record<string, number>>((acc, closure) => {
    acc[closure.closureType] = (acc[closure.closureType] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([type, count]) => `${type.replace(/_/g, ' ')} ${count}`)
    .join(', ');
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(/,/g, '');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}

function positiveOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function objectIdForType(
  objectType: DesignObjectType,
  objectIds: { slabObjectId: string; wallObjectId: string; roofObjectId: string; trussObjectId: string },
): string {
  if (objectType === 'thickened_edge_slab') return objectIds.slabObjectId;
  if (objectType === 'gable_roof_system') return objectIds.roofObjectId;
  if (objectType === 'steel_truss_system') return objectIds.trussObjectId;
  return objectIds.wallObjectId;
}

function objectTypeForPreviewLine(line: DesignEstimatePreviewLine): DesignObjectType {
  if (line.quantityType.includes('slab')) return 'thickened_edge_slab';
  if (line.quantityType.includes('roof')) return 'gable_roof_system';
  if (line.quantityType.includes('truss')) return 'steel_truss_system';
  return 'cmu_wall_system';
}

