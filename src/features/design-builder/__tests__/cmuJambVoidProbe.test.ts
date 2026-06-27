import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { CONSTRUCTION_TOLERANCE_METERS } from './constructionTolerance';

describe('cmu jamb void probe', () => {
  it('keeps CMU out of the door void', () => {
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
    const door = geometry.wallCmuLayout.roughOpenings.find(
      (opening) => opening.actualStartAlongMeters > opening.roughStartAlongMeters + 0.05,
    );
    expect(door).toBeDefined();

    const blocks = geometry.blockInstances.filter(
      (block) =>
        block.segmentId === door!.wallSegmentId &&
        block.infillBand !== 'below_grade' &&
        block.source !== 'below_grade_rc_infill',
    );
    const intruders = blocks.filter((block) => {
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + (block.lengthMeters ?? 0);
      const blockHeight = block.physicalHeightMeters ?? block.heightMeters ?? 0.2;
      const courseBottom = block.y - blockHeight / 2;
      const courseTop = block.y + blockHeight / 2;
      const inDoorHeight =
        courseBottom < door!.actualTopMeters - CONSTRUCTION_TOLERANCE_METERS &&
        courseTop > door!.actualBottomMeters + CONSTRUCTION_TOLERANCE_METERS;
      if (!inDoorHeight) return false;
      return (
        end > door!.actualStartAlongMeters + CONSTRUCTION_TOLERANCE_METERS &&
        start < door!.actualEndAlongMeters - CONSTRUCTION_TOLERANCE_METERS
      );
    });

    expect(intruders).toHaveLength(0);
  });
});
