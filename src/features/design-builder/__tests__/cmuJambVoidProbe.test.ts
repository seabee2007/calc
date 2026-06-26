import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';

describe('cmu jamb void probe', () => {
  it('keeps CMU out of the door void and rough opening reveal', () => {
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
      const courseBottom = (block.courseIndex ?? 0) * 0.2;
      const courseTop = courseBottom + (block.heightMeters ?? 0.2);
      const inDoorHeight =
        courseBottom < door!.actualTopMeters && courseTop > door!.actualBottomMeters + 0.01;
      if (!inDoorHeight) return false;
      return end > door!.actualStartAlongMeters + 0.002 && start < door!.actualEndAlongMeters - 0.002;
    });

    const revealBlocks = blocks.filter((block) => {
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + (block.lengthMeters ?? 0);
      const courseBottom = (block.courseIndex ?? 0) * 0.2;
      const courseTop = courseBottom + (block.heightMeters ?? 0.2);
      const inDoorHeight =
        courseBottom < door!.actualTopMeters && courseTop > door!.actualBottomMeters + 0.01;
      if (!inDoorHeight) return false;
      return (
        start < door!.actualStartAlongMeters - 0.001 &&
        end > door!.roughStartAlongMeters + 0.001 &&
        end <= door!.actualStartAlongMeters + 0.001
      );
    });

    expect(intruders).toHaveLength(0);
    expect(revealBlocks).toHaveLength(0);
  });
});
