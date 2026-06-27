import * as THREE from 'three';
import type {
  ResolvedFloorTileLayout,
  ResolvedPlywoodCeilingLayout,
} from '../types';
import { createFootprintSlabGeometry } from './DesignBuilderFootprintScene';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;

const TILE_SURFACE_THICKNESS_METERS = 0.008;
const TILE_GROUT_TOP_BIAS_METERS = 0.00025;

export interface FloorTileSceneMaterials {
  thinset: THREE.MeshStandardMaterial;
  grout: THREE.MeshStandardMaterial;
  tile: THREE.MeshStandardMaterial;
}

export interface PlywoodCeilingSceneMaterials {
  frame: THREE.MeshStandardMaterial;
  plywood: THREE.MeshStandardMaterial;
}

function applyFloorTileLayerDepthBias(
  material: THREE.MeshStandardMaterial,
  layer: 'grout' | 'tile',
): void {
  material.polygonOffset = true;
  if (layer === 'grout') {
    material.polygonOffsetFactor = 2;
    material.polygonOffsetUnits = 2;
  } else {
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -4;
  }
}

export function parsePlywoodColor(hex: string): number {
  const normalized = hex.trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return Number.parseInt(normalized, 16);
  }
  return 0xd4b896;
}

export function buildFloorTileSceneGroup(params: {
  floorTileLayout: ResolvedFloorTileLayout;
  interiorFacePolygon: readonly { x: number; z: number }[];
  slabTopMeters: number;
  interiorFloorSlabTopElevationMeters: number;
  materials: FloorTileSceneMaterials;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'floorTileGroup';
  if (!params.floorTileLayout.enabled || params.interiorFacePolygon.length < 3) {
    return group;
  }

  const thinsetMesh = new THREE.Mesh(
    params.trackGeometry(
      createFootprintSlabGeometry(
        params.interiorFacePolygon,
        params.floorTileLayout.thinsetThicknessMeters,
      ),
    ),
    params.materials.thinset,
  );
  thinsetMesh.name = 'floorThinset';
  thinsetMesh.position.y =
    params.slabTopMeters +
    params.interiorFloorSlabTopElevationMeters +
    params.floorTileLayout.thinsetThicknessMeters;
  group.add(thinsetMesh);

  const tileLayerBaseY =
    params.slabTopMeters +
    params.interiorFloorSlabTopElevationMeters +
    params.floorTileLayout.thinsetThicknessMeters;
  const tileSurfaceTopY = tileLayerBaseY + TILE_SURFACE_THICKNESS_METERS;
  const tileSurfaceY = tileLayerBaseY + TILE_SURFACE_THICKNESS_METERS / 2;

  if (params.floorTileLayout.groutJointMeters > 0.0005) {
    applyFloorTileLayerDepthBias(params.materials.grout, 'grout');
    const groutMesh = new THREE.Mesh(
      params.trackGeometry(
        createFootprintSlabGeometry(
          params.interiorFacePolygon,
          TILE_SURFACE_THICKNESS_METERS,
        ),
      ),
      params.materials.grout,
    );
    groutMesh.name = 'floorGrout';
    groutMesh.position.y = tileSurfaceTopY - TILE_GROUT_TOP_BIAS_METERS;
    groutMesh.renderOrder = 2;
    group.add(groutMesh);
  }

  applyFloorTileLayerDepthBias(params.materials.tile, 'tile');
  params.floorTileLayout.placements.forEach((placement) => {
    const tileWidthMeters = placement.renderWidthMeters;
    const tileDepthMeters = placement.renderDepthMeters;
    const tileCenter = placement.renderCenter;
    if (tileWidthMeters <= 0.001 || tileDepthMeters <= 0.001) {
      return;
    }
    const tileGeometry =
      placement.renderPolygon && placement.renderPolygon.length >= 3
        ? createFootprintSlabGeometry(placement.renderPolygon, TILE_SURFACE_THICKNESS_METERS)
        : new THREE.BoxGeometry(
            tileWidthMeters,
            TILE_SURFACE_THICKNESS_METERS,
            tileDepthMeters,
          );
    const tileMesh = new THREE.Mesh(params.trackGeometry(tileGeometry), params.materials.tile);
    tileMesh.name = `floorTile:${placement.id}`;
    if (placement.renderPolygon && placement.renderPolygon.length >= 3) {
      tileMesh.position.y = tileSurfaceTopY;
    } else {
      tileMesh.position.set(tileCenter.x, tileSurfaceY, tileCenter.z);
      tileMesh.rotation.y = placement.rotationY;
    }
    tileMesh.renderOrder = 3;
    group.add(tileMesh);
  });

  return group;
}

export function buildPlywoodCeilingSceneGroup(params: {
  plywoodCeilingLayout: ResolvedPlywoodCeilingLayout;
  slabTopMeters: number;
  materials: PlywoodCeilingSceneMaterials;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plywoodCeilingGroup';
  if (!params.plywoodCeilingLayout.enabled) {
    return group;
  }

  params.plywoodCeilingLayout.frameMembers.forEach((member) => {
    const dx = member.end.x - member.start.x;
    const dz = member.end.z - member.start.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0.001) return;
    const mesh = new THREE.Mesh(
      params.trackGeometry(new THREE.BoxGeometry(length, member.heightMeters, member.widthMeters)),
      params.materials.frame,
    );
    mesh.name = `plywoodCeilingFrame:${member.id}`;
    mesh.position.set(
      (member.start.x + member.end.x) / 2,
      params.slabTopMeters + member.start.y,
      (member.start.z + member.end.z) / 2,
    );
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.renderOrder = 4;
    group.add(mesh);
  });

  params.materials.plywood.polygonOffset = true;
  params.materials.plywood.polygonOffsetFactor = -1;
  params.materials.plywood.polygonOffsetUnits = -2;
  params.plywoodCeilingLayout.panelPlacements.forEach((panel) => {
    if (panel.widthMeters <= 0.001 || panel.lengthMeters <= 0.001) return;
    const mesh = new THREE.Mesh(
      params.trackGeometry(
        new THREE.BoxGeometry(panel.widthMeters, panel.thicknessMeters, panel.lengthMeters),
      ),
      params.materials.plywood,
    );
    mesh.name = `plywoodCeilingPanel:${panel.id}`;
    mesh.position.set(panel.center.x, params.slabTopMeters + panel.center.y, panel.center.z);
    mesh.renderOrder = 5;
    group.add(mesh);
  });

  return group;
}
