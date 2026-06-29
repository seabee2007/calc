import * as THREE from 'three';
import type { CmuLayoutResult, CmuLintelInstance, SegmentFrame } from '../geometry/designGeometry';
import type { CmuWallSystemParameters } from '../types';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import { resolveCmuCoreGeometry } from './cmuCoreGeometry';
import {
  GROUT_CELL_RENDER_COLOR,
  LINTEL_RENDER_COLOR,
  LINTEL_RENDER_EPSILON_METERS,
  resolveGroutFillMeshDimensions,
} from './groutCellPlacements';
import { createOpeningFrame3dGroup, createOpeningRoughOpeningGuideGroup } from './openingFrame3dGraphics';
import type { GroutFillPlacement } from './openingAssemblySolver';

export type OpeningRenderGroups = {
  cmuGroup: THREE.Group;
  lintelGroup: THREE.Group;
  frameGroup: THREE.Group;
  groutCellGroup: THREE.Group;
  roughOpeningGuideGroup: THREE.Group;
};

export type BuildOpeningAssemblyRenderGroupsParams = {
  cmuLayout: Pick<CmuLayoutResult, 'roughOpenings' | 'lintels' | 'groutFillPlacements' | 'segmentFrames'>;
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  showGroutCells: boolean;
  showOpeningLayout: boolean;
  cmuSelected?: boolean;
  selectedOpeningId?: string | null;
  hoveredOpeningId?: string | null;
  trackGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T;
  makeMaterial: (
    color: number,
    selected: boolean,
    options?: THREE.MeshStandardMaterialParameters,
  ) => THREE.MeshStandardMaterial;
  resolveLintelMaterial?: () => THREE.MeshStandardMaterial;
  infillCenterlineOffsetBySegmentId?: ReadonlyMap<string, number>;
};

type OpeningHostFrame = Pick<
  SegmentFrame,
  'segmentId' | 'centerlineStart' | 'tangent' | 'inwardNormal' | 'rotationY'
> & {
  infillCenterlineInwardOffsetMeters?: number;
};

export function createOpeningRenderGroups(): OpeningRenderGroups {
  return {
    cmuGroup: new THREE.Group(),
    lintelGroup: new THREE.Group(),
    frameGroup: new THREE.Group(),
    groutCellGroup: new THREE.Group(),
    roughOpeningGuideGroup: new THREE.Group(),
  };
}

export function buildLintelSolidMesh(
  lintel: CmuLintelInstance,
  slabTopMeters: number,
  material: THREE.Material,
  trackGeometry: BuildOpeningAssemblyRenderGroupsParams['trackGeometry'],
): THREE.Mesh {
  const depth = lintel.depthMeters ?? 0.19;
  const mesh = new THREE.Mesh(
    trackGeometry(
      new THREE.BoxGeometry(
        lintel.lengthMeters + LINTEL_RENDER_EPSILON_METERS,
        lintel.heightMeters + LINTEL_RENDER_EPSILON_METERS,
        depth + LINTEL_RENDER_EPSILON_METERS,
      ),
    ),
    material,
  );
  mesh.position.set(lintel.x, slabTopMeters + lintel.y, lintel.z);
  mesh.rotation.y = lintel.rotationY;
  mesh.userData.lintelSolid = true;
  return mesh;
}

export function buildGroutCellMesh(
  fill: GroutFillPlacement,
  slabTopMeters: number,
  core: ReturnType<typeof resolveCmuCoreGeometry>,
  material: THREE.Material,
  trackGeometry: BuildOpeningAssemblyRenderGroupsParams['trackGeometry'],
): THREE.Mesh {
  const dims = resolveGroutFillMeshDimensions(fill, core);
  const mesh = new THREE.Mesh(
    trackGeometry(new THREE.BoxGeometry(dims.lengthMeters, dims.heightMeters, dims.depthMeters)),
    material,
  );
  mesh.position.set(fill.center.x, slabTopMeters + fill.center.y, fill.center.z);
  mesh.rotation.y = fill.rotationY;
  mesh.userData.groutFillPlacement = true;
  mesh.userData.groutSolid = true;
  mesh.userData.groutKind = fill.kind;
  return mesh;
}

function withInfillCenterlineOffset(
  frame: SegmentFrame | undefined,
  offsetMeters: number,
): OpeningHostFrame | undefined {
  if (!frame) return undefined;
  return {
    segmentId: frame.segmentId,
    centerlineStart: frame.centerlineStart,
    tangent: frame.tangent,
    inwardNormal: frame.inwardNormal,
    rotationY: frame.rotationY,
    infillCenterlineInwardOffsetMeters: offsetMeters,
  };
}

function offsetMeshToInfillPlane(
  mesh: THREE.Object3D,
  frame: SegmentFrame | undefined,
  offsetMeters: number,
): void {
  if (!frame || Math.abs(offsetMeters) <= 1e-9) return;
  mesh.position.x += frame.inwardNormal.x * offsetMeters;
  mesh.position.z += frame.inwardNormal.z * offsetMeters;
}

export function populateOpeningAssemblyRenderGroups(
  groups: OpeningRenderGroups,
  params: BuildOpeningAssemblyRenderGroupsParams,
): void {
  groups.lintelGroup.clear();
  groups.frameGroup.clear();
  groups.groutCellGroup.clear();
  groups.roughOpeningGuideGroup.clear();

  const lintelMaterial =
    params.resolveLintelMaterial?.() ??
    params.makeMaterial(LINTEL_RENDER_COLOR, params.cmuSelected === true, { roughness: 0.82, metalness: 0.04 });
  const segmentFrameById = new Map(
    (params.cmuLayout.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
  );
  const infillOffsetForSegment = (segmentId?: string) =>
    segmentId ? params.infillCenterlineOffsetBySegmentId?.get(segmentId) ?? 0 : 0;
  params.cmuLayout.lintels.forEach((lintel) => {
    const mesh = buildLintelSolidMesh(lintel, params.slabTopMeters, lintelMaterial, params.trackGeometry);
    const segmentId = lintel.hostSegmentId ?? lintel.segmentId;
    offsetMeshToInfillPlane(mesh, segmentFrameById.get(segmentId ?? ''), infillOffsetForSegment(segmentId));
    groups.lintelGroup.add(mesh);
  });

  params.cmuLayout.roughOpenings.forEach((opening) => {
    const isSelected = opening.id === params.selectedOpeningId;
    const isHovered = opening.id === params.hoveredOpeningId;
    const segmentId = (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId;
    const hostSegmentFrame = withInfillCenterlineOffset(
      segmentFrameById.get(segmentId ?? ''),
      infillOffsetForSegment(segmentId),
    );
    const frame = createOpeningFrame3dGroup(opening, params.wall, params.slabTopMeters, {
      selected: isSelected,
      hovered: isHovered,
      showOpeningLayout: false,
      hostSegmentFrame,
    });
    frame.userData.openingId = opening.id;
    for (const child of frame.children) {
      if (child) child.userData.openingId = opening.id;
    }
    groups.frameGroup.add(frame);

    if (params.showOpeningLayout && (isSelected || isHovered)) {
      groups.roughOpeningGuideGroup.add(
        createOpeningRoughOpeningGuideGroup(opening, params.wall, params.slabTopMeters, hostSegmentFrame),
      );
    }
  });

  if (params.showGroutCells) {
    const core = resolveCmuCoreGeometry(params.wall);
    const groutMaterial = params.makeMaterial(GROUT_CELL_RENDER_COLOR, params.cmuSelected === true, {
      transparent: true,
      opacity: params.cmuSelected === true ? 0.92 : 0.78,
      roughness: 0.9,
    });
    params.cmuLayout.groutFillPlacements.forEach((fill) => {
      const mesh = buildGroutCellMesh(fill, params.slabTopMeters, core, groutMaterial, params.trackGeometry);
      offsetMeshToInfillPlane(
        mesh,
        segmentFrameById.get(fill.hostSegmentId ?? ''),
        infillOffsetForSegment(fill.hostSegmentId),
      );
      groups.groutCellGroup.add(mesh);
    });
  }
}

export function readLintelGroupBounds(lintelGroup: THREE.Group): THREE.Box3 {
  const bounds = new THREE.Box3();
  lintelGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.lintelSolid) {
      bounds.expandByObject(child);
    }
  });
  return bounds;
}

export function readGroutGroupBounds(groutGroup: THREE.Group): THREE.Box3 {
  const bounds = new THREE.Box3();
  groutGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.groutSolid) {
      bounds.expandByObject(child);
    }
  });
  return bounds;
}

export function groupsOverlap(boundsA: THREE.Box3, boundsB: THREE.Box3): boolean {
  if (boundsA.isEmpty() || boundsB.isEmpty()) return false;
  return boundsA.intersectsBox(boundsB);
}

export function groutMeshCentersInsideLintelMeshes(
  lintelGroup: THREE.Group,
  groutGroup: THREE.Group,
): boolean {
  const lintelMeshes: THREE.Mesh[] = [];
  lintelGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.lintelSolid) lintelMeshes.push(child);
  });
  if (lintelMeshes.length === 0) return false;

  let inside = false;
  groutGroup.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.groutSolid) return;
    const groutCenter = new THREE.Vector3();
    child.getWorldPosition(groutCenter);
    lintelMeshes.forEach((lintelMesh) => {
      const lintelBox = new THREE.Box3().setFromObject(lintelMesh);
      if (lintelBox.containsPoint(groutCenter)) inside = true;
    });
  });
  return inside;
}

export type OpeningFrameLike = ResolvedCmuOpening;
