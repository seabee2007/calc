import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import {
  logOpeningCoursePlacementsTableForDev,
  type CmuBlockType,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { TOP_COURSE_RENDER_EPSILON_METERS } from '../domain/cmuInfillPanelSolver';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  resolveTrussTopChordUpperPoint,
} from '../domain/roofFramingResolver';
import {
  fitPerspectiveCameraToBounds,
  logDesignFramingDiagnostics,
  reset3dView,
  resolveSceneGridLayout,
  type DesignLayoutBounds,
} from '../domain/designLayoutBounds';
import {
  createOpeningRenderGroups,
  populateOpeningAssemblyRenderGroups,
} from '../domain/openingAssembly3dRender';
import { createOpeningFrame3dGroup } from '../domain/openingFrame3dGraphics';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import { buildInfillWallProxyPieces, resolveInfillPlasterPanelPlacements, type PlasterOpening } from '../domain/infillPlaster';
import { getNormalizedPointerFromClient } from '../domain/pointerPlanMapping';
import { buildSegmentFrameMap, projectPointToSegmentStation } from '../domain/openingPlacementResolver';
import type {
  DesignBuilderCameraSnapshot,
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  CmuWallSystemParameters,
  DesignObjectType,
  GableRoofSystemParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  FoundationViewMode,
  DesignVisualStyle,
  RoofDisplayMode,
  RoofLayerVisibility,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
  WallOpeningParameters,
} from '../types';
import {
  buildHipMemberMesh,
  buildPurlinMesh,
  createCorrugatedMetalMaterial,
  createFasciaTrimGeometry,
  createFoldedRoofEdgeCapGroup,
  createFoldedRidgeCapGroup,
  createRakedCapStripGeometry,
  createRakedConcreteCapMaterial,
  createRidgeCapMaterial,
  createSoffitPanelGeometry,
  buildSteelTrussMemberMeshes,
  buildTrussAnchorBoltMeshes,
  buildTrussBasePlateMesh,
  buildTrussPlaneGuide,
  createSteelTrussMaterials,
  buildRakedCapStripRenderSegments,
} from '../geometry/roofRenderingGeometry';
import {
  ensurePreviewMaterialsLoaded,
  resolveCastConcreteMaterial,
  resolveCmuMaterial,
  resolveFasciaTrimMaterial,
  resolvePlasterFinishMaterial,
  resolveRoofMetalMaterial,
  resolveRoofCladdingUvOptions,
  resolveSiteGroundMaterial,
  resolveSoffitTrimMaterial,
  resolveStructuralSteelMaterial,
  subscribeMaterialDiagnostics,
} from '../rendering/materials/designMaterialLibrary';
import { buildMortarJointMeshes } from '../rendering/materials/cmuMortarJointRender';
import type { MortarJointDiagnostics } from '../rendering/materials/cmuMortarJointInstances';
import type { CmuBlockInstance } from '../geometry/designGeometry';
import {
  createRoofCladdingGeometry,
  createVerticalCladdingGeometry,
  resolveRoofRidgeDirection,
} from '../rendering/materials/designRenderingUv';

const CLICK_DRAG_THRESHOLD_PX = 5;

export interface DesignBuilderPlacementPreview {
  wallFace: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters: number;
  positionAlongSegment?: number;
  openingType: WallOpeningParameters['type'];
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  openingId?: string;
  wallSegmentId?: string;
  wallRotationY?: number;
  frameOrigin?: { x: number; y: number; z: number };
  hitPoint?: { x: number; y: number; z: number };
  openingDraft?: WallOpeningParameters;
}

interface DesignBuilderViewerProps {
  modelLoaded: boolean;
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
  geometryResult?: DesignGeometryResult;
  layoutBounds?: DesignLayoutBounds | null;
  selectedObjectType: DesignObjectType | null;
  selectedOpeningId?: string | null;
  toolMode?: DesignBuilderToolMode;
  placementPreview?: DesignBuilderPlacementPreview | null;
  onSelectObjectType: (objectType: DesignObjectType) => void;
  onInteraction?: (event: DesignBuilderInteractionEvent) => void;
  fitContainer?: boolean;
  viewCommand?: { id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null;
  initialCameraSnapshot?: DesignBuilderCameraSnapshot | null;
  onCameraSnapshotChange?: (snapshot: DesignBuilderCameraSnapshot) => void;
  onUserCameraChange?: () => void;
  showOpeningLayout?: boolean;
  showGroutCells?: boolean;
  showClosureWarnings?: boolean;
  showRoofReferencePerimeters?: boolean;
  showRoofFramingGuides?: boolean;
  foundationViewMode?: FoundationViewMode;
  visualStyle?: DesignVisualStyle;
  roofSystem?: RoofSystemSettings | null;
  roofDisplayMode?: RoofDisplayMode;
  roofLayerVisibility?: RoofLayerVisibility;
  materialRevision?: number;
  manualMasonryEnabled?: boolean;
  onManualMasonryPointer?: (event: {
    kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo';
    planX?: number;
    planZ?: number;
  }) => void;
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

function selectionPriorityForObjectType(objectType: DesignObjectType): number {
  if (objectType === 'door_opening' || objectType === 'window_opening') return 100;
  if (objectType === 'cmu_wall_system') return 40;
  if (
    objectType === 'building_footprint' ||
    objectType === 'thickened_edge_slab' ||
    objectType === 'gable_roof_system' ||
    objectType === 'steel_truss_system'
  ) {
    return 20;
  }
  return 1;
}

const ROOF_PLAN_POINT_MATCH_TOLERANCE_METERS = 0.06;
const ROOF_CLADDING_BEAM_CLEARANCE_METERS = CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;

function roofPlanDistanceSquared(a: Pick<RoofVec3, 'x' | 'z'>, b: Pick<RoofVec3, 'x' | 'z'>): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function liftedRoofPoint(point: RoofVec3, yOffsetMeters: number): RoofVec3 {
  return {
    ...point,
    y: point.y + yOffsetMeters,
  };
}

function nearestPlanPoint(point: Pick<RoofVec3, 'x' | 'z'>, candidates: readonly RoofVec3[]): RoofVec3 | null {
  let nearest: { point: RoofVec3; distanceSquared: number } | null = null;
  for (const candidate of candidates) {
    const distanceSquared = roofPlanDistanceSquared(point, candidate);
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { point: candidate, distanceSquared };
    }
  }
  return nearest?.point ?? null;
}

function cornerMatchesPlanPoint(point: Pick<RoofVec3, 'x' | 'z'>, candidates: readonly RoofVec3[]): boolean {
  const nearest = nearestPlanPoint(point, candidates);
  if (!nearest) return false;
  return roofPlanDistanceSquared(point, nearest) <= ROOF_PLAN_POINT_MATCH_TOLERANCE_METERS ** 2;
}

function adjacentEavePair(indices: number[], cornerCount: number): [number, number] | null {
  if (indices.length !== 2) return null;
  const [first, second] = [...indices].sort((a, b) => a - b);
  if (second === first + 1) {
    return [first, second];
  }
  if (first === 0 && second === cornerCount - 1) {
    return [second, first];
  }
  return null;
}

function buildBeamClearedRoofCladdingPlanes(params: {
  planes: readonly RoofPlane[];
  structuralBearingPerimeter: readonly RoofVec3[];
  claddingPerimeter: readonly RoofVec3[];
  roofBeamTopY: number;
  clearanceMeters: number;
}): RoofPlane[] {
  if (params.structuralBearingPerimeter.length < 3 || params.claddingPerimeter.length < 3) {
    return params.planes.map((plane) => ({ ...plane, corners: plane.corners.map((corner) => ({ ...corner })) }));
  }

  const renderPlanes: RoofPlane[] = [];
  for (const plane of params.planes) {
    if (plane.corners.length < 3) {
      renderPlanes.push({ ...plane, corners: plane.corners.map((corner) => ({ ...corner })) });
      continue;
    }

    const eaveIndices = plane.corners
      .map((corner, index) => (cornerMatchesPlanPoint(corner, params.claddingPerimeter) ? index : -1))
      .filter((index) => index >= 0);
    const eavePair = adjacentEavePair(eaveIndices, plane.corners.length);
    if (!eavePair) {
      renderPlanes.push({
        ...plane,
        corners: plane.corners.map((corner) => liftedRoofPoint(corner, params.clearanceMeters)),
      });
      continue;
    }

    const bearingCorners = new Map<number, RoofVec3>();
    for (const eaveIndex of eavePair) {
      const eaveCorner = plane.corners[eaveIndex]!;
      const bearingPoint = nearestPlanPoint(eaveCorner, params.structuralBearingPerimeter);
      if (!bearingPoint) continue;
      const bearingSurfaceY =
        elevationOnRoofPlaneAtPoint(plane, bearingPoint.x, bearingPoint.z) ?? params.roofBeamTopY;
      bearingCorners.set(eaveIndex, {
        x: bearingPoint.x,
        y: Math.max(bearingSurfaceY, params.roofBeamTopY) + params.clearanceMeters,
        z: bearingPoint.z,
      });
    }

    if (bearingCorners.size !== 2) {
      renderPlanes.push({
        ...plane,
        corners: plane.corners.map((corner) => liftedRoofPoint(corner, params.clearanceMeters)),
      });
      continue;
    }

    renderPlanes.push({
      ...plane,
      id: `${plane.id}-beam-clear-main`,
      corners: plane.corners.map((corner, index) => bearingCorners.get(index) ?? liftedRoofPoint(corner, params.clearanceMeters)),
    });

    const [firstEaveIndex, secondEaveIndex] = eavePair;
    const firstEave = liftedRoofPoint(plane.corners[firstEaveIndex]!, params.clearanceMeters);
    const secondEave = liftedRoofPoint(plane.corners[secondEaveIndex]!, params.clearanceMeters);
    const firstBearing = bearingCorners.get(firstEaveIndex)!;
    const secondBearing = bearingCorners.get(secondEaveIndex)!;
    const overhangHasDepth =
      roofPlanDistanceSquared(firstEave, firstBearing) > 1e-8 ||
      roofPlanDistanceSquared(secondEave, secondBearing) > 1e-8;

    if (overhangHasDepth) {
      renderPlanes.push({
        ...plane,
        id: `${plane.id}-beam-clear-overhang`,
        corners: [firstEave, secondEave, secondBearing, firstBearing],
      });
    }
  }
  return renderPlanes;
}

function cloneLiftedRoofPlanes(planes: readonly RoofPlane[], clearanceMeters: number): RoofPlane[] {
  return planes.map((plane) => ({
    ...plane,
    corners: plane.corners.map((corner) => liftedRoofPoint(corner, clearanceMeters)),
  }));
}

function createRoofSheetEaveLipGeometry(params: {
  corners: readonly RoofVec3[];
  eavePair: [number, number];
  planeNormal: RoofVec3;
  slabTopMeters: number;
  thicknessMeters: number;
}): THREE.BufferGeometry {
  const [firstIndex, secondIndex] = params.eavePair;
  const topA = params.corners[firstIndex]!;
  const topB = params.corners[secondIndex]!;
  const bottomB = offsetPointAlongRoofNormal(topB, params.planeNormal, -params.thicknessMeters);
  const bottomA = offsetPointAlongRoofNormal(topA, params.planeNormal, -params.thicknessMeters);
  const vertices = [topA, topB, bottomB, bottomA];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, params.slabTopMeters + vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createFootprintSlabGeometry(
  exteriorFacePolygon: readonly { x: number; z: number }[],
  slabThicknessMeters: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  exteriorFacePolygon.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.z);
    } else {
      shape.lineTo(point.x, point.z);
    }
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, slabThicknessMeters),
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function addCmuMortarJointMeshes(params: {
  blocks: readonly CmuBlockInstance[];
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  visualStyle: DesignVisualStyle;
  cmuCutawayActive: boolean;
  cmuOpacity: number;
  debugMode: boolean;
  root: THREE.Group;
  trackGeometry: (geometry: THREE.BufferGeometry) => THREE.BufferGeometry;
  trackMat: (material: THREE.Material) => void;
}): MortarJointDiagnostics | null {
  if (params.blocks.length === 0) {
    return null;
  }
  const moduleConfig = resolveCmuModuleConfig(params.wall);
  const mortarMaterialOptions = {
    visualStyle: params.visualStyle,
    selected: false,
    ...(params.cmuCutawayActive ? { transparent: true as const, opacity: params.cmuOpacity } : {}),
  };
  const { group, diagnostics } = buildMortarJointMeshes({
    blocks: params.blocks,
    mortarJointMeters: moduleConfig.mortarJointMeters,
    defaultBlockDepthMeters: params.wall.blockDepthMeters ?? params.wall.wallThicknessMeters,
    defaultBlockHeightMeters: moduleConfig.actualHeightMeters,
    slabTopMeters: params.slabTopMeters,
    materialOptions: mortarMaterialOptions,
    debugMode: params.debugMode,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMat,
  });
  if (group.children.length > 0) {
    params.root.add(group);
  }
  return diagnostics;
}

function createFootprintSetoutLine(
  polygon: readonly { x: number; z: number }[],
  y: number,
  color: number,
): THREE.Line {
  const points = polygon.length >= 2 ? [...polygon, polygon[0]] : polygon;
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, y, point.z)));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  return new THREE.Line(geometry, material);
}

export default function DesignBuilderViewer({
  modelLoaded,
  slab,
  wall,
  roof,
  truss,
  geometryResult,
  layoutBounds = null,
  selectedObjectType,
  selectedOpeningId = null,
  toolMode = 'select',
  placementPreview = null,
  onSelectObjectType,
  onInteraction,
  fitContainer = false,
  viewCommand = null,
  initialCameraSnapshot = null,
  onCameraSnapshotChange,
  onUserCameraChange,
  showOpeningLayout = false,
  showGroutCells = false,
  showClosureWarnings = false,
  showRoofReferencePerimeters = false,
  showRoofFramingGuides = false,
  foundationViewMode = 'full_model',
  visualStyle = 'technical',
  roofSystem = null,
  roofDisplayMode = 'full_roof',
  roofLayerVisibility = DEFAULT_ROOF_LAYER_VISIBILITY,
  materialRevision = 0,
  manualMasonryEnabled = false,
  onManualMasonryPointer,
}: DesignBuilderViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectObjectType);
  const onInteractionRef = useRef(onInteraction);
  const onCameraSnapshotRef = useRef(onCameraSnapshotChange);
  const onUserCameraChangeRef = useRef(onUserCameraChange);
  const onManualMasonryPointerRef = useRef(onManualMasonryPointer);
  const initialCameraSnapshotRef = useRef(initialCameraSnapshot);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneSizeRef = useRef({ length: 6, width: 5, height: 3 });
  const toolModeRef = useRef(toolMode);
  const selectedOpeningIdRef = useRef(selectedOpeningId);
  const placementPreviewRef = useRef(placementPreview);
  const manualMasonryEnabledRef = useRef(manualMasonryEnabled);
  const hoveredOpeningIdRef = useRef<string | null>(null);
  const rebuildModelRef = useRef<(() => void) | null>(null);
  const updateGhostRef = useRef<(() => void) | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const previewMaterialsReadyRef = useRef(false);
  const modelParamsRef = useRef({
    modelLoaded,
    slab,
    wall,
    roof,
    truss,
    geometryResult,
    layoutBounds,
    selectedObjectType,
    showOpeningLayout,
    showGroutCells,
    showClosureWarnings,
    showRoofReferencePerimeters,
    showRoofFramingGuides,
    foundationViewMode,
    visualStyle,
    roofSystem,
    roofDisplayMode,
    roofLayerVisibility,
  });
  modelParamsRef.current = {
    modelLoaded,
    slab,
    wall,
    roof,
    truss,
    geometryResult,
    layoutBounds,
    selectedObjectType,
    showOpeningLayout,
    showGroutCells,
    showClosureWarnings,
    showRoofReferencePerimeters,
    showRoofFramingGuides,
    foundationViewMode,
    visualStyle,
    roofSystem,
    roofDisplayMode,
    roofLayerVisibility,
  };
  onSelectRef.current = onSelectObjectType;
  onInteractionRef.current = onInteraction;
  onCameraSnapshotRef.current = onCameraSnapshotChange;
  onUserCameraChangeRef.current = onUserCameraChange;
  onManualMasonryPointerRef.current = onManualMasonryPointer;
  toolModeRef.current = toolMode;
  selectedOpeningIdRef.current = selectedOpeningId;
  placementPreviewRef.current = placementPreview;
  manualMasonryEnabledRef.current = manualMasonryEnabled;

  useEffect(() => {
    updateGhostRef.current?.();
  }, [placementPreview, toolMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(7.4, 5.2, 8.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const unsubscribeMaterialDiagnostics = subscribeMaterialDiagnostics(() => {
      previewMaterialsReadyRef.current = true;
      rebuildModelRef.current?.();
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.6, 0);
    if (initialCameraSnapshotRef.current) {
      camera.position.fromArray(initialCameraSnapshotRef.current.position);
      controls.target.fromArray(initialCameraSnapshotRef.current.target);
      camera.lookAt(controls.target);
    }
    controlsRef.current = controls;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };

    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(6, 8, 5);
    keyLight.castShadow = true;
    scene.add(ambient, keyLight);

    const root = new THREE.Group();
    const ghostRoot = new THREE.Group();
    scene.add(root, ghostRoot);

    const initialGridLayout = resolveSceneGridLayout(modelParamsRef.current.layoutBounds);
    let grid = new THREE.GridHelper(initialGridLayout.gridSize, initialGridLayout.gridDivisions);
    grid.position.set(initialGridLayout.centerX, 0, initialGridLayout.centerZ);
    scene.add(grid);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(initialGridLayout.gridSize, initialGridLayout.gridSize));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(initialGridLayout.centerX, -0.004, initialGridLayout.centerZ);
    scene.add(floorMesh);
    let activeGridSize = initialGridLayout.gridSize;
    let activeGridDivisions = initialGridLayout.gridDivisions;
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const selectable: THREE.Object3D[] = [];
    const wallPickables: THREE.Object3D[] = [];
    const materialsToDispose: THREE.Material[] = [];
    const geometriesToDispose: THREE.BufferGeometry[] = [];
    let ghostMaterials: THREE.Material[] = [];

    let pointerDown: { x: number; y: number; button: number } | null = null;
    let manualBrushActive = false;
    let dragOpeningId: string | null = null;

    function trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
      geometriesToDispose.push(geometry);
      return geometry;
    }

    function makeMaterial(color: number, selected: boolean, options: THREE.MeshStandardMaterialParameters = {}) {
      const material = new THREE.MeshStandardMaterial({
        color: selected ? 0x22d3ee : color,
        roughness: 0.78,
        metalness: 0.03,
        transparent: selected,
        opacity: selected ? 0.92 : 1,
        emissive: selected ? 0x0e7490 : 0x000000,
        emissiveIntensity: selected ? 0.22 : 0,
        ...options,
      });
      materialsToDispose.push(material);
      return material;
    }

    function addSelectable(
      object: THREE.Object3D,
      objectType: DesignObjectType,
      openingId?: string,
      priority = selectionPriorityForObjectType(objectType),
    ) {
      object.userData.selectable = true;
      object.userData.designObjectType = objectType;
      object.userData.selectionPriority = priority;
      if (openingId) object.userData.openingId = openingId;
      selectable.push(object);
      root.add(object);
    }

    function addWallPickable(
      mesh: THREE.Mesh,
      data: { wallFace?: WallOpeningParameters['wallFace']; wallSegmentId?: string; lengthMeters?: number },
    ) {
      if (data.wallFace) mesh.userData.wallFace = data.wallFace;
      if (data.wallSegmentId) mesh.userData.wallSegmentId = data.wallSegmentId;
      if (typeof data.lengthMeters === 'number') mesh.userData.lengthMeters = data.lengthMeters;
      mesh.userData.isWallPickable = true;
      wallPickables.push(mesh);
      root.add(mesh);
      return mesh;
    }

    function applySceneFraming(bounds: DesignLayoutBounds | null) {
      const layout = resolveSceneGridLayout(bounds);
      if (Math.abs(activeGridSize - layout.gridSize) > 0.01 || activeGridDivisions !== layout.gridDivisions) {
        scene.remove(grid);
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
        grid = new THREE.GridHelper(layout.gridSize, layout.gridDivisions);
        activeGridSize = layout.gridSize;
        activeGridDivisions = layout.gridDivisions;
        scene.add(grid);
        applyTheme();
      }
      grid.position.set(layout.centerX, 0, layout.centerZ);
      floorMesh.position.set(layout.centerX, -0.004, layout.centerZ);
      if (floorMesh.geometry instanceof THREE.PlaneGeometry) {
        floorMesh.geometry.dispose();
      }
      floorMesh.geometry = new THREE.PlaneGeometry(layout.gridSize, layout.gridSize);
      refreshSiteGroundMaterial();
    }

    function applyTheme() {
      const dark = isDarkMode();
      scene.background = new THREE.Color(dark ? 0x0f172a : 0xf8fafc);
      (grid.material as THREE.Material).opacity = dark ? 0.35 : 0.22;
      (grid.material as THREE.Material).transparent = true;
      refreshSiteGroundMaterial();
    }

    function refreshSiteGroundMaterial() {
      const params = modelParamsRef.current;
      const layout = resolveSceneGridLayout(params.layoutBounds);
      const material = resolveSiteGroundMaterial(
        {
          visualStyle: params.visualStyle,
          selected: false,
          gridSizeMeters: layout.gridSize,
        },
        (nextMaterial) => {
          materialsToDispose.push(nextMaterial);
        },
      );
      floorMesh.material = material;
    }

    function setPointerFromEvent(event: PointerEvent) {
      const pointer = getNormalizedPointerFromClient(event, renderer.domElement);
      raycaster.setFromCamera(pointer, camera);
    }

    function pickWall(event: PointerEvent) {
      setPointerFromEvent(event);
      const segmentFrames = modelParamsRef.current.geometryResult?.wallCmuLayout?.segmentFrames ?? [];
      const frameById = buildSegmentFrameMap(segmentFrames);
      const viewDirection = raycaster.ray.direction.clone().normalize();
      const candidates = raycaster
        .intersectObjects(wallPickables, false)
        .filter((hit) => hit.object.userData.isWallPickable)
        .map((hit) => {
          const wallSegmentId = hit.object.userData.wallSegmentId as string | undefined;
          const frame = wallSegmentId ? frameById.get(wallSegmentId) : null;
          const facing = frame
            ? frame.outwardNormal.x * -viewDirection.x + frame.outwardNormal.z * -viewDirection.z > 0.05
            : true;
          return { hit, wallSegmentId, frame, facing };
        })
        .filter((candidate) => candidate.facing)
        .sort((left, right) => left.hit.distance - right.hit.distance);

      const best = candidates[0];
      if (!best) return null;
      const point = best.hit.point;

      if (best.wallSegmentId && best.frame) {
        const positionAlongSegment = projectPointToSegmentStation(
          { x: point.x, z: point.z },
          best.frame,
        );
        if (import.meta.env.DEV) {
          console.debug(
            `Host wall: ${best.wallSegmentId}\nStation: ${positionAlongSegment.toFixed(2)} m / ${best.frame.lengthMeters.toFixed(2)} m`,
          );
        }
        return {
          wallSegmentId: best.wallSegmentId,
          positionAlongSegment,
          hitPoint: { x: point.x, y: point.y, z: point.z },
        };
      }

      if (!best.hit.object.userData.wallFace) return null;
      const wallFace = best.hit.object.userData.wallFace as WallOpeningParameters['wallFace'];
      const offsetWall = modelParamsRef.current.wall;
      const offsetMeters =
        wallFace === 'north' || wallFace === 'south'
          ? point.x + offsetWall.lengthMeters / 2
          : point.z + offsetWall.widthMeters / 2;
      return { wallFace, offsetMeters, hitPoint: { x: point.x, y: point.y, z: point.z } };
    }

    function selectableDataFor(object: THREE.Object3D | null) {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current.userData.selectable && current.userData.designObjectType) {
          return current.userData as {
            designObjectType: DesignObjectType;
            openingId?: string;
            selectionPriority?: number;
          };
        }
        current = current.parent;
      }
      return null;
    }

    function pickSelectable(event: PointerEvent) {
      setPointerFromEvent(event);
      return raycaster
        .intersectObjects(selectable, true)
        .map((hit) => ({ hit, data: selectableDataFor(hit.object) }))
        .filter((item): item is { hit: THREE.Intersection; data: NonNullable<ReturnType<typeof selectableDataFor>> } => item.data != null)
        .sort((a, b) => {
          const priorityDelta = (b.data.selectionPriority ?? 0) - (a.data.selectionPriority ?? 0);
          return priorityDelta !== 0 ? priorityDelta : a.hit.distance - b.hit.distance;
        })[0] ?? null;
    }

    function pickManualBrushPoint(event: PointerEvent) {
      setPointerFromEvent(event);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
      return { x: hit.x, z: hit.z };
    }

    function clearGhost() {
      ghostMaterials.forEach((material) => material.dispose());
      ghostMaterials = [];
      ghostRoot.clear();
    }

    function updateGhost() {
      clearGhost();
      const preview = placementPreviewRef.current;
      if (!preview) return;
      const ghostWall = modelParamsRef.current.wall;
      const ghostSlab = modelParamsRef.current.slab;
      const roughAllowance = preview.openingDraft?.roughOpeningAllowanceMeters ?? 0.05;
      const roughWidth = preview.openingDraft?.roughOpeningWidthMeters ?? preview.widthMeters + roughAllowance * 2;
      const roughHeight = preview.openingDraft?.roughOpeningHeightMeters ?? preview.heightMeters + roughAllowance * 2;
      const centerStation = preview.positionAlongSegment ?? preview.offsetMeters + preview.widthMeters / 2;
      const sillHeight = preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0;
      const segmentFrames = modelParamsRef.current.geometryResult?.wallCmuLayout?.segmentFrames ?? [];
      const hostSegmentFrame = preview.wallSegmentId
        ? segmentFrames.find((segment) => segment.segmentId === preview.wallSegmentId)
        : undefined;
      const resolvedLike: ResolvedCmuOpening & {
        worldX?: number;
        worldZ?: number;
        rotationY?: number;
        placementStatusKind?: string;
      } = {
            id: preview.openingId ?? 'preview',
            type: preview.openingType,
            wallFace: preview.wallFace,
            wallSegmentId: preview.wallSegmentId,
            actualWidthMeters: preview.widthMeters,
            actualHeightMeters: preview.heightMeters,
            actualAreaSquareMeters: preview.widthMeters * preview.heightMeters,
            roughOpeningWidthMeters: roughWidth,
            roughOpeningHeightMeters: roughHeight,
            roughOpeningAreaSquareMeters: roughWidth * roughHeight,
            roughStartAlongMeters: centerStation - roughWidth / 2,
            roughEndAlongMeters: centerStation + roughWidth / 2,
            roughBottomMeters: preview.openingType === 'door' ? 0 : Math.max(0, sillHeight - (roughHeight - preview.heightMeters) / 2),
            roughTopMeters:
              (preview.openingType === 'door' ? 0 : Math.max(0, sillHeight - (roughHeight - preview.heightMeters) / 2)) + roughHeight,
            actualStartAlongMeters: centerStation - preview.widthMeters / 2,
            actualEndAlongMeters: centerStation + preview.widthMeters / 2,
            actualBottomMeters: sillHeight,
            actualTopMeters: sillHeight + preview.heightMeters,
            lintelType: preview.openingDraft?.lintelType ?? ghostWall.lintelType ?? 'bond_beam',
            lintelBearingMeters: preview.openingDraft?.lintelBearingMeters ?? ghostWall.lintelBearingMeters ?? 0.2,
            lintelCourseCount: preview.openingDraft?.lintelCourseCount ?? ghostWall.lintelCourseCount ?? 1,
            lintelLengthMeters: roughWidth + (preview.openingDraft?.lintelBearingMeters ?? ghostWall.lintelBearingMeters ?? 0.2) * 2,
            lintelHeightMeters: ghostWall.blockHeightMeters * (preview.openingDraft?.lintelCourseCount ?? ghostWall.lintelCourseCount ?? 1),
            jambGroutEnabled: true,
            jambRebarEnabled: false,
            groutCellsEachSide: 1,
            jambGroutCellCount: 2,
            groutCellsAboveOpening: 0,
            groutCellsBelowWindow: 0,
            openingFrameMaterial: preview.openingDraft?.openingFrameMaterial ?? 'none',
            ...(preview.frameOrigin && typeof preview.wallRotationY === 'number'
              ? {
                  worldX: preview.frameOrigin.x,
                  worldZ: preview.frameOrigin.z,
                  rotationY: preview.wallRotationY,
                  placementStatusKind: preview.statusKind,
                }
              : { placementStatusKind: preview.statusKind }),
          };

      const frame = createOpeningFrame3dGroup(resolvedLike, ghostWall, ghostSlab.slabThicknessMeters, {
        preview: true,
        valid: preview.isValid,
        selected: Boolean(preview.openingId && preview.openingId === selectedOpeningIdRef.current),
        showOpeningLayout: modelParamsRef.current.showOpeningLayout,
        hostSegmentFrame,
      });
      frame.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          ghostMaterials.push(...(Array.isArray(child.material) ? child.material : [child.material]));
        }
      });
      frame.renderOrder = 10;
      ghostRoot.renderOrder = 10;
      ghostRoot.add(frame);
    }
    updateGhostRef.current = updateGhost;

    function rebuildModel() {
      const params = modelParamsRef.current;
      if (!params.modelLoaded) return;
      const {
        wall: currentWall,
        slab: currentSlab,
        roof: currentRoof,
        geometryResult: currentGeometry,
        layoutBounds: currentLayoutBounds,
        selectedObjectType: currentSelectedObjectType,
        showOpeningLayout: currentShowOpeningLayout,
        showGroutCells: currentShowGroutCells,
        showClosureWarnings: currentShowClosureWarnings,
        showRoofReferencePerimeters: currentShowRoofReferencePerimeters,
        showRoofFramingGuides: currentShowRoofFramingGuides,
        foundationViewMode: currentFoundationViewMode,
        visualStyle: currentVisualStyle,
        roofSystem: currentRoofSystem,
        roofDisplayMode: currentRoofDisplayMode,
        roofLayerVisibility: currentRoofLayerVisibility,
      } = params;
      const usePreviewMaterials =
        currentVisualStyle === 'material_preview' && previewMaterialsReadyRef.current;
      const frameSelected = currentSelectedObjectType === 'structural_frame_system';
      const cmuSelected = currentSelectedObjectType === 'cmu_wall_system';
      const roofSelected = currentSelectedObjectType === 'gable_roof_system';
      const gableSelected = currentSelectedObjectType === 'gable_end_system';

      function trackMat(material: THREE.Material) {
        materialsToDispose.push(material);
      }

      const cmuCutawayActive = currentFoundationViewMode === 'cutaway_below_grade';
      const cmuOpacity = cmuCutawayActive ? 0.35 : usePreviewMaterials ? 1 : 0.9;
      const cmuMaterialOptions = {
        visualStyle: currentVisualStyle,
        selected: cmuSelected,
        ...(cmuCutawayActive ? { transparent: true as const, opacity: cmuOpacity } : {}),
      };
      root.clear();
      selectable.length = 0;
      wallPickables.length = 0;
      geometriesToDispose.splice(0).forEach((geometry) => geometry.dispose());
      materialsToDispose.splice(0).forEach((material) => material.dispose());

      applySceneFraming(currentLayoutBounds);
      const blankGeometryActive = currentGeometry?.sourcePath === 'blank';
      sceneSizeRef.current = {
        length: blankGeometryActive ? 6 : currentWall.lengthMeters,
        width: blankGeometryActive ? 6 : currentWall.widthMeters,
        height: blankGeometryActive
          ? 2
          : currentSlab.slabThicknessMeters + currentWall.heightMeters + (currentRoof.widthMeters / 2 + currentRoof.overhangMeters) * currentRoof.pitchRisePerRun,
      };
      if (blankGeometryActive) {
        clearGhost();
        return;
      }

      const pickMaterial = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      materialsToDispose.push(pickMaterial);
      const wallY = currentSlab.slabThicknessMeters + currentWall.heightMeters / 2;
      const wallInset = Math.max(0, currentWall.wallThicknessMeters) / 2;

      const footprintSelected = currentSelectedObjectType === 'building_footprint';
      const slabMaterial = usePreviewMaterials
        ? resolveCastConcreteMaterial(
            { visualStyle: currentVisualStyle, selected: footprintSelected, role: 'structural' },
            trackMat,
          )
        : makeMaterial(0x78716c, footprintSelected, {
            roughness: 0.88,
            metalness: 0.05,
          });
      const layoutGraphActive = currentGeometry?.sourcePath === 'layout_graph';
      const legacyPresetActive = !currentGeometry || currentGeometry.sourcePath === 'legacy_preset';
      const slabMesh = new THREE.Mesh(
        layoutGraphActive && currentGeometry.resolvedFootprint?.exteriorFacePolygon.length
          ? trackGeometry(createFootprintSlabGeometry(currentGeometry.resolvedFootprint.exteriorFacePolygon, currentSlab.slabThicknessMeters))
          : trackGeometry(new THREE.BoxGeometry(currentSlab.lengthMeters, currentSlab.slabThicknessMeters, currentSlab.widthMeters)),
        slabMaterial,
      );
      slabMesh.position.y = layoutGraphActive ? currentSlab.slabThicknessMeters : currentSlab.slabThicknessMeters / 2;
      addSelectable(slabMesh, 'building_footprint');

      const cmuLayout = layoutGraphActive && currentGeometry ? currentGeometry.wallCmuLayout : generateCmuLayout(currentWall);
      if (import.meta.env.DEV && selectedOpeningIdRef.current) {
        const selectedOpening = cmuLayout.roughOpenings.find(
          (opening) => opening.id === selectedOpeningIdRef.current,
        );
        if (selectedOpening) {
          const moduleConfig = resolveCmuModuleConfig(currentWall);
          logOpeningCoursePlacementsTableForDev(
            cmuLayout.unitPlacements,
            selectedOpening,
            moduleConfig.moduleHeightMeters,
            selectedOpening.wallSegmentId ?? selectedOpening.wallFace ?? undefined,
          );
        }
      }
      if (layoutGraphActive) {
        currentGeometry.wallSegments.forEach((segment) => {
          const pickMesh = new THREE.Mesh(
            trackGeometry(new THREE.BoxGeometry(segment.lengthMeters, segment.heightMeters, segment.thicknessMeters)),
            pickMaterial.clone(),
          );
          pickMesh.position.set(segment.x, currentSlab.slabThicknessMeters + segment.y, segment.z);
          pickMesh.rotation.y = segment.rotationY;
          addWallPickable(pickMesh, { wallSegmentId: segment.segmentId, lengthMeters: segment.lengthMeters });
        });

        const frameSystem = currentGeometry.frameSystem;
        if (frameSystem?.columns.length) {
          const columnMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'structural' },
                trackMat,
              )
            : makeMaterial(0x9ca3af, frameSelected, {
                roughness: 0.85,
              });
          frameSystem.columns.forEach((column) => {
            const mesh = new THREE.Mesh(
              trackGeometry(
                new THREE.BoxGeometry(column.widthMeters, column.heightMeters, column.depthMeters),
              ),
              columnMaterial,
            );
            mesh.position.set(
              column.position.x,
              currentSlab.slabThicknessMeters + column.baseElevationMeters + column.heightMeters / 2,
              column.position.z,
            );
            addSelectable(mesh, 'structural_frame_system');
          });
        }
        if (frameSystem?.beams.length) {
          const beamMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'beam' },
                trackMat,
              )
            : makeMaterial(0x6b7280, frameSelected, {
                roughness: 0.8,
              });
          const plinthBeamMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'beam' },
                trackMat,
              )
            : makeMaterial(0x57534e, frameSelected, {
                roughness: 0.85,
              });
          const tieBeamMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'beam' },
                trackMat,
              )
            : makeMaterial(0x44403c, frameSelected, {
                roughness: 0.85,
              });
          const roofBeamMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'beam' },
                trackMat,
              )
            : makeMaterial(0x6b7280, frameSelected, {
                roughness: 0.8,
              });
          frameSystem.beams.forEach((beam) => {
            const dx = beam.endPoint.x - beam.startPoint.x;
            const dz = beam.endPoint.z - beam.startPoint.z;
            const length = Math.hypot(dx, dz);
            if (length <= 0) return;
            const material =
              beam.kind === 'plinth_beam' || beam.kind === 'grade_beam'
                ? plinthBeamMaterial
                : beam.kind === 'tie_beam'
                  ? tieBeamMaterial
                  : beam.kind === 'roof_beam' || beam.kind === 'ring_beam'
                    ? roofBeamMaterial
                    : beamMaterial;
            const mesh = new THREE.Mesh(
              trackGeometry(new THREE.BoxGeometry(length, beam.depthMeters, beam.widthMeters)),
              material,
            );
            mesh.position.set(
              (beam.startPoint.x + beam.endPoint.x) / 2,
              currentSlab.slabThicknessMeters + beam.baseElevationMeters + beam.depthMeters / 2,
              (beam.startPoint.z + beam.endPoint.z) / 2,
            );
            mesh.rotation.y = -Math.atan2(dz, dx);
            addSelectable(mesh, 'structural_frame_system');
          });
        }
        const interiorFloorSlab = currentGeometry.interiorFloorSlab;
        if (
          interiorFloorSlab?.enabled &&
          currentGeometry.resolvedFootprint?.interiorFacePolygon.length
        ) {
          const interiorSlabMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'structural' },
                trackMat,
              )
            : makeMaterial(0x78716c, frameSelected, {
                roughness: 0.92,
                metalness: 0.02,
              });
          const interiorSlabMesh = new THREE.Mesh(
            trackGeometry(
              createFootprintSlabGeometry(
                currentGeometry.resolvedFootprint.interiorFacePolygon,
                interiorFloorSlab.thicknessMeters,
              ),
            ),
            interiorSlabMaterial,
          );
          interiorSlabMesh.position.y =
            currentSlab.slabThicknessMeters + interiorFloorSlab.topElevationMeters;
          addSelectable(interiorSlabMesh, 'structural_frame_system');
          root.add(interiorSlabMesh);
        }
        if (currentGeometry.isolatedFootings?.length) {
          const footingMaterial = usePreviewMaterials
            ? resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: frameSelected, role: 'structural' },
                trackMat,
              )
            : makeMaterial(0x78716c, frameSelected, {
                roughness: 0.9,
              });
          currentGeometry.isolatedFootings.forEach((footing) => {
            const mesh = new THREE.Mesh(
              trackGeometry(
                new THREE.BoxGeometry(footing.widthMeters, footing.thicknessMeters, footing.lengthMeters),
              ),
              footingMaterial,
            );
            mesh.position.set(
              footing.position.x,
              currentSlab.slabThicknessMeters + footing.centerElevationMeters,
              footing.position.z,
            );
            addSelectable(mesh, 'structural_frame_system');
          });
        }
        if (import.meta.env.DEV && currentShowRoofReferencePerimeters && currentGeometry.resolvedRoofSystem?.supported) {
          const roofY =
            (currentGeometry.resolvedRoofSystem.roofBeamTopElevationMeters ?? currentSlab.slabThicknessMeters + 2.8) + 0.08;
          const wallExterior = currentGeometry.exteriorFootprint ?? currentGeometry.resolvedFootprint?.exteriorFacePolygon ?? [];
          if (wallExterior.length >= 3) {
            const wallLine = createFootprintSetoutLine(wallExterior, roofY, 0xffffff);
            wallLine.userData.explicitHelperMarker = true;
            trackGeometry(wallLine.geometry);
            materialsToDispose.push(wallLine.material as THREE.Material);
            root.add(wallLine);
          }
          const bearing = currentGeometry.resolvedRoofSystem.structuralBearingPerimeter.map((point) => ({
            x: point.x,
            z: point.z,
          }));
          if (bearing.length >= 3) {
            const bearingLine = createFootprintSetoutLine(bearing, roofY + 0.02, 0x14b8a6);
            bearingLine.userData.explicitHelperMarker = true;
            trackGeometry(bearingLine.geometry);
            materialsToDispose.push(bearingLine.material as THREE.Material);
            root.add(bearingLine);
          }
          const cladding = currentGeometry.resolvedRoofSystem.claddingPerimeter.map((point) => ({
            x: point.x,
            z: point.z,
          }));
          if (cladding.length >= 3) {
            const claddingLine = createFootprintSetoutLine(cladding, roofY + 0.04, 0xeab308);
            claddingLine.userData.explicitHelperMarker = true;
            trackGeometry(claddingLine.geometry);
            materialsToDispose.push(claddingLine.material as THREE.Material);
            root.add(claddingLine);
          }
        }
        const roofSegmentFrames = currentGeometry.wallCmuLayout?.segmentFrames ?? [];
        const roofFrameById = buildSegmentFrameMap(roofSegmentFrames);
        const showRoofCladding =
          (currentRoofDisplayMode === 'full_roof' ||
            currentRoofDisplayMode === 'roof_cladding_only' ||
            currentRoofDisplayMode === 'foundation_frame_roof') &&
          currentRoofLayerVisibility.roofCladding;
        const showRoofFraming =
          currentRoofDisplayMode === 'full_roof' ||
          currentRoofDisplayMode === 'steel_framing_only' ||
          currentRoofDisplayMode === 'foundation_frame_roof';
        const showSteelTrusses = showRoofFraming && currentRoofLayerVisibility.steelTrusses;
        const showPurlins = showRoofFraming && currentRoofLayerVisibility.purlins;
        const showRidgeCap =
          (currentRoofDisplayMode === 'full_roof' ||
            currentRoofDisplayMode === 'roof_cladding_only' ||
            currentRoofDisplayMode === 'foundation_frame_roof') &&
          currentRoofLayerVisibility.ridgeCap;
        const showFascia =
          (currentRoofDisplayMode === 'full_roof' ||
            currentRoofDisplayMode === 'roof_cladding_only' ||
            currentRoofDisplayMode === 'foundation_frame_roof') &&
          currentRoofLayerVisibility.fascia;
        const showSoffit =
          (currentRoofDisplayMode === 'full_roof' ||
            currentRoofDisplayMode === 'roof_cladding_only' ||
            currentRoofDisplayMode === 'foundation_frame_roof') &&
          (currentRoofLayerVisibility.soffit ?? DEFAULT_ROOF_LAYER_VISIBILITY.soffit);
        const showGableMasonry =
          (currentRoofDisplayMode === 'full_roof' ||
            currentRoofDisplayMode === 'gable_masonry_only' ||
            currentRoofDisplayMode === 'foundation_frame_roof') &&
          (currentRoofLayerVisibility.gableEndCmu || currentRoofLayerVisibility.rakedConcreteCap);
        const showRakedCap =
          showGableMasonry && currentRoofLayerVisibility.rakedConcreteCap;

        if (currentGeometry.resolvedRoofSystem?.supported && currentRoofSystem?.enabled) {
          const resolvedRoof = currentGeometry.resolvedRoofSystem;
          const roofCladdingGroup = new THREE.Group();
          roofCladdingGroup.name = 'roofCladdingGroup';
          const trussChordGroup = new THREE.Group();
          trussChordGroup.name = 'trussChordGroup';
          const trussWebGroup = new THREE.Group();
          trussWebGroup.name = 'trussWebGroup';
          const purlinGroup = new THREE.Group();
          purlinGroup.name = 'purlinGroup';
          const basePlateGroup = new THREE.Group();
          basePlateGroup.name = 'basePlateGroup';
          const anchorBoltGroup = new THREE.Group();
          anchorBoltGroup.name = 'anchorBoltGroup';
          const rakedCapGroup = new THREE.Group();
          rakedCapGroup.name = 'rakedCapGroup';
          const ridgeCapGroup = new THREE.Group();
          ridgeCapGroup.name = 'ridgeCapGroup';
          const fasciaGroup = new THREE.Group();
          fasciaGroup.name = 'fasciaGroup';
          const soffitGroup = new THREE.Group();
          soffitGroup.name = 'soffitGroup';
          const framingGuideGroup = new THREE.Group();
          framingGuideGroup.name = 'framingGuideGroup';

          const corrugatedEnabled = currentRoofSystem.corrugatedMetal.enabled;
          const rawCladdingPlanes =
            resolvedRoof.claddingDisplayPlanes.length > 0
              ? resolvedRoof.claddingDisplayPlanes
              : resolvedRoof.roofTopPlanes;
          const sheetReferencePerimeter =
            resolvedRoof.roofSheetPerimeter.length > 0
              ? resolvedRoof.roofSheetPerimeter
              : resolvedRoof.claddingPerimeter;
          const claddingPlanes =
            resolvedRoof.roofType === 'hip'
              ? cloneLiftedRoofPlanes(rawCladdingPlanes, ROOF_CLADDING_BEAM_CLEARANCE_METERS)
              : buildBeamClearedRoofCladdingPlanes({
                  planes: rawCladdingPlanes,
                  structuralBearingPerimeter: resolvedRoof.structuralBearingPerimeter,
                  claddingPerimeter: sheetReferencePerimeter,
                  roofBeamTopY: resolvedRoof.roofBeamTopY,
                  clearanceMeters: ROOF_CLADDING_BEAM_CLEARANCE_METERS,
                });

          const ridgeDirectionHint =
            resolvedRoof.claddingRidgeStart && resolvedRoof.claddingRidgeEnd
              ? {
                  x: resolvedRoof.claddingRidgeEnd.x - resolvedRoof.claddingRidgeStart.x,
                  z: resolvedRoof.claddingRidgeEnd.z - resolvedRoof.claddingRidgeStart.z,
                }
              : undefined;

          if (showRoofCladding) {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const roofUsesMeterUvGeometry = usePreviewMaterials && !debugGuides;
            const roofCladdingUvOptions = roofUsesMeterUvGeometry ? resolveRoofCladdingUvOptions() : null;
            const roofMaterial = debugGuides
              ? new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.72, roughness: 0.38 })
              : usePreviewMaterials
                ? resolveRoofMetalMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  )
                : corrugatedEnabled
                  ? createCorrugatedMetalMaterial()
                  : makeMaterial(0x64748b, roofSelected, {
                      roughness: 0.75,
                      opacity: 0.92,
                    });
            roofMaterial.side = THREE.DoubleSide;
            roofMaterial.needsUpdate = true;
            if (debugGuides || !usePreviewMaterials) {
              materialsToDispose.push(roofMaterial);
            }
            for (const plane of claddingPlanes) {
              if (plane.corners.length < 3) continue;
              const planeNormal = normalizeOutwardRoofNormal(plane.normal);
              const visibleCorners = plane.corners;
              const topGeometry = roofUsesMeterUvGeometry
                ? trackGeometry(
                    createRoofCladdingGeometry({
                      corners: visibleCorners,
                      slabTopMeters: currentSlab.slabThicknessMeters,
                      planeNormal: new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z),
                      ridgeDirection: resolveRoofRidgeDirection(visibleCorners, ridgeDirectionHint),
                      corrugationRepeatPerMeter: roofCladdingUvOptions?.corrugationRepeatPerMeter,
                      swapCorrugationAxis: roofCladdingUvOptions?.swapCorrugationAxis,
                    }),
                  )
                : trackGeometry(
                    (() => {
                      const positions: number[] = [];
                      for (const corner of visibleCorners) {
                        positions.push(corner.x, currentSlab.slabThicknessMeters + corner.y, corner.z);
                      }
                      const indices = plane.corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
                      const geometry = new THREE.BufferGeometry();
                      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                      geometry.setIndex(indices);
                      geometry.computeVertexNormals();
                      return geometry;
                    })(),
                  );
              roofCladdingGroup.add(new THREE.Mesh(topGeometry, roofMaterial));
              const eaveIndices = visibleCorners
                .map((corner, index) => (cornerMatchesPlanPoint(corner, sheetReferencePerimeter) ? index : -1))
                .filter((index) => index >= 0);
              const eavePair = adjacentEavePair(eaveIndices, visibleCorners.length);
              if (eavePair) {
                const lipGeometry = trackGeometry(
                  createRoofSheetEaveLipGeometry({
                    corners: visibleCorners,
                    eavePair,
                    planeNormal,
                    slabTopMeters: currentSlab.slabThicknessMeters,
                    thicknessMeters: Math.max(CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS, 0.012),
                  }),
                );
                roofCladdingGroup.add(new THREE.Mesh(lipGeometry, roofMaterial));
              }
            }

            if (resolvedRoof.gableEndRoofingClosures.length > 0) {
              const gableEndRoofingClosureGroup = new THREE.Group();
              gableEndRoofingClosureGroup.name = 'gableEndRoofingClosureGroup';
              for (const closure of resolvedRoof.gableEndRoofingClosures) {
                if (closure.corners.length < 3) continue;
                const closureGeometry = trackGeometry(
                  createVerticalCladdingGeometry({
                    corners: closure.corners,
                    slabTopMeters: currentSlab.slabThicknessMeters,
                    corrugationRepeatPerMeter: roofCladdingUvOptions?.corrugationRepeatPerMeter,
                  }),
                );
                gableEndRoofingClosureGroup.add(new THREE.Mesh(closureGeometry, roofMaterial));
              }
              roofCladdingGroup.add(gableEndRoofingClosureGroup);
            }
          }

          if (showSteelTrusses && resolvedRoof.roofType === 'gable' && currentRoofSystem.steelTrusses.enabled) {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const steelMaterials = usePreviewMaterials && !debugGuides
              ? {
                  chord: resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  ),
                  web: resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  ),
                  plate: resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  ),
                  bolt: resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  ),
                  purlin: resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  ),
                }
              : createSteelTrussMaterials();
            if (!usePreviewMaterials || debugGuides) {
              materialsToDispose.push(
                steelMaterials.chord,
                steelMaterials.web,
                steelMaterials.plate,
                steelMaterials.bolt,
              );
            }
            for (const placement of resolvedRoof.trussPlacements) {
              const { chordMeshes, webMeshes } = buildSteelTrussMemberMeshes({
                placement,
                slabOffsetY: currentSlab.slabThicknessMeters,
                materials: { chord: steelMaterials.chord, web: steelMaterials.web },
                debugGuides,
              });
              for (const mesh of chordMeshes) {
                trackGeometry(mesh.geometry);
                trussChordGroup.add(mesh);
              }
              for (const mesh of webMeshes) {
                trackGeometry(mesh.geometry);
                trussWebGroup.add(mesh);
              }
              if (currentRoofSystem.steelTrusses.basePlateEnabled) {
                for (const bearing of [placement.bearingLeft, placement.bearingRight]) {
                  const bearingWorld = new THREE.Vector3(
                    bearing.x,
                    currentSlab.slabThicknessMeters + bearing.y,
                    bearing.z,
                  );
                  const plate = buildTrussBasePlateMesh({
                    bearing: bearingWorld,
                    settings: currentRoofSystem,
                    material: debugGuides
                      ? new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.45 })
                      : steelMaterials.plate,
                  });
                  trackGeometry(plate.geometry);
                  basePlateGroup.add(plate);
                  if (currentRoofSystem.steelTrusses.anchorBoltsPerBearing > 0) {
                    const bolts = buildTrussAnchorBoltMeshes({
                      bearing: bearingWorld,
                      settings: currentRoofSystem,
                      material: steelMaterials.bolt,
                    });
                    for (const bolt of bolts) {
                      trackGeometry(bolt.geometry);
                      anchorBoltGroup.add(bolt);
                    }
                  }
                }
              }
              if (debugGuides) {
                const guide = buildTrussPlaneGuide({
                  placement,
                  slabOffsetY: currentSlab.slabThicknessMeters,
                });
                guide.userData.explicitHelperMarker = true;
                trackGeometry(guide.geometry);
                materialsToDispose.push(guide.material as THREE.Material);
                framingGuideGroup.add(guide);
              }
            }
          }

          if (showRoofFraming && resolvedRoof.roofType === 'hip') {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const hipMaterial =
              usePreviewMaterials && !debugGuides
                ? resolveStructuralSteelMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  )
                : new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.78, roughness: 0.32 });
            if (!usePreviewMaterials || debugGuides) {
              materialsToDispose.push(hipMaterial);
            }
            for (const member of resolvedRoof.hipFramingMembers) {
              const mesh = buildHipMemberMesh(
                new THREE.Vector3(
                  member.start.x,
                  currentSlab.slabThicknessMeters + member.start.y,
                  member.start.z,
                ),
                new THREE.Vector3(
                  member.end.x,
                  currentSlab.slabThicknessMeters + member.end.y,
                  member.end.z,
                ),
                hipMaterial,
              );
              trackGeometry(mesh.geometry);
              trussChordGroup.add(mesh);
            }
          }

          if (showPurlins && currentRoofSystem.purlins.enabled) {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const steelMaterials = usePreviewMaterials && !debugGuides ? null : createSteelTrussMaterials();
            const purlinMaterial =
              debugGuides
                ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.45 })
                : usePreviewMaterials
                  ? resolveStructuralSteelMaterial(
                      { visualStyle: currentVisualStyle, selected: roofSelected },
                      trackMat,
                    )
                  : steelMaterials!.purlin;
            if (debugGuides || !usePreviewMaterials) {
              materialsToDispose.push(purlinMaterial);
            }
            for (const purlin of resolvedRoof.purlinPlacements) {
              const mesh = buildPurlinMesh({
                start: new THREE.Vector3(
                  purlin.start.x,
                  currentSlab.slabThicknessMeters + purlin.start.y,
                  purlin.start.z,
                ),
                end: new THREE.Vector3(
                  purlin.end.x,
                  currentSlab.slabThicknessMeters + purlin.end.y,
                  purlin.end.z,
                ),
                planeNormal: new THREE.Vector3(
                  purlin.planeNormal.x,
                  purlin.planeNormal.y,
                  purlin.planeNormal.z,
                ),
                material: purlinMaterial,
                profile: purlin.rowIndex === 0 ? 'vertical_eave' : 'roof_normal',
              });
              trackGeometry(mesh.geometry);
              purlinGroup.add(mesh);
            }
            if (import.meta.env.DEV && currentShowRoofFramingGuides && resolvedRoof.trussPlacements.length > 0) {
              const slabY = currentSlab.slabThicknessMeters;
              const samplePurlin =
                resolvedRoof.purlinPlacements.find((purlin) => purlin.rowIndex > 0) ??
                resolvedRoof.purlinPlacements[0]!;
              const sampleTruss = resolvedRoof.trussPlacements[Math.floor(resolvedRoof.trussPlacements.length / 2)]!;
              const topLeft = sampleTruss.members.find((member) => member.memberKind === 'top_chord_left')!;
              const normal = normalizeOutwardRoofNormal(samplePurlin.planeNormal);
              const chordCenter = {
                x: (topLeft.start.x + topLeft.end.x) / 2,
                y: (topLeft.start.y + topLeft.end.y) / 2,
                z: (topLeft.start.z + topLeft.end.z) / 2,
              };
              const chordTop = resolveTrussTopChordUpperPoint({ chordCenter, outwardNormal: normal });
              const purlinCenter = {
                x: (samplePurlin.start.x + samplePurlin.end.x) / 2,
                y: (samplePurlin.start.y + samplePurlin.end.y) / 2,
                z: (samplePurlin.start.z + samplePurlin.end.z) / 2,
              };
              const purlinTop = offsetPointAlongRoofNormal(purlinCenter, normal, PURLIN_PROFILE_DEPTH_METERS / 2);
              const displayPlane =
                resolvedRoof.claddingDisplayPlanes.find(
                  (plane) => plane.id === `${samplePurlin.slopePlaneId}-cladding-display`,
                ) ?? resolvedRoof.claddingDisplayPlanes[0];
              let renderedSheetUnderside = offsetPointAlongRoofNormal(
                purlinTop,
                normal,
                PURLIN_TO_SHEET_CLEARANCE_METERS,
              );
              if (displayPlane) {
                const displayTopY = elevationOnRoofPlaneAtPoint(displayPlane, purlinCenter.x, purlinCenter.z);
                if (displayTopY != null) {
                  renderedSheetUnderside = offsetPointAlongRoofNormal(
                    { x: purlinCenter.x, y: displayTopY, z: purlinCenter.z },
                    normal,
                    -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
                  );
                }
              }
              const addContactLine = (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, color: number) => {
                const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
                materialsToDispose.push(material);
                const geometry = trackGeometry(
                  new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(from.x, slabY + from.y, from.z),
                    new THREE.Vector3(to.x, slabY + to.y, to.z),
                  ]),
                );
                const line = new THREE.Line(geometry, material);
                line.userData.explicitHelperMarker = true;
                framingGuideGroup.add(line);
              };
              const chordGap = distanceAlongRoofNormal(
                offsetPointAlongRoofNormal(purlinCenter, normal, -PURLIN_PROFILE_DEPTH_METERS / 2),
                chordTop,
                normal,
              );
              const sheetGap = distanceAlongRoofNormal(purlinTop, renderedSheetUnderside, normal);
              addContactLine(chordTop, purlinCenter, chordGap < -0.001 || chordGap > 0.003 ? 0xff0000 : 0xffff00);
              addContactLine(purlinTop, renderedSheetUnderside, sheetGap < 0 || sheetGap > 0.006 ? 0xff0000 : 0xffa500);
            }
          }

          if (
            showRidgeCap &&
            corrugatedEnabled &&
            (resolvedRoof.ridgeCapPlacements.length > 0 || resolvedRoof.ridgeCapPlacement)
          ) {
            const ridgeCapPlacements =
              resolvedRoof.ridgeCapPlacements.length > 0
                ? resolvedRoof.ridgeCapPlacements
                : resolvedRoof.ridgeCapPlacement
                  ? [resolvedRoof.ridgeCapPlacement]
                  : [];
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const ridgeCapMaterial = debugGuides
              ? new THREE.MeshStandardMaterial({ color: 0x14b8a6, metalness: 0.5, roughness: 0.45 })
              : usePreviewMaterials
                ? resolveRoofMetalMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  )
                : createRidgeCapMaterial();
            if (debugGuides || !usePreviewMaterials) {
              materialsToDispose.push(ridgeCapMaterial);
            }
            for (const ridgeCapPlacement of ridgeCapPlacements) {
              const capStart = new THREE.Vector3(
                ridgeCapPlacement.start.x,
                currentSlab.slabThicknessMeters + ridgeCapPlacement.start.y,
                ridgeCapPlacement.start.z,
              );
              const capEnd = new THREE.Vector3(
                ridgeCapPlacement.end.x,
                currentSlab.slabThicknessMeters + ridgeCapPlacement.end.y,
                ridgeCapPlacement.end.z,
              );
              const capAdjacentPlanes =
                resolvedRoof.roofType === 'hip'
                  ? (ridgeCapPlacement.adjacentPlaneIds ?? [])
                      .map((planeId) => {
                        const displayPlane =
                          resolvedRoof.claddingDisplayPlanes.find(
                            (plane) => plane.id.replace(/-cladding-display$/, '') === planeId,
                          ) ?? resolvedRoof.roofTopPlanes.find((plane) => plane.id === planeId);
                        return displayPlane
                          ? {
                              normal: new THREE.Vector3(
                                displayPlane.normal.x,
                                displayPlane.normal.y,
                                displayPlane.normal.z,
                              ),
                              corners: displayPlane.corners.map(
                                (corner) =>
                                  new THREE.Vector3(
                                    corner.x,
                                    currentSlab.slabThicknessMeters + corner.y,
                                    corner.z,
                                  ),
                              ),
                            }
                          : null;
                      })
                      .filter((plane): plane is { normal: THREE.Vector3; corners: THREE.Vector3[] } => plane != null)
                  : [];
              const ridgeCap =
                resolvedRoof.roofType === 'hip' && capAdjacentPlanes.length > 0
                  ? createFoldedRoofEdgeCapGroup({
                      start: capStart,
                      end: capEnd,
                      capWidthMeters: ridgeCapPlacement.widthMeters,
                      capThicknessMeters: ridgeCapPlacement.thicknessMeters,
                      material: ridgeCapMaterial,
                      adjacentPlanes: capAdjacentPlanes,
                      miterBottomEnds: true,
                    })
                  : createFoldedRidgeCapGroup(
                      capStart,
                      capEnd,
                      ridgeCapPlacement.widthMeters,
                      ridgeCapPlacement.thicknessMeters,
                      ridgeCapPlacement.roofAngleRadians,
                      ridgeCapMaterial,
                    );
              ridgeCap.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  trackGeometry(child.geometry);
                }
              });
              ridgeCapGroup.add(ridgeCap);
            }
          }

          if (
            showFascia &&
            currentRoofSystem.fascia.enabled &&
            resolvedRoof.fasciaPlacements.length > 0
          ) {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const fasciaMaterial = debugGuides
              ? new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.45 })
              : usePreviewMaterials
                ? resolveFasciaTrimMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  )
                : createRidgeCapMaterial();
            fasciaMaterial.side = THREE.DoubleSide;
            fasciaMaterial.needsUpdate = true;
            if (debugGuides || !usePreviewMaterials) {
              materialsToDispose.push(fasciaMaterial);
            }
            for (const placement of resolvedRoof.fasciaPlacements) {
              const mesh = new THREE.Mesh(
                trackGeometry(createFasciaTrimGeometry({
                  placement,
                  slabTopMeters: currentSlab.slabThicknessMeters,
                })),
                fasciaMaterial,
              );
              mesh.userData.fasciaEdgeRole = placement.edgeRole;
              fasciaGroup.add(mesh);
            }
          }

          if (
            showSoffit &&
            currentRoofSystem.soffit.enabled &&
            resolvedRoof.soffitPlacements.length > 0
          ) {
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const soffitMaterial = debugGuides
              ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.45, roughness: 0.5 })
              : usePreviewMaterials
                ? resolveSoffitTrimMaterial(
                    { visualStyle: currentVisualStyle, selected: roofSelected },
                    trackMat,
                  )
                : createRidgeCapMaterial();
            soffitMaterial.side = THREE.DoubleSide;
            soffitMaterial.needsUpdate = true;
            if (debugGuides || !usePreviewMaterials) {
              materialsToDispose.push(soffitMaterial);
            }
            for (const placement of resolvedRoof.soffitPlacements) {
              const mesh = new THREE.Mesh(
                trackGeometry(createSoffitPanelGeometry({
                  placement,
                  slabTopMeters: currentSlab.slabThicknessMeters,
                })),
                soffitMaterial,
              );
              mesh.userData.soffitEdgeRole = placement.edgeRole;
              soffitGroup.add(mesh);
            }
          }

          if (
            import.meta.env.DEV &&
            currentShowRoofFramingGuides &&
            resolvedRoof.roofType === 'gable' &&
            resolvedRoof.structuralRidgeStart &&
            resolvedRoof.structuralRidgeEnd &&
            resolvedRoof.claddingRidgeStart &&
            resolvedRoof.claddingRidgeEnd
          ) {
            const slabY = currentSlab.slabThicknessMeters;
            const peakY = resolvedRoof.roofPeakY;
            const addGuideLine = (start: THREE.Vector3, end: THREE.Vector3, color: number) => {
              const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
              materialsToDispose.push(material);
              const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints([start, end]));
              const line = new THREE.Line(geometry, material);
              line.userData.explicitHelperMarker = true;
              framingGuideGroup.add(line);
            };
            const ridgeSpan = Math.hypot(
              resolvedRoof.claddingRidgeEnd.x - resolvedRoof.claddingRidgeStart.x,
              resolvedRoof.claddingRidgeEnd.z - resolvedRoof.claddingRidgeStart.z,
            );
            const ridgeUx =
              ridgeSpan > 0
                ? (resolvedRoof.claddingRidgeEnd.x - resolvedRoof.claddingRidgeStart.x) / ridgeSpan
                : 1;
            const ridgeUz =
              ridgeSpan > 0
                ? (resolvedRoof.claddingRidgeEnd.z - resolvedRoof.claddingRidgeStart.z) / ridgeSpan
                : 0;
            const spanPerpX = -ridgeUz;
            const spanPerpZ = ridgeUx;
            const spanHalf = resolvedRoof.rafterRunMeters;
            for (const [point, color] of [
              [resolvedRoof.structuralRidgeStart, 0x14b8a6],
              [resolvedRoof.structuralRidgeEnd, 0x14b8a6],
              [resolvedRoof.claddingRidgeStart, 0xeab308],
              [resolvedRoof.claddingRidgeEnd, 0xeab308],
            ] as const) {
              addGuideLine(
                new THREE.Vector3(
                  point.x + spanPerpX * spanHalf,
                  slabY + peakY,
                  point.z + spanPerpZ * spanHalf,
                ),
                new THREE.Vector3(
                  point.x - spanPerpX * spanHalf,
                  slabY + peakY,
                  point.z - spanPerpZ * spanHalf,
                ),
                color,
              );
            }
          }

          if (
            currentRoofSystem?.gable.rakedConcreteCapEnabled &&
            showRakedCap &&
            currentGeometry.rakedCapPlacements?.length
          ) {
            const capMaterial = usePreviewMaterials
              ? resolveCastConcreteMaterial(
                  { visualStyle: currentVisualStyle, selected: gableSelected, role: 'structural' },
                  trackMat,
                )
              : createRakedConcreteCapMaterial(gableSelected);
            if (!usePreviewMaterials) {
              materialsToDispose.push(capMaterial);
            }
            const capsByStrip = new Map<
              string,
              Array<(typeof currentGeometry.rakedCapPlacements)[number]>
            >();
            for (const cap of currentGeometry.rakedCapPlacements) {
              const key = `${cap.gableEndSegmentId}:${cap.slope}`;
              const group = capsByStrip.get(key) ?? [];
              group.push(cap);
              capsByStrip.set(key, group);
            }
            for (const [, caps] of capsByStrip) {
              const frame = roofFrameById.get(caps[0]!.gableEndSegmentId);
              if (!frame) continue;
              const sortedCaps = [...caps].sort(
                (left, right) => left.startStationMeters - right.startStationMeters,
              );
              const strip = buildRakedCapStripRenderSegments(sortedCaps);
              if (!strip || strip.segments.length === 0) continue;

              const firstCap = sortedCaps[0]!;
              const startX = frame.start.x + frame.tangent.x * strip.startStationMeters;
              const startZ = frame.start.z + frame.tangent.z * strip.startStationMeters;
              const mesh = new THREE.Mesh(
                trackGeometry(createRakedCapStripGeometry(strip.segments)),
                capMaterial,
              );
              mesh.position.set(
                startX + frame.inwardNormal.x * (firstCap.wallDepthMeters / 2),
                currentSlab.slabThicknessMeters,
                startZ + frame.inwardNormal.z * (firstCap.wallDepthMeters / 2),
              );
              mesh.rotation.y = frame.rotationY;
              rakedCapGroup.add(mesh);
            }
          }

          for (const group of [
            roofCladdingGroup,
            ridgeCapGroup,
            fasciaGroup,
            soffitGroup,
            trussChordGroup,
            trussWebGroup,
            purlinGroup,
            basePlateGroup,
            anchorBoltGroup,
            rakedCapGroup,
            framingGuideGroup,
          ]) {
            if (group.children.length === 0) continue;
            const roofObjectType: DesignObjectType =
              group === rakedCapGroup ? 'gable_end_system' : 'gable_roof_system';
            const roofSelectionPriority = selectionPriorityForObjectType(roofObjectType);
            group.traverse((child) => {
              if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
                child.userData.selectable = true;
                child.userData.designObjectType = roofObjectType;
                child.userData.selectionPriority = roofSelectionPriority;
                selectable.push(child);
              }
            });
            root.add(group);
          }
        }

        const showCmuInfill = currentFoundationViewMode !== 'structural_frame_only';

        const cmuBlocksForMortar =
          showCmuInfill && currentWall.showIndividualBlocks ? cmuLayout.blocks : [];
        if (cmuBlocksForMortar.length > 0) {
          addCmuMortarJointMeshes({
            blocks: cmuBlocksForMortar,
            wall: currentWall,
            slabTopMeters: currentSlab.slabThicknessMeters,
            visualStyle: currentVisualStyle,
            cmuCutawayActive,
            cmuOpacity,
            debugMode: false,
            root,
            trackGeometry,
            trackMat,
          });
        }

        const blockInstances =
          showCmuInfill && currentWall.showIndividualBlocks ? currentGeometry.blockInstances : [];
        if (blockInstances.length > 0) {
          const blockHeightMeters = resolveCmuModuleConfig(currentWall).actualHeightMeters;
          const blocksByType = groupBlocksByType(blockInstances);
          blocksByType.forEach((instances, blockType) => {
            const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
            const blockMaterial = usePreviewMaterials
              ? resolveCmuMaterial(cmuMaterialOptions, trackMat)
              : makeMaterial(blockColor(blockType), cmuSelected, {
                  transparent: cmuOpacity < 1,
                  opacity: cmuOpacity,
                });
            const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
            const matrix = new THREE.Matrix4();
            const quaternion = new THREE.Quaternion();
            instances.forEach((block, index) => {
              quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
              const baseHeightMeters = block.physicalHeightMeters ?? block.heightMeters ?? blockHeightMeters;
              const isTopClosure = block.source === 'panel_top_closure';
              const renderHeightMeters = isTopClosure
                ? baseHeightMeters + TOP_COURSE_RENDER_EPSILON_METERS
                : baseHeightMeters;
              const renderYOffsetMeters = isTopClosure ? TOP_COURSE_RENDER_EPSILON_METERS / 2 : 0;
              matrix.compose(
                new THREE.Vector3(block.x, currentSlab.slabThicknessMeters + block.y + renderYOffsetMeters, block.z),
                quaternion,
                new THREE.Vector3(block.actualLengthMeters ?? block.lengthMeters, renderHeightMeters, block.depthMeters ?? currentWall.blockDepthMeters),
              );
              blocks.setMatrixAt(index, matrix);
            });
            blocks.instanceMatrix.needsUpdate = true;
            addSelectable(blocks, 'cmu_wall_system');
          });
        } else if (showCmuInfill) {
          const wallMaterial = makeMaterial(0xd1d5db, currentSelectedObjectType === 'cmu_wall_system', {
            transparent: true,
            opacity: cmuOpacity,
          });
          const segmentFrameById = new Map(
            (cmuLayout.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
          );
          const roughOpenings = cmuLayout.roughOpenings as PlasterOpening[];
          currentGeometry.wallSegments.forEach((segment) => {
            const frame = segmentFrameById.get(segment.segmentId);
            const wallPieces = buildInfillWallProxyPieces({
              segmentLengthMeters: segment.lengthMeters,
              wallHeightMeters: segment.heightMeters,
              wallThicknessMeters: segment.thicknessMeters,
              hostSegmentId: segment.segmentId,
              openings: roughOpenings,
            });
            wallPieces.forEach((piece) => {
              const centerlinePoint = frame
                ? {
                    x: frame.centerlineStart.x + frame.tangent.x * piece.centerStationMeters,
                    z: frame.centerlineStart.z + frame.tangent.z * piece.centerStationMeters,
                  }
                : { x: segment.x, z: segment.z };
              const wallMesh = new THREE.Mesh(
                trackGeometry(
                  new THREE.BoxGeometry(piece.lengthMeters, piece.heightMeters, piece.thicknessMeters),
                ),
                wallMaterial,
              );
              wallMesh.position.set(
                centerlinePoint.x,
                currentSlab.slabThicknessMeters + piece.centerElevationMeters,
                centerlinePoint.z,
              );
              wallMesh.rotation.y = segment.rotationY;
              wallMesh.renderOrder = 0;
              addSelectable(wallMesh, 'cmu_wall_system');
            });
          });
        }

        if (showCmuInfill) {
          const plasterPlacements = resolveInfillPlasterPanelPlacements({
            infillSystem: currentGeometry.infillSystem,
            panelBounds: currentGeometry.resolvedInfillPanelBounds ?? [],
            openings: cmuLayout.roughOpenings as PlasterOpening[],
            wallThicknessMeters: currentWall.wallThicknessMeters,
          });
          if (plasterPlacements.length > 0) {
            const plasterGroup = new THREE.Group();
            plasterGroup.name = 'plasterGroup';
            plasterPlacements.forEach((placement) => {
              const plasterMaterial = usePreviewMaterials
                ? resolvePlasterFinishMaterial(
                    {
                      visualStyle: currentVisualStyle,
                      selected: currentSelectedObjectType === 'cmu_infill_system',
                      plasterFinish: placement.finish,
                    },
                    trackMat,
                  )
                : makeMaterial(
                    placement.finish === 'smooth' ? 0xded8cf : 0xd8d1c5,
                    currentSelectedObjectType === 'cmu_infill_system',
                    {
                      side: THREE.DoubleSide,
                    },
                  );
              const mesh = new THREE.Mesh(
                trackGeometry(
                  new THREE.BoxGeometry(
                    placement.widthMeters,
                    placement.heightMeters,
                    placement.thicknessMeters,
                  ),
                ),
                plasterMaterial,
              );
              mesh.position.set(
                placement.center.x,
                currentSlab.slabThicknessMeters + placement.center.y,
                placement.center.z,
              );
              mesh.rotation.y = placement.rotationY;
              mesh.renderOrder = 1;
              plasterGroup.add(mesh);
            });
            plasterGroup.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.userData.selectable = true;
                child.userData.designObjectType = 'cmu_infill_system';
                child.userData.selectionPriority = selectionPriorityForObjectType('cmu_infill_system');
                selectable.push(child);
              }
            });
            root.add(plasterGroup);
          }
        }
      } else if (legacyPresetActive) {
        addLabel(root, 'NORTH WALL', new THREE.Vector3(0, 0.06, -currentWall.widthMeters / 2 - 0.8), 0x0284c7);
        addLabel(root, 'SOUTH WALL', new THREE.Vector3(0, 0.06, currentWall.widthMeters / 2 + 0.8), 0x0284c7);
        addLabel(root, 'WEST WALL', new THREE.Vector3(-currentWall.lengthMeters / 2 - 0.8, 0.06, 0), 0x0284c7);
        addLabel(root, 'EAST WALL', new THREE.Vector3(currentWall.lengthMeters / 2 + 0.8, 0.06, 0), 0x0284c7);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.lengthMeters, currentWall.heightMeters, currentWall.wallThicknessMeters)), pickMaterial.clone()),
          { wallFace: 'north' },
        ).position.set(0, wallY, -currentWall.widthMeters / 2 + wallInset);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.lengthMeters, currentWall.heightMeters, currentWall.wallThicknessMeters)), pickMaterial.clone()),
          { wallFace: 'south' },
        ).position.set(0, wallY, currentWall.widthMeters / 2 - wallInset);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.wallThicknessMeters, currentWall.heightMeters, currentWall.widthMeters)), pickMaterial.clone()),
          { wallFace: 'east' },
        ).position.set(currentWall.lengthMeters / 2 - wallInset, wallY, 0);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.wallThicknessMeters, currentWall.heightMeters, currentWall.widthMeters)), pickMaterial.clone()),
          { wallFace: 'west' },
        ).position.set(-currentWall.lengthMeters / 2 + wallInset, wallY, 0);

        const blockInstances = currentWall.showIndividualBlocks ? cmuLayout.blocks : [];
        if (blockInstances.length > 0) {
        addCmuMortarJointMeshes({
          blocks: blockInstances,
          wall: currentWall,
          slabTopMeters: currentSlab.slabThicknessMeters,
          visualStyle: currentVisualStyle,
          cmuCutawayActive,
          cmuOpacity,
          debugMode: false,
          root,
          trackGeometry,
          trackMat,
        });
        const blockHeightMeters = resolveCmuModuleConfig(currentWall).actualHeightMeters;
        const blocksByType = groupBlocksByType(blockInstances);
        blocksByType.forEach((instances, blockType) => {
          const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
          const blockMaterial = usePreviewMaterials
            ? resolveCmuMaterial(cmuMaterialOptions, trackMat)
            : makeMaterial(blockColor(blockType), cmuSelected);
          const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
          const matrix = new THREE.Matrix4();
          const quaternion = new THREE.Quaternion();
          instances.forEach((block, index) => {
            quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
            matrix.compose(
              new THREE.Vector3(block.x, currentSlab.slabThicknessMeters + block.y, block.z),
              quaternion,
              new THREE.Vector3(block.actualLengthMeters ?? block.lengthMeters, block.heightMeters ?? blockHeightMeters, block.depthMeters ?? currentWall.blockDepthMeters),
            );
            blocks.setMatrixAt(index, matrix);
          });
          blocks.instanceMatrix.needsUpdate = true;
          addSelectable(blocks, 'cmu_wall_system');
        });
        } else {
        const wallMaterial = makeMaterial(0xd1d5db, currentSelectedObjectType === 'cmu_wall_system', {
          transparent: true,
          opacity: 0.9,
        });
        const northSouthWall = trackGeometry(new THREE.BoxGeometry(currentWall.lengthMeters, currentWall.heightMeters, currentWall.wallThicknessMeters));
        const eastWestWall = trackGeometry(new THREE.BoxGeometry(currentWall.wallThicknessMeters, currentWall.heightMeters, currentWall.widthMeters));
        const north = new THREE.Mesh(northSouthWall, wallMaterial);
        north.position.set(0, wallY, -currentWall.widthMeters / 2 + wallInset);
        const south = north.clone();
        south.position.z = currentWall.widthMeters / 2 - wallInset;
        const east = new THREE.Mesh(eastWestWall, wallMaterial);
        east.position.set(currentWall.lengthMeters / 2 - wallInset, wallY, 0);
        const west = east.clone();
        west.position.x = -currentWall.lengthMeters / 2 + wallInset;
        [north, south, east, west].forEach((mesh) => addSelectable(mesh, 'cmu_wall_system'));
        }
      }

      const manualRuns = currentWall.manualMasonryCourseRuns ?? [];
      if (manualRuns.length > 0) {
        const manualBlocks = manualRuns.flatMap((run) => {
          const length = run.moduleLengthMeters || currentWall.blockLengthMeters * (run.unitType === 'half_block' ? 0.5 : 1);
          const height = run.moduleHeightMeters || currentWall.blockHeightMeters;
          const thickness = run.wallThicknessMeters || currentWall.wallThicknessMeters;
          const tangentLength = Math.hypot(run.tangent?.x ?? 1, run.tangent?.z ?? 0) || 1;
          const tangent = {
            x: (run.tangent?.x ?? 1) / tangentLength,
            z: (run.tangent?.z ?? 0) / tangentLength,
          };
          const normal = { x: -tangent.z, z: tangent.x };
          const origin = run.origin ?? { x: run.originX, y: run.courseIndex * height, z: run.originZ };
          const rotationY = Math.atan2(tangent.z, tangent.x);
          return Array.from({ length: run.count }, (_, index) => ({
            id: `${run.id}:${index}`,
            unitType: run.unitType,
            length,
            height,
            thickness,
            x: origin.x + tangent.x * (index * length + length / 2) + normal.x * (thickness / 2),
            y: origin.y + height / 2,
            z: origin.z + tangent.z * (index * length + length / 2) + normal.z * (thickness / 2),
            rotationY,
          }));
        });
        const manualBlocksByType = new Map<string, typeof manualBlocks>();
        manualBlocks.forEach((block) => {
          const blocks = manualBlocksByType.get(block.unitType) ?? [];
          blocks.push(block);
          manualBlocksByType.set(block.unitType, blocks);
        });
        manualBlocksByType.forEach((instances, unitType) => {
          const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
          const blockMaterial = usePreviewMaterials
            ? resolveCmuMaterial(cmuMaterialOptions, trackMat)
            : makeMaterial(manualBlockColor(unitType), cmuSelected);
          const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
          blocks.userData.manualMasonry = true;
          const matrix = new THREE.Matrix4();
          const quaternion = new THREE.Quaternion();
          instances.forEach((block, index) => {
            quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
            matrix.compose(
              new THREE.Vector3(block.x, currentSlab.slabThicknessMeters + block.y, block.z),
              quaternion,
              new THREE.Vector3(block.length, block.height, block.thickness),
            );
            blocks.setMatrixAt(index, matrix);
          });
          blocks.instanceMatrix.needsUpdate = true;
          addSelectable(blocks, 'cmu_wall_system', undefined, 60);
        });
      }

      const openingRenderGroups = createOpeningRenderGroups();
      populateOpeningAssemblyRenderGroups(openingRenderGroups, {
        cmuLayout,
        wall: currentWall,
        slabTopMeters: currentSlab.slabThicknessMeters,
        showGroutCells: currentShowGroutCells,
        showOpeningLayout: currentShowOpeningLayout,
        selectedOpeningId: selectedOpeningIdRef.current,
        hoveredOpeningId: hoveredOpeningIdRef.current,
        trackGeometry,
        makeMaterial,
        resolveLintelMaterial: usePreviewMaterials
          ? () =>
              resolveCastConcreteMaterial(
                { visualStyle: currentVisualStyle, selected: false, role: 'structural' },
                trackMat,
              )
          : undefined,
      });

      openingRenderGroups.frameGroup.traverse((child) => {
        const openingId = child.userData.openingId as string | undefined;
        if (!openingId) return;
        const opening = cmuLayout.roughOpenings.find((candidate) => candidate.id === openingId);
        const objectType: DesignObjectType = opening?.type === 'door' ? 'door_opening' : 'window_opening';
        child.userData.selectable = true;
        child.userData.designObjectType = objectType;
        child.userData.openingId = openingId;
        child.userData.selectionPriority = 100;
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) selectable.push(child);
      });
      openingRenderGroups.lintelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.lintelSolid) {
          child.userData.selectable = true;
          child.userData.designObjectType = 'cmu_wall_system';
          child.userData.selectionPriority = 40;
          selectable.push(child);
        }
      });
      root.add(openingRenderGroups.lintelGroup);
      root.add(openingRenderGroups.frameGroup);
      if (currentShowGroutCells) {
        openingRenderGroups.groutCellGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.groutSolid) {
            child.userData.selectable = true;
            child.userData.designObjectType = 'cmu_wall_system';
            child.userData.selectionPriority = 10;
            selectable.push(child);
          }
        });
        root.add(openingRenderGroups.groutCellGroup);
      }
      if (currentShowOpeningLayout) {
        root.add(openingRenderGroups.roughOpeningGuideGroup);
      }

      if (currentShowClosureWarnings) {
        const closureMaterial = makeMaterial(0xf59e0b, true, { transparent: true, opacity: 0.86 });
        cmuLayout.openingCourseClosures
          .filter((closure) => closure.closureType === 'cut_block' || closure.closureType === 'grout_fill')
          .forEach((closure) => {
            const wallLength = closure.wallFace === 'north' || closure.wallFace === 'south' ? currentWall.lengthMeters : currentWall.widthMeters;
            const centeredAlong = closure.roughOpeningEdge - wallLength / 2;
            const x = closure.wallFace === 'east' ? currentWall.lengthMeters / 2 : closure.wallFace === 'west' ? -currentWall.lengthMeters / 2 : centeredAlong;
            const z = closure.wallFace === 'north' ? -currentWall.widthMeters / 2 : closure.wallFace === 'south' ? currentWall.widthMeters / 2 : centeredAlong;
            const marker = new THREE.Mesh(
              trackGeometry(new THREE.BoxGeometry(Math.max(0.035, closure.residualGap), currentWall.blockHeightMeters * 0.5, currentWall.wallThicknessMeters + 0.1)),
              closureMaterial,
            );
            marker.position.set(x, currentSlab.slabThicknessMeters + (closure.courseBottom + closure.courseTop) / 2, z);
            marker.rotation.y = closure.wallFace === 'east' || closure.wallFace === 'west' ? Math.PI / 2 : 0;
            marker.userData.explicitHelperMarker = true;
            addSelectable(marker, 'cmu_wall_system', undefined, 5);
          });
      }

      refreshSiteGroundMaterial();
      updateGhost();
    }
    rebuildModelRef.current = rebuildModel;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    applyTheme();
    if (modelParamsRef.current.modelLoaded) rebuildModel();
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const emitCameraSnapshot = () => {
      onUserCameraChangeRef.current?.();
      onCameraSnapshotRef.current?.({
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      });
    };
    controls.addEventListener('end', emitCameraSnapshot);

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 1) event.preventDefault();
      pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
      const mode = toolModeRef.current;
      if (manualMasonryEnabledRef.current && event.button === 0) {
        const point = pickManualBrushPoint(event);
        if (!point) return;
        event.preventDefault();
        manualBrushActive = true;
        controls.enabled = false;
        onManualMasonryPointerRef.current?.({ kind: 'start', planX: point.x, planZ: point.z });
        return;
      }
      if (mode === 'move_opening' && event.button === 0) {
        const hit = pickSelectable(event);
        const openingId = hit?.data.openingId;
        if (openingId) {
          dragOpeningId = openingId;
          controls.enabled = false;
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const mode = toolModeRef.current;
      if (manualMasonryEnabledRef.current) {
        const point = pickManualBrushPoint(event);
        if (!point) return;
        onManualMasonryPointerRef.current?.({ kind: 'preview', planX: point.x, planZ: point.z });
        return;
      }
      if (dragOpeningId) {
        const pick = pickWall(event);
        if (!pick) {
          placementPreviewRef.current = null;
          updateGhostRef.current?.();
          return;
        }
          onInteractionRef.current?.({
            kind: 'opening_move',
            toolMode: mode,
            phase: 'preview',
            openingId: dragOpeningId,
            wallFace: pick.wallFace,
            offsetMeters: pick.offsetMeters,
            wallSegmentId: pick.wallSegmentId,
            positionAlongSegment: pick.positionAlongSegment,
            hitPointX: pick.hitPoint?.x,
            hitPointY: pick.hitPoint?.y,
            hitPointZ: pick.hitPoint?.z,
          });
        return;
      }
      if (mode === 'place_door' || mode === 'place_window') {
        const pick = pickWall(event);
        if (!pick) return;
        onInteractionRef.current?.({
          kind: 'wall_pick',
          toolMode: mode,
          wallFace: pick.wallFace,
          offsetMeters: pick.offsetMeters,
          wallSegmentId: pick.wallSegmentId,
          positionAlongSegment: pick.positionAlongSegment,
          hitPointX: pick.hitPoint?.x,
          hitPointY: pick.hitPoint?.y,
          hitPointZ: pick.hitPoint?.z,
          openingType: mode === 'place_door' ? 'door' : 'window',
        });
        return;
      }
      if (mode === 'select' && !dragOpeningId) {
        const hit = pickSelectable(event);
        const nextHoveredOpeningId = hit?.data.openingId ?? null;
        if (nextHoveredOpeningId !== hoveredOpeningIdRef.current) {
          hoveredOpeningIdRef.current = nextHoveredOpeningId;
          rebuildModelRef.current?.();
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (manualMasonryEnabledRef.current && manualBrushActive && event.button === 0) {
        const point = pickManualBrushPoint(event);
        manualBrushActive = false;
        controls.enabled = true;
        pointerDown = null;
        if (point) onManualMasonryPointerRef.current?.({ kind: 'commit', planX: point.x, planZ: point.z });
        return;
      }
      if (event.button !== 0 || pointerDown?.button !== 0) {
        pointerDown = null;
        return;
      }
      const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      pointerDown = null;
      const mode = toolModeRef.current;

      if (dragOpeningId) {
        const pick = pickWall(event);
        if (pick) {
          onInteractionRef.current?.({
            kind: 'opening_move',
            toolMode: mode,
            phase: 'commit',
            openingId: dragOpeningId,
            wallFace: pick.wallFace,
            offsetMeters: pick.offsetMeters,
            wallSegmentId: pick.wallSegmentId,
            positionAlongSegment: pick.positionAlongSegment,
            hitPointX: pick.hitPoint?.x,
            hitPointY: pick.hitPoint?.y,
            hitPointZ: pick.hitPoint?.z,
            openingType: modelParamsRef.current.wall.openings.find((item) => item.id === dragOpeningId)?.type,
          });
        }
        dragOpeningId = null;
        controls.enabled = true;
        return;
      }

      if (moved > CLICK_DRAG_THRESHOLD_PX) return;

      if (mode === 'place_door' || mode === 'place_window') {
        const pick = pickWall(event);
        if (!pick) return;
        onInteractionRef.current?.({
          kind: 'place_commit',
          toolMode: mode,
          wallFace: pick.wallFace,
          offsetMeters: pick.offsetMeters,
          wallSegmentId: pick.wallSegmentId,
          positionAlongSegment: pick.positionAlongSegment,
          hitPointX: pick.hitPoint?.x,
          hitPointY: pick.hitPoint?.y,
          hitPointZ: pick.hitPoint?.z,
          openingType: mode === 'place_door' ? 'door' : 'window',
        });
        return;
      }

      const pick = pickSelectable(event);
      const openingId = pick?.data.openingId;
      if (openingId) {
        onInteractionRef.current?.({
          kind: 'select_opening',
          toolMode: mode,
          openingId,
          openingType: pick?.data.designObjectType === 'door_opening' ? 'door' : 'window',
        });
        return;
      }
      const objectType = pick?.data.designObjectType;
      if (objectType) {
        onSelectRef.current(objectType);
        onInteractionRef.current?.({ kind: 'select_object', toolMode: mode, objectType });
        return;
      }
      onInteractionRef.current?.({ kind: 'clear_selection', toolMode: mode });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (manualMasonryEnabledRef.current && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        onManualMasonryPointerRef.current?.({ kind: 'undo' });
        return;
      }
      if (event.key !== 'Escape') return;
      dragOpeningId = null;
      dragWallFace = null;
      manualBrushActive = false;
      controls.enabled = true;
      if (manualMasonryEnabledRef.current) {
        onManualMasonryPointerRef.current?.({ kind: 'cancel_preview' });
        return;
      }
      onInteractionRef.current?.({ kind: 'cancel', toolMode: toolModeRef.current });
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!manualMasonryEnabledRef.current) return;
      event.preventDefault();
      onManualMasonryPointerRef.current?.({ kind: 'undo' });
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      controls.removeEventListener('end', emitCameraSnapshot);
      observer.disconnect();
      themeObserver.disconnect();
      unsubscribeMaterialDiagnostics();
      rendererRef.current = null;
      controls.dispose();
      clearGhost();
      geometriesToDispose.forEach((geometry) => geometry.dispose());
      materialsToDispose.forEach((material) => material.dispose());
      renderer.dispose();
      host.removeChild(renderer.domElement);
      rebuildModelRef.current = null;
      updateGhostRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (modelLoaded) rebuildModelRef.current?.();
  }, [geometryResult, layoutBounds, materialRevision, modelLoaded, roof, roofDisplayMode, roofLayerVisibility, roofSystem, selectedObjectType, selectedOpeningId, showClosureWarnings, showRoofReferencePerimeters, showRoofFramingGuides, foundationViewMode, showGroutCells, showOpeningLayout, slab, truss, wall, visualStyle]);

  useEffect(() => {
    if (visualStyle === 'material_preview') {
      ensurePreviewMaterialsLoaded(rendererRef.current ?? undefined).then(() => {
        previewMaterialsReadyRef.current = true;
        rebuildModelRef.current?.();
      });
      return;
    }
    rebuildModelRef.current?.();
  }, [visualStyle]);

  useEffect(() => {
    if (!viewCommand) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const host = hostRef.current;
    if (!camera || !controls || !host) return;
    if (viewCommand.action === 'grid_scale') return;
    if (viewCommand.action === 'fit' && !layoutBounds) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const fit =
      viewCommand.action === 'fit'
        ? fitPerspectiveCameraToBounds({
            bounds: layoutBounds!,
            camera: { fov: camera.fov, aspect: width / height },
            padding: 1.2,
          })
        : reset3dView();
    controls.target.set(fit.target.x, fit.target.y, fit.target.z);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z);
    camera.near = fit.near;
    camera.far = fit.far;
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    logDesignFramingDiagnostics({
      mode: '3d',
      bounds: layoutBounds,
      cameraTargetX: controls.target.x,
      cameraTargetZ: controls.target.z,
    });
    onCameraSnapshotRef.current?.({
      position: camera.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number],
    });
  }, [layoutBounds, viewCommand]);

  const toolHint =
    toolMode === 'place_door'
      ? 'Click a wall to place a door. ESC cancels.'
      : toolMode === 'place_window'
        ? 'Click a wall to place a window. ESC cancels.'
        : toolMode === 'move_opening'
          ? 'Drag a selected opening along its wall. ESC cancels.'
          : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-950 ${
        fitContainer ? 'h-full min-h-0' : 'h-[560px] min-h-[520px]'
      }`}
    >
      <div ref={hostRef} className="h-full min-h-0" aria-label="Design Builder generated 3D preview" />
      {!modelLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75 p-6 text-center text-sm font-medium text-slate-700 backdrop-blur-sm dark:bg-slate-950/70 dark:text-slate-200">
          Load a CMU template or start a new layout.
        </div>
      ) : toolHint ? (
        <div className="absolute left-4 top-4 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-xs font-medium text-cyan-800 shadow-sm dark:border-cyan-800 dark:bg-slate-900/90 dark:text-cyan-200">
          {toolHint}
        </div>
      ) : null}
      {modelLoaded && showGroutCells ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200">
          <div className="font-semibold">Grout / reinforced cells</div>
          <div className="mt-1 flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-400/80" /> Core / closure grout fill</div>
          <div className="mt-1 flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400/80" /> Precast lintel (always visible)</div>
        </div>
      ) : null}
    </div>
  );
}

function addLabel(root: THREE.Group, text: string, position: THREE.Vector3, color: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.strokeStyle = 'rgba(15,23,42,0.18)';
  context.lineWidth = 6;
  roundRect(context, 18, 26, 476, 76, 22);
  context.fill();
  context.stroke();
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.font = '700 40px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(1.65, 0.42, 1);
  root.add(sprite);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function groupBlocksByType<T extends { blockType: CmuBlockType }>(blocks: T[]): Map<CmuBlockType, T[]> {
  const grouped = new Map<CmuBlockType, T[]>();
  blocks.forEach((block) => {
    const existing = grouped.get(block.blockType) ?? [];
    existing.push(block);
    grouped.set(block.blockType, existing);
  });
  return grouped;
}

function blockColor(blockType: CmuBlockType): number {
  switch (blockType) {
    case 'half':
      return 0xcbd5e1;
    case 'corner':
    case 'end':
      return 0xbfc7d2;
    case 'jamb':
      return 0xa8b3c3;
    case 'lintel_bond_beam':
      return 0x94a3b8;
    case 'cut':
      return 0xd6d3d1;
    case 'full':
    default:
      return 0xd1d5db;
  }
}

function manualBlockColor(unitType: string): number {
  switch (unitType) {
    case 'half_block':
      return 0xcbd5e1;
    case 'end_block':
      return 0xbfc7d2;
    case 'jamb_block':
      return 0xa8b3c3;
    case 'bond_beam_block':
      return 0x94a3b8;
    case 'full_block':
    default:
      return 0xd1d5db;
  }
}
