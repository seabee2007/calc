import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { buildRunningBondModuleGrid, clipGridCellsToInterval, UNDERSIZED_CUT_WARNING_CODE } from '../domain/cmuCourseLayoutEngine';
import { resolveInfillPanelsWithBounds } from '../domain/cmuInfillPanelSolver';
import {
  resolveGableCourseInterval,
  resolveGableRidgeStationMeters,
  solveGableEndMasonryBlocks,
} from '../domain/gableEndMasonrySolver';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import { resolveOuterRoofBeamBearingLoop } from '../domain/roofFootprintSupport';
import { getSegmentFramesForWallLayout, buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import { resolvePanelVerticalCourses } from '../domain/cmuInfillPanelSolver';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('gableEndMasonrySolver', () => {
  it('clips running-bond grid to gable course interval without redistributing terminal cuts', () => {
    const cells = buildRunningBondModuleGrid({
      bondDatumStationMeters: 0,
      courseIndex: 0,
      coverageEndMeters: 6,
      nominalModuleMeters: 0.4,
      halfNominalMeters: 0.2,
      bondPattern: 'running_bond',
    });
    const clipped = clipGridCellsToInterval({
      cells,
      intervalStartMeters: 0.05,
      intervalEndMeters: 5.95,
      nominalModuleMeters: 0.4,
      halfNominalMeters: 0.2,
      actualFullLengthMeters: 0.388,
      halfActualLengthMeters: 0.194,
    });
    expect(clipped.some((block) => block.blockType === 'cut')).toBe(true);
    expect(clipped[0]!.stationMeters).toBeCloseTo(0.05, 3);
    expect(clipped[clipped.length - 1]!.stationMeters + clipped[clipped.length - 1]!.nominalLengthMeters).toBeCloseTo(
      5.95,
      3,
    );
  });

  it('emits undersized_cut_unit warning for tiny terminal clips', () => {
    const cells = buildRunningBondModuleGrid({
      bondDatumStationMeters: 0,
      courseIndex: 0,
      coverageEndMeters: 0.5,
      nominalModuleMeters: 0.4,
      halfNominalMeters: 0.2,
      bondPattern: 'running_bond',
    });
    const clipped = clipGridCellsToInterval({
      cells,
      intervalStartMeters: 0,
      intervalEndMeters: 0.019,
      nominalModuleMeters: 0.4,
      halfNominalMeters: 0.2,
      actualFullLengthMeters: 0.388,
      halfActualLengthMeters: 0.194,
    });
    expect(clipped[0]?.warning).toBe(UNDERSIZED_CUT_WARNING_CODE);
  });

  it('continues bond phase from CMU below the roof beam using global courseIndex', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const module = resolveCmuModuleDefinition(preset.wall);
    const roofBeamTop = preset.frameSystem.beams.find((beam) => beam.kind === 'roof_beam')?.topElevationMeters ?? 2.8;
    const panel = preset.infillSystem.panels.find((entry) => entry.hostSegmentId === segmentFrames[0]!.segmentId);
    expect(panel).toBeDefined();

    const verticalBelowBeam = resolvePanelVerticalCourses({
      panelBottomElevationMeters: panel!.bottomElevationMeters,
      panelTopElevationMeters: panel!.topElevationMeters,
      nominalCourseHeightMeters: module.nominalModuleHeightMeters,
    });
    const firstGableCourseIndex =
      verticalBelowBeam.fullCourseCount + (verticalBelowBeam.hasTopClosureCourse ? 1 : 0);

    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true },
    };
    const bearingLoop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: preset.frameSystem.beams,
      fallbackExteriorFootprint: [],
    });
    const resolvedRoof = resolveRoofSystem({
      layout: preset.wallLayout,
      wallExteriorFootprint: [],
      structuralBearingPerimeter: bearingLoop.points,
      bearingSource: bearingLoop.source,
      bearingWarnings: bearingLoop.warnings,
      roofSystem,
      roofBeamTopElevationMeters: roofBeamTop,
    });

    const gableSegmentId = resolvedRoof.gableEndSegmentIds[0];
    expect(gableSegmentId).toBeDefined();
    const gablePanel = preset.infillSystem.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    const frame = segmentFrames.find((entry) => entry.segmentId === gableSegmentId);
    expect(gablePanel).toBeDefined();
    expect(frame).toBeDefined();

    const result = solveGableEndMasonryBlocks({
      panel: gablePanel!,
      frame: frame!,
      wall: preset.wall,
      roofSystem,
      resolvedRoof,
      roofBeamTopElevationMeters: roofBeamTop,
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.every((block) => block.source === 'gable_end_solver')).toBe(true);
    expect(Math.min(...result.blocks.map((block) => block.courseIndex ?? 0))).toBe(firstGableCourseIndex);
    expect(result.layoutDebug[0]?.courseIndex).toBe(firstGableCourseIndex);
    const expectedFirstOffset =
      result.layoutDebug[0]!.courseIndex % 2 === 1 ? module.nominalModuleLengthMeters / 2 : 0;
    expect(result.layoutDebug[0]?.bondOffsetMeters).toBeCloseTo(expectedFirstOffset, 3);
    if (result.layoutDebug.length > 1 && result.layoutDebug[1]!.courseIndex % 2 === 1) {
      expect(result.layoutDebug[1]?.bondOffsetMeters).toBeCloseTo(module.nominalModuleLengthMeters / 2, 3);
    }
  });

  it('centers the top gable course under the roof ridge with running bond continuity', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const module = resolveCmuModuleDefinition(preset.wall);
    const roofBeamTop = preset.frameSystem.beams.find((beam) => beam.kind === 'roof_beam')?.topElevationMeters ?? 2.8;
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true },
    };
    const bearingLoop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: preset.frameSystem.beams,
      fallbackExteriorFootprint: [],
    });
    const resolvedRoof = resolveRoofSystem({
      layout: preset.wallLayout,
      wallExteriorFootprint: [],
      structuralBearingPerimeter: bearingLoop.points,
      bearingSource: bearingLoop.source,
      bearingWarnings: bearingLoop.warnings,
      roofSystem,
      roofBeamTopElevationMeters: roofBeamTop,
    });
    const gableSegmentId = resolvedRoof.gableEndSegmentIds[0]!;
    const panelEntries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
      foundation: normalizeRcFrameFoundationSettings(preset.foundationSettings),
      existingPanels: preset.infillSystem.panels,
    });
    const gablePanel = panelEntries.find(
      (entry) =>
        entry.panel.hostSegmentId === gableSegmentId && entry.panel.infillZone === 'above_grade',
    )!.panel;
    const frame = segmentFrames.find((entry) => entry.segmentId === gableSegmentId)!;
    const result = solveGableEndMasonryBlocks({
      panel: gablePanel,
      frame,
      wall: preset.wall,
      roofSystem,
      resolvedRoof,
      roofBeamTopElevationMeters: roofBeamTop,
    });
    const ridge = resolveGableRidgeStationMeters({ frame, resolvedRoof });
    const nominal = module.nominalModuleLengthMeters;
    const topCourseIndex = Math.max(...result.blocks.map((block) => block.courseIndex ?? 0));
    const topBlocks = result.blocks.filter((block) => (block.courseIndex ?? 0) === topCourseIndex);
    const topSpanStart = Math.min(...topBlocks.map((b) => b.stationMeters ?? 0));
    const topSpanEnd = Math.max(
      ...topBlocks.map(
        (b) => (b.stationMeters ?? 0) + (b.nominalLengthMeters ?? b.lengthMeters),
      ),
    );
    const topSpanCenter = (topSpanStart + topSpanEnd) / 2;
    expect(Math.abs(topSpanCenter - ridge)).toBeLessThan(nominal / 2);
    expect(result.layoutDebug[0]?.bondOffsetMeters).toBeCloseTo(
      (result.layoutDebug[0]!.courseIndex % 2 === 1 ? nominal / 2 : 0),
      3,
    );
    expect(result.layoutDebug.length).toBeGreaterThan(1);
    if (result.layoutDebug[1]!.courseIndex % 2 === 1) {
      expect(result.layoutDebug[1]?.bondOffsetMeters).toBeCloseTo(nominal / 2, 3);
    }
  });

  it('adds a cut-height top closure row on both exterior gable ends from roof-beam top', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const module = resolveCmuModuleDefinition(preset.wall);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
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
    const roof = geometry.resolvedRoofSystem;
    expect(roof?.gableEndSegmentIds).toHaveLength(2);
    const roofBeamTop = geometry.frameSystem.beams.find((beam) => beam.kind === 'roof_beam')?.topElevationMeters;
    expect(roofBeamTop).toBeDefined();

    for (const segmentId of roof!.gableEndSegmentIds) {
      const segmentBlocks = geometry.blockInstances.filter(
        (block) => block.segmentId === segmentId && block.source === 'gable_end_solver',
      );
      expect(segmentBlocks.length).toBeGreaterThan(0);
      const firstBottom = Math.min(
        ...segmentBlocks.map((block) => block.y - (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2),
      );
      expect(firstBottom).toBeCloseTo(roofBeamTop!, 3);

      const topCourseIndex = Math.max(...segmentBlocks.map((block) => block.courseIndex ?? 0));
      const topCourseBlocks = segmentBlocks.filter((block) => (block.courseIndex ?? 0) === topCourseIndex);
      expect(topCourseBlocks.length).toBeGreaterThan(0);
      expect(topCourseBlocks.every((block) => block.kind === 'cut_height_block')).toBe(true);
      expect(
        topCourseBlocks.every(
          (block) => (block.physicalHeightMeters ?? block.heightMeters ?? 0) < module.actualBlockHeightMeters,
        ),
      ).toBe(true);
    }
  });

});

describe('gable CMU viewer regression', () => {
  it('does not render orange per-gable BoxGeometry loops from gablePlacements', () => {
    const viewerSource = readFileSync(
      join(__dirname, '..', 'ui', 'DesignBuilderViewer.tsx'),
      'utf8',
    );
    expect(viewerSource.includes('gablePlacements.forEach')).toBe(false);
    expect(viewerSource.includes('new THREE.BoxGeometry(placement.lengthMeters, placement.heightMeters')).toBe(false);
    expect(viewerSource.includes('0xd97706')).toBe(false);
  });

  it('renders roof sheet eave lips for gable roofs too', () => {
    const viewerSource = readFileSync(
      join(__dirname, '..', 'ui', 'DesignBuilderViewer.tsx'),
      'utf8',
    );
    expect(viewerSource).toContain('createRoofSheetEaveLipGeometry');
    expect(viewerSource).not.toMatch(/if \(resolvedRoof\.roofType === 'hip'\)\s*{\s*const eaveIndices/);
  });

  it('renders soffit as an independent roof layer', () => {
    const viewerSource = readFileSync(
      join(__dirname, '..', 'ui', 'DesignBuilderViewer.tsx'),
      'utf8',
    );
    expect(viewerSource).toContain('soffitGroup');
    expect(viewerSource).toContain('currentRoofLayerVisibility.soffit');
    expect(viewerSource).toContain('createSoffitPanelGeometry');
    expect(viewerSource).not.toMatch(/resolvedRoof\.roofType === 'hip'[\s\S]{0,160}soffit/i);
  });

  it('keeps gable CMU visible when smooth wall proxy is active', () => {
    const viewerSource = readFileSync(
      join(__dirname, '..', 'ui', 'DesignBuilderViewer.tsx'),
      'utf8',
    );
    expect(viewerSource).toContain('resolveVisibleCmuBlockInstances');
    expect(viewerSource).toContain('if (!params.showCmuInfill) return gableEndBlocks');
    expect(viewerSource).toContain('params.blockInstances.filter(isGableEndCmuBlock)');
    expect(viewerSource).toContain('if (showCmuInfill && !currentWall.showIndividualBlocks)');
  });

  it('renders the raked cap as a two-sided interior-visible concrete fill', () => {
    const viewerSource = readFileSync(
      join(__dirname, '..', 'ui', 'DesignBuilderViewer.tsx'),
      'utf8',
    );
    expect(viewerSource).toContain('capMaterial.side = THREE.DoubleSide');
  });

  it('routes roof gable CMU through blockInstances', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
    };
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, showIndividualBlocks: false },
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
    const gableBlocks = geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    expect(gableBlocks.length).toBeGreaterThan(0);
    expect(geometry.gablePlacements?.length ?? 0).toBe(0);
    expect(gableBlocks.every((block) => (block.physicalHeightMeters ?? block.heightMeters ?? 0) > 0)).toBe(true);
  });
});

describe('resolveGableCourseInterval', () => {
  it('returns symmetric interval width from ridge for a course below peak ceiling', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const roofBeamTop = 2.8;
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      peakHeightAboveRoofBeamMeters: 1.5,
    };
    const bearingLoop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: preset.frameSystem.beams,
      fallbackExteriorFootprint: [],
    });
    const resolvedRoof = resolveRoofSystem({
      layout: preset.wallLayout,
      wallExteriorFootprint: [],
      structuralBearingPerimeter: bearingLoop.points,
      bearingSource: bearingLoop.source,
      bearingWarnings: bearingLoop.warnings,
      roofSystem,
      roofBeamTopElevationMeters: roofBeamTop,
    });
    const gableSegmentId = resolvedRoof.gableEndSegmentIds[0]!;
    const gablePanel = preset.infillSystem.panels.find((entry) => entry.hostSegmentId === gableSegmentId)!;
    const frame = segmentFrames.find((entry) => entry.segmentId === gableSegmentId)!;
    const ridge = resolveGableRidgeStationMeters({ frame, resolvedRoof });
    const interval = resolveGableCourseInterval({
      courseTopY: roofBeamTop + 0.19,
      panelStartStation: gablePanel.startStationMeters,
      panelEndStation: gablePanel.endStationMeters,
      ridgeStationMeters: ridge,
      resolvedRoof,
      frame,
      minRakeCapDepthMeters: roofSystem.gable.rakeClearanceMeters,
    });
    expect(interval).not.toBeNull();
    expect(interval!.endMeters - ridge).toBeCloseTo(ridge - interval!.startMeters, 3);
    expect((interval!.startMeters + interval!.endMeters) / 2).toBeCloseTo(ridge, 3);
  });
});
