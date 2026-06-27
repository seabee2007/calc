import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import {
  buildOpeningPlacementPreviewSceneGroup,
  type DesignBuilderPlacementPreview,
  resolveOpeningPlacementPreviewHostFrame,
  resolveOpeningPlacementPreviewOpening,
} from '../ui/DesignBuilderOpeningPreviewScene';

function preview(
  partial: Partial<DesignBuilderPlacementPreview> = {},
): DesignBuilderPlacementPreview {
  return {
    wallFace: partial.wallFace ?? 'north',
    offsetMeters: partial.offsetMeters ?? 1.5,
    positionAlongSegment: partial.positionAlongSegment,
    openingType: partial.openingType ?? 'window',
    widthMeters: partial.widthMeters ?? 1,
    heightMeters: partial.heightMeters ?? 1,
    sillHeightMeters: partial.sillHeightMeters ?? 1,
    isValid: partial.isValid ?? true,
    statusKind: partial.statusKind ?? 'clean',
    openingId: partial.openingId,
    wallSegmentId: partial.wallSegmentId,
    wallRotationY: partial.wallRotationY,
    frameOrigin: partial.frameOrigin,
    hitPoint: partial.hitPoint,
    openingDraft: partial.openingDraft,
    resolvedPlacement: partial.resolvedPlacement,
  };
}

function panelBounds(
  partial: Partial<ResolvedInfillPanelBounds> = {},
): ResolvedInfillPanelBounds {
  return {
    panelId: partial.panelId ?? 'panel-1',
    hostSegmentId: partial.hostSegmentId ?? 'segment-1',
    startStationMeters: partial.startStationMeters ?? 0,
    endStationMeters: partial.endStationMeters ?? 6,
    clearWidthMeters: partial.clearWidthMeters ?? 6,
    bottomElevationMeters: partial.bottomElevationMeters ?? 0,
    topElevationMeters: partial.topElevationMeters ?? 2.8,
    clearHeightMeters: partial.clearHeightMeters ?? 2.8,
    infillCenterlineInwardOffsetMeters: partial.infillCenterlineInwardOffsetMeters,
    hostWallCenterlineStart: partial.hostWallCenterlineStart ?? { x: -3, y: 0, z: 0 },
    hostWallCenterlineEnd: partial.hostWallCenterlineEnd ?? { x: 3, y: 0, z: 0 },
    tangent: partial.tangent ?? { x: 1, y: 0, z: 0 },
    outwardNormal: partial.outwardNormal ?? { x: 0, y: 0, z: -1 },
    inwardNormal: partial.inwardNormal ?? { x: 0, y: 0, z: 1 },
    leftSupportInsideFaceWorld: partial.leftSupportInsideFaceWorld ?? { x: -3, y: 0, z: 0 },
    rightSupportInsideFaceWorld: partial.rightSupportInsideFaceWorld ?? { x: 3, y: 0, z: 0 },
    leftSupportInsideFaceStation: partial.leftSupportInsideFaceStation ?? 0,
    rightSupportInsideFaceStation: partial.rightSupportInsideFaceStation ?? 6,
  };
}

describe('DesignBuilderOpeningPreviewScene', () => {
  it('resolves placement preview dimensions into opening frame geometry inputs', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const opening = resolveOpeningPlacementPreviewOpening({
      wall: preset.wall,
      preview: preview({
        openingId: 'window-preview',
        positionAlongSegment: 2,
        openingDraft: {
          id: 'draft-window',
          type: 'window',
          wallFace: 'north',
          widthMeters: 1,
          heightMeters: 1,
          sillHeightMeters: 1,
          roughOpeningAllowanceMeters: 0.1,
          lintelBearingMeters: 0.25,
          lintelCourseCount: 2,
          openingFrameMaterial: 'vinyl',
        },
      }),
    });

    expect(opening.id).toBe('window-preview');
    expect(opening.actualStartAlongMeters).toBeCloseTo(1.5, 6);
    expect(opening.actualEndAlongMeters).toBeCloseTo(2.5, 6);
    expect(opening.roughOpeningWidthMeters).toBeCloseTo(1.2, 6);
    expect(opening.roughStartAlongMeters).toBeCloseTo(1.4, 6);
    expect(opening.roughBottomMeters).toBeCloseTo(0.9, 6);
    expect(opening.roughTopMeters).toBeCloseTo(2.1, 6);
    expect(opening.lintelLengthMeters).toBeCloseTo(1.7, 6);
    expect(opening.lintelHeightMeters).toBeCloseTo(preset.wall.blockHeightMeters * 2, 6);
    expect(opening.openingFrameMaterial).toBe('vinyl');
  });

  it('uses the non-below infill panel offset for segment-hosted previews', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const [frame] = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    expect(frame).toBeTruthy();

    const hostFrame = resolveOpeningPlacementPreviewHostFrame({
      preview: preview({ wallSegmentId: frame!.segmentId }),
      segmentFrames: [frame!],
      resolvedInfillPanelBounds: [
        panelBounds({
          panelId: 'panel-below-1',
          hostSegmentId: frame!.segmentId,
          infillCenterlineInwardOffsetMeters: 0.02,
        }),
        panelBounds({
          panelId: 'panel-main',
          hostSegmentId: frame!.segmentId,
          infillCenterlineInwardOffsetMeters: 0.17,
        }),
      ],
    });

    expect(hostFrame?.segmentId).toBe(frame!.segmentId);
    expect(hostFrame?.infillCenterlineInwardOffsetMeters).toBeCloseTo(0.17, 6);
  });

  it('builds the preview frame at the hosted segment station', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const [frame] = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    expect(frame).toBeTruthy();
    const positionAlongSegment = 2.25;
    const infillCenterlineInwardOffsetMeters = 0.11;
    const group = buildOpeningPlacementPreviewSceneGroup({
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      selectedOpeningId: 'preview-1',
      showOpeningLayout: false,
      preview: preview({
        openingId: 'preview-1',
        wallSegmentId: frame!.segmentId,
        positionAlongSegment,
      }),
      segmentFrames: [frame!],
      resolvedInfillPanelBounds: [
        panelBounds({
          panelId: 'panel-main',
          hostSegmentId: frame!.segmentId,
          infillCenterlineInwardOffsetMeters,
        }),
      ],
    });

    expect(group.renderOrder).toBe(10);
    expect(group.children.length).toBeGreaterThan(0);
    expect(group.position.x).toBeCloseTo(
      frame!.centerlineStart.x +
        frame!.tangent.x * positionAlongSegment +
        frame!.inwardNormal.x * infillCenterlineInwardOffsetMeters,
      6,
    );
    expect(group.position.y).toBeCloseTo(preset.slab.slabThicknessMeters + 1.5, 6);
    expect(group.position.z).toBeCloseTo(
      frame!.centerlineStart.z +
        frame!.tangent.z * positionAlongSegment +
        frame!.inwardNormal.z * infillCenterlineInwardOffsetMeters,
      6,
    );
    expect(group.rotation.y).toBeCloseTo(frame!.rotationY, 6);
  });
});
