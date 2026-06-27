import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type {
  ResolvedFloorTileLayout,
  ResolvedPlywoodCeilingLayout,
} from '../types';
import {
  buildDesignBuilderViewerInteriorFinishScene,
  type DesignBuilderViewerInteriorFinishState,
} from '../ui/DesignBuilderViewerInteriorFinishScene';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

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
    cutTileCount: 0,
    totalTileCount: 1,
    orderTileCount: 2,
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
    ],
  };
}

function geometryResult(
  partial: Partial<DesignGeometryResult> = {},
): DesignGeometryResult {
  return {
    sourcePath: 'layout_graph',
    resolvedFootprint: {
      exteriorFacePolygon: [],
      interiorFacePolygon: [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ],
      centerlinePolygon: [],
      orderedPerimeterSegments: [],
    },
    interiorFloorSlab: {
      enabled: true,
      thicknessMeters: 0.125,
      bottomElevationMeters: 0.275,
      topElevationMeters: 0.4,
      areaSquareMeters: 12,
      volumeCubicMeters: 1.5,
    },
    floorTileLayout: floorTileLayout(),
    plywoodCeilingLayout: plywoodCeilingLayout(),
    wallSegments: [],
    blockInstances: [],
    cornerCourseLayouts: [],
    exteriorFootprint: [],
    boundaryViolations: [],
    blockCount: 0,
    bondPattern: 'running_bond',
    wallCmuLayout: {
      blocks: [],
      unitPlacements: [],
      roughOpenings: [],
      segmentFrames: [],
    },
    ...partial,
  } as DesignGeometryResult;
}

function interiorFinishState(
  partial: Partial<DesignBuilderViewerInteriorFinishState> = {},
): DesignBuilderViewerInteriorFinishState {
  const preset = createFiveBySixCmuBuildingPreset();
  return {
    currentGeometry: geometryResult(),
    currentSlab: preset.slab,
    currentVisualStyle: 'technical',
    usePreviewMaterials: false,
    frameSelected: false,
    ...partial,
  };
}

function meshByName(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('DesignBuilderViewerInteriorFinishScene', () => {
  it('builds floor tile and plywood ceiling groups with technical materials', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerInteriorFinishScene({
      state: interiorFinishState(),
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.groups.map((group) => group.name)).toEqual([
      'floorTileGroup',
      'plywoodCeilingGroup',
    ]);
    expect(resources.trackedGeometryCount()).toBe(5);
    expect(resources.trackedMaterialCount()).toBe(5);

    const floorGroup = scene.groups[0]!;
    const ceilingGroup = scene.groups[1]!;
    expect((meshByName(floorGroup, 'floorThinset').material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xc9b896);
    expect((meshByName(floorGroup, 'floorGrout').material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xf5f5f0);
    expect((meshByName(floorGroup, 'floorTile:tile-1').material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x9a9590);
    expect((meshByName(ceilingGroup, 'plywoodCeilingFrame:frame-1').material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x374151);
    expect((meshByName(ceilingGroup, 'plywoodCeilingPanel:panel-1').material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xc49a6c);

    resources.disposeTrackedResources();
  });

  it('does not build finish groups when CMU infill is hidden', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerInteriorFinishScene({
      state: interiorFinishState(),
      showCmuInfill: false,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.groups).toHaveLength(0);
    expect(resources.trackedGeometryCount()).toBe(0);
    expect(resources.trackedMaterialCount()).toBe(0);
  });
});
