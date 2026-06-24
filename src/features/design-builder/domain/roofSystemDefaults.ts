import type { RoofLayerVisibility, RoofSystemSettings, RoofSupportStyle } from '../types';
import { DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS } from './structuralFrameDefaults';

export const DEFAULT_ROOF_LAYER_VISIBILITY: RoofLayerVisibility = {
  roofCladding: true,
  ridgeCap: true,
  fascia: true,
  steelTrusses: true,
  purlins: true,
  gableEndCmu: true,
  rakedConcreteCap: true,
};

export function createDefaultRoofSystemSettings(): RoofSystemSettings {
  return {
    enabled: true,
    roofType: 'gable',
    supportSystem: 'steel_trusses',
    peakHeightAboveRoofBeamMeters: 1.25,
    eaveOverhangMeters: 0.3,
    gableEndOverhangMeters: 0.3,
    roofAssemblyThicknessMeters: 0.15,
    ridgeDirection: 'along_longest_axis',
    steelTrusses: {
      enabled: true,
      maxSpacingMeters: 2.4,
      hipInteriorTrussCount: 0,
      profileLabel: 'Conceptual steel truss',
      webSteelAllowanceFactor: 0.35,
      basePlateEnabled: true,
      basePlateWidthMeters: 0.2,
      basePlateLengthMeters: 0.25,
      basePlateThicknessMeters: 0.012,
      anchorBoltsPerBearing: 4,
    },
    purlins: {
      enabled: true,
      profileLabel: 'Conceptual C-channel purlin',
      maxSpacingMeters: 1.2,
    },
    corrugatedMetal: {
      enabled: true,
      sheetTypeLabel: 'Corrugated metal panel',
      wastePercent: 10,
      ridgeCapEnabled: true,
      ridgeCapLapAllowancePercent: 10,
    },
    fascia: {
      enabled: false,
      profileLabel: 'Metal fascia trim',
      bottomExtensionBelowFrameMeters: 0.0254,
    },
    gable: {
      enabled: true,
      rakeClearanceMeters: DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS,
      rakedConcreteCapEnabled: true,
      capMaterial: 'cast_in_place_concrete',
      rakedConcreteCapDepthMeters: 0.19,
      closeInWithRoofingEnabled: false,
    },
  };
}

export function normalizeRoofSystemSettings(
  input: Partial<RoofSystemSettings> | null | undefined,
): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  if (!input) return defaults;

  const legacySupportStyle = input.supportStyle as RoofSupportStyle | undefined;
  const supportSystem =
    input.supportSystem ??
    (legacySupportStyle === 'truss_reference' ? 'steel_trusses' : defaults.supportSystem);

  const roofType = input.roofType ?? defaults.roofType;
  const resolvedSupportSystem =
    roofType === 'hip' ? 'steel_hip_framing' : supportSystem === 'steel_hip_framing' ? 'steel_trusses' : supportSystem;

  const eaveOverhangMeters = Math.max(0, input.eaveOverhangMeters ?? defaults.eaveOverhangMeters);
  const gableEndOverhangMeters = Math.max(
    0,
    input.gableEndOverhangMeters ?? eaveOverhangMeters,
  );

  const gableInput = input.gable ?? {};
  const rakedConcreteCapEnabled =
    gableInput.rakedConcreteCapEnabled ?? gableInput.capEnabled ?? defaults.gable.rakedConcreteCapEnabled;
  const rakedConcreteCapWallDepthMeters =
    gableInput.rakedConcreteCapWallDepthMeters ??
    gableInput.rakedConcreteCapDepthMeters ??
    gableInput.capDepthMeters ??
    defaults.gable.rakedConcreteCapDepthMeters;
  const rakedConcreteCapDepthMeters = rakedConcreteCapWallDepthMeters;
  const steelTrussesInput = input.steelTrusses ?? {};
  const rawHipInteriorTrussCount =
    steelTrussesInput.hipInteriorTrussCount ?? defaults.steelTrusses.hipInteriorTrussCount;
  const hipInteriorTrussCount = Number.isFinite(rawHipInteriorTrussCount)
    ? Math.max(0, Math.round(rawHipInteriorTrussCount))
    : defaults.steelTrusses.hipInteriorTrussCount;
  const fasciaInput = input.fascia ?? {};
  const rawFasciaBottomExtension =
    fasciaInput.bottomExtensionBelowFrameMeters ?? defaults.fascia.bottomExtensionBelowFrameMeters;
  const fasciaBottomExtension = Number.isFinite(rawFasciaBottomExtension)
    ? Math.max(0, rawFasciaBottomExtension)
    : defaults.fascia.bottomExtensionBelowFrameMeters;

  return {
    ...defaults,
    ...input,
    eaveOverhangMeters,
    gableEndOverhangMeters,
    supportSystem: resolvedSupportSystem,
    steelTrusses: { ...defaults.steelTrusses, ...steelTrussesInput, hipInteriorTrussCount },
    purlins: { ...defaults.purlins, ...input.purlins },
    corrugatedMetal: { ...defaults.corrugatedMetal, ...input.corrugatedMetal },
    fascia: {
      ...defaults.fascia,
      ...fasciaInput,
      bottomExtensionBelowFrameMeters: fasciaBottomExtension,
    },
    gable: {
      ...defaults.gable,
      ...gableInput,
      rakedConcreteCapEnabled,
      rakedConcreteCapWallDepthMeters,
      rakedConcreteCapDepthMeters,
      closeInWithRoofingEnabled:
        gableInput.closeInWithRoofingEnabled ?? defaults.gable.closeInWithRoofingEnabled,
    },
  };
}

export function roofSystemFromLegacyGableRoof(params: {
  pitchRisePerRun: number;
  overhangMeters: number;
  halfSpanMeters: number;
}): Partial<RoofSystemSettings> {
  const peakHeightAboveRoofBeamMeters = Math.max(
    0,
    params.pitchRisePerRun * (params.halfSpanMeters + params.overhangMeters),
  );
  return {
    peakHeightAboveRoofBeamMeters,
    eaveOverhangMeters: params.overhangMeters,
  };
}
