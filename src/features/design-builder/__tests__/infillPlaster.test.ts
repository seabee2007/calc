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
  });

  it('preserves disabled plaster and normalizes smooth finish', () => {
    const normalized = normalizeCmuInfillSystem({
      kind: 'cmu_infill_system',
      panels: [],
      plaster: { enabled: false, finish: 'smooth', profileLabel: '' },
    });
    expect(normalized.plaster.enabled).toBe(false);
    expect(normalized.plaster.finish).toBe('smooth');
    expect(normalized.plaster.profileLabel).toBe('3-coat plaster');
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

    expect(placements.length).toBeGreaterThan((geometry.resolvedInfillPanelBounds ?? []).length);
    expect(totalInfillPlasterAreaSquareMeters(placements)).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(placements)).toBeLessThan(grossArea);
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
    const returnPlacements = placements.filter((placement) => placement.surfaceKind !== 'field');
    const panelIds = panelBounds
      .map((bounds) => bounds.panelId)
      .filter((panelId) => !panelId.includes('-below-'));

    expect(returnPlacements).toHaveLength(panelIds.length * 2);
    panelIds.forEach((panelId) => {
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'left_return')).toBe(true);
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'right_return')).toBe(true);
    });
    expect(returnPlacements.every((placement) => placement.widthMeters > preset.wall.wallThicknessMeters)).toBe(true);
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
    const expectedSquareFeet = squareMetersToSquareFeet(totalInfillPlasterAreaSquareMeters(placements));
    const plasterLines = lines.filter((line) => line.id.startsWith('infill-plaster-'));

    expect(plasterLines.map((line) => line.id)).toEqual([
      'infill-plaster-scratch-coat',
      'infill-plaster-base-coat',
      'infill-plaster-finish-coat',
    ]);
    expect(plasterLines.every((line) => line.divisionCode === '09')).toBe(true);
    expect(plasterLines.every((line) => line.unit === 'SF')).toBe(true);
    expect(plasterLines.every((line) => line.quantity === Number(expectedSquareFeet.toFixed(2)))).toBe(true);
  });

  it('omits plaster quantities when disabled', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const disabled = {
      ...preset,
      infillSystem: {
        ...preset.infillSystem,
        plaster: { ...normalizeCmuInfillSystem(preset.infillSystem).plaster, enabled: false },
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
