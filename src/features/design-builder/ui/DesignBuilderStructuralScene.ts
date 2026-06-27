import * as THREE from 'three';
import {
  FOUNDATION_CONTACT_EPSILON_METERS,
  TOP_OF_PLINTH_BEAM_Y,
} from '../domain/foundationElevations';
import type { ResolvedInteriorFloorSlab } from '../domain/interiorFloorSlab';
import type {
  IsolatedFooting,
  StructuralBeam,
  StructuralFrameSystemParameters,
} from '../types';
import { createFootprintSlabGeometry } from './DesignBuilderFootprintScene';
import {
  buildRcBeamMesh,
  buildRcBoxMesh,
  buildRcElevationBoxMesh,
  type TrackGeometry,
} from './DesignBuilderRcPrimitiveScene';

export interface StructuralFrameSceneMaterials {
  columnConcrete: THREE.Material;
  beam: THREE.Material;
  plinthBeam: THREE.Material;
  tieBeam: THREE.Material;
  roofBeam: THREE.Material;
  footing: THREE.Material;
  interiorSlab: THREE.Material;
  createPlaster: () => THREE.Material;
}

function isPlasterFinishedBeamKind(
  beam: StructuralBeam,
  plinthTopElevationMeters: number,
): boolean {
  return (
    beam.baseElevationMeters >= plinthTopElevationMeters - FOUNDATION_CONTACT_EPSILON_METERS &&
    (beam.kind === 'ring_beam' || beam.kind === 'roof_beam' || beam.kind === 'lintel_beam')
  );
}

function materialForBeam(params: {
  beam: StructuralBeam;
  materials: StructuralFrameSceneMaterials;
  useFramePlasterFinish: boolean;
  plinthTopElevationMeters: number;
}): THREE.Material {
  if (
    params.useFramePlasterFinish &&
    isPlasterFinishedBeamKind(params.beam, params.plinthTopElevationMeters)
  ) {
    return params.materials.createPlaster();
  }
  if (params.beam.kind === 'plinth_beam' || params.beam.kind === 'grade_beam') {
    return params.materials.plinthBeam;
  }
  if (params.beam.kind === 'tie_beam') {
    return params.materials.tieBeam;
  }
  if (params.beam.kind === 'roof_beam' || params.beam.kind === 'ring_beam') {
    return params.materials.roofBeam;
  }
  return params.materials.beam;
}

export function buildResolvedStructuralFrameSceneGroup(params: {
  frameSystem?: StructuralFrameSystemParameters;
  isolatedFootings?: readonly IsolatedFooting[];
  interiorFloorSlab?: ResolvedInteriorFloorSlab;
  interiorFacePolygon?: readonly { x: number; z: number }[];
  slabTopMeters: number;
  useFramePlasterFinish: boolean;
  materials: StructuralFrameSceneMaterials;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'resolvedStructuralFrameGroup';
  const plinthTopElevationMeters =
    params.frameSystem?.beams.find((beam) => beam.kind === 'plinth_beam')?.topElevationMeters ??
    TOP_OF_PLINTH_BEAM_Y;

  params.frameSystem?.columns.forEach((column) => {
    if (params.useFramePlasterFinish) {
      const belowPlinthHeight = Math.max(0, plinthTopElevationMeters - column.baseElevationMeters);
      const abovePlinthHeight = Math.max(0, column.topElevationMeters - plinthTopElevationMeters);
      if (belowPlinthHeight > FOUNDATION_CONTACT_EPSILON_METERS) {
        const belowMesh = buildRcElevationBoxMesh({
          name: `structuralColumn:${column.id}:concrete`,
          xSizeMeters: column.widthMeters,
          zSizeMeters: column.depthMeters,
          bottomElevationMeters: column.baseElevationMeters,
          topElevationMeters: column.baseElevationMeters + belowPlinthHeight,
          x: column.position.x,
          z: column.position.z,
          slabTopMeters: params.slabTopMeters,
          material: params.materials.columnConcrete,
          trackGeometry: params.trackGeometry,
          minHeightMeters: 0,
          userData: { structuralElementId: column.id },
        });
        group.add(belowMesh);
      }
      if (abovePlinthHeight > FOUNDATION_CONTACT_EPSILON_METERS) {
        const aboveMesh = buildRcElevationBoxMesh({
          name: `structuralColumn:${column.id}:plaster`,
          xSizeMeters: column.widthMeters,
          zSizeMeters: column.depthMeters,
          bottomElevationMeters: plinthTopElevationMeters,
          topElevationMeters: plinthTopElevationMeters + abovePlinthHeight,
          x: column.position.x,
          z: column.position.z,
          slabTopMeters: params.slabTopMeters,
          material: params.materials.createPlaster(),
          trackGeometry: params.trackGeometry,
          minHeightMeters: 0,
          userData: { structuralElementId: column.id },
        });
        group.add(aboveMesh);
      }
      return;
    }

    const mesh = buildRcElevationBoxMesh({
      name: `structuralColumn:${column.id}`,
      xSizeMeters: column.widthMeters,
      zSizeMeters: column.depthMeters,
      bottomElevationMeters: column.baseElevationMeters,
      topElevationMeters: column.baseElevationMeters + column.heightMeters,
      x: column.position.x,
      z: column.position.z,
      slabTopMeters: params.slabTopMeters,
      material: params.materials.columnConcrete,
      trackGeometry: params.trackGeometry,
      minHeightMeters: 0,
      userData: { structuralElementId: column.id },
    });
    group.add(mesh);
  });

  params.frameSystem?.beams.forEach((beam) => {
    const mesh = buildRcBeamMesh({
      name: `structuralBeam:${beam.id}`,
      start: beam.startPoint,
      end: beam.endPoint,
      baseElevationMeters: beam.baseElevationMeters,
      widthMeters: beam.widthMeters,
      depthMeters: beam.depthMeters,
      slabTopMeters: params.slabTopMeters,
      material: materialForBeam({
        beam,
        materials: params.materials,
        useFramePlasterFinish: params.useFramePlasterFinish,
        plinthTopElevationMeters,
      }),
      trackGeometry: params.trackGeometry,
      userData: { structuralElementId: beam.id },
    });
    if (!mesh) return;
    group.add(mesh);
  });

  if (
    params.interiorFloorSlab?.enabled &&
    params.interiorFacePolygon &&
    params.interiorFacePolygon.length >= 3
  ) {
    const interiorSlabMesh = new THREE.Mesh(
      params.trackGeometry(
        createFootprintSlabGeometry(
          params.interiorFacePolygon,
          params.interiorFloorSlab.thicknessMeters,
        ),
      ),
      params.materials.interiorSlab,
    );
    interiorSlabMesh.name = 'interiorFloorSlab';
    interiorSlabMesh.position.y =
      params.slabTopMeters + params.interiorFloorSlab.topElevationMeters;
    group.add(interiorSlabMesh);
  }

  params.isolatedFootings?.forEach((footing) => {
    const mesh = buildRcBoxMesh({
      name: `isolatedFooting:${footing.id}`,
      xSizeMeters: footing.widthMeters,
      ySizeMeters: footing.thicknessMeters,
      zSizeMeters: footing.lengthMeters,
      center: {
        x: footing.position.x,
        y: params.slabTopMeters + footing.centerElevationMeters,
        z: footing.position.z,
      },
      material: params.materials.footing,
      trackGeometry: params.trackGeometry,
      userData: { structuralElementId: footing.id },
    });
    group.add(mesh);
  });

  return group;
}
