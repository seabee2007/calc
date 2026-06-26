import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { resolveOpeningFrameCenterWorld } from '../domain/openingFrame3dGraphics';
import { resolveInfillPlasterPanelPlacements } from '../domain/infillPlaster';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';

describe('opening frame alignment probe', () => {
  it('world position follows actual opening center when rough opening is module-asymmetric', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
        roofSystem: preset.roofSystem,
      }),
    );
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters + 0.01,
    ) as
      | (typeof geometry.wallCmuLayout.roughOpenings)[number] & {
          worldX?: number;
          worldZ?: number;
          wallSegmentId?: string;
        }
      | undefined;
    expect(opening).toBeTruthy();

    const frame = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall).find(
      (candidate) => candidate.segmentId === opening!.wallSegmentId,
    )!;
    const actualCenter = (opening!.actualStartAlongMeters + opening!.actualEndAlongMeters) / 2;
    const roughCenter = (opening!.roughStartAlongMeters + opening!.roughEndAlongMeters) / 2;
    const centerWorld = resolveOpeningFrameCenterWorld(opening!, frame);
    const worldStationOnCenterline =
      (centerWorld.x - frame.centerlineStart.x) * frame.tangent.x +
      (centerWorld.z - frame.centerlineStart.z) * frame.tangent.z;

    expect(Math.abs(worldStationOnCenterline - actualCenter)).toBeLessThan(0.002);
    expect(Math.abs(roughCenter - actualCenter)).toBeGreaterThan(0.01);

    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const bounds = (geometry.resolvedInfillPanelBounds ?? []).find(
      (candidate) => candidate.hostSegmentId === opening!.wallSegmentId,
    )!;
    const leftFieldEdge = placements
      .filter(
        (placement) =>
          placement.hostSegmentId === opening!.wallSegmentId &&
          placement.side === 'exterior' &&
          placement.surfaceKind === 'field',
      )
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds.hostWallCenterlineStart.x) * bounds.tangent.x +
          (placement.center.z - bounds.hostWallCenterlineStart.z) * bounds.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const end = centerStation + placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        if (
          bottom < opening!.actualTopMeters &&
          top > opening!.actualBottomMeters &&
          end <= opening!.actualStartAlongMeters + 0.001
        ) {
          return end;
        }
        return null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => right - left)[0];

    expect(leftFieldEdge).toBeCloseTo(opening!.actualStartAlongMeters, 3);
    expect(leftFieldEdge).toBeGreaterThan(opening!.roughStartAlongMeters + 0.01);
  });
});
