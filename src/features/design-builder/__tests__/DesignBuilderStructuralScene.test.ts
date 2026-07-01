import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ResolvedInteriorFloorSlab } from '../domain/interiorFloorSlab';
import type {
  IsolatedFooting,
  StructuralFrameSystemParameters,
} from '../types';
import {
  buildResolvedStructuralFrameSceneGroup,
  type StructuralFrameSceneMaterials,
} from '../ui/DesignBuilderStructuralScene';

function makeMaterial(name: string): THREE.Material {
  const material = new THREE.MeshBasicMaterial();
  material.name = name;
  return material;
}

function sceneMaterials(createPlaster = () => makeMaterial('plaster')): StructuralFrameSceneMaterials {
  return {
    columnConcrete: makeMaterial('columnConcrete'),
    beam: makeMaterial('beam'),
    plinthBeam: makeMaterial('plinthBeam'),
    tieBeam: makeMaterial('tieBeam'),
    roofBeam: makeMaterial('roofBeam'),
    footing: makeMaterial('footing'),
    interiorSlab: makeMaterial('interiorSlab'),
    createPlaster,
  };
}

function baseFrameSystem(): StructuralFrameSystemParameters {
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

function meshByName(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('DesignBuilderStructuralScene', () => {
  it('builds resolved frame, slab, and isolated footing meshes at slab-relative elevations', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const interiorSlab: ResolvedInteriorFloorSlab = {
      enabled: true,
      thicknessMeters: 0.125,
      footprintPolygon: [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ],
      bottomElevationMeters: 0.275,
      topElevationMeters: 0.4,
      areaSquareMeters: 4,
      volumeCubicMeters: 0.5,
    };
    const isolatedFootings: IsolatedFooting[] = [
      {
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
      },
    ];

    const group = buildResolvedStructuralFrameSceneGroup({
      frameSystem: baseFrameSystem(),
      isolatedFootings,
      interiorFloorSlab: interiorSlab,
      interiorFacePolygon: [
        { x: -2, z: -1.5 },
        { x: 2, z: -1.5 },
        { x: 2, z: 1.5 },
        { x: -2, z: 1.5 },
      ],
      slabTopMeters: 0.12,
      useFramePlasterFinish: false,
      materials: sceneMaterials(),
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(group.name).toBe('resolvedStructuralFrameGroup');
    expect(group.children).toHaveLength(4);
    expect(tracked).toHaveLength(4);

    expect(meshByName(group, 'structuralColumn:column-1').position.y).toBeCloseTo(1.52, 6);
    expect(meshByName(group, 'structuralBeam:plinth-1').position.y).toBeCloseTo(0.37, 6);
    const slabMesh = meshByName(group, 'interiorFloorSlab');
    expect(slabMesh.position.y).toBeCloseTo(0.52, 6);
    slabMesh.geometry.computeBoundingBox();
    expect(slabMesh.geometry.boundingBox?.min.x).toBeCloseTo(-1, 6);
    expect(slabMesh.geometry.boundingBox?.max.x).toBeCloseTo(1, 6);
    expect(slabMesh.geometry.boundingBox?.min.z).toBeCloseTo(-1, 6);
    expect(slabMesh.geometry.boundingBox?.max.z).toBeCloseTo(1, 6);
    expect(meshByName(group, 'isolatedFooting:footing-1').position.y).toBeCloseTo(-0.005, 6);
  });

  it('splits columns at plinth top and applies plaster material to upper finished frame pieces', () => {
    const plasterMaterial = makeMaterial('plaster');
    const materials = sceneMaterials(() => plasterMaterial);
    const frameSystem = baseFrameSystem();
    frameSystem.beams.push({
      id: 'roof-1',
      name: 'Roof beam',
      kind: 'roof_beam',
      startPoint: { x: -2, y: 0, z: 1 },
      endPoint: { x: 2, y: 0, z: 1 },
      widthMeters: 0.2,
      depthMeters: 0.3,
      baseElevationMeters: 2.5,
      topElevationMeters: 2.8,
      source: 'auto_frame_layout',
    });

    const group = buildResolvedStructuralFrameSceneGroup({
      frameSystem,
      slabTopMeters: 0.12,
      useFramePlasterFinish: true,
      materials,
      trackGeometry: (geometry) => geometry,
    });

    const concreteColumn = meshByName(group, 'structuralColumn:column-1:concrete');
    const plasterColumn = meshByName(group, 'structuralColumn:column-1:plaster');
    const plinthBeam = meshByName(group, 'structuralBeam:plinth-1');
    const roofBeam = meshByName(group, 'structuralBeam:roof-1');

    expect(concreteColumn.position.y).toBeCloseTo(0.32, 6);
    expect(plasterColumn.position.y).toBeCloseTo(1.72, 6);
    expect(plasterColumn.material).toBe(plasterMaterial);
    expect(plinthBeam.material).toBe(materials.plinthBeam);
    expect(roofBeam.material).toBe(plasterMaterial);
  });
});
