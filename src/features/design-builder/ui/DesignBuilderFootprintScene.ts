import * as THREE from 'three';

export function createFootprintSlabGeometry(
  exteriorFacePolygon: readonly { x: number; z: number }[],
  slabThicknessMeters: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  exteriorFacePolygon.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.z);
    } else {
      shape.lineTo(point.x, point.z);
    }
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, slabThicknessMeters),
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
