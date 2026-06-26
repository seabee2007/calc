import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { masonryTopEnvelopeYAtStation } from '../domain/rakedCapSolver';

describe('raked cap alignment with gable CMU steps', () => {
  it('does not extend step caps past supporting block coverage', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: {
        ...createDefaultRoofSystemSettings().gable,
        enabled: true,
        rakedConcreteCapEnabled: true,
      },
    };
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        foundationSettings: foundation,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
        roofSystem,
      }),
    );

    const gableSegmentId = geometry.resolvedRoofSystem!.gableEndSegmentIds[0]!;
    const gableBlocks = geometry.blockInstances.filter(
      (block) =>
        block.segmentId === gableSegmentId && block.source === 'gable_end_solver',
    );
    const caps = (geometry.rakedCapPlacements ?? []).filter(
      (cap) => cap.gableEndSegmentId === gableSegmentId,
    );

    const mismatches: Array<Record<string, number | string>> = [];
    for (const cap of caps) {
      for (const station of [
        cap.startStationMeters,
        cap.endStationMeters,
        (cap.startStationMeters + cap.endStationMeters) / 2,
      ]) {
        const envelope = masonryTopEnvelopeYAtStation({ blocks: gableBlocks, stationMeters: station });
        const capBottom =
          station <= cap.startStationMeters + 0.001
            ? cap.startBottomY
            : station >= cap.endStationMeters - 0.001
              ? cap.endBottomY
              : cap.startBottomY +
                ((cap.endBottomY - cap.startBottomY) * (station - cap.startStationMeters)) /
                  (cap.endStationMeters - cap.startStationMeters);
        if (!Number.isFinite(envelope)) continue;
        const gap = capBottom - envelope;
        if (Math.abs(gap) > 0.015 && Math.abs(gap + 0.201) > 0.02) {
          mismatches.push({
            capId: cap.id,
            slope: cap.slope,
            station,
            capBottom,
            envelope,
            gap,
          });
        }
      }

      const topBlocks = gableBlocks.filter((block) => {
        const top = block.y + (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2;
        return (
          Math.abs(top - cap.startBottomY - 0.001) < 0.012 ||
          Math.abs(top - cap.endBottomY - 0.001) < 0.012
        );
      });
      if (topBlocks.length > 0) {
        const blockStart = Math.min(
          ...topBlocks.map((block) => block.startAlongMeters ?? block.stationMeters ?? 0),
        );
        const blockEnd = Math.max(
          ...topBlocks.map(
            (block) =>
              block.endAlongMeters ??
              (block.stationMeters ?? 0) + (block.actualLengthMeters ?? block.lengthMeters),
          ),
        );
        if (cap.startStationMeters + 0.01 < blockStart) {
          mismatches.push({
            capId: cap.id,
            issue: 'overhang_left',
            capStart: cap.startStationMeters,
            blockStart,
          });
        }
        if (cap.endStationMeters - 0.01 > blockEnd) {
          mismatches.push({
            capId: cap.id,
            issue: 'overhang_right',
            capEnd: cap.endStationMeters,
            blockEnd,
          });
        }
      }
    }

    const overhangs = mismatches.filter((entry) => typeof entry.issue === 'string');
    if (overhangs.length > 0) {
      console.table(overhangs);
    }
    expect(overhangs).toEqual([]);
  });
});
