import * as THREE from 'three';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type { ThickenedEdgeSlabParameters } from '../types';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = <T extends THREE.Material>(material: T) => T;

export function createFootprintSetoutLine(params: {
  polygon: readonly { x: number; z: number }[];
  y: number;
  color: number;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}): THREE.Line {
  const points =
    params.polygon.length >= 2 ? [...params.polygon, params.polygon[0]!] : params.polygon;
  const geometry = params.trackGeometry(
    new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(point.x, params.y, point.z)),
    ),
  );
  const material = params.trackMaterial(
    new THREE.LineBasicMaterial({ color: params.color, transparent: true, opacity: 0.95 }),
  );
  const line = new THREE.Line(geometry, material);
  line.userData.explicitHelperMarker = true;
  return line;
}

export function buildDesignBuilderViewerRoofReferenceScene(params: {
  enabled: boolean;
  geometry: DesignGeometryResult;
  slab: ThickenedEdgeSlabParameters;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roofReferencePerimeterGroup';
  const resolvedRoof = params.geometry.resolvedRoofSystem;
  if (!params.enabled || !resolvedRoof?.supported) return group;

  const roofY =
    (resolvedRoof.roofBeamTopElevationMeters ?? params.slab.slabThicknessMeters + 2.8) + 0.08;
  const wallExterior =
    params.geometry.exteriorFootprint ??
    params.geometry.resolvedFootprint?.exteriorFacePolygon ??
    [];
  if (wallExterior.length >= 3) {
    group.add(
      createFootprintSetoutLine({
        polygon: wallExterior,
        y: roofY,
        color: 0xffffff,
        trackGeometry: params.trackGeometry,
        trackMaterial: params.trackMaterial,
      }),
    );
  }

  const bearing = resolvedRoof.structuralBearingPerimeter.map((point) => ({
    x: point.x,
    z: point.z,
  }));
  if (bearing.length >= 3) {
    group.add(
      createFootprintSetoutLine({
        polygon: bearing,
        y: roofY + 0.02,
        color: 0x14b8a6,
        trackGeometry: params.trackGeometry,
        trackMaterial: params.trackMaterial,
      }),
    );
  }

  const cladding = resolvedRoof.claddingPerimeter.map((point) => ({
    x: point.x,
    z: point.z,
  }));
  if (cladding.length >= 3) {
    group.add(
      createFootprintSetoutLine({
        polygon: cladding,
        y: roofY + 0.04,
        color: 0xeab308,
        trackGeometry: params.trackGeometry,
        trackMaterial: params.trackMaterial,
      }),
    );
  }

  return group;
}
