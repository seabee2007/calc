import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  createDefaultFoundationSettings,
  resolveFoundationElevations,
  TOP_OF_GRADE_BEAM_Y,
} from '../domain/foundationElevations';
import {
  autoFrameLayout,
  findColumnAtNode,
} from '../domain/structuralFrameLayout';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';

describe('foundation frame layout', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = preset.foundationSettings ?? createDefaultFoundationSettings();
  const wallHeightMeters = preset.wallLayout.defaultWallHeightMeters;
  const elevations = resolveFoundationElevations({ foundation, wallHeightMeters });
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  it('places top of grade beam at Y = 0', () => {
    expect(elevations.topOfGradeBeamY).toBe(TOP_OF_GRADE_BEAM_Y);
    const gradeBeam = preset.frameSystem.beams.find((beam) => beam.kind === 'grade_beam');
    expect(gradeBeam?.topElevationMeters).toBeCloseTo(0, 6);
  });

  it('places bottom of grade beam at negative depth', () => {
    expect(elevations.bottomOfGradeBeamY).toBeCloseTo(-foundation.gradeBeam.depthMeters, 6);
    const gradeBeam = preset.frameSystem.beams.find((beam) => beam.kind === 'grade_beam');
    expect(gradeBeam?.baseElevationMeters).toBeCloseTo(-foundation.gradeBeam.depthMeters, 6);
  });

  it('measures wall height upward from grade beam top', () => {
    expect(elevations.wallBaseY).toBe(0);
    expect(elevations.wallTopY).toBeCloseTo(wallHeightMeters, 6);
    const ringBeam = preset.frameSystem.beams.find((beam) => beam.kind === 'ring_beam');
    expect(ringBeam?.topElevationMeters).toBeCloseTo(wallHeightMeters, 6);
  });

  it('derives footing top from grade beam bottom and drop', () => {
    expect(elevations.topOfFootingY).toBeCloseTo(
      elevations.bottomOfGradeBeamY - foundation.isolatedFootings.dropBelowGradeBeamMeters,
      6,
    );
  });

  it('derives footing bottom and center elevations', () => {
    const thickness = foundation.isolatedFootings.footingThicknessMeters;
    expect(elevations.bottomOfFootingY).toBeCloseTo(elevations.topOfFootingY - thickness, 6);
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
      }),
    );
    const footing = geometry.isolatedFootings?.[0];
    expect(footing).toBeTruthy();
    expect(footing!.topElevationMeters).toBeCloseTo(elevations.topOfFootingY, 6);
    expect(footing!.bottomElevationMeters).toBeCloseTo(elevations.bottomOfFootingY, 6);
    expect(footing!.centerElevationMeters).toBeCloseTo(
      elevations.topOfFootingY - thickness / 2,
      6,
    );
  });

  it('extends columns from footing top to ring beam top', () => {
    const ringBeam = preset.frameSystem.beams.find((beam) => beam.kind === 'ring_beam');
    for (const column of preset.frameSystem.columns) {
      expect(column.baseElevationMeters).toBeCloseTo(elevations.topOfFootingY, 6);
      expect(column.topElevationMeters).toBeCloseTo(ringBeam!.topElevationMeters, 6);
      expect(column.heightMeters).toBeCloseTo(
        ringBeam!.topElevationMeters - elevations.topOfFootingY,
        6,
      );
    }
  });

  it('creates one footing per unique structural column', () => {
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
      }),
    );
    expect(geometry.isolatedFootings?.length).toBe(preset.frameSystem.columns.length);
    const uniqueColumnIds = new Set(geometry.isolatedFootings?.map((footing) => footing.columnId));
    expect(uniqueColumnIds.size).toBe(preset.frameSystem.columns.length);
  });

  it('does not duplicate footings at shared corner columns', () => {
    const nodeIds = new Set(preset.wallLayout.nodes.map((node) => node.id));
    expect(preset.frameSystem.columns.length).toBe(nodeIds.size);
    for (const node of preset.wallLayout.nodes) {
      const column = findColumnAtNode(preset.frameSystem.columns, node.id)!;
      const footingsForColumn =
        generateDesignGeometry(
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
          }),
        ).isolatedFootings?.filter((footing) => footing.columnId === column.id) ?? [];
      expect(footingsForColumn).toHaveLength(1);
    }
  });

  it('sets CMU infill base at grade beam top', () => {
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
      }),
    );
    (geometry.resolvedInfillPanelBounds ?? []).forEach((bounds) => {
      expect(bounds.bottomElevationMeters).toBeCloseTo(0, 6);
    });
  });

  it('does not double-count column concrete in the grade beam zone', () => {
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
      }),
    );
    const breakdown = geometry.structuralConcreteVolumeBreakdown!;
    const naiveColumnTotal =
      breakdown.columnBelowGradeVolumeCubicMeters + breakdown.columnAboveGradeVolumeCubicMeters;
    const fullColumnVolume = preset.frameSystem.columns.reduce(
      (sum, column) => sum + column.widthMeters * column.depthMeters * column.heightMeters,
      0,
    );
    expect(naiveColumnTotal).toBeLessThan(fullColumnVolume);
    expect(breakdown.gradeBeamVolumeCubicMeters).toBeGreaterThan(0);
  });

  it('leaves bearing wall mode unchanged', () => {
    const bearingPreset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: bearingPreset.wallLayout,
        cmuSettings: bearingPreset.wall,
        slabSettings: bearingPreset.slab,
        roofSettings: bearingPreset.roof,
        trussSettings: bearingPreset.truss,
        buildingSystemMode: 'cmu_bearing_wall',
        frameSystem: bearingPreset.frameSystem,
        foundationSettings: bearingPreset.foundationSettings,
      }),
    );
    expect(geometry.blockCount).toBeGreaterThan(0);
    expect(geometry.isolatedFootings ?? []).toHaveLength(0);
  });

  it('aligns plan and 3D footing coordinates', () => {
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
      }),
    );
    const column = preset.frameSystem.columns[0]!;
    const footing = geometry.isolatedFootings?.find((item) => item.columnId === column.id)!;
    expect(footing.position.x).toBeCloseTo(column.position.x, 6);
    expect(footing.position.z).toBeCloseTo(column.position.z, 6);
  });

  it('reconciles auto frame layout with foundation settings', () => {
    const result = autoFrameLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      frameSystem: preset.frameSystem,
      foundation,
    });
    expect(result.isolatedFootings.length).toBeGreaterThan(0);
    expect(result.frameSystem.beams.some((beam) => beam.kind === 'grade_beam')).toBe(true);
  });
});
