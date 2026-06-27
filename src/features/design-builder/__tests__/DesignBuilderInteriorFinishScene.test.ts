import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type {
  ResolvedFloorTileLayout,
  ResolvedPlywoodCeilingLayout,
} from '../types';
import {
  buildFloorTileSceneGroup,
  buildPlywoodCeilingSceneGroup,
  parsePlywoodColor,
} from '../ui/DesignBuilderInteriorFinishScene';

function material(name: string): THREE.MeshStandardMaterial {
  const meshMaterial = new THREE.MeshStandardMaterial();
  meshMaterial.name = name;
  return meshMaterial;
}

function meshByName(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

function floorTileLayout(): ResolvedFloorTileLayout {
  return {
    enabled: true,
    tileSizeKey: '600x600',
    tileWidthMeters: 0.6,
    tileDepthMeters: 0.6,
    groutJointMeters: 0.003,
    thinsetThicknessMeters: 0.02,
    wasteFactor: 0.1,
    floorAreaSquareMeters: 8,
    installedAreaSquareMeters: 7.8,
    fullTileCount: 1,
    cutTileCount: 1,
    totalTileCount: 2,
    orderTileCount: 3,
    thinsetVolumeCubicMeters: 0.16,
    thinsetBags: 1,
    groutVolumeCubicMeters: 0.01,
    groutBags: 1,
    placements: [
      {
        id: 'tile-1',
        kind: 'full',
        center: { x: 0, z: 0 },
        widthMeters: 0.6,
        depthMeters: 0.6,
        renderCenter: { x: 0.5, z: -0.25 },
        renderWidthMeters: 0.6,
        renderDepthMeters: 0.6,
        installedAreaSquareMeters: 0.36,
        rotationY: Math.PI / 4,
      },
      {
        id: 'tile-2',
        kind: 'cut',
        center: { x: 0, z: 0 },
        widthMeters: 0.6,
        depthMeters: 0.6,
        renderCenter: { x: 0, z: 0 },
        renderWidthMeters: 0.4,
        renderDepthMeters: 0.5,
        renderPolygon: [
          { x: -0.2, z: -0.25 },
          { x: 0.2, z: -0.25 },
          { x: 0.15, z: 0.25 },
          { x: -0.2, z: 0.2 },
        ],
        installedAreaSquareMeters: 0.2,
        rotationY: 0,
      },
      {
        id: 'tile-skip',
        kind: 'cut',
        center: { x: 0, z: 0 },
        widthMeters: 0.6,
        depthMeters: 0.6,
        renderCenter: { x: 0, z: 0 },
        renderWidthMeters: 0,
        renderDepthMeters: 0.6,
        installedAreaSquareMeters: 0,
        rotationY: 0,
      },
    ],
  };
}

function plywoodCeilingLayout(): ResolvedPlywoodCeilingLayout {
  return {
    enabled: true,
    ceilingHeightMeters: 2.4,
    frameBottomElevationMeters: 2.4,
    plywoodColor: '#c49a6c',
    sheetWidthMeters: 1.2,
    sheetLengthMeters: 2.4,
    sheetThicknessMeters: 0.012,
    braceSpacingMeters: 0.6,
    tubeSizeMeters: 0.05,
    ceilingAreaSquareMeters: 6,
    fullPanelCount: 1,
    cutPanelCount: 0,
    totalPanelCount: 1,
    orderPanelCount: 1,
    longAxis: 'x',
    shortSpanMeters: 2,
    longSpanMeters: 3,
    warnings: [],
    frameMembers: [
      {
        id: 'frame-1',
        kind: 'perimeter',
        start: { x: 0, y: 2.4, z: 0 },
        end: { x: 2, y: 2.4, z: 0 },
        widthMeters: 0.05,
        heightMeters: 0.05,
      },
      {
        id: 'frame-skip',
        kind: 'cross_brace',
        start: { x: 0, y: 2.4, z: 0 },
        end: { x: 0, y: 2.4, z: 0 },
        widthMeters: 0.05,
        heightMeters: 0.05,
      },
    ],
    panelPlacements: [
      {
        id: 'panel-1',
        kind: 'full',
        center: { x: 1, y: 2.43, z: 0.5 },
        widthMeters: 1.2,
        lengthMeters: 2.4,
        thicknessMeters: 0.012,
      },
      {
        id: 'panel-skip',
        kind: 'cut',
        center: { x: 0, y: 2.43, z: 0 },
        widthMeters: 1.2,
        lengthMeters: 0,
        thicknessMeters: 0.012,
      },
    ],
  };
}

describe('DesignBuilderInteriorFinishScene', () => {
  it('builds floor thinset, grout, and tile meshes at slab-relative elevations', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const grout = material('grout');
    const tile = material('tile');

    const group = buildFloorTileSceneGroup({
      floorTileLayout: floorTileLayout(),
      interiorFacePolygon: [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ],
      slabTopMeters: 0.12,
      interiorFloorSlabTopElevationMeters: 0.4,
      materials: {
        thinset: material('thinset'),
        grout,
        tile,
      },
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(group.name).toBe('floorTileGroup');
    expect(group.children).toHaveLength(4);
    expect(tracked).toHaveLength(4);
    expect(meshByName(group, 'floorThinset').position.y).toBeCloseTo(0.54, 6);
    expect(meshByName(group, 'floorGrout').position.y).toBeCloseTo(0.54775, 6);
    expect(meshByName(group, 'floorTile:tile-1').position.y).toBeCloseTo(0.544, 6);
    expect(meshByName(group, 'floorTile:tile-2').position.y).toBeCloseTo(0.548, 6);
    expect(group.getObjectByName('floorTile:tile-skip')).toBeUndefined();
    expect(grout.polygonOffset).toBe(true);
    expect(grout.polygonOffsetFactor).toBe(2);
    expect(tile.polygonOffset).toBe(true);
    expect(tile.polygonOffsetUnits).toBe(-4);
    expect(meshByName(group, 'floorGrout').renderOrder).toBe(2);
    expect(meshByName(group, 'floorTile:tile-1').renderOrder).toBe(3);
  });

  it('builds plywood ceiling frame and panel meshes with render ordering', () => {
    const plywood = material('plywood');

    const group = buildPlywoodCeilingSceneGroup({
      plywoodCeilingLayout: plywoodCeilingLayout(),
      slabTopMeters: 0.12,
      materials: {
        frame: material('frame'),
        plywood,
      },
      trackGeometry: (geometry) => geometry,
    });

    expect(group.name).toBe('plywoodCeilingGroup');
    expect(group.children).toHaveLength(2);
    const frame = meshByName(group, 'plywoodCeilingFrame:frame-1');
    const panel = meshByName(group, 'plywoodCeilingPanel:panel-1');
    expect(frame.position.x).toBeCloseTo(1, 6);
    expect(frame.position.y).toBeCloseTo(2.52, 6);
    expect(frame.renderOrder).toBe(4);
    expect(panel.position.y).toBeCloseTo(2.55, 6);
    expect(panel.renderOrder).toBe(5);
    expect(plywood.polygonOffset).toBe(true);
    expect(plywood.polygonOffsetFactor).toBe(-1);
    expect(group.getObjectByName('plywoodCeilingFrame:frame-skip')).toBeUndefined();
    expect(group.getObjectByName('plywoodCeilingPanel:panel-skip')).toBeUndefined();
  });

  it('parses plywood colors with a stable fallback', () => {
    expect(parsePlywoodColor('#c49a6c')).toBe(0xc49a6c);
    expect(parsePlywoodColor('C49A6C')).toBe(0xc49a6c);
    expect(parsePlywoodColor('not-a-color')).toBe(0xd4b896);
  });
});
