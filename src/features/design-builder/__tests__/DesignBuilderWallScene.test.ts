import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { TOP_COURSE_RENDER_EPSILON_METERS } from '../domain/cmuInfillPanelSolver';
import type {
  CmuBlockInstance,
  DesignGeometryWallSegment,
  SegmentFrame,
} from '../geometry/designGeometry';
import type {
  CmuInfillSystemParameters,
  CmuWallSystemParameters,
} from '../types';
import {
  blockColor,
  buildCmuBlockInstanceSceneGroup,
  buildInfillPlasterSceneGroup,
  buildInfillWallProxySceneGroup,
  legacyWallProxyMeshes,
  resolveVisibleCmuBlockInstances,
} from '../ui/DesignBuilderWallScene';

function material(name: string): THREE.Material {
  const meshMaterial = new THREE.MeshBasicMaterial();
  meshMaterial.name = name;
  return meshMaterial;
}

function cmuBlock(partial: Partial<CmuBlockInstance>): CmuBlockInstance {
  return {
    id: partial.id ?? 'block-1',
    face: 'north',
    segmentId: 'segment-1',
    course: 0,
    blockType: 'full',
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
    lengthMeters: 0.4,
    startAlongMeters: 0,
    endAlongMeters: 0.4,
    ...partial,
  };
}

function segmentFrame(): SegmentFrame {
  return {
    segmentId: 'segment-1',
    start: { x: -3, z: 0 },
    end: { x: 3, z: 0 },
    exteriorStart: { x: -3, z: -0.1 },
    exteriorEnd: { x: 3, z: -0.1 },
    interiorStart: { x: -3, z: 0.1 },
    interiorEnd: { x: 3, z: 0.1 },
    centerlineStart: { x: -3, z: 0 },
    centerlineEnd: { x: 3, z: 0 },
    lengthMeters: 6,
    tangent: { x: 1, z: 0 },
    inwardNormal: { x: 0, z: 1 },
    outwardNormal: { x: 0, z: -1 },
    rotationY: 0,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  };
}

function wallSegment(): DesignGeometryWallSegment {
  return {
    segmentId: 'segment-1',
    lengthMeters: 6,
    heightMeters: 2.8,
    thicknessMeters: 0.2,
    x: 0,
    y: 1.4,
    z: 0,
    rotationY: 0,
  };
}

function panelBounds() {
  return {
    panelId: 'panel-1',
    hostSegmentId: 'segment-1',
    startStationMeters: 1,
    endStationMeters: 5,
    clearWidthMeters: 4,
    bottomElevationMeters: 0.4,
    topElevationMeters: 2.4,
    clearHeightMeters: 2,
    infillCenterlineInwardOffsetMeters: 0.1,
    hostWallCenterlineStart: { x: -3, y: 0, z: 0 },
    hostWallCenterlineEnd: { x: 3, y: 0, z: 0 },
    tangent: { x: 1, y: 0, z: 0 },
    outwardNormal: { x: 0, y: 0, z: -1 },
    inwardNormal: { x: 0, y: 0, z: 1 },
    leftSupportInsideFaceWorld: { x: -2, y: 0, z: 0 },
    rightSupportInsideFaceWorld: { x: 2, y: 0, z: 0 },
    leftSupportInsideFaceStation: 1,
    rightSupportInsideFaceStation: 5,
  };
}

describe('DesignBuilderWallScene', () => {
  it('filters visible CMU blocks based on infill and gable masonry visibility', () => {
    const wallBlock = cmuBlock({ id: 'wall-block' });
    const gableBlock = cmuBlock({ id: 'gable-block', source: 'gable_end_solver' });

    expect(
      resolveVisibleCmuBlockInstances({
        showCmuInfill: false,
        showIndividualBlocks: false,
        roofDisplayMode: 'full_roof',
        roofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
        blockInstances: [wallBlock, gableBlock],
      }).map((block) => block.id),
    ).toEqual(['gable-block']);

    expect(
      resolveVisibleCmuBlockInstances({
        showCmuInfill: true,
        showIndividualBlocks: true,
        roofDisplayMode: 'full_roof',
        roofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
        blockInstances: [wallBlock, gableBlock],
      }).map((block) => block.id),
    ).toEqual(['wall-block', 'gable-block']);

    expect(
      resolveVisibleCmuBlockInstances({
        showCmuInfill: true,
        showIndividualBlocks: true,
        roofDisplayMode: 'roof_cladding_only',
        roofLayerVisibility: { ...DEFAULT_ROOF_LAYER_VISIBILITY, gableEndCmu: false },
        blockInstances: [wallBlock, gableBlock],
      }).map((block) => block.id),
    ).toEqual(['wall-block']);
  });

  it('builds instanced CMU block groups with top-closure height bias', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const group = buildCmuBlockInstanceSceneGroup({
      blockInstances: [
        cmuBlock({
          id: 'full-1',
          blockType: 'full',
          x: 1,
          y: 0.2,
          z: 2,
          lengthMeters: 0.4,
          heightMeters: 0.2,
          depthMeters: 0.15,
        }),
        cmuBlock({
          id: 'cut-1',
          blockType: 'cut',
          source: 'panel_top_closure',
          x: -1,
          y: 2,
          z: -2,
          lengthMeters: 0.3,
          physicalHeightMeters: 0.1,
          depthMeters: 0.16,
        }),
      ],
      blockHeightMeters: 0.2,
      defaultBlockDepthMeters: 0.14,
      slabTopMeters: 0.12,
      createMaterial: (blockType) => material(blockType),
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(group.name).toBe('cmuBlockInstanceGroup');
    expect(group.children).toHaveLength(2);
    expect(tracked).toHaveLength(2);
    expect(blockColor('cut')).toBe(0xd6d3d1);
    const cutBlocks = group.getObjectByName('cmuBlocks:cut') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    cutBlocks.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);
    expect(position.y).toBeCloseTo(2.12 + TOP_COURSE_RENDER_EPSILON_METERS / 2, 6);
    expect(scale.y).toBeCloseTo(0.1 + TOP_COURSE_RENDER_EPSILON_METERS, 6);
  });

  it('builds infill proxy pieces using panel trim and centerline offset', () => {
    const group = buildInfillWallProxySceneGroup({
      wallSegments: [wallSegment()],
      segmentFrames: [segmentFrame()],
      resolvedInfillPanelBounds: [panelBounds()],
      openings: [],
      slabTopMeters: 0.12,
      material: material('wall'),
      trackGeometry: (geometry) => geometry,
    });

    expect(group.name).toBe('infillWallProxyGroup');
    expect(group.children).toHaveLength(1);
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.position.x).toBeCloseTo(0, 6);
    expect(mesh.position.y).toBeCloseTo(1.52, 6);
    expect(mesh.position.z).toBeCloseTo(0.1, 6);
    expect(mesh.renderOrder).toBe(0);
  });

  it('builds plaster meshes and legacy wall proxy meshes', () => {
    const infillSystem: CmuInfillSystemParameters = {
      kind: 'cmu_infill_system',
      panels: [
        {
          id: 'panel-1',
          hostSegmentId: 'segment-1',
          leftSupportType: 'column',
          rightSupportType: 'column',
          bottomSupportType: 'plinth_beam',
          topSupportType: 'roof_beam',
          startStationMeters: 1,
          endStationMeters: 5,
          bottomElevationMeters: 0.4,
          topElevationMeters: 2.4,
          masonrySettings: {
            bondPattern: 'running_bond',
            snapToModule: true,
            wasteFactor: 0.05,
          },
        },
      ],
      plaster: {
        enabled: true,
        finish: 'smooth',
        profileLabel: '3-coat plaster',
        interiorEnabled: false,
        interiorFinish: 'smooth',
        interiorProfileLabel: '3-coat plaster',
      },
    };
    const plasterGroup = buildInfillPlasterSceneGroup({
      infillSystem,
      panelBounds: [panelBounds()],
      openings: [],
      wallThicknessMeters: 0.2,
      exteriorSegmentIds: new Set(['segment-1']),
      slabTopMeters: 0.12,
      createMaterial: (finish) => material(finish),
      trackGeometry: (geometry) => geometry,
    });

    expect(plasterGroup.name).toBe('plasterGroup');
    expect(plasterGroup.children.length).toBeGreaterThan(0);
    const plasterMesh = plasterGroup.children[0] as THREE.Mesh;
    expect(plasterMesh.position.y).toBeCloseTo(1.52, 6);
    expect(plasterMesh.renderOrder).toBe(1);

    const wall = {
      lengthMeters: 6,
      widthMeters: 4,
      heightMeters: 2.8,
      wallThicknessMeters: 0.2,
    } as CmuWallSystemParameters;
    const legacyMeshes = legacyWallProxyMeshes({
      wall,
      slabTopMeters: 0.12,
      material: material('legacy'),
      trackGeometry: (geometry) => geometry,
    });
    expect(legacyMeshes.map((mesh) => mesh.name)).toEqual([
      'legacyWallProxy:north',
      'legacyWallProxy:south',
      'legacyWallProxy:east',
      'legacyWallProxy:west',
    ]);
    expect(legacyMeshes[0]!.position.y).toBeCloseTo(1.52, 6);
    expect(legacyMeshes[0]!.position.z).toBeCloseTo(-1.9, 6);
  });
});
