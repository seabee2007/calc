import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildModuleFitReportFromPlacements,
  classifyPlacementCounts,
  isCutPlacement,
  reconcileSegmentCourses,
  validateCmuUnitFamilyFromWall,
} from '../domain/moduleFitReport';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import {
  generateCmuLayout,
  generateCmuLayoutFromWallLayout,
  resolveWallLayoutGeometry,
} from '../geometry/designGeometry';

describe('moduleFitReport', () => {
  it('keeps physical block dimensions plus joints equal to nominal module dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(() => validateCmuUnitFamilyFromWall(preset.wall)).not.toThrow();
    const definition = resolveCmuModuleDefinition(preset.wall);
    expect(definition.nominalModuleLengthMeters).toBeCloseTo(
      definition.actualFullBlockLengthMeters + definition.headJointMeters,
      3,
    );
    expect(definition.nominalModuleHeightMeters).toBeCloseTo(
      definition.actualBlockHeightMeters + definition.bedJointMeters,
      3,
    );
  });

  it('forces cut_required when any cut_block placement exists', () => {
    const report = buildModuleFitReportFromPlacements({
      placements: [
        {
          id: 'cut-1',
          segmentId: 'east',
          courseIndex: 3,
          moduleIndex: 0,
          unitType: 'cut',
          kind: 'cut_block',
          nominalLengthMeters: 0.12,
          actualLengthMeters: 0.12,
          heightMeters: 0.19,
          depthMeters: 0.19,
          center: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          source: 'wall_run',
        },
      ],
      requestedFootprint: { lengthMeters: 5.2, widthMeters: 5 },
      resolvedFootprint: { lengthMeters: 5.2, widthMeters: 5 },
    });
    expect(report.status).toBe('cut_required');
    expect(report.cutUnitCount).toBe(1);
    expect(report.summary).toContain('Cut required');
    expect(report.summary).not.toContain('compatible');
  });

  it('matches rendered placement counts in the layout solver report', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 5.2, widthMeters: 5 });
    const wall = { ...preset.wall, lengthMeters: 5.2, widthMeters: 5, openings: [] };
    const geometry = resolveWallLayoutGeometry(layout, wall);
    const solved = generateCmuLayoutFromWallLayout(layout, wall, geometry);
    const report = solved.moduleFitReport;
    const cuts = solved.unitPlacements.filter(isCutPlacement);
    const full = solved.unitPlacements.filter((placement) => placement.kind === 'stretcher' || placement.kind === 'corner_block');
    const halfEnd = solved.unitPlacements.filter(
      (placement) => placement.kind === 'half_block' || placement.kind === 'end_block',
    );

    expect(report.fullUnitCount).toBe(full.length);
    expect(report.halfEndUnitCount).toBe(halfEnd.length);
    expect(report.cutUnitCount).toBe(cuts.length);
    if (cuts.length === 0) {
      expect(['fully_modular', 'bond_modular']).toContain(report.status);
    } else {
      expect(report.status).toBe('cut_required');
      expect(report.firstCut).toBeDefined();
    }
  });

  it('classifies 5.20 m × 5.00 m from resolved geometry, not modulo arithmetic alone', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 5.2, widthMeters: 5 });
    const wall = { ...preset.wall, lengthMeters: 5.2, widthMeters: 5, openings: [] };
    const geometry = resolveWallLayoutGeometry(layout, wall);
    const solved = generateCmuLayoutFromWallLayout(layout, wall, geometry);
    const cuts = solved.unitPlacements.filter(isCutPlacement);

    expect(solved.moduleFitReport.requested).toEqual({ lengthMeters: 5.2, widthMeters: 5 });
    expect(solved.moduleFitReport.resolved).toEqual({ lengthMeters: 5.2, widthMeters: 5 });
    expect(solved.moduleFitReport.summary).not.toContain('compatible');

    if (cuts.length === 0) {
      expect(['fully_modular', 'bond_modular']).toContain(solved.moduleFitReport.status);
      expect(solved.moduleFitReport.cutUnitCount).toBe(0);
    } else {
      expect(solved.moduleFitReport.status).toBe('cut_required');
      expect(solved.moduleFitReport.cutUnitCount).toBe(cuts.length);
      expect(solved.moduleFitReport.firstCut?.courseIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('reconciles segment course occupied run against available run', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const wall = { ...preset.wall, lengthMeters: 6, widthMeters: 5, openings: [] };
    const geometry = resolveWallLayoutGeometry(layout, wall);
    const solved = generateCmuLayoutFromWallLayout(layout, wall, geometry);
    const reconciliations = reconcileSegmentCourses({
      coursePlans: solved.coursePlans ?? [],
      placements: solved.unitPlacements,
    });
    expect(reconciliations.length).toBeGreaterThan(0);
    expect(reconciliations.every((item) => item.isReconciled)).toBe(true);
  });

  it('keeps legacy generateCmuLayout report counts aligned with placements', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, widthMeters: 5.13, openings: [] });
    const { fullUnits, halfEndUnits, cutUnits } = classifyPlacementCounts(layout.unitPlacements);
    expect(layout.moduleFitReport.fullUnitCount).toBe(fullUnits.length);
    expect(layout.moduleFitReport.halfEndUnitCount).toBe(halfEndUnits.length);
    expect(layout.moduleFitReport.cutUnitCount).toBe(cutUnits.length);
    if (cutUnits.length > 0) {
      expect(layout.moduleFitReport.status).toBe('cut_required');
    }
  });
});
