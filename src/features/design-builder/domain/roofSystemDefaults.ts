import type { RoofSystemSettings, RoofSupportStyle } from '../types';
import { DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS } from './structuralFrameDefaults';

export function createDefaultRoofSystemSettings(): RoofSystemSettings {
  return {
    enabled: true,
    roofType: 'gable',
    supportSystem: 'steel_trusses',
    peakHeightAboveRoofBeamMeters: 1.25,
    eaveOverhangMeters: 0.3,
    roofAssemblyThicknessMeters: 0.15,
    ridgeDirection: 'along_longest_axis',
    steelTrusses: {
      enabled: true,
      maxSpacingMeters: 2.4,
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
    gable: {
      enabled: true,
      rakeClearanceMeters: DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS,
      rakedConcreteCapEnabled: true,
      capMaterial: 'cast_in_place_concrete',
      rakedConcreteCapDepthMeters: 0.19,
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

  const gableInput = input.gable ?? {};
  const rakedConcreteCapEnabled =
    gableInput.rakedConcreteCapEnabled ?? gableInput.capEnabled ?? defaults.gable.rakedConcreteCapEnabled;
  const rakedConcreteCapDepthMeters =
    gableInput.rakedConcreteCapDepthMeters ?? gableInput.capDepthMeters ?? defaults.gable.rakedConcreteCapDepthMeters;

  return {
    ...defaults,
    ...input,
    supportSystem: resolvedSupportSystem,
    steelTrusses: { ...defaults.steelTrusses, ...input.steelTrusses },
    purlins: { ...defaults.purlins, ...input.purlins },
    corrugatedMetal: { ...defaults.corrugatedMetal, ...input.corrugatedMetal },
    gable: {
      ...defaults.gable,
      ...gableInput,
      rakedConcreteCapEnabled,
      rakedConcreteCapDepthMeters,
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
