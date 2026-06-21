import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  generateCmuLayout,
  logOpeningCoursePlacementsTableForDev,
  type CmuBlockType,
  type DesignGeometryBlockInstance,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { TOP_COURSE_RENDER_EPSILON_METERS } from '../domain/cmuInfillPanelSolver';
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
  RoofDisplayMode,
  RoofSystemSettings,
  WallOpeningParameters,
} from '../types';
import {
  buildHipMemberMesh,
  buildPurlinMesh,
  createCorrugatedMetalMaterial,
  createFoldedRidgeCapGroup,
  createRidgeCapMaterial,
  buildSteelTrussMemberMeshes,
  buildTrussAnchorBoltMeshes,
  buildTrussBasePlateMesh,
  buildTrussPlaneGuide,
  createSteelTrussMaterials,
} from '../geometry/roofRenderingGeometry';

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
  showFootprintSetout?: boolean;
  showInfillPanelBounds?: boolean;
  showRoofReferencePerimeters?: boolean;
  showRoofFramingGuides?: boolean;
  foundationViewMode?: FoundationViewMode;
  roofSystem?: RoofSystemSettings | null;
  roofDisplayMode?: RoofDisplayMode;
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
  showFootprintSetout = false,
  showInfillPanelBounds = false,
  showRoofReferencePerimeters = false,
  showRoofFramingGuides = false,
  foundationViewMode = 'full_model',
  roofSystem = null,
  roofDisplayMode = 'full_roof',
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
    showFootprintSetout,
    showInfillPanelBounds,
    showRoofReferencePerimeters,
    showRoofFramingGuides,
    foundationViewMode,
    roofSystem,
    roofDisplayMode,
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
    showFootprintSetout,
    showInfillPanelBounds,
    showRoofReferencePerimeters,
    showRoofFramingGuides,
    foundationViewMode,
    roofSystem,
    roofDisplayMode,
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
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: isDarkMode() ? 0x1e293b : 0xe2e8f0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(initialGridLayout.gridSize, initialGridLayout.gridSize),
      floorMaterial,
    );
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
    }

    function applyTheme() {
      const dark = isDarkMode();
      scene.background = new THREE.Color(dark ? 0x0f172a : 0xf8fafc);
      (grid.material as THREE.Material).opacity = dark ? 0.35 : 0.22;
      (grid.material as THREE.Material).transparent = true;
      floorMaterial.color.set(dark ? 0x1e293b : 0xe2e8f0);
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
      });
      frame.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          ghostMaterials.push(...(Array.isArray(child.material) ? child.material : [child.material]));
        }
      });
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
        truss: currentTruss,
        geometryResult: currentGeometry,
        layoutBounds: currentLayoutBounds,
        selectedObjectType: currentSelectedObjectType,
        showOpeningLayout: currentShowOpeningLayout,
        showGroutCells: currentShowGroutCells,
        showClosureWarnings: currentShowClosureWarnings,
        showFootprintSetout: currentShowFootprintSetout,
        showInfillPanelBounds: currentShowInfillPanelBounds,
        showRoofReferencePerimeters: currentShowRoofReferencePerimeters,
        showRoofFramingGuides: currentShowRoofFramingGuides,
        foundationViewMode: currentFoundationViewMode,
        roofSystem: currentRoofSystem,
        roofDisplayMode: currentRoofDisplayMode,
      } = params;
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

      const slabMaterial = new THREE.MeshStandardMaterial({
        color: currentSelectedObjectType === 'building_footprint' ? 0x22d3ee : 0xcbd5e1,
        roughness: 0.78,
        metalness: 0.05,
      });
      materialsToDispose.push(slabMaterial);
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
        if (import.meta.env.DEV && currentShowFootprintSetout && currentGeometry.resolvedFootprint) {
          [
            createFootprintSetoutLine(currentGeometry.resolvedFootprint.exteriorFacePolygon, currentSlab.slabThicknessMeters + 0.035, 0x22d3ee),
            createFootprintSetoutLine(currentGeometry.resolvedFootprint.interiorFacePolygon, currentSlab.slabThicknessMeters + 0.045, 0xf97316),
            createFootprintSetoutLine(currentGeometry.resolvedFootprint.centerlinePolygon, currentSlab.slabThicknessMeters + 0.055, 0xa78bfa),
          ].forEach((line) => {
            trackGeometry(line.geometry);
            materialsToDispose.push(line.material as THREE.Material);
            root.add(line);
          });
        }

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
          const columnMaterial = makeMaterial(0x9ca3af, currentSelectedObjectType === 'structural_frame_system', {
            roughness: 0.85,
          });
          frameSystem.columns.forEach((column) => {
            const mesh = new THREE.Mesh(
              trackGeometry(new THREE.BoxGeometry(column.widthMeters, column.heightMeters, column.depthMeters)),
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
          const beamMaterial = makeMaterial(0x6b7280, currentSelectedObjectType === 'structural_frame_system', {
            roughness: 0.8,
          });
          const plinthBeamMaterial = makeMaterial(0x57534e, currentSelectedObjectType === 'structural_frame_system', {
            roughness: 0.85,
          });
          const tieBeamMaterial = makeMaterial(0x44403c, currentSelectedObjectType === 'structural_frame_system', {
            roughness: 0.85,
          });
          const roofBeamMaterial = makeMaterial(0x6b7280, currentSelectedObjectType === 'structural_frame_system', {
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
        if (currentGeometry.isolatedFootings?.length) {
          const footingMaterial = makeMaterial(0x78716c, currentSelectedObjectType === 'structural_frame_system', {
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
        if (import.meta.env.DEV && currentShowInfillPanelBounds && currentGeometry.resolvedInfillPanelBounds?.length) {
          const boundsMaterial = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 });
          currentGeometry.resolvedInfillPanelBounds.forEach((bounds) => {
            const bottomY = currentSlab.slabThicknessMeters + bounds.bottomElevationMeters;
            const topY = currentSlab.slabThicknessMeters + bounds.topElevationMeters;
            const left = bounds.leftSupportInsideFaceWorld;
            const right = bounds.rightSupportInsideFaceWorld;
            [
              [left, left],
              [right, right],
            ].forEach(([point]) => {
              const line = new THREE.Line(
                trackGeometry(
                  new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(point.x, bottomY, point.z),
                    new THREE.Vector3(point.x, topY, point.z),
                  ]),
                ),
                boundsMaterial,
              );
              line.userData.explicitHelperMarker = true;
              root.add(line);
            });
            const spanLine = new THREE.Line(
              trackGeometry(
                new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(left.x, bottomY, left.z),
                  new THREE.Vector3(right.x, bottomY, right.z),
                  new THREE.Vector3(right.x, topY, right.z),
                  new THREE.Vector3(left.x, topY, left.z),
                  new THREE.Vector3(left.x, bottomY, left.z),
                ]),
              ),
              boundsMaterial,
            );
            spanLine.userData.explicitHelperMarker = true;
            root.add(spanLine);
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
          currentRoofDisplayMode === 'full_roof' ||
          currentRoofDisplayMode === 'roof_cladding_only' ||
          currentRoofDisplayMode === 'foundation_frame_roof';
        const showRoofFraming =
          currentRoofDisplayMode === 'full_roof' ||
          currentRoofDisplayMode === 'steel_framing_only' ||
          currentRoofDisplayMode === 'foundation_frame_roof';
        const showGableMasonry =
          currentRoofDisplayMode === 'full_roof' ||
          currentRoofDisplayMode === 'gable_masonry_only' ||
          currentRoofDisplayMode === 'foundation_frame_roof';

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
          const gableCmuGroup = new THREE.Group();
          gableCmuGroup.name = 'gableCmuGroup';
          const rakedCapGroup = new THREE.Group();
          rakedCapGroup.name = 'rakedCapGroup';
          const ridgeCapGroup = new THREE.Group();
          ridgeCapGroup.name = 'ridgeCapGroup';
          const framingGuideGroup = new THREE.Group();
          framingGuideGroup.name = 'framingGuideGroup';

          const roofThickness = resolvedRoof.roofAssemblyThicknessMeters ?? 0.15;
          const corrugatedEnabled = currentRoofSystem.corrugatedMetal.enabled;

          if (showRoofCladding && corrugatedEnabled) {
            const roofMaterial = createCorrugatedMetalMaterial();
            materialsToDispose.push(roofMaterial);
            for (const plane of resolvedRoof.roofTopPlanes) {
              if (plane.corners.length < 3) continue;
              const positions: number[] = [];
              for (const corner of plane.corners) {
                positions.push(corner.x, currentSlab.slabThicknessMeters + corner.y, corner.z);
              }
              const indices = plane.corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
              const topGeometry = trackGeometry(new THREE.BufferGeometry());
              topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
              topGeometry.setIndex(indices);
              topGeometry.computeVertexNormals();
              const mesh = new THREE.Mesh(topGeometry, roofMaterial);
              roofCladdingGroup.add(mesh);
            }
          } else if (showRoofCladding) {
            const roofMaterial = makeMaterial(0x64748b, currentSelectedObjectType === 'gable_roof_system', {
              roughness: 0.75,
              opacity: 0.92,
            });
            for (const plane of resolvedRoof.roofTopPlanes) {
              if (plane.corners.length < 3) continue;
              const positions: number[] = [];
              for (const corner of plane.corners) {
                positions.push(corner.x, currentSlab.slabThicknessMeters + corner.y, corner.z);
              }
              const indices = plane.corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
              const topGeometry = trackGeometry(new THREE.BufferGeometry());
              topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
              topGeometry.setIndex(indices);
              topGeometry.computeVertexNormals();
              roofCladdingGroup.add(new THREE.Mesh(topGeometry, roofMaterial));
            }
          }

          if (showRoofFraming && resolvedRoof.roofType === 'gable' && currentRoofSystem.steelTrusses.enabled) {
            const steelMaterials = createSteelTrussMaterials();
            materialsToDispose.push(
              steelMaterials.chord,
              steelMaterials.web,
              steelMaterials.plate,
              steelMaterials.bolt,
            );
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
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
            const hipMaterial = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.78, roughness: 0.32 });
            materialsToDispose.push(hipMaterial);
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

          if (showRoofFraming && currentRoofSystem.purlins.enabled) {
            const steelMaterials = createSteelTrussMaterials();
            const purlinMaterial =
              import.meta.env.DEV && currentShowRoofFramingGuides
                ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.45 })
                : steelMaterials.purlin;
            materialsToDispose.push(purlinMaterial);
            for (const purlin of resolvedRoof.purlinPlacements) {
              const mesh = buildPurlinMesh(
                new THREE.Vector3(
                  purlin.start.x,
                  currentSlab.slabThicknessMeters + purlin.start.y,
                  purlin.start.z,
                ),
                new THREE.Vector3(
                  purlin.end.x,
                  currentSlab.slabThicknessMeters + purlin.end.y,
                  purlin.end.z,
                ),
                purlinMaterial,
              );
              trackGeometry(mesh.geometry);
              purlinGroup.add(mesh);
            }
          }

          if (
            showRoofCladding &&
            corrugatedEnabled &&
            resolvedRoof.ridgeCapPlacement
          ) {
            const ridgeCapPlacement = resolvedRoof.ridgeCapPlacement;
            const debugGuides = import.meta.env.DEV && currentShowRoofFramingGuides;
            const ridgeCapMaterial = debugGuides
              ? new THREE.MeshStandardMaterial({ color: 0x14b8a6, metalness: 0.5, roughness: 0.45 })
              : createRidgeCapMaterial();
            materialsToDispose.push(ridgeCapMaterial);
            const ridgeCap = createFoldedRidgeCapGroup(
              new THREE.Vector3(
                ridgeCapPlacement.start.x,
                currentSlab.slabThicknessMeters + ridgeCapPlacement.start.y,
                ridgeCapPlacement.start.z,
              ),
              new THREE.Vector3(
                ridgeCapPlacement.end.x,
                currentSlab.slabThicknessMeters + ridgeCapPlacement.end.y,
                ridgeCapPlacement.end.z,
              ),
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

          if (showGableMasonry && currentGeometry.rakedCapPlacements?.length) {
            const capMaterial = makeMaterial(0x78716c, currentSelectedObjectType === 'gable_end_system', {
              roughness: 0.85,
            });
            for (const cap of currentGeometry.rakedCapPlacements) {
              const frame = roofFrameById.get(cap.gableEndSegmentId);
              if (!frame) continue;
              const span = cap.endStationMeters - cap.startStationMeters;
              const avgHeight =
                (cap.topLeftElevationMeters + cap.topRightElevationMeters) / 2 - cap.baseElevationMeters;
              if (span <= 0 || avgHeight <= 0) continue;
              const startX = frame.start.x + frame.tangent.x * cap.startStationMeters;
              const startZ = frame.start.z + frame.tangent.z * cap.startStationMeters;
              const endX = frame.start.x + frame.tangent.x * cap.endStationMeters;
              const endZ = frame.start.z + frame.tangent.z * cap.endStationMeters;
              const centerX = (startX + endX) / 2 + frame.inwardNormal.x * (cap.wallDepthMeters / 2);
              const centerZ = (startZ + endZ) / 2 + frame.inwardNormal.z * (cap.wallDepthMeters / 2);
              const mesh = new THREE.Mesh(
                trackGeometry(new THREE.BoxGeometry(span, avgHeight, cap.wallDepthMeters)),
                capMaterial,
              );
              mesh.position.set(
                centerX,
                currentSlab.slabThicknessMeters + cap.baseElevationMeters + avgHeight / 2,
                centerZ,
              );
              mesh.rotation.y = frame.rotationY;
              rakedCapGroup.add(mesh);
            }
          }

          if (showGableMasonry && currentGeometry.gablePlacements?.length) {
            const gableMaterial = makeMaterial(0xd97706, currentSelectedObjectType === 'gable_end_system');
            currentGeometry.gablePlacements.forEach((placement) => {
              const mesh = new THREE.Mesh(
                trackGeometry(
                  new THREE.BoxGeometry(placement.lengthMeters, placement.heightMeters, placement.depthMeters),
                ),
                gableMaterial,
              );
              mesh.position.set(
                placement.x,
                currentSlab.slabThicknessMeters + placement.y,
                placement.z,
              );
              mesh.rotation.y = placement.rotationY;
              gableCmuGroup.add(mesh);
            });
          }

          for (const group of [
            roofCladdingGroup,
            ridgeCapGroup,
            trussChordGroup,
            trussWebGroup,
            purlinGroup,
            basePlateGroup,
            anchorBoltGroup,
            gableCmuGroup,
            rakedCapGroup,
            framingGuideGroup,
          ]) {
            if (group.children.length === 0) continue;
            const roofObjectType: DesignObjectType =
              group === gableCmuGroup || group === rakedCapGroup ? 'gable_end_system' : 'gable_roof_system';
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
        const cmuOpacity = currentFoundationViewMode === 'cutaway_below_grade' ? 0.35 : 0.9;

        const blockInstances =
          showCmuInfill && currentWall.showIndividualBlocks ? currentGeometry.blockInstances : [];
        if (blockInstances.length > 0) {
          const blockHeightMeters = resolveCmuModuleConfig(currentWall).actualHeightMeters;
          const blocksByType = groupBlocksByType(blockInstances);
          blocksByType.forEach((instances, blockType) => {
            const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
            const blockMaterial = makeMaterial(blockColor(blockType), currentSelectedObjectType === 'cmu_wall_system', {
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
          currentGeometry.wallSegments.forEach((segment) => {
            const wallMesh = new THREE.Mesh(
              trackGeometry(new THREE.BoxGeometry(segment.lengthMeters, segment.heightMeters, segment.thicknessMeters)),
              wallMaterial,
            );
            wallMesh.position.set(segment.x, currentSlab.slabThicknessMeters + segment.y, segment.z);
            wallMesh.rotation.y = segment.rotationY;
            addSelectable(wallMesh, 'cmu_wall_system');
          });
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
        const blockHeightMeters = resolveCmuModuleConfig(currentWall).actualHeightMeters;
        const blocksByType = groupBlocksByType(blockInstances);
        blocksByType.forEach((instances, blockType) => {
          const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
          const blockMaterial = makeMaterial(blockColor(blockType), currentSelectedObjectType === 'cmu_wall_system');
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
          const blockMaterial = makeMaterial(manualBlockColor(unitType), currentSelectedObjectType === 'cmu_wall_system');
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
  }, [geometryResult, layoutBounds, modelLoaded, roof, roofDisplayMode, roofSystem, selectedObjectType, selectedOpeningId, showClosureWarnings, showFootprintSetout, showInfillPanelBounds, showRoofReferencePerimeters, showRoofFramingGuides, foundationViewMode, showGroutCells, showOpeningLayout, slab, truss, wall]);

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
