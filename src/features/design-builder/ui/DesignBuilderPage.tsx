import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
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
import { resolveWallDrawPoint } from '../domain/wallDrawPointResolver';
import { useConfirm } from '../../../contexts/ConfirmContext';
import {
  applyOpeningSegmentPatch,
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
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import {
  canGenerateSlabAndRoof,
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
  repairFootprintToExactOrthogonalRectangle,
  validateStrictOrthogonalFootprint,
} from '../domain/wallFootprintValidation';
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
  snapLengthToCmuHalfModule,
  snapLengthToCmuModule,
  snapOpeningToCmuModule,
  validateCmuOpenings,
} from '../domain/cmuModuleRules';
import {
  buildModuleFitCandidateTable,
  nearestModularCandidate,
} from '../domain/moduleFitEngine';
import { useEstimateWorkspaceHeaderCollapse } from '../../estimating/ui/EstimateWorkspaceHeaderCollapseContext';
import {
  buildDesignEstimatePreview,
  resolveCmuOrderBlockQuantity,
} from '../quantity/designQuantityFormulas';
import {
  areaFromSquareMeters,
  volumeFromCubicMeters,
} from '../quantity/designQuantityUnits';
import { usePreferencesStore } from '../../../store';
import {
  applyFrameFoundationDimensions,
  objectSaveKey,
  setBuildingSystemMode,
  type FrameFoundationDimensionsApplyPayload,
} from '../domain/structureActions';
import { normalizeRcFrameFoundationSettings, resolveFoundationElevations, syncColumnHeightAbovePlinthForWallHeight } from '../domain/foundationElevations';
import {
  createDefaultRoofSystemSettings,
  DEFAULT_ROOF_LAYER_VISIBILITY,
  normalizeRoofSystemSettings,
  syncRoofSystemTrussSpacing,
} from '../domain/roofSystemDefaults';
import { createDesignBuilderRoofDebugSnapshot } from '../domain/designBuilderRoofDebugSnapshot';
import { normalizeCmuInfillSystem, normalizeCmuInfillPlasterSettings } from '../domain/infillPlaster';
import FrameFoundationDimensionsModal from './FrameFoundationDimensionsModal';
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
  RoofSystemSettings,
  DesignModel,
  DesignModelObject,
  DesignObjectType,
  DesignQuantityItem,
  DesignUnitSystem,
  PlacedDesignComponent,
  DesignWallSegment,
  DesignWallLayoutParameters,
  DesignWallRole,
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
  type PlanViewportState,
} from '../domain/pointerPlanMapping';
import { buildLayoutFramingKey } from '../domain/designLayoutBounds';
import { formatDrawWallSnapTargetFeedback } from '../domain/designDrawWallFeedback';
import { snapKeyboardActionForEvent, tolerancePxForPreset } from '../snapping/snapKeyboard';
import type { SnapSettings, SnapTolerancePreset } from '../snapping/snapTypes';
import DesignBuilderViewer from './DesignBuilderViewer';
import { buildDesignBuilderViewerRoofAssemblyScene } from './DesignBuilderViewerRoofAssemblyScene';
import { createDesignBuilderViewerResources } from './DesignBuilderViewerResources';
import { createDesignBuilderViewerRoofRenderDebugSnapshot } from './DesignBuilderViewerRoofRenderDebugSnapshot';
import type { DesignBuilderPlacementPreview } from './DesignBuilderOpeningPreviewScene';
import { DebugOverlayLayoutProvider } from './DebugOverlayLayoutContext';
import { DesignBuilderRcDebugOverlays } from './DesignBuilderRcDebugOverlays';
import { DesignBuilderComponentParameterPanel } from './DesignBuilderComponentParameterPanel';
import { DesignBuilderCommandBar } from './DesignBuilderCommandBar';
import { downloadJsonFile } from './downloadJsonFile';
import { DesignBuilderToolInstructionStrip } from './DesignBuilderToolInstructionStrip';
import type { DesignBuilderViewerHeightPreset } from './DesignBuilderViewMenu';
import { DesignBuilderEditableControls } from './DesignBuilderEditableControls';
import {
  DesignBuilderEstimatePanel,
  DesignBuilderLinkedQuantitiesPanel,
} from './DesignBuilderEstimatePanel';
import { positiveOrFallback } from './designBuilderFormFieldMath';
import {
  clampNumber,
  leftPanelCollapsedKey,
  maxViewerHeight,
  readBooleanStorage,
  readViewerSize,
  resolveViewerHeightPreset,
  rightPanelCollapsedKey,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  VIEWER_MIN_HEIGHT,
  writeBooleanStorage,
  writeViewerSize,
} from './DesignBuilderLayoutStorage';
import {
  finishForPlasterMaterialId,
  moduleFitStatusTone,
  OBJECT_TREE_ITEMS,
  objectIdForType,
  plasterMaterialIdForFinish,
  TOOL_MODE_OPTIONS,
} from './DesignBuilderPageMappings';
import { Panel } from './DesignBuilderPageShell';
import {
  statusClassName,
  type DesignBuilderPageStatus,
} from './DesignBuilderStatus';
import { DesignBuilderObjectTreePanel } from './DesignBuilderObjectTreePanel';
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
import {
  addEquipmentToPlumbingSystem,
  addFixtureToPlumbingSystem,
  addRunToPlumbingSystem,
  addCmuSepticTankToPlumbingSystem,
  buildPlumbingFixtureSchedule,
  buildPlumbingLegend,
  commonFittingsForPipe,
  createOrReplaceFixtureRoughInAssembly,
  createDefaultPlumbingSystem,
  createCmuSepticTankNodes,
  defaultPipeScheduleForMaterial,
  defaultStockLengthForPipe,
  ensureSanitaryDrainConnectedToDistributionBox,
  fittingsForPipe,
  reconcileAutoGeneratedPlumbingFittings,
  stockLengthOptionForPreset,
  stockLengthOptionsForMaterial,
  type PipeStockLengthKind,
  type PipeStockLengthPreset,
  fittingDefinition,
  getPlumbingFixtureDefinition,
  normalizePlumbingSystem,
  type PlumbingFittingType,
  type PlumbingFixtureRoughInAssembly,
  PLUMBING_FIXTURE_LIBRARY_ORDER,
  removeFixtureFromPlumbingSystem,
  removeRunFromPlumbingSystem,
  updateFixtureRotationInPlumbingSystem,
  validatePlumbingSystem,
  type PlumbingEquipment,
  type PlumbingFixtureType,
  type PlumbingMaterial,
  type PlumbingNode,
  type PlumbingNodeKind,
  type PlumbingPipeSchedule,
  type PlumbingPoint3D,
  type PlumbingElevationMode,
  type PlumbingRun,
  type PlumbingRunDraft,
  type PlumbingRunSystem,
  type PlumbingSelection,
  type PlumbingSystem,
  type PlumbingToolMode,
  type PlumbingValidationIssue,
  DEFAULT_PLUMBING_3D_VISIBILITY,
  normalizePlumbing3DVisibility,
  type Plumbing3DVisibility,
  type SepticTankModel,
} from '../plumbing';
import {
  findNearestPlumbingNode,
  findNearestPlumbingRunSegment,
  type PlumbingRunSegmentSnap,
} from '../plumbing/canvas2d/plumbingSnapPoints';
import { DesignBuilderSepticTankControls } from './DesignBuilderSepticTankControls';

interface DesignBuilderPageProps {
  projectId: string;
  estimateId: string | null;
  onEstimateCommitted?: () => void;
}

type ViewerHeightPreset = DesignBuilderViewerHeightPreset;
type PlumbingOverlayPanelId = 'tools' | 'schedule' | 'properties' | 'legend';
type PlumbingOverlayPosition = { x: number; y: number };
type PlumbingPrimaryAction = 'select' | 'fixture' | 'pipe' | 'connect_fixture' | 'cleanout' | 'valve' | 'stack' | 'label' | 'validate';
type PlumbingEquipmentPlacementSnap = {
  equipmentType: PlumbingEquipment['equipmentType'];
  position: PlumbingPoint3D;
  snap: PlumbingRunSegmentSnap | null;
};
type PlumbingPipeDefaults = {
  system: PlumbingRunSystem;
  diameterInches: number | null;
  material: PlumbingMaterial;
  schedule: PlumbingPipeSchedule;
  stockLengthFt: number;
  stockLengthPreset: PipeStockLengthPreset;
  stockLengthKind: PipeStockLengthKind;
  preferredFittingType: PlumbingFittingType | null;
  slopeInPerFt?: number;
  elevationMode: PlumbingElevationMode;
  labelVisible: boolean;
};

const PLUMBING_OVERLAY_DEFAULT_STYLES: Record<PlumbingOverlayPanelId, CSSProperties> = {
  tools: { left: 12, top: 52 },
  properties: { right: 12, top: 52 },
  schedule: { right: 12, bottom: 84 },
  legend: { left: 12, bottom: 16 },
};

const PLUMBING_LEGEND_ROWS = [
  {
    key: 'cold_water',
    label: 'CW',
    description: 'Cold water supply and cold-water fixture nodes.',
    stroke: '#0284c7',
    dash: undefined,
  },
  {
    key: 'hot_water',
    label: 'HW',
    description: 'Hot water supply and hot-water fixture nodes.',
    stroke: '#dc2626',
    dash: undefined,
  },
  {
    key: 'sanitary',
    label: 'SS',
    description: 'Sanitary waste line. Sanitary runs need diameter and slope.',
    stroke: '#111827',
    dash: undefined,
  },
  {
    key: 'vent',
    label: 'V',
    description: 'Vent line. Dashed in plan to distinguish from sanitary.',
    stroke: '#7c3aed',
    dash: '6 4',
  },
] as const;

const PLUMBING_PRIMARY_ACTIONS: Array<{ action: PlumbingPrimaryAction; label: string }> = [
  { action: 'select', label: 'Select' },
  { action: 'fixture', label: 'Fixture' },
  { action: 'pipe', label: 'Pipe' },
  { action: 'connect_fixture', label: 'Connect Fixture' },
];

const PLUMBING_ACTION_MENU_ITEMS: Array<{ action: PlumbingPrimaryAction; label: string }> = [
  { action: 'cleanout', label: 'Cleanout' },
  { action: 'valve', label: 'Valve' },
  { action: 'stack', label: 'Stack' },
  { action: 'validate', label: 'Validate' },
];

const PLUMBING_PIPE_SYSTEM_OPTIONS: Array<{ system: PlumbingRunSystem; mode: PlumbingToolMode; label: string }> = [
  { system: 'sanitary', mode: 'drain', label: 'Sanitary' },
  { system: 'vent', mode: 'vent', label: 'Vent' },
  { system: 'cold_water', mode: 'cold_water', label: 'Cold Water' },
  { system: 'hot_water', mode: 'hot_water', label: 'Hot Water' },
];

const PLUMBING_FIXTURE_SHORT_LABELS: Record<PlumbingFixtureType, string> = {
  toilet: 'WC',
  lavatory: 'Lav',
  shower: 'Shower',
  tub: 'Tub',
  kitchen_sink: 'KS',
  laundry_box: 'Laundry',
  floor_drain: 'FD',
  hose_bib: 'HB',
  utility_sink: 'US',
  water_heater: 'WH',
};

const PLUMBING_MATERIAL_OPTIONS: PlumbingMaterial[] = ['pvc', 'abs', 'pex', 'cpvc', 'copper', 'cast_iron', 'other'];
const PLUMBING_PIPE_SCHEDULE_OPTIONS: PlumbingPipeSchedule[] = ['SCH 40', 'SCH 80', 'N/A'];
const PLUMBING_ELEVATION_OPTIONS: PlumbingElevationMode[] = ['under_slab', 'in_wall', 'overhead', 'vertical', 'user_defined'];

function defaultPipeDefaultsForSystem(system: PlumbingRunSystem): PlumbingPipeDefaults {
  const material: PlumbingMaterial = system === 'cold_water' || system === 'hot_water' ? 'pex' : 'pvc';
  const stockDefaults = defaultStockLengthForPipe({ material, system });
  return {
    system,
    diameterInches: system === 'sanitary' ? 3 : system === 'vent' ? 2 : 0.5,
    material,
    schedule: defaultPipeScheduleForMaterial(material),
    stockLengthFt: stockDefaults.stockLengthFt,
    stockLengthPreset: stockDefaults.stockLengthPreset,
    stockLengthKind: stockDefaults.stockLengthKind,
    preferredFittingType: system === 'sanitary' || system === 'vent' ? 'wye' : 'tee',
    slopeInPerFt: system === 'sanitary' ? 0.25 : undefined,
    elevationMode: system === 'sanitary' ? 'under_slab' : 'in_wall',
    labelVisible: true,
  };
}

const PLUMBING_SHIFT_SNAP_ANGLES_DEGREES = Array.from(
  new Set([
    ...Array.from({ length: 16 }, (_, index) => index * 22.5),
    ...Array.from({ length: 12 }, (_, index) => index * 30),
  ]),
).sort((a, b) => a - b);

function angularDistanceDegrees(a: number, b: number): number {
  const diff = Math.abs(((a - b + 180) % 360) - 180);
  return diff > 180 ? 360 - diff : diff;
}

function constrainPlumbingPointToShiftAngles(
  base: PlumbingPoint3D,
  target: PlumbingPoint3D,
): PlumbingPoint3D {
  const dx = target.x - base.x;
  const dz = target.z - base.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.0001) return target;
  const angleDegrees = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
  const nearest = PLUMBING_SHIFT_SNAP_ANGLES_DEGREES.reduce((best, candidate) =>
    angularDistanceDegrees(candidate, angleDegrees) < angularDistanceDegrees(best, angleDegrees) ? candidate : best,
  );
  const radians = (nearest * Math.PI) / 180;
  return {
    x: base.x + Math.cos(radians) * length,
    y: target.y,
    z: base.z + Math.sin(radians) * length,
  };
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
  const [plumbingSystem, setPlumbingSystem] = useState<PlumbingSystem>(
    () => normalizePlumbingSystem(storedSession?.plumbingSystem ?? createDefaultPlumbingSystem()),
  );
  const [activePlumbingFixtureType, setActivePlumbingFixtureType] = useState<PlumbingFixtureType>('toilet');
  const [activePlumbingToolMode, setActivePlumbingToolMode] = useState<PlumbingToolMode>('fixture');
  const [plumbingPipeDefaults, setPlumbingPipeDefaults] = useState<PlumbingPipeDefaults>(() =>
    defaultPipeDefaultsForSystem('sanitary'),
  );
  const [plumbingFixtureRotationRad, setPlumbingFixtureRotationRad] = useState(0);
  const [plumbingRunDraft, setPlumbingRunDraft] = useState<PlumbingRunDraft | null>(null);
  const [plumbingEquipmentPreview, setPlumbingEquipmentPreview] = useState<PlumbingEquipment | null>(null);
  const [plumbingLegendExpanded, setPlumbingLegendExpanded] = useState(false);
  const [plumbingFixtureScheduleExpanded, setPlumbingFixtureScheduleExpanded] = useState(true);
  const [selectedPlumbingObject, setSelectedPlumbingObject] = useState<PlumbingSelection | null>(null);
  const [plumbingValidationIssues, setPlumbingValidationIssues] = useState<PlumbingValidationIssue[]>([]);
  const [septicTankPlacementActive, setSepticTankPlacementActive] = useState(false);
  const [septicTankPlacementRotationRad, setSepticTankPlacementRotationRad] = useState(0);
  const [selectedSepticTankId, setSelectedSepticTankId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<DesignAnnotation[]>(
    () => storedSession?.annotations ?? [],
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
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
  const [status, setStatus] = useState<DesignBuilderPageStatus>(() => ({
    tone: 'info',
    message: persistenceStatusMessage(persistenceContext.mode),
  }));
  const [, setSaveState] = useState<DesignBuilderSaveState>('unsaved');
  const [, setLastSaveTime] = useState<string | null>(null);
  const [, setLastSaveError] = useState<string | null>(null);
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
  const [showRoofDebug, setShowRoofDebug] = useState(false);
  const [showRoofPlanHatch, setShowRoofPlanHatch] = useState(true);
  const [showRoofPlanSlopeArrows, setShowRoofPlanSlopeArrows] = useState(true);
  const [showRoofPlanDimensions, setShowRoofPlanDimensions] = useState(true);
  const [showRoofPlanReferenceLines, setShowRoofPlanReferenceLines] = useState(true);
  const [showRoofPlanTrussReferenceSheet, setShowRoofPlanTrussReferenceSheet] = useState(true);
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
  const [plumbing3DVisibility, setPlumbing3DVisibility] = useState<Plumbing3DVisibility>(
    DEFAULT_PLUMBING_3D_VISIBILITY,
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
  const [plumbingOverlayPositions, setPlumbingOverlayPositions] = useState<Partial<Record<PlumbingOverlayPanelId, PlumbingOverlayPosition>>>({});
  const [activePlumbingOverlayId, setActivePlumbingOverlayId] = useState<PlumbingOverlayPanelId | null>(null);

  const [snapMode, setSnapMode] = useState<DesignBuilderSnapMode>(() => storedSession?.snapMode ?? 'grid');
  const [moduleFitMode, setModuleFitMode] = useState<ModuleFitMode>(() => storedSession?.moduleFitMode ?? 'exact');
  const [objectSnapEnabled, setObjectSnapEnabled] = useState(true);
  const [endpointSnapEnabled, setEndpointSnapEnabled] = useState(true);
  const [midpointSnapEnabled, setMidpointSnapEnabled] = useState(true);
  const [intersectionSnapEnabled, setIntersectionSnapEnabled] = useState(true);
  const [nearestSnapEnabled, setNearestSnapEnabled] = useState(false);
  const [perpendicularSnapEnabled, setPerpendicularSnapEnabled] = useState(true);
  const [polarTrackingEnabled, setPolarTrackingEnabled] = useState(true);
  const [snapTolerancePreset, setSnapTolerancePreset] = useState<SnapTolerancePreset>('normal');
  const [snapCycleIndex, setSnapCycleIndex] = useState(0);
  const [horizontalSnapLock, setHorizontalSnapLock] = useState(false);
  const [verticalSnapLock, setVerticalSnapLock] = useState(false);
  const [designHistory, setDesignHistory] = useState<DesignHistoryState>(() => createDesignHistoryState());
  const [activeDrawNodeId, setActiveDrawNodeId] = useState<string | null>(null);
  const [drawStartNodeId, setDrawStartNodeId] = useState<string | null>(null);
  const [draftPlanEnd, setDraftPlanEnd] = useState<{ x: number; z: number } | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');
  const [drawWallRole, setDrawWallRole] = useState<DesignWallRole>('exterior');
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
      setSelectedAnnotationId(null);
      setSelectedComponentId(null);
      setSelectedSepticTankId(null);
      setSepticTankPlacementActive(false);
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
        setPlumbingSystem(normalizePlumbingSystem(persistedState?.plumbingSystem ?? createDefaultPlumbingSystem()));
        setAnnotations(persistedState?.annotations ?? []);
        setSelectedComponentId(null);
        setSelectedSepticTankId(null);
        setSepticTankPlacementActive(false);
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
        setPlumbing3DVisibility(
          normalizePlumbing3DVisibility(persistedState?.displayPreferences?.plumbing3DVisibility),
        );
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
      plumbingSystem,
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
    plumbingSystem,
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
  const strictFootprintWarnings = useMemo(() => validateStrictOrthogonalFootprint(wallLayout), [wallLayout]);
  const repairableOrthogonalFootprint = useMemo(
    () => (strictFootprintWarnings.length > 0 ? repairFootprintToExactOrthogonalRectangle(wallLayout) : null),
    [strictFootprintWarnings.length, wallLayout],
  );
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
    setSelectedAnnotationId(null);
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

  function plumbingOverlayStyle(panelId: PlumbingOverlayPanelId): CSSProperties {
    const position = plumbingOverlayPositions[panelId];
    return {
      ...(position ? { left: position.x, top: position.y } : PLUMBING_OVERLAY_DEFAULT_STYLES[panelId]),
      zIndex: activePlumbingOverlayId === panelId ? 30 : 10,
    };
  }

  function handlePlumbingOverlayDragStart(panelId: PlumbingOverlayPanelId, event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement | null)?.closest('button,input,select,textarea,label')) return;
    const panel = event.currentTarget.closest('[data-plumbing-overlay-panel="true"]') as HTMLDivElement | null;
    const container = viewerOverlayContainerRef.current;
    if (!panel || !container) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const origin = plumbingOverlayPositions[panelId] ?? {
      x: panelRect.left - containerRect.left,
      y: panelRect.top - containerRect.top,
    };
    const maxX = Math.max(8, containerRect.width - panelRect.width - 8);
    const maxY = Math.max(8, containerRect.height - panelRect.height - 8);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    setActivePlumbingOverlayId(panelId);
    setPlumbingOverlayPositions((current) => ({ ...current, [panelId]: origin }));
    const handleMove = (moveEvent: PointerEvent) => {
      const nextX = Math.min(maxX, Math.max(8, origin.x + moveEvent.clientX - start.x));
      const nextY = Math.min(maxY, Math.max(8, origin.y + moveEvent.clientY - start.y));
      setPlumbingOverlayPositions((current) => ({ ...current, [panelId]: { x: nextX, y: nextY } }));
    };
    const cleanup = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      setActivePlumbingOverlayId(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
  }

  const cmuLayout = designGeometryResult.wallCmuLayout;
  const manualMasonrySummary = useMemo(() => summarizeManualMasonryRuns(manualMasonryRuns), [manualMasonryRuns]);
  const moduleWarnings = useMemo(
    () => [
      ...new Set([
        ...designGeometryResult.wallCmuLayout.warnings,
        ...validateCmuOpenings(effectiveWall),
        ...strictFootprintWarnings.map((warning) => warning.message),
      ]),
    ],
    [designGeometryResult.wallCmuLayout.warnings, effectiveWall, strictFootprintWarnings],
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

  const selectedWallSegment = selectedSegmentId
    ? wallLayout.segments.find((segment) => segment.id === selectedSegmentId) ?? null
    : null;
  const selectedComponent = selectedComponentId
    ? placedComponents.find((component) => component.id === selectedComponentId) ?? null
    : null;
  const selectedSepticTank = selectedSepticTankId
    ? plumbingSystem.septicTanks.find((tank) => tank.id === selectedSepticTankId) ?? null
    : null;
  const selectedObjectLabel = selectedSegmentId
    ? 'Wall Segment'
    : selectedSepticTank
      ? 'CMU Septic Tank'
    : selectedObjectType
      ? OBJECT_TREE_ITEMS.find((item) => item.objectType === selectedObjectType)?.label ?? 'Selected object'
      : 'Project Masonry Defaults';
  const linkedPreviewLines = selectedObjectType
    ? generatedPreview.filter((line) => line.designObjectId === objectIdForType(selectedObjectType, objectIds))
    : [];
  const activeSelection: DesignBuilderSelection = selectedSegmentId
    ? { kind: 'wall_segment', id: selectedSegmentId }
    : selectedNodeId
      ? { kind: 'wall_node', id: selectedNodeId }
      : selectedOpeningId
        ? { kind: 'opening', id: selectedOpeningId }
        : { kind: 'none' };

  function toggleObjectTreeGroup(groupId: string) {
    setObjectTreeExpanded((current) => ({
      ...current,
      [groupId]: !(current[groupId as keyof ObjectTreeExpansionState] ?? false),
    }));
  }

  function selectObjectTreeObjectType(objectType: DesignObjectType) {
    setSelectedAnnotationId(null);
    setSelectedObjectType(objectType);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedSepticTankId(null);
    setPlacementPreview(null);
    if (objectType !== 'door_opening' && objectType !== 'window_opening') {
      setSelectedOpeningId(null);
    }
  }

  function selectObjectTreeSegment(segmentId: string) {
    setSelectedAnnotationId(null);
    setSelectedSegmentId(segmentId);
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedNodeId(null);
    setSelectedSepticTankId(null);
    setPlacementPreview(null);
  }

  function selectObjectTreeOpening(openingId: string, objectType: 'door_opening' | 'window_opening') {
    setSelectedAnnotationId(null);
    setSelectedOpeningId(openingId);
    setSelectedObjectType(objectType);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedSepticTankId(null);
    setPlacementPreview(null);
  }

  function selectObjectTreeSepticTank(tankId: string) {
    setSelectedAnnotationId(null);
    setSelectedSepticTankId(tankId);
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedComponentId(null);
    setPlacementPreview(null);
  }

  function selectAnnotation(annotationId: string) {
    const annotation = annotations.find((item) => item.id === annotationId);
    if (annotation?.type !== 'dimension') return;
    setSelectedAnnotationId(annotationId);
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedComponentId(null);
    setSelectedSepticTankId(null);
    setSelectedPlumbingObject(null);
    setPlacementPreview(null);
  }

  function deleteAnnotation(annotationId: string) {
    const annotation = annotations.find((item) => item.id === annotationId);
    if (annotation?.type !== 'dimension') return;
    setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    setSelectedAnnotationId((current) => (current === annotationId ? null : current));
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: 'Dimension removed.' });
  }

  function handleAnnotationCreate(annotation: DesignAnnotation) {
    setAnnotations((current) => [...current, annotation]);
    setSelectedAnnotationId(annotation.type === 'dimension' ? annotation.id : null);
    setSaveState('unsaved');
    setChangedAfterCommit(true);
  }

  function issueViewCommand(action: 'fit' | 'reset' | 'grid_scale', spacingMeters?: number) {
    setViewCommand({ id: Date.now() + Math.random(), action, spacingMeters });
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

  function handleRepairFootprintToExactRectangle() {
    const repaired = repairFootprintToExactOrthogonalRectangle(wallLayout);
    if (!repaired) {
      setStatus({
        tone: 'info',
        message: 'This footprint is not a repairable four-sided rectangle.',
      });
      return;
    }
    commitWallLayout(repaired, 'Repair footprint to exact rectangle', 'wall_move');
    setDraftPlanEnd(null);
    setOrthogonalClosureAssist(null);
    setClosureCornerSnap(null);
    if (!hasUserAdjustedPlanViewRef.current) issueViewCommand('fit');
    pending3dFitRef.current = true;
    setStatus({
      tone: 'success',
      message: 'Footprint repaired to an exact orthogonal rectangle.',
    });
  }

  function cancelPlanDraw() {
    clearTransientPlanCommandState();
    setToolMode('select');
  }

  function handlePlumbingFixturePointer(event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad?: number }) {
    if (active2DView !== 'plumbing-plan') return;
    if (septicTankPlacementActive || activePlumbingToolMode !== 'fixture') return;
    if (event.phase !== 'commit') return;
    const snapPosition = snapComponentPlanPoint({
      point: { xMeters: event.xMeters, zMeters: event.zMeters },
      snapMode,
      snapSpacingMeters: planSnapSpacingMeters,
    });
    const definition = getPlumbingFixtureDefinition(activePlumbingFixtureType);
    setPlumbingSystem((current) =>
      addFixtureToPlumbingSystem({
        system: current,
        fixtureType: activePlumbingFixtureType,
        position: { x: snapPosition.xMeters, y: 0, z: snapPosition.zMeters },
        rotationRadians: event.rotationRad ?? plumbingFixtureRotationRad,
      }),
    );
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: `${definition.displayName} placed on plumbing plan.` });
  }

  function plumbingRunSystemForTool(tool: PlumbingToolMode): PlumbingRunSystem | null {
    if (tool === 'drain') return 'sanitary';
    if (tool === 'vent') return 'vent';
    if (tool === 'cold_water') return 'cold_water';
    if (tool === 'hot_water') return 'hot_water';
    return null;
  }

  function plumbingToolModeForPipeSystem(system: PlumbingRunSystem): PlumbingToolMode {
    return PLUMBING_PIPE_SYSTEM_OPTIONS.find((option) => option.system === system)?.mode ?? 'drain';
  }

  function activePlumbingPrimaryAction(): PlumbingPrimaryAction {
    if (activePlumbingToolMode === 'fixture') return 'fixture';
    if (plumbingRunSystemForTool(activePlumbingToolMode)) return 'pipe';
    if (
      activePlumbingToolMode === 'select' ||
      activePlumbingToolMode === 'cleanout' ||
      activePlumbingToolMode === 'valve' ||
      activePlumbingToolMode === 'stack' ||
      activePlumbingToolMode === 'connect_fixture' ||
      activePlumbingToolMode === 'label' ||
      activePlumbingToolMode === 'validate'
    ) {
      return activePlumbingToolMode;
    }
    return 'select';
  }

  function plumbingEquipmentSystemsForTool(tool: PlumbingToolMode): PlumbingRunSystem[] {
    if (tool === 'cleanout') return ['sanitary'];
    if (tool === 'valve') return ['cold_water', 'hot_water'];
    if (tool === 'stack') return ['sanitary', 'vent'];
    return [];
  }

  function plumbingEquipmentTypeForPlacement(tool: PlumbingToolMode, snappedSystem?: PlumbingRunSystem): PlumbingEquipment['equipmentType'] | null {
    if (tool === 'cleanout') return 'cleanout';
    if (tool === 'valve') return 'shutoff_valve';
    if (tool === 'stack') return snappedSystem === 'sanitary' ? 'waste_stack' : 'vent_stack';
    return null;
  }

  function plumbingEquipmentLabel(equipmentType: PlumbingEquipment['equipmentType']): string {
    if (equipmentType === 'cleanout') return 'CO';
    if (equipmentType === 'shutoff_valve') return 'Valve';
    if (equipmentType === 'waste_stack') return 'WS';
    if (equipmentType === 'vent_stack') return 'VS';
    if (equipmentType === 'combined_stack') return 'Stack';
    if (equipmentType === 'distribution_box') return 'D-Box';
    return equipmentType.replace(/_/g, ' ');
  }

  function resolvePlumbingEquipmentPlacement(
    point: PlumbingPoint3D,
    toleranceMeters: number,
  ): PlumbingEquipmentPlacementSnap | null {
    const systems = plumbingEquipmentSystemsForTool(activePlumbingToolMode);
    if (systems.length === 0) return null;
    let bestSnap: PlumbingRunSegmentSnap | null = null;
    systems.forEach((system) => {
      const snap = findNearestPlumbingRunSegment({
        system: plumbingSystem,
        point,
        toleranceMeters,
        systemFilter: system,
      });
      if (!snap) return;
      if (!bestSnap || snap.distanceMeters < bestSnap.distanceMeters) bestSnap = snap;
    });
    const equipmentType = plumbingEquipmentTypeForPlacement(activePlumbingToolMode, bestSnap?.run.system ?? systems[0]);
    if (!equipmentType) return null;
    return {
      equipmentType,
      position: bestSnap?.point ?? point,
      snap: bestSnap,
    };
  }

  function previewEquipmentForPlacement(placement: PlumbingEquipmentPlacementSnap): PlumbingEquipment {
    return {
      id: 'plumbing-equipment-preview',
      equipmentType: placement.equipmentType,
      label: plumbingEquipmentLabel(placement.equipmentType),
      position: placement.position,
      rotationRadians: 0,
      connectionNodeIds: [],
    };
  }

  function selectPlumbingPipeSystem(system: PlumbingRunSystem) {
    setPlumbingRunDraft(null);
    setPlumbingEquipmentPreview(null);
    setSepticTankPlacementActive(false);
    setActivePlumbingToolMode(plumbingToolModeForPipeSystem(system));
    setPlumbingPipeDefaults((current) => {
      const defaults = defaultPipeDefaultsForSystem(system);
      return {
        ...defaults,
        diameterInches: current.system === system ? current.diameterInches : defaults.diameterInches,
        material: current.system === system ? current.material : defaults.material,
        schedule: current.system === system ? current.schedule : defaults.schedule,
        stockLengthFt: current.system === system ? current.stockLengthFt : defaults.stockLengthFt,
        stockLengthPreset: current.system === system ? current.stockLengthPreset : defaults.stockLengthPreset,
        stockLengthKind: current.system === system ? current.stockLengthKind : defaults.stockLengthKind,
        slopeInPerFt: system === 'sanitary' ? (current.system === system ? current.slopeInPerFt : defaults.slopeInPerFt) : undefined,
        elevationMode: current.system === system ? current.elevationMode : defaults.elevationMode,
        labelVisible: current.labelVisible,
        system,
      };
    });
  }

  function updatePlumbingPipeDefaults(patch: Partial<PlumbingPipeDefaults>) {
    setPlumbingPipeDefaults((current) => {
      const nextMaterial = patch.material ?? current.material;
      const materialChanged = patch.material && patch.material !== current.material;
      const system = patch.system ?? current.system;
      const stockDefaults = defaultStockLengthForPipe({ material: nextMaterial, system });
      const nextPreset = patch.stockLengthPreset ?? (materialChanged || patch.system ? stockDefaults.stockLengthPreset : current.stockLengthPreset);
      const option = stockLengthOptionForPreset(nextMaterial, nextPreset);
      const nextStockLengthFt = patch.stockLengthFt ?? (materialChanged || patch.system ? option?.lengthFt ?? stockDefaults.stockLengthFt : current.stockLengthFt);
      return {
        ...current,
        ...patch,
        material: nextMaterial,
        schedule: patch.schedule ?? (materialChanged ? defaultPipeScheduleForMaterial(nextMaterial) : current.schedule),
        stockLengthPreset: nextPreset,
        stockLengthFt: nextStockLengthFt,
        stockLengthKind: patch.stockLengthKind ?? option?.kind ?? (materialChanged || patch.system ? stockDefaults.stockLengthKind : current.stockLengthKind),
        slopeInPerFt: system === 'sanitary' ? patch.slopeInPerFt ?? current.slopeInPerFt : undefined,
      };
    });
  }

  function updateSelectedPlumbingRun(runId: string, patch: Partial<PlumbingRun>) {
    setPlumbingSystem((current) => ({
      ...current,
      runs: current.runs.map((run) => (run.id === runId ? { ...run, ...patch } : run)),
    }));
    setSaveState('unsaved');
    setChangedAfterCommit(true);
  }

  function updateSelectedPlumbingEquipment(equipmentId: string, patch: Partial<PlumbingEquipment>) {
    setPlumbingSystem((current) => ({
      ...current,
      equipment: current.equipment.map((equipment) =>
        equipment.id === equipmentId ? { ...equipment, ...patch } : equipment,
      ),
      nodes: current.nodes.map((node) =>
        node.equipmentId === equipmentId && typeof patch.label === 'string' ? { ...node, label: patch.label } : node,
      ),
    }));
    setSaveState('unsaved');
    setChangedAfterCommit(true);
  }

  function runCreationDefaults(system: PlumbingRunSystem) {
    const defaults = plumbingPipeDefaults.system === system ? plumbingPipeDefaults : defaultPipeDefaultsForSystem(system);
    return {
      diameterInches: defaults.diameterInches,
      slopeInPerFt: system === 'sanitary' ? defaults.slopeInPerFt : undefined,
      material: defaults.material,
      schedule: defaults.schedule,
      stockLengthFt: defaults.stockLengthFt,
      stockLengthPreset: defaults.stockLengthPreset,
      stockLengthKind: defaults.stockLengthKind,
      elevationMode: defaults.elevationMode,
      labelVisible: defaults.labelVisible,
    };
  }

  function plumbingDraftBasePoint(draft: PlumbingRunDraft): PlumbingPoint3D | null {
    return draft.routePoints.at(-1) ?? plumbingSystem.nodes.find((node) => node.id === draft.startNodeId)?.position ?? null;
  }

  function resolvePlumbingDraftPoint(target: PlumbingPoint3D, draft: PlumbingRunDraft | null, shiftHeld?: boolean): PlumbingPoint3D {
    if (!draft || !shiftHeld) return target;
    const base = plumbingDraftBasePoint(draft);
    return base ? constrainPlumbingPointToShiftAngles(base, target) : target;
  }

  function plumbingTerminalNodeKind(system: PlumbingRunSystem): PlumbingNodeKind {
    if (system === 'sanitary') return 'building_drain_exit';
    if (system === 'vent') return 'stack';
    return 'main_service';
  }

  function plumbingTerminalNodeLabel(system: PlumbingRunSystem): string {
    if (system === 'sanitary') return 'Drain endpoint';
    if (system === 'vent') return 'Vent endpoint';
    if (system === 'hot_water') return 'Hot water endpoint';
    return 'Cold water endpoint';
  }

  function pointsNearlyEqual(a: PlumbingPoint3D, b: PlumbingPoint3D): boolean {
    return Math.hypot(a.x - b.x, a.z - b.z) <= 0.01;
  }

  function plumbingId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function dedupeConsecutivePlumbingPoints(points: PlumbingPoint3D[]): PlumbingPoint3D[] {
    return points.filter((point, index) => index === 0 || !pointsNearlyEqual(points[index - 1]!, point));
  }

  function routePointsBeforeEnd(routePoints: PlumbingPoint3D[], endPoint: PlumbingPoint3D): PlumbingPoint3D[] {
    const next = [...routePoints];
    while (next.length > 0 && pointsNearlyEqual(next[next.length - 1]!, endPoint)) next.pop();
    return next;
  }

  function splitPlumbingRunAtSegment(
    system: PlumbingSystem,
    snap: PlumbingRunSegmentSnap,
  ): { system: PlumbingSystem; nodeId: string; point: PlumbingPoint3D; mainRunId: string; createdNodeKind: PlumbingNodeKind } | null {
    const run = system.runs.find((candidate) => candidate.id === snap.runId);
    if (!run || run.system !== snap.run.system) return null;
    const existingNode = system.nodes.find((node) => node.system === run.system && pointsNearlyEqual(node.position, snap.point));
    if (existingNode) {
      return { system, nodeId: existingNode.id, point: existingNode.position, mainRunId: run.id, createdNodeKind: existingNode.kind };
    }
    if (pointsNearlyEqual(run.path[0]!, snap.point)) {
      const node = system.nodes.find((candidate) => candidate.id === run.startNodeId);
      if (node) return { system, nodeId: run.startNodeId, point: node.position, mainRunId: run.id, createdNodeKind: node.kind };
    }
    if (pointsNearlyEqual(run.path[run.path.length - 1]!, snap.point)) {
      const node = system.nodes.find((candidate) => candidate.id === run.endNodeId);
      if (node) return { system, nodeId: run.endNodeId, point: node.position, mainRunId: run.id, createdNodeKind: node.kind };
    }

    const fittingNode: PlumbingNode = {
      id: plumbingId(run.system === 'sanitary' ? 'plumbing-wye' : 'plumbing-fitting'),
      kind: run.system === 'sanitary' ? 'wye' : 'fitting',
      system: run.system,
      position: snap.point,
      label: run.system === 'sanitary' ? 'Sanitary wye' : 'Pipe fitting',
    };
    const firstPath = dedupeConsecutivePlumbingPoints([...run.path.slice(0, snap.segmentIndex), snap.point]);
    const secondPath = dedupeConsecutivePlumbingPoints([snap.point, ...run.path.slice(snap.segmentIndex)]);
    if (firstPath.length < 2 || secondPath.length < 2) {
      return { system, nodeId: fittingNode.id, point: fittingNode.position, mainRunId: run.id, createdNodeKind: fittingNode.kind };
    }
    const splitToken = plumbingId('split');
    const firstRun: PlumbingRun = {
      ...run,
      id: `${run.id}-${splitToken}-a`,
      endNodeId: fittingNode.id,
      path: firstPath,
    };
    const secondRun: PlumbingRun = {
      ...run,
      id: `${run.id}-${splitToken}-b`,
      startNodeId: fittingNode.id,
      path: secondPath,
    };
    return {
      system: {
        ...system,
        nodes: [...system.nodes, fittingNode],
        runs: system.runs.flatMap((candidate) => (candidate.id === run.id ? [firstRun, secondRun] : [candidate])),
      },
      nodeId: fittingNode.id,
      point: fittingNode.position,
      mainRunId: firstRun.id,
      createdNodeKind: fittingNode.kind,
    };
  }

  function addRunEndingAtNode(params: {
    system: PlumbingSystem;
    draft: PlumbingRunDraft;
    endNodeId: string;
    endPoint: PlumbingPoint3D;
    roughInMainRunId?: string;
    roughInTapPoint?: PlumbingPoint3D;
    roughInSegmentIndex?: number;
  }): { system: PlumbingSystem; roughIn: PlumbingFixtureRoughInAssembly | null; message: string } {
    const startNode = params.system.nodes.find((node) => node.id === params.draft.startNodeId);
    const endNode = params.system.nodes.find((node) => node.id === params.endNodeId);
    const mainRunId = params.roughInMainRunId ?? params.draft.roughInMainRunId;
    const tapPoint = params.roughInTapPoint ?? params.draft.roughInTapPoint;
    const segmentIndex = params.roughInSegmentIndex ?? params.draft.roughInSegmentIndex;
    const fixtureNode = params.draft.system === 'sanitary'
      ? [startNode, endNode].find((node): node is PlumbingNode => Boolean(node?.fixtureId))
      : null;
    if (fixtureNode?.fixtureId && mainRunId && tapPoint) {
      const result = createOrReplaceFixtureRoughInAssembly({
        system: params.system,
        fixtureId: fixtureNode.fixtureId,
        mainRunId,
        tapPoint,
        segmentIndex,
      });
      if (result.roughIn) {
        return {
          ...result,
          system: ensureSanitaryDrainConnectedToDistributionBox(result.system),
        };
      }
    }
    const system = addRunToPlumbingSystem({
      system: params.system,
      systemType: params.draft.system,
      startNodeId: params.draft.startNodeId,
      endNodeId: params.endNodeId,
      routePoints: routePointsBeforeEnd(params.draft.routePoints, params.endPoint),
      ...runCreationDefaults(params.draft.system),
    });
    return {
      system: ensureSanitaryDrainConnectedToDistributionBox(system),
      roughIn: null,
      message: 'Pipe run created as a PlumbingRun object.',
    };
  }

  function addRunEndingAtSegment(params: {
    system: PlumbingSystem;
    draft: PlumbingRunDraft;
    snap: PlumbingRunSegmentSnap;
  }): { system: PlumbingSystem; connected: boolean; roughIn: PlumbingFixtureRoughInAssembly | null; message: string; fittingKind?: PlumbingNodeKind } {
    const split = splitPlumbingRunAtSegment(params.system, params.snap);
    if (!split) return { system: params.system, connected: false, roughIn: null, message: 'Pipe run could not be tied into existing pipe.' };
    const next = addRunEndingAtNode({
      system: split.system,
      draft: params.draft,
      endNodeId: split.nodeId,
      endPoint: split.point,
      roughInMainRunId: split.mainRunId,
      roughInTapPoint: split.point,
      roughInSegmentIndex: params.snap.segmentIndex,
    });
    if (next.roughIn) {
      return {
        ...next,
        system: {
          ...next.system,
          fittings: (next.system.fittings ?? []).filter((fitting) =>
            fitting.nodeId !== split.nodeId || next.roughIn!.fittingIds.includes(fitting.id),
          ),
        },
        connected: true,
        fittingKind: split.createdNodeKind,
      };
    }
    return { ...next, connected: true, fittingKind: split.createdNodeKind };
  }

  function resolvePlumbingPipeTarget(params: {
    point: PlumbingPoint3D;
    system: PlumbingRunSystem;
    toleranceMeters: number;
    draft?: PlumbingRunDraft | null;
  }):
    | { kind: 'node'; node: PlumbingNode; point: PlumbingPoint3D }
    | { kind: 'run-segment'; snap: PlumbingRunSegmentSnap; point: PlumbingPoint3D }
    | { kind: 'free'; point: PlumbingPoint3D } {
    const node = findNearestPlumbingNode({
      system: plumbingSystem,
      point: params.point,
      toleranceMeters: params.toleranceMeters,
      systemFilter: params.system,
    });
    if (node && node.id !== params.draft?.startNodeId) {
      return { kind: 'node', node, point: node.position };
    }
    const segmentSnap = findNearestPlumbingRunSegment({
      system: plumbingSystem,
      point: params.point,
      toleranceMeters: params.toleranceMeters,
      systemFilter: params.system,
    });
    if (segmentSnap) return { kind: 'run-segment', snap: segmentSnap, point: segmentSnap.point };
    return { kind: 'free', point: params.point };
  }

  function finishPlumbingRunDraft() {
    const draft = plumbingRunDraft;
    if (!draft) return false;
    const startNode = plumbingSystem.nodes.find((node) => node.id === draft.startNodeId);
    if (!startNode) {
      setPlumbingRunDraft(null);
      return false;
    }
    const routePoints = [...draft.routePoints];
    let endPoint = draft.previewPoint ?? routePoints.at(-1) ?? null;
    if (!endPoint || pointsNearlyEqual(startNode.position, endPoint)) {
      setPlumbingRunDraft(null);
      return false;
    }
    if (draft.previewSnap?.kind === 'node' && draft.previewSnap.nodeId !== draft.startNodeId) {
      const endNode = plumbingSystem.nodes.find((node) => node.id === draft.previewSnap?.nodeId);
      if (endNode && endNode.system === draft.system) {
        let createdRoughIn: PlumbingFixtureRoughInAssembly | null = null;
        let finishMessage = 'Pipe run finished.';
        setPlumbingSystem((current) => {
          const result = addRunEndingAtNode({
            system: current,
            draft,
            endNodeId: endNode.id,
            endPoint: endNode.position,
          });
          createdRoughIn = result.roughIn;
          finishMessage = result.message || finishMessage;
          return result.system;
        });
        setPlumbingRunDraft(null);
        setActivePlumbingToolMode('select');
        if (createdRoughIn) setSelectedPlumbingObject({ kind: 'rough-in', id: createdRoughIn.id });
        setSaveState('unsaved');
        setChangedAfterCommit(true);
        setStatus({ tone: 'success', message: finishMessage });
        return true;
      }
    }
    if (draft.previewSnap?.kind === 'run-segment') {
      let createdRoughIn: PlumbingFixtureRoughInAssembly | null = null;
      let finishMessage = draft.system === 'sanitary' ? 'Pipe run finished with a sanitary wye fitting.' : 'Pipe run finished with a pipe fitting.';
      setPlumbingSystem((current) => {
        const currentRun = current.runs.find((run) => run.id === draft.previewSnap?.runId);
        if (!currentRun || !draft.previewSnap || draft.previewSnap.kind !== 'run-segment') return current;
        const result = addRunEndingAtSegment({
          system: current,
          draft,
          snap: {
            run: currentRun,
            runId: draft.previewSnap.runId,
            segmentIndex: draft.previewSnap.segmentIndex,
            point: draft.previewSnap.point,
            distanceMeters: 0,
          },
        });
        createdRoughIn = result.roughIn;
        finishMessage = result.message || finishMessage;
        return result.system;
      });
      setPlumbingRunDraft(null);
      setActivePlumbingToolMode('select');
      if (createdRoughIn) setSelectedPlumbingObject({ kind: 'rough-in', id: createdRoughIn.id });
      setSaveState('unsaved');
      setChangedAfterCommit(true);
      setStatus({ tone: 'success', message: finishMessage });
      return true;
    }
    if (routePoints.length > 0 && pointsNearlyEqual(routePoints[routePoints.length - 1]!, endPoint)) {
      endPoint = routePoints.pop() ?? endPoint;
    }
    const terminalNode: PlumbingNode = {
      id: plumbingId('plumbing-end'),
      kind: plumbingTerminalNodeKind(draft.system),
      system: draft.system,
      position: endPoint,
      label: plumbingTerminalNodeLabel(draft.system),
    };
    setPlumbingSystem((current) => {
      const withNode = { ...current, nodes: [...current.nodes, terminalNode] };
      return ensureSanitaryDrainConnectedToDistributionBox(addRunToPlumbingSystem({
        system: withNode,
        systemType: draft.system,
        startNodeId: draft.startNodeId,
        endNodeId: terminalNode.id,
        routePoints,
        ...runCreationDefaults(draft.system),
      }));
    });
    setPlumbingRunDraft(null);
    setActivePlumbingToolMode('select');
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: 'Pipe run finished.' });
    return true;
  }

  function handlePlumbingPlanPointer(event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; shiftHeld?: boolean }) {
    if (active2DView !== 'plumbing-plan') return;
    const snapToleranceMeters = Math.max(0.12, 12 / Math.max(1, planViewport.zoom));
    if (event.phase === 'preview') {
      if (plumbingRunDraft) {
        const snapPosition = snapComponentPlanPoint({
          point: { xMeters: event.xMeters, zMeters: event.zMeters },
          snapMode,
          snapSpacingMeters: planSnapSpacingMeters,
        });
        const constrainedPoint = resolvePlumbingDraftPoint(
          { x: snapPosition.xMeters, y: 0, z: snapPosition.zMeters },
          plumbingRunDraft,
          event.shiftHeld,
        );
        const target = resolvePlumbingPipeTarget({
          point: constrainedPoint,
          system: plumbingRunDraft.system,
          toleranceMeters: snapToleranceMeters,
          draft: plumbingRunDraft,
        });
        setPlumbingRunDraft((current) =>
          current
            ? {
                ...current,
                previewPoint: target.point,
                previewSnap:
                  target.kind === 'node'
                    ? { kind: 'node', nodeId: target.node.id }
                    : target.kind === 'run-segment'
                      ? {
                          kind: 'run-segment',
                          runId: target.snap.runId,
                          segmentIndex: target.snap.segmentIndex,
                          point: target.snap.point,
                        }
                      : undefined,
              }
            : current,
        );
        setPlumbingEquipmentPreview(null);
        return;
      }
      if (activePlumbingToolMode === 'cleanout' || activePlumbingToolMode === 'valve' || activePlumbingToolMode === 'stack') {
        const snapPosition = snapComponentPlanPoint({
          point: { xMeters: event.xMeters, zMeters: event.zMeters },
          snapMode,
          snapSpacingMeters: planSnapSpacingMeters,
        });
        const placement = resolvePlumbingEquipmentPlacement(
          { x: snapPosition.xMeters, y: 0, z: snapPosition.zMeters },
          snapToleranceMeters,
        );
        setPlumbingEquipmentPreview(placement ? previewEquipmentForPlacement(placement) : null);
      }
      return;
    }
    const snapPosition = snapComponentPlanPoint({
      point: { xMeters: event.xMeters, zMeters: event.zMeters },
      snapMode,
      snapSpacingMeters: planSnapSpacingMeters,
    });
    const rawPoint = { x: snapPosition.xMeters, y: 0, z: snapPosition.zMeters };
    if (activePlumbingToolMode === 'connect_fixture') {
      if (selectedPlumbingObject?.kind !== 'fixture') {
        setStatus({ tone: 'error', message: 'Select a plumbing fixture before using Connect Fixture.' });
        return;
      }
      const fixtureId = selectedPlumbingObject.id;
      const snap = findNearestPlumbingRunSegment({
        system: plumbingSystem,
        point: rawPoint,
        toleranceMeters: snapToleranceMeters,
      });
      if (!snap) {
        setStatus({ tone: 'error', message: 'Click a plumbing run to connect the selected fixture.' });
        return;
      }
      const selectedFixture = plumbingSystem.fixtures.find((fixture) => fixture.id === fixtureId);
      if (!selectedFixture?.connectionNodeIds[snap.run.system]?.length) {
        setStatus({
          tone: 'error',
          message: `${selectedFixture?.mark ?? 'Selected fixture'} does not have a ${snap.run.system.replace('_', ' ')} connection.`,
        });
        return;
      }
      let createdRoughIn: PlumbingFixtureRoughInAssembly | null = null;
      let message = '';
      setPlumbingSystem((current) => {
        const currentRun = current.runs.find((run) => run.id === snap.runId);
        if (!currentRun) return current;
        const result = createOrReplaceFixtureRoughInAssembly({
          system: current,
          fixtureId,
          mainRunId: currentRun.id,
          tapPoint: snap.point,
          segmentIndex: snap.segmentIndex,
        });
        createdRoughIn = result.roughIn;
        message = result.message;
        return ensureSanitaryDrainConnectedToDistributionBox(result.system);
      });
      if (createdRoughIn) {
        setSelectedPlumbingObject({ kind: 'rough-in', id: createdRoughIn.id });
        setSaveState('unsaved');
        setChangedAfterCommit(true);
        setStatus({ tone: 'success', message });
      } else {
        setStatus({ tone: 'error', message: message || 'Fixture rough-in could not be created.' });
      }
      return;
    }
    const runSystem = plumbingRunSystemForTool(activePlumbingToolMode);
    if (runSystem) {
      setPlumbingEquipmentPreview(null);
      const constrainedPoint = resolvePlumbingDraftPoint(rawPoint, plumbingRunDraft, event.shiftHeld);
      const target = resolvePlumbingPipeTarget({
        point: constrainedPoint,
        system: runSystem,
        toleranceMeters: snapToleranceMeters,
        draft: plumbingRunDraft,
      });
      if (!plumbingRunDraft) {
        if (target.kind === 'node') {
          setPlumbingRunDraft({
            system: runSystem,
            startNodeId: target.node.id,
            routePoints: [],
            previewPoint: target.node.position,
            previewSnap: { kind: 'node', nodeId: target.node.id },
          });
          setStatus({ tone: 'info', message: 'Pipe run started. Click route points, then click a matching node or pipe to finish.' });
          return;
        }
        if (target.kind === 'run-segment') {
          const split = splitPlumbingRunAtSegment(plumbingSystem, target.snap);
          if (split) {
            setPlumbingSystem(split.system);
            setPlumbingRunDraft({
              system: runSystem,
              startNodeId: split.nodeId,
              roughInMainRunId: split.mainRunId,
              roughInTapPoint: split.point,
              roughInSegmentIndex: target.snap.segmentIndex,
              routePoints: [],
              previewPoint: split.point,
              previewSnap: { kind: 'node', nodeId: split.nodeId },
            });
            setSaveState('unsaved');
            setChangedAfterCommit(true);
            setStatus({ tone: 'info', message: runSystem === 'sanitary' ? 'Pipe run started from a sanitary wye fitting.' : 'Pipe run started from a pipe fitting.' });
            return;
          }
        }
        {
          setStatus({ tone: 'error', message: 'Start a pipe run on a matching plumbing node.' });
          return;
        }
      }
      const point = target.point;
      if (target.kind === 'node' && target.node.id !== plumbingRunDraft.startNodeId && target.node.system === plumbingRunDraft.system) {
        let createdRoughIn: PlumbingFixtureRoughInAssembly | null = null;
        let message = 'Pipe run created as a PlumbingRun object.';
        setPlumbingSystem((current) => {
          const result = addRunEndingAtNode({
            system: current,
            draft: plumbingRunDraft,
            endNodeId: target.node.id,
            endPoint: target.node.position,
          });
          createdRoughIn = result.roughIn;
          message = result.message || message;
          return result.system;
        });
        setPlumbingRunDraft(null);
        if (createdRoughIn) setSelectedPlumbingObject({ kind: 'rough-in', id: createdRoughIn.id });
        setSaveState('unsaved');
        setChangedAfterCommit(true);
        setStatus({ tone: 'success', message });
        return;
      }
      if (target.kind === 'run-segment') {
        let createdRoughIn: PlumbingFixtureRoughInAssembly | null = null;
        let message = runSystem === 'sanitary' ? 'Pipe run tied in with a sanitary wye fitting.' : 'Pipe run tied into existing pipe.';
        setPlumbingSystem((current) => {
          const currentRun = current.runs.find((run) => run.id === target.snap.runId);
          if (!currentRun) return current;
          const result = addRunEndingAtSegment({
            system: current,
            draft: plumbingRunDraft,
            snap: { ...target.snap, run: currentRun },
          });
          createdRoughIn = result.roughIn;
          message = result.message || message;
          return result.system;
        });
        setPlumbingRunDraft(null);
        if (createdRoughIn) setSelectedPlumbingObject({ kind: 'rough-in', id: createdRoughIn.id });
        setSaveState('unsaved');
        setChangedAfterCommit(true);
        setStatus({ tone: 'success', message });
        return;
      }
      setPlumbingRunDraft((current) =>
        current
          ? {
              ...current,
              routePoints: [...current.routePoints, point],
              previewPoint: point,
              previewSnap: undefined,
            }
          : current,
      );
      return;
    }
    if (activePlumbingToolMode === 'cleanout' || activePlumbingToolMode === 'valve' || activePlumbingToolMode === 'stack') {
      const placement = resolvePlumbingEquipmentPlacement(rawPoint, snapToleranceMeters);
      if (!placement?.snap) {
        const required =
          activePlumbingToolMode === 'cleanout'
            ? 'a sanitary drain line'
            : activePlumbingToolMode === 'valve'
              ? 'a hot or cold water line'
              : 'a sanitary waste or vent line';
        setStatus({ tone: 'error', message: `Move over ${required} to place this plumbing item.` });
        return;
      }
      setPlumbingSystem((current) =>
        addEquipmentToPlumbingSystem({
          system: current,
          equipmentType: placement.equipmentType,
          position: placement.position,
        }),
      );
      setPlumbingEquipmentPreview(null);
      setSaveState('unsaved');
      setChangedAfterCommit(true);
      setStatus({ tone: 'success', message: `${plumbingEquipmentLabel(placement.equipmentType)} placed on ${placement.snap.run.system.replace('_', ' ')} line.` });
      return;
    }
  }

  function handlePlumbingSelect(selection: PlumbingSelection) {
    let nextSelection = selection;
    if (selection.kind === 'node') {
      const node = plumbingSystem.nodes.find((item) => item.id === selection.id);
      if (node?.fixtureId) nextSelection = { kind: 'fixture', id: node.fixtureId };
      else if (node?.equipmentId) nextSelection = { kind: 'equipment', id: node.equipmentId };
      else if (node?.septicTankId) nextSelection = { kind: 'septic-tank', id: node.septicTankId };
    }
    setSelectedAnnotationId(null);
    setSelectedPlumbingObject(nextSelection.kind === 'none' ? null : nextSelection);
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedComponentId(null);
    if (nextSelection.kind === 'septic-tank') setSelectedSepticTankId(nextSelection.id);
    else setSelectedSepticTankId(null);
  }

  function validateCurrentPlumbingSystem() {
    const issues = validatePlumbingSystem(plumbingSystem, {
      wallFootings: designGeometryResult.wallFootings,
      beams: designGeometryResult.frameSystem.beams,
      isolatedFootings: designGeometryResult.isolatedFootings,
      columns: designGeometryResult.frameSystem.columns,
      buildingFootprint: designGeometryResult.resolvedFootprint?.exteriorFacePolygon,
    });
    setPlumbingValidationIssues(issues);
    setStatus({
      tone: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'success',
      message: issues.length > 0 ? `Plumbing validation found ${issues.length} issue${issues.length === 1 ? '' : 's'}.` : 'Plumbing validation passed.',
    });
  }

  function deleteSelectedPlumbingObject() {
    const selection = selectedPlumbingObject ?? (selectedSepticTankId ? { kind: 'septic-tank' as const, id: selectedSepticTankId } : null);
    if (!selection || selection.kind === 'none') return;
    let deleted = false;
    setPlumbingSystem((current) => {
      if (selection.kind === 'fixture') {
        deleted = true;
        return removeFixtureFromPlumbingSystem(current, selection.id);
      }
      if (selection.kind === 'run') {
        deleted = true;
        return removeRunFromPlumbingSystem(current, selection.id);
      }
      if (selection.kind === 'run-route-point') {
        deleted = true;
        return reconcileAutoGeneratedPlumbingFittings({
          ...current,
          runs: current.runs.map((run) =>
            run.id === selection.runId && selection.pointIndex > 0 && selection.pointIndex < run.path.length - 1
              ? { ...run, path: run.path.filter((_, index) => index !== selection.pointIndex) }
              : run,
          ),
        });
      }
      if (selection.kind === 'fitting') {
        deleted = true;
        return {
          ...current,
          fittings: (current.fittings ?? []).filter((fitting) => fitting.id !== selection.id),
        };
      }
      if (selection.kind === 'rough-in') {
        const roughIn = current.roughIns.find((item) => item.id === selection.id);
        if (!roughIn) return current;
        const runIds = new Set([
          roughIn.branchRunId,
          roughIn.riserRunId,
          roughIn.trapArmRunId,
        ].filter((id): id is string => Boolean(id)));
        const nodeIds = new Set([roughIn.riserBottomNodeId, roughIn.riserTopNodeId]);
        const fittingIds = new Set(roughIn.fittingIds);
        deleted = true;
        return {
          ...current,
          roughIns: current.roughIns.filter((item) => item.id !== selection.id),
          nodes: current.nodes.filter((node) => !nodeIds.has(node.id)),
          runs: current.runs.filter((run) => !runIds.has(run.id)),
          fittings: (current.fittings ?? []).filter((fitting) => !fittingIds.has(fitting.id)),
        };
      }
      if (selection.kind === 'equipment') {
        const equipmentNodeIds = new Set(current.nodes.filter((node) => node.equipmentId === selection.id).map((node) => node.id));
        deleted = true;
        return {
          ...current,
          equipment: current.equipment.filter((equipment) => equipment.id !== selection.id),
          nodes: current.nodes.filter((node) => node.equipmentId !== selection.id),
          runs: current.runs.filter((run) => !equipmentNodeIds.has(run.startNodeId) && !equipmentNodeIds.has(run.endNodeId)),
        };
      }
      if (selection.kind === 'septic-tank') {
        const septicNodeIds = new Set(current.nodes.filter((node) => node.septicTankId === selection.id).map((node) => node.id));
        deleted = true;
        return {
          ...current,
          septicTanks: current.septicTanks.filter((tank) => tank.id !== selection.id),
          nodes: current.nodes.filter((node) => node.septicTankId !== selection.id),
          runs: current.runs.filter((run) => !septicNodeIds.has(run.startNodeId) && !septicNodeIds.has(run.endNodeId)),
        };
      }
      if (selection.kind === 'node') {
        deleted = true;
        return {
          ...current,
          nodes: current.nodes.filter((node) => node.id !== selection.id),
          runs: current.runs.filter((run) => run.startNodeId !== selection.id && run.endNodeId !== selection.id),
        };
      }
      return current;
    });
    if (!deleted) {
      setStatus({ tone: 'info', message: 'Select a plumbing fixture, pipe, equipment item, septic tank, or route point to delete.' });
      return;
    }
    setSelectedPlumbingObject(null);
    setSelectedSepticTankId(null);
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: 'Selected plumbing item deleted.' });
  }

  function rotateFixturePlacementPreview(deltaRadians: number) {
    const fullTurn = Math.PI * 2;
    setPlumbingFixtureRotationRad((current) => ((current + deltaRadians) % fullTurn + fullTurn) % fullTurn);
  }

  function rotateSelectedPlumbingFixture(deltaRadians: number) {
    const fixtureId = selectedPlumbingObject?.kind === 'fixture' ? selectedPlumbingObject.id : null;
    if (!fixtureId) {
      setStatus({ tone: 'info', message: 'Select a plumbing fixture before rotating.' });
      return;
    }
    setPlumbingSystem((current) => {
      const fixture = current.fixtures.find((item) => item.id === fixtureId);
      if (!fixture) return current;
      const fullTurn = Math.PI * 2;
      const rotationRadians = ((fixture.rotationRadians + deltaRadians) % fullTurn + fullTurn) % fullTurn;
      return updateFixtureRotationInPlumbingSystem({
        system: current,
        fixtureId,
        rotationRadians,
      });
    });
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setStatus({ tone: 'success', message: 'Selected plumbing fixture rotated 90 degrees.' });
  }

  function handleSepticTankPointer(event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number; rotationRad: number }) {
    if (active2DView !== 'plumbing-plan') return;
    if (!septicTankPlacementActive) return;
    if (event.phase !== 'commit') return;
    const snapPosition = snapComponentPlanPoint({
      point: { xMeters: event.xMeters, zMeters: event.zMeters },
      snapMode,
      snapSpacingMeters: planSnapSpacingMeters,
    });
    const result = addCmuSepticTankToPlumbingSystem({
      system: plumbingSystem,
      centerX: snapPosition.xMeters,
      centerZ: snapPosition.zMeters,
      rotationRad: event.rotationRad,
      buildingFootprint: designGeometryResult.resolvedFootprint?.exteriorFacePolygon,
    });
    setPlumbingSystem(result.system);
    setSepticTankPlacementActive(false);
    setToolMode('select');
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedComponentId(null);
    setSaveState('unsaved');
    setChangedAfterCommit(true);
    setSelectedSepticTankId(result.tank.id);
    setStatus({ tone: 'success', message: 'CMU septic tank placed as a model-driven site utility.' });
  }

  function updateSepticTank(tankId: string, updater: (tank: SepticTankModel) => SepticTankModel) {
    setPlumbingSystem((current) => {
      const nextTanks = current.septicTanks.map((tank) =>
        tank.id === tankId ? updater({ ...tank, updatedAt: new Date().toISOString() }) : tank,
      );
      const nextTank = nextTanks.find((tank) => tank.id === tankId);
      const septicNodeIds = new Set([
        nextTank?.connectionNodes.inletNodeId,
        nextTank?.connectionNodes.outletNodeId,
        ...(nextTank?.connectionNodes.cleanoutNodeIds ?? []),
      ].filter((id): id is string => Boolean(id)));
      const nextNodes = nextTank
        ? [
            ...current.nodes.filter((node) => node.septicTankId !== tankId && !septicNodeIds.has(node.id)),
            ...createCmuSepticTankNodes(nextTank),
          ]
        : current.nodes;
      return { ...current, septicTanks: nextTanks, nodes: nextNodes };
    });
    setSaveState('unsaved');
    setChangedAfterCommit(true);
  }

  function updateSelectedSepticTank(tankId: string, patch: Partial<SepticTankModel>) {
    updateSepticTank(tankId, (tank) => ({ ...tank, ...patch }));
  }

  function updateSelectedSepticTankPlacement(tankId: string, patch: Partial<SepticTankModel['placement']>) {
    updateSepticTank(tankId, (tank) => ({
      ...tank,
      placement: { ...tank.placement, ...patch },
    }));
  }

  function updateSelectedSepticTankDesignBasis(tankId: string, patch: Partial<SepticTankModel['designBasis']>) {
    updateSepticTank(tankId, (tank) => ({
      ...tank,
      designBasis: { ...tank.designBasis, ...patch },
    }));
  }

  function updateSelectedSepticTankGeometry(tankId: string, patch: Partial<SepticTankModel['geometry']>) {
    updateSepticTank(tankId, (tank) => ({
      ...tank,
      geometry: { ...tank.geometry, ...patch },
    }));
  }

  function clearTransientPlanCommandState(options?: { switchToSelect?: boolean }) {
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
    setSnapCycleIndex(0);
    setHorizontalSnapLock(false);
    setVerticalSnapLock(false);
    if (options?.switchToSelect) setToolMode('select');
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
    const snapTarget = resolveDesignSnapPoint({
      layout: wallLayout,
      point: rawPoint,
      snapMode,
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
    if (wallLayout.orthogonalLock) {
      const guidance = resolveDrawWallGuidance({
        layout: wallLayout,
        activeNodeId,
        rawPoint: snapTarget.point,
        orthogonalLock: true,
      });
      if (guidance.kind !== 'free') {
        return { point: guidance.point, constraintLabel: guidance.label ?? null };
      }
    }
    return { point: snapTarget.point, constraintLabel: null };
  }

  function resolveActiveWallDrawPoint(
    rawPoint: { x: number; z: number },
    options?: {
      activeNodeId?: string | null;
      shiftHeld?: boolean;
      altHeld?: boolean;
      exactLengthMeters?: number;
    },
  ) {
    const resolved = resolveWallDrawPoint({
      layout: wallLayout,
      activeNodeId: options?.activeNodeId ?? null,
      rawPoint,
      snapMode,
      moduleLengthMeters: cmuModule.moduleLengthMeters,
      pixelsPerMeter: planViewport.zoom,
      shiftHeld: options?.shiftHeld,
      altHeld: options?.altHeld,
      exactLengthMeters: options?.exactLengthMeters,
      moduleFitMode,
      previousSnap: lastSnapTargetRef.current,
      segmentFrames: planSegmentFrames,
    });
    lastSnapTargetRef.current = resolved.snapTarget;
    setDraftSnapTarget(resolved.snapTarget);
    return resolved;
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

    if (event.kind === 'annotation_select' && event.annotationId) {
      selectAnnotation(event.annotationId);
      return;
    }

    if (event.kind === 'annotation_delete' && event.annotationId) {
      if (event.phase !== 'commit') return;
      deleteAnnotation(event.annotationId);
      return;
    }

    const moduleLength = cmuModule.moduleLengthMeters;
    const layout = wallLayout;
    const snapLayout = {
      ...layout,
      snapToGrid: snapMode === 'grid' || snapMode === 'cmu_module',
      snapToModule: snapMode === 'cmu_module',
    };

    if (event.kind === 'draw_preview' && event.planX != null && event.planZ != null) {
      const currentActiveDrawNodeId =
        activeDrawNodeId && layout.nodes.some((node) => node.id === activeDrawNodeId)
          ? activeDrawNodeId
          : resolveActiveDrawNodeId(layout);
      const exactLength = segmentLengthInput ? Number(segmentLengthInput) : undefined;
      const resolved = resolveActiveWallDrawPoint(
        { x: event.planX, z: event.planZ },
        {
          activeNodeId: currentActiveDrawNodeId,
          shiftHeld: event.shiftHeld,
          altHeld: event.altHeld,
          exactLengthMeters: exactLength,
        },
      );
      setDraftPlanEnd(resolved.point);
      setDrawWallConstraintLabel(resolved.constraintLabel);
      setDrawWallPreviewMetrics(currentActiveDrawNodeId ? resolved.metrics : null);
      const assist =
        currentActiveDrawNodeId && layout.orthogonalLock
          ? resolveOrthogonalClosureAssist({
              layout,
              activeNodeId: currentActiveDrawNodeId,
              candidatePoint: resolved.point,
            })
          : null;
      setOrthogonalClosureAssist(assist?.isEligible ? assist : null);
      setClosureCornerSnap(
        resolved.closure && resolved.closure.rawDistancePx <= GUIDE_CAPTURE_RADIUS_PX
          ? { point: resolved.closure.exactCorner, captured: resolved.closure.captured }
          : null,
      );
      return;
    }

    if (event.kind === 'draw_point' && event.planX != null && event.planZ != null) {
      const exactLength = segmentLengthInput ? Number(segmentLengthInput) : undefined;
      const currentActiveDrawNodeId =
        activeDrawNodeId && layout.nodes.some((node) => node.id === activeDrawNodeId)
          ? activeDrawNodeId
          : null;
      const resolved = resolveActiveWallDrawPoint(
        { x: event.planX, z: event.planZ },
        {
          activeNodeId: currentActiveDrawNodeId,
          shiftHeld: event.shiftHeld,
          altHeld: event.altHeld,
          exactLengthMeters: exactLength,
        },
      );
      const point = resolved.point;
      if (!currentActiveDrawNodeId) {
        const snappedNodeId =
          (resolved.snapTarget.type === 'node' || resolved.snapTarget.type === 'endpoint') &&
          resolved.snapTarget.sourceId
            ? resolved.snapTarget.sourceId
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
        exactLengthMeters: resolved.closure?.captured ? undefined : exactLength,
        wallHeightMeters: layout.defaultWallHeightMeters,
        wallRole: drawWallRole,
      });
      commitWallLayout(next, 'Draw wall', 'wall_add');
      if (layout.segments.length === 0 && !hasUserAdjustedPlanViewRef.current) {
        issueViewCommand('fit');
        pending3dFitRef.current = true;
      }
      setActiveDrawNodeId(resolveActiveDrawNodeId(next));
      if (resolved.snapTarget.type === 'line') {
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

    if (event.kind === 'draw_preview' && event.planX != null && event.planZ != null && activeDrawNodeId) {
      const currentActiveDrawNodeId =
        layout.nodes.some((node) => node.id === activeDrawNodeId)
          ? activeDrawNodeId
          : resolveActiveDrawNodeId(layout);
      if (!currentActiveDrawNodeId) return;
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
      if (layout.orthogonalLock && guidance.kind !== 'free') {
        point = guidance.point;
      }
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
          : null;
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
        wallRole: drawWallRole,
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
      const point = snapPlanPoint(event.planX, event.planZ, snapLayout, moduleLength);
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
      setSelectedAnnotationId(null);
      setSelectedComponentId(event.componentId);
      setSelectedSepticTankId(null);
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
      setSelectedAnnotationId(null);
      setSelectedComponentId(event.componentId);
      setSaveState('unsaved');
      setChangedAfterCommit(true);
      setStatus({ tone: 'success', message: 'Column moved.' });
      return;
    }

    if (event.kind === 'select_node' && event.nodeId) {
      setSelectedAnnotationId(null);
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
        setSelectedAnnotationId(null);
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
      setSelectedAnnotationId(null);
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

      if (septicTankPlacementActive && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setSepticTankPlacementRotationRad((current) => current + Math.PI / 2);
        return;
      }
      if (viewMode === '2d' && active2DView === 'plumbing-plan' && activePlumbingToolMode === 'fixture' && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setPlumbingFixtureRotationRad((current) => current + Math.PI / 2);
        return;
      }

      const snapAction = snapKeyboardActionForEvent(event);
      if (snapAction) {
        if (
          snapAction.kind === 'toggle-object-snap' ||
          snapAction.kind === 'toggle-grid-snap' ||
          snapAction.kind === 'toggle-ortho' ||
          snapAction.kind === 'toggle-polar' ||
          snapAction.kind === 'cycle-candidate' ||
          snapAction.kind === 'toggle-object-type' ||
          snapAction.kind === 'horizontal-lock' ||
          snapAction.kind === 'vertical-lock'
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        if (snapAction.kind === 'toggle-object-snap') {
          setObjectSnapEnabled((current) => !current);
          return;
        }
        if (snapAction.kind === 'toggle-grid-snap') {
          setSnapMode((current) => (current === 'grid' ? 'off' : 'grid'));
          return;
        }
        if (snapAction.kind === 'toggle-ortho') {
          toggleOrthogonalGuides();
          return;
        }
        if (snapAction.kind === 'toggle-polar') {
          setPolarTrackingEnabled((current) => !current);
          return;
        }
        if (snapAction.kind === 'cycle-candidate') {
          setSnapCycleIndex((current) => current + 1);
          return;
        }
        if (snapAction.kind === 'toggle-object-type') {
          if (snapAction.key === 'endpoint') setEndpointSnapEnabled((current) => !current);
          if (snapAction.key === 'midpoint') setMidpointSnapEnabled((current) => !current);
          if (snapAction.key === 'intersection') setIntersectionSnapEnabled((current) => !current);
          if (snapAction.key === 'nearest') setNearestSnapEnabled((current) => !current);
          if (snapAction.key === 'perpendicular') setPerpendicularSnapEnabled((current) => !current);
          return;
        }
        if (snapAction.kind === 'horizontal-lock') {
          setHorizontalSnapLock((current) => !current);
          setVerticalSnapLock(false);
          return;
        }
        if (snapAction.kind === 'vertical-lock') {
          setVerticalSnapLock((current) => !current);
          setHorizontalSnapLock(false);
          return;
        }
        if (snapAction.kind === 'finish-command' && toolMode === 'draw_wall') {
          event.preventDefault();
          clearTransientPlanCommandState({ switchToSelect: true });
          return;
        }
      }

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
        if (septicTankPlacementActive) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setSepticTankPlacementActive(false);
          setStatus({ tone: 'info', message: 'CMU septic tank placement cancelled.' });
          return;
        }
        if (plumbingRunDraft) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (!finishPlumbingRunDraft()) {
            setActivePlumbingToolMode('select');
            setStatus({ tone: 'info', message: 'Pipe run drawing ended.' });
          }
          return;
        }
        if (
          viewMode === '2d' &&
          active2DView === 'plumbing-plan' &&
          (plumbingRunSystemForTool(activePlumbingToolMode) ||
            activePlumbingToolMode === 'cleanout' ||
            activePlumbingToolMode === 'valve' ||
            activePlumbingToolMode === 'stack' ||
            activePlumbingToolMode === 'connect_fixture')
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setActivePlumbingToolMode('select');
          setPlumbingEquipmentPreview(null);
          setStatus({ tone: 'info', message: plumbingRunSystemForTool(activePlumbingToolMode) ? 'Pipe drawing tool ended.' : 'Plumbing placement tool ended.' });
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
        if (selectedSegmentId || selectedNodeId || selectedOpeningId || selectedComponentId || selectedSepticTankId || selectedObjectType || selectedAnnotationId) {
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
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId) {
        event.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        ((selectedPlumbingObject && selectedPlumbingObject.kind !== 'none') || selectedSepticTankId)
      ) {
        event.preventDefault();
        deleteSelectedPlumbingObject();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    active2DView,
    activePlumbingToolMode,
    annotations,
    modelLoaded,
    plumbingRunDraft,
    plumbingSystem,
    selectedComponentId,
    selectedAnnotationId,
    selectedObjectType,
    selectedOpeningId,
    selectedNodeId,
    selectedPlumbingObject,
    selectedSegmentId,
    selectedSepticTankId,
    septicTankPlacementActive,
    toolMode,
    placementPreview,
    viewMode,
    wallLayout,
  ]);

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
          setSelectedAnnotationId(null);
          setSelectedObjectType(event.objectType ?? null);
          setSelectedOpeningId(null);
          setSelectedSegmentId(null);
          setSelectedNodeId(null);
          setSelectedPlumbingObject(null);
          setSelectedSepticTankId(null);
          setPlacementPreview(null);
          break;
        case 'select_opening':
          if (event.openingId) {
            setSelectedAnnotationId(null);
            setSelectedOpeningId(event.openingId);
            setSelectedSegmentId(null);
            setSelectedNodeId(null);
            setSelectedPlumbingObject(null);
            setSelectedSepticTankId(null);
            const opening = wall.openings.find((item) => item.id === event.openingId);
            if (opening) {
              setSelectedObjectType(opening.type === 'door' ? 'door_opening' : 'window_opening');
            }
          }
          break;
        case 'select_plumbing':
          if (event.plumbingSelection) {
            handlePlumbingSelect(event.plumbingSelection);
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
        plumbing3DVisibility,
        materialSelections,
      }, placedComponents, annotations, plumbingSystem);
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

  function buildCurrentRoofDebugSnapshot() {
    const resources = createDesignBuilderViewerResources();
    try {
      const roofAssemblyScene = buildDesignBuilderViewerRoofAssemblyScene({
        state: {
          currentGeometry: designGeometryResult,
          currentSlab: resolvedPreset.slab,
          currentVisualStyle: visualStyle,
          currentRoofSystem: activeRoofSystem,
          currentRoofDisplayMode: roofDisplayMode,
          currentFoundationViewMode: foundationViewMode,
          currentRoofLayerVisibility: roofLayerVisibility,
          currentShowRoofFramingGuides: showRoofFramingGuides,
          usePreviewMaterials: visualStyle === 'material_preview',
          roofSelected: selectedObjectType === 'gable_roof_system',
          gableSelected: selectedObjectType === 'gable_end_system',
        },
        trackGeometry: resources.trackGeometry,
        trackMaterial: resources.trackMaterial,
        makeMaterial: resources.makeMaterial,
      });
      const renderSnapshot = createDesignBuilderViewerRoofRenderDebugSnapshot({
        roofAssemblyScene,
      });
      return createDesignBuilderRoofDebugSnapshot({
        geometryResult: designGeometryResult,
        roofSystem: activeRoofSystem,
        slabTopMeters: resolvedPreset.slab.slabThicknessMeters,
        wallLayout,
        renderSnapshot,
      });
    } finally {
      resources.disposeTrackedResources();
    }
  }

  async function handleCopyRoofDebugSnapshot() {
    if (!import.meta.env.DEV) return;
    try {
      const snapshot = buildCurrentRoofDebugSnapshot();
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setStatus({ tone: 'success', message: 'Roof debug snapshot copied.' });
    } catch (error) {
      console.error('Failed to copy roof debug snapshot', error);
      setStatus({ tone: 'error', message: 'Roof debug snapshot could not be copied.' });
    }
  }

  function handleDownloadRoofDebugSnapshot() {
    if (!import.meta.env.DEV) return;
    if (!designGeometryResult.resolvedRoofSystem) {
      setStatus({ tone: 'warning', message: 'No resolved roof is available to download.' });
      return;
    }
    try {
      const snapshot = buildCurrentRoofDebugSnapshot();
      const filename = roofDebugSnapshotFilename({
        timestamp: new Date(),
        widthMeters: resolvedPreset.wall.widthMeters,
        lengthMeters: resolvedPreset.wall.lengthMeters,
      });
      downloadJsonFile(filename, snapshot);
      setStatus({ tone: 'success', message: 'Roof debug snapshot downloaded.' });
    } catch (error) {
      console.error('Failed to download roof debug snapshot', error);
      setStatus({ tone: 'error', message: 'Roof debug snapshot could not be downloaded.' });
    }
  }

  function handleApplyMaterialSelections(payload: MaterialsColorsApplyPayload) {
    const normalized = normalizeDesignMaterialSelection(payload.selections);
    setMaterialSelections(normalized);
    const nextPlasterFinish = finishForPlasterMaterialId(normalized.plasterMaterialId);
    if (payload.plaster && resolvedPreset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill') {
      applyPresetPatch(
        (current) => ({
          ...current,
          infillSystem: {
            ...normalizeCmuInfillSystem(current.infillSystem),
            plaster: normalizeCmuInfillPlasterSettings(payload.plaster),
          },
        }),
        'Edit plaster finish',
        'masonry_settings_update',
      );
    } else if (
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
    setSelectedAnnotationId(null);
    setSelectedObjectType(null);
    setSelectedOpeningId(null);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setSelectedComponentId(null);
    setSelectedSepticTankId(null);
    setSelectedPlumbingObject(null);
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
    clearTransientPlanCommandState();
    setToolMode('draw_wall');
    setActive2DDrawingView('foundation-plan');
  }

  function activateToolMode(mode: DesignBuilderToolMode) {
    closeDesignBuilderCommandMenus();
    setSepticTankPlacementActive(false);
    setPlumbingRunDraft(null);
    if (mode === 'draw_wall') {
      activateDrawWallTool();
      return;
    }
    if (toolMode === 'draw_wall') clearTransientPlanCommandState();
    setToolMode(mode);
    if ((mode === 'place_dimension' || mode === 'place_angle') && (viewMode !== '2d' || active2DView === 'elevation-view')) {
      setActive2DDrawingView('foundation-plan');
    }
    if (mode === 'move_wall_node') setActive2DDrawingView('foundation-plan');
    if (mode === 'select') setPlacementPreview(null);
  }

  function activateCmuSepticTankPlacement() {
    closeDesignBuilderCommandMenus();
    clearTransientPlanCommandState();
    clearSelection();
    setViewMode('2d');
    setActive2DDrawingView('plumbing-plan');
    setToolMode('select');
    setActivePlumbingToolMode('select');
    setPlumbingRunDraft(null);
    setSepticTankPlacementActive(true);
    setSepticTankPlacementRotationRad(0);
    setStatus({ tone: 'info', message: 'Place CMU septic tank in top-down plumbing plan. Press R to rotate, Esc to cancel.' });
  }

  async function handleStartBlankLayout() {
    const hasDesignData =
      wallLayout.nodes.length > 0 ||
      wallLayout.segments.length > 0 ||
      resolvedPreset.wall.openings.length > 0 ||
      plumbingSystem.fixtures.length > 0 ||
      plumbingSystem.runs.length > 0 ||
      plumbingSystem.septicTanks.length > 0 ||
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
    setPlumbingSystem(createDefaultPlumbingSystem());
    setAnnotations([]);
    setSelectedAnnotationId(null);
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
      plumbingSystem: createDefaultPlumbingSystem(),
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
  const snapSettings: SnapSettings = {
    snapMode,
    gridSpacingMeters: planSnapSpacingMeters,
    moduleLengthMeters: cmuModule.moduleLengthMeters,
    tolerancePx: tolerancePxForPreset(snapTolerancePreset),
    tolerancePreset: snapTolerancePreset,
    objectSnap: {
      enabled: objectSnapEnabled,
      endpoint: endpointSnapEnabled,
      midpoint: midpointSnapEnabled,
      intersection: intersectionSnapEnabled,
      nearest: nearestSnapEnabled,
      perpendicular: perpendicularSnapEnabled,
      extension: false,
    },
    orthogonal: wallLayout.orthogonalLock,
    polar: polarTrackingEnabled,
    polarAnglesDegrees: [0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
  };
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
        : toolMode === 'place_angle'
          ? 'Pick ray point, vertex, then second ray point'
        : toolMode === 'move_wall_node'
        ? 'Drag node - Esc exits'
        : toolMode === 'move_opening'
          ? 'Drag selected opening along wall segment'
        : septicTankPlacementActive
          ? 'CMU septic tank placement - Click plan to place - R rotates - Esc cancels'
          : null;
  const activeOpeningTool = toolMode === 'place_door' ? 'door' : toolMode === 'place_window' ? 'window' : null;
  const activeOpeningSettings = activeOpeningTool ? openingToolSettings[activeOpeningTool] : null;
  const closeFootprintEnabled = modelLoaded && !footprintClosed && wallLayout.segments.length >= 3;
  const plumbingFixtureSchedule = buildPlumbingFixtureSchedule(plumbingSystem);
  const plumbingLegendItems = buildPlumbingLegend(plumbingSystem);
  const plumbingLegendItemKeys = new Set(plumbingLegendItems.map((item) => item.key));
  const activePlumbingLegendRows = PLUMBING_LEGEND_ROWS.filter((item) => plumbingLegendItemKeys.has(item.key));
  const plumbingPlacementActive = viewMode === '2d' && active2DView === 'plumbing-plan';
  const selectedPlumbingFixture =
    selectedPlumbingObject?.kind === 'fixture'
      ? plumbingSystem.fixtures.find((fixture) => fixture.id === selectedPlumbingObject.id) ?? null
      : null;
  const selectedPlumbingRun =
    selectedPlumbingObject?.kind === 'run'
      ? plumbingSystem.runs.find((run) => run.id === selectedPlumbingObject.id) ?? null
      : null;
  const selectedPlumbingFitting =
    selectedPlumbingObject?.kind === 'fitting'
      ? (plumbingSystem.fittings ?? []).find((fitting) => fitting.id === selectedPlumbingObject.id) ?? null
      : null;
  const selectedPlumbingRoughIn =
    selectedPlumbingObject?.kind === 'rough-in'
      ? (plumbingSystem.roughIns ?? []).find((roughIn) => roughIn.id === selectedPlumbingObject.id) ?? null
      : null;
  const selectedPlumbingEquipment =
    selectedPlumbingObject?.kind === 'equipment'
      ? plumbingSystem.equipment.find((equipment) => equipment.id === selectedPlumbingObject.id) ?? null
      : null;
  const activePlumbingAction = activePlumbingPrimaryAction();
  const activePipeSystem = plumbingRunSystemForTool(activePlumbingToolMode) ?? plumbingPipeDefaults.system;
  const displayedPipeSystem = selectedPlumbingRun?.system ?? activePipeSystem;
  const activePipeSystemLabel = PLUMBING_PIPE_SYSTEM_OPTIONS.find((option) => option.system === displayedPipeSystem)?.label ?? 'Sanitary';
  const activeFixtureDefinition = getPlumbingFixtureDefinition(activePlumbingFixtureType);
  const plumbingStatusHint = septicTankPlacementActive
    ? 'Septic Tank - Click plan to place - R rotates - Esc cancels'
    : selectedPlumbingRun
      ? `${activePipeSystemLabel} pipe selected - Edit properties in the inspector`
      : selectedPlumbingFixture
        ? `${selectedPlumbingFixture.mark} selected - Edit mark or rotation in the inspector`
      : selectedPlumbingRoughIn
        ? `${selectedPlumbingRoughIn.system.replace('_', ' ')} rough-in selected - Edit label or delete in the inspector`
        : activePlumbingAction === 'pipe'
          ? `Pipe Tool - ${activePipeSystemLabel} - Click start node, route points, then end node - Shift snaps angle - Esc finishes`
        : activePlumbingAction === 'fixture'
          ? `Fixture Tool - ${PLUMBING_FIXTURE_SHORT_LABELS[activePlumbingFixtureType]} selected - Press R to rotate - Click to place`
        : activePlumbingAction === 'connect_fixture'
          ? 'Connect Fixture - Select a fixture, then click a matching drain, vent, or water run'
          : activePlumbingAction === 'cleanout'
            ? 'Cleanout Tool - Move over a sanitary drain line - Click to place'
            : activePlumbingAction === 'valve'
              ? 'Valve Tool - Move over a cold or hot water line - Click to place'
              : activePlumbingAction === 'stack'
                ? 'Stack Tool - Move over a sanitary waste or vent line - Click to place'
          : activePlumbingAction === 'select'
            ? 'Select Tool - Click fixtures, pipes, equipment, or septic tanks to inspect'
              : `${[...PLUMBING_PRIMARY_ACTIONS, ...PLUMBING_ACTION_MENU_ITEMS].find((item) => item.action === activePlumbingAction)?.label ?? 'Plumbing'} Tool`;

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
          <DesignBuilderObjectTreePanel
            objectTreeExpanded={objectTreeExpanded}
            modelLoaded={modelLoaded}
            wallSegments={wallLayout.segments}
            openings={resolvedPreset.wall.openings}
            septicTanks={plumbingSystem.septicTanks}
            selectedObjectType={selectedObjectType}
            selectedOpeningId={selectedOpeningId}
            selectedSepticTankId={selectedSepticTankId}
            selectedSegmentId={selectedSegmentId}
            onToggleGroup={toggleObjectTreeGroup}
            onSelectObjectType={selectObjectTreeObjectType}
            onSelectSegment={selectObjectTreeSegment}
            onSelectOpening={selectObjectTreeOpening}
            onSelectSepticTank={selectObjectTreeSepticTank}
          />
          <Panel title={selectedObjectType || selectedSegmentId || selectedSepticTank ? `Edit ${selectedObjectLabel}` : selectedObjectLabel}>
            {selectedSepticTank ? (
              <DesignBuilderSepticTankControls
                tank={selectedSepticTank}
                nodes={plumbingSystem.nodes}
                onTankChange={updateSelectedSepticTank}
                onPlacementChange={updateSelectedSepticTankPlacement}
                onDesignBasisChange={updateSelectedSepticTankDesignBasis}
                onGeometryChange={updateSelectedSepticTankGeometry}
              />
            ) : (
              <DesignBuilderEditableControls
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
                moduleWarnings={moduleWarnings}
                cmuLayout={cmuLayout}
                selectedWallSegment={selectedWallSegment}
                onSlabChange={updateSlabField}
                onRoofChange={updateRoofField}
                onTrussSpacingChange={updateTrussSpacing}
                onStructureFieldChange={updateStructureField}
                onInfillPlasterChange={updateInfillPlaster}
                onGableFieldChange={updateGableField}
                onOpeningChange={updateSelectedOpening}
                selectedOpeningId={selectedOpeningId}
              />
            )}
          </Panel>

          <DesignBuilderLinkedQuantitiesPanel linkedPreviewLines={linkedPreviewLines} />
        </aside>

        <main className={`min-h-0 ${focusMode ? 'flex flex-col overflow-hidden' : 'space-y-4'}`}>
          <DesignBuilderCommandBar
            activeToolLabel={activeToolLabel}
            toolMode={toolMode}
            toolOptions={TOOL_MODE_OPTIONS}
            modelLoaded={modelLoaded}
            onActivateToolMode={activateToolMode}
            componentDefinitionGroups={componentDefinitionGroups}
            activeComponentType={componentPlacement.activeComponentType}
            onActivateDesignComponent={activateDesignComponent}
            onActivateCmuSepticTank={activateCmuSepticTankPlacement}
            viewMode={viewMode}
            onViewModeChange={setDesignBuilderViewMode}
            active2DView={active2DView}
            onActive2DViewChange={setActive2DDrawingView}
            structureMenuLabel={structureMenuLabel}
            activeBuildingSystemMode={activeBuildingSystemMode}
            isFrameStructureMode={isFrameStructureMode}
            onSetBuildingSystemMode={handleSetBuildingSystemMode}
            onOpenFrameFoundationSettings={() => setFrameFoundationModalOpen(true)}
            footprintClosed={footprintClosed}
            snapMode={snapMode}
            onSnapModeChange={setSnapMode}
            orthogonalGuidesEnabled={wallLayout.orthogonalLock}
            onToggleOrthogonalGuides={toggleOrthogonalGuides}
            objectSnapEnabled={objectSnapEnabled}
            onObjectSnapEnabledChange={setObjectSnapEnabled}
            endpointSnapEnabled={endpointSnapEnabled}
            onEndpointSnapEnabledChange={setEndpointSnapEnabled}
            midpointSnapEnabled={midpointSnapEnabled}
            onMidpointSnapEnabledChange={setMidpointSnapEnabled}
            intersectionSnapEnabled={intersectionSnapEnabled}
            onIntersectionSnapEnabledChange={setIntersectionSnapEnabled}
            nearestSnapEnabled={nearestSnapEnabled}
            onNearestSnapEnabledChange={setNearestSnapEnabled}
            perpendicularSnapEnabled={perpendicularSnapEnabled}
            onPerpendicularSnapEnabledChange={setPerpendicularSnapEnabled}
            polarTrackingEnabled={polarTrackingEnabled}
            onPolarTrackingEnabledChange={setPolarTrackingEnabled}
            snapTolerancePreset={snapTolerancePreset}
            onSnapTolerancePresetChange={setSnapTolerancePreset}
            gridSpacingMeters={wallLayout.gridSpacingMeters}
            onApplyGridScalePreset={applyGridScalePreset}
            moduleFitMode={moduleFitMode}
            onModuleFitModeChange={setModuleFitMode}
            onResolveModuleFit={resolveCurrentFootprintModuleFit}
            onFitView={() => setViewCommand({ id: Date.now(), action: 'fit' })}
            onResetView={() => setViewCommand({ id: Date.now(), action: 'reset' })}
            onApplyViewerHeightPreset={applyViewerHeightPreset}
            onCloseFootprint={() => void handleCloseFootprint()}
            closeFootprintEnabled={closeFootprintEnabled}
            onRepairFootprintToExactRectangle={handleRepairFootprintToExactRectangle}
            repairFootprintEnabled={Boolean(repairableOrthogonalFootprint)}
            onHelp={() => setStatus({ tone: 'info', message: DESIGN_BUILDER_COPY.hints.help })}
            buildingSystemMode={resolvedPreset.buildingSystemMode}
            showOpeningLayout={showOpeningLayout}
            onShowOpeningLayoutChange={setShowOpeningLayout}
            showGroutCells={showGroutCells}
            onShowGroutCellsChange={setShowGroutCells}
            showClosureWarnings={showClosureWarnings}
            onShowClosureWarningsChange={setShowClosureWarnings}
            visualStyle={visualStyle}
            onVisualStyleChange={setVisualStyle}
            onOpenMaterials={() => setMaterialsModal({ open: true, scope: 'all' })}
            twoDDrawingStyle={twoDDrawingStyle}
            onTwoDDrawingStyleChange={setTwoDDrawingStyle}
            showRoofReferencePerimeters={showRoofReferencePerimeters}
            onShowRoofReferencePerimetersChange={setShowRoofReferencePerimeters}
            showRoofFramingGuides={showRoofFramingGuides}
            onShowRoofFramingGuidesChange={setShowRoofFramingGuides}
            showRoofDebug={showRoofDebug}
            onShowRoofDebugChange={setShowRoofDebug}
            showRoofPlanHatch={showRoofPlanHatch}
            onShowRoofPlanHatchChange={setShowRoofPlanHatch}
            showRoofPlanSlopeArrows={showRoofPlanSlopeArrows}
            onShowRoofPlanSlopeArrowsChange={setShowRoofPlanSlopeArrows}
            showRoofPlanDimensions={showRoofPlanDimensions}
            onShowRoofPlanDimensionsChange={setShowRoofPlanDimensions}
            showRoofPlanReferenceLines={showRoofPlanReferenceLines}
            onShowRoofPlanReferenceLinesChange={setShowRoofPlanReferenceLines}
            showRoofPlanTrussReferenceSheet={showRoofPlanTrussReferenceSheet}
            onShowRoofPlanTrussReferenceSheetChange={setShowRoofPlanTrussReferenceSheet}
            foundationViewMode={foundationViewMode}
            onFoundationViewModeChange={setFoundationViewMode}
            roofDisplayMode={roofDisplayMode}
            onRoofDisplayModeChange={setRoofDisplayMode}
            roofLayerVisibility={roofLayerVisibility}
            onRoofLayerVisibilityChange={setRoofLayerVisibility}
            plumbing3DVisibility={plumbing3DVisibility}
            onPlumbing3DVisibilityChange={setPlumbing3DVisibility}
            onUndo={handleUndoDesign}
            onRedo={handleRedoDesign}
            canUndo={canUndoDesignHistory(designHistory)}
            canRedo={canRedoDesignHistory(designHistory)}
            undoLabel={nextUndoCommand ? `Undo ${nextUndoCommand.label}` : 'Undo'}
            undoTitle={nextUndoCommand ? `Undo ${nextUndoCommand.label}` : 'Undo'}
            redoLabel={nextRedoCommand ? `Redo ${nextRedoCommand.label}` : 'Redo'}
            redoTitle={nextRedoCommand ? `Redo ${nextRedoCommand.label}` : 'Redo'}
            onToggleLeftPanel={toggleLeftPanel}
            onToggleRightPanel={toggleRightPanel}
            onStartBlankLayout={() => void handleStartBlankLayout()}
            onSaveDesign={() => void handleSaveDesign()}
            onCopyRoofDebugSnapshot={() => void handleCopyRoofDebugSnapshot()}
            onDownloadRoofDebugSnapshot={handleDownloadRoofDebugSnapshot}
            busy={busy}
            canPersist={persistenceContext.canPersist}
          />
          <DesignBuilderToolInstructionStrip
            toolInstruction={toolInstruction}
            toolMode={toolMode}
            segmentLengthInput={segmentLengthInput}
            onSegmentLengthInputChange={setSegmentLengthInput}
            wallHeightMeters={wallLayout.defaultWallHeightMeters}
            onWallHeightChange={(defaultWallHeightMeters) =>
              mutateWallLayoutSilent({
                ...wallLayout,
                defaultWallHeightMeters,
              })
            }
            drawWallRole={drawWallRole}
            onDrawWallRoleChange={setDrawWallRole}
            unitSystem={unitSystem}
            orthogonalGuidesEnabled={wallLayout.orthogonalLock}
            onToggleOrthogonalGuides={toggleOrthogonalGuides}
            activeOpeningTool={activeOpeningTool}
            activeOpeningSettings={activeOpeningSettings}
            onOpeningToolSettingChange={(tool, patch) =>
              setOpeningToolSettings((current) => ({
                ...current,
                [tool]: { ...current[tool], ...patch },
              }))
            }
            snapMode={snapMode}
            selectedComponentId={selectedComponentId}
            selectedComponent={selectedComponent}
            selectedOpeningId={selectedOpeningId}
            activeSelection={activeSelection}
            onDeleteSelectedComponent={handleDeleteSelectedComponent}
            onDeleteSelectedOpening={handleDeleteSelectedOpening}
            onDeleteSelectedSegment={handleDeleteSelectedSegment}
          />
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
                snapSettings={snapSettings}
                snapCycleIndex={snapCycleIndex}
                horizontalSnapLock={horizontalSnapLock}
                verticalSnapLock={verticalSnapLock}
                shiftConstraintLabel={drawWallConstraintLabel}
                previewMetrics={drawWallPreviewMetrics}
                orthogonalClosureAssist={orthogonalClosureAssist}
                closureCornerSnap={closureCornerSnap}
                segmentFrames={planSegmentFrames}
                openingItems={planOpeningItems}
                openingPreview={planOpeningPreview}
                frameSystem={designGeometryResult.frameSystem}
                isolatedFootings={designGeometryResult.isolatedFootings}
                wallFootings={designGeometryResult.wallFootings}
                resolvedRoofSystem={designGeometryResult.resolvedRoofSystem ?? null}
                roofSystem={activeRoofSystem}
                roofPlanDisplay={{
                  showHatch: showRoofPlanHatch,
                  showSlopeArrows: showRoofPlanSlopeArrows,
                  showDimensions: showRoofPlanDimensions,
                  showReferenceLines: showRoofPlanReferenceLines,
                  showTrussDesignDetail: showRoofPlanTrussReferenceSheet,
                }}
                selectedObjectType={selectedObjectType}
                selectedAnnotationId={selectedAnnotationId}
                drawingStyleMode={twoDDrawingStyle}
                active2DView={active2DView}
                annotations={annotations}
                placedComponents={placedComponents}
                plumbingSystem={plumbingSystem}
                activePlumbingFixtureType={plumbingPlacementActive && activePlumbingToolMode === 'fixture' && !septicTankPlacementActive ? activePlumbingFixtureType : null}
                plumbingEquipmentPreview={plumbingEquipmentPreview}
                activePlumbingToolMode={activePlumbingToolMode}
                plumbingFixtureRotationRad={plumbingFixtureRotationRad}
                plumbingRunDraft={plumbingRunDraft}
                selectedPlumbingObject={selectedPlumbingObject}
                plumbingValidationIssues={plumbingValidationIssues}
                septicTankPlacementActive={plumbingPlacementActive && septicTankPlacementActive}
                septicTankPlacementRotationRad={septicTankPlacementRotationRad}
                selectedSepticTankId={selectedSepticTankId}
                designRenderModel={designRenderModel}
                componentPreview={componentPlacement.activeView === 'plan' ? componentPlacement.placementPreview : null}
                helperMeasurements={componentPlacement.activeView === 'plan' ? componentPlacement.helperMeasurements : []}
                onComponentPointer={handleComponentPointer}
                onPlumbingFixturePointer={handlePlumbingFixturePointer}
                onPlumbingPlanPointer={handlePlumbingPlanPointer}
                onPlumbingSelect={handlePlumbingSelect}
                onSepticTankPointer={handleSepticTankPointer}
                onSepticTankSelect={selectObjectTreeSepticTank}
                onAnnotationCreate={handleAnnotationCreate}
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
                segmentFrames={planSegmentFrames}
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
                plumbingSystem={plumbingSystem}
                selectedPlumbingObject={selectedPlumbingObject}
                plumbing3DVisibility={plumbing3DVisibility}
                selectedSepticTankId={selectedSepticTankId}
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
                showRoofDebug={showRoofDebug}
                foundationViewMode={foundationViewMode}
                visualStyle={visualStyle}
                roofSystem={activeRoofSystem}
                roofDisplayMode={roofDisplayMode}
                roofLayerVisibility={roofLayerVisibility}
                materialRevision={materialRevision}
              />
            )}
            {toolMode === 'place_component' ? (
              <DesignBuilderComponentParameterPanel
                definition={componentPlacement.activeComponentDefinition}
                draftParameters={componentPlacement.draftComponentParameters}
                errors={componentPlacement.placementStatus.errors}
                position={componentPanelPosition}
                collapsed={componentPanelCollapsed}
                viewLabel={
                  activeCanvasView === 'elevation'
                    ? `View: X / Z on ${elevationView.face.toUpperCase()} face`
                    : 'View: X / Y plan placement'
                }
                onDragStart={handleComponentPanelDragStart}
                onCollapsedChange={setComponentPanelCollapsed}
                onCancel={cancelComponentPlacement}
                onParameterChange={handleComponentParameterChange}
              />
            ) : null}
            {plumbingPlacementActive ? (
              <div
                data-plumbing-overlay-panel="true"
                className="absolute w-max max-w-[min(520px,calc(100%-1.5rem))] rounded-lg border border-slate-300 bg-white/95 p-2.5 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                style={plumbingOverlayStyle('tools')}
              >
                <div
                  className="mb-2 flex cursor-move select-none items-center justify-between gap-3 rounded-md"
                  onPointerDown={(event) => handlePlumbingOverlayDragStart('tools', event)}
                  title="Drag to move plumbing tools"
                >
                  <div className="font-bold text-slate-950 dark:text-white">Plumbing</div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Drag to move</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PLUMBING_PRIMARY_ACTIONS.map((tool) => {
                    const active = activePlumbingAction === tool.action && !septicTankPlacementActive;
                    return (
                      <button
                        key={tool.action}
                        type="button"
                        onClick={() => {
                          setSepticTankPlacementActive(false);
                          setPlumbingRunDraft(null);
                          setPlumbingEquipmentPreview(null);
                          if (tool.action === 'validate') {
                            setActivePlumbingToolMode('validate');
                            validateCurrentPlumbingSystem();
                            return;
                          }
                          if (tool.action === 'pipe') {
                            selectPlumbingPipeSystem(plumbingPipeDefaults.system);
                            return;
                          }
                          setActivePlumbingToolMode(tool.action);
                        }}
                        className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                          active
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {tool.label}
                      </button>
                    );
                  })}
                  <select
                    aria-label="Plumbing action menu"
                    value={PLUMBING_ACTION_MENU_ITEMS.some((item) => item.action === activePlumbingAction) ? activePlumbingAction : ''}
                    onChange={(event) => {
                      const action = event.target.value as PlumbingPrimaryAction | '';
                      if (!action) return;
                      setSepticTankPlacementActive(false);
                      setPlumbingRunDraft(null);
                      setPlumbingEquipmentPreview(null);
                      if (action === 'validate') {
                        setActivePlumbingToolMode('validate');
                        validateCurrentPlumbingSystem();
                        return;
                      }
                      setActivePlumbingToolMode(action);
                    }}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                      PLUMBING_ACTION_MENU_ITEMS.some((item) => item.action === activePlumbingAction)
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <option value="">Actions</option>
                    {PLUMBING_ACTION_MENU_ITEMS.map((item) => (
                      <option key={item.action} value={item.action}>{item.label}</option>
                    ))}
                  </select>
                </div>
                {activePlumbingAction === 'fixture' && !septicTankPlacementActive ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                    {PLUMBING_FIXTURE_LIBRARY_ORDER.map((fixtureType) => {
                      const active = activePlumbingFixtureType === fixtureType;
                      return (
                        <button
                          key={fixtureType}
                          type="button"
                          onClick={() => setActivePlumbingFixtureType(fixtureType)}
                          className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                            active
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {PLUMBING_FIXTURE_SHORT_LABELS[fixtureType]}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {activePlumbingAction === 'pipe' && !septicTankPlacementActive ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                    {PLUMBING_PIPE_SYSTEM_OPTIONS.map((option) => {
                      const active = activePipeSystem === option.system;
                      return (
                        <button
                          key={option.system}
                          type="button"
                          onClick={() => selectPlumbingPipeSystem(option.system)}
                          className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                            active
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-2 rounded-md border border-cyan-500/30 bg-cyan-950/10 px-2 py-1.5 text-[11px] font-semibold text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-100">
                  {plumbingStatusHint}
                </div>
              </div>
            ) : null}
            {plumbingPlacementActive && plumbingFixtureSchedule.length > 0 && !plumbingFixtureScheduleExpanded ? (
              <button
                type="button"
                onClick={() => setPlumbingFixtureScheduleExpanded(true)}
                className="absolute bottom-4 right-[9rem] z-10 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-left text-[11px] font-bold text-slate-100 shadow-sm hover:border-cyan-500 hover:text-cyan-100"
                aria-label="Open fixture schedule"
              >
                <div className="text-cyan-200">Fixture Schedule</div>
                <div className="text-[10px] font-semibold text-slate-400">
                  {plumbingFixtureSchedule.length} fixture{plumbingFixtureSchedule.length === 1 ? '' : 's'}
                </div>
              </button>
            ) : null}
            {plumbingPlacementActive && plumbingFixtureSchedule.length > 0 && plumbingFixtureScheduleExpanded ? (
              <div
                data-plumbing-overlay-panel="true"
                className="absolute max-h-56 w-[min(420px,calc(100%-1.5rem))] overflow-auto rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                style={plumbingOverlayStyle('schedule')}
              >
                <div
                  className="mb-2 flex cursor-move select-none items-center justify-between gap-3 font-bold text-slate-950 dark:text-white"
                  onPointerDown={(event) => handlePlumbingOverlayDragStart('schedule', event)}
                  title="Drag to move fixture schedule"
                >
                  <span>Fixture Schedule</span>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPlumbingFixtureScheduleExpanded(false);
                    }}
                    className="cursor-pointer rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Collapse fixture schedule"
                  >
                    Hide
                  </button>
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead className="text-left text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="border-b border-slate-200 py-1 dark:border-slate-700">Mark</th>
                      <th className="border-b border-slate-200 py-1 dark:border-slate-700">Fixture</th>
                      <th className="border-b border-slate-200 py-1 text-center dark:border-slate-700">CW</th>
                      <th className="border-b border-slate-200 py-1 text-center dark:border-slate-700">HW</th>
                      <th className="border-b border-slate-200 py-1 text-center dark:border-slate-700">SS</th>
                      <th className="border-b border-slate-200 py-1 text-center dark:border-slate-700">V</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plumbingFixtureSchedule.map((row) => (
                      <tr key={row.fixtureId}>
                        <td className="py-1 font-bold">{row.mark}</td>
                        <td className="py-1">{row.displayName}</td>
                        <td className="py-1 text-center">{row.coldWater ? 'Y' : '-'}</td>
                        <td className="py-1 text-center">{row.hotWater ? 'Y' : '-'}</td>
                        <td className="py-1 text-center">{row.sanitary ? 'Y' : '-'}</td>
                        <td className="py-1 text-center">{row.vent ? 'Y' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {plumbingPlacementActive ? (
              <div
                data-plumbing-overlay-panel="true"
                className="absolute w-[min(360px,calc(100%-1.5rem))] rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                style={plumbingOverlayStyle('properties')}
              >
                <div
                  className="mb-2 flex cursor-move select-none items-center justify-between gap-3"
                  onPointerDown={(event) => handlePlumbingOverlayDragStart('properties', event)}
                  title="Drag to move properties"
                >
                  <div className="font-bold text-slate-950 dark:text-white">
                    {selectedPlumbingFixture
                      ? 'Fixture Properties'
                      : selectedPlumbingRun
                        ? 'Pipe Properties'
                        : selectedPlumbingFitting
                          ? 'Fitting Properties'
                          : selectedPlumbingRoughIn
                            ? 'Rough-In Properties'
                          : selectedPlumbingEquipment
                            ? 'Equipment Properties'
                            : selectedSepticTank
                              ? 'Septic Tank'
                              : activePlumbingAction === 'pipe'
                                ? 'Pipe Defaults'
                                : activePlumbingAction === 'fixture'
                                  ? 'Fixture Defaults'
                                  : 'Inspector'}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={plumbingSystem.codeProfileId}
                      onChange={(event) => {
                        const codeProfileId = event.target.value as PlumbingSystem['codeProfileId'];
                        setPlumbingSystem((current) => ({
                          ...current,
                          codeProfileId,
                          settings: { ...current.settings, codeProfileId },
                        }));
                        setSaveState('unsaved');
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      aria-label="Plumbing code profile"
                    >
                      <option value="conceptual">Conceptual</option>
                      <option value="guam_ipc_2009">Guam IPC 2009</option>
                      <option value="ipc_2024">IPC 2024</option>
                      <option value="upc_placeholder">UPC placeholder</option>
                      <option value="custom">Custom</option>
                    </select>
                    {selectedPlumbingObject || selectedSepticTank ? (
                      <button
                        type="button"
                        onClick={deleteSelectedPlumbingObject}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {selectedPlumbingFixture ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Type
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingFixture.displayName}</div>
                      </label>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Mark
                        <input
                          value={selectedPlumbingFixture.mark}
                          onChange={(event) => {
                            const mark = event.target.value;
                            setPlumbingSystem((current) => ({
                              ...current,
                              fixtures: current.fixtures.map((fixture) =>
                                fixture.id === selectedPlumbingFixture.id ? { ...fixture, mark } : fixture,
                              ),
                            }));
                            setSaveState('unsaved');
                          }}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Rotation {Math.round(selectedPlumbingFixture.rotationRadians * 180 / Math.PI)} deg
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => rotateSelectedPlumbingFixture(-Math.PI / 2)}
                          aria-label="Rotate fixture counterclockwise 90 degrees"
                          title="Rotate fixture counterclockwise 90 degrees"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateSelectedPlumbingFixture(Math.PI / 2)}
                          aria-label="Rotate fixture clockwise 90 degrees"
                          title="Rotate fixture clockwise 90 degrees"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <RotateCw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Required connections: {Object.entries(selectedPlumbingFixture.connectionNodeIds)
                        .filter(([, ids]) => (ids?.length ?? 0) > 0)
                        .map(([system]) => system.replace('_', ' '))
                        .join(', ')}
                    </div>
                  </div>
                ) : selectedPlumbingRun ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      System
                      <select
                        value={selectedPlumbingRun.system}
                        onChange={(event) => {
                          const system = event.target.value as PlumbingRunSystem;
                          updateSelectedPlumbingRun(selectedPlumbingRun.id, {
                            system,
                            elevationMode: system === 'sanitary' ? selectedPlumbingRun.elevationMode : selectedPlumbingRun.elevationMode,
                            slopeInPerFt: system === 'sanitary' ? selectedPlumbingRun.slopeInPerFt : undefined,
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_PIPE_SYSTEM_OPTIONS.map((option) => (
                          <option key={option.system} value={option.system}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Diameter in.
                      <input
                        type="number"
                        step="0.25"
                        value={selectedPlumbingRun.diameterInches ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? null : Number(event.target.value);
                          updateSelectedPlumbingRun(selectedPlumbingRun.id, { diameterInches: value });
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Material
                      <select
                        value={selectedPlumbingRun.material}
                        onChange={(event) => {
                          const material = event.target.value as PlumbingMaterial;
                          const stockDefaults = defaultStockLengthForPipe({ material, system: selectedPlumbingRun.system });
                          updateSelectedPlumbingRun(selectedPlumbingRun.id, {
                            material,
                            schedule: defaultPipeScheduleForMaterial(material),
                            ...stockDefaults,
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_MATERIAL_OPTIONS.map((material) => (
                          <option key={material} value={material}>{material}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Schedule
                      <select
                        value={selectedPlumbingRun.schedule ?? defaultPipeScheduleForMaterial(selectedPlumbingRun.material)}
                        onChange={(event) => updateSelectedPlumbingRun(selectedPlumbingRun.id, { schedule: event.target.value as PlumbingPipeSchedule })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_PIPE_SCHEDULE_OPTIONS.map((schedule) => (
                          <option key={schedule} value={schedule}>{schedule}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Pipe Length
                      <select
                        value={selectedPlumbingRun.stockLengthPreset}
                        onChange={(event) => {
                          const stockLengthPreset = event.target.value as PipeStockLengthPreset;
                          const option = stockLengthOptionForPreset(selectedPlumbingRun.material, stockLengthPreset);
                          updateSelectedPlumbingRun(selectedPlumbingRun.id, {
                            stockLengthPreset,
                            stockLengthFt: option?.lengthFt ?? selectedPlumbingRun.stockLengthFt,
                            stockLengthKind: option?.kind ?? 'custom',
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {stockLengthOptionsForMaterial(selectedPlumbingRun.material).map((option) => (
                          <option key={option.preset} value={option.preset}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    {selectedPlumbingRun.stockLengthPreset === 'custom' ? (
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Custom ft
                        <input
                          type="number"
                          step="1"
                          value={selectedPlumbingRun.stockLengthFt}
                          onChange={(event) => updateSelectedPlumbingRun(selectedPlumbingRun.id, {
                            stockLengthFt: Number(event.target.value),
                            stockLengthKind: 'custom',
                          })}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    ) : null}
                    {selectedPlumbingRun.system === 'sanitary' ? (
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Slope in/ft
                        <input
                          type="number"
                          step="0.125"
                          value={selectedPlumbingRun.slopeInPerFt ?? ''}
                          onChange={(event) => {
                            const value = event.target.value === '' ? undefined : Number(event.target.value);
                            updateSelectedPlumbingRun(selectedPlumbingRun.id, { slopeInPerFt: value });
                          }}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    ) : null}
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Elevation
                      <select
                        value={selectedPlumbingRun.elevationMode}
                        onChange={(event) => updateSelectedPlumbingRun(selectedPlumbingRun.id, { elevationMode: event.target.value as PlumbingElevationMode })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_ELEVATION_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedPlumbingRun.labelVisible}
                        onChange={(event) => updateSelectedPlumbingRun(selectedPlumbingRun.id, { labelVisible: event.target.checked })}
                      />
                      Show label
                    </label>
                  </div>
                ) : selectedPlumbingFitting ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Type
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">
                        {fittingDefinition(selectedPlumbingFitting.type)?.label ?? selectedPlumbingFitting.type.replace(/_/g, ' ')}
                      </div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      System
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingFitting.system.replace('_', ' ')}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Diameter in.
                      <input
                        type="number"
                        step="0.25"
                        value={selectedPlumbingFitting.diameterInches ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? null : Number(event.target.value);
                          setPlumbingSystem((current) => ({
                            ...current,
                            fittings: (current.fittings ?? []).map((fitting) =>
                              fitting.id === selectedPlumbingFitting.id ? { ...fitting, diameterInches: value } : fitting,
                            ),
                          }));
                          setSaveState('unsaved');
                          setChangedAfterCommit(true);
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Material
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingFitting.material}</div>
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedPlumbingFitting.labelVisible}
                        onChange={(event) => {
                          setPlumbingSystem((current) => ({
                            ...current,
                            fittings: (current.fittings ?? []).map((fitting) =>
                              fitting.id === selectedPlumbingFitting.id ? { ...fitting, labelVisible: event.target.checked } : fitting,
                            ),
                          }));
                          setSaveState('unsaved');
                          setChangedAfterCommit(true);
                        }}
                      />
                      Show label
                    </label>
                    <div className="col-span-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {selectedPlumbingFitting.isAutoGenerated ? 'Auto-generated from connected pipe geometry.' : 'Manual fitting.'}
                    </div>
                  </div>
                ) : selectedPlumbingRoughIn ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      System
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingRoughIn.system.replace('_', ' ')}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Diameter in.
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingRoughIn.diameterInches ?? '-'}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Material
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingRoughIn.material}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Schedule
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingRoughIn.schedule ?? '-'}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Bottom elevation
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">
                        {plumbingSystem.nodes.find((node) => node.id === selectedPlumbingRoughIn.riserBottomNodeId)?.position.y.toFixed(2) ?? '-'} m
                      </div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Top elevation
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">
                        {plumbingSystem.nodes.find((node) => node.id === selectedPlumbingRoughIn.riserTopNodeId)?.position.y.toFixed(2) ?? '-'} m
                      </div>
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedPlumbingRoughIn.labelVisible}
                        onChange={(event) => {
                          setPlumbingSystem((current) => ({
                            ...current,
                            roughIns: current.roughIns.map((roughIn) =>
                              roughIn.id === selectedPlumbingRoughIn.id ? { ...roughIn, labelVisible: event.target.checked } : roughIn,
                            ),
                          }));
                          setSaveState('unsaved');
                          setChangedAfterCommit(true);
                        }}
                      />
                      Show label
                    </label>
                    <div className="col-span-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Connected fixture: {plumbingSystem.fixtures.find((fixture) => fixture.id === selectedPlumbingRoughIn.fixtureId)?.mark ?? '-'}.
                      Fittings: {selectedPlumbingRoughIn.fittingIds.length}.
                    </div>
                  </div>
                ) : selectedPlumbingEquipment ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Type
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedPlumbingEquipment.equipmentType.replace(/_/g, ' ')}</div>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Label
                      <input
                        value={selectedPlumbingEquipment.label}
                        onChange={(event) => updateSelectedPlumbingEquipment(selectedPlumbingEquipment.id, { label: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                  </div>
                ) : selectedSepticTank ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Mark
                      <input
                        value={selectedSepticTank.mark}
                        onChange={(event) => updateSelectedSepticTank(selectedSepticTank.id, { mark: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Capacity
                      <div className="mt-1 font-bold text-slate-900 dark:text-white">{selectedSepticTank.designBasis.capacityGallons} gal</div>
                    </label>
                    <label className="flex items-center gap-2 self-end text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedSepticTank.labelVisible}
                        onChange={(event) => updateSelectedSepticTank(selectedSepticTank.id, { labelVisible: event.target.checked })}
                      />
                      Show label
                    </label>
                    <div className="col-span-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Detailed septic tank geometry and design-basis controls remain in the left edit panel.
                    </div>
                  </div>
                ) : activePlumbingAction === 'pipe' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      System
                      <select
                        value={plumbingPipeDefaults.system}
                        onChange={(event) => selectPlumbingPipeSystem(event.target.value as PlumbingRunSystem)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_PIPE_SYSTEM_OPTIONS.map((option) => (
                          <option key={option.system} value={option.system}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Diameter in.
                      <input
                        type="number"
                        step="0.25"
                        value={plumbingPipeDefaults.diameterInches ?? ''}
                        onChange={(event) => updatePlumbingPipeDefaults({ diameterInches: event.target.value === '' ? null : Number(event.target.value) })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Material
                      <select
                        value={plumbingPipeDefaults.material}
                        onChange={(event) => updatePlumbingPipeDefaults({ material: event.target.value as PlumbingMaterial })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_MATERIAL_OPTIONS.map((material) => (
                          <option key={material} value={material}>{material}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Schedule
                      <select
                        value={plumbingPipeDefaults.schedule}
                        onChange={(event) => updatePlumbingPipeDefaults({ schedule: event.target.value as PlumbingPipeSchedule })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_PIPE_SCHEDULE_OPTIONS.map((schedule) => (
                          <option key={schedule} value={schedule}>{schedule}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Pipe Length
                      <select
                        value={plumbingPipeDefaults.stockLengthPreset}
                        onChange={(event) => {
                          const stockLengthPreset = event.target.value as PipeStockLengthPreset;
                          const option = stockLengthOptionForPreset(plumbingPipeDefaults.material, stockLengthPreset);
                          updatePlumbingPipeDefaults({
                            stockLengthPreset,
                            stockLengthFt: option?.lengthFt ?? plumbingPipeDefaults.stockLengthFt,
                            stockLengthKind: option?.kind ?? 'custom',
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {stockLengthOptionsForMaterial(plumbingPipeDefaults.material).map((option) => (
                          <option key={option.preset} value={option.preset}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    {plumbingPipeDefaults.stockLengthPreset === 'custom' ? (
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Custom ft
                        <input
                          type="number"
                          step="1"
                          value={plumbingPipeDefaults.stockLengthFt}
                          onChange={(event) => updatePlumbingPipeDefaults({
                            stockLengthFt: Number(event.target.value),
                            stockLengthKind: 'custom',
                          })}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    ) : null}
                    {plumbingPipeDefaults.system === 'sanitary' ? (
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Slope in/ft
                        <input
                          type="number"
                          step="0.125"
                          value={plumbingPipeDefaults.slopeInPerFt ?? ''}
                          onChange={(event) => updatePlumbingPipeDefaults({ slopeInPerFt: event.target.value === '' ? undefined : Number(event.target.value) })}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    ) : null}
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Elevation
                      <select
                        value={plumbingPipeDefaults.elevationMode}
                        onChange={(event) => updatePlumbingPipeDefaults({ elevationMode: event.target.value as PlumbingElevationMode })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        {PLUMBING_ELEVATION_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={plumbingPipeDefaults.labelVisible}
                        onChange={(event) => updatePlumbingPipeDefaults({ labelVisible: event.target.checked })}
                      />
                      Show label
                    </label>
                    <div className="col-span-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                      <div className="mb-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">Common Fittings</div>
                      <div className="flex flex-wrap gap-1">
                        {commonFittingsForPipe({ system: plumbingPipeDefaults.system, material: plumbingPipeDefaults.material }).map((fitting) => (
                          <button
                            key={fitting.type}
                            type="button"
                            onClick={() => updatePlumbingPipeDefaults({ preferredFittingType: fitting.type })}
                            className={`rounded-md border px-2 py-1 text-[10px] font-bold transition ${
                              plumbingPipeDefaults.preferredFittingType === fitting.type
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                            }`}
                          >
                            {fitting.label}
                          </button>
                        ))}
                      </div>
                      <label className="mt-2 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Fitting Library
                        <select
                          value={plumbingPipeDefaults.preferredFittingType ?? ''}
                          onChange={(event) => updatePlumbingPipeDefaults({ preferredFittingType: event.target.value ? event.target.value as PlumbingFittingType : null })}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Auto</option>
                          {fittingsForPipe({ system: plumbingPipeDefaults.system, material: plumbingPipeDefaults.material }).map((fitting) => (
                            <option key={fitting.type} value={fitting.type}>{fitting.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : activePlumbingAction === 'fixture' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Type
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">{activeFixtureDefinition.displayName}</div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Preview rotation {Math.round(plumbingFixtureRotationRad * 180 / Math.PI)} deg
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => rotateFixturePlacementPreview(-Math.PI / 2)}
                          aria-label="Rotate fixture preview counterclockwise 90 degrees"
                          title="Rotate fixture preview counterclockwise 90 degrees"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateFixturePlacementPreview(Math.PI / 2)}
                          aria-label="Rotate fixture preview clockwise 90 degrees"
                          title="Rotate fixture preview clockwise 90 degrees"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <RotateCw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Connections: {activeFixtureDefinition.connections.map((connection) => connection.system.replace('_', ' ')).join(', ')}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {plumbingStatusHint}
                  </div>
                )}
              </div>
            ) : null}
            {plumbingPlacementActive && (plumbingValidationIssues.length > 0 || plumbingLegendItems.length > 0) && !plumbingLegendExpanded ? (
              <button
                type="button"
                onClick={() => setPlumbingLegendExpanded(true)}
                className="absolute bottom-4 left-[13.25rem] z-10 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-left text-[11px] font-bold text-slate-100 shadow-sm hover:border-cyan-500 hover:text-cyan-100"
                aria-label="Open plumbing legend"
              >
                <div className="text-cyan-200">Legend</div>
                <div className="text-[10px] font-semibold text-slate-400">
                  {plumbingValidationIssues.length > 0
                    ? `${plumbingValidationIssues.length} validation`
                    : `${plumbingLegendItems.length} item${plumbingLegendItems.length === 1 ? '' : 's'}`}
                </div>
              </button>
            ) : null}
            {plumbingPlacementActive && (plumbingValidationIssues.length > 0 || plumbingLegendItems.length > 0) && plumbingLegendExpanded ? (
              <div
                data-plumbing-overlay-panel="true"
                className="absolute max-h-64 w-[min(460px,calc(100%-1.5rem))] overflow-auto rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                style={plumbingOverlayStyle('legend')}
              >
                {plumbingLegendItems.length > 0 ? (
                  <div className="mb-2">
                    <div
                      className="mb-2 flex cursor-move select-none items-center justify-between gap-3 font-bold text-slate-950 dark:text-white"
                      onPointerDown={(event) => handlePlumbingOverlayDragStart('legend', event)}
                      title="Drag to move legend"
                    >
                      <span>Legend</span>
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPlumbingLegendExpanded(false);
                        }}
                        className="cursor-pointer rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Collapse plumbing legend"
                      >
                        Hide
                      </button>
                    </div>
                    <div className="space-y-2">
                      {activePlumbingLegendRows.map((item) => (
                        <div key={item.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                          <div className="flex items-center gap-2">
                            <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true">
                              <line
                                x1="2"
                                y1="7"
                                x2="34"
                                y2="7"
                                stroke={item.stroke}
                                strokeWidth={item.key === 'sanitary' ? 3 : 2}
                                strokeDasharray={item.dash}
                                strokeLinecap="round"
                              />
                              <circle cx="18" cy="7" r="3.5" fill={item.stroke} stroke="#fff" strokeWidth="1" />
                            </svg>
                            <span className="font-bold text-slate-950 dark:text-white">{item.label}</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.description}</div>
                        </div>
                      ))}
                      {plumbingLegendItems.some((item) => item.component === 'cleanout') ? (
                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-9 items-center justify-center rounded-md border border-slate-700 text-[10px] font-black dark:border-slate-300">CO</span>
                            <span className="font-bold text-slate-950 dark:text-white">CO</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Cleanout or floor cleanout access point.</div>
                        </div>
                      ) : null}
                      {plumbingLegendItems.some((item) => item.component === 'valve') ? (
                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                          <div className="flex items-center gap-2">
                            <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true">
                              <path d="M10 3 L26 11 M26 3 L10 11" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="font-bold text-slate-950 dark:text-white">Valve</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Shutoff valve or control valve location.</div>
                        </div>
                      ) : null}
                      {plumbingLegendItems.some((item) => item.component === 'stack') ? (
                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border-2 border-slate-900 dark:border-slate-100" aria-hidden="true" />
                            <span className="font-bold text-slate-950 dark:text-white">Stack</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Waste, vent, or combined vertical stack.</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {plumbingValidationIssues.length > 0 ? (
                  <div>
                    <div
                      className="mb-1 flex cursor-move select-none items-center justify-between gap-3 font-bold text-slate-950 dark:text-white"
                      onPointerDown={(event) => handlePlumbingOverlayDragStart('legend', event)}
                      title="Drag to move validation"
                    >
                      <span>Validation</span>
                      {plumbingLegendItems.length === 0 ? (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPlumbingLegendExpanded(false);
                          }}
                          className="cursor-pointer rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Collapse plumbing legend"
                        >
                          Hide
                        </button>
                      ) : null}
                    </div>
                    <ul className="space-y-1">
                      {plumbingValidationIssues.slice(0, 8).map((issue) => (
                        <li key={issue.id} className={issue.severity === 'error' ? 'text-rose-700 dark:text-rose-200' : 'text-amber-700 dark:text-amber-200'}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
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
            <DesignBuilderRcDebugOverlays
              viewMode={viewMode}
              designGeometryResult={designGeometryResult}
              foundationSettings={resolvedPreset.foundationSettings}
              roofSystem={resolvedPreset.roofSystem}
              visualStyle={visualStyle}
              showRoofReferencePerimeters={showRoofReferencePerimeters}
              showRoofFramingGuides={showRoofFramingGuides}
              showRoofDebug={showRoofDebug}
            />
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

        <DesignBuilderEstimatePanel
          rightPanelCollapsed={rightPanelCollapsed}
          focusMode={focusMode}
          quantityCards={quantityCards}
          selectedObjectType={selectedObjectType}
          visiblePreviewLines={visiblePreviewLines}
          persistenceCanPersist={persistenceContext.canPersist}
          busy={busy}
          previewLineCount={previewLines.length}
          generatedPreviewLineCount={generatedPreview.length}
          moduleWarnings={moduleWarnings}
          onToggleRightPanel={toggleRightPanel}
          onBeginRightPanelResize={beginRightPanelResize}
          onSelectObjectType={(objectType) => {
            setSelectedObjectType(objectType);
            setSelectedOpeningId(null);
            setSelectedSegmentId(null);
            setSelectedNodeId(null);
            setPlacementPreview(null);
          }}
          onGeneratePreview={() => void handleGeneratePreview()}
          onCommitPreview={() => void handleCommitPreview()}
        />
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
      appliedPlaster={normalizeCmuInfillSystem(resolvedPreset.infillSystem).plaster}
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

function roofDebugSnapshotFilename(params: {
  timestamp: Date;
  widthMeters: number;
  lengthMeters: number;
}): string {
  const timestamp = params.timestamp.toISOString().replace(/[:.]/g, '-');
  return `roof-debug-${timestamp}-${formatRoofDebugDimensionMeters(params.widthMeters)}-x-${formatRoofDebugDimensionMeters(params.lengthMeters)}.json`;
}

function formatRoofDebugDimensionMeters(value: number): string {
  if (!Number.isFinite(value)) return 'unknownm';
  return `${Number(value.toFixed(3))}m`;
}
