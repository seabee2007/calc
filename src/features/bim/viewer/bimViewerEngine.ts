import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { formatBimViewerLoadError } from '../services/bimModelUploadValidation';
import {
  buildMeasurementResult,
  type BimMeasurementResult,
  type MeasurementPoint3D,
} from '../measurement/bimMeasurementMath';
import type { BimMeasurementMode, BimModelUnit, BimSelectedObjectSnapshot, GeometryMetrics } from '../types';

export interface BimViewerObjectNode {
  externalObjectId: string;
  threeObjectUuid: string;
  name: string;
  objectType: string | null;
  material: string | null;
  registryKey: string;
  children: BimViewerObjectNode[];
}

export interface BimViewerLoadResult {
  root: THREE.Object3D;
  objectTree: BimViewerObjectNode[];
  snapshots: BimSelectedObjectSnapshot[];
}

export interface BimViewerEngineOptions {
  container: HTMLElement;
  onSelect?: (snapshot: BimSelectedObjectSnapshot | null) => void;
  onVisibilityChange?: (state: Record<string, boolean>) => void;
  onMeasurementChange?: (result: BimMeasurementResult | null) => void;
  onCalibrationSampleChange?: (sample: BimCalibrationSample | null) => void;
}

export interface BimCalibrationSample {
  points: MeasurementPoint3D[];
  rawDistance: number | null;
}

export interface SceneObjectRegistryEntry {
  objectId: string;
  threeObjectUuid: string;
  name: string | null;
  objectType: string | null;
  materialName: string | null;
  object: THREE.Object3D;
}

export interface SceneObjectRegistry {
  objectRegistryById: Map<string, SceneObjectRegistryEntry>;
  materialRegistryByName: Map<string, THREE.Mesh[]>;
  visibilityState: Map<string, boolean>;
}

export class BimViewerEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly selectableMeshes = new Map<string, THREE.Object3D>();
  private readonly originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  private readonly measurementGroup = new THREE.Group();
  private readonly snapMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.055, 24),
    new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  private measurementMode: BimMeasurementMode = 'off';
  private snapEnabled = true;
  private measurementPoints: THREE.Vector3[] = [];
  private measurementClosed = false;
  private isActivelyDrawingMeasurement = false;
  private calibrationActive = false;
  private calibrationPoints: THREE.Vector3[] = [];
  private modelUnit: BimModelUnit = 'meters';
  private scaleConfirmed = false;
  private calibrationScaleFactor = 1;
  private calibrated = false;
  private pointerDown:
    | {
        x: number;
        y: number;
        time: number;
        button: number;
      }
    | null = null;
  private selectedExternalId: string | null = null;
  private modelRoot: THREE.Object3D | null = null;
  private animationFrameId: number | null = null;
  private disposed = false;
  private isolatedExternalId: string | null = null;
  private sceneRegistry: SceneObjectRegistry = createEmptySceneRegistry();
  private readonly resizeObserver: ResizeObserver | null = null;

  constructor(private readonly options: BimViewerEngineOptions) {
    const { container } = options;
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 5000);
    this.camera.position.set(4, 4, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color('#0f172a');
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const directional = new THREE.DirectionalLight(0xffffff, 1.1);
    directional.position.set(5, 8, 6);
    this.scene.add(ambient, directional);
    this.snapMarker.visible = false;
    this.scene.add(this.measurementGroup, this.snapMarker);

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('keydown', this.handleKeyDown);
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.handleResize())
        : null;
    this.resizeObserver?.observe(container);
    window.addEventListener('resize', this.handleResize);
    this.animate();
  }

  async loadModel(url: string): Promise<BimViewerLoadResult> {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.clearModel();

      this.modelRoot = gltf.scene;
      this.scene.add(gltf.scene);

      const registry = buildSceneObjectRegistry(gltf.scene);
      this.sceneRegistry = registry;
      const { objectTree, snapshots } = buildObjectTree(gltf.scene, registry);
      for (const entry of registry.objectRegistryById.values()) {
        this.selectableMeshes.set(entry.objectId, entry.object);
        this.storeOriginalMaterial(entry.object);
      }
      this.emitVisibilityState();

      this.fitCameraToObject(gltf.scene);
      return { root: gltf.scene, objectTree, snapshots };
    } catch (error) {
      throw new Error(formatBimViewerLoadError(error));
    }
  }

  selectByExternalId(externalObjectId: string | null): BimSelectedObjectSnapshot | null {
    this.clearHighlight();
    this.selectedExternalId = externalObjectId;
    if (!externalObjectId) {
      this.options.onSelect?.(null);
      return null;
    }
    const object = this.selectableMeshes.get(externalObjectId);
    if (!object) {
      this.options.onSelect?.(null);
      return null;
    }
    this.applyHighlight(object);
    const snapshot = snapshotFromObject(object);
    this.options.onSelect?.(snapshot);
    return snapshot;
  }

  hideSelected(): void {
    if (!this.selectedExternalId) return;
    this.setObjectVisibility(this.selectedExternalId, false);
  }

  isolateSelected(): void {
    if (!this.selectedExternalId) return;
    this.isolatedExternalId = this.selectedExternalId;
    isolateRegisteredObject(this.sceneRegistry, this.selectedExternalId);
    this.emitVisibilityState();
    this.invalidateRender();
  }

  resetVisibility(): void {
    this.isolatedExternalId = null;
    showAllRegisteredObjects(this.sceneRegistry);
    this.emitVisibilityState();
    this.invalidateRender();
  }

  setObjectVisibility(externalObjectId: string, visible: boolean): void {
    const changed = setRegisteredObjectVisibility(this.sceneRegistry, externalObjectId, visible);
    if (!changed) return;
    this.emitVisibilityState();
    this.invalidateRender();
  }

  fitModel(): void {
    if (this.modelRoot) this.fitCameraToObject(this.modelRoot);
  }

  resetView(): void {
    if (this.modelRoot) this.fitCameraToObject(this.modelRoot);
    this.resetVisibility();
    this.selectByExternalId(null);
  }

  resize(): void {
    this.handleResize();
  }

  unloadModel(): void {
    this.clearModel();
    this.invalidateRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  setMeasurementContext(
    modelUnit: BimModelUnit,
    scaleConfirmed: boolean,
    calibrationScaleFactor = 1,
    calibrated = false,
  ): void {
    this.modelUnit = modelUnit;
    this.scaleConfirmed = scaleConfirmed;
    this.calibrationScaleFactor = calibrationScaleFactor > 0 ? calibrationScaleFactor : 1;
    this.calibrated = calibrated;
    this.renderMeasurementOverlay();
    this.emitMeasurement();
  }

  setMeasurementMode(mode: BimMeasurementMode): void {
    const previousMode = this.measurementMode;
    this.measurementMode = mode;
    this.isActivelyDrawingMeasurement = false;
    if (mode !== 'off' && previousMode !== 'off' && previousMode !== mode) {
      this.clearMeasurement();
    }
    this.snapMarker.visible = false;
  }

  setCalibrationActive(active: boolean): void {
    this.calibrationActive = active;
    this.calibrationPoints = [];
    this.options.onCalibrationSampleChange?.(null);
    this.snapMarker.visible = false;
    this.renderMeasurementOverlay();
    this.invalidateRender();
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.snapMarker.visible = false;
  }

  clearMeasurement(): void {
    this.measurementPoints = [];
    this.measurementClosed = false;
    this.isActivelyDrawingMeasurement = false;
    this.clearMeasurementOverlay();
    this.options.onMeasurementChange?.(null);
    this.invalidateRender();
  }

  closeMeasurement(): void {
    if (this.measurementMode !== 'area' || this.measurementPoints.length < 3) return;
    this.measurementClosed = true;
    this.renderMeasurementOverlay();
    this.emitMeasurement();
    this.invalidateRender();
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    const { container } = this.options;
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      button: event.button,
    };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.modelRoot) return;
    if (!this.pointerDown) return;
    const dx = event.clientX - this.pointerDown.x;
    const dy = event.clientY - this.pointerDown.y;
    this.pointerDown = null;
    if (Math.hypot(dx, dy) > 5) return;

    if (this.calibrationActive) {
      if (event.button === 2) {
        event.preventDefault();
        this.undoCalibrationPoint();
        return;
      }
      if (event.button !== 0) return;
      const point = this.getMeasurementPoint(event);
      if (!point) return;
      this.calibrationPoints = [...this.calibrationPoints.slice(-1), point];
      this.renderMeasurementOverlay();
      this.emitCalibrationSample();
      this.invalidateRender();
      return;
    }

    if (this.measurementMode !== 'off') {
      if (event.button === 2) {
        event.preventDefault();
        this.undoLastMeasurementPoint();
        return;
      }
      if (event.button !== 0) return;
      const point = this.getMeasurementPoint(event);
      if (!point) return;
      if (!this.isActivelyDrawingMeasurement && this.measurementPoints.length === 0) {
        this.measurementClosed = false;
      }
      if (
        this.measurementMode === 'area' &&
        this.measurementPoints.length >= 3 &&
        point.distanceTo(this.measurementPoints[0]) < 0.1
      ) {
        this.closeMeasurement();
        return;
      }
      this.measurementPoints.push(point);
      this.measurementClosed = false;
      this.isActivelyDrawingMeasurement = true;
      this.renderMeasurementOverlay();
      this.emitMeasurement();
      this.invalidateRender();
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(getVisibleRaycastTargets(this.sceneRegistry), false);
    const meshHit = hits.find((hit) => hit.object instanceof THREE.Mesh && isObjectVisibleToRoot(hit.object));
    if (!meshHit) {
      this.selectByExternalId(null);
      return;
    }
    const externalId = resolveSelectableExternalId(meshHit.object);
    this.selectByExternalId(externalId);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.measurementMode === 'off' && !this.calibrationActive) {
      this.snapMarker.visible = false;
      return;
    }
    const point = this.getMeasurementPoint(event);
    if (!point) {
      this.snapMarker.visible = false;
      return;
    }
    this.snapMarker.position.copy(point);
    this.snapMarker.lookAt(this.camera.position);
    this.snapMarker.visible = true;
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.measurementMode === 'off' && !this.calibrationActive) return;
    if (event.key === 'Escape') {
      this.isActivelyDrawingMeasurement = false;
      this.calibrationActive = false;
      this.snapMarker.visible = false;
      this.emitMeasurement();
      this.invalidateRender();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.calibrationActive) {
        this.undoCalibrationPoint();
      } else {
        this.undoLastMeasurementPoint();
      }
    }
  };

  private handleContextMenu = (event: MouseEvent): void => {
    if (this.measurementMode !== 'off' || this.calibrationActive) {
      event.preventDefault();
    }
  };

  private clearModel(): void {
    if (this.modelRoot) {
      this.scene.remove(this.modelRoot);
      disposeObject3D(this.modelRoot);
      this.modelRoot = null;
    }
    this.selectableMeshes.clear();
    this.originalMaterials.clear();
    this.sceneRegistry = createEmptySceneRegistry();
    this.selectedExternalId = null;
    this.isolatedExternalId = null;
    this.emitVisibilityState();
  }

  private fitCameraToObject(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDim * 2.2;
    this.camera.position.set(center.x + distance, center.y + distance * 0.8, center.z + distance);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private storeOriginalMaterial(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (!(mesh instanceof THREE.Mesh) || !mesh.material) return;
    if (!this.originalMaterials.has(object.uuid)) {
      this.originalMaterials.set(object.uuid, mesh.material);
    }
  }

  private applyHighlight(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (!(mesh instanceof THREE.Mesh) || !mesh.material) return;
    this.storeOriginalMaterial(mesh);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const highlight = material.clone();
    if ('emissive' in highlight) {
      (highlight as THREE.MeshStandardMaterial).emissive = new THREE.Color('#06b6d4');
      (highlight as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
    }
    mesh.material = highlight;
  }

  private clearHighlight(): void {
    for (const [uuid, original] of this.originalMaterials) {
      const object = this.findObjectByUuid(uuid);
      if (object instanceof THREE.Mesh) {
        object.material = original;
      }
    }
  }

  private findObjectByUuid(uuid: string): THREE.Object3D | null {
    if (!this.modelRoot) return null;
    return this.modelRoot.getObjectByProperty('uuid', uuid) ?? null;
  }

  private invalidateRender(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private emitVisibilityState(): void {
    this.options.onVisibilityChange?.(Object.fromEntries(this.sceneRegistry.visibilityState));
  }

  private emitMeasurement(): void {
    if (this.measurementMode === 'off' || this.measurementPoints.length === 0) {
      this.options.onMeasurementChange?.(null);
      return;
    }
    const points = this.measurementPoints.map(vectorToPoint);
    const result = buildMeasurementResult({
      mode: this.measurementMode,
      points,
      closed: this.measurementClosed,
      modelUnit: this.modelUnit,
      scaleConfirmed: this.scaleConfirmed,
      calibrationScaleFactor: this.calibrationScaleFactor,
      calibrated: this.calibrated,
    });
    this.options.onMeasurementChange?.(result);
  }

  private emitCalibrationSample(): void {
    const [first, second] = this.calibrationPoints;
    this.options.onCalibrationSampleChange?.({
      points: this.calibrationPoints.map(vectorToPoint),
      rawDistance: first && second ? first.distanceTo(second) : null,
    });
  }

  private getMeasurementPoint(event: PointerEvent): THREE.Vector3 | null {
    if (!this.modelRoot) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(getVisibleRaycastTargets(this.sceneRegistry), false)[0];
    if (!hit) return null;
    if (!this.snapEnabled || !(hit.object instanceof THREE.Mesh)) return hit.point.clone();

    const snapped = findNearestVertexScreenPoint({
      mesh: hit.object,
      fallback: hit.point,
      camera: this.camera,
      renderer: this.renderer,
      event,
      tolerancePx: 14,
    });
    return snapped ?? hit.point.clone();
  }

  private undoLastMeasurementPoint(): void {
    if (this.measurementPoints.length === 0) return;
    this.measurementPoints.pop();
    this.measurementClosed = false;
    this.isActivelyDrawingMeasurement = this.measurementPoints.length > 0;
    this.renderMeasurementOverlay();
    this.emitMeasurement();
    this.invalidateRender();
  }

  private undoCalibrationPoint(): void {
    if (this.calibrationPoints.length === 0) return;
    this.calibrationPoints.pop();
    this.renderMeasurementOverlay();
    this.emitCalibrationSample();
    this.invalidateRender();
  }

  private clearMeasurementOverlay(): void {
    while (this.measurementGroup.children.length > 0) {
      const child = this.measurementGroup.children.pop();
      if (child) disposeOverlayObject(child);
    }
  }

  private renderMeasurementOverlay(): void {
    this.clearMeasurementOverlay();
    const points = this.measurementPoints;
    const calibrationPoints = this.calibrationPoints;
    if (points.length === 0 && calibrationPoints.length === 0) return;

    for (const point of points) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 12),
        new THREE.MeshBasicMaterial({ color: '#22d3ee', depthTest: false }),
      );
      marker.position.copy(point);
      this.measurementGroup.add(marker);
    }

    if (points.length >= 2) {
      const linePoints = this.measurementClosed ? [...points, points[0]] : points;
      const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: '#22d3ee', depthTest: false }),
      );
      this.measurementGroup.add(line);

      for (let index = 1; index < linePoints.length; index += 1) {
        const a = linePoints[index - 1];
        const b = linePoints[index];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const length = buildMeasurementResult({
          mode: 'line',
          points: [vectorToPoint(a), vectorToPoint(b)],
          closed: false,
          modelUnit: this.modelUnit,
          scaleConfirmed: this.scaleConfirmed,
          calibrationScaleFactor: this.calibrationScaleFactor,
          calibrated: this.calibrated,
        }).totalLength;
        this.measurementGroup.add(createTextSprite(`${length} LF`, mid));
      }
    }

    if (this.measurementMode === 'area' && this.measurementClosed && points.length >= 3) {
      const shape = new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, point.y)));
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: '#0891b2',
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const z = points.reduce((sum, point) => sum + point.z, 0) / points.length;
      fill.position.z = z;
      this.measurementGroup.add(fill);
      const centroid = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
      const result = buildMeasurementResult({
        mode: 'area',
        points: points.map(vectorToPoint),
        closed: true,
        modelUnit: this.modelUnit,
        scaleConfirmed: this.scaleConfirmed,
        calibrationScaleFactor: this.calibrationScaleFactor,
        calibrated: this.calibrated,
      });
      this.measurementGroup.add(createTextSprite(`${result.area ?? 0} SF`, centroid));
    }

    for (const point of calibrationPoints) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 12, 12),
        new THREE.MeshBasicMaterial({ color: '#f59e0b', depthTest: false }),
      );
      marker.position.copy(point);
      this.measurementGroup.add(marker);
    }
    if (calibrationPoints.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(calibrationPoints);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: '#f59e0b', depthTest: false }),
      );
      this.measurementGroup.add(line);
      const mid = calibrationPoints[0].clone().add(calibrationPoints[1]).multiplyScalar(0.5);
      this.measurementGroup.add(createTextSprite('Calibration distance', mid));
    }
  }
}

function resolveSelectableExternalId(object: THREE.Object3D): string {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData?.bimExternalId) return String(current.userData.bimExternalId);
    current = current.parent;
  }
  return object.uuid;
}

function createEmptySceneRegistry(): SceneObjectRegistry {
  return {
    objectRegistryById: new Map(),
    materialRegistryByName: new Map(),
    visibilityState: new Map(),
  };
}

function getMaterialName(object: THREE.Object3D): string | null {
  if (!(object instanceof THREE.Mesh) || !object.material) return null;
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  return material?.name || null;
}

function buildStableObjectId(path: string, object: THREE.Object3D, meshIndex: number): string {
  const userProvidedId =
    object.userData?.id ??
    object.userData?.uuid ??
    object.userData?.guid ??
    object.userData?.externalId;
  if (userProvidedId) return `mesh:${String(userProvidedId)}`;
  return `mesh:${path || meshIndex}`;
}

export function buildSceneObjectRegistry(root: THREE.Object3D): SceneObjectRegistry {
  const registry = createEmptySceneRegistry();
  let meshIndex = 0;

  const walk = (object: THREE.Object3D, path: string): void => {
    const currentPath = path || 'root';
    if (object instanceof THREE.Mesh) {
      const objectId = buildStableObjectId(currentPath, object, meshIndex);
      meshIndex += 1;
      const materialName = getMaterialName(object);
      object.userData.bimExternalId = objectId;
      object.userData.bimRegistryKey = objectId;
      registry.objectRegistryById.set(objectId, {
        objectId,
        threeObjectUuid: object.uuid,
        name: object.name || null,
        objectType: object.type || null,
        materialName,
        object,
      });
      registry.visibilityState.set(objectId, object.visible);
      if (materialName) {
        const meshes = registry.materialRegistryByName.get(materialName) ?? [];
        meshes.push(object);
        registry.materialRegistryByName.set(materialName, meshes);
      }
    }

    object.children.forEach((child, index) => {
      const nameSegment = child.name ? child.name.replace(/\s+/g, '_') : child.type;
      walk(child, `${currentPath}/${index}-${nameSegment}`);
    });
  };

  walk(root, '');
  return registry;
}

export function setRegisteredObjectVisibility(
  registry: SceneObjectRegistry,
  objectId: string,
  visible: boolean,
): boolean {
  if (objectId.startsWith('material:')) {
    const materialName = objectId.slice('material:'.length);
    const meshes = registry.materialRegistryByName.get(materialName) ?? [];
    const changed = meshes.some((mesh) => mesh.visible !== visible);
    if (!changed) return false;
    for (const mesh of meshes) {
      mesh.visible = visible;
      registry.visibilityState.set(resolveSelectableExternalId(mesh), visible);
    }
    if (import.meta.env.DEV) {
      console.debug('BIM visibility toggle', {
        objectId,
        objectName: materialName,
        materialName,
        matchedMeshes: meshes.length,
        visible,
      });
    }
    return meshes.length > 0;
  }

  const entry = registry.objectRegistryById.get(objectId);
  if (!entry) return false;
  if (entry.object.visible === visible && registry.visibilityState.get(objectId) === visible) {
    return false;
  }
  entry.object.visible = visible;
  registry.visibilityState.set(objectId, visible);
  if (import.meta.env.DEV) {
    console.debug('BIM visibility toggle', {
      objectId,
      objectName: entry.name,
      materialName: entry.materialName,
      matchedMeshes: 1,
      visible,
    });
  }
  return true;
}

export function isolateRegisteredObject(registry: SceneObjectRegistry, selectedObjectId: string): void {
  for (const objectId of registry.objectRegistryById.keys()) {
    setRegisteredObjectVisibility(registry, objectId, objectId === selectedObjectId);
  }
}

export function showAllRegisteredObjects(registry: SceneObjectRegistry): void {
  for (const objectId of registry.objectRegistryById.keys()) {
    setRegisteredObjectVisibility(registry, objectId, true);
  }
}

export function getVisibleRaycastTargets(registry: SceneObjectRegistry): THREE.Object3D[] {
  return [...registry.objectRegistryById.values()]
    .filter((entry) => registry.visibilityState.get(entry.objectId) !== false && isObjectVisibleToRoot(entry.object))
    .map((entry) => entry.object);
}

function isObjectVisibleToRoot(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function vectorToPoint(vector: THREE.Vector3): MeasurementPoint3D {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function findNearestVertexScreenPoint(params: {
  mesh: THREE.Mesh;
  fallback: THREE.Vector3;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  event: PointerEvent;
  tolerancePx: number;
}): THREE.Vector3 | null {
  const position = params.mesh.geometry.getAttribute('position');
  if (!position) return null;
  const rect = params.renderer.domElement.getBoundingClientRect();
  let best: { point: THREE.Vector3; distance: number } | null = null;
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const projected = new THREE.Vector3();

  const stride = Math.max(1, Math.floor(position.count / 5000));
  for (let index = 0; index < position.count; index += stride) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(params.mesh.matrixWorld);
    projected.copy(world).project(params.camera);
    const sx = ((projected.x + 1) / 2) * rect.width + rect.left;
    const sy = ((-projected.y + 1) / 2) * rect.height + rect.top;
    const distance = Math.hypot(sx - params.event.clientX, sy - params.event.clientY);
    if (distance <= params.tolerancePx && (!best || distance < best.distance)) {
      best = { point: world.clone(), distance };
    }
  }

  return best?.point ?? null;
}

function createTextSprite(text: string, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 96;
  if (context) {
    context.fillStyle = 'rgba(15, 23, 42, 0.88)';
    context.strokeStyle = 'rgba(34, 211, 238, 0.65)';
    context.lineWidth = 4;
    context.roundRect?.(8, 12, 240, 60, 10);
    if (context.roundRect) {
      context.fill();
      context.stroke();
    } else {
      context.fillRect(8, 12, 240, 60);
    }
    context.fillStyle = '#e0f2fe';
    context.font = 'bold 28px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 42);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.position.copy(position);
  sprite.scale.set(0.8, 0.3, 1);
  return sprite;
}

function disposeOverlayObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry?.dispose();
      const material = child.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const item of materials) item?.dispose();
    }
    if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

function computeGeometryMetrics(object: THREE.Object3D): GeometryMetrics {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return {};
  const size = box.getSize(new THREE.Vector3());
  const width = roundMetric(size.x);
  const height = roundMetric(size.y);
  const depth = roundMetric(size.z);
  return {
    width,
    height,
    depth,
    approximateVolume: roundMetric(width * height * depth),
    approximateSurfaceArea: roundMetric(2 * (width * height + width * depth + height * depth)),
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function snapshotFromObject(object: THREE.Object3D): BimSelectedObjectSnapshot {
  const externalObjectId = resolveSelectableExternalId(object);
  const materialName = getMaterialName(object);

  return {
    externalObjectId,
    name: object.name || null,
    takeoffName: (object.userData?.takeoffName as string | undefined) ?? null,
    objectType: object.type || null,
    category: (object.userData?.category as string | undefined) ?? null,
    material: materialName || ((object.userData?.material as string | undefined) ?? null),
    level: (object.userData?.level as string | undefined) ?? null,
    properties: { ...(object.userData ?? {}) },
    geometryMetrics: computeGeometryMetrics(object),
  };
}

function buildObjectTree(root: THREE.Object3D, registry: SceneObjectRegistry): {
  objectTree: BimViewerObjectNode[];
  snapshots: BimSelectedObjectSnapshot[];
} {
  const snapshots = [...registry.objectRegistryById.values()].map((entry) => snapshotFromObject(entry.object));

  const walk = (node: THREE.Object3D): BimViewerObjectNode => {
    const snapshot = snapshotFromObject(node);
    return {
      externalObjectId: resolveSelectableExternalId(node),
      threeObjectUuid: node.uuid,
      name: node.name || node.type,
      objectType: snapshot.objectType,
      material: snapshot.material,
      registryKey: (node.userData?.bimRegistryKey as string | undefined) ?? resolveSelectableExternalId(node),
      children: node.children.map(walk),
    };
  };

  return { objectTree: [walk(root)], snapshots };
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material?.dispose();
        for (const value of Object.values(material ?? {})) {
          if (value && typeof value === 'object' && 'isTexture' in value) {
            (value as THREE.Texture).dispose();
          }
        }
      }
    }
  });
}

export { computeGeometryMetrics, snapshotFromObject };
