import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  applyAutoFrameLayout,
  applyCornerColumns,
  objectSaveKey,
} from '../domain/structureActions';
import {
  autoFrameLayout,
  beamSpanLengthMeters,
  columnExteriorBounds,
  deduplicatedStructuralConcreteVolumeCubicMeters,
  findColumnAtNode,
} from '../domain/structuralFrameLayout';
import {
  FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
  resolveInfillPanelBoundsForLayout,
  resolveInsideFaceStation,
} from '../domain/infillPanelBoundsResolver';
import {
  deriveInfillPanelsForLayout,
  panelClearWidthMeters,
  resolveInfillPanelsWithBounds,
  solveInfillPanelBlocks,
} from '../domain/cmuInfillPanelSolver';
import {
  computeGableGeometry,
  gableMasonryTopAtStation,
  solveGableEndPlacements,
} from '../domain/gableEndSolver';
import {
  buildModuleFitCandidateTable,
  classifyThreeMeterDimension,
  evaluateRequestedDimensionModuleFit,
} from '../domain/moduleFitEngine';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { createDefaultGableEnd } from '../geometry/structuralFrameGeometry';
import { buildDesignEstimatePreview } from '../quantity/designQuantityFormulas';

describe('structural frame + CMU infill milestone', () => {
  it('shares one RC corner column per layout node', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const withColumns = applyCornerColumns(preset);
    const nodeIds = new Set(preset.wallLayout.nodes.map((n) => n.id));
    expect(withColumns.frameSystem.columns.length).toBe(nodeIds.size);
    const colIds = withColumns.frameSystem.columns.map((c) => c.id);
    expect(new Set(colIds).size).toBe(colIds.length);
  });

  it('RC column outside faces align with outside-face node positions', () => {
    const preset = applyCornerColumns(createFiveBySixCmuBuildingPreset());
    for (const node of preset.wallLayout.nodes) {
      const col = findColumnAtNode(preset.frameSystem.columns, node.id);
      expect(col).toBeTruthy();
      const bounds = columnExteriorBounds(col!);
      expect(bounds.minX).toBeCloseTo(node.x - col!.widthMeters / 2, 3);
      expect(bounds.maxX).toBeCloseTo(node.x + col!.widthMeters / 2, 3);
    }
  });

  it('beams span face-to-face shorter than center-to-center', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const beam = preset.frameSystem.beams.find((b) => b.kind === 'plinth_beam');
    expect(beam).toBeTruthy();
    const startCol = preset.frameSystem.columns.find((c) => c.id === beam!.startColumnId);
    const endCol = preset.frameSystem.columns.find((c) => c.id === beam!.endColumnId);
    const centerDistance = Math.hypot(
      endCol!.position.x - startCol!.position.x,
      endCol!.position.z - startCol!.position.z,
    );
    expect(beamSpanLengthMeters(beam!)).toBeLessThan(centerDistance);
  });

  it('CMU infill panels begin/end at structural support inside faces', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    for (const panel of preset.infillSystem.panels) {
      const frame = frames.find((candidate) => candidate.segmentId === panel.hostSegmentId)!;
      const segment = preset.wallLayout.segments.find((candidate) => candidate.id === panel.hostSegmentId)!;
      const startCol = findColumnAtNode(preset.frameSystem.columns, segment.startNodeId)!;
      const endCol = findColumnAtNode(preset.frameSystem.columns, segment.endNodeId)!;
      expect(panel.startStationMeters).toBeCloseTo(
        resolveInsideFaceStation({ column: startCol, frame, side: 'start' }),
        3,
      );
      expect(panel.endStationMeters).toBeCloseTo(
        resolveInsideFaceStation({ column: endCol, frame, side: 'end' }),
        3,
      );
      expect(panelClearWidthMeters(panel)).toBeGreaterThan(0);
    }
  });

  it('frame mode does not emit corner weave assemblies', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const input = buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
    });
    const geometry = generateDesignGeometry(input);
    expect(geometry.cornerCourseLayouts).toHaveLength(0);
    expect(geometry.wallCmuLayout.cornerAssemblies ?? []).toHaveLength(0);
  });

  it('frame mode resolves door openings on layout-graph world coordinates', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const door = preset.wall.openings.find((opening) => opening.type === 'door');
    expect(door?.wallSegmentId).toBeTruthy();
    const input = buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
    });
    const geometry = generateDesignGeometry(input);
    const roughDoor = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.id === door!.id) as
      | (typeof geometry.wallCmuLayout.roughOpenings[number] & { worldX?: number; worldZ?: number })
      | undefined;
    expect(roughDoor).toBeDefined();
    expect(roughDoor?.worldX).toBeTypeOf('number');
    expect(roughDoor?.worldZ).toBeTypeOf('number');
    const frame = (geometry.wallCmuLayout.segmentFrames ?? []).find(
      (entry) => entry.segmentId === door!.wallSegmentId,
    )!;
    const centerStation =
      ((roughDoor!.actualStartAlongMeters ?? 0) + (roughDoor!.actualEndAlongMeters ?? 0)) / 2;
    const expectedX =
      frame.exteriorStart.x +
      frame.tangent.x * centerStation +
      frame.inwardNormal.x * (frame.wallThicknessMeters / 2);
    const expectedZ =
      frame.exteriorStart.z +
      frame.tangent.z * centerStation +
      frame.inwardNormal.z * (frame.wallThicknessMeters / 2);
    expect(roughDoor!.worldX).toBeCloseTo(expectedX, 3);
    expect(roughDoor!.worldZ).toBeCloseTo(expectedZ, 3);
  });

  it('deduplicates structural concrete intersection volumes', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const naive =
      preset.frameSystem.columns.reduce(
        (s, c) => s + c.widthMeters * c.depthMeters * c.heightMeters,
        0,
      ) +
      preset.frameSystem.beams.reduce(
        (s, b) => s + beamSpanLengthMeters(b) * b.widthMeters * b.depthMeters,
        0,
      );
    const deduped = deduplicatedStructuralConcreteVolumeCubicMeters({
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
    });
    expect(deduped).toBeLessThan(naive);
    expect(deduped).toBeGreaterThan(0);
  });

  it('gable slope uses Pythagorean relationship', () => {
    const geometry = computeGableGeometry({
      settings: createDefaultGableEnd('seg-1', 2.8),
      wallClearSpanMeters: 4,
    });
    expect(geometry.roofSlopeLengthMeters).toBeCloseTo(
      Math.hypot(geometry.halfSpanMeters, geometry.riseMeters),
      6,
    );
  });

  it('gable masonry top respects perpendicular roof clearance', () => {
    const settings = createDefaultGableEnd('seg-1', 2.8);
    const geometry = computeGableGeometry({ settings, wallClearSpanMeters: 4 });
    const topAtRidge = gableMasonryTopAtStation({
      geometry,
      stationFromLeftMeters: geometry.halfSpanMeters,
      panelWidthMeters: 4,
    });
    expect(topAtRidge).toBeLessThan(geometry.peakElevationMeters);
  });

  it('classifies 3 m dimension from solver not modulo assumption', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const result = classifyThreeMeterDimension({
      buildingSystemMode: 'cmu_bearing_wall',
      dimensionBasis: 'outside_face',
      wall: preset.wall,
    });
    expect(result.requestedDimensionMeters).toBe(3);
    expect(['fully_modular', 'bond_modular', 'cut_required', 'opening_conflict']).toContain(
      result.status,
    );
  });

  it('fully modular candidate reports zero cut blocks from panel solver', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frameSystem = autoFrameLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      frameSystem: preset.frameSystem,
      foundation: preset.foundationSettings,
    }).frameSystem;
    const panels = deriveInfillPanelsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: frameSystem.columns,
      beams: frameSystem.beams,
      wall: preset.wall,
    });
    const modularPanel = panels.find((p) => {
      const frame = frames.find((f) => f.segmentId === p.hostSegmentId)!;
      const bounds = resolveInfillPanelsWithBounds({
        layout: preset.wallLayout,
        segmentFrames: frames,
        columns: frameSystem.columns,
        beams: frameSystem.beams,
        wall: preset.wall,
      }).find((entry) => entry.panel.hostSegmentId === p.hostSegmentId)!.bounds;
      const solved = solveInfillPanelBlocks({ panel: p, bounds, frame, wall: preset.wall });
      return solved.cutBlockCount === 0;
    });
    if (modularPanel) {
      const frame = frames.find((f) => f.segmentId === modularPanel.hostSegmentId)!;
      const bounds = resolveInfillPanelsWithBounds({
        layout: preset.wallLayout,
        segmentFrames: frames,
        columns: frameSystem.columns,
        beams: frameSystem.beams,
        wall: preset.wall,
      }).find((entry) => entry.panel.hostSegmentId === modularPanel.hostSegmentId)!.bounds;
      const solved = solveInfillPanelBlocks({ panel: modularPanel, bounds, frame, wall: preset.wall });
      expect(solved.cutBlockCount).toBe(0);
    }
  });

  it('persists objects with unique save keys for wall_layout vs footprint', () => {
    expect(objectSaveKey('building_footprint', { kind: 'rectangle' })).not.toBe(
      objectSaveKey('wall_layout', { kind: 'wall_layout' }),
    );
  });

  it('bearing wall mode still generates layout geometry', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'cmu_bearing_wall',
        frameSystem: preset.frameSystem,
      }),
    );
    expect(geometry.blockCount).toBeGreaterThan(0);
  });

  it('frame estimate preview includes structural and infill metadata', () => {
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
      }),
    );
    const lines = buildDesignEstimatePreview({
      designModelId: 'model-1',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      frameObjectId: 'frame-1',
      infillObjectId: 'infill-1',
      gableEndObjectId: 'gable-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
    });
    expect(lines.some((l) => l.quantityType === 'rc_structural_concrete_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'rc_plinth_beams_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'rc_roof_beams_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'rc_tie_beams_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'rc_columns_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'isolated_footings_volume')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'cmu_infill_blocks')).toBe(true);
    expect(lines.some((l) => l.quantityType === 'cmu_top_closure_cut_course')).toBe(true);
  });

  it('module fit candidate table uses solver dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const candidates = buildModuleFitCandidateTable({
      buildingSystemMode: 'cmu_bearing_wall',
      dimensionBasis: 'outside_face',
      requestedDimensionMeters: 3,
      wall: preset.wall,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.requestedDimensionMeters === 3)).toBe(true);
  });

  it('evaluateRequestedDimensionModuleFit for frame mode uses column widths', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const fit = evaluateRequestedDimensionModuleFit({
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      dimensionBasis: 'outside_face',
      requestedDimensionMeters: 6,
      wall: preset.wall,
      columnWidthMeters: 0.35,
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
    });
    expect(fit.candidateDimensionMeters).toBeLessThan(6);
  });
});
