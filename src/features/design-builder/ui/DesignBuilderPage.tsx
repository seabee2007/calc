import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  commitDesignEstimatePreview,
  persistDesignEstimatePreview,
} from '../application/designBuilderToEstimate';
import {
  resolveDesignBuilderGeometryPipeline,
  resolveDesignBuilderRenderModel,
} from '../application/designBuilderGeometryPipeline';
import {
  buildPresetObjects,
  createBlankCmuBuildingPreset,
  type CmuBuildingPreset,
} from '../domain/designBuilderPreset';
import { normalizeOpeningsHeadAlignment } from '../domain/openingDefaults';
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
  resolveHeadAlignedWindowSillHeight,
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
import {
  generateCmuLayout,
  getSegmentFramesForWallLayout,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
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
  detectClosedFootprint,
  deriveExteriorBounds,
  moveWallNode,
  projectExactSegmentLength,
  removeLastSegment,
  resolveActiveDrawNodeId,
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
import { useEstimateWorkspaceHeaderCollapse } from '../../estimating/ui/EstimateWorkspaceHeaderCollapseContext';
import {
  buildDesignEstimatePreview,
  cubicMetersToCubicYards,
  resolveCmuOrderBlockQuantity,
} from '../quantity/designQuantityFormulas';
import {
  areaFromSquareMeters,
  volumeFromCubicMeters,
} from '../quantity/designQuantityUnits';
import { usePreferencesStore } from '../../../store';
import {
  applyAutoFrameLayout,
  applyFrameFoundationDimensions,
  objectSaveKey,
  setBuildingSystemMode,
  type FrameFoundationDimensionsApplyPayload,
} from '../domain/structureActions';
import { createDefaultFoundationSettings, normalizeRcFrameFoundationSettings, resolveFoundationElevations, syncColumnHeightAbovePlinthForWallHeight } from '../domain/foundationElevations';
import {
  createDefaultRoofSystemSettings,
  DEFAULT_ROOF_LAYER_VISIBILITY,
  normalizeRoofSystemSettings,
  syncRoofSystemTrussSpacing,
} from '../domain/roofSystemDefaults';
import { normalizeCmuInfillSystem, normalizeCmuInfillPlasterSettings } from '../domain/infillPlaster';
import FrameFoundationDimensionsModal from './FrameFoundationDimensionsModal';
import { DoorConfigurationControls } from './DoorConfigurationControls';
import {
  designModelMetadataWithPersistedState,
  persistenceStatusMessage,
  presetFromStoredDesign,
  readPersistedDesignBuilderState,
  resolveDesignBuilderPersistenceContext,
  validateDesignBuilderPersistenceContext,
  type DesignBuilderSaveState,
} from '../domain/designBuilderPersistence';
import {
  createDesignModel,
  findDesignModelByEstimateId,
  listDesignModelObjects,
  updateDesignModelMetadata,
  upsertDesignModelObjects,
} from '../services/designBuilderService';
import type {
  BuilderViewMode,
  BuildingSystemMode,
  Design2DViewType,
  DesignAnnotation,
  DesignBuilderCameraSnapshot,
  DesignBuilderElevationViewState,
  DesignBuilderInteractionEvent,
  DesignBuilderLayoutMode,
  DesignBuilderSelection,
  DesignBuilderToolMode,
  DesignBuilderViewMode,
  DesignBuilderSnapMode,
  DesignEstimatePreviewLine,
  Design2dDrawingStyleMode,
  DesignVisualStyle,
  DesignComponentType,
  FoundationViewMode,
  RoofDisplayMode,
  RoofLayerVisibility,
  RcFrameFoundationSettings,
  RoofSystemSettings,
  DesignModel,
  DesignModelObject,
  DesignObjectType,
  DesignQuantityItem,
  DesignUnitSystem,
  PlacedDesignComponent,
  DesignWallSegment,
  DesignWallLayoutParameters,
  CmuInfillPlasterSettings,
  MasonryCourseRun,
  MasonryToolMode,
  ModuleFitMode,
  WallOpeningParameters,
} from '../types';
import {
  builderViewModeFromStored,
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
import { buildLayoutFramingKey, logDesignFramingDiagnostics } from '../domain/designLayoutBounds';
import { formatDrawWallSnapTargetFeedback } from '../domain/designDrawWallFeedback';
import DesignBuilderViewer from './DesignBuilderViewer';
import type { DesignBuilderPlacementPreview } from './DesignBuilderOpeningPreviewScene';
import { DraggableDebugOverlay } from './DraggableDebugOverlay';
import { DebugOverlayLayoutProvider } from './DebugOverlayLayoutContext';
import {
  initializeMaterialSelectionsFromPersistence,
  normalizeDesignMaterialSelection,
  setActiveMaterialSelections,
  type DesignMaterialSelection,
} from '../rendering/materials/designMaterialLibrary';
import MaterialsColorsModal, {
  type MaterialsColorsApplyPayload,
  type MaterialsFinishesScope,
} from './MaterialsColorsModal';
import DesignBuilderPlanCanvas from './DesignBuilderPlanCanvas';
import DesignBuilderElevationCanvas from './DesignBuilderElevationCanvas';
import {
  closeDesignBuilderCommandMenus,
  CommandMenuAction,
  DesignBuilderCommandMenu,
  DesignBuilderCommandMenuProvider,
} from './DesignBuilderCommandMenu';
import {
  groupDesignComponentDefinitions,
  getDesignComponentDefinition,
} from '../domain/designComponentRegistry';
import {
  buildPlacedComponent,
  componentPlacementReducer,
  createIdleComponentPlacementState,
  resolveElevationHelperMeasurements,
  resolvePlanHelperMeasurements,
  snapComponentPlanPoint,
} from '../domain/designComponentPlacement';

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
  const persistenceContext = useMemo(
    () =>
      resolveDesignBuilderPersistenceContext({
        projectId,
        estimateId,
        userId: user?.id,
      }),
    [estimateId, projectId, user?.id],
  );
  const storedSession = useDesignBuilderSessionStore((store) => store.sessions[sessionKey]);
  const saveDesignBuilderSession = useDesignBuilderSessionStore((store) => store.saveSession);
  const clearDesignBuilderSession = useDesignBuilderSessionStore((store) => store.clearSession);
  const confirm = useConfirm();
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const hasUserAdjustedPlanViewRef = useRef(storedSession?.hasUserAdjustedPlanView ?? false);
  const hasUserAdjusted3dViewRef = useRef(storedSession?.hasUserAdjusted3dView ?? false);
  const lastSnapTargetRef = useRef<DesignSnapTarget | null>(null);
  const viewerOverlayContainerRef = useRef<HTMLDivElement | null>(null);
  const pending3dFitRef = useRef(false);
  const prevFootprintClosedRef = useRef(false);
  const autoFitPlanForLayoutKeyRef = useRef<string | null>(null);
  const autoFit3dForLayoutKeyRef = useRef<string | null>(null);
  const sessionFramingValidatedRef = useRef(false);
  const orthogonalGuidesPreferenceTouchedRef = useRef(storedSession?.orthogonalGuidesPreferenceTouched ?? false);
  const resizeFrameRef = useRef<number | null>(null);
  const persistedDesignLoadedRef = useRef(false);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const [layoutState, setLayoutState] = useState<DesignBuilderLayoutMode>(() => storedSession?.layoutState ?? 'blank');
  const [layoutEpoch, setLayoutEpoch] = useState(() => storedSession?.layoutEpoch ?? 0);
  const [preset, setPreset] = useState<CmuBuildingPreset | null>(() => storedSession?.preset ?? createBlankCmuBuildingPreset());
  const [designModel, setDesignModel] = useState<DesignModel | null>(() => storedSession?.designModel ?? null);
  const [objects, setObjects] = useState<DesignModelObject[]>(() => storedSession?.objects ?? []);
  const [placedComponents, setPlacedComponents] = useState<PlacedDesignComponent[]>(
    () => storedSession?.placedComponents ?? [],
  );
  const [annotations, setAnnotations] = useState<DesignAnnotation[]>(
    () => storedSession?.annotations ?? [],
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
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
  const [status, setStatus] = useState<PageStatus>(() => ({
    tone: 'info',
    message: persistenceStatusMessage(persistenceContext.mode),
  }));
  const [saveState, setSaveState] = useState<DesignBuilderSaveState>('unsaved');
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
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
  const [showRoofReferencePerimeters, setShowRoofReferencePerimeters] = useState(false);
  const [showRoofFramingGuides, setShowRoofFramingGuides] = useState(false);
  const [showRoofPlanHatch, setShowRoofPlanHatch] = useState(true);
  const [showRoofPlanSlopeArrows, setShowRoofPlanSlopeArrows] = useState(true);
  const [showRoofPlanDimensions, setShowRoofPlanDimensions] = useState(true);
  const [showRoofPlanReferenceLines, setShowRoofPlanReferenceLines] = useState(true);
  const [visualStyle, setVisualStyle] = useState<DesignVisualStyle>('technical');
  const [twoDDrawingStyle, setTwoDDrawingStyle] = useState<Design2dDrawingStyleMode>('architectural');
  const [materialSelections, setMaterialSelections] = useState<DesignMaterialSelection>(() =>
    normalizeDesignMaterialSelection(),
  );
  const [materialRevision, setMaterialRevision] = useState(0);
  const [materialsModal, setMaterialsModal] = useState<{
    open: boolean;
    scope: MaterialsFinishesScope;
  }>({ open: false, scope: 'all' });
  const [foundationViewMode, setFoundationViewMode] = useState<FoundationViewMode>('full_model');
  const [roofDisplayMode, setRoofDisplayMode] = useState<RoofDisplayMode>('full_roof');
  const [roofLayerVisibility, setRoofLayerVisibility] = useState<RoofLayerVisibility>(
    DEFAULT_ROOF_LAYER_VISIBILITY,
  );
  const [frameFoundationModalOpen, setFrameFoundationModalOpen] = useState(false);
  const [structureModalRoofDraft, setStructureModalRoofDraft] = useState<RoofSystemSettings | null>(null);
  const [designGeometryState, setDesignGeometryState] = useState<{ revision: number; lastReason?: string }>({
    revision: 0,
  });
  const [lastStructureApplyRevision, setLastStructureApplyRevision] = useState(0);
  const [viewMode, setViewMode] = useState<DesignBuilderViewMode>(() => builderViewModeFromStored(storedSession?.viewMode ?? '3d'));
  const [active2DView, setActive2DView] = useState<Design2DViewType>(() => storedSession?.active2DView ?? 'foundation-plan');
  const activeCanvasView: BuilderViewMode = active2DView === 'elevation-view' ? 'elevation' : 'plan';
  const [elevationView, setElevationView] = useState<DesignBuilderElevationViewState>(
    () => storedSession?.elevationView ?? { face: 'north' },
  );
  const [componentPlacement, dispatchComponentPlacement] = useReducer(
    componentPlacementReducer,
    activeCanvasView,
    createIdleComponentPlacementState,
  );
  const [componentPanelPosition, setComponentPanelPosition] = useState({ x: 18, y: 72 });
  const [componentPanelCollapsed, setComponentPanelCollapsed] = useState(false);

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
      setPlacedComponents(storedSession.placedComponents ?? []);
      setAnnotations(storedSession.annotations ?? []);
      setSelectedComponentId(null);
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
      setViewMode(builderViewModeFromStored(storedSession.viewMode ?? '3d'));
      setActive2DView(storedSession.active2DView ?? 'foundation-plan');
      setElevationView(storedSession.elevationView ?? { face: 'north' });
      dispatchComponentPlacement({ type: 'reset', activeView: (storedSession.active2DView ?? 'foundation-plan') === 'elevation-view' ? 'elevation' : 'plan' });
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
    persistedDesignLoadedRef.current = false;
  }, [sessionKey]);

  useEffect(() => {
    if (!persistenceContext.canPersist || persistedDesignLoadedRef.current) return;
    persistedDesignLoadedRef.current = true;

    void (async () => {
      try {
        const modelResult = await findDesignModelByEstimateId(projectId, persistenceContext.estimateId!);
        if (modelResult.error) {
          setLastSaveError(modelResult.error);
          setSaveState('failed');
          setStatus({ tone: 'error', message: DESIGN_BUILDER_COPY.status.saveFailed });
          return;
        }
        if (!modelResult.data) {
          setSaveState('unsaved');
          setStatus({ tone: 'info', message: persistenceStatusMessage('project_bound') });
          return;
        }

        const objectsResult = await listDesignModelObjects(modelResult.data.id);
        if (objectsResult.error || !objectsResult.data) {
          setLastSaveError(objectsResult.error ?? 'Could not load saved design objects.');
          setSaveState('failed');
          setStatus({ tone: 'error', message: DESIGN_BUILDER_COPY.status.saveFailed });
          return;
        }

        const persistedState = readPersistedDesignBuilderState(modelResult.data);
        const nextPreset = presetFromStoredDesign({
          objects: objectsResult.data,
          persistedState,
          fallbackName: modelResult.data.name,
        });
        setDesignModel(modelResult.data);
        setObjects(objectsResult.data);
        setPreset(nextPreset);
        setLayoutState(nextPreset.wallLayout.segments.length > 0 ? 'editing' : 'blank');
        setManualMasonryRuns(nextPreset.wall.manualMasonryCourseRuns ?? []);
        setPlacedComponents(persistedState?.placedComponents ?? []);
        setAnnotations(persistedState?.annotations ?? []);
        setSelectedComponentId(null);
        setSaveState('saved');
        setLastSaveTime(persistedState?.updatedAt ?? modelResult.data.updatedAt);
        setLastSaveError(null);
        setDesignGeometryState((current) => ({
          revision: current.revision + 1,
          lastReason: 'design_loaded_from_estimate',
        }));
        if (persistedState?.displayPreferences?.activeView) {
          setViewMode(builderViewModeFromStored(persistedState.displayPreferences.activeView));
        }
        setActive2DView(persistedState?.displayPreferences?.active2DView ?? 'foundation-plan');
        if (persistedState?.displayPreferences?.elevationView) {
          setElevationView(persistedState.displayPreferences.elevationView);
        }
        if (persistedState?.displayPreferences?.roofDisplayMode) {
          setRoofDisplayMode(persistedState.displayPreferences.roofDisplayMode as RoofDisplayMode);
        }
        if (persistedState?.displayPreferences?.foundationViewMode) {
          setFoundationViewMode(persistedState.displayPreferences.foundationViewMode as FoundationViewMode);
        }
        if (persistedState?.displayPreferences?.visualStyle) {
          setVisualStyle(persistedState.displayPreferences.visualStyle as DesignVisualStyle);
        }
        const loadedMaterialSelections = normalizeDesignMaterialSelection(
          persistedState?.displayPreferences?.materialSelections,
        );
        setMaterialSelections(loadedMaterialSelections);
        initializeMaterialSelectionsFromPersistence(loadedMaterialSelections);
        setStatus({ tone: 'info', message: persistenceStatusMessage('project_bound') });
      } catch {
        setLastSaveError('Could not load saved design.');
        setSaveState('failed');
      }
    })();
  }, [persistenceContext.canPersist, persistenceContext.estimateId, projectId]);

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
      placedComponents,
      annotations,
      unitSystem,
      selectedObjectType,
      selectedOpeningId,
      toolMode,
      masonryToolMode,
      changedAfterCommit,
      viewMode,
      active2DView,
      elevationView,
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
    active2DView,
    annotations,
    cameraSnapshot,
    designModel,
    leftPanelCollapsed,
    layoutEpoch,
    layoutState,
    masonryToolMode,
    modelLoaded,
    objects,
    placedComponents,
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
    elevationView,
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
    const normalizedRoofSystem = syncRoofSystemTrussSpacing(
      normalizeRoofSystemSettings(base.roofSystem ?? createDefaultRoofSystemSettings()),
      base.truss.spacingMeters,
    );
    return {
      ...base,
      wall: {
        ...base.wall,
        openings: normalizeOpeningsHeadAlignment(base.wall.openings),
      },
      foundationSettings: normalizeRcFrameFoundationSettings(base.foundationSettings),
      roofSystem: normalizedRoofSystem,
    };
  }, [preset]);
  const wallLayout = resolvedPreset.wallLayout;
  const nextUndoCommand = peekUndoDesignCommand(designHistory);
  const nextRedoCommand = peekRedoDesignCommand(designHistory);
  const footprintClosed = canGenerateSlabAndRoof(wallLayout);
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
  const activeRoofSystem = useMemo(
    () =>
      normalizeRoofSystemSettings(
        frameFoundationModalOpen && structureModalRoofDraft
          ? structureModalRoofDraft
          : resolvedPreset.roofSystem,
      ),
    [frameFoundationModalOpen, resolvedPreset.roofSystem, structureModalRoofDraft],
  );
  const {
    designGeometryResult,
    designLayoutBounds,
  } = useMemo(
    () => {
      // Keep the deep masonry key in the memo inputs for nested wall/course edits.
      void masonryGeometryKey;
      return resolveDesignBuilderGeometryPipeline({
        wallLayout,
        effectiveWall,
        resolvedPreset,
        footprintClosed,
        activeRoofSystem,
        manualMasonryRuns,
      });
    },
    [
      activeRoofSystem,
      effectiveWall,
      footprintClosed,
      manualMasonryRuns,
      masonryGeometryKey,
      resolvedPreset,
      wallLayout,
    ],
  );
  const designRenderModel = useMemo(
    () =>
      resolveDesignBuilderRenderModel({
        placedComponents,
        layoutBounds: designLayoutBounds,
      }),
    [designLayoutBounds, placedComponents],
  );
  const maxPlywoodCeilingHeightMeters = useMemo(() => {
    const foundation = normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings);
    const elevations = resolveFoundationElevations({
      foundation,
      wallHeightMeters: effectiveWall.heightMeters,
    });
    return Math.max(0, elevations.roofBeamBottomY - foundation.plywoodCeiling.tubeSizeMeters);
  }, [effectiveWall.heightMeters, resolvedPreset.foundationSettings]);
  const layoutFramingKey = useMemo(
    () => buildLayoutFramingKey(layoutEpoch, designLayoutBounds),
    [designLayoutBounds, layoutEpoch],
  );

  const setDesignBuilderViewMode = useCallback((mode: DesignBuilderViewMode) => {
    if (mode === '3d' && viewMode !== '3d' && designLayoutBounds && !hasUserAdjusted3dViewRef.current) {
      pending3dFitRef.current = true;
    }
    if (mode === '3d' && toolMode === 'place_component') {
      setToolMode('select');
      dispatchComponentPlacement({ type: 'reset', activeView: activeCanvasView });
      setComponentPanelCollapsed(true);
      setStatus({ tone: 'info', message: '2D component placement cancelled for 3D view.' });
    }
    setViewMode(mode);
  }, [activeCanvasView, designLayoutBounds, toolMode, viewMode]);

  const setActive2DDrawingView = useCallback((nextView: Design2DViewType) => {
    setViewMode('2d');
    setActive2DView(nextView);
    dispatchComponentPlacement({ type: 'reset', activeView: nextView === 'elevation-view' ? 'elevation' : 'plan' });
  }, []);

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
    if (footprintClosed && !prevFootprintClosedRef.current && viewMode === '2d' && active2DView === 'foundation-plan' && !hasUserAdjustedPlanViewRef.current) {
      issueViewCommand('fit');
    }
    prevFootprintClosedRef.current = footprintClosed;
  }, [active2DView, footprintClosed, modelLoaded, viewMode]);

  useEffect(() => {
    if (!modelLoaded || !designLayoutBounds) return;
    if (wallLayout.segments.length === 0 && !footprintClosed) return;
    if (viewMode === '2d' && active2DView === 'foundation-plan' && !hasUserAdjustedPlanViewRef.current && autoFitPlanForLayoutKeyRef.current !== layoutFramingKey) {
      autoFitPlanForLayoutKeyRef.current = layoutFramingKey;
      issueViewCommand('fit');
      return;
    }
    if (viewMode !== '3d' || hasUserAdjusted3dViewRef.current) return;
    if (autoFit3dForLayoutKeyRef.current === layoutFramingKey && !pending3dFitRef.current) return;
    autoFit3dForLayoutKeyRef.current = layoutFramingKey;
    pending3dFitRef.current = false;
    issueViewCommand('fit');
  }, [active2DView, designLayoutBounds, footprintClosed, layoutFramingKey, modelLoaded, viewMode, wallLayout.segments.length]);
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

  const { preferences } = usePreferencesStore();
  const measurementSystem = preferences.measurementSystem;

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
      measurementSystem,
    });
  }, [designGeometryResult, designModel?.id, effectiveWall, footprintClosed, measurementSystem, objectIds, resolvedPreset]);
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
    const placingDoor = toolMode === 'place_door' && placementPreview.openingType === 'door';
    return {
      resolvedPlacement: placementPreview.resolvedPlacement,
      openingType: placementPreview.openingType,
      isValid: placementPreview.isValid,
      statusKind: placementPreview.statusKind,
      swingDirection: placingDoor
        ? openingToolSettings.door.swingDirection ?? 'left'
        : draft?.swingDirection ?? openingToolSettings.door.swingDirection ?? 'left',
      swingType: placingDoor
        ? openingToolSettings.door.swingType ?? 'inswing'
        : draft?.swingType ?? openingToolSettings.door.swingType ?? 'inswing',
    };
  }, [
    openingToolSettings.door.swingDirection,
    openingToolSettings.door.swingType,
    placementPreview,
    toolMode,
  ]);
  const componentDefinitionGroups = useMemo(() => groupDesignComponentDefinitions(), []);

  function rcComponentDefaults(componentType: DesignComponentType): Record<string, unknown> {
    const foundation = normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings);
    const elevations = resolveFoundationElevations({
      foundation,
      wallHeightMeters: resolvedPreset.wall.heightMeters,
    });
    switch (componentType) {
      case 'column':
        return {
          widthMeters: foundation.columns.widthMeters,
          depthMeters: foundation.columns.depthMeters,
          heightMeters: elevations.columnHeightMeters,
          baseElevationMeters: elevations.columnBottomY,
          topElevationMeters: elevations.columnTopY,
          materialType: 'reinforced_concrete',
          autoFooter: foundation.isolatedFootings.enabled && foundation.isolatedFootings.autoCreateAtStructuralColumns,
          footerWidthMeters: foundation.isolatedFootings.widthMeters,
          footerLengthMeters: foundation.isolatedFootings.lengthMeters,
          footerThicknessMeters: foundation.isolatedFootings.thicknessMeters,
          footerBottomElevationMeters: elevations.bottomOfFootingY,
          footerTopElevationMeters: elevations.topOfFootingY,
        };
      case 'footer':
        return {
          widthMeters: foundation.isolatedFootings.widthMeters,
          lengthMeters: foundation.isolatedFootings.lengthMeters,
          thicknessMeters: foundation.isolatedFootings.thicknessMeters,
          bottomElevationMeters: elevations.bottomOfFootingY,
          topElevationMeters: elevations.topOfFootingY,
          materialType: 'reinforced_concrete',
        };
      case 'tie_beam':
        return {
          widthMeters: foundation.tieBeam.widthMeters,
          depthMeters: foundation.tieBeam.depthMeters,
          elevationMeters: elevations.bottomOfTieBeamY,
          materialType: 'reinforced_concrete',
        };
      case 'plinth_beam':
        return {
          widthMeters: foundation.plinthBeam.widthMeters,
          depthMeters: foundation.plinthBeam.depthMeters,
          elevationMeters: elevations.bottomOfPlinthBeamY,
          materialType: 'reinforced_concrete',
        };
      case 'roof_beam':
        return {
          widthMeters: foundation.roofBeam.widthMeters,
          depthMeters: foundation.roofBeam.depthMeters,
          elevationMeters: elevations.roofBeamBottomY,
          materialType: 'reinforced_concrete',
        };
      case 'slab':
        return {
          thicknessMeters: foundation.interiorFloorSlab.thicknessMeters,
          widthMeters: Math.max(0, resolvedPreset.footprint.widthMeters),
          lengthMeters: Math.max(0, resolvedPreset.footprint.lengthMeters),
          topElevationMeters: elevations.interiorFloorSlabTopY,
          materialType: 'reinforced_concrete',
        };
      default:
        return {};
    }
  }

  function activateDesignComponent(componentType: DesignComponentType) {
    if (componentType === 'door' || componentType === 'window') {
      dispatchComponentPlacement({ type: 'reset', activeView: activeCanvasView });
      setComponentPanelCollapsed(true);
      activateToolMode(componentType === 'door' ? 'place_door' : 'place_window');
      return;
    }
    const definition = getDesignComponentDefinition(componentType);
    const nextView = definition.supportedViews.includes(activeCanvasView)
      ? activeCanvasView
      : definition.supportedViews[0] ?? 'plan';
    setActive2DDrawingView(nextView === 'elevation' ? 'elevation-view' : 'foundation-plan');
    setToolMode('place_component');
    setPlacementPreview(null);
    dispatchComponentPlacement({ type: 'select_component', componentType, activeView: nextView });
    dispatchComponentPlacement({ type: 'update_parameters', parameters: rcComponentDefaults(componentType) });
    setComponentPanelCollapsed(false);
    closeDesignBuilderCommandMenus();
    setStatus({ tone: 'info', message: `${definition.displayName} placement active. Move over the canvas and click to place.` });
  }

  function cancelComponentPlacement() {
    dispatchComponentPlacement({ type: 'cancel' });
    setToolMode('select');
    setStatus({ tone: 'info', message: 'Component placement cancelled.' });
  }

  function handleComponentPointer(event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number }) {
    if (!componentPlacement.activeComponentType || !componentPlacement.activeComponentDefinition) return;
    const snapPosition =
      activeCanvasView === 'plan'
        ? snapComponentPlanPoint({
            point: { xMeters: event.xMeters, zMeters: event.zMeters },
            snapMode,
            snapSpacingMeters: planSnapSpacingMeters,
          })
        : snapComponentPlanPoint({
            point: { xMeters: event.xMeters, zMeters: event.zMeters },
            snapMode: snapMode === 'off' ? 'off' : 'grid',
            snapSpacingMeters: 0.1,
          });
    const helperMeasurements =
      activeCanvasView === 'elevation'
        ? resolveElevationHelperMeasurements({
            position: { xMeters: event.xMeters, zMeters: event.zMeters },
            snapPosition,
            elevationView,
            componentType: componentPlacement.activeComponentType,
            parameters: componentPlacement.draftComponentParameters,
          })
        : resolvePlanHelperMeasurements({
            position: { xMeters: event.xMeters, zMeters: event.zMeters },
            snapPosition,
            layout: wallLayout,
            columns: designGeometryResult.frameSystem?.columns ?? resolvedPreset.frameSystem.columns,
          });
    dispatchComponentPlacement({
      type: 'preview',
      activeView: activeCanvasView,
      cursor: { xMeters: event.xMeters, zMeters: event.zMeters },
      snap: snapPosition,
      helperMeasurements,
      elevationFace: elevationView.face,
    });
    if (event.phase !== 'commit') return;
    const errors = componentPlacement.activeComponentDefinition.validate(componentPlacement.draftComponentParameters);
    if (errors.length > 0) {
      setStatus({ tone: 'error', message: errors[0] });
      return;
    }
    const component = buildPlacedComponent({
      type: componentPlacement.activeComponentType,
      activeView: activeCanvasView,
      parameters: componentPlacement.draftComponentParameters,
      position: snapPosition,
      elevationFace: elevationView.face,
    });
    const relatedComponents: PlacedDesignComponent[] = [];
    let placedComponent = component;
    const foundation = normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings);
    if (
      component.type === 'column' &&
      foundation.isolatedFootings.enabled &&
      foundation.isolatedFootings.autoCreateAtStructuralColumns
    ) {
      const footer = buildPlacedComponent({
        type: 'footer',
        activeView: activeCanvasView,
        parameters: rcComponentDefaults('footer'),
        position: snapPosition,
        elevationFace: elevationView.face,
      });
      const footerWithReference: PlacedDesignComponent = {
        ...footer,
        references: { ...(footer.references ?? {}), hostId: component.id },
      };
      placedComponent = {
        ...component,
        references: {
          ...(component.references ?? {}),
          connectedComponentIds: [...(component.references?.connectedComponentIds ?? []), footer.id],
        },
      };
      relatedComponents.push(footerWithReference);
    }
    setPlacedComponents((current) => [...current, placedComponent, ...relatedComponents]);
    setSelectedComponentId(placedComponent.id);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedOpeningId(null);
    setSelectedObjectType('structural_frame_system');
    dispatchComponentPlacement({ type: 'placed', component: placedComponent });
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: `${componentPlacement.activeComponentDefinition.displayName} placed.` });
  }

  function handleComponentParameterChange(key: string, value: string, kind: 'number' | 'text' | 'select') {
    dispatchComponentPlacement({
      type: 'update_parameters',
      parameters: {
        [key]: kind === 'number' ? Number(value) : value,
      },
    });
    setSaveState('unsaved');
  }

  function handleComponentPanelDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement | null)?.closest('button,input,select')) return;
    const start = { x: event.clientX, y: event.clientY };
    const origin = componentPanelPosition;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const handleMove = (moveEvent: PointerEvent) => {
      setComponentPanelPosition({
        x: Math.max(8, origin.x + moveEvent.clientX - start.x),
        y: Math.max(8, origin.y + moveEvent.clientY - start.y),
      });
    };
    const cleanup = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
  }
  const cmuLayout = designGeometryResult.wallCmuLayout;
  const manualMasonrySummary = useMemo(() => summarizeManualMasonryRuns(manualMasonryRuns), [manualMasonryRuns]);
  const moduleWarnings = useMemo(
    () => [...new Set([...designGeometryResult.wallCmuLayout.warnings, ...validateCmuOpenings(effectiveWall)])],
    [designGeometryResult.wallCmuLayout.warnings, effectiveWall],
  );

  const isRcFrameBuilding =
    resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill';
  const quantityCards = useMemo(() => {
    const previewLine = (id: string, alternateId?: string) =>
      generatedPreview.find((line) => line.id === id) ??
      (alternateId ? generatedPreview.find((line) => line.id === alternateId) : undefined);

    const cmuBlockQuantity = resolveCmuOrderBlockQuantity({
      totalGeneratedBlocks: designGeometryResult.blockCount + manualMasonrySummary.total,
      wasteFactor: effectiveWall.wasteFactor,
    });
    const roughOpening = areaFromSquareMeters(
      cmuLayout.openingGrout.roughOpeningAreaSquareMeters,
      measurementSystem,
    );
    const actualOpening = areaFromSquareMeters(
      cmuLayout.openingGrout.actualOpeningAreaSquareMeters,
      measurementSystem,
    );
    const closureGrout = volumeFromCubicMeters(
      cmuLayout.openingGrout.closureGroutVolumeCubicMeters,
      measurementSystem,
      3,
    );
    const openingGrout = volumeFromCubicMeters(
      cmuLayout.openingGrout.totalGroutVolumeCubicMeters,
      measurementSystem,
      3,
    );
    const coreFillLine = previewLine('cmu-core-fill-grout');
    const roofAreaLine = previewLine('roof-surface-area', 'roof-area');
    const trussLine = previewLine('steel-trusses');
    const rakedCapLine = previewLine('raked-concrete-cap');
    const interiorSlabLine = previewLine('interior-floor-slab-volume');
    const thickenedSlabLine = previewLine('slab-concrete');

    return [
      ...(isRcFrameBuilding
        ? []
        : [
            {
              label: 'Thickened edge slab concrete',
              value: modelLoaded ? (thickenedSlabLine?.quantity ?? 0) : 0,
              unit: thickenedSlabLine?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'thickened_edge_slab' as DesignObjectType,
            },
          ]),
      {
        label: 'CMU blocks including waste',
        value: modelLoaded ? cmuBlockQuantity : 0,
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
        value: modelLoaded ? roughOpening.quantity : 0,
        unit: roughOpening.unit,
        objectType: 'door_opening' as DesignObjectType,
      },
      {
        label: 'Actual opening area',
        value: modelLoaded ? actualOpening.quantity : 0,
        unit: actualOpening.unit,
        objectType: 'window_opening' as DesignObjectType,
      },
      {
        label: 'Jamb grouted cells',
        value: modelLoaded ? cmuLayout.jambGroutCells.length : 0,
        unit: 'EA',
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Closure grout volume',
        value: modelLoaded ? closureGrout.quantity : 0,
        unit: closureGrout.unit,
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'CMU core fill grout',
        value: modelLoaded ? (coreFillLine?.quantity ?? 0) : 0,
        unit: coreFillLine?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      {
        label: 'Opening grout volume',
        value: modelLoaded ? openingGrout.quantity : 0,
        unit: openingGrout.unit,
        objectType: 'cmu_wall_system' as DesignObjectType,
      },
      ...(isRcFrameBuilding
        ? [
            {
              label: 'Footer concrete volume',
              value: modelLoaded ? (previewLine('isolated-footings-volume')?.quantity ?? 0) : 0,
              unit:
                previewLine('isolated-footings-volume')?.unit ??
                (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'structural_frame_system' as DesignObjectType,
            },
            {
              label: 'Columns concrete volume',
              value: modelLoaded ? (previewLine('rc-columns-volume')?.quantity ?? 0) : 0,
              unit:
                previewLine('rc-columns-volume')?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'structural_frame_system' as DesignObjectType,
            },
            {
              label: 'Plinth beam concrete volume',
              value: modelLoaded ? (previewLine('rc-plinth-beams-volume')?.quantity ?? 0) : 0,
              unit:
                previewLine('rc-plinth-beams-volume')?.unit ??
                (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'structural_frame_system' as DesignObjectType,
            },
            {
              label: 'Tie beam concrete volume',
              value: modelLoaded ? (previewLine('rc-tie-beams-volume')?.quantity ?? 0) : 0,
              unit:
                previewLine('rc-tie-beams-volume')?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'structural_frame_system' as DesignObjectType,
            },
            {
              label: 'Roof beam concrete volume',
              value: modelLoaded ? (previewLine('rc-roof-beams-volume')?.quantity ?? 0) : 0,
              unit:
                previewLine('rc-roof-beams-volume')?.unit ??
                (measurementSystem === 'metric' ? 'M3' : 'CY'),
              objectType: 'structural_frame_system' as DesignObjectType,
            },
          ]
        : []),
      {
        label: 'Gable roof surface area',
        value: modelLoaded ? (roofAreaLine?.quantity ?? 0) : 0,
        unit: roofAreaLine?.unit ?? (measurementSystem === 'metric' ? 'M2' : 'SF'),
        objectType: 'gable_roof_system' as DesignObjectType,
      },
      {
        label: 'Steel trusses by spacing',
        value: modelLoaded ? (trussLine?.quantity ?? 0) : 0,
        unit: 'EA',
        objectType: 'steel_truss_system' as DesignObjectType,
      },
      {
        label: 'Raked concrete cap volume',
        value: modelLoaded ? (rakedCapLine?.quantity ?? 0) : 0,
        unit: rakedCapLine?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
        objectType: 'gable_end_system' as DesignObjectType,
      },
      {
        label: 'Interior floor slab volume',
        value: modelLoaded ? (interiorSlabLine?.quantity ?? 0) : 0,
        unit: interiorSlabLine?.unit ?? (measurementSystem === 'metric' ? 'M3' : 'CY'),
        objectType: 'structural_frame_system' as DesignObjectType,
      },
    ];
  }, [
    cmuLayout,
    designGeometryResult.blockCount,
    effectiveWall.wasteFactor,
    generatedPreview,
    isRcFrameBuilding,
    manualMasonrySummary.total,
    measurementSystem,
    modelLoaded,
  ]);

  const selectedObjectLabel = selectedSegmentId
    ? 'Wall Segment'
    : selectedObjectType
      ? OBJECT_TREE_ITEMS.find((item) => item.objectType === selectedObjectType)?.label ?? 'Selected object'
      : 'Project Masonry Defaults';
  const linkedPreviewLines = selectedObjectType
    ? generatedPreview.filter((line) => line.designObjectId === objectIdForType(selectedObjectType, objectIds))
    : [];
  const selectedWallSegment = selectedSegmentId
    ? wallLayout.segments.find((segment) => segment.id === selectedSegmentId) ?? null
    : null;
  const selectedComponent = selectedComponentId
    ? placedComponents.find((component) => component.id === selectedComponentId) ?? null
    : null;
  const activeSelection: DesignBuilderSelection = selectedSegmentId
    ? { kind: 'wall_segment', id: selectedSegmentId }
    : selectedNodeId
      ? { kind: 'wall_node', id: selectedNodeId }
      : selectedOpeningId
        ? { kind: 'opening', id: selectedOpeningId }
        : { kind: 'none' };

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
    if (persistenceContext.canPersist) {
      setSaveState('unsaved');
    }
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
  }): boolean {
    const before = captureDesignSnapshot();
    const after = params.mutate(before);
    if (snapshotsEqual(before, after)) return false;

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
    return true;
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
      const nextGeometry = resolveDesignBuilderGeometryPipeline({
        wallLayout: nextLayout,
        effectiveWall: nextWall,
        resolvedPreset: nextPreset,
        footprintClosed: canGenerateSlabAndRoof(nextLayout),
        activeRoofSystem: normalizeRoofSystemSettings(nextPreset.roofSystem),
        manualMasonryRuns: nextWall.manualMasonryCourseRuns ?? [],
      }).designGeometryResult;
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
    if (mode !== 'reinforced_concrete_frame_with_cmu_infill') {
      setFrameFoundationModalOpen(false);
    }
  }

  function handleApplyFrameFoundationDimensions(
    payload: FrameFoundationDimensionsApplyPayload,
  ): boolean {
    const applied = executeDesignCommand({
      label: 'Update frame & foundation dimensions',
      kind: 'structure_update',
      mutate: (before) =>
        patchDesignSnapshot(before, resolvePresetName(), (current) =>
          applyFrameFoundationDimensions(current, payload),
        ),
      afterApply: () => {
        setDesignGeometryState((current) => {
          const nextRevision = current.revision + 1;
          setLastStructureApplyRevision(nextRevision);
          return {
            revision: nextRevision,
            lastReason: 'structure_dimensions_applied',
          };
        });
        setStatus({
          tone: 'success',
          message: 'RC settings applied.',
        });
      },
    });
    if (!applied) {
      setStatus({ tone: 'info', message: 'No dimension changes to apply.' });
    }
    return applied;
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
    const resolvedHeight = Number.isFinite(height) && height > 0 ? height : defaults.heightMeters;
    return {
      type,
      widthMeters: Number.isFinite(width) && width > 0 ? width : defaults.widthMeters,
      heightMeters: resolvedHeight,
      sillHeightMeters: type === 'window' ? resolveHeadAlignedWindowSillHeight(resolvedHeight) : defaults.sillHeightMeters,
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

  function deletePlacedComponent(componentId: string) {
    const target = placedComponents.find((component) => component.id === componentId);
    if (!target) {
      setStatus({ tone: 'info', message: 'Select a component to delete.' });
      return;
    }
    const idsToRemove = new Set<string>([componentId]);
    if (target.type === 'column') {
      for (const id of target.references?.connectedComponentIds ?? []) {
        idsToRemove.add(id);
      }
      for (const component of placedComponents) {
        if (component.references?.hostId === componentId) {
          idsToRemove.add(component.id);
        }
      }
    }
    const now = new Date().toISOString();
    setPlacedComponents((current) =>
      current
        .filter((component) => !idsToRemove.has(component.id))
        .map((component) => {
          const nextConnected = component.references?.connectedComponentIds?.filter((id) => !idsToRemove.has(id));
          const hostWasRemoved = component.references?.hostId ? idsToRemove.has(component.references.hostId) : false;
          if (nextConnected === component.references?.connectedComponentIds && !hostWasRemoved) return component;
          return {
            ...component,
            references: {
              ...(component.references ?? {}),
              hostId: hostWasRemoved ? undefined : component.references?.hostId,
              connectedComponentIds: nextConnected && nextConnected.length > 0 ? nextConnected : undefined,
            },
            metadata: {
              ...component.metadata,
              updatedAt: now,
            },
          };
        }),
    );
    if (selectedComponentId === componentId || idsToRemove.has(selectedComponentId ?? '')) {
      setSelectedComponentId(null);
    }
    setDraftPlanEnd(null);
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    const label = getDesignComponentDefinition(target.type).displayName;
    setStatus({
      tone: 'success',
      message:
        idsToRemove.size > 1
          ? `${label} and ${idsToRemove.size - 1} related component${idsToRemove.size === 2 ? '' : 's'} removed.`
          : `${label} removed.`,
    });
  }

  async function confirmDeletePlacedComponent(componentId: string) {
    const target = placedComponents.find((component) => component.id === componentId);
    if (!target) {
      setStatus({ tone: 'info', message: 'Select a component to delete.' });
      return;
    }
    const label = getDesignComponentDefinition(target.type).displayName;
    const confirmed = await confirm({
      title: `Delete ${label}?`,
      message:
        target.type === 'column'
          ? 'This will remove the selected column component and any related component footing created with it.'
          : 'This will remove the selected placed component from the design.',
      confirmLabel: 'Delete component',
      confirmVariant: 'danger',
      showWarningIcon: true,
    });
    if (!confirmed) return;
    deletePlacedComponent(componentId);
  }

  function handleDeleteSelectedComponent() {
    if (!selectedComponentId) {
      setStatus({ tone: 'info', message: 'Select a component to delete.' });
      return;
    }
    void confirmDeletePlacedComponent(selectedComponentId);
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

  function undoLastDrawSegment() {
    if (wallLayout.segments.length === 0) return;
    const next = removeLastSegment(wallLayout);
    mutateWallLayoutSilent(next);
    const nextActiveNodeId = resolveActiveDrawNodeId(next);
    setActiveDrawNodeId(nextActiveNodeId);
    setDrawStartNodeId(next.segments.length > 0 ? drawStartNodeId : null);
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
    setActiveDrawNodeId(null);
    setDrawStartNodeId(null);
    setDraftPlanEnd(null);
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
      segmentFrames: planSegmentFrames,
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
      if (toolMode === 'place_component') {
        cancelComponentPlacement();
        return;
      }
      cancelPlanDraw();
      return;
    }

    if (event.kind === 'undo_last_segment') {
      undoLastDrawSegment();
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
      setActiveDrawNodeId(resolveActiveDrawNodeId(next));
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

    if (event.kind === 'component_select' && event.componentId) {
      setSelectedComponentId(event.componentId);
      setSelectedSegmentId(null);
      setSelectedNodeId(null);
      setSelectedOpeningId(null);
      setSelectedObjectType('structural_frame_system');
      return;
    }

    if (event.kind === 'component_delete' && event.componentId) {
      if (event.phase !== 'commit') return;
      void confirmDeletePlacedComponent(event.componentId);
      return;
    }

    if (event.kind === 'component_move' && event.componentId && event.planX != null && event.planZ != null) {
      const point = snapPlanPoint(event.planX, event.planZ, snapLayout, moduleLength);
      if (event.phase === 'preview') {
        setDraftPlanEnd(point);
        return;
      }
      const now = new Date().toISOString();
      setPlacedComponents((current) => {
        const target = current.find((component) => component.id === event.componentId);
        if (!target) return current;
        const relatedIds = new Set(target.references?.connectedComponentIds ?? []);
        return current.map((component) => {
          const isTarget = component.id === event.componentId;
          const isRelatedFooter =
            component.type === 'footer' &&
            (component.references?.hostId === event.componentId || relatedIds.has(component.id));
          if (!isTarget && !isRelatedFooter) return component;
          return {
            ...component,
            viewPlacement: {
              ...component.viewPlacement,
              plan: {
                ...(component.viewPlacement.plan ?? {}),
                xMeters: point.x,
                zMeters: point.z,
              },
            },
            metadata: {
              ...component.metadata,
              updatedAt: now,
            },
          };
        });
      });
      setDraftPlanEnd(null);
      setSelectedComponentId(event.componentId);
      setSaveState('unsaved');
      setChangedAfterCommit(true);
      setStatus({ tone: 'success', message: 'Column moved.' });
      return;
    }

    if (event.kind === 'select_node' && event.nodeId) {
      setSelectedNodeId(event.nodeId);
      setSelectedSegmentId(null);
      setSelectedOpeningId(null);
      setSelectedComponentId(null);
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
        setSelectedComponentId(null);
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
      setSelectedComponentId(null);
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
        if (toolMode === 'place_component') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          cancelComponentPlacement();
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
        if (selectedSegmentId || selectedNodeId || selectedOpeningId || selectedComponentId || selectedObjectType) {
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
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedComponentId) {
        event.preventDefault();
        void confirmDeletePlacedComponent(selectedComponentId);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [modelLoaded, selectedComponentId, selectedObjectType, selectedOpeningId, selectedNodeId, selectedSegmentId, toolMode, placementPreview, wallLayout]);

  const handleViewerInteraction = (event: DesignBuilderInteractionEvent) => {
      if (!modelLoaded) return;
      const wall = resolvedPreset.wall;

      switch (event.kind) {
        case 'cancel':
          if (toolMode === 'place_component') {
            cancelComponentPlacement();
            break;
          }
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
            const legacyOffsetMove = !hitPoint && !event.wallSegmentId && event.wallFace && event.offsetMeters != null;
            const resolved = legacyOffsetMove
              ? null
              : hitPoint && event.wallSegmentId
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
            const patched = legacyOffsetMove
              ? {
                  ...opening,
                  wallFace: event.wallFace,
                  offsetMeters: event.offsetMeters,
                  wallSegmentId: undefined,
                  positionAlongSegment: undefined,
                  placementUsesCenterStation: undefined,
                }
              : resolved
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
    if (!preset) return;
    if (!persistenceContext.canPersist) {
      setStatus({ tone: 'info', message: persistenceStatusMessage('standalone_demo') });
      return;
    }
    try {
      validateDesignBuilderPersistenceContext(persistenceContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Design Builder must be opened from a saved project estimate.';
      setStatus({ tone: 'error', message });
      return;
    }
    setBusy(true);
    setSaveState('saving');
    setLastSaveError(null);
    setStatus({ tone: 'info', message: 'Saving design...' });
    try {
      let activeModel = designModel;
      if (!activeModel) {
        const modelResult = await createDesignModel({
          projectId,
          estimateId,
          name: preset.name,
          unitSystem: 'metric',
          createdBy: persistenceContext.userId!,
          metadata: {
            source: 'parametric_design_builder',
          },
        });
        if (modelResult.error || !modelResult.data) {
          throw new Error(modelResult.error ?? 'Could not create design model.');
        }
        activeModel = modelResult.data;
        setDesignModel(activeModel);
      }

      const syncedPreset = syncPresetFromLayout(preset, preset.wallLayout);
      const metadata = designModelMetadataWithPersistedState(activeModel, syncedPreset, {
        activeView: viewMode,
        active2DView,
        elevationView,
        roofDisplayMode,
        foundationViewMode,
        visualStyle,
        materialSelections,
      }, placedComponents, annotations);
      const metadataResult = await updateDesignModelMetadata(activeModel.id, metadata);
      if (metadataResult.error || !metadataResult.data) {
        throw new Error(metadataResult.error ?? 'Could not save design metadata.');
      }
      activeModel = metadataResult.data;
      setDesignModel(activeModel);

      const byKey = new Map(
        objects.map((object) => [objectSaveKey(object.objectType, object.parameters as { kind?: string }), object.id]),
      );
      const payload = buildPresetObjects({
        designModelId: activeModel.id,
        projectId,
        preset: syncedPreset,
        includeStableIds: false,
      }).map((input) => ({
        ...input,
        ...(byKey.get(objectSaveKey(input.objectType, input.parameters as { kind?: string }))
          ? { id: byKey.get(objectSaveKey(input.objectType, input.parameters as { kind?: string })) }
          : {}),
      }));
      if (payload.length === 0) {
        throw new Error('No design objects available to save.');
      }
      const objectResult = await upsertDesignModelObjects(payload);
      if (objectResult.error || !objectResult.data) {
        throw new Error(objectResult.error ?? 'Could not save design objects.');
      }
      setObjects(objectResult.data);
      setSaveState('saved');
      setLastSaveTime(new Date().toISOString());
      setStatus({ tone: 'success', message: DESIGN_BUILDER_COPY.status.designSaved });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save design.';
      setLastSaveError(message);
      setSaveState('failed');
      setStatus({ tone: 'error', message: DESIGN_BUILDER_COPY.status.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  function handleApplyMaterialSelections(payload: MaterialsColorsApplyPayload) {
    const normalized = normalizeDesignMaterialSelection(payload.selections);
    setMaterialSelections(normalized);
    const nextPlasterFinish = finishForPlasterMaterialId(normalized.plasterMaterialId);
    if (
      resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' &&
      nextPlasterFinish &&
      normalizeCmuInfillSystem(resolvedPreset.infillSystem).plaster.finish !== nextPlasterFinish
    ) {
      applyPresetPatch(
        (current) => {
          const infillSystem = normalizeCmuInfillSystem(current.infillSystem);
          return {
            ...current,
            infillSystem: {
              ...infillSystem,
              plaster: {
                ...infillSystem.plaster,
                finish: nextPlasterFinish,
              },
            },
          };
        },
        'Edit plaster finish',
        'masonry_settings_update',
      );
    }
    if (payload.floorTileFinish) {
      applyPresetPatch(
        (current) => ({
          ...current,
          foundationSettings: {
            ...normalizeRcFrameFoundationSettings(current.foundationSettings),
            floorTileFinish: payload.floorTileFinish!,
          },
        }),
        'Edit floor tile finish',
        'masonry_settings_update',
      );
    }
    if (payload.plywoodCeiling) {
      applyPresetPatch(
        (current) => ({
          ...current,
          foundationSettings: {
            ...normalizeRcFrameFoundationSettings(current.foundationSettings),
            plywoodCeiling: payload.plywoodCeiling!,
          },
        }),
        'Edit plywood ceiling',
        'masonry_settings_update',
      );
    }
    void setActiveMaterialSelections(normalized).then(() => {
      setMaterialRevision((revision) => revision + 1);
    });
    setMaterialsModal((current) => ({ ...current, open: false }));
    if (persistenceContext.canPersist) {
      setSaveState('unsaved');
    }
    setStatus({ tone: 'success', message: 'Material selections applied.' });
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
          return syncPresetFromLayout({ ...current, wall: nextWall, wallLayout: nextLayout,
            ...(typeof patch.heightMeters === 'number' &&
            current.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'
              ? {
                  foundationSettings: syncColumnHeightAbovePlinthForWallHeight({
                    foundation: current.foundationSettings,
                    wallHeightMeters: patch.heightMeters,
                  }),
                }
              : {}),
          }, nextLayout);
        });
      },
    });

    if (import.meta.env.DEV && options?.changedSetting) {
      const nextWall = syncWallBlockModuleFromScalars({ ...previousWall, ...patch });
      const nextLayoutForGeometry =
        Object.keys(layoutPatch).length > 0 && !selectedSegmentId
          ? applyProjectMasonryDefaultsToLayout(wallLayout, layoutPatch)
          : wallLayout;
      const nextGeometry = resolveDesignBuilderGeometryPipeline({
        wallLayout: nextLayoutForGeometry,
        effectiveWall: nextWall,
        resolvedPreset: {
          ...resolvedPreset,
          wall: nextWall,
          wallLayout: nextLayoutForGeometry,
        },
        footprintClosed: canGenerateSlabAndRoof(nextLayoutForGeometry),
        activeRoofSystem,
        manualMasonryRuns,
      }).designGeometryResult;
      logMasonrySettingsCommit({
        changedSetting: options.changedSetting,
        previousValue: options.previousValue,
        nextValue: patch[options.changedSetting as keyof typeof patch],
        geometryKey: buildMasonryGeometryKey({
          wallLayout: nextLayoutForGeometry,
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

  function updateInfillPlaster(patch: Partial<CmuInfillPlasterSettings>) {
    const currentPlaster = normalizeCmuInfillSystem(resolvedPreset.infillSystem).plaster;
    const nextPlaster = normalizeCmuInfillPlasterSettings({ ...currentPlaster, ...patch });
    applyPresetPatch(
      (current) => ({
        ...current,
        infillSystem: {
          ...normalizeCmuInfillSystem(current.infillSystem),
          plaster: nextPlaster,
        },
      }),
      'Edit plaster finish',
      'masonry_settings_update',
    );
    if (patch.finish) {
      const nextSelections = normalizeDesignMaterialSelection({
        ...materialSelections,
        plasterMaterialId: plasterMaterialIdForFinish(patch.finish),
      });
      setMaterialSelections(nextSelections);
      void setActiveMaterialSelections(nextSelections).then(() => {
        setMaterialRevision((revision) => revision + 1);
      });
    }
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
      (current) => {
        const roofSystem = normalizeRoofSystemSettings(current.roofSystem ?? createDefaultRoofSystemSettings());
        const spacingMeters = positiveOrFallback(
          value,
          roofSystem.steelTrusses.maxSpacingMeters || current.truss.spacingMeters,
        );
        return {
          ...current,
          truss: { ...current.truss, spacingMeters },
          roofSystem: {
            ...roofSystem,
            steelTrusses: {
              ...roofSystem.steelTrusses,
              maxSpacingMeters: spacingMeters,
            },
          },
        };
      },
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

  type FoundationSettingsSection = 'plinthBeam' | 'roofBeam' | 'tieBeam' | 'columns' | 'isolatedFootings';

  function updateFoundationField(
    patch: Partial<RcFrameFoundationSettings[FoundationSettingsSection]>,
    section: FoundationSettingsSection,
  ) {
    applyPresetPatch(
      (current) => {
        const currentFoundation = normalizeRcFrameFoundationSettings(current.foundationSettings);
        return applyAutoFrameLayout({
          ...current,
          foundationSettings: {
            ...currentFoundation,
            [section]: {
              ...currentFoundation[section],
              ...patch,
            },
          },
        });
      },
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
    setSelectedComponentId(null);
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
    const shellComplete =
      wallLayout.isFootprintClosed || detectClosedFootprint(wallLayout);
    if (shellComplete && wallLayout.segments.length > 0) {
      setActiveDrawNodeId(null);
      setDrawStartNodeId(null);
      setDraftPlanEnd(null);
      setDraftSnapTarget(null);
      setDrawWallConstraintLabel(null);
      setDrawWallPreviewMetrics(null);
      setOrthogonalClosureAssist(null);
      setClosureCornerSnap(null);
      lastSnapTargetRef.current = null;
      setSegmentLengthInput('');
    }
    setToolMode('draw_wall');
    setActive2DDrawingView('foundation-plan');
  }

  function activateToolMode(mode: DesignBuilderToolMode) {
    closeDesignBuilderCommandMenus();
    if (mode === 'draw_wall') {
      activateDrawWallTool();
      return;
    }
    setToolMode(mode);
    if (mode === 'place_dimension' && (viewMode !== '2d' || active2DView === 'elevation-view')) {
      setActive2DDrawingView('foundation-plan');
    }
    if (mode === 'move_wall_node') setActive2DDrawingView('foundation-plan');
    if (mode === 'select') setPlacementPreview(null);
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
    const blankGeometry = resolveDesignBuilderGeometryPipeline({
      wallLayout: blankLayout,
      effectiveWall: { ...committedBlankPreset.wall, openings: [] },
      resolvedPreset: committedBlankPreset,
      footprintClosed: false,
      activeRoofSystem: normalizeRoofSystemSettings(committedBlankPreset.roofSystem),
      manualMasonryRuns: [],
    }).designGeometryResult;
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
    setPlacedComponents([]);
    setAnnotations([]);
    setSelectedComponentId(null);
    dispatchComponentPlacement({ type: 'reset', activeView: 'plan' });
    setPersistedQuantityItems([]);
    setChangedAfterCommit((current) => current || persistedQuantityItems.some((item) => item.estimateLineId));
    setDesignHistory(createDesignHistoryState());
    recordDesignHistoryCommand('New layout', 'layout_reset', before, after);
    finalizeMutationAfterCommand();
    setToolMode('select');
    setViewMode('2d');
    setActive2DView('foundation-plan');
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
      placedComponents: [],
      previewLines: [],
      persistedQuantityItems: [],
      toolMode: 'select',
      viewMode: '2d',
      active2DView: 'foundation-plan',
      elevationView: { face: 'north' },
      objectTreeExpanded: DEFAULT_OBJECT_TREE_EXPANSION,
      camera: null,
    });
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

  const activeToolLabel = toolMode === 'place_component'
    ? componentPlacement.activeComponentDefinition?.displayName ?? 'Place Component'
    : toolMode === 'place_door'
      ? 'Place Door'
      : toolMode === 'place_window'
        ? 'Place Window'
    : TOOL_MODE_OPTIONS.find((option) => option.mode === toolMode)?.label ?? 'Select';
  const activeBuildingSystemMode = resolvedPreset.buildingSystemMode;
  const isFrameStructureMode = activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill';
  const structureMenuLabel = 'Settings';
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
      : toolMode === 'place_component'
        ? `${componentPlacement.activeComponentDefinition?.displayName ?? 'Component'} placement - Click canvas to place - Esc cancels`
        : toolMode === 'move_wall_node'
        ? 'Drag node - Esc exits'
        : toolMode === 'move_opening'
          ? 'Drag selected opening along wall segment'
          : null;
  const activeOpeningTool = toolMode === 'place_door' ? 'door' : toolMode === 'place_window' ? 'window' : null;
  const activeOpeningSettings = activeOpeningTool ? openingToolSettings[activeOpeningTool] : null;
  const closeFootprintEnabled = modelLoaded && !footprintClosed && wallLayout.segments.length >= 3;

  return (
    <>
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
                      {opening.wallSegmentId ? ` - segment` : opening.wallFace ? ` - ${opening.wallFace}` : ''}
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
              onInfillPlasterChange={updateInfillPlaster}
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
                label={<>{activeToolLabel}</>}
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

              <DesignBuilderCommandMenu
                menuKind="components"
                label={<>Components</>}
                isActive={toolMode === 'place_component' || toolMode === 'place_door' || toolMode === 'place_window'}
                panelClassName="w-56 p-2"
                summaryClassName={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
                  toolMode === 'place_component' || toolMode === 'place_door' || toolMode === 'place_window'
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {componentDefinitionGroups.map((group) => (
                  <div key={group.division} className="py-1">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {group.division}
                    </div>
                    {group.definitions.map((definition) => (
                      <CommandMenuAction
                        key={definition.type}
                        onClick={() => activateDesignComponent(definition.type)}
                        disabled={!modelLoaded}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                          componentPlacement.activeComponentType === definition.type ||
                          (definition.type === 'door' && toolMode === 'place_door') ||
                          (definition.type === 'window' && toolMode === 'place_window')
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {definition.displayName}
                      </CommandMenuAction>
                    ))}
                  </div>
                ))}
              </DesignBuilderCommandMenu>

              <div
                role="group"
                aria-label="Switch Design Builder view"
                className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                {([
                  ['2d', '2D'],
                  ['3d', '3D'],
                ] as Array<[DesignBuilderViewMode, string]>).map(([mode, label], index) => (
                  <button
                    key={mode}
                    type="button"
                    aria-label={`Switch to ${label} view`}
                    aria-pressed={viewMode === mode}
                    onClick={() => setDesignBuilderViewMode(mode)}
                    className={`${index === 0 ? '' : 'border-l border-slate-200 dark:border-slate-700'} px-3 text-xs font-semibold transition ${
                      viewMode === mode
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {viewMode === '2d' ? (
                <div
                  role="group"
                  aria-label="Switch 2D drawing view"
                  className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  {([
                    ['foundation-plan', 'Foundation'],
                    ['roof-plan', 'Roof'],
                    ['electrical-plan', 'Electrical'],
                    ['plumbing-plan', 'Plumbing'],
                    ['elevation-view', 'Elevation'],
                  ] as Array<[Design2DViewType, string]>).map(([drawingView, label], index) => (
                    <button
                      key={drawingView}
                      type="button"
                      aria-label={`Switch to ${label} drawing`}
                      aria-pressed={active2DView === drawingView}
                      onClick={() => setActive2DDrawingView(drawingView)}
                      className={`${index === 0 ? '' : 'border-l border-slate-200 dark:border-slate-700'} px-3 text-xs font-semibold transition ${
                        active2DView === drawingView
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <DesignBuilderCommandMenu
                menuKind="structure"
                label={<>{structureMenuLabel}</>}
                panelClassName="w-56"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-cyan-400 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100"
              >
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">System</div>
                <CommandMenuAction
                  onClick={() => handleSetBuildingSystemMode('reinforced_concrete_frame_with_cmu_infill')}
                  aria-pressed={activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                    activeBuildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  RC Structure
                </CommandMenuAction>
                <details className="px-1 py-1">
                  <summary className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    Advanced
                  </summary>
                  <CommandMenuAction
                    onClick={() => handleSetBuildingSystemMode('cmu_bearing_wall')}
                    aria-pressed={activeBuildingSystemMode === 'cmu_bearing_wall'}
                    className={`mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                      activeBuildingSystemMode === 'cmu_bearing_wall'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    CMU Bearing Wall
                  </CommandMenuAction>
                </details>
                {isFrameStructureMode ? (
                  <>
                    <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                    <CommandMenuAction
                      onClick={() => setFrameFoundationModalOpen(true)}
                      disabled={!modelLoaded || !footprintClosed}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      RC Settings
                    </CommandMenuAction>
                  </>
                ) : null}
              </DesignBuilderCommandMenu>

              <DesignBuilderCommandMenu
                menuKind="snap"
                label={<>Snap: {snapMode === 'cmu_module' ? 'CMU' : snapMode === 'grid' ? 'Grid' : 'Off'}</>}
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
                label={<>View</>}
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
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
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

              <DesignBuilderCommandMenu
                menuKind="display"
                label={<>Display</>}
                closeOnSelect={false}
                panelClassName="w-64 max-h-[min(70vh,520px)] space-y-1 overflow-y-auto p-3 text-xs"
                summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                  <DisplayMenuCollapsibleSection id="display-wall-overlays" title="Wall Overlays">
                    <ToggleField label="Show opening layout" checked={showOpeningLayout} onChange={setShowOpeningLayout} />
                    <ToggleField
                      label="Show Grout / Reinforced Cells"
                      title="Shows only calculated CMU core fills, bond-beam cells, and valid closure voids. Does not represent the rough opening itself."
                      checked={showGroutCells}
                      onChange={setShowGroutCells}
                    />
                    <ToggleField label="Show Cut-Block Conditions" checked={showClosureWarnings} onChange={setShowClosureWarnings} />
                  </DisplayMenuCollapsibleSection>
                  <DisplayMenuCollapsibleSection id="display-visual-style" title="Visual Style">
                    {(
                      [
                        ['technical', 'Technical'],
                        ['material_preview', 'Material Preview'],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="radio"
                          name="design-visual-style"
                          checked={visualStyle === mode}
                          onChange={() => setVisualStyle(mode)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <CommandMenuAction
                      onClick={() => setMaterialsModal({ open: true, scope: 'all' })}
                      className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Materials &amp; Colors
                    </CommandMenuAction>
                  </DisplayMenuCollapsibleSection>
                  <DisplayMenuCollapsibleSection id="display-2d-drawing" title="2D Drawing">
                    {(
                      [
                        ['architectural', 'Architectural'],
                        ['builder', 'Builder'],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="radio"
                          name="design-2d-drawing-style"
                          checked={twoDDrawingStyle === mode}
                          onChange={() => setTwoDDrawingStyle(mode)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </DisplayMenuCollapsibleSection>
                  {import.meta.env.DEV && resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
                    <DisplayMenuCollapsibleSection id="display-debug" title="Debug">
                      <ToggleField
                        label="Show Roof Reference Perimeters"
                        checked={showRoofReferencePerimeters}
                        onChange={setShowRoofReferencePerimeters}
                      />
                      <ToggleField
                        label="Show Roof Layer Contacts"
                        checked={showRoofFramingGuides}
                        onChange={setShowRoofFramingGuides}
                      />
                    </DisplayMenuCollapsibleSection>
                  ) : null}
                  {resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
                    <>
                      <DisplayMenuCollapsibleSection id="display-roof-plan" title="Roof Plan">
                        <ToggleField label="Show Roof Hatch" checked={showRoofPlanHatch} onChange={setShowRoofPlanHatch} />
                        <ToggleField label="Show Roof Slope Arrows" checked={showRoofPlanSlopeArrows} onChange={setShowRoofPlanSlopeArrows} />
                        <ToggleField label="Show Roof Dimensions" checked={showRoofPlanDimensions} onChange={setShowRoofPlanDimensions} />
                        <ToggleField label="Show Roof Reference Lines" checked={showRoofPlanReferenceLines} onChange={setShowRoofPlanReferenceLines} />
                      </DisplayMenuCollapsibleSection>
                      <DisplayMenuCollapsibleSection id="display-foundation-view" title="Foundation View">
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
                      </DisplayMenuCollapsibleSection>
                      <DisplayMenuCollapsibleSection id="display-roof-display" title="Roof Display">
                        {(
                          [
                            ['full_roof', 'Full Roof'],
                            ['roof_cladding_only', 'Roof Cladding Only'],
                            ['steel_framing_only', 'Steel Framing Only'],
                            ['gable_masonry_only', 'Gable Masonry Only'],
                            ['foundation_frame_roof', 'Foundation + Frame + Roof'],
                          ] as const
                        ).map(([mode, label]) => (
                          <label key={mode} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <input
                              type="radio"
                              name="roof-display-mode"
                              checked={roofDisplayMode === mode}
                              onChange={() => setRoofDisplayMode(mode)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </DisplayMenuCollapsibleSection>
                      <DisplayMenuCollapsibleSection id="display-roof-layers" title="Roof Layers">
                        {(
                          [
                            ['roofCladding', 'Roof Cladding'],
                            ['ridgeCap', 'Ridge Cap'],
                            ['fascia', 'Fascia'],
                            ['soffit', 'Soffit'],
                            ['steelTrusses', 'Steel Trusses'],
                            ['purlins', 'Purlins'],
                            ['gableEndCmu', 'Gable-End CMU'],
                            ['rakedConcreteCap', 'Raked Concrete Cap'],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <input
                              type="checkbox"
                              checked={roofLayerVisibility[key] ?? DEFAULT_ROOF_LAYER_VISIBILITY[key]}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setRoofLayerVisibility((current) => ({
                                  ...current,
                                  [key]: checked,
                                }));
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </DisplayMenuCollapsibleSection>
                    </>
                  ) : null}
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

              <div className="ml-auto flex items-center gap-2">
                <DesignBuilderCommandMenu
                  menuKind="workspace-actions"
                  label={<>Actions</>}
                  panelClassName="w-48"
                  summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CommandMenuAction
                    onClick={toggleLeftPanel}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {DESIGN_BUILDER_COPY.actions.tools}
                  </CommandMenuAction>
                  <CommandMenuAction
                    onClick={toggleRightPanel}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {DESIGN_BUILDER_COPY.actions.estimate}
                  </CommandMenuAction>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <CommandMenuAction
                    onClick={() => void handleStartBlankLayout()}
                    disabled={busy}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {DESIGN_BUILDER_COPY.actions.newLayout}
                  </CommandMenuAction>
                </DesignBuilderCommandMenu>

                <button
                  type="button"
                  onClick={() => setViewCommand({ id: Date.now(), action: 'fit' })}
                  className="hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex lg:items-center"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveDesign()}
                  disabled={busy || !persistenceContext.canPersist}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  {DESIGN_BUILDER_COPY.actions.saveDesign}
                </button>
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
                    <DoorConfigurationControls
                      swingType={activeOpeningSettings.swingType ?? 'inswing'}
                      swingDirection={activeOpeningSettings.swingDirection ?? 'left'}
                      onSwingTypeChange={(swingType) =>
                        setOpeningToolSettings((current) => ({
                          ...current,
                          door: { ...current.door, swingType },
                        }))
                      }
                      onSwingDirectionChange={(swingDirection) =>
                        setOpeningToolSettings((current) => ({
                          ...current,
                          door: { ...current.door, swingDirection },
                        }))
                      }
                    />
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
                    onClick={handleDeleteSelectedComponent}
                    disabled={!selectedComponentId}
                    title={selectedComponent ? `Delete selected ${getDesignComponentDefinition(selectedComponent.type).displayName}` : 'Select a component to delete.'}
                    className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete selected component
                  </button>
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
            ref={viewerOverlayContainerRef}
            className={focusMode ? 'relative min-h-0 flex-1 overflow-hidden' : 'relative overflow-hidden'}
            style={focusMode ? undefined : { height: viewerSize.height }}
          >
            <DebugOverlayLayoutProvider containerRef={viewerOverlayContainerRef}>
            {viewMode === '2d' && active2DView !== 'elevation-view' ? (
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
                selectedComponentId={selectedComponentId}
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
                resolvedRoofSystem={designGeometryResult.resolvedRoofSystem ?? null}
                roofPlanDisplay={{
                  showHatch: showRoofPlanHatch,
                  showSlopeArrows: showRoofPlanSlopeArrows,
                  showDimensions: showRoofPlanDimensions,
                  showReferenceLines: showRoofPlanReferenceLines,
                }}
                selectedObjectType={selectedObjectType}
                drawingStyleMode={twoDDrawingStyle}
                active2DView={active2DView}
                annotations={annotations}
                placedComponents={placedComponents}
                designRenderModel={designRenderModel}
                componentPreview={componentPlacement.activeView === 'plan' ? componentPlacement.placementPreview : null}
                helperMeasurements={componentPlacement.activeView === 'plan' ? componentPlacement.helperMeasurements : []}
                onComponentPointer={handleComponentPointer}
                onAnnotationCreate={(annotation) => setAnnotations((current) => [...current, annotation])}
                onInteraction={handlePlanInteraction}
              />
            ) : viewMode === '2d' && active2DView === 'elevation-view' ? (
              <DesignBuilderElevationCanvas
                toolMode={toolMode}
                elevationView={elevationView}
                layoutBounds={designLayoutBounds}
                viewCommand={viewCommand}
                frameSystem={designGeometryResult.frameSystem}
                isolatedFootings={designGeometryResult.isolatedFootings}
                resolvedRoofSystem={designGeometryResult.resolvedRoofSystem ?? null}
                interiorFloorSlab={designGeometryResult.interiorFloorSlab ?? null}
                floorTileLayout={designGeometryResult.floorTileLayout ?? null}
                plywoodCeilingLayout={designGeometryResult.plywoodCeilingLayout ?? null}
                openings={effectiveWall.openings}
                placedComponents={placedComponents}
                designRenderModel={designRenderModel}
                drawingStyleMode={twoDDrawingStyle}
                componentPreview={componentPlacement.activeView === 'elevation' ? componentPlacement.placementPreview : null}
                helperMeasurements={componentPlacement.activeView === 'elevation' ? componentPlacement.helperMeasurements : []}
                onElevationViewChange={setElevationView}
                onComponentPointer={handleComponentPointer}
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
                placedComponents={placedComponents}
                designRenderModel={designRenderModel}
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
                showRoofReferencePerimeters={showRoofReferencePerimeters}
                showRoofFramingGuides={showRoofFramingGuides}
                foundationViewMode={foundationViewMode}
                visualStyle={visualStyle}
                roofSystem={activeRoofSystem}
                roofDisplayMode={roofDisplayMode}
                roofLayerVisibility={roofLayerVisibility}
                materialRevision={materialRevision}
              />
            )}
            {toolMode === 'place_component' && componentPlacement.activeComponentDefinition ? (
              <div
                className="absolute z-20 w-72 rounded-xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl"
                style={{ left: componentPanelPosition.x, top: componentPanelPosition.y }}
                data-component-parameter-panel="true"
              >
                <div
                  className="flex cursor-move items-center justify-between border-b border-slate-800 px-3 py-2"
                  onPointerDown={handleComponentPanelDragStart}
                >
                  <div>
                    <div className="text-xs font-bold text-cyan-200">
                      {componentPlacement.activeComponentDefinition.displayName}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {componentPlacement.activeComponentDefinition.division}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setComponentPanelCollapsed((current) => !current)}
                      className="rounded-md px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800"
                    >
                      {componentPanelCollapsed ? 'Show' : 'Min'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelComponentPlacement}
                      className="rounded-md px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                {!componentPanelCollapsed ? (
                  <div className="space-y-3 p-3">
                    {componentPlacement.activeComponentDefinition.parameterSchema.map((field) => (
                      <label key={field.key} className="block text-xs font-semibold text-slate-300">
                        <span className="mb-1 flex items-center justify-between">
                          <span>{field.label}</span>
                          {field.unit ? <span className="text-[10px] text-slate-500">{field.unit}</span> : null}
                        </span>
                        {field.kind === 'select' ? (
                          <select
                            value={String(componentPlacement.draftComponentParameters[field.key] ?? '')}
                            onChange={(event) => handleComponentParameterChange(field.key, event.target.value, field.kind)}
                            className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                          >
                            {(field.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.kind === 'number' ? 'number' : 'text'}
                            step={field.kind === 'number' ? '0.01' : undefined}
                            min={field.min}
                            value={String(componentPlacement.draftComponentParameters[field.key] ?? '')}
                            onChange={(event) => handleComponentParameterChange(field.key, event.target.value, field.kind)}
                            className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                          />
                        )}
                      </label>
                    ))}
                    {componentPlacement.placementStatus.errors.length > 0 ? (
                      <div className="rounded-lg border border-red-900 bg-red-950/50 px-2 py-1.5 text-xs font-semibold text-red-200">
                        {componentPlacement.placementStatus.errors[0]}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-[11px] font-medium text-slate-400">
                      {activeCanvasView === 'elevation'
                        ? `View: X / Z on ${elevationView.face.toUpperCase()} face`
                        : 'View: X / Y plan placement'}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {viewMode === '2d' && active2DView === 'foundation-plan' && toolMode === 'draw_wall' ? (
              <div className="pointer-events-none absolute left-3 top-12 z-10 space-y-1 rounded-xl border border-amber-400/60 bg-slate-900/95 px-3 py-2 text-xs font-medium text-amber-100 shadow-lg">
                <div>{drawWallInstruction}</div>
                {drawWallSnapFeedback ? <div className="font-semibold text-cyan-200">{drawWallSnapFeedback}</div> : null}
              </div>
            ) : null}
            {import.meta.env.DEV &&
            viewMode === '3d' &&
            showRoofReferencePerimeters &&
            resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
              <DraggableDebugOverlay
                id="roof-reference-perimeters"
                title="Roof Reference Perimeters"
                titleClassName="text-teal-300"
                className="border-teal-400/60"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-white" aria-hidden />
                  <span>Wall exterior footprint</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-teal-400" aria-hidden />
                  <span>Roof Beam structural bearing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-yellow-400" aria-hidden />
                  <span>Cladding / eave edge</span>
                </div>
                <div className="mt-2 space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
                  <div>
                    Roof Beam Outer Width:{' '}
                    {resolvedPreset.foundationSettings.roofBeam.widthMeters.toFixed(3)} m
                  </div>
                  <div>
                    Roof Beam Outer Depth:{' '}
                    {resolvedPreset.foundationSettings.roofBeam.depthMeters.toFixed(3)} m
                  </div>
                  <div>
                    Eave Overhang: {(resolvedPreset.roofSystem?.eaveOverhangMeters ?? 0).toFixed(3)} m
                  </div>
                  <div>
                    Roof Bearing Source:{' '}
                    {designGeometryResult.resolvedRoofSystem?.roofBearingSource ?? 'unknown'}
                  </div>
                </div>
              </DraggableDebugOverlay>
            ) : null}
            {import.meta.env.DEV &&
            viewMode === '3d' &&
            showRoofFramingGuides &&
            resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
              <DraggableDebugOverlay
                id="roof-framing-guides"
                title="Roof Framing Guides"
                titleClassName="text-slate-300"
                className="border-slate-500/60"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-teal-400" aria-hidden />
                  <span>Structural gable wall boundary</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-yellow-400" aria-hidden />
                  <span>Gable-end cladding edge</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-blue-500" aria-hidden />
                  <span>Purlins</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-slate-400" aria-hidden />
                  <span>Roof sheets</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-green-500" aria-hidden />
                  <span>Structural supports</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-orange-500" aria-hidden />
                  <span>Truss top chords</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-purple-500" aria-hidden />
                  <span>Truss bottom chords</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-yellow-400" aria-hidden />
                  <span>Truss web members</span>
                </div>
              </DraggableDebugOverlay>
            ) : null}
            {import.meta.env.DEV &&
            viewMode === '3d' &&
            showRoofFramingGuides &&
            resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' &&
            designGeometryResult.resolvedRoofSystem?.supported &&
            designGeometryResult.resolvedRoofSystem.roofType === 'gable' ? (
              <DraggableDebugOverlay
                id="gable-end-overhang"
                title="Gable-End Overhang"
                titleClassName="text-cyan-300"
                className="border-cyan-400/60"
              >
                {(() => {
                  const roof = designGeometryResult.resolvedRoofSystem!;
                  const purlinLength =
                    roof.purlinPlacements[0]
                      ? Math.hypot(
                          roof.purlinPlacements[0].end.x - roof.purlinPlacements[0].start.x,
                          roof.purlinPlacements[0].end.z - roof.purlinPlacements[0].start.z,
                        )
                      : 0;
                  return (
                    <div className="space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
                        <div>Structural Ridge Length: {roof.structuralRidgeLengthMeters.toFixed(3)} m</div>
                        <div>Gable-End Overhang: {roof.gableEndOverhangMeters.toFixed(3)} m</div>
                        <div>Purlin Full Length: {purlinLength.toFixed(3)} m</div>
                        <div>Roof Cladding Length: {roof.claddingRidgeLengthMeters.toFixed(3)} m</div>
                      </div>
                  );
                })()}
              </DraggableDebugOverlay>
            ) : null}
            {import.meta.env.DEV &&
            viewMode === '3d' &&
            showRoofFramingGuides &&
            resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' &&
            designGeometryResult.resolvedRoofSystem?.trussPlacements.length ? (
              <DraggableDebugOverlay
                id="truss-inspector"
                title="Truss Inspector"
                titleClassName="text-orange-300"
                className="border-orange-400/60"
              >
                {(() => {
                  const truss = designGeometryResult.resolvedRoofSystem!.trussPlacements[0]!;
                  const topLeft = truss.members.find((member) => member.memberKind === 'top_chord_left');
                  const bottom = truss.members.find((member) => member.memberKind === 'bottom_chord');
                  const webCount = truss.members.filter(
                    (member) => member.memberKind === 'diagonal_web' || member.memberKind === 'vertical_web',
                  ).length;
                  return (
                    <div className="space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
                        <div>Truss ID: {truss.id}</div>
                        <div>Station: {truss.stationMeters.toFixed(3)} m</div>
                        <div>
                          Left Bearing: ({truss.bearingLeft.x.toFixed(2)}, {truss.bearingLeft.y.toFixed(2)},{' '}
                          {truss.bearingLeft.z.toFixed(2)})
                        </div>
                        <div>
                          Right Bearing: ({truss.bearingRight.x.toFixed(2)}, {truss.bearingRight.y.toFixed(2)},{' '}
                          {truss.bearingRight.z.toFixed(2)})
                        </div>
                        <div>
                          Apex: ({truss.apex.x.toFixed(2)}, {truss.apex.y.toFixed(2)}, {truss.apex.z.toFixed(2)})
                        </div>
                        <div>
                          Top-Chord Length:{' '}
                          {topLeft
                            ? Math.hypot(
                                topLeft.end.x - topLeft.start.x,
                                topLeft.end.y - topLeft.start.y,
                                topLeft.end.z - topLeft.start.z,
                              ).toFixed(3)
                            : '—'}{' '}
                          m
                        </div>
                        <div>
                          Bottom-Chord Length:{' '}
                          {bottom
                            ? Math.hypot(
                                bottom.end.x - bottom.start.x,
                                bottom.end.y - bottom.start.y,
                                bottom.end.z - bottom.start.z,
                              ).toFixed(3)
                            : '—'}{' '}
                          m
                        </div>
                        <div>Web Member Count: {webCount}</div>
                      </div>
                  );
                })()}
              </DraggableDebugOverlay>
            ) : null}
            </DebugOverlayLayoutProvider>
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
                  {persistenceContext.canPersist
                    ? 'Draw walls or load a template, then generate an estimate preview from the current design parameters.'
                    : 'Open this tool from a saved Detailed Estimate to generate and commit estimate-ready quantities.'}
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
                    {line.quantity} {line.unit} - Division {line.divisionCode} {line.divisionName}
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
    <FrameFoundationDimensionsModal
      isOpen={frameFoundationModalOpen}
      preset={resolvedPreset}
      wallLayout={wallLayout}
      exteriorFootprint={designGeometryResult.exteriorFootprint ?? []}
      geometryRevision={designGeometryState.revision}
      lastStructureApplyRevision={lastStructureApplyRevision}
      onClose={() => {
        setStructureModalRoofDraft(null);
        setFrameFoundationModalOpen(false);
      }}
      onApply={handleApplyFrameFoundationDimensions}
      onRoofDraftChange={setStructureModalRoofDraft}
      onOpenFinishes={(scope) => setMaterialsModal({ open: true, scope })}
    />
    <MaterialsColorsModal
      isOpen={materialsModal.open}
      scope={materialsModal.scope}
      appliedSelections={materialSelections}
      appliedFloorTileFinish={
        normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings).floorTileFinish
      }
      appliedPlywoodCeiling={
        normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings).plywoodCeiling
      }
      interiorFloorSlabEnabled={
        normalizeRcFrameFoundationSettings(resolvedPreset.foundationSettings).interiorFloorSlab.enabled
      }
      interiorFacePolygon={designGeometryResult.resolvedFootprint?.interiorFacePolygon ?? []}
      floorTileLayoutPreview={designGeometryResult.floorTileLayout ?? null}
      plywoodCeilingLayoutPreview={designGeometryResult.plywoodCeilingLayout ?? null}
      maxCeilingHeightMeters={maxPlywoodCeilingHeightMeters}
      onClose={() => setMaterialsModal((current) => ({ ...current, open: false }))}
      onApply={handleApplyMaterialSelections}
    />
    </>
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
  { mode: 'place_dimension', label: 'Dimension' },
  { mode: 'draw_wall', label: 'Draw Wall' },
  { mode: 'move_wall_node', label: 'Move Node' },
  { mode: 'move_opening', label: 'Move Opening' },
  { mode: 'delete', label: 'Delete' },
];

function plasterMaterialIdForFinish(finish: CmuInfillPlasterSettings['finish']): string {
  return finish === 'smooth' ? 'smooth-3-coat-plaster' : 'textured-3-coat-plaster';
}

function finishForPlasterMaterialId(
  materialId: DesignMaterialSelection['plasterMaterialId'],
): CmuInfillPlasterSettings['finish'] | null {
  if (materialId === 'smooth-3-coat-plaster') return 'smooth';
  if (materialId === 'textured-3-coat-plaster') return 'textured';
  return null;
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
  { id: 'roof-beams', objectType: 'structural_frame_system', label: 'Roof Beams', description: '' },
  { id: 'plinth-beams', objectType: 'structural_frame_system', label: 'Plinth Beams', description: '' },
  { id: 'tie-beams', objectType: 'structural_frame_system', label: 'Tie Beams', description: '' },
  { id: 'columns', objectType: 'structural_frame_system', label: 'Columns', description: '' },
  { id: 'isolated-footings', objectType: 'structural_frame_system', label: 'Isolated Footings', description: '' },
  { id: 'infill-panels', objectType: 'cmu_infill_system', label: 'CMU Infill Panels', description: '' },
  { id: 'roof-system', objectType: 'gable_roof_system', label: 'Roof System', description: '' },
  { id: 'ridge', objectType: 'gable_roof_system', label: 'Ridge', description: '' },
  { id: 'raked-caps', objectType: 'gable_end_system', label: 'Raked Concrete Caps', description: '' },
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
    items: OBJECT_TREE_ITEMS.filter((item) => ['footprint', 'segments', 'corners', 'slab'].includes(item.id)),
  },
  {
    id: 'masonry',
    label: 'Masonry',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['cmu', 'infill-panels', 'lintels', 'bond-beams', 'grout-rebar', 'manual-runs'].includes(item.id),
    ),
  },
  {
    id: 'structure',
    label: 'Structure',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['roof-beams', 'plinth-beams', 'tie-beams', 'columns'].includes(item.id),
    ),
  },
  {
    id: 'foundation',
    label: 'Foundation',
    items: OBJECT_TREE_ITEMS.filter((item) => ['isolated-footings'].includes(item.id)),
  },
  {
    id: 'openings',
    label: 'Openings',
    items: OBJECT_TREE_ITEMS.filter((item) => ['openings'].includes(item.id)),
  },
  {
    id: 'roofGable',
    label: 'Roof',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['roof-system', 'roof-beams', 'ridge', 'gable-ends', 'raked-caps', 'trusses'].includes(item.id),
    ),
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
  onInfillPlasterChange,
  onFoundationFieldChange,
  onGableFieldChange,
  onOpeningChange,
  selectedOpeningId,
}: {
  selectedObjectType: DesignObjectType | null;
  preset: CmuBuildingPreset;
  designGeometryResult: DesignGeometryResult;
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
  onInfillPlasterChange: (patch: Partial<CmuInfillPlasterSettings>) => void;
  onFoundationFieldChange?: (
    patch: Partial<
      RcFrameFoundationSettings[
        'plinthBeam' | 'roofBeam' | 'tieBeam' | 'columns' | 'isolatedFootings'
      ]
    >,
    section: 'plinthBeam' | 'roofBeam' | 'tieBeam' | 'columns' | 'isolatedFootings',
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
            { value: 'cmu_bearing_wall', label: 'CMU Bearing Wall (advanced)' },
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use Settings, then RC Settings to edit columns, beams, footings, and roof settings.
          </p>
        ) : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Columns: {preset.frameSystem.columns.length} - Beams: {preset.frameSystem.beams.length}
        </p>
      </div>
    );
  }

  if (selectedObjectType === 'cmu_infill_system') {
    const plaster = normalizeCmuInfillSystem(preset.infillSystem).plaster;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Infill panels: {preset.infillSystem.panels.length}
        </p>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Exterior Plaster Applied</span>
          <input
            type="checkbox"
            checked={plaster.enabled}
            onChange={(event) => onInfillPlasterChange({ enabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <SelectField
          label="Exterior Finish"
          value={plaster.finish}
          onChange={(value) =>
            onInfillPlasterChange({ finish: value === 'smooth' ? 'smooth' : 'textured' })
          }
          options={[
            { value: 'textured', label: 'Textured' },
            { value: 'smooth', label: 'Smooth' },
          ]}
        />
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Interior Plaster Applied</span>
          <input
            type="checkbox"
            checked={plaster.interiorEnabled}
            onChange={(event) => onInfillPlasterChange({ interiorEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <SelectField
          label="Interior Finish"
          value={plaster.interiorFinish}
          onChange={(value) =>
            onInfillPlasterChange({ interiorFinish: value === 'textured' ? 'textured' : 'smooth' })
          }
          options={[
            { value: 'smooth', label: 'Smooth' },
            { value: 'textured', label: 'Textured' },
          ]}
        />
        {designGeometryResult.wallCmuLayout.counts ? (
          <p className="text-xs text-slate-500">
            Full {designGeometryResult.wallCmuLayout.counts.full} - Half {designGeometryResult.wallCmuLayout.counts.half} - Cut{' '}
            {designGeometryResult.wallCmuLayout.counts.cut}
          </p>
        ) : null}
      </div>
    );
  }

  if (selectedObjectType === 'gable_end_system') {
    const gable = preset.gableEndSystem.gableEnds[0];
    const resolvedRoof = designGeometryResult.resolvedRoofSystem;
    const rakedCapVolumeCubicMeters = resolvedRoof?.rakedCapVolumeCubicMeters ?? 0;
    const rakedCapLinearLengthMeters = (resolvedRoof?.gableEnds ?? [])
      .flatMap((gableEnd) => gableEnd.rakedCapPlacements)
      .reduce((sum, cap) => sum + (cap.endStationMeters - cap.startStationMeters), 0);
    const gableCmuBlockCount =
      resolvedRoof?.gableEnds.flatMap((gableEnd) => gableEnd.cmuUnitPlacements).length ?? 0;
    return (
      <div className="space-y-3">
        {resolvedRoof?.supported && resolvedRoof.roofType === 'gable' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Estimate quantities</div>
            <div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
              <div>Gable-end CMU: {gableCmuBlockCount} EA</div>
              <div>
                Raked cap concrete: {rakedCapVolumeCubicMeters.toFixed(3)} m³ (
                {cubicMetersToCubicYards(rakedCapVolumeCubicMeters).toFixed(2)} CY)
              </div>
              <div>Raked cap length: {rakedCapLinearLengthMeters.toFixed(2)} m</div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Volume is calculated from the resolved cap prism between the CMU envelope and the purlin bottom — not render-only geometry.
            </p>
          </div>
        ) : null}
        {gable ? (
          <>
            <NumberField label="Eave elevation" value={gable.eaveElevationMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { eaveElevationMeters: value })} />
            <NumberField label="Peak rise above eave" value={gable.peakRiseMeters ?? 0} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { peakRiseMeters: value, peakMode: 'rise_above_eave' })} />
            <NumberField label="Roof-to-masonry clearance" value={gable.roofToMasonryClearanceMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { roofToMasonryClearanceMeters: positiveOrFallback(value, 0.1016) })} />
          </>
        ) : (
          <p className="text-sm text-slate-500">
              Configure gable-end CMU and raked cap through Settings, then RC Settings when using a Gable Roof.
          </p>
        )}
      </div>
    );
  }

  if (selectedObjectType === 'steel_truss_system') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Spacing"
          value={preset.roofSystem.steelTrusses.maxSpacingMeters}
          suffix="m"
          onChange={onTrussSpacingChange}
        />
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
        <DoorConfigurationControls
          swingType={opening.swingType ?? 'inswing'}
          swingDirection={opening.swingDirection ?? 'left'}
          onSwingTypeChange={(swingType) => onOpeningChange(opening.id, { swingType })}
          onSwingDirectionChange={(swingDirection) => onOpeningChange(opening.id, { swingDirection })}
        />
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

function DisplayMenuCollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-slate-200 pt-1 dark:border-slate-700">
      <button
        type="button"
        id={`${id}-header`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between rounded px-1 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <span>{title}</span>
        <span aria-hidden className="text-[10px]">
          {open ? 'v' : '>'}
        </span>
      </button>
      {open ? (
        <div id={`${id}-panel`} className="space-y-1 pb-1">
          {children}
        </div>
      ) : null}
    </div>
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
  objectIds: {
    slabObjectId: string;
    wallObjectId: string;
    roofObjectId: string;
    trussObjectId: string;
    frameObjectId: string;
    infillObjectId: string;
    gableEndObjectId: string;
  },
): string {
  if (objectType === 'thickened_edge_slab') return objectIds.slabObjectId;
  if (objectType === 'gable_roof_system') return objectIds.roofObjectId;
  if (objectType === 'steel_truss_system') return objectIds.trussObjectId;
  if (objectType === 'structural_frame_system') return objectIds.frameObjectId;
  if (objectType === 'cmu_infill_system') return objectIds.infillObjectId;
  if (objectType === 'gable_end_system') return objectIds.gableEndObjectId;
  return objectIds.wallObjectId;
}

function objectTypeForPreviewLine(line: DesignEstimatePreviewLine): DesignObjectType {
  if (line.quantityType.includes('slab') || line.id.includes('slab')) return 'thickened_edge_slab';
  if (line.quantityType.includes('raked_concrete_cap') || line.quantityType.includes('gable_end')) {
    return 'gable_end_system';
  }
  if (line.quantityType.startsWith('rc_')) return 'structural_frame_system';
  if (line.quantityType.includes('infill') || line.id.startsWith('infill-')) return 'cmu_infill_system';
  if (line.quantityType.includes('truss') || line.id.includes('truss')) return 'steel_truss_system';
  if (
    line.quantityType.includes('roof') ||
    line.quantityType.includes('ridge') ||
    line.quantityType.includes('hip') ||
    line.quantityType.includes('corrugated')
  ) {
    return 'gable_roof_system';
  }
  return 'cmu_wall_system';
}

