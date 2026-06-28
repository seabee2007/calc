import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { SegmentFrame } from '../geometry/designGeometry';
import {
  resolveManualBrushPointFromRay,
  resolveSelectableDataForObject,
  resolveSelectablePickFromIntersections,
  resolveWallPickFromIntersections,
} from '../ui/DesignBuilderViewerPicking';

function intersection(
  object: THREE.Object3D,
  distance: number,
  point = new THREE.Vector3(),
): THREE.Intersection {
  return {
    object,
    distance,
    point,
  } as THREE.Intersection;
}

function segmentFrame(): SegmentFrame {
  return {
    segmentId: 'segment-1',
    start: { x: -3, z: -2 },
    end: { x: 3, z: -2 },
    exteriorStart: { x: -3, z: -2.1 },
    exteriorEnd: { x: 3, z: -2.1 },
    interiorStart: { x: -3, z: -1.9 },
    interiorEnd: { x: 3, z: -1.9 },
    centerlineStart: { x: -3, z: -2 },
    centerlineEnd: { x: 3, z: -2 },
    lengthMeters: 6,
    tangent: { x: 1, z: 0 },
    inwardNormal: { x: 0, z: 1 },
    outwardNormal: { x: 0, z: -1 },
    rotationY: 0,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  };
}

describe('DesignBuilderViewerPicking', () => {
  it('finds selectable metadata by walking up parent objects', () => {
    const parent = new THREE.Group();
    parent.userData.selectable = true;
    parent.userData.designObjectType = 'window_opening';
    parent.userData.openingId = 'window-1';
    parent.userData.selectionPriority = 100;
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    parent.add(child);

    expect(resolveSelectableDataForObject(child)).toMatchObject({
      designObjectType: 'window_opening',
      openingId: 'window-1',
      selectionPriority: 100,
    });
  });

  it('chooses selectable hits by priority before distance', () => {
    const nearLowPriority = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    nearLowPriority.userData.selectable = true;
    nearLowPriority.userData.designObjectType = 'building_footprint';
    nearLowPriority.userData.selectionPriority = 1;
    const farHighPriority = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    farHighPriority.userData.selectable = true;
    farHighPriority.userData.designObjectType = 'door_opening';
    farHighPriority.userData.openingId = 'door-1';
    farHighPriority.userData.selectionPriority = 100;

    const pick = resolveSelectablePickFromIntersections([
      intersection(nearLowPriority, 1),
      intersection(farHighPriority, 5),
    ]);

    expect(pick?.data).toMatchObject({
      designObjectType: 'door_opening',
      openingId: 'door-1',
    });
  });

  it('resolves segment-hosted wall picks and ignores back-facing hits', () => {
    const frame = segmentFrame();
    const backFacingMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    backFacingMesh.userData.isWallPickable = true;
    backFacingMesh.userData.wallSegmentId = frame.segmentId;
    const facingMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    facingMesh.userData.isWallPickable = true;
    facingMesh.userData.wallSegmentId = frame.segmentId;
    const debugLog = vi.fn();

    const backFacingPick = resolveWallPickFromIntersections({
      intersections: [intersection(backFacingMesh, 1, new THREE.Vector3(0, 1, -2))],
      viewDirection: { x: 0, z: -1 },
      segmentFrames: [frame],
      wall: { lengthMeters: 6, widthMeters: 5 },
      debugLog,
    });
    const facingPick = resolveWallPickFromIntersections({
      intersections: [intersection(facingMesh, 1, new THREE.Vector3(1.5, 1, -2))],
      viewDirection: { x: 0, z: 1 },
      segmentFrames: [frame],
      wall: { lengthMeters: 6, widthMeters: 5 },
      debugLog,
    });

    expect(backFacingPick).toBeNull();
    expect(facingPick).toMatchObject({
      wallSegmentId: 'segment-1',
      positionAlongSegment: 4.5,
      hitPoint: { x: 1.5, y: 1, z: -2 },
    });
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Host wall: segment-1'));
  });

  it('converts mirrored display wall hits back to plan coordinates', () => {
    const frame = segmentFrame();
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    wallMesh.userData.isWallPickable = true;
    wallMesh.userData.wallSegmentId = frame.segmentId;

    const pick = resolveWallPickFromIntersections({
      intersections: [intersection(wallMesh, 1, new THREE.Vector3(1.5, 1, 2))],
      viewDirection: { x: 0, z: -1 },
      segmentFrames: [frame],
      wall: { lengthMeters: 6, widthMeters: 5 },
      displayPointToPlanPoint: (point) => ({ x: point.x, z: -point.z }),
      displayDirectionToPlanDirection: (direction) => ({ x: direction.x, z: -direction.z }),
    });

    expect(pick).toMatchObject({
      wallSegmentId: 'segment-1',
      positionAlongSegment: 4.5,
      hitPoint: { x: 1.5, y: 1, z: -2 },
    });
  });

  it('resolves legacy face wall picks to offsets', () => {
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    wallMesh.userData.isWallPickable = true;
    wallMesh.userData.wallFace = 'east';

    const pick = resolveWallPickFromIntersections({
      intersections: [intersection(wallMesh, 2, new THREE.Vector3(3, 1, 0.75))],
      viewDirection: { x: 0, z: -1 },
      segmentFrames: [],
      wall: { lengthMeters: 6, widthMeters: 5 },
    });

    expect(pick).toMatchObject({
      wallFace: 'east',
      offsetMeters: 3.25,
      hitPoint: { x: 3, y: 1, z: 0.75 },
    });
  });

  it('resolves manual brush ground point from the ray', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(2, 5, -3),
      new THREE.Vector3(0, -1, 0),
    );

    expect(resolveManualBrushPointFromRay({ ray })).toEqual({ x: 2, z: -3 });
  });

  it('converts mirrored manual brush ground points back to plan coordinates', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(2, 5, 3),
      new THREE.Vector3(0, -1, 0),
    );

    expect(
      resolveManualBrushPointFromRay({
        ray,
        displayPointToPlanPoint: (point) => ({ x: point.x, z: -point.z }),
      }),
    ).toEqual({ x: 2, z: -3 });
  });
});
