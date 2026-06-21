import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  createDesignSnapshot,
  patchDesignSnapshot,
  snapshotToPreset,
  snapshotsEqual,
} from '../domain/designBuilderHistory';
import {
  applyAutoFrameLayout,
  applyFrameFoundationDimensions,
} from '../domain/structureActions';
import { createDefaultRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/foundationElevations';
import { resolveFoundationElevations } from '../domain/foundationElevations';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';

function basePreset() {
  return applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
}

function geometryForPreset(preset: ReturnType<typeof basePreset>) {
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
  return generateDesignGeometry(
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
      roofSystem: preset.roofSystem,
    }),
  );
}

function applyDimensions(
  preset: ReturnType<typeof basePreset>,
  foundationPatch: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>> & {
    columns?: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>['columns']>;
    plinthBeam?: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>['plinthBeam']>;
    tieBeam?: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>['tieBeam']>;
    roofBeam?: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>['roofBeam']>;
    isolatedFootings?: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>['isolatedFootings']>;
  } = {},
  roofPatch: Partial<ReturnType<typeof createDefaultRoofSystemSettings>> = {},
) {
  const foundation = normalizeRcFrameFoundationSettings({
    ...createDefaultRcFrameFoundationSettings(),
    ...foundationPatch,
    columns: { ...createDefaultRcFrameFoundationSettings().columns, ...foundationPatch.columns },
    plinthBeam: { ...createDefaultRcFrameFoundationSettings().plinthBeam, ...foundationPatch.plinthBeam },
    tieBeam: { ...createDefaultRcFrameFoundationSettings().tieBeam, ...foundationPatch.tieBeam },
    roofBeam: { ...createDefaultRcFrameFoundationSettings().roofBeam, ...foundationPatch.roofBeam },
    isolatedFootings: {
      ...createDefaultRcFrameFoundationSettings().isolatedFootings,
      ...foundationPatch.isolatedFootings,
    },
  });
  const roofSystem = { ...createDefaultRoofSystemSettings(), ...roofPatch };
  return applyFrameFoundationDimensions(preset, {
    foundation,
    roofSystem,
    autoGenerateFrameLayout: true,
  });
}

describe('Structure dimensions pipeline', () => {
  const preset = basePreset();

  it('snapshot roundtrip preserves RC foundation and roof settings', () => {
    const updated = applyDimensions(preset, { columns: { widthMeters: 0.6, depthMeters: 0.6 } });
    const snapshot = createDesignSnapshot({
      preset: updated,
      objects: [],
      layoutState: 'editing',
    });
    const restored = snapshotToPreset(snapshot, updated.name);
    expect(restored.foundationSettings.columns.widthMeters).toBe(0.6);
    expect(restored.roofSystem.enabled).toBe(updated.roofSystem.enabled);
  });

  it('patchDesignSnapshot preserves settings through apply path', () => {
    const before = createDesignSnapshot({ preset, objects: [], layoutState: 'editing' });
    const after = patchDesignSnapshot(before, preset.name, (current) =>
      applyDimensions(current, { columns: { widthMeters: 0.6, depthMeters: 0.6 } }),
    );
    expect(snapshotsEqual(before, after)).toBe(false);
    const restored = snapshotToPreset(after, preset.name);
    expect(restored.foundationSettings.columns.widthMeters).toBe(0.6);
  });

  it('cancel path leaves snapshot unchanged', () => {
    const before = createDesignSnapshot({ preset, objects: [], layoutState: 'editing' });
    const after = structuredClone(before);
    expect(snapshotsEqual(before, after)).toBe(true);
    const restored = snapshotToPreset(after, preset.name);
    expect(restored.foundationSettings.columns.widthMeters).toBe(preset.foundationSettings.columns.widthMeters);
  });

  it('changing column width changes resolved column width after apply', () => {
    const before = geometryForPreset(preset);
    const next = applyDimensions(preset, { columns: { widthMeters: 0.6, depthMeters: 0.35 } });
    const after = geometryForPreset(next);
    expect(before.frameSystem.columns[0]?.widthMeters).not.toBe(0.6);
    expect(after.frameSystem.columns[0]?.widthMeters).toBe(0.6);
  });

  it('changing column depth changes resolved column depth after apply', () => {
    const next = applyDimensions(preset, { columns: { widthMeters: 0.35, depthMeters: 0.55 } });
    const after = geometryForPreset(next);
    expect(after.frameSystem.columns[0]?.depthMeters).toBe(0.55);
  });

  it('changing plinth beam depth changes bottom plinth beam elevation', () => {
    const shallow = applyDimensions(preset, { plinthBeam: { depthMeters: 0.2 } });
    const deep = applyDimensions(preset, { plinthBeam: { depthMeters: 0.35 } });
    const shallowElevations = resolveFoundationElevations({
      foundation: shallow.foundationSettings,
      wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
    });
    const deepElevations = resolveFoundationElevations({
      foundation: deep.foundationSettings,
      wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
    });
    expect(deepElevations.bottomOfPlinthBeamY).toBeLessThan(shallowElevations.bottomOfPlinthBeamY);
  });

  it('changing tie beam depth changes tie-beam geometry while preserving footing contact', () => {
    const thin = applyDimensions(preset, { tieBeam: { depthMeters: 0.25 } });
    const thick = applyDimensions(preset, { tieBeam: { depthMeters: 0.4 } });
    const thinGeometry = geometryForPreset(thin);
    const thickGeometry = geometryForPreset(thick);
    const thinTie = thinGeometry.frameSystem.beams.find((beam) => beam.kind === 'tie_beam');
    const thickTie = thickGeometry.frameSystem.beams.find((beam) => beam.kind === 'tie_beam');
    expect(thinTie?.depthMeters).toBe(0.25);
    expect(thickTie?.depthMeters).toBe(0.4);
    expect(thinTie?.baseElevationMeters).toBeCloseTo(thinGeometry.isolatedFootings[0]?.topElevationMeters ?? 0, 3);
    expect(thickTie?.baseElevationMeters).toBeCloseTo(thickGeometry.isolatedFootings[0]?.topElevationMeters ?? 0, 3);
  });

  it('changing footing drop changes footing and tie-beam elevations', () => {
    const shallow = applyDimensions(preset, { isolatedFootings: { dropBelowPlinthBeamMeters: 0.4 } });
    const deep = applyDimensions(preset, { isolatedFootings: { dropBelowPlinthBeamMeters: 0.8 } });
    const shallowGeometry = geometryForPreset(shallow);
    const deepGeometry = geometryForPreset(deep);
    expect(deepGeometry.isolatedFootings[0]?.bottomElevationMeters).toBeLessThan(
      shallowGeometry.isolatedFootings[0]?.bottomElevationMeters ?? 0,
    );
  });

  it('changing footing width length and thickness changes footing geometry', () => {
    const next = applyDimensions(preset, {
      isolatedFootings: { widthMeters: 1.4, lengthMeters: 1.6, thicknessMeters: 0.45 },
    });
    const geometry = geometryForPreset(next);
    const footing = geometry.isolatedFootings[0]!;
    expect(footing.widthMeters).toBe(1.4);
    expect(footing.lengthMeters).toBe(1.6);
    expect(footing.thicknessMeters).toBe(0.45);
  });

  it('changing roof beam depth changes roof-bearing elevation', () => {
    const shallow = applyDimensions(preset, { roofBeam: { depthMeters: 0.2 } });
    const deep = applyDimensions(preset, { roofBeam: { depthMeters: 0.35 } });
    const shallowGeometry = geometryForPreset(shallow);
    const deepGeometry = geometryForPreset(deep);
    expect(deepGeometry.resolvedRoofSystem?.roofBeamTopY).toBeGreaterThan(
      shallowGeometry.resolvedRoofSystem?.roofBeamTopY ?? 0,
    );
  });

  it('changing roof peak height changes roof apex and truss apex', () => {
    const low = applyDimensions(preset, {}, { peakHeightAboveRoofBeamMeters: 1.2 });
    const high = applyDimensions(preset, {}, { peakHeightAboveRoofBeamMeters: 2.4 });
    const lowGeometry = geometryForPreset(low);
    const highGeometry = geometryForPreset(high);
    expect(highGeometry.resolvedRoofSystem?.roofPeakY).toBeGreaterThan(
      lowGeometry.resolvedRoofSystem?.roofPeakY ?? 0,
    );
    expect(highGeometry.resolvedRoofSystem?.trussPlacements[0]?.apex.y).toBeGreaterThan(
      lowGeometry.resolvedRoofSystem?.trussPlacements[0]?.apex.y ?? 0,
    );
  });

  it('changing eave overhang changes cladding perimeter but not base plate locations', () => {
    const narrow = applyDimensions(preset, {}, { eaveOverhangMeters: 0.3 });
    const wide = applyDimensions(preset, {}, { eaveOverhangMeters: 0.8 });
    const narrowGeometry = geometryForPreset(narrow);
    const wideGeometry = geometryForPreset(wide);
    expect(wideGeometry.resolvedRoofSystem?.claddingPerimeter.length).toBeGreaterThan(0);
    expect(wideGeometry.resolvedRoofSystem?.roofSurfaceAreaSquareMeters).toBeGreaterThan(
      narrowGeometry.resolvedRoofSystem?.roofSurfaceAreaSquareMeters ?? 0,
    );
    expect(wideGeometry.resolvedRoofSystem?.trussPlacements[0]?.bearingLeft).toEqual(
      narrowGeometry.resolvedRoofSystem?.trussPlacements[0]?.bearingLeft,
    );
  });

  it('changing purlin spacing changes purlin count', () => {
    const sparse = applyDimensions(
      preset,
      {},
      { purlins: { enabled: true, maxSpacingMeters: 1.8 } },
    );
    const dense = applyDimensions(
      preset,
      {},
      { purlins: { enabled: true, maxSpacingMeters: 0.9 } },
    );
    const sparseGeometry = geometryForPreset(sparse);
    const denseGeometry = geometryForPreset(dense);
    expect(denseGeometry.resolvedRoofSystem?.purlinPlacements.length).toBeGreaterThan(
      sparseGeometry.resolvedRoofSystem?.purlinPlacements.length ?? 0,
    );
  });

  it('changing rake clearance affects resolved gable geometry inputs', () => {
    const tight = applyDimensions(
      preset,
      {},
      { gable: { enabled: true, rakeClearanceMeters: 0.05, rakedConcreteCapEnabled: true } },
    );
    const loose = applyDimensions(
      preset,
      {},
      { gable: { enabled: true, rakeClearanceMeters: 0.25, rakedConcreteCapEnabled: true } },
    );
    expect(loose.roofSystem.gable.rakeClearanceMeters).toBe(0.25);
    expect(tight.roofSystem.gable.rakeClearanceMeters).toBe(0.05);
    const looseGeometry = geometryForPreset(loose);
    expect(looseGeometry.resolvedRoofSystem?.gableEndSegmentIds.length).toBeGreaterThan(0);
  });

  it('quantity preview uses the same canonical settings as geometry', () => {
    const updated = applyDimensions(preset, { columns: { widthMeters: 0.6, depthMeters: 0.6 } });
    const geometry = geometryForPreset(updated);
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: updated.wall,
      slab: updated.slab,
      roof: updated.roof,
      truss: updated.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: updated.frameSystem,
      infillSystem: updated.infillSystem,
      gableEndSystem: updated.gableEndSystem,
      geometryResult: geometry,
      roofSystem: updated.roofSystem,
    });
    expect(preview.length).toBeGreaterThan(0);
    expect(geometry.frameSystem.columns[0]?.widthMeters).toBe(0.6);
  });
});
