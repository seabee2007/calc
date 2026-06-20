import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  generateCmuLayout,
  type CmuBlockType,
  type DesignGeometryBlockInstance,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import { getNormalizedPointerFromClient } from '../domain/pointerPlanMapping';
import type {
  DesignBuilderCameraSnapshot,
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  CmuWallSystemParameters,
  DesignObjectType,
  GableRoofSystemParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';

const CLICK_DRAG_THRESHOLD_PX = 5;

export interface DesignBuilderPlacementPreview {
  wallFace: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters: number;
  openingType: WallOpeningParameters['type'];
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
  isValid: boolean;
  openingId?: string;
  wallSegmentId?: string;
}

interface DesignBuilderViewerProps {
  modelLoaded: boolean;
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
  geometryResult?: DesignGeometryResult;
  selectedObjectType: DesignObjectType | null;
  selectedOpeningId?: string | null;
  toolMode?: DesignBuilderToolMode;
  placementPreview?: DesignBuilderPlacementPreview | null;
  onSelectObjectType: (objectType: DesignObjectType) => void;
  onInteraction?: (event: DesignBuilderInteractionEvent) => void;
  fitContainer?: boolean;
  viewCommand?: { id: number; action: 'fit' | 'reset' } | null;
  initialCameraSnapshot?: DesignBuilderCameraSnapshot | null;
  onCameraSnapshotChange?: (snapshot: DesignBuilderCameraSnapshot) => void;
  showOpeningLayout?: boolean;
  showGroutCells?: boolean;
  showClosureWarnings?: boolean;
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

export default function DesignBuilderViewer({
  modelLoaded,
  slab,
  wall,
  roof,
  truss,
  geometryResult,
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
  showOpeningLayout = true,
  showGroutCells = false,
  showClosureWarnings = false,
  manualMasonryEnabled = false,
  onManualMasonryPointer,
}: DesignBuilderViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectObjectType);
  const onInteractionRef = useRef(onInteraction);
  const onCameraSnapshotRef = useRef(onCameraSnapshotChange);
  const onManualMasonryPointerRef = useRef(onManualMasonryPointer);
  const initialCameraSnapshotRef = useRef(initialCameraSnapshot);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneSizeRef = useRef({ length: 6, width: 5, height: 3 });
  const toolModeRef = useRef(toolMode);
  const selectedOpeningIdRef = useRef(selectedOpeningId);
  const placementPreviewRef = useRef(placementPreview);
  const manualMasonryEnabledRef = useRef(manualMasonryEnabled);
  const rebuildModelRef = useRef<(() => void) | null>(null);
  const updateGhostRef = useRef<(() => void) | null>(null);
  const modelParamsRef = useRef({
    modelLoaded,
    slab,
    wall,
    roof,
    truss,
    geometryResult,
    selectedObjectType,
    showOpeningLayout,
    showGroutCells,
    showClosureWarnings,
  });
  modelParamsRef.current = {
    modelLoaded,
    slab,
    wall,
    roof,
    truss,
    geometryResult,
    selectedObjectType,
    showOpeningLayout,
    showGroutCells,
    showClosureWarnings,
  };
  onSelectRef.current = onSelectObjectType;
  onInteractionRef.current = onInteraction;
  onCameraSnapshotRef.current = onCameraSnapshotChange;
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

    const grid = new THREE.GridHelper(14, 28);
    scene.add(grid);
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
    let dragWallFace: WallOpeningParameters['wallFace'] | null = null;

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

    function addWallPickable(mesh: THREE.Mesh, wallFace: WallOpeningParameters['wallFace']) {
      mesh.userData.wallFace = wallFace;
      mesh.userData.isWallPickable = true;
      wallPickables.push(mesh);
      root.add(mesh);
      return mesh;
    }

    function applyTheme() {
      const dark = isDarkMode();
      scene.background = new THREE.Color(dark ? 0x0f172a : 0xf8fafc);
      (grid.material as THREE.Material).opacity = dark ? 0.35 : 0.22;
      (grid.material as THREE.Material).transparent = true;
    }

    function setPointerFromEvent(event: PointerEvent) {
      const pointer = getNormalizedPointerFromClient(event, renderer.domElement);
      raycaster.setFromCamera(pointer, camera);
    }

    function pickWall(event: PointerEvent) {
      setPointerFromEvent(event);
      const hit = raycaster.intersectObjects(wallPickables, false)[0];
      if (!hit?.object.userData.wallFace) return null;
      const wallFace = hit.object.userData.wallFace as WallOpeningParameters['wallFace'];
      const point = hit.point;
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

      const resolvedLike: ResolvedCmuOpening = {
        id: preview.openingId ?? 'preview',
        type: preview.openingType,
        wallFace: preview.wallFace,
        actualWidthMeters: preview.widthMeters,
        actualHeightMeters: preview.heightMeters,
        actualAreaSquareMeters: preview.widthMeters * preview.heightMeters,
        roughOpeningWidthMeters: preview.widthMeters + 0.1,
        roughOpeningHeightMeters: preview.heightMeters + 0.1,
        roughOpeningAreaSquareMeters: (preview.widthMeters + 0.1) * (preview.heightMeters + 0.1),
        roughStartAlongMeters: preview.offsetMeters - 0.05,
        roughEndAlongMeters: preview.offsetMeters + preview.widthMeters + 0.05,
        roughBottomMeters: preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0,
        roughTopMeters:
          (preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0) + preview.heightMeters + 0.1,
        actualStartAlongMeters: preview.offsetMeters,
        actualEndAlongMeters: preview.offsetMeters + preview.widthMeters,
        actualBottomMeters: preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0,
        actualTopMeters:
          (preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0) + preview.heightMeters,
        lintelType: 'bond_beam',
        lintelBearingMeters: 0.2,
        lintelCourseCount: 1,
        lintelLengthMeters: preview.widthMeters + 0.5,
        lintelHeightMeters: 0.2,
        jambGroutEnabled: true,
        jambRebarEnabled: false,
        groutCellsEachSide: 1,
        jambGroutCellCount: 2,
        groutCellsAboveOpening: 0,
        groutCellsBelowWindow: 0,
        openingFrameMaterial: 'none',
      };

      const ghostWall = modelParamsRef.current.wall;
      const ghostSlab = modelParamsRef.current.slab;
      const frame = createOpeningFrame(resolvedLike, ghostWall, ghostSlab.slabThicknessMeters, {
        preview: true,
        valid: preview.isValid,
        selected: Boolean(preview.openingId && preview.openingId === selectedOpeningIdRef.current),
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
        selectedObjectType: currentSelectedObjectType,
        showOpeningLayout: currentShowOpeningLayout,
        showGroutCells: currentShowGroutCells,
        showClosureWarnings: currentShowClosureWarnings,
      } = params;
      root.clear();
      selectable.length = 0;
      wallPickables.length = 0;
      geometriesToDispose.splice(0).forEach((geometry) => geometry.dispose());
      materialsToDispose.splice(0).forEach((material) => material.dispose());

      addGroundPlane(root, isDarkMode());
      sceneSizeRef.current = {
        length: currentWall.lengthMeters,
        width: currentWall.widthMeters,
        height: currentSlab.slabThicknessMeters + currentWall.heightMeters + (currentRoof.widthMeters / 2 + currentRoof.overhangMeters) * currentRoof.pitchRisePerRun,
      };

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
      const slabMesh = new THREE.Mesh(
        trackGeometry(new THREE.BoxGeometry(currentSlab.lengthMeters, currentSlab.slabThicknessMeters, currentSlab.widthMeters)),
        slabMaterial,
      );
      slabMesh.position.y = currentSlab.slabThicknessMeters / 2;
      addSelectable(slabMesh, 'building_footprint');

      const layoutGraphActive = currentGeometry?.sourcePath === 'layout_graph';
      const cmuLayout = layoutGraphActive && currentGeometry ? currentGeometry.wallCmuLayout : generateCmuLayout(currentWall);
      if (layoutGraphActive) {
        if (import.meta.env.DEV && currentGeometry.exteriorFootprint.length >= 3) {
          const outlinePoints = [
            ...currentGeometry.exteriorFootprint,
            currentGeometry.exteriorFootprint[0],
          ].map((point) => new THREE.Vector3(point.x, currentSlab.slabThicknessMeters + 0.025, point.z));
          const outlineGeometry = trackGeometry(new THREE.BufferGeometry().setFromPoints(outlinePoints));
          const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 });
          materialsToDispose.push(outlineMaterial);
          root.add(new THREE.Line(outlineGeometry, outlineMaterial));
        }

        currentGeometry.wallSegments.forEach((segment) => {
          const pickMesh = new THREE.Mesh(
            trackGeometry(new THREE.BoxGeometry(segment.lengthMeters, segment.heightMeters, segment.thicknessMeters)),
            pickMaterial.clone(),
          );
          pickMesh.position.set(segment.x, currentSlab.slabThicknessMeters + segment.y, segment.z);
          pickMesh.rotation.y = segment.rotationY;
          addWallPickable(pickMesh, 'south');
        });

        const blockInstances = currentWall.showIndividualBlocks ? currentGeometry.blockInstances : [];
        if (blockInstances.length > 0) {
          const blocksByType = groupBlocksByType(blockInstances);
          blocksByType.forEach((instances, blockType) => {
            const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, currentWall.blockDepthMeters));
            const blockMaterial = makeMaterial(blockColor(blockType), currentSelectedObjectType === 'cmu_wall_system');
            const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
            const matrix = new THREE.Matrix4();
            const quaternion = new THREE.Quaternion();
            instances.forEach((block, index) => {
              quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
              matrix.compose(
                new THREE.Vector3(block.x, currentSlab.slabThicknessMeters + block.y, block.z),
                quaternion,
                new THREE.Vector3(block.lengthMeters, currentWall.blockHeightMeters, 1),
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
      } else {
        addLabel(root, 'NORTH WALL', new THREE.Vector3(0, 0.06, -currentWall.widthMeters / 2 - 0.8), 0x0284c7);
        addLabel(root, 'SOUTH WALL', new THREE.Vector3(0, 0.06, currentWall.widthMeters / 2 + 0.8), 0x0284c7);
        addLabel(root, 'WEST WALL', new THREE.Vector3(-currentWall.lengthMeters / 2 - 0.8, 0.06, 0), 0x0284c7);
        addLabel(root, 'EAST WALL', new THREE.Vector3(currentWall.lengthMeters / 2 + 0.8, 0.06, 0), 0x0284c7);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.lengthMeters, currentWall.heightMeters, currentWall.wallThicknessMeters)), pickMaterial.clone()),
          'north',
        ).position.set(0, wallY, -currentWall.widthMeters / 2 + wallInset);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.lengthMeters, currentWall.heightMeters, currentWall.wallThicknessMeters)), pickMaterial.clone()),
          'south',
        ).position.set(0, wallY, currentWall.widthMeters / 2 - wallInset);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.wallThicknessMeters, currentWall.heightMeters, currentWall.widthMeters)), pickMaterial.clone()),
          'east',
        ).position.set(currentWall.lengthMeters / 2 - wallInset, wallY, 0);
        addWallPickable(
          new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(currentWall.wallThicknessMeters, currentWall.heightMeters, currentWall.widthMeters)), pickMaterial.clone()),
          'west',
        ).position.set(-currentWall.lengthMeters / 2 + wallInset, wallY, 0);

        const blockInstances = currentWall.showIndividualBlocks ? cmuLayout.blocks : [];
        if (blockInstances.length > 0) {
        const blocksByType = groupBlocksByType(blockInstances);
        blocksByType.forEach((instances, blockType) => {
          const blockGeometry = trackGeometry(new THREE.BoxGeometry(1, 1, currentWall.blockDepthMeters));
          const blockMaterial = makeMaterial(blockColor(blockType), currentSelectedObjectType === 'cmu_wall_system');
          const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
          const matrix = new THREE.Matrix4();
          const quaternion = new THREE.Quaternion();
          instances.forEach((block, index) => {
            quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
            matrix.compose(
              new THREE.Vector3(block.x, currentSlab.slabThicknessMeters + block.y, block.z),
              quaternion,
              new THREE.Vector3(block.lengthMeters, currentWall.blockHeightMeters, 1),
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

      if (currentShowOpeningLayout) {
        cmuLayout.roughOpenings.forEach((opening) => {
          const frame = createOpeningFrame(opening, currentWall, currentSlab.slabThicknessMeters, {
            selected: opening.id === selectedOpeningIdRef.current,
          });
          const objectType: DesignObjectType = opening.type === 'door' ? 'door_opening' : 'window_opening';
          frame.traverse((child) => {
            child.userData.selectable = true;
            child.userData.designObjectType = objectType;
            child.userData.openingId = opening.id;
            child.userData.selectionPriority = 100;
            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) selectable.push(child);
          });
          root.add(frame);
        });
      }

      if (currentShowGroutCells) {
        const jambGroutMaterial = makeMaterial(0x475569, false, { transparent: true, opacity: 0.92 });
        cmuLayout.jambGroutCells.forEach((cell) => {
          const cellMesh = new THREE.Mesh(
            trackGeometry(new THREE.BoxGeometry(cell.widthMeters, cell.heightMeters * 0.86, currentWall.wallThicknessMeters + 0.08)),
            jambGroutMaterial,
          );
          cellMesh.position.set(cell.x, currentSlab.slabThicknessMeters + cell.y, cell.z);
          cellMesh.rotation.y = cell.rotationY;
          addSelectable(cellMesh, 'cmu_wall_system', undefined, 10);
        });
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

      if (currentShowOpeningLayout) {
        const lintelMaterial = makeMaterial(0x9ca3af, currentSelectedObjectType === 'cmu_wall_system');
        cmuLayout.lintels.forEach((lintel) => {
          const lintelMesh = new THREE.Mesh(
            trackGeometry(new THREE.BoxGeometry(lintel.lengthMeters, lintel.heightMeters * 0.72, currentWall.wallThicknessMeters + 0.05)),
            lintelMaterial,
          );
          lintelMesh.position.set(lintel.x, currentSlab.slabThicknessMeters + lintel.y, lintel.z);
          lintelMesh.rotation.y = lintel.rotationY;
            addSelectable(lintelMesh, 'cmu_wall_system', undefined, 40);
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
          dragWallFace = modelParamsRef.current.wall.openings.find((item) => item.id === openingId)?.wallFace ?? null;
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
      if (dragOpeningId && dragWallFace) {
        const pick = pickWall(event);
        if (!pick || pick.wallFace !== dragWallFace) return;
        onInteractionRef.current?.({
          kind: 'opening_move',
          toolMode: mode,
          phase: 'preview',
          openingId: dragOpeningId,
          wallFace: pick.wallFace,
          offsetMeters: pick.offsetMeters,
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
          openingType: mode === 'place_door' ? 'door' : 'window',
        });
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
        if (pick && dragWallFace && pick.wallFace === dragWallFace) {
          onInteractionRef.current?.({
            kind: 'opening_move',
            toolMode: mode,
            phase: 'commit',
            openingId: dragOpeningId,
            wallFace: pick.wallFace,
            offsetMeters: pick.offsetMeters,
            openingType: modelParamsRef.current.wall.openings.find((item) => item.id === dragOpeningId)?.type,
          });
        }
        dragOpeningId = null;
        dragWallFace = null;
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
  }, [geometryResult, modelLoaded, roof, selectedObjectType, selectedOpeningId, showClosureWarnings, showGroutCells, showOpeningLayout, slab, truss, wall]);

  useEffect(() => {
    if (!viewCommand) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const size = sceneSizeRef.current;
    if (viewCommand.action === 'fit') {
      const radius = Math.max(size.length, size.width, size.height, 1);
      controls.target.set(0, Math.max(1.2, size.height / 2), 0);
      camera.position.set(radius * 1.15, radius * 0.82, radius * 1.28);
    } else {
      controls.target.set(0, 1.6, 0);
      camera.position.set(7.4, 5.2, 8.2);
    }
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    controls.dispatchEvent({ type: 'end' });
  }, [viewCommand]);

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
    </div>
  );
}

function addGroundPlane(root: THREE.Group, dark: boolean) {
  const material = new THREE.MeshBasicMaterial({
    color: dark ? 0x1e293b : 0xe2e8f0,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.004;
  root.add(plane);
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

function createOpeningFrame(
  opening: ResolvedCmuOpening,
  wall: CmuWallSystemParameters,
  slabTop: number,
  options?: { preview?: boolean; valid?: boolean; selected?: boolean },
): THREE.Group {
  const group = new THREE.Group();
  const preview = options?.preview ?? false;
  const valid = options?.valid ?? true;
  const selected = options?.selected ?? false;
  const outlineColor = preview ? (valid ? 0x22d3ee : 0xf59e0b) : selected ? 0x22d3ee : 0x0f172a;
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: opening.type === 'door' ? 0x92400e : 0x2563eb,
    roughness: 0.55,
    metalness: 0.05,
    transparent: preview,
    opacity: preview ? 0.72 : 1,
  });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: outlineColor, transparent: preview, opacity: preview ? 0.95 : 1 });
  const unitMaterial = new THREE.MeshStandardMaterial({
    color: opening.type === 'door' ? 0x78350f : 0x60a5fa,
    roughness: 0.6,
    transparent: true,
    opacity: preview ? 0.28 : 0.42,
  });
  const centerY = slabTop + opening.roughBottomMeters + opening.roughOpeningHeightMeters / 2;
  const along = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
  const width = opening.roughOpeningWidthMeters;
  const height = opening.roughOpeningHeightMeters;
  const actualWidth = opening.actualWidthMeters;
  const actualHeight = opening.actualHeightMeters;
  const depth = wall.wallThicknessMeters + 0.035;
  const frame = 0.055;
  const horizontalGeom = new THREE.BoxGeometry(width + frame * 2, frame, depth + 0.03);
  const verticalGeom = new THREE.BoxGeometry(frame, height + frame * 2, depth + 0.03);
  const outlineGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth + 0.04));
  const unitGeom = new THREE.BoxGeometry(actualWidth, actualHeight, depth + 0.05);
  const pieces = [
    new THREE.LineSegments(outlineGeom, outlineMaterial),
    new THREE.Mesh(unitGeom, unitMaterial),
    new THREE.Mesh(horizontalGeom, frameMaterial),
    new THREE.Mesh(horizontalGeom, frameMaterial),
    new THREE.Mesh(verticalGeom, frameMaterial),
    new THREE.Mesh(verticalGeom, frameMaterial),
  ];
  pieces[1].position.set(0, opening.actualBottomMeters - opening.roughBottomMeters + actualHeight / 2 - height / 2, 0.002);
  pieces[2].position.set(0, height / 2 + frame / 2, 0);
  pieces[3].position.set(0, -height / 2 - frame / 2, 0);
  pieces[4].position.set(-width / 2 - frame / 2, 0, 0);
  pieces[5].position.set(width / 2 + frame / 2, 0, 0);
  pieces.forEach((piece) => group.add(piece));

  const layoutOpening = opening as ResolvedCmuOpening & {
    worldX?: number;
    worldZ?: number;
    rotationY?: number;
  };
  if (typeof layoutOpening.worldX === 'number' && typeof layoutOpening.worldZ === 'number') {
    group.position.set(layoutOpening.worldX, centerY, layoutOpening.worldZ);
    group.rotation.y = layoutOpening.rotationY ?? 0;
  } else if (opening.wallFace === 'north' || opening.wallFace === 'south') {
    const x = along - wall.lengthMeters / 2;
    const z = opening.wallFace === 'north' ? -wall.widthMeters / 2 - 0.004 : wall.widthMeters / 2 + 0.004;
    group.position.set(x, centerY, z);
  } else {
    const z = along - wall.widthMeters / 2;
    const x = opening.wallFace === 'east' ? wall.lengthMeters / 2 + 0.004 : -wall.lengthMeters / 2 - 0.004;
    group.position.set(x, centerY, z);
    group.rotation.y = Math.PI / 2;
  }
  return group;
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
