import * as THREE from 'three';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import { createOpeningFrame3dGroup } from '../domain/openingFrame3dGraphics';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import type { ResolvedOpeningPlacement } from '../domain/openingPlacementResolver';
import type { SegmentFrame } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  WallOpeningParameters,
} from '../types';

export interface DesignBuilderPlacementPreview {
  wallFace: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters: number;
  positionAlongSegment?: number;
  openingType: WallOpeningParameters['type'];
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  openingId?: string;
  wallSegmentId?: string;
  wallRotationY?: number;
  frameOrigin?: { x: number; y: number; z: number };
  hitPoint?: { x: number; y?: number; z: number };
  openingDraft?: WallOpeningParameters;
  resolvedPlacement?: ResolvedOpeningPlacement;
}

type PreviewResolvedOpening = ResolvedCmuOpening & {
  wallSegmentId?: string;
  worldX?: number;
  worldZ?: number;
  rotationY?: number;
  placementStatusKind?: DesignBuilderPlacementPreview['statusKind'];
};

type PreviewHostSegmentFrame = Pick<
  SegmentFrame,
  'segmentId' | 'centerlineStart' | 'tangent' | 'inwardNormal' | 'rotationY'
> & {
  infillCenterlineInwardOffsetMeters?: number;
};

export function resolveOpeningPlacementPreviewOpening(params: {
  preview: DesignBuilderPlacementPreview;
  wall: CmuWallSystemParameters;
}): PreviewResolvedOpening {
  const { preview, wall } = params;
  const roughAllowance = preview.openingDraft?.roughOpeningAllowanceMeters ?? 0.05;
  const roughWidth =
    preview.openingDraft?.roughOpeningWidthMeters ??
    preview.widthMeters + roughAllowance * 2;
  const roughHeight =
    preview.openingDraft?.roughOpeningHeightMeters ??
    preview.heightMeters + roughAllowance * 2;
  const centerStation =
    preview.positionAlongSegment ?? preview.offsetMeters + preview.widthMeters / 2;
  const sillHeight = preview.openingType === 'door' ? 0 : preview.sillHeightMeters ?? 0;
  const roughBottomMeters =
    preview.openingType === 'door'
      ? 0
      : Math.max(0, sillHeight - (roughHeight - preview.heightMeters) / 2);
  const lintelBearingMeters =
    preview.openingDraft?.lintelBearingMeters ?? wall.lintelBearingMeters ?? 0.2;
  const lintelCourseCount =
    preview.openingDraft?.lintelCourseCount ?? wall.lintelCourseCount ?? 1;
  const opening: PreviewResolvedOpening = {
    id: preview.openingId ?? 'preview',
    type: preview.openingType,
    wallFace: preview.wallFace,
    wallSegmentId: preview.wallSegmentId,
    actualWidthMeters: preview.widthMeters,
    actualHeightMeters: preview.heightMeters,
    actualAreaSquareMeters: preview.widthMeters * preview.heightMeters,
    roughOpeningWidthMeters: roughWidth,
    roughOpeningHeightMeters: roughHeight,
    roughOpeningAreaSquareMeters: roughWidth * roughHeight,
    roughStartAlongMeters: centerStation - roughWidth / 2,
    roughEndAlongMeters: centerStation + roughWidth / 2,
    roughBottomMeters,
    roughTopMeters: roughBottomMeters + roughHeight,
    actualStartAlongMeters: centerStation - preview.widthMeters / 2,
    actualEndAlongMeters: centerStation + preview.widthMeters / 2,
    actualBottomMeters: sillHeight,
    actualTopMeters: sillHeight + preview.heightMeters,
    lintelType: preview.openingDraft?.lintelType ?? wall.lintelType ?? 'bond_beam',
    lintelBearingMeters,
    lintelCourseCount,
    lintelLengthMeters: roughWidth + lintelBearingMeters * 2,
    lintelHeightMeters: wall.blockHeightMeters * lintelCourseCount,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: 1,
    jambGroutCellCount: 2,
    groutCellsAboveOpening: 0,
    groutCellsBelowWindow: 0,
    openingFrameMaterial: preview.openingDraft?.openingFrameMaterial ?? 'none',
    placementStatusKind: preview.statusKind,
  };
  if (preview.frameOrigin && typeof preview.wallRotationY === 'number') {
    opening.worldX = preview.frameOrigin.x;
    opening.worldZ = preview.frameOrigin.z;
    opening.rotationY = preview.wallRotationY;
  }
  return opening;
}

export function resolveOpeningPlacementPreviewHostFrame(params: {
  preview: DesignBuilderPlacementPreview;
  segmentFrames?: readonly SegmentFrame[];
  resolvedInfillPanelBounds?: readonly ResolvedInfillPanelBounds[];
}): PreviewHostSegmentFrame | undefined {
  if (!params.preview.wallSegmentId) return undefined;
  const hostSegmentFrame = (params.segmentFrames ?? []).find(
    (segment) => segment.segmentId === params.preview.wallSegmentId,
  );
  if (!hostSegmentFrame) return undefined;
  const infillCenterlineOffset =
    params.resolvedInfillPanelBounds
      ?.filter((bounds) => !bounds.panelId.includes('-below-'))
      .find((bounds) => bounds.hostSegmentId === params.preview.wallSegmentId)
      ?.infillCenterlineInwardOffsetMeters ?? 0;
  return {
    ...hostSegmentFrame,
    infillCenterlineInwardOffsetMeters: infillCenterlineOffset,
  };
}

export function buildOpeningPlacementPreviewSceneGroup(params: {
  preview: DesignBuilderPlacementPreview;
  wall: CmuWallSystemParameters;
  slabTopMeters: number;
  segmentFrames?: readonly SegmentFrame[];
  resolvedInfillPanelBounds?: readonly ResolvedInfillPanelBounds[];
  selectedOpeningId?: string | null;
  showOpeningLayout?: boolean;
}): THREE.Group {
  const opening = resolveOpeningPlacementPreviewOpening({
    preview: params.preview,
    wall: params.wall,
  });
  const hostSegmentFrame = resolveOpeningPlacementPreviewHostFrame({
    preview: params.preview,
    segmentFrames: params.segmentFrames,
    resolvedInfillPanelBounds: params.resolvedInfillPanelBounds,
  });
  const frame = createOpeningFrame3dGroup(opening, params.wall, params.slabTopMeters, {
    preview: true,
    valid: params.preview.isValid,
    selected: Boolean(
      params.preview.openingId && params.preview.openingId === params.selectedOpeningId,
    ),
    showOpeningLayout: params.showOpeningLayout ?? false,
    hostSegmentFrame,
  });
  frame.renderOrder = 10;
  return frame;
}
