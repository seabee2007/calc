import * as THREE from 'three';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { TOP_COURSE_RENDER_EPSILON_METERS } from '../domain/cmuInfillPanelSolver';
import {
  buildInfillWallProxyPieces,
  resolveInfillPlasterPanelPlacements,
  type PlasterOpening,
} from '../domain/infillPlaster';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import type {
  CmuBlockInstance,
  CmuBlockType,
  DesignGeometryWallSegment,
  SegmentFrame,
} from '../geometry/designGeometry';
import type {
  CmuInfillSystemParameters,
  CmuWallSystemParameters,
  RoofDisplayMode,
  RoofLayerVisibility,
} from '../types';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;

export type CmuBlockMaterialFactory = (blockType: CmuBlockType) => THREE.Material;
export type PlasterMaterialFactory = (
  finish: NonNullable<CmuInfillSystemParameters['plaster']>['finish'],
) => THREE.Material;
export type RenderableCmuBlockInstance = Pick<
  CmuBlockInstance,
  | 'id'
  | 'blockType'
  | 'source'
  | 'x'
  | 'y'
  | 'z'
  | 'rotationY'
  | 'lengthMeters'
  | 'actualLengthMeters'
  | 'heightMeters'
  | 'physicalHeightMeters'
  | 'depthMeters'
>;

function roofDisplayModeShowsGableMasonry(roofDisplayMode: RoofDisplayMode): boolean {
  return (
    roofDisplayMode === 'full_roof' ||
    roofDisplayMode === 'gable_masonry_only' ||
    roofDisplayMode === 'foundation_frame_roof'
  );
}

function isGableEndCmuBlock(block: Pick<RenderableCmuBlockInstance, 'source'>): boolean {
  return block.source === 'gable_end_solver';
}

export function resolveVisibleCmuBlockInstances<T extends RenderableCmuBlockInstance>(params: {
  showCmuInfill: boolean;
  showIndividualBlocks: boolean;
  roofDisplayMode: RoofDisplayMode;
  roofLayerVisibility: RoofLayerVisibility;
  blockInstances: readonly T[];
}): T[] {
  const showGableEndCmu =
    roofDisplayModeShowsGableMasonry(params.roofDisplayMode) &&
    (params.roofLayerVisibility.gableEndCmu ?? DEFAULT_ROOF_LAYER_VISIBILITY.gableEndCmu);
  const gableEndBlocks = showGableEndCmu
    ? params.blockInstances.filter(isGableEndCmuBlock)
    : [];

  if (!params.showCmuInfill) return gableEndBlocks;

  if (params.showIndividualBlocks) {
    return showGableEndCmu
      ? [...params.blockInstances]
      : params.blockInstances.filter((block) => !isGableEndCmuBlock(block));
  }

  return gableEndBlocks;
}

export function groupBlocksByType<T extends { blockType: CmuBlockType }>(
  blocks: readonly T[],
): Map<CmuBlockType, T[]> {
  const grouped = new Map<CmuBlockType, T[]>();
  blocks.forEach((block) => {
    const existing = grouped.get(block.blockType) ?? [];
    existing.push(block);
    grouped.set(block.blockType, existing);
  });
  return grouped;
}

export function blockColor(blockType: CmuBlockType): number {
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

export function manualBlockColor(unitType: string): number {
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

export function buildCmuBlockInstanceSceneGroup(params: {
  blockInstances: readonly RenderableCmuBlockInstance[];
  blockHeightMeters: number;
  defaultBlockDepthMeters: number;
  slabTopMeters: number;
  createMaterial: CmuBlockMaterialFactory;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cmuBlockInstanceGroup';
  const blocksByType = groupBlocksByType(params.blockInstances);
  blocksByType.forEach((instances, blockType) => {
    const blockGeometry = params.trackGeometry(new THREE.BoxGeometry(1, 1, 1));
    const blocks = new THREE.InstancedMesh(
      blockGeometry,
      params.createMaterial(blockType),
      instances.length,
    );
    blocks.name = `cmuBlocks:${blockType}`;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    instances.forEach((block, index) => {
      quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
      const baseHeightMeters = block.physicalHeightMeters ?? block.heightMeters ?? params.blockHeightMeters;
      const isTopClosure = block.source === 'panel_top_closure';
      const renderHeightMeters = isTopClosure
        ? baseHeightMeters + TOP_COURSE_RENDER_EPSILON_METERS
        : baseHeightMeters;
      const renderYOffsetMeters = isTopClosure ? TOP_COURSE_RENDER_EPSILON_METERS / 2 : 0;
      matrix.compose(
        new THREE.Vector3(
          block.x,
          params.slabTopMeters + block.y + renderYOffsetMeters,
          block.z,
        ),
        quaternion,
        new THREE.Vector3(
          block.actualLengthMeters ?? block.lengthMeters,
          renderHeightMeters,
          block.depthMeters ?? params.defaultBlockDepthMeters,
        ),
      );
      blocks.setMatrixAt(index, matrix);
    });
    blocks.instanceMatrix.needsUpdate = true;
    group.add(blocks);
  });
  return group;
}

export function buildInfillWallProxySceneGroup(params: {
  wallSegments: readonly DesignGeometryWallSegment[];
  segmentFrames?: readonly SegmentFrame[];
  resolvedInfillPanelBounds?: readonly ResolvedInfillPanelBounds[];
  openings: readonly PlasterOpening[];
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'infillWallProxyGroup';
  const segmentFrameById = new Map(
    (params.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
  );
  const segmentById = new Map(params.wallSegments.map((segment) => [segment.segmentId, segment]));
  const panelLocalOpenings = (
    openings: readonly PlasterOpening[],
    panelBounds: ResolvedInfillPanelBounds,
  ): PlasterOpening[] =>
    openings.map((opening) =>
      opening.wallSegmentId === panelBounds.hostSegmentId
        ? {
            ...opening,
            actualBottomMeters: opening.actualBottomMeters - panelBounds.bottomElevationMeters,
            actualTopMeters: opening.actualTopMeters - panelBounds.bottomElevationMeters,
            roughBottomMeters: opening.roughBottomMeters - panelBounds.bottomElevationMeters,
            roughTopMeters: opening.roughTopMeters - panelBounds.bottomElevationMeters,
          }
        : opening,
    );

  const addProxyMesh = (paramsForMesh: {
    segment: DesignGeometryWallSegment;
    frame?: SegmentFrame;
    panelBounds?: ResolvedInfillPanelBounds;
    piece: ReturnType<typeof buildInfillWallProxyPieces>[number];
  }) => {
    const { segment, frame, panelBounds, piece } = paramsForMesh;
    const infillCenterlineInwardOffsetMeters =
      panelBounds?.infillCenterlineInwardOffsetMeters ??
      segment.infillCenterlineInwardOffsetMeters ??
      0;
    const centerlinePoint = frame
      ? {
          x:
            frame.centerlineStart.x +
            frame.tangent.x * piece.centerStationMeters +
            frame.inwardNormal.x * infillCenterlineInwardOffsetMeters,
          z:
            frame.centerlineStart.z +
            frame.tangent.z * piece.centerStationMeters +
            frame.inwardNormal.z * infillCenterlineInwardOffsetMeters,
        }
      : { x: segment.x, z: segment.z };
    const wallMesh = new THREE.Mesh(
      params.trackGeometry(
        new THREE.BoxGeometry(piece.lengthMeters, piece.heightMeters, piece.thicknessMeters),
      ),
      params.material,
    );
    wallMesh.name = `infillWallProxy:${segment.segmentId}:${piece.centerStationMeters}`;
    wallMesh.position.set(
      centerlinePoint.x,
      params.slabTopMeters +
        (panelBounds?.bottomElevationMeters ?? 0) +
        piece.centerElevationMeters,
      centerlinePoint.z,
    );
    wallMesh.rotation.y = segment.rotationY;
    wallMesh.renderOrder = 0;
    group.add(wallMesh);
  };

  const aboveGradePanelBounds = (params.resolvedInfillPanelBounds ?? []).filter(
    (bounds) => bounds.topElevationMeters > 0.001 && bounds.bottomElevationMeters >= -0.001,
  );

  if (aboveGradePanelBounds.length > 0) {
    aboveGradePanelBounds.forEach((panelBounds) => {
      const segment = segmentById.get(panelBounds.hostSegmentId);
      if (!segment) return;
      const frame = segmentFrameById.get(segment.segmentId);
      const wallPieces = buildInfillWallProxyPieces({
        segmentLengthMeters: segment.lengthMeters,
        wallHeightMeters: panelBounds.clearHeightMeters,
        wallThicknessMeters: segment.thicknessMeters,
        hostSegmentId: segment.segmentId,
        openings: panelLocalOpenings(params.openings, panelBounds),
        trimStartMeters: panelBounds.startStationMeters,
        trimEndMeters: Math.max(0, segment.lengthMeters - panelBounds.endStationMeters),
      });
      wallPieces.forEach((piece) => {
        addProxyMesh({ segment, frame, panelBounds, piece });
      });
    });

    return group;
  }

  params.wallSegments.forEach((segment) => {
    const frame = segmentFrameById.get(segment.segmentId);
    const wallPieces = buildInfillWallProxyPieces({
      segmentLengthMeters: segment.lengthMeters,
      wallHeightMeters: segment.heightMeters,
      wallThicknessMeters: segment.thicknessMeters,
      hostSegmentId: segment.segmentId,
      openings: params.openings,
    });
    wallPieces.forEach((piece) => {
      addProxyMesh({ segment, frame, piece });
    });
  });

  return group;
}

export function buildInfillPlasterSceneGroup(params: {
  infillSystem?: CmuInfillSystemParameters;
  panelBounds?: readonly ResolvedInfillPanelBounds[];
  openings: readonly PlasterOpening[];
  wallThicknessMeters: number;
  exteriorSegmentIds: ReadonlySet<string>;
  slabTopMeters: number;
  createMaterial: PlasterMaterialFactory;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plasterGroup';
  const plasterPlacements = resolveInfillPlasterPanelPlacements({
    infillSystem: params.infillSystem,
    panelBounds: params.panelBounds ?? [],
    openings: params.openings,
    wallThicknessMeters: params.wallThicknessMeters,
    exteriorSegmentIds: params.exteriorSegmentIds,
  });
  plasterPlacements.forEach((placement) => {
    const mesh = new THREE.Mesh(
      params.trackGeometry(
        new THREE.BoxGeometry(
          placement.widthMeters,
          placement.heightMeters,
          placement.thicknessMeters,
        ),
      ),
      params.createMaterial(placement.finish),
    );
    mesh.name = `infillPlaster:${placement.id}`;
    mesh.position.set(
      placement.center.x,
      params.slabTopMeters + placement.center.y,
      placement.center.z,
    );
    mesh.rotation.y = placement.rotationY;
    mesh.renderOrder = 1;
    group.add(mesh);
  });
  return group;
}

export function legacyWallProxyMeshes(params: {
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Mesh[] {
  const wallY = params.slabTopMeters + params.wall.heightMeters / 2;
  const wallInset = Math.max(0, params.wall.wallThicknessMeters) / 2;
  const northSouthWall = params.trackGeometry(
    new THREE.BoxGeometry(
      params.wall.lengthMeters,
      params.wall.heightMeters,
      params.wall.wallThicknessMeters,
    ),
  );
  const eastWestWall = params.trackGeometry(
    new THREE.BoxGeometry(
      params.wall.wallThicknessMeters,
      params.wall.heightMeters,
      params.wall.widthMeters,
    ),
  );
  const north = new THREE.Mesh(northSouthWall, params.material);
  north.name = 'legacyWallProxy:north';
  north.position.set(0, wallY, -params.wall.widthMeters / 2 + wallInset);
  const south = north.clone();
  south.name = 'legacyWallProxy:south';
  south.position.z = params.wall.widthMeters / 2 - wallInset;
  const east = new THREE.Mesh(eastWestWall, params.material);
  east.name = 'legacyWallProxy:east';
  east.position.set(params.wall.lengthMeters / 2 - wallInset, wallY, 0);
  const west = east.clone();
  west.name = 'legacyWallProxy:west';
  west.position.x = -params.wall.lengthMeters / 2 + wallInset;
  return [north, south, east, west];
}
