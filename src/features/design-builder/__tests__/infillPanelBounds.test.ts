import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  beamSpanLengthMeters,
  findColumnAtNode,
} from '../domain/structuralFrameLayout';
import {
  columnProjectedHalfExtentAlongTangent,
  FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
  resolveInfillPanelBoundsForLayout,
  resolveInsideFaceStation,
} from '../domain/infillPanelBoundsResolver';
import {
  deriveInfillPanelsForLayout,
  panelClearAreaSquareMeters,
  resolveInfillPanelsWithBounds,
  solveInfillPanelBlocks,
} from '../domain/cmuInfillPanelSolver';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';

describe('infill panel bounds resolver', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  it('spans exactly from column inside face to inside face on every segment', () => {
    const bounds = resolveInfillPanelBoundsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
    });
    expect(bounds.length).toBe(preset.wallLayout.segments.length);

    bounds.forEach((panelBounds) => {
      const frame = frames.find((candidate) => candidate.segmentId === panelBounds.hostSegmentId)!;
      const segment = preset.wallLayout.segments.find((candidate) => candidate.id === panelBounds.hostSegmentId)!;
      const startCol = findColumnAtNode(preset.frameSystem.columns, segment.startNodeId)!;
      const endCol = findColumnAtNode(preset.frameSystem.columns, segment.endNodeId)!;
      const startInset = resolveInsideFaceStation({ column: startCol, frame, side: 'start' });
      const endInset = resolveInsideFaceStation({ column: endCol, frame, side: 'end' });

      expect(panelBounds.startStationMeters).toBeCloseTo(startInset, 3);
      expect(panelBounds.endStationMeters).toBeCloseTo(endInset, 3);
      expect(panelBounds.clearWidthMeters).toBeCloseTo(endInset - startInset, 3);
    });
  });

  it('uses projected column extent for rectangular columns', () => {
    const frame = frames[0]!;
    const segment = preset.wallLayout.segments[0]!;
    const column = findColumnAtNode(preset.frameSystem.columns, segment.startNodeId)!;
    const rectangularColumn = { ...column, widthMeters: 0.5, depthMeters: 0.25 };
    const projectedHalf = columnProjectedHalfExtentAlongTangent(rectangularColumn, frame.tangent);
    const station = resolveInsideFaceStation({ column: rectangularColumn, frame, side: 'start' });
    const centerStation =
      (column.position.x - frame.exteriorStart.x) * frame.tangent.x +
      (column.position.z - frame.exteriorStart.z) * frame.tangent.z;
    expect(station).toBeCloseTo(centerStation + projectedHalf, 3);
  });

  it('places CMU flush to panel bounds without end gaps', () => {
    const entries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
    });

    entries.forEach(({ panel, bounds }) => {
      const frame = frames.find((candidate) => candidate.segmentId === panel.hostSegmentId)!;
      const solved = solveInfillPanelBlocks({ panel, bounds, frame, wall: preset.wall });
      expect(Math.abs(solved.firstCmuStartStation - bounds.startStationMeters)).toBeLessThanOrEqual(
        FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
      );
      expect(Math.abs(solved.lastCmuEndStation - bounds.endStationMeters)).toBeLessThanOrEqual(
        FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
      );
    });
  });

  it('matches plinth beam face-to-face clear span on each segment', () => {
    preset.wallLayout.segments.forEach((segment) => {
      const beam = preset.frameSystem.beams.find(
        (candidate) => candidate.kind === 'plinth_beam' && candidate.hostSegmentId === segment.id,
      )!;
      const panelBounds = resolveInfillPanelBoundsForLayout({
        layout: preset.wallLayout,
        segmentFrames: frames,
        columns: preset.frameSystem.columns,
        beams: preset.frameSystem.beams,
      }).find((candidate) => candidate.hostSegmentId === segment.id)!;
      expect(panelBounds.clearWidthMeters).toBeCloseTo(beamSpanLengthMeters(beam), 2);
    });
  });

  it('re-resolves fresh panel bounds even when persisted panels are stale', () => {
    const storedPanels = deriveInfillPanelsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
    }).map((panel) => ({
      ...panel,
      startStationMeters: panel.startStationMeters + 0.5,
      endStationMeters: panel.endStationMeters - 0.5,
    }));

    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        infillSystem: { kind: 'cmu_infill_system', panels: storedPanels },
        gableEndSystem: preset.gableEndSystem,
      }),
    );

    (geometry.resolvedInfillPanelBounds ?? []).forEach((bounds) => {
      const stale = storedPanels.find((panel) => panel.hostSegmentId === bounds.hostSegmentId)!;
      expect(bounds.startStationMeters).not.toBeCloseTo(stale.startStationMeters, 2);
      expect(bounds.endStationMeters).not.toBeCloseTo(stale.endStationMeters, 2);
    });
  });

  it('uses clear panel area rather than gross wall dimensions', () => {
    const panels = deriveInfillPanelsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
    });
    const clearArea = panels.reduce((sum, panel) => sum + panelClearAreaSquareMeters(panel), 0);
    const grossArea = frames.reduce(
      (sum, frame) => sum + frame.lengthMeters * frame.wallHeightMeters,
      0,
    );
    expect(clearArea).toBeLessThan(grossArea);
  });

  it('does not affect bearing-wall geometry generation', () => {
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
      }),
    );
    expect(geometry.blockCount).toBeGreaterThan(0);
    expect(geometry.resolvedInfillPanelBounds ?? []).toHaveLength(0);
  });
});
