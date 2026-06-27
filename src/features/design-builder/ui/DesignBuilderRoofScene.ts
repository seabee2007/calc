import * as THREE from 'three';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  resolveTrussTopChordUpperPoint,
} from '../domain/roofFramingResolver';
import { resolveSegmentWallLayoutStart, type SegmentFrame } from '../geometry/designGeometry';
import {
  buildRakedCapStripRenderSegments,
  buildPurlinMesh,
  buildRoofCladdingRenderPlanes,
  buildSteelTrussMemberMeshes,
  buildTrussAnchorBoltMeshes,
  buildTrussBasePlateMesh,
  buildTrussPlaneGuide,
  buildHipMemberMesh,
  createFasciaTrimGeometry,
  createFoldedRidgeCapGroup,
  createFoldedRoofEdgeCapGroup,
  createRakedCapStripGeometry,
  createSoffitPanelGeometry,
  resolveRoofPlaneEavePair,
} from '../geometry/roofRenderingGeometry';
import {
  createRoofCladdingGeometry,
  createVerticalCladdingGeometry,
  resolveRoofRidgeDirection,
} from '../rendering/materials/designRenderingUv';
import type { RakedCapPlacement, ResolvedRoofSystem, RoofSystemSettings, RoofVec3 } from '../types';

const ROOF_CLADDING_BEAM_CLEARANCE_METERS = CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = (material: THREE.Material) => void;

function createRoofSheetEaveLipGeometry(params: {
  corners: readonly RoofVec3[];
  eavePair: [number, number];
  planeNormal: RoofVec3;
  slabTopMeters: number;
  thicknessMeters: number;
}): THREE.BufferGeometry {
  const [firstIndex, secondIndex] = params.eavePair;
  const topA = params.corners[firstIndex]!;
  const topB = params.corners[secondIndex]!;
  const bottomB = offsetPointAlongRoofNormal(topB, params.planeNormal, -params.thicknessMeters);
  const bottomA = offsetPointAlongRoofNormal(topA, params.planeNormal, -params.thicknessMeters);
  const vertices = [topA, topB, bottomB, bottomA];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, params.slabTopMeters + vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRoofCladdingSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  useMeterUvGeometry: boolean;
  corrugationRepeatPerMeter?: number;
  swapCorrugationAxis?: boolean;
  trackGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roofCladdingGroup';
  const rawCladdingPlanes =
    params.resolvedRoof.claddingDisplayPlanes.length > 0
      ? params.resolvedRoof.claddingDisplayPlanes
      : params.resolvedRoof.roofTopPlanes;
  const sheetReferencePerimeter =
    params.resolvedRoof.roofSheetPerimeter.length > 0
      ? params.resolvedRoof.roofSheetPerimeter
      : params.resolvedRoof.claddingPerimeter;
  const claddingPlanes = buildRoofCladdingRenderPlanes({
    planes: rawCladdingPlanes,
    clearanceMeters: ROOF_CLADDING_BEAM_CLEARANCE_METERS,
  });
  const ridgeDirectionHint =
    params.resolvedRoof.claddingRidgeStart && params.resolvedRoof.claddingRidgeEnd
      ? {
          x: params.resolvedRoof.claddingRidgeEnd.x - params.resolvedRoof.claddingRidgeStart.x,
          z: params.resolvedRoof.claddingRidgeEnd.z - params.resolvedRoof.claddingRidgeStart.z,
        }
      : undefined;

  for (const plane of claddingPlanes) {
    if (plane.corners.length < 3) continue;
    const planeNormal = normalizeOutwardRoofNormal(plane.normal);
    const visibleCorners = plane.corners;
    const topGeometry = params.useMeterUvGeometry
      ? params.trackGeometry(
          createRoofCladdingGeometry({
            corners: visibleCorners,
            slabTopMeters: params.slabTopMeters,
            planeNormal: new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z),
            ridgeDirection: resolveRoofRidgeDirection(visibleCorners, ridgeDirectionHint),
            corrugationRepeatPerMeter: params.corrugationRepeatPerMeter,
            swapCorrugationAxis: params.swapCorrugationAxis,
          }),
        )
      : params.trackGeometry(
          (() => {
            const positions: number[] = [];
            for (const corner of visibleCorners) {
              positions.push(corner.x, params.slabTopMeters + corner.y, corner.z);
            }
            const indices = plane.corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            return geometry;
          })(),
        );
    group.add(new THREE.Mesh(topGeometry, params.material));
    const eavePair = resolveRoofPlaneEavePair({
      corners: visibleCorners,
      referencePerimeter: sheetReferencePerimeter,
    });
    if (eavePair) {
      const lipGeometry = params.trackGeometry(
        createRoofSheetEaveLipGeometry({
          corners: visibleCorners,
          eavePair,
          planeNormal,
          slabTopMeters: params.slabTopMeters,
          thicknessMeters: Math.max(CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS, 0.012),
        }),
      );
      group.add(new THREE.Mesh(lipGeometry, params.material));
    }
  }

  if (params.resolvedRoof.gableEndRoofingClosures.length > 0) {
    const gableEndRoofingClosureGroup = new THREE.Group();
    gableEndRoofingClosureGroup.name = 'gableEndRoofingClosureGroup';
    for (const closure of params.resolvedRoof.gableEndRoofingClosures) {
      if (closure.corners.length < 3) continue;
      const closureGeometry = params.trackGeometry(
        createVerticalCladdingGeometry({
          corners: closure.corners,
          slabTopMeters: params.slabTopMeters,
          corrugationRepeatPerMeter: params.corrugationRepeatPerMeter,
        }),
      );
      gableEndRoofingClosureGroup.add(new THREE.Mesh(closureGeometry, params.material));
    }
    group.add(gableEndRoofingClosureGroup);
  }

  return group;
}

export function buildSteelTrussSceneGroups(params: {
  resolvedRoof: ResolvedRoofSystem;
  roofSystem: RoofSystemSettings;
  slabTopMeters: number;
  materials: {
    chord: THREE.Material;
    web: THREE.Material;
    plate: THREE.Material;
    bolt: THREE.Material;
  };
  debugGuides: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial?: TrackMaterial;
}): {
  trussChordGroup: THREE.Group;
  trussWebGroup: THREE.Group;
  basePlateGroup: THREE.Group;
  anchorBoltGroup: THREE.Group;
  framingGuideGroup: THREE.Group;
} {
  const trussChordGroup = new THREE.Group();
  trussChordGroup.name = 'trussChordGroup';
  const trussWebGroup = new THREE.Group();
  trussWebGroup.name = 'trussWebGroup';
  const basePlateGroup = new THREE.Group();
  basePlateGroup.name = 'basePlateGroup';
  const anchorBoltGroup = new THREE.Group();
  anchorBoltGroup.name = 'anchorBoltGroup';
  const framingGuideGroup = new THREE.Group();
  framingGuideGroup.name = 'framingGuideGroup';

  for (const placement of params.resolvedRoof.trussPlacements) {
    const { chordMeshes, webMeshes } = buildSteelTrussMemberMeshes({
      placement,
      slabOffsetY: params.slabTopMeters,
      materials: { chord: params.materials.chord, web: params.materials.web },
      debugGuides: params.debugGuides,
    });
    for (const mesh of chordMeshes) {
      params.trackGeometry(mesh.geometry);
      trussChordGroup.add(mesh);
    }
    for (const mesh of webMeshes) {
      params.trackGeometry(mesh.geometry);
      trussWebGroup.add(mesh);
    }
    if (params.roofSystem.steelTrusses.basePlateEnabled) {
      const plateBearings = [
        {
          structuralBearing: placement.bearingLeft,
          plateCenter: placement.basePlateCenterLeft ?? placement.bearingLeft,
          oppositeBearing: placement.bearingRight,
        },
        {
          structuralBearing: placement.bearingRight,
          plateCenter: placement.basePlateCenterRight ?? placement.bearingRight,
          oppositeBearing: placement.bearingLeft,
        },
      ];
      for (const { structuralBearing, plateCenter, oppositeBearing } of plateBearings) {
        const spanDirection = new THREE.Vector3(
          oppositeBearing.x - structuralBearing.x,
          0,
          oppositeBearing.z - structuralBearing.z,
        );
        const bearingWorld = new THREE.Vector3(
          plateCenter.x,
          params.slabTopMeters + plateCenter.y,
          plateCenter.z,
        );
        const plate = buildTrussBasePlateMesh({
          bearing: bearingWorld,
          settings: params.roofSystem,
          spanDirection,
          material: params.materials.plate,
        });
        params.trackGeometry(plate.geometry);
        basePlateGroup.add(plate);
        if (params.roofSystem.steelTrusses.anchorBoltsPerBearing > 0) {
          const bolts = buildTrussAnchorBoltMeshes({
            bearing: bearingWorld,
            settings: params.roofSystem,
            spanDirection,
            material: params.materials.bolt,
          });
          for (const bolt of bolts) {
            params.trackGeometry(bolt.geometry);
            anchorBoltGroup.add(bolt);
          }
        }
      }
    }
    if (params.debugGuides) {
      const guide = buildTrussPlaneGuide({
        placement,
        slabOffsetY: params.slabTopMeters,
      });
      guide.userData.explicitHelperMarker = true;
      params.trackGeometry(guide.geometry);
      params.trackMaterial?.(guide.material as THREE.Material);
      framingGuideGroup.add(guide);
    }
  }

  return {
    trussChordGroup,
    trussWebGroup,
    basePlateGroup,
    anchorBoltGroup,
    framingGuideGroup,
  };
}

export function buildPurlinSceneGroups(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  debugContactGuides: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial?: TrackMaterial;
}): {
  purlinGroup: THREE.Group;
  framingGuideGroup: THREE.Group;
} {
  const purlinGroup = new THREE.Group();
  purlinGroup.name = 'purlinGroup';
  const framingGuideGroup = new THREE.Group();
  framingGuideGroup.name = 'framingGuideGroup';

  for (const purlin of params.resolvedRoof.purlinPlacements) {
    const mesh = buildPurlinMesh({
      start: new THREE.Vector3(
        purlin.start.x,
        params.slabTopMeters + purlin.start.y,
        purlin.start.z,
      ),
      end: new THREE.Vector3(
        purlin.end.x,
        params.slabTopMeters + purlin.end.y,
        purlin.end.z,
      ),
      planeNormal: new THREE.Vector3(
        purlin.planeNormal.x,
        purlin.planeNormal.y,
        purlin.planeNormal.z,
      ),
      material: params.material,
      profile: purlin.rowIndex === 0 ? 'vertical_eave' : 'roof_normal',
    });
    params.trackGeometry(mesh.geometry);
    purlinGroup.add(mesh);
  }

  if (
    params.debugContactGuides &&
    params.resolvedRoof.trussPlacements.length > 0 &&
    params.resolvedRoof.purlinPlacements.length > 0
  ) {
    const samplePurlin =
      params.resolvedRoof.purlinPlacements.find((purlin) => purlin.rowIndex > 0) ??
      params.resolvedRoof.purlinPlacements[0]!;
    const sampleTruss =
      params.resolvedRoof.trussPlacements[Math.floor(params.resolvedRoof.trussPlacements.length / 2)]!;
    const topLeft = sampleTruss.members.find((member) => member.memberKind === 'top_chord_left');
    if (topLeft) {
      const normal = normalizeOutwardRoofNormal(samplePurlin.planeNormal);
      const chordCenter = {
        x: (topLeft.start.x + topLeft.end.x) / 2,
        y: (topLeft.start.y + topLeft.end.y) / 2,
        z: (topLeft.start.z + topLeft.end.z) / 2,
      };
      const chordTop = resolveTrussTopChordUpperPoint({ chordCenter, outwardNormal: normal });
      const purlinCenter = {
        x: (samplePurlin.start.x + samplePurlin.end.x) / 2,
        y: (samplePurlin.start.y + samplePurlin.end.y) / 2,
        z: (samplePurlin.start.z + samplePurlin.end.z) / 2,
      };
      const purlinTop = offsetPointAlongRoofNormal(purlinCenter, normal, PURLIN_PROFILE_DEPTH_METERS / 2);
      const displayPlane =
        params.resolvedRoof.claddingDisplayPlanes.find(
          (plane) => plane.id === `${samplePurlin.slopePlaneId}-cladding-display`,
        ) ?? params.resolvedRoof.claddingDisplayPlanes[0];
      let renderedSheetUnderside = offsetPointAlongRoofNormal(
        purlinTop,
        normal,
        PURLIN_TO_SHEET_CLEARANCE_METERS,
      );
      if (displayPlane) {
        const displayTopY = elevationOnRoofPlaneAtPoint(displayPlane, purlinCenter.x, purlinCenter.z);
        if (displayTopY != null) {
          renderedSheetUnderside = offsetPointAlongRoofNormal(
            { x: purlinCenter.x, y: displayTopY, z: purlinCenter.z },
            normal,
            -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
          );
        }
      }
      const addContactLine = (
        from: { x: number; y: number; z: number },
        to: { x: number; y: number; z: number },
        color: number,
      ) => {
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
        params.trackMaterial?.(material);
        const geometry = params.trackGeometry(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(from.x, params.slabTopMeters + from.y, from.z),
            new THREE.Vector3(to.x, params.slabTopMeters + to.y, to.z),
          ]),
        );
        const line = new THREE.Line(geometry, material);
        line.userData.explicitHelperMarker = true;
        framingGuideGroup.add(line);
      };
      const chordGap = distanceAlongRoofNormal(
        offsetPointAlongRoofNormal(purlinCenter, normal, -PURLIN_PROFILE_DEPTH_METERS / 2),
        chordTop,
        normal,
      );
      const sheetGap = distanceAlongRoofNormal(purlinTop, renderedSheetUnderside, normal);
      addContactLine(chordTop, purlinCenter, chordGap < -0.001 || chordGap > 0.003 ? 0xff0000 : 0xffff00);
      addContactLine(purlinTop, renderedSheetUnderside, sheetGap < 0 || sheetGap > 0.006 ? 0xff0000 : 0xffa500);
    }
  }

  return { purlinGroup, framingGuideGroup };
}

export function buildHipFramingSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trussChordGroup';

  for (const member of params.resolvedRoof.hipFramingMembers) {
    const mesh = buildHipMemberMesh(
      new THREE.Vector3(
        member.start.x,
        params.slabTopMeters + member.start.y,
        member.start.z,
      ),
      new THREE.Vector3(
        member.end.x,
        params.slabTopMeters + member.end.y,
        member.end.z,
      ),
      params.material,
    );
    params.trackGeometry(mesh.geometry);
    group.add(mesh);
  }

  return group;
}

export function buildRidgeCapSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ridgeCapGroup';
  const ridgeCapPlacements =
    params.resolvedRoof.ridgeCapPlacements.length > 0
      ? params.resolvedRoof.ridgeCapPlacements
      : params.resolvedRoof.ridgeCapPlacement
        ? [params.resolvedRoof.ridgeCapPlacement]
        : [];

  for (const ridgeCapPlacement of ridgeCapPlacements) {
    const capStart = new THREE.Vector3(
      ridgeCapPlacement.start.x,
      params.slabTopMeters + ridgeCapPlacement.start.y,
      ridgeCapPlacement.start.z,
    );
    const capEnd = new THREE.Vector3(
      ridgeCapPlacement.end.x,
      params.slabTopMeters + ridgeCapPlacement.end.y,
      ridgeCapPlacement.end.z,
    );
    const capAdjacentPlanes =
      params.resolvedRoof.roofType === 'hip'
        ? (ridgeCapPlacement.adjacentPlaneIds ?? [])
            .map((planeId) => {
              const displayPlane =
                params.resolvedRoof.claddingDisplayPlanes.find(
                  (plane) => plane.id.replace(/-cladding-display$/, '') === planeId,
                ) ?? params.resolvedRoof.roofTopPlanes.find((plane) => plane.id === planeId);
              return displayPlane
                ? {
                    normal: new THREE.Vector3(
                      displayPlane.normal.x,
                      displayPlane.normal.y,
                      displayPlane.normal.z,
                    ),
                    corners: displayPlane.corners.map(
                      (corner) =>
                        new THREE.Vector3(
                          corner.x,
                          params.slabTopMeters + corner.y,
                          corner.z,
                        ),
                    ),
                  }
                : null;
            })
            .filter((plane): plane is { normal: THREE.Vector3; corners: THREE.Vector3[] } => plane != null)
        : [];
    const ridgeCap =
      params.resolvedRoof.roofType === 'hip' && capAdjacentPlanes.length > 0
        ? createFoldedRoofEdgeCapGroup({
            start: capStart,
            end: capEnd,
            capWidthMeters: ridgeCapPlacement.widthMeters,
            capThicknessMeters: ridgeCapPlacement.thicknessMeters,
            material: params.material,
            adjacentPlanes: capAdjacentPlanes,
            miterBottomEnds: true,
          })
        : createFoldedRidgeCapGroup(
            capStart,
            capEnd,
            ridgeCapPlacement.widthMeters,
            ridgeCapPlacement.thicknessMeters,
            ridgeCapPlacement.roofAngleRadians,
            params.material,
          );
    ridgeCap.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        params.trackGeometry(child.geometry);
      }
    });
    group.add(ridgeCap);
  }

  return group;
}

export function buildFasciaSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fasciaGroup';

  for (const placement of params.resolvedRoof.fasciaPlacements) {
    const mesh = new THREE.Mesh(
      params.trackGeometry(createFasciaTrimGeometry({
        placement,
        slabTopMeters: params.slabTopMeters,
      })),
      params.material,
    );
    mesh.userData.fasciaEdgeRole = placement.edgeRole;
    group.add(mesh);
  }

  return group;
}

export function buildSoffitSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'soffitGroup';

  for (const placement of params.resolvedRoof.soffitPlacements) {
    const mesh = new THREE.Mesh(
      params.trackGeometry(createSoffitPanelGeometry({
        placement,
        slabTopMeters: params.slabTopMeters,
      })),
      params.material,
    );
    mesh.userData.soffitEdgeRole = placement.edgeRole;
    group.add(mesh);
  }

  return group;
}

export function buildGableRidgeGuideSceneGroup(params: {
  resolvedRoof: ResolvedRoofSystem;
  slabTopMeters: number;
  trackGeometry: TrackGeometry;
  trackMaterial?: TrackMaterial;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'framingGuideGroup';
  if (
    params.resolvedRoof.roofType !== 'gable' ||
    !params.resolvedRoof.structuralRidgeStart ||
    !params.resolvedRoof.structuralRidgeEnd ||
    !params.resolvedRoof.claddingRidgeStart ||
    !params.resolvedRoof.claddingRidgeEnd
  ) {
    return group;
  }

  const peakY = params.resolvedRoof.roofPeakY;
  const addGuideLine = (start: THREE.Vector3, end: THREE.Vector3, color: number) => {
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    params.trackMaterial?.(material);
    const geometry = params.trackGeometry(new THREE.BufferGeometry().setFromPoints([start, end]));
    const line = new THREE.Line(geometry, material);
    line.userData.explicitHelperMarker = true;
    group.add(line);
  };
  const ridgeSpan = Math.hypot(
    params.resolvedRoof.claddingRidgeEnd.x - params.resolvedRoof.claddingRidgeStart.x,
    params.resolvedRoof.claddingRidgeEnd.z - params.resolvedRoof.claddingRidgeStart.z,
  );
  const ridgeUx =
    ridgeSpan > 0
      ? (params.resolvedRoof.claddingRidgeEnd.x - params.resolvedRoof.claddingRidgeStart.x) / ridgeSpan
      : 1;
  const ridgeUz =
    ridgeSpan > 0
      ? (params.resolvedRoof.claddingRidgeEnd.z - params.resolvedRoof.claddingRidgeStart.z) / ridgeSpan
      : 0;
  const spanPerpX = -ridgeUz;
  const spanPerpZ = ridgeUx;
  const spanHalf = params.resolvedRoof.rafterRunMeters;
  for (const [point, color] of [
    [params.resolvedRoof.structuralRidgeStart, 0x14b8a6],
    [params.resolvedRoof.structuralRidgeEnd, 0x14b8a6],
    [params.resolvedRoof.claddingRidgeStart, 0xeab308],
    [params.resolvedRoof.claddingRidgeEnd, 0xeab308],
  ] as const) {
    addGuideLine(
      new THREE.Vector3(
        point.x + spanPerpX * spanHalf,
        params.slabTopMeters + peakY,
        point.z + spanPerpZ * spanHalf,
      ),
      new THREE.Vector3(
        point.x - spanPerpX * spanHalf,
        params.slabTopMeters + peakY,
        point.z - spanPerpZ * spanHalf,
      ),
      color,
    );
  }

  return group;
}

export function buildRakedCapSceneGroup(params: {
  placements: readonly RakedCapPlacement[];
  frameBySegmentId: ReadonlyMap<string, SegmentFrame>;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'rakedCapGroup';
  const capsByStrip = new Map<string, RakedCapPlacement[]>();

  for (const cap of params.placements) {
    const key = `${cap.gableEndSegmentId}:${cap.slope}`;
    const stripCaps = capsByStrip.get(key) ?? [];
    stripCaps.push(cap);
    capsByStrip.set(key, stripCaps);
  }

  for (const caps of capsByStrip.values()) {
    const frame = params.frameBySegmentId.get(caps[0]!.gableEndSegmentId);
    if (!frame) continue;
    const sortedCaps = [...caps].sort(
      (left, right) => left.startStationMeters - right.startStationMeters,
    );
    const strip = buildRakedCapStripRenderSegments(sortedCaps);
    if (!strip || strip.segments.length === 0) continue;

    const firstCap = sortedCaps[0]!;
    const layoutStart = resolveSegmentWallLayoutStart(frame);
    const startX = layoutStart.x + frame.tangent.x * strip.startStationMeters;
    const startZ = layoutStart.z + frame.tangent.z * strip.startStationMeters;
    const capCenterOffsetMeters =
      firstCap.wallDepthMeters / 2 + (firstCap.centerlineInwardOffsetMeters ?? 0);
    const mesh = new THREE.Mesh(
      params.trackGeometry(createRakedCapStripGeometry(strip.segments)),
      params.material,
    );
    mesh.position.set(
      startX + frame.inwardNormal.x * capCenterOffsetMeters,
      params.slabTopMeters,
      startZ + frame.inwardNormal.z * capCenterOffsetMeters,
    );
    mesh.rotation.y = frame.rotationY;
    group.add(mesh);
  }

  return group;
}
