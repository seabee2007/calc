import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type {
  IsolatedFooting,
  StructuralFrameSystemParameters,
} from '../types';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';
import {
  buildDesignBuilderViewerStructuralFrameScene,
  type DesignBuilderViewerStructuralFrameState,
} from '../ui/DesignBuilderViewerStructuralFrameScene';

function frameSystem(): StructuralFrameSystemParameters {
  return {
    kind: 'structural_frame_system',
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    defaultColumnWidthMeters: 0.3,
    defaultColumnDepthMeters: 0.3,
    defaultGradeBeamWidthMeters: 0.2,
    defaultGradeBeamDepthMeters: 0.3,
    defaultRingBeamWidthMeters: 0.2,
    defaultRingBeamDepthMeters: 0.3,
    columns: [
      {
        id: 'column-1',
        name: 'Column 1',
        kind: 'rc_column',
        position: { x: 1.25, z: -0.75 },
        widthMeters: 0.3,
        depthMeters: 0.35,
        heightMeters: 2.8,
        baseElevationMeters: 0,
        topElevationMeters: 2.8,
        source: 'auto_frame_layout',
      },
    ],
    beams: [
      {
        id: 'plinth-1',
        name: 'Plinth beam',
        kind: 'plinth_beam',
        startPoint: { x: -2, y: 0, z: -1 },
        endPoint: { x: 2, y: 0, z: -1 },
        widthMeters: 0.2,
        depthMeters: 0.3,
        baseElevationMeters: 0.1,
        topElevationMeters: 0.4,
        source: 'auto_frame_layout',
      },
    ],
  };
}

function isolatedFooting(): IsolatedFooting {
  return {
    id: 'footing-1',
    name: 'Footing 1',
    columnId: 'column-1',
    position: { x: 1.25, z: -0.75 },
    widthMeters: 0.8,
    lengthMeters: 0.9,
    thicknessMeters: 0.25,
    topElevationMeters: 0,
    bottomElevationMeters: -0.25,
    centerElevationMeters: -0.125,
    source: 'auto_at_column',
  };
}

function geometryResult(
  partial: Partial<DesignGeometryResult> = {},
): DesignGeometryResult {
  return {
    sourcePath: 'layout_graph',
    frameSystem: frameSystem(),
    isolatedFootings: [isolatedFooting()],
    resolvedFootprint: null,
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

function structuralState(
  partial: Partial<DesignBuilderViewerStructuralFrameState> = {},
): DesignBuilderViewerStructuralFrameState {
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

describe('DesignBuilderViewerStructuralFrameScene', () => {
  it('builds selectable structural frame and isolated footing scene geometry', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerStructuralFrameScene({
      state: structuralState(),
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.group.name).toBe('resolvedStructuralFrameGroup');
    expect(scene.group.children).toHaveLength(3);
    expect(scene.selectableObjects).toHaveLength(3);
    expect(resources.trackedGeometryCount()).toBe(3);

    const column = meshByName(scene.group, 'structuralColumn:column-1');
    const beam = meshByName(scene.group, 'structuralBeam:plinth-1');
    const footing = meshByName(scene.group, 'isolatedFooting:footing-1');
    for (const mesh of [column, beam, footing]) {
      expect(mesh.userData.selectable).toBe(true);
      expect(mesh.userData.designObjectType).toBe('structural_frame_system');
      expect(mesh.userData.selectionPriority).toBe(1);
    }
    expect((column.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x9ca3af);
    expect((beam.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x57534e);
    expect((footing.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x78716c);

    resources.disposeTrackedResources();
  });

  it('keeps structural columns concrete when CMU infill plaster is enabled', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerStructuralFrameScene({
      state: structuralState({
        currentGeometry: geometryResult({
          infillSystem: {
            kind: 'cmu_infill_system',
            panels: [],
            plaster: {
              enabled: true,
              finish: 'textured',
              profileLabel: '3-coat plaster',
              interiorEnabled: true,
              interiorFinish: 'smooth',
              interiorProfileLabel: '3-coat plaster',
            },
          },
        }),
      }),
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.group.getObjectByName('structuralColumn:column-1:plaster')).toBeUndefined();
    const column = meshByName(scene.group, 'structuralColumn:column-1');
    expect((column.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x9ca3af);

    resources.disposeTrackedResources();
  });

  it('returns an empty scene when no frame, slab, or footing geometry is present', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerStructuralFrameScene({
      state: structuralState({
        currentGeometry: geometryResult({
          frameSystem: undefined,
          isolatedFootings: [],
          interiorFloorSlab: undefined,
        }),
      }),
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.group.children).toHaveLength(0);
    expect(scene.selectableObjects).toHaveLength(0);
    expect(resources.trackedGeometryCount()).toBe(0);
  });
});
