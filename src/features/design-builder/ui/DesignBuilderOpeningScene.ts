import * as THREE from 'three';
import {
  createOpeningRenderGroups,
  populateOpeningAssemblyRenderGroups,
} from '../domain/openingAssembly3dRender';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import type { CmuLayoutResult } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignObjectType,
} from '../types';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type MakeMaterial = (
  color: number,
  selected: boolean,
  options?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

export interface OpeningSceneResult {
  lintelGroup: THREE.Group;
  frameGroup: THREE.Group;
  groutCellGroup: THREE.Group;
  roughOpeningGuideGroup: THREE.Group;
  closureWarningGroup: THREE.Group;
  selectableObjects: THREE.Object3D[];
}

function openingInfillOffsetMap(
  resolvedInfillPanelBounds?: readonly ResolvedInfillPanelBounds[],
): Map<string, number> {
  const boundsBySegmentId = new Map<
    string,
    {
      bottomElevationMeters: number;
      infillCenterlineInwardOffsetMeters: number;
    }
  >();
  (resolvedInfillPanelBounds ?? []).forEach((bounds) => {
    const existing = boundsBySegmentId.get(bounds.hostSegmentId);
    if (!existing || bounds.bottomElevationMeters > existing.bottomElevationMeters) {
      boundsBySegmentId.set(bounds.hostSegmentId, bounds);
    }
  });
  return new Map(
    [...boundsBySegmentId].map(([segmentId, bounds]) => [
      segmentId,
      bounds.infillCenterlineInwardOffsetMeters,
    ]),
  );
}

function markSelectable(
  object: THREE.Object3D,
  objectType: DesignObjectType,
  selectionPriority: number,
  openingId?: string,
): THREE.Object3D {
  object.userData.selectable = true;
  object.userData.designObjectType = objectType;
  object.userData.selectionPriority = selectionPriority;
  if (openingId) object.userData.openingId = openingId;
  return object;
}

function openingObjectType(openingType?: string): DesignObjectType {
  return openingType === 'door' ? 'door_opening' : 'window_opening';
}

export function buildOpeningClosureWarningSceneGroup(params: {
  cmuLayout: Pick<CmuLayoutResult, 'openingCourseClosures'>;
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  material: THREE.Material;
  trackGeometry: TrackGeometry;
}): { group: THREE.Group; selectableObjects: THREE.Object3D[] } {
  const group = new THREE.Group();
  group.name = 'openingClosureWarningGroup';
  const selectableObjects: THREE.Object3D[] = [];
  params.cmuLayout.openingCourseClosures
    .filter((closure) => closure.closureType === 'cut_block' || closure.closureType === 'grout_fill')
    .forEach((closure) => {
      const wallLength =
        closure.wallFace === 'north' || closure.wallFace === 'south'
          ? params.wall.lengthMeters
          : params.wall.widthMeters;
      const centeredAlong = closure.roughOpeningEdge - wallLength / 2;
      const x =
        closure.wallFace === 'east'
          ? params.wall.lengthMeters / 2
          : closure.wallFace === 'west'
            ? -params.wall.lengthMeters / 2
            : centeredAlong;
      const z =
        closure.wallFace === 'north'
          ? -params.wall.widthMeters / 2
          : closure.wallFace === 'south'
            ? params.wall.widthMeters / 2
            : centeredAlong;
      const marker = new THREE.Mesh(
        params.trackGeometry(
          new THREE.BoxGeometry(
            Math.max(0.035, closure.residualGap),
            params.wall.blockHeightMeters * 0.5,
            params.wall.wallThicknessMeters + 0.1,
          ),
        ),
        params.material,
      );
      marker.name = `openingClosureWarning:${closure.openingId}:${closure.courseIndex}:${closure.side}`;
      marker.position.set(
        x,
        params.slabTopMeters + (closure.courseBottom + closure.courseTop) / 2,
        z,
      );
      marker.rotation.y = closure.wallFace === 'east' || closure.wallFace === 'west' ? Math.PI / 2 : 0;
      marker.userData.explicitHelperMarker = true;
      markSelectable(marker, 'cmu_wall_system', 5);
      selectableObjects.push(marker);
      group.add(marker);
    });
  return { group, selectableObjects };
}

export function buildOpeningSceneGroups(params: {
  cmuLayout: Pick<
    CmuLayoutResult,
    | 'roughOpenings'
    | 'lintels'
    | 'groutFillPlacements'
    | 'segmentFrames'
    | 'openingCourseClosures'
  >;
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  showGroutCells: boolean;
  showOpeningLayout: boolean;
  showClosureWarnings: boolean;
  selectedOpeningId?: string | null;
  hoveredOpeningId?: string | null;
  resolvedInfillPanelBounds?: readonly ResolvedInfillPanelBounds[];
  trackGeometry: TrackGeometry;
  makeMaterial: MakeMaterial;
  resolveLintelMaterial?: () => THREE.MeshStandardMaterial;
}): OpeningSceneResult {
  const openingRenderGroups = createOpeningRenderGroups();
  populateOpeningAssemblyRenderGroups(openingRenderGroups, {
    cmuLayout: params.cmuLayout,
    wall: params.wall,
    slabTopMeters: params.slabTopMeters,
    showGroutCells: params.showGroutCells,
    showOpeningLayout: params.showOpeningLayout,
    selectedOpeningId: params.selectedOpeningId,
    hoveredOpeningId: params.hoveredOpeningId,
    trackGeometry: params.trackGeometry,
    makeMaterial: params.makeMaterial,
    infillCenterlineOffsetBySegmentId: openingInfillOffsetMap(params.resolvedInfillPanelBounds),
    resolveLintelMaterial: params.resolveLintelMaterial,
  });

  const selectableObjects: THREE.Object3D[] = [];
  openingRenderGroups.frameGroup.children.forEach((openingGroup) => {
    const openingId = openingGroup.userData.openingId as string | undefined;
    if (!openingId) return;
    const opening = params.cmuLayout.roughOpenings.find((candidate) => candidate.id === openingId);
    selectableObjects.push(
      markSelectable(openingGroup, openingObjectType(opening?.type), 100, openingId),
    );
  });
  openingRenderGroups.lintelGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.lintelSolid) {
      selectableObjects.push(markSelectable(child, 'cmu_wall_system', 40));
    }
  });
  if (params.showGroutCells) {
    openingRenderGroups.groutCellGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.groutSolid) {
        selectableObjects.push(markSelectable(child, 'cmu_wall_system', 10));
      }
    });
  }

  const closureWarning = params.showClosureWarnings
    ? buildOpeningClosureWarningSceneGroup({
        cmuLayout: params.cmuLayout,
        wall: params.wall,
        slabTopMeters: params.slabTopMeters,
        material: params.makeMaterial(0xf59e0b, true, { transparent: true, opacity: 0.86 }),
        trackGeometry: params.trackGeometry,
      })
    : { group: new THREE.Group(), selectableObjects: [] };
  closureWarning.group.name = 'openingClosureWarningGroup';
  selectableObjects.push(...closureWarning.selectableObjects);

  return {
    lintelGroup: openingRenderGroups.lintelGroup,
    frameGroup: openingRenderGroups.frameGroup,
    groutCellGroup: openingRenderGroups.groutCellGroup,
    roughOpeningGuideGroup: openingRenderGroups.roughOpeningGuideGroup,
    closureWarningGroup: closureWarning.group,
    selectableObjects,
  };
}
