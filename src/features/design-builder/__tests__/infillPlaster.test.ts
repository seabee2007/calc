import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset, type CmuBuildingPreset } from '../domain/designBuilderPreset';
import { normalizeCmuInfillSystem, resolveInfillPlasterPanelPlacements, totalInfillPlasterAreaSquareMeters } from '../domain/infillPlaster';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview, squareMetersToSquareFeet } from '../quantity/designQuantityFormulas';

function frameGeometryForPreset(preset: CmuBuildingPreset) {
  return generateDesignGeometry(
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
}

function framePreviewForPreset(preset: CmuBuildingPreset) {
  const geometry = frameGeometryForPreset(preset);
  return {
    geometry,
    lines: buildFrameInfillEstimatePreview({
      designModelId: 'model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem: preset.roofSystem,
    }),
  };
}

describe('infill plaster', () => {
  it('normalizes legacy infill systems with plaster enabled by default', () => {
    const normalized = normalizeCmuInfillSystem({ kind: 'cmu_infill_system', panels: [] });
    expect(normalized.plaster.enabled).toBe(true);
    expect(normalized.plaster.finish).toBe('textured');
    expect(normalized.plaster.profileLabel).toBe('3-coat plaster');
    expect(normalized.plaster.interiorEnabled).toBe(true);
    expect(normalized.plaster.interiorFinish).toBe('smooth');
    expect(normalized.plaster.interiorProfileLabel).toBe('3-coat plaster');
  });

  it('preserves disabled plaster and normalizes smooth finish', () => {
    const normalized = normalizeCmuInfillSystem({
      kind: 'cmu_infill_system',
      panels: [],
      plaster: {
        enabled: false,
        finish: 'smooth',
        profileLabel: '',
        interiorEnabled: false,
        interiorFinish: 'textured',
        interiorProfileLabel: '',
      },
    });
    expect(normalized.plaster.enabled).toBe(false);
    expect(normalized.plaster.finish).toBe('smooth');
    expect(normalized.plaster.profileLabel).toBe('3-coat plaster');
    expect(normalized.plaster.interiorEnabled).toBe(false);
    expect(normalized.plaster.interiorFinish).toBe('textured');
    expect(normalized.plaster.interiorProfileLabel).toBe('3-coat plaster');
  });

  it('creates positive exterior plaster placements clipped around openings', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const grossArea = (geometry.resolvedInfillPanelBounds ?? []).reduce(
      (sum, bounds) => sum + bounds.clearWidthMeters * bounds.clearHeightMeters,
      0,
    );

    const exteriorPlacements = placements.filter((placement) => placement.side === 'exterior');
    const interiorPlacements = placements.filter((placement) => placement.side === 'interior');

    expect(exteriorPlacements.length).toBeGreaterThan((geometry.resolvedInfillPanelBounds ?? []).length);
    expect(interiorPlacements.length).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(exteriorPlacements)).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(interiorPlacements)).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(interiorPlacements.filter((placement) => placement.surfaceKind === 'field'))).toBeLessThan(grossArea);
    expect(interiorPlacements.every((placement) => placement.finish === 'smooth')).toBe(true);
    expect(placements.every((placement) => placement.areaSquareMeters > 0)).toBe(true);
  });

  it('wraps plaster onto both vertical panel edge returns', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const panelBounds = geometry.resolvedInfillPanelBounds ?? [];
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds,
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const returnPlacements = placements.filter(
      (placement) => placement.surfaceKind === 'left_return' || placement.surfaceKind === 'right_return',
    );
    const panelIds = panelBounds
      .map((bounds) => bounds.panelId)
      .filter((panelId) => !panelId.includes('-below-'));

    expect(returnPlacements).toHaveLength(panelIds.length * 2);
    expect(returnPlacements.every((placement) => placement.side === 'exterior')).toBe(true);
    panelIds.forEach((panelId) => {
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'left_return')).toBe(true);
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'right_return')).toBe(true);
    });
    expect(returnPlacements.every((placement) => placement.widthMeters > preset.wall.wallThicknessMeters)).toBe(true);
  });

  it('wraps plaster into rough opening jambs and covers the finished opening allowance', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters,
    );
    expect(opening).toBeDefined();
    const bounds = (geometry.resolvedInfillPanelBounds ?? []).find(
      (candidate) => candidate.hostSegmentId === opening!.wallSegmentId,
    );
    expect(bounds).toBeDefined();
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const openingReturnPlacements = placements.filter((placement) =>
      placement.surfaceKind.startsWith('opening_'),
    );
    const exteriorOpeningReturns = openingReturnPlacements.filter((placement) => placement.side === 'exterior');
    const interiorOpeningReturns = openingReturnPlacements.filter((placement) => placement.side === 'interior');

    expect(exteriorOpeningReturns.length).toBeGreaterThan(0);
    expect(interiorOpeningReturns.length).toBeGreaterThan(0);
    expect(exteriorOpeningReturns.some((placement) => placement.surfaceKind === 'opening_left_jamb')).toBe(true);
    expect(exteriorOpeningReturns.some((placement) => placement.surfaceKind === 'opening_right_jamb')).toBe(true);
    expect(exteriorOpeningReturns.some((placement) => placement.surfaceKind === 'opening_head')).toBe(true);
    expect(openingReturnPlacements.every((placement) => placement.areaSquareMeters > 0)).toBe(true);
    expect(exteriorOpeningReturns.every((placement) => placement.finish === 'textured')).toBe(true);
    expect(interiorOpeningReturns.every((placement) => placement.finish === 'smooth')).toBe(true);

    const openingExteriorReturns = exteriorOpeningReturns.filter((placement) =>
      placement.id.includes(opening!.id),
    );
    const leftJamb = openingExteriorReturns.find((placement) => placement.surfaceKind === 'opening_left_jamb');
    const rightJamb = openingExteriorReturns.find((placement) => placement.surfaceKind === 'opening_right_jamb');
    const head = openingExteriorReturns.find((placement) => placement.surfaceKind === 'opening_head');
    const sill = openingExteriorReturns.find((placement) => placement.surfaceKind === 'opening_sill');
    const openingInteriorReturns = interiorOpeningReturns.filter((placement) =>
      placement.id.includes(opening!.id),
    );
    const interiorLeftJamb = openingInteriorReturns.find((placement) => placement.surfaceKind === 'opening_left_jamb');
    const interiorRightJamb = openingInteriorReturns.find((placement) => placement.surfaceKind === 'opening_right_jamb');
    const interiorHead = openingInteriorReturns.find((placement) => placement.surfaceKind === 'opening_head');
    expect(leftJamb).toBeDefined();
    expect(rightJamb).toBeDefined();
    expect(head).toBeDefined();
    expect(interiorLeftJamb).toBeDefined();
    expect(interiorRightJamb).toBeDefined();
    expect(interiorHead).toBeDefined();

    const centerStation = (placement: typeof openingExteriorReturns[number]) =>
      (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
      (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
    const leftCenter = centerStation(leftJamb!);
    const rightCenter = centerStation(rightJamb!);
    const interiorLeftCenter = centerStation(interiorLeftJamb!);
    const interiorRightCenter = centerStation(interiorRightJamb!);
    const frameTrimCoverageMeters = 0.055;
    const expectedLeftRevealStation = opening!.actualStartAlongMeters - frameTrimCoverageMeters;
    const expectedRightRevealStation = opening!.actualEndAlongMeters + frameTrimCoverageMeters;

    expect(leftCenter - leftJamb!.thicknessMeters / 2).toBeLessThanOrEqual(opening!.roughStartAlongMeters);
    expect(leftCenter + leftJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(expectedLeftRevealStation);
    expect(leftCenter - leftJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(opening!.roughStartAlongMeters - 0.02);
    expect(rightCenter - rightJamb!.thicknessMeters / 2).toBeLessThanOrEqual(expectedRightRevealStation);
    expect(rightCenter + rightJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(opening!.roughEndAlongMeters);
    expect(rightCenter + rightJamb!.thicknessMeters / 2).toBeLessThanOrEqual(opening!.roughEndAlongMeters + 0.02);
    expect(head!.center.y - head!.heightMeters / 2).toBeLessThanOrEqual(
      opening!.actualTopMeters + frameTrimCoverageMeters,
    );
    expect(head!.center.y + head!.heightMeters / 2).toBeGreaterThanOrEqual(opening!.roughTopMeters);
    expect(head!.center.y + head!.heightMeters / 2).toBeLessThanOrEqual(opening!.roughTopMeters + 0.02);
    expect(head!.widthMeters).toBeGreaterThanOrEqual(opening!.roughOpeningWidthMeters);
    expect(interiorLeftCenter - interiorLeftJamb!.thicknessMeters / 2).toBeLessThanOrEqual(opening!.roughStartAlongMeters);
    expect(interiorLeftCenter + interiorLeftJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(expectedLeftRevealStation);
    expect(interiorLeftCenter - interiorLeftJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(opening!.roughStartAlongMeters - 0.02);
    expect(interiorRightCenter - interiorRightJamb!.thicknessMeters / 2).toBeLessThanOrEqual(expectedRightRevealStation);
    expect(interiorRightCenter + interiorRightJamb!.thicknessMeters / 2).toBeGreaterThanOrEqual(opening!.roughEndAlongMeters);
    expect(interiorRightCenter + interiorRightJamb!.thicknessMeters / 2).toBeLessThanOrEqual(opening!.roughEndAlongMeters + 0.02);
    expect(interiorHead!.center.y - interiorHead!.heightMeters / 2).toBeLessThanOrEqual(
      opening!.actualTopMeters + frameTrimCoverageMeters,
    );
    expect(interiorHead!.center.y + interiorHead!.heightMeters / 2).toBeGreaterThanOrEqual(opening!.roughTopMeters);
    expect(interiorHead!.center.y + interiorHead!.heightMeters / 2).toBeLessThanOrEqual(opening!.roughTopMeters + 0.02);
    if (opening!.type !== 'door') {
      expect(sill).toBeDefined();
      expect(sill!.center.y - sill!.heightMeters / 2).toBeLessThanOrEqual(opening!.actualBottomMeters);
      expect(sill!.center.y + sill!.heightMeters / 2).toBeGreaterThanOrEqual(opening!.actualBottomMeters);
      expect(sill!.center.y - sill!.heightMeters / 2).toBeGreaterThanOrEqual(opening!.actualBottomMeters - 0.01);
    }
  });

  it('cuts the main plaster field to the outside edge of the opening frame', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters,
    );
    expect(opening).toBeDefined();
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const hostFieldPlacements = placements.filter(
      (placement) =>
        placement.hostSegmentId === opening!.wallSegmentId &&
        placement.side === 'exterior' &&
        placement.surfaceKind === 'field',
    );
    const bounds = (geometry.resolvedInfillPanelBounds ?? []).find(
      (candidate) => candidate.hostSegmentId === opening!.wallSegmentId,
    );
    expect(bounds).toBeDefined();
    const frameTrimCoverageMeters = 0.055;
    const frameStart = Math.max(opening!.roughStartAlongMeters, opening!.actualStartAlongMeters - frameTrimCoverageMeters);
    const frameEnd = Math.min(opening!.roughEndAlongMeters, opening!.actualEndAlongMeters + frameTrimCoverageMeters);
    const frameBottom = Math.max(opening!.roughBottomMeters, opening!.actualBottomMeters - frameTrimCoverageMeters);
    const frameTop = Math.min(opening!.roughTopMeters, opening!.actualTopMeters + frameTrimCoverageMeters);
    const overlapToleranceMeters = 0.001;
    const fieldCrossesFrameOpening = hostFieldPlacements.some((placement) => {
      const centerStation =
        (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
        (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
      const start = centerStation - placement.widthMeters / 2;
      const end = centerStation + placement.widthMeters / 2;
      const bottom = placement.center.y - placement.heightMeters / 2;
      const top = placement.center.y + placement.heightMeters / 2;
      return (
        start < frameEnd - overlapToleranceMeters &&
        end > frameStart + overlapToleranceMeters &&
        bottom < frameTop - overlapToleranceMeters &&
        top > frameBottom + overlapToleranceMeters
      );
    });
    const leftFieldEdge = hostFieldPlacements
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
          (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const end = centerStation + placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        return bottom < frameTop && top > frameBottom && end <= frameStart + 0.001 ? end : null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => right - left)[0];
    const rightFieldEdge = hostFieldPlacements
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
          (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        return bottom < frameTop && top > frameBottom && start >= frameEnd - 0.001 ? start : null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => left - right)[0];

    expect(fieldCrossesFrameOpening).toBe(false);
    expect(leftFieldEdge).toBeCloseTo(frameStart, 6);
    expect(rightFieldEdge).toBeCloseTo(frameEnd, 6);
  });

  it('adds three Division 09 plaster coat lines using matching net area', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const { geometry, lines } = framePreviewForPreset(preset);
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const exteriorPlacements = placements.filter((placement) => placement.side === 'exterior');
    const interiorPlacements = placements.filter((placement) => placement.side === 'interior');
    const expectedExteriorSquareFeet = squareMetersToSquareFeet(totalInfillPlasterAreaSquareMeters(exteriorPlacements));
    const expectedInteriorSquareFeet = squareMetersToSquareFeet(totalInfillPlasterAreaSquareMeters(interiorPlacements));
    const plasterLines = lines.filter((line) => line.id.startsWith('infill-plaster-'));

    expect(plasterLines.map((line) => line.id)).toEqual([
      'infill-plaster-scratch-coat',
      'infill-plaster-base-coat',
      'infill-plaster-finish-coat',
      'infill-plaster-interior-scratch-coat',
      'infill-plaster-interior-base-coat',
      'infill-plaster-interior-finish-coat',
    ]);
    expect(plasterLines.every((line) => line.divisionCode === '09')).toBe(true);
    expect(plasterLines.every((line) => line.unit === 'SF')).toBe(true);
    expect(plasterLines.slice(0, 3).every((line) => line.quantity === Number(expectedExteriorSquareFeet.toFixed(2)))).toBe(true);
    expect(plasterLines.slice(3).every((line) => line.quantity === Number(expectedInteriorSquareFeet.toFixed(2)))).toBe(true);
    expect(plasterLines[2].description).toContain('Textured');
    expect(plasterLines[5].description).toContain('Smooth');
  });

  it('omits plaster quantities when disabled', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const disabled = {
      ...preset,
      infillSystem: {
        ...preset.infillSystem,
        plaster: {
          ...normalizeCmuInfillSystem(preset.infillSystem).plaster,
          enabled: false,
          interiorEnabled: false,
        },
      },
    };
    const { geometry, lines } = framePreviewForPreset(disabled);

    expect(resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
    })).toHaveLength(0);
    expect(lines.some((line) => line.id.startsWith('infill-plaster-'))).toBe(false);
  });
});
