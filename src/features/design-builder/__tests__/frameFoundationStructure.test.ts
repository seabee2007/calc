import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  applyAutoFrameLayout,
  applyFrameFoundationDimensions,
  previewFrameLayoutCounts,
} from '../domain/structureActions';
import { createDefaultRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/foundationElevations';

describe('Frame & Foundation Dimensions apply flow', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());

  it('applyFrameFoundationDimensions updates columns when auto layout is enabled', () => {
    const foundation = normalizeRcFrameFoundationSettings({
      ...createDefaultRcFrameFoundationSettings(),
      columns: {
        ...createDefaultRcFrameFoundationSettings().columns,
        widthMeters: 0.4,
        depthMeters: 0.4,
        placementMode: 'corners_only',
      },
    });
    const next = applyFrameFoundationDimensions(preset, {
      foundation,
      roofSystem: createDefaultRoofSystemSettings(),
      autoGenerateFrameLayout: true,
    });
    expect(next.frameSystem.columns.length).toBeGreaterThan(0);
    expect(next.frameSystem.beams.length).toBeGreaterThan(0);
    expect(next.foundationSettings).toEqual(foundation);
  });

  it('previewFrameLayoutCounts reports resolved columns and beam segments', () => {
    const counts = previewFrameLayoutCounts({
      preset,
      foundation: createDefaultRcFrameFoundationSettings(),
      autoGenerateFrameLayout: true,
    });
    expect(counts.columnCount).toBeGreaterThan(0);
    expect(counts.frameSegmentCount).toBeGreaterThan(0);
  });

  it('applyFrameFoundationDimensions updates roof system settings', () => {
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip' as const,
      peakHeightAboveRoofBeamMeters: 2,
    };
    const next = applyFrameFoundationDimensions(preset, {
      foundation: createDefaultRcFrameFoundationSettings(),
      roofSystem,
      autoGenerateFrameLayout: false,
    });
    expect(next.roofSystem.roofType).toBe('hip');
    expect(next.roofSystem.peakHeightAboveRoofBeamMeters).toBe(2);
  });

  it('default plinth beam includes exterior/interior follow flags', () => {
    const defaults = createDefaultRcFrameFoundationSettings();
    expect(defaults.plinthBeam.followsExteriorSegments).toBe(true);
    expect(defaults.plinthBeam.followsInteriorSegments).toBe(false);
  });
});
