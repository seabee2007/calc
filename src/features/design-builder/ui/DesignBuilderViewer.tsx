import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import {
  generateCmuLayout,
  logOpeningCoursePlacementsTableForDev,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import {
  fitPerspectiveCameraToBounds,
  logDesignFramingDiagnostics,
  reset3dView,
  type DesignLayoutBounds,
} from '../domain/designLayoutBounds';
import {
  DESIGN_CAMERA_FAR_METERS,
  DESIGN_CAMERA_NEAR_METERS,
  DESIGN_ORBIT_MIN_DISTANCE_METERS,
  DESIGN_ORBIT_ZOOM_SPEED,
  resolveOrbitMaxDistanceMeters,
} from '../domain/designCameraControls';
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
  RoofSystemSettings,
  PlacedDesignComponent,
} from '../types';
import {
  createCmuSepticTankMesh,
  type PlumbingSystem,
} from '../plumbing';
import {
  ensurePreviewMaterialsLoaded,
  resolveCastConcreteMaterial,
  resolveCmuMaterial,
  subscribeMaterialDiagnostics,
} from '../rendering/materials/designMaterialLibrary';
import type { DesignRenderModel } from '../domain/designRenderModel';
import { createFootprintSlabGeometry } from './DesignBuilderFootprintScene';
import {
  buildDesignBuilderViewerCmuInfillScene,
  buildDesignBuilderViewerCmuMortarScene,
} from './DesignBuilderViewerCmuInfillScene';
import { buildDesignBuilderViewerInteriorFinishScene } from './DesignBuilderViewerInteriorFinishScene';
import { buildDesignBuilderViewerRoofAssemblyScene } from './DesignBuilderViewerRoofAssemblyScene';
import { buildDesignBuilderViewerRoofReferenceScene } from './DesignBuilderViewerRoofReferenceScene';
import { buildDesignBuilderViewerStructuralFrameScene } from './DesignBuilderViewerStructuralFrameScene';
import { buildDesignBuilderViewerSupplementalScene } from './DesignBuilderViewerSupplementalScene';
import {
  blockColor,
  buildCmuBlockInstanceSceneGroup,
  legacyWallProxyMeshes,
} from './DesignBuilderWallScene';
import { buildOpeningSceneGroups } from './DesignBuilderOpeningScene';
import { buildManualMasonrySceneGroup } from './DesignBuilderManualMasonryScene';
import {
  buildOpeningPlacementPreviewSceneGroup,
  type DesignBuilderPlacementPreview,
} from './DesignBuilderOpeningPreviewScene';
import { createDesignBuilderViewerInteractionController } from './DesignBuilderViewerInteraction';
import { createDesignBuilderViewerPickers } from './DesignBuilderViewerPicking';
import { createDesignBuilderViewerSceneEnvironment } from './DesignBuilderViewerSceneEnvironment';
import { createDesignBuilderViewerSceneRegistry } from './DesignBuilderViewerSceneRegistry';
import { createDesignBuilderViewerResources } from './DesignBuilderViewerResources';
import {
  createDesignBuilderViewerRebuildState,
  type DesignBuilderViewerModelParams,
} from './DesignBuilderViewerRebuildState';

const CLICK_DRAG_THRESHOLD_PX = 5;

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
  placedComponents?: readonly PlacedDesignComponent[];
  plumbingSystem?: PlumbingSystem;
  selectedSepticTankId?: string | null;
  designRenderModel?: DesignRenderModel;
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
  placedComponents = [],
  plumbingSystem,
  selectedSepticTankId = null,
  designRenderModel,
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
  const modelParamsRef = useRef<DesignBuilderViewerModelParams>({
    modelLoaded,
    slab,
    wall,
    roof,
    truss,
    geometryResult,
    layoutBounds,
    placedComponents,
    plumbingSystem,
    selectedSepticTankId,
    designRenderModel,
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
    placedComponents,
    plumbingSystem,
    selectedSepticTankId,
    designRenderModel,
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
    const camera = new THREE.PerspectiveCamera(45, 1, DESIGN_CAMERA_NEAR_METERS, DESIGN_CAMERA_FAR_METERS);
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
    controls.zoomToCursor = true;
    controls.zoomSpeed = DESIGN_ORBIT_ZOOM_SPEED;
    controls.minDistance = DESIGN_ORBIT_MIN_DISTANCE_METERS;
    controls.maxDistance = resolveOrbitMaxDistanceMeters(modelParamsRef.current.layoutBounds);
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

    const resources = createDesignBuilderViewerResources();
    const sceneEnvironment = createDesignBuilderViewerSceneEnvironment({
      scene,
      initialBounds: modelParamsRef.current.layoutBounds ?? null,
      getLayoutBounds: () => modelParamsRef.current.layoutBounds ?? null,
      getGroundExclusionPolygon: () =>
        modelParamsRef.current.geometryResult?.resolvedFootprint
          ?.exteriorFacePolygon ??
        modelParamsRef.current.geometryResult?.exteriorFootprint,
      getVisualStyle: () => modelParamsRef.current.visualStyle,
      trackMaterial: resources.trackMaterial,
    });
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const selectable: THREE.Object3D[] = [];
    const wallPickables: THREE.Object3D[] = [];
    const sceneRegistry = createDesignBuilderViewerSceneRegistry({
      root,
      selectableObjects: selectable,
      wallPickableObjects: wallPickables,
    });
    const trackGeometry = resources.trackGeometry;
    const makeMaterial = resources.makeMaterial;

    const addSelectable = sceneRegistry.addSelectable;
    const addWallPickable = sceneRegistry.addWallPickable;

    const applySceneFraming = sceneEnvironment.applySceneFraming;
    const applyTheme = sceneEnvironment.applyTheme;
    const refreshSiteGroundMaterial = sceneEnvironment.refreshSiteGroundMaterial;

    function clearGhost() {
      resources.clearGhostRoot(ghostRoot);
    }

    function updateGhost() {
      clearGhost();
      const preview = placementPreviewRef.current;
      if (!preview) return;
      const params = modelParamsRef.current;
      const frame = buildOpeningPlacementPreviewSceneGroup({
        preview,
        wall: params.wall,
        slabTopMeters: params.slab.slabThicknessMeters,
        segmentFrames: params.geometryResult?.wallCmuLayout?.segmentFrames,
        resolvedInfillPanelBounds: params.geometryResult?.resolvedInfillPanelBounds,
        selectedOpeningId: selectedOpeningIdRef.current,
        showOpeningLayout: params.showOpeningLayout,
      });
      resources.trackGhostMaterialsFrom(frame);
      ghostRoot.renderOrder = 10;
      ghostRoot.add(frame);
    }
    updateGhostRef.current = updateGhost;

    function rebuildModel() {
      const params = modelParamsRef.current;
      if (!params.modelLoaded) return;
      const {
        currentWall,
        currentSlab,
        currentGeometry,
        currentLayoutBounds,
        currentPlacedComponents,
        currentPlumbingSystem,
        currentSelectedSepticTankId,
        currentDesignRenderModel,
        currentSelectedObjectType,
        currentShowOpeningLayout,
        currentShowGroutCells,
        currentShowClosureWarnings,
        currentShowRoofReferencePerimeters,
        currentShowRoofFramingGuides,
        currentFoundationViewMode,
        currentVisualStyle,
        currentRoofSystem,
        currentRoofDisplayMode,
        currentRoofLayerVisibility,
        usePreviewMaterials,
        frameSelected,
        cmuSelected,
        roofSelected,
        gableSelected,
        cmuCutawayActive,
        cmuOpacity,
        cmuMaterialOptions,
        blankGeometryActive,
        sceneSize,
      } = createDesignBuilderViewerRebuildState({
        modelParams: params,
        previewMaterialsReady: previewMaterialsReadyRef.current,
      });

      const trackMat = resources.trackMaterial;

      sceneRegistry.reset();
      resources.resetTrackedResources();

      applySceneFraming(currentLayoutBounds);
      sceneSizeRef.current = sceneSize;

      function addSupplementalPlacedComponents() {
        const supplementalScene = buildDesignBuilderViewerSupplementalScene({
          state: {
            currentDesignRenderModel,
            currentPlacedComponents,
            currentLayoutBounds,
            currentGeometry,
            currentSlab,
            currentFoundationViewMode,
            currentVisualStyle,
            usePreviewMaterials,
            frameSelected,
          },
          trackGeometry,
          trackMaterial: trackMat,
          makeMaterial,
        });
        sceneRegistry.registerSelectables(supplementalScene.selectableObjects);
        if (supplementalScene.group.children.length > 0) root.add(supplementalScene.group);
      }

      function addSepticSiteUtilities() {
        const tanks = currentPlumbingSystem?.septicTanks ?? [];
        if (tanks.length === 0) return;
        const septicGroup = new THREE.Group();
        septicGroup.name = 'septicSiteUtilityGroup';
        tanks.forEach((tank) => {
          septicGroup.add(createCmuSepticTankMesh(tank, {
            selected: tank.id === currentSelectedSepticTankId,
            trackGeometry,
            trackMaterial: trackMat,
          }));
        });
        root.add(septicGroup);
      }

      function addPlumbingFittingPlaceholders() {
        const fittings = currentPlumbingSystem?.fittings ?? [];
        const nodes = currentPlumbingSystem?.nodes ?? [];
        if (fittings.length === 0) return;
        const group = new THREE.Group();
        group.name = 'plumbingFittingPlaceholderGroup';
        const material = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.6,
          metalness: 0.05,
        });
        trackMat(material);
        const sleeveMaterial = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.28,
          roughness: 0.5,
        });
        trackMat(sleeveMaterial);
        fittings.forEach((fitting) => {
          const node = nodes.find((candidate) => candidate.id === fitting.nodeId);
          if (!node) return;
          const y =
            fitting.elevationMode === 'overhead'
              ? currentWall.heightMeters + currentSlab.slabThicknessMeters
              : fitting.elevationMode === 'in_wall'
                ? currentSlab.slabThicknessMeters + 0.7
                : currentSlab.slabThicknessMeters + 0.08;
          const geometry = fitting.type.includes('sleeve')
            ? new THREE.CylinderGeometry(0.07, 0.07, 0.35, 16)
            : fitting.type.includes('valve')
              ? new THREE.BoxGeometry(0.18, 0.12, 0.12)
              : new THREE.SphereGeometry(0.075, 16, 12);
          trackGeometry(geometry);
          const mesh = new THREE.Mesh(geometry, fitting.type.includes('sleeve') ? sleeveMaterial : material);
          mesh.name = `plumbing fitting ${fitting.type}`;
          mesh.position.set(node.position.x, y, node.position.z);
          mesh.userData.plumbingFittingId = fitting.id;
          group.add(mesh);
        });
        if (group.children.length > 0) root.add(group);
      }

      if (blankGeometryActive) {
        addSupplementalPlacedComponents();
        addSepticSiteUtilities();
        addPlumbingFittingPlaceholders();
        clearGhost();
        return;
      }

      const pickMaterial = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      trackMat(pickMaterial);
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
            (selectedOpening as typeof selectedOpening & { wallSegmentId?: string }).wallSegmentId ??
              selectedOpening.wallFace ??
              undefined,
          );
        }
      }
      const showCmuInfill = currentFoundationViewMode !== 'structural_frame_only';
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

        const structuralFrameScene = buildDesignBuilderViewerStructuralFrameScene({
          state: {
            currentGeometry,
            currentSlab,
            currentVisualStyle,
            usePreviewMaterials,
            frameSelected,
          },
          showCmuInfill,
          trackGeometry,
          trackMaterial: trackMat,
          makeMaterial,
        });
        sceneRegistry.registerSelectables(structuralFrameScene.selectableObjects);
        if (structuralFrameScene.group.children.length > 0) root.add(structuralFrameScene.group);
        const interiorFinishScene = buildDesignBuilderViewerInteriorFinishScene({
          state: {
            currentGeometry,
            currentSlab,
            currentVisualStyle,
            usePreviewMaterials,
            frameSelected,
          },
          showCmuInfill,
          trackGeometry,
          trackMaterial: trackMat,
          makeMaterial,
        });
        interiorFinishScene.groups.forEach((group) => root.add(group));
        const roofReferenceScene = buildDesignBuilderViewerRoofReferenceScene({
          enabled: import.meta.env.DEV && currentShowRoofReferencePerimeters,
          geometry: currentGeometry,
          slab: currentSlab,
          trackGeometry,
          trackMaterial: trackMat,
        });
        if (roofReferenceScene.children.length > 0) root.add(roofReferenceScene);
        const roofAssemblyScene = buildDesignBuilderViewerRoofAssemblyScene({
          state: {
            currentGeometry,
            currentSlab,
            currentVisualStyle,
            currentRoofSystem,
            currentRoofDisplayMode,
            currentRoofLayerVisibility,
            currentShowRoofFramingGuides,
            usePreviewMaterials,
            roofSelected,
            gableSelected,
          },
          trackGeometry,
          trackMaterial: trackMat,
          makeMaterial,
        });
        sceneRegistry.registerSelectables(roofAssemblyScene.selectableObjects);
        roofAssemblyScene.groups.forEach((group) => root.add(group));

        const cmuInfillScene = buildDesignBuilderViewerCmuInfillScene({
          state: {
            currentGeometry,
            currentWall,
            currentSlab,
            currentSelectedObjectType,
            currentVisualStyle,
            currentRoofDisplayMode,
            currentRoofLayerVisibility,
            usePreviewMaterials,
            cmuSelected,
            cmuCutawayActive,
            cmuOpacity,
            cmuMaterialOptions,
          },
          cmuLayout,
          showCmuInfill,
          trackGeometry,
          trackMaterial: trackMat,
          makeMaterial,
        });
        sceneRegistry.registerSelectables(cmuInfillScene.selectableObjects);
        cmuInfillScene.groups.forEach((group) => root.add(group));
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
          const mortarScene = buildDesignBuilderViewerCmuMortarScene({
            blocks: blockInstances,
            wall: currentWall,
            slabTopMeters: currentSlab.slabThicknessMeters,
            visualStyle: currentVisualStyle,
            cmuCutawayActive,
            cmuOpacity,
            debugMode: false,
            trackGeometry,
            trackMaterial: trackMat,
          });
          if (mortarScene.group.children.length > 0) root.add(mortarScene.group);
          const blockModule = resolveCmuModuleConfig(currentWall);
          const blockHeightMeters = blockModule.actualHeightMeters ?? blockModule.moduleHeightMeters;
          const cmuBlockGroup = buildCmuBlockInstanceSceneGroup({
            blockInstances,
            blockHeightMeters,
            defaultBlockDepthMeters: currentWall.blockDepthMeters,
            slabTopMeters: currentSlab.slabThicknessMeters,
            createMaterial: (blockType) =>
              usePreviewMaterials
                ? resolveCmuMaterial(cmuMaterialOptions, trackMat)
                : makeMaterial(blockColor(blockType), cmuSelected),
            trackGeometry,
          });
          cmuBlockGroup.children.forEach((child) => addSelectable(child, 'cmu_wall_system'));
        } else {
          const wallMaterial = makeMaterial(0xd1d5db, currentSelectedObjectType === 'cmu_wall_system', {
            transparent: true,
            opacity: 0.9,
          });
          legacyWallProxyMeshes({
            wall: currentWall,
            slabTopMeters: currentSlab.slabThicknessMeters,
            material: wallMaterial,
            trackGeometry,
          }).forEach((mesh) => addSelectable(mesh, 'cmu_wall_system'));
        }
      }

      const manualMasonryScene = buildManualMasonrySceneGroup({
        runs: currentWall.manualMasonryCourseRuns ?? [],
        wall: currentWall,
        slabTopMeters: currentSlab.slabThicknessMeters,
        createMaterial: (_unitType, color) =>
          usePreviewMaterials
            ? resolveCmuMaterial(cmuMaterialOptions, trackMat)
            : makeMaterial(color, cmuSelected),
        trackGeometry,
      });
      sceneRegistry.registerSelectables(manualMasonryScene.selectableObjects);
      if (manualMasonryScene.group.children.length > 0) root.add(manualMasonryScene.group);

      const openingSceneGroups = buildOpeningSceneGroups({
        cmuLayout,
        wall: currentWall,
        slabTopMeters: currentSlab.slabThicknessMeters,
        showGroutCells: currentShowGroutCells,
        showOpeningLayout: currentShowOpeningLayout,
        showClosureWarnings: currentShowClosureWarnings,
        selectedOpeningId: selectedOpeningIdRef.current,
        hoveredOpeningId: hoveredOpeningIdRef.current,
        resolvedInfillPanelBounds: currentGeometry?.resolvedInfillPanelBounds,
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
      sceneRegistry.registerSelectables(openingSceneGroups.selectableObjects);
      root.add(openingSceneGroups.lintelGroup);
      root.add(openingSceneGroups.frameGroup);
      if (currentShowGroutCells) root.add(openingSceneGroups.groutCellGroup);
      if (currentShowOpeningLayout) root.add(openingSceneGroups.roughOpeningGuideGroup);
      if (currentShowClosureWarnings) root.add(openingSceneGroups.closureWarningGroup);

      addSupplementalPlacedComponents();
      addSepticSiteUtilities();
      addPlumbingFittingPlaceholders();
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

    const viewerPickers = createDesignBuilderViewerPickers({
      element: renderer.domElement,
      camera,
      raycaster,
      selectableObjects: selectable,
      wallPickableObjects: wallPickables,
      getWall: () => modelParamsRef.current.wall,
      getSegmentFrames: () => modelParamsRef.current.geometryResult?.wallCmuLayout?.segmentFrames ?? [],
      groundPlane,
      debug: import.meta.env.DEV,
    });

    const interactionController = createDesignBuilderViewerInteractionController({
      clickDragThresholdPx: CLICK_DRAG_THRESHOLD_PX,
      getToolMode: () => toolModeRef.current,
      isManualMasonryEnabled: () => manualMasonryEnabledRef.current,
      pickManualBrushPoint: viewerPickers.pickManualBrushPoint,
      pickWall: viewerPickers.pickWall,
      pickSelectable: viewerPickers.pickSelectable,
      emitInteraction: (event) => onInteractionRef.current?.(event),
      emitManualMasonryPointer: (event) => onManualMasonryPointerRef.current?.(event),
      selectObjectType: (objectType) => onSelectRef.current(objectType),
      setControlsEnabled: (enabled) => {
        controls.enabled = enabled;
      },
      clearPlacementPreview: () => {
        placementPreviewRef.current = null;
        updateGhostRef.current?.();
      },
      getOpeningType: (openingId) =>
        modelParamsRef.current.wall.openings.find((item) => item.id === openingId)?.type,
      getHoveredOpeningId: () => hoveredOpeningIdRef.current,
      setHoveredOpeningId: (openingId) => {
        hoveredOpeningIdRef.current = openingId;
      },
      rebuildModel: () => rebuildModelRef.current?.(),
    });

    renderer.domElement.addEventListener('pointerdown', interactionController.handlePointerDown);
    renderer.domElement.addEventListener('pointermove', interactionController.handlePointerMove);
    renderer.domElement.addEventListener('pointerup', interactionController.handlePointerUp);
    renderer.domElement.addEventListener('contextmenu', interactionController.handleContextMenu);
    window.addEventListener('keydown', interactionController.handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', interactionController.handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', interactionController.handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', interactionController.handlePointerUp);
      renderer.domElement.removeEventListener('contextmenu', interactionController.handleContextMenu);
      window.removeEventListener('keydown', interactionController.handleKeyDown);
      controls.removeEventListener('end', emitCameraSnapshot);
      observer.disconnect();
      themeObserver.disconnect();
      unsubscribeMaterialDiagnostics();
      rendererRef.current = null;
      controls.dispose();
      clearGhost();
      sceneEnvironment.dispose();
      resources.disposeTrackedResources();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      rebuildModelRef.current = null;
      updateGhostRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.maxDistance = resolveOrbitMaxDistanceMeters(layoutBounds);
  }, [layoutBounds]);

  useEffect(() => {
    if (modelLoaded) rebuildModelRef.current?.();
  }, [designRenderModel, geometryResult, layoutBounds, materialRevision, modelLoaded, placedComponents, plumbingSystem, roof, roofDisplayMode, roofLayerVisibility, roofSystem, selectedObjectType, selectedOpeningId, selectedSepticTankId, showClosureWarnings, showRoofReferencePerimeters, showRoofFramingGuides, foundationViewMode, showGroutCells, showOpeningLayout, slab, truss, wall, visualStyle]);

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
