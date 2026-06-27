import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type { ResolvedRoofSystem } from '../types';
import {
  buildDesignBuilderViewerRoofReferenceScene,
  createFootprintSetoutLine,
} from '../ui/DesignBuilderViewerRoofReferenceScene';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

function perimeter(offset = 0): { x: number; y: number; z: number }[] {
  return [
    { x: -2 - offset, y: 0, z: -1 - offset },
    { x: 2 + offset, y: 0, z: -1 - offset },
    { x: 2 + offset, y: 0, z: 1 + offset },
    { x: -2 - offset, y: 0, z: 1 + offset },
  ];
}

function resolvedRoof(partial: Partial<ResolvedRoofSystem> = {}): ResolvedRoofSystem {
  return {
    supported: true,
    roofType: 'gable',
    structuralBearingPerimeter: perimeter(0.1),
    claddingPerimeter: perimeter(0.2),
    roofBeamTopElevationMeters: 2.8,
    roofTopPlanes: [],
    claddingDisplayPlanes: [],
    roofSheetPerimeter: [],
    gableEndRoofingClosures: [],
    trussPlacements: [],
    purlinPlacements: [],
    ridgeCapPlacements: [],
    fasciaPlacements: [],
    soffitPlacements: [],
    hipMemberPlacements: [],
    rakedCapPlacements: [],
    warnings: [],
    ...partial,
  } as ResolvedRoofSystem;
}

function geometryResult(partial: Partial<DesignGeometryResult> = {}): DesignGeometryResult {
  return {
    sourcePath: 'layout_graph',
    exteriorFootprint: perimeter(),
    resolvedRoofSystem: resolvedRoof(),
    wallSegments: [],
    blockInstances: [],
    cornerCourseLayouts: [],
    resolvedFootprint: null,
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

function lineColor(line: THREE.Object3D): number {
  expect(line).toBeInstanceOf(THREE.Line);
  return ((line as THREE.Line).material as THREE.LineBasicMaterial).color.getHex();
}

function yValues(line: THREE.Object3D): number[] {
  const position = ((line as THREE.Line).geometry as THREE.BufferGeometry).getAttribute('position');
  const values: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    values.push(position.getY(index));
  }
  return values;
}

function expectAllYValuesCloseTo(line: THREE.Object3D, expected: number): void {
  yValues(line).forEach((y) => expect(y).toBeCloseTo(expected, 6));
}

describe('DesignBuilderViewerRoofReferenceScene', () => {
  it('builds wall, bearing, and cladding reference perimeter helper lines', () => {
    const resources = createDesignBuilderViewerResources();
    const preset = createFiveBySixCmuBuildingPreset();

    const group = buildDesignBuilderViewerRoofReferenceScene({
      enabled: true,
      geometry: geometryResult(),
      slab: preset.slab,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
    });

    expect(group.name).toBe('roofReferencePerimeterGroup');
    expect(group.children).toHaveLength(3);
    expect(resources.trackedGeometryCount()).toBe(3);
    expect(resources.trackedMaterialCount()).toBe(3);
    expect(group.children.map(lineColor)).toEqual([0xffffff, 0x14b8a6, 0xeab308]);
    expect(group.children.every((child) => child.userData.explicitHelperMarker)).toBe(true);
    expectAllYValuesCloseTo(group.children[0]!, 2.88);
    expectAllYValuesCloseTo(group.children[1]!, 2.9);
    expectAllYValuesCloseTo(group.children[2]!, 2.92);

    resources.disposeTrackedResources();
  });

  it('returns an empty group when disabled or unsupported', () => {
    const resources = createDesignBuilderViewerResources();
    const preset = createFiveBySixCmuBuildingPreset();

    const disabled = buildDesignBuilderViewerRoofReferenceScene({
      enabled: false,
      geometry: geometryResult(),
      slab: preset.slab,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
    });
    const unsupported = buildDesignBuilderViewerRoofReferenceScene({
      enabled: true,
      geometry: geometryResult({ resolvedRoofSystem: resolvedRoof({ supported: false }) }),
      slab: preset.slab,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
    });

    expect(disabled.children).toHaveLength(0);
    expect(unsupported.children).toHaveLength(0);
    expect(resources.trackedGeometryCount()).toBe(0);
    expect(resources.trackedMaterialCount()).toBe(0);
  });

  it('closes setout lines back to the first point', () => {
    const resources = createDesignBuilderViewerResources();
    const line = createFootprintSetoutLine({
      polygon: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 1, z: 1 },
      ],
      y: 3,
      color: 0xffffff,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
    });
    const position = line.geometry.getAttribute('position');

    expect(position.count).toBe(4);
    expect(position.getX(0)).toBe(position.getX(3));
    expect(position.getZ(0)).toBe(position.getZ(3));

    resources.disposeTrackedResources();
  });
});
