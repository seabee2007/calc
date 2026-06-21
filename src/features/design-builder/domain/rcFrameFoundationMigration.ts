import type {
  GradeBeamSettings,
  IsolatedFootingSettings,
  LegacyStructuralFoundationSettings,
  RcFrameFoundationSettings,
  StructuralBeamSettings,
  StructuralFoundationSettings,
} from '../types';

/** @deprecated Intermediate persisted shape — tie beam drop lived on tieBeam + footings.dropBelowTieBeamMeters */
type IntermediateRcFrameFoundationSettings = RcFrameFoundationSettings & {
  tieBeam: StructuralBeamSettings & { dropBelowPlinthBeamMeters?: number };
  isolatedFootings: RcFrameFoundationSettings['isolatedFootings'] & {
    dropBelowTieBeamMeters?: number;
  };
};

export function isLegacyFoundationSettings(
  settings: StructuralFoundationSettings | RcFrameFoundationSettings | LegacyStructuralFoundationSettings,
): settings is LegacyStructuralFoundationSettings {
  return 'gradeBeam' in settings && !('plinthBeam' in settings);
}

function migrateIntermediateFoundationSettings(
  settings: IntermediateRcFrameFoundationSettings,
): RcFrameFoundationSettings {
  const footings = settings.isolatedFootings;
  let dropBelowPlinthBeamMeters = footings.dropBelowPlinthBeamMeters;
  if (dropBelowPlinthBeamMeters == null || !Number.isFinite(dropBelowPlinthBeamMeters)) {
    const tieDrop = settings.tieBeam.dropBelowPlinthBeamMeters ?? 0;
    const tieDepth = settings.tieBeam.depthMeters ?? 0;
    const footingDropBelowTie = footings.dropBelowTieBeamMeters ?? 0;
    dropBelowPlinthBeamMeters = tieDrop + tieDepth + footingDropBelowTie;
  }
  return {
    plinthBeam: {
      ...settings.plinthBeam,
      followsExteriorSegments: settings.plinthBeam.followsExteriorSegments ?? true,
      followsInteriorSegments: settings.plinthBeam.followsInteriorSegments ?? false,
    },
    roofBeam: settings.roofBeam,
    tieBeam: {
      enabled: settings.tieBeam.enabled,
      widthMeters: settings.tieBeam.widthMeters,
      depthMeters: settings.tieBeam.depthMeters,
    },
    columns: settings.columns,
    isolatedFootings: {
      enabled: footings.enabled,
      widthMeters: footings.widthMeters,
      lengthMeters: footings.lengthMeters,
      thicknessMeters: footings.thicknessMeters,
      dropBelowPlinthBeamMeters,
      autoCreateAtStructuralColumns: footings.autoCreateAtStructuralColumns,
    },
  };
}

export function migrateLegacyFoundationSettings(
  legacy: LegacyStructuralFoundationSettings,
): RcFrameFoundationSettings {
  const gradeBeam = legacy.gradeBeam;
  const ringBeam = legacy.ringBeam;
  const footings = legacy.isolatedFootings;
  return {
    plinthBeam: {
      enabled: gradeBeam.enabled,
      widthMeters: gradeBeam.widthMeters,
      depthMeters: gradeBeam.depthMeters,
      followsExteriorSegments: gradeBeam.followsExteriorSegments,
      followsInteriorSegments: gradeBeam.followsInteriorSegments,
    },
    roofBeam: {
      enabled: ringBeam?.enabled ?? true,
      widthMeters: ringBeam?.widthMeters ?? 0.25,
      depthMeters: ringBeam?.depthMeters ?? 0.3,
    },
    tieBeam: {
      enabled: true,
      widthMeters: 0.25,
      depthMeters: 0.3,
    },
    columns: {
      widthMeters: 0.35,
      depthMeters: 0.35,
      placementMode: 'corners_only',
    },
    isolatedFootings: {
      enabled: footings.enabled,
      widthMeters: footings.footingWidthMeters,
      lengthMeters: footings.footingLengthMeters,
      thicknessMeters: footings.footingThicknessMeters,
      dropBelowPlinthBeamMeters: Math.max(0.3, footings.dropBelowGradeBeamMeters),
      autoCreateAtStructuralColumns: footings.autoCreateAtStructuralColumns,
    },
  };
}

export function normalizeRcFrameFoundationSettings(
  settings:
    | RcFrameFoundationSettings
    | StructuralFoundationSettings
    | LegacyStructuralFoundationSettings
    | IntermediateRcFrameFoundationSettings
    | undefined,
): RcFrameFoundationSettings {
  if (!settings) {
    return createDefaultRcFrameFoundationSettings();
  }
  if (isLegacyFoundationSettings(settings)) {
    return migrateLegacyFoundationSettings(settings);
  }
  if ('plinthBeam' in settings) {
    const intermediate = settings as IntermediateRcFrameFoundationSettings;
    if (
      intermediate.tieBeam.dropBelowPlinthBeamMeters != null ||
      intermediate.isolatedFootings.dropBelowTieBeamMeters != null
    ) {
      return ensurePlinthBeamFollowFlags(migrateIntermediateFoundationSettings(intermediate));
    }
    return ensurePlinthBeamFollowFlags(settings);
  }
  return createDefaultRcFrameFoundationSettings();
}

function ensurePlinthBeamFollowFlags(settings: RcFrameFoundationSettings): RcFrameFoundationSettings {
  return {
    ...settings,
    plinthBeam: {
      ...settings.plinthBeam,
      followsExteriorSegments: settings.plinthBeam.followsExteriorSegments ?? true,
      followsInteriorSegments: settings.plinthBeam.followsInteriorSegments ?? false,
    },
  };
}

export function createDefaultRcFrameFoundationSettings(): RcFrameFoundationSettings {
  return {
    plinthBeam: {
      enabled: true,
      widthMeters: 0.3,
      depthMeters: 0.45,
      followsExteriorSegments: true,
      followsInteriorSegments: false,
    },
    roofBeam: {
      enabled: true,
      widthMeters: 0.25,
      depthMeters: 0.3,
    },
    tieBeam: {
      enabled: true,
      widthMeters: 0.25,
      depthMeters: 0.3,
    },
    columns: {
      widthMeters: 0.35,
      depthMeters: 0.35,
      placementMode: 'corners_only',
    },
    isolatedFootings: {
      enabled: true,
      widthMeters: 1.2,
      lengthMeters: 1.2,
      thicknessMeters: 0.45,
      dropBelowPlinthBeamMeters: 1.5,
      autoCreateAtStructuralColumns: true,
    },
  };
}

/** @deprecated Use createDefaultRcFrameFoundationSettings */
export const createDefaultFoundationSettings = createDefaultRcFrameFoundationSettings;

export function legacyGradeBeamFromPlinth(plinth: GradeBeamSettings): GradeBeamSettings {
  return {
    ...plinth,
    followsExteriorSegments: true,
    followsInteriorSegments: false,
  };
}

export function legacyFootingsFromRc(footings: RcFrameFoundationSettings['isolatedFootings']): IsolatedFootingSettings {
  return {
    enabled: footings.enabled,
    placementMode: 'at_columns',
    footingWidthMeters: footings.widthMeters,
    footingLengthMeters: footings.lengthMeters,
    footingThicknessMeters: footings.thicknessMeters,
    dropBelowGradeBeamMeters: footings.dropBelowPlinthBeamMeters,
    autoCreateAtStructuralColumns: footings.autoCreateAtStructuralColumns,
  };
}
