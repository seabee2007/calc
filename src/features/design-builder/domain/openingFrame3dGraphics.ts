import * as THREE from 'three';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import type { CmuWallSystemParameters } from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';

export const SELECTION_OUTLINE_EPSILON_METERS = 0.002;
export const FRAME_TRIM_METERS = 0.055;
export const RENDER_EPSILON_METERS = 0.001;
export const OPENING_FINISH_FACE_CLEARANCE_METERS = 0.012;
export const PREVIEW_FACE_BIAS_METERS = 0.012;
export const SELECTION_OUTLINE_COLOR = 0x22d3ee;
export const HOVER_OUTLINE_COLOR = 0x67e8f9;
export const ROUGH_OPENING_GUIDE_COLOR = 0xf59e0b;
export const ROUGH_OPENING_GUIDE_OPACITY = 0.72;
export const OPENING_UNIT_RENDER_ORDER = 3;
export const OPENING_FRAME_RENDER_ORDER = 4;
export const OPENING_OUTLINE_RENDER_ORDER = 5;
export const OPENING_GUIDE_RENDER_ORDER = 6;
export const OPENING_PREVIEW_RENDER_ORDER = 10;

export type OpeningFrameOutlineDimensions = {
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
};

export type RoughOpeningGuideDimensions = {
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
  offsetXMeters: number;
  offsetYMeters: number;
};

export type OpeningFrame3dVisibility = {
  showFrameMeshes: boolean;
  showSelectionOutline: boolean;
  showHoverOutline: boolean;
  showRoughOpeningGuide: boolean;
};

export function resolveOpeningFrameOutlineDimensions(
  opening: Pick<ResolvedCmuOpening, 'actualWidthMeters' | 'actualHeightMeters'>,
  wallThicknessMeters: number,
): OpeningFrameOutlineDimensions {
  return {
    widthMeters: opening.actualWidthMeters + FRAME_TRIM_METERS * 2,
    heightMeters: opening.actualHeightMeters + FRAME_TRIM_METERS * 2,
    depthMeters: resolveOpeningFrameRenderDepth(wallThicknessMeters),
  };
}

export function resolveOpeningFrameRenderDepth(wallThicknessMeters: number): number {
  return Math.max(0, wallThicknessMeters) + OPENING_FINISH_FACE_CLEARANCE_METERS * 2;
}

export function resolveRoughOpeningGuideDimensions(
  opening: Pick<
    ResolvedCmuOpening,
    | 'roughOpeningWidthMeters'
    | 'roughOpeningHeightMeters'
    | 'roughStartAlongMeters'
    | 'roughEndAlongMeters'
    | 'roughBottomMeters'
    | 'actualStartAlongMeters'
    | 'actualEndAlongMeters'
    | 'actualBottomMeters'
    | 'actualHeightMeters'
    | 'roughOpeningHeightMeters'
  >,
  wallThicknessMeters: number,
): RoughOpeningGuideDimensions {
  const actualCenterAlong = (opening.actualStartAlongMeters + opening.actualEndAlongMeters) / 2;
  const roughCenterAlong = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
  const actualCenterY = opening.actualBottomMeters + opening.actualHeightMeters / 2;
  const roughCenterY = opening.roughBottomMeters + opening.roughOpeningHeightMeters / 2;
  return {
    widthMeters: opening.roughOpeningWidthMeters,
    heightMeters: opening.roughOpeningHeightMeters,
    depthMeters: resolveOpeningFrameRenderDepth(wallThicknessMeters),
    offsetXMeters: roughCenterAlong - actualCenterAlong,
    offsetYMeters: roughCenterY - actualCenterY,
  };
}

export function resolveOpeningFrame3dVisibility(params: {
  selected: boolean;
  hovered: boolean;
  preview: boolean;
  showOpeningLayout: boolean;
}): OpeningFrame3dVisibility {
  if (params.preview) {
    return {
      showFrameMeshes: true,
      showSelectionOutline: true,
      showHoverOutline: false,
      showRoughOpeningGuide: params.showOpeningLayout,
    };
  }
  return {
    showFrameMeshes: true,
    showSelectionOutline: params.selected,
    showHoverOutline: params.hovered && !params.selected,
    showRoughOpeningGuide: params.showOpeningLayout && (params.selected || params.hovered),
  };
}

export function resolveOpeningFrameCenterWorld(
  opening: Pick<ResolvedCmuOpening, 'actualStartAlongMeters' | 'actualEndAlongMeters'>,
  hostSegmentFrame: Pick<SegmentFrame, 'centerlineStart' | 'tangent' | 'inwardNormal'> & {
    infillCenterlineInwardOffsetMeters?: number;
  },
): { x: number; z: number } {
  const actualCenterStation = (opening.actualStartAlongMeters + opening.actualEndAlongMeters) / 2;
  const infillCenterlineOffset = hostSegmentFrame.infillCenterlineInwardOffsetMeters ?? 0;
  return {
    x:
      hostSegmentFrame.centerlineStart.x +
      hostSegmentFrame.tangent.x * actualCenterStation +
      hostSegmentFrame.inwardNormal.x * infillCenterlineOffset,
    z:
      hostSegmentFrame.centerlineStart.z +
      hostSegmentFrame.tangent.z * actualCenterStation +
      hostSegmentFrame.inwardNormal.z * infillCenterlineOffset,
  };
}

export function createOpeningFrame3dGroup(
  opening: ResolvedCmuOpening,
  wall: CmuWallSystemParameters,
  slabTop: number,
  options?: {
    preview?: boolean;
    valid?: boolean;
    selected?: boolean;
    hovered?: boolean;
    showOpeningLayout?: boolean;
    hostSegmentFrame?: Pick<SegmentFrame, 'centerlineStart' | 'tangent' | 'inwardNormal' | 'rotationY'> & {
      infillCenterlineInwardOffsetMeters?: number;
    };
  },
): THREE.Group {
  const preview = options?.preview ?? false;
  const valid = options?.valid ?? true;
  const selected = options?.selected ?? false;
  const hovered = options?.hovered ?? false;
  const showOpeningLayout = options?.showOpeningLayout ?? false;
  const visibility = resolveOpeningFrame3dVisibility({ selected, hovered, preview, showOpeningLayout });

  const group = new THREE.Group();
  group.userData.openingFrameGroup = true;

  const previewStatus = preview
    ? (opening as ResolvedCmuOpening & { placementStatusKind?: string }).placementStatusKind
    : undefined;
  const previewColor = !valid ? 0xef4444 : previewStatus === 'cut_block' || previewStatus === 'half_block' ? 0xf59e0b : 0x22d3ee;

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: opening.type === 'door' ? 0x92400e : 0x2563eb,
    roughness: 0.55,
    metalness: 0.05,
    transparent: preview,
    opacity: preview ? 0.72 : 1,
    depthTest: !preview,
    depthWrite: false,
    polygonOffset: !preview,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  const unitMaterial = new THREE.MeshStandardMaterial({
    color: opening.type === 'door' ? 0x78350f : 0x60a5fa,
    roughness: 0.6,
    transparent: true,
    opacity: preview ? 0.28 : 0.42,
    depthTest: !preview,
    depthWrite: false,
    polygonOffset: !preview,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });

  const centerY = slabTop + opening.actualBottomMeters + opening.actualHeightMeters / 2;
  const actualWidth = opening.actualWidthMeters;
  const actualHeight = opening.actualHeightMeters;
  const depth = resolveOpeningFrameRenderDepth(wall.wallThicknessMeters);
  const frame = FRAME_TRIM_METERS;

  const frameGroup = new THREE.Group();
  frameGroup.userData.openingVisualFrame = true;
  frameGroup.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  if (preview) {
    frameGroup.position.z = PREVIEW_FACE_BIAS_METERS;
  }

  const horizontalGeom = new THREE.BoxGeometry(actualWidth + frame * 2, frame, depth + RENDER_EPSILON_METERS);
  const verticalGeom = new THREE.BoxGeometry(frame, actualHeight + frame * 2, depth + RENDER_EPSILON_METERS);
  const unitGeom = new THREE.BoxGeometry(actualWidth, actualHeight, depth + RENDER_EPSILON_METERS);

  const unitMesh = new THREE.Mesh(unitGeom, unitMaterial);
  unitMesh.position.set(0, 0, 0);
  unitMesh.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_UNIT_RENDER_ORDER;
  frameGroup.add(unitMesh);

  const topFrame = new THREE.Mesh(horizontalGeom, frameMaterial);
  topFrame.position.set(0, actualHeight / 2 + frame / 2, 0);
  topFrame.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  frameGroup.add(topFrame);

  const bottomFrame = new THREE.Mesh(horizontalGeom, frameMaterial);
  bottomFrame.position.set(0, -actualHeight / 2 - frame / 2, 0);
  bottomFrame.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  frameGroup.add(bottomFrame);

  const leftFrame = new THREE.Mesh(verticalGeom, frameMaterial);
  leftFrame.position.set(-actualWidth / 2 - frame / 2, 0, 0);
  leftFrame.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  frameGroup.add(leftFrame);

  const rightFrame = new THREE.Mesh(verticalGeom, frameMaterial);
  rightFrame.position.set(actualWidth / 2 + frame / 2, 0, 0);
  rightFrame.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  frameGroup.add(rightFrame);

  if (visibility.showFrameMeshes) {
    group.add(frameGroup);
  }

  if (visibility.showSelectionOutline || visibility.showHoverOutline) {
    const outlineDimensions = resolveOpeningFrameOutlineDimensions(opening, wall.wallThicknessMeters);
    const epsilon = SELECTION_OUTLINE_EPSILON_METERS;
    const outlineGeom = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        outlineDimensions.widthMeters + epsilon * 2,
        outlineDimensions.heightMeters + epsilon * 2,
        outlineDimensions.depthMeters + epsilon * 2,
      ),
    );
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: visibility.showSelectionOutline ? (preview ? previewColor : SELECTION_OUTLINE_COLOR) : HOVER_OUTLINE_COLOR,
      transparent: preview,
      opacity: preview ? 0.95 : 1,
      depthTest: !preview,
      depthWrite: false,
    });
    const outline = new THREE.LineSegments(outlineGeom, outlineMaterial);
    outline.userData.openingSelectionOutline = true;
    outline.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_OUTLINE_RENDER_ORDER;
    if (preview) {
      outline.position.z = PREVIEW_FACE_BIAS_METERS;
    }
    group.add(outline);
  }

  if (visibility.showRoughOpeningGuide) {
    addRoughOpeningGuideChildren(group, opening, wall.wallThicknessMeters);
  }

  positionOpeningFrameGroup(group, opening, wall, centerY, options?.hostSegmentFrame);
  group.renderOrder = preview ? OPENING_PREVIEW_RENDER_ORDER : OPENING_FRAME_RENDER_ORDER;
  return group;
}

export function createOpeningRoughOpeningGuideGroup(
  opening: ResolvedCmuOpening,
  wall: CmuWallSystemParameters,
  slabTop: number,
  hostSegmentFrame?: Pick<SegmentFrame, 'centerlineStart' | 'tangent' | 'inwardNormal' | 'rotationY'> & {
    infillCenterlineInwardOffsetMeters?: number;
  },
): THREE.Group {
  const group = new THREE.Group();
  group.userData.openingRoughOpeningGuideGroup = true;
  const centerY = slabTop + opening.actualBottomMeters + opening.actualHeightMeters / 2;
  addRoughOpeningGuideChildren(group, opening, wall.wallThicknessMeters);
  positionOpeningFrameGroup(group, opening, wall, centerY, hostSegmentFrame);
  group.renderOrder = OPENING_GUIDE_RENDER_ORDER;
  return group;
}

function addRoughOpeningGuideChildren(
  group: THREE.Group,
  opening: ResolvedCmuOpening,
  depth: number,
): void {
  const guide = resolveRoughOpeningGuideDimensions(opening, depth);
  const guideGeom = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(guide.widthMeters, guide.heightMeters, guide.depthMeters + RENDER_EPSILON_METERS),
  );
  guideGeom.computeBoundingSphere();
  const positions = guideGeom.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    positions.setX(index, positions.getX(index) + guide.offsetXMeters);
    positions.setY(index, positions.getY(index) + guide.offsetYMeters);
  }
  positions.needsUpdate = true;
  guideGeom.computeBoundingSphere();

  const guideMaterial = new THREE.LineDashedMaterial({
    color: ROUGH_OPENING_GUIDE_COLOR,
    transparent: true,
    opacity: ROUGH_OPENING_GUIDE_OPACITY,
    dashSize: 0.08,
    gapSize: 0.05,
    depthWrite: false,
  });
  const guideOutline = new THREE.LineSegments(guideGeom, guideMaterial);
  guideOutline.computeLineDistances();
  guideOutline.userData.openingRoughOpeningGuide = true;
  guideOutline.renderOrder = OPENING_GUIDE_RENDER_ORDER;
  group.add(guideOutline);

  const label = createRoughOpeningLabel(
    guideOutline.position.clone().set(guide.offsetXMeters, guide.offsetYMeters + guide.heightMeters / 2 + 0.12, 0),
  );
  group.add(label);
}

function positionOpeningFrameGroup(
  group: THREE.Group,
  opening: ResolvedCmuOpening,
  wall: CmuWallSystemParameters,
  centerY: number,
  hostSegmentFrame?: Pick<SegmentFrame, 'centerlineStart' | 'tangent' | 'inwardNormal' | 'rotationY'> & {
    infillCenterlineInwardOffsetMeters?: number;
  },
): void {
  const actualCenterStation = (opening.actualStartAlongMeters + opening.actualEndAlongMeters) / 2;
  const roughCenterStation = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
  const layoutOpening = opening as ResolvedCmuOpening & {
    worldX?: number;
    worldZ?: number;
    rotationY?: number;
    wallSegmentId?: string;
    id?: string;
  };

  if (hostSegmentFrame) {
    const centerWorld = resolveOpeningFrameCenterWorld(opening, hostSegmentFrame);
    group.position.set(centerWorld.x, centerY, centerWorld.z);
    group.rotation.y = hostSegmentFrame.rotationY;
    return;
  }

  const along = actualCenterStation;

  if (typeof layoutOpening.worldX === 'number' && typeof layoutOpening.worldZ === 'number') {
    group.position.set(layoutOpening.worldX, centerY, layoutOpening.worldZ);
    group.rotation.y = layoutOpening.rotationY ?? 0;
    return;
  }

  if (opening.wallFace === 'north' || opening.wallFace === 'south') {
    const x = along - wall.lengthMeters / 2;
    const z =
      opening.wallFace === 'north'
        ? -wall.widthMeters / 2 - RENDER_EPSILON_METERS
        : wall.widthMeters / 2 + RENDER_EPSILON_METERS;
    group.position.set(x, centerY, z);
    return;
  }

  const z = along - wall.widthMeters / 2;
  const x =
    opening.wallFace === 'east'
      ? wall.lengthMeters / 2 + RENDER_EPSILON_METERS
      : -wall.lengthMeters / 2 - RENDER_EPSILON_METERS;
  group.position.set(x, centerY, z);
  group.rotation.y = Math.PI / 2;
}

function createRoughOpeningLabel(localPosition: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();

  context.fillStyle = 'rgba(255, 251, 235, 0.92)';
  context.strokeStyle = 'rgba(245, 158, 11, 0.65)';
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(24, 30, 464, 68, 18);
  context.fill();
  context.stroke();
  context.fillStyle = '#92400e';
  context.font = '700 34px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Rough Opening', 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(localPosition);
  sprite.scale.set(0.95, 0.24, 1);
  sprite.userData.openingRoughOpeningLabel = true;
  sprite.renderOrder = 2;
  return sprite;
}

export function readOpeningFrameOutlineDimensionsFromGroup(group: THREE.Group): OpeningFrameOutlineDimensions | null {
  const outline = group.children.find(
    (child) => child instanceof THREE.LineSegments && child.userData.openingSelectionOutline,
  ) as THREE.LineSegments | undefined;
  if (!outline?.geometry) return null;
  const geometry = outline.geometry as THREE.EdgesGeometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return null;
  const size = box.getSize(new THREE.Vector3());
  return {
    widthMeters: size.x,
    heightMeters: size.y,
    depthMeters: size.z,
  };
}

export function groupHasRoughOpeningGuide(group: THREE.Group): boolean {
  return group.children.some((child) => child.userData.openingRoughOpeningGuide);
}

export function groupHasSelectionOutline(group: THREE.Group): boolean {
  return group.children.some((child) => child.userData.openingSelectionOutline);
}
