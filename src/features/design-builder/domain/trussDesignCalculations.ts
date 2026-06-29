import type {
  ResolvedRoofSystem,
  RoofSystemSettings,
  RoofVec3,
  SteelMemberKind,
  SteelMemberSegment,
  TrussPlacement,
} from '../types';
import { TRUSS_WEB_PROFILE_RULES } from './trussWebProfiles';

export const TRUSS_DESIGN_PRELIMINARY_WARNING =
  'Preliminary / conceptual design - verify by licensed engineer before permit, fabrication, or construction.';

export const ftPerMeter = 3.280839895;
export const metersPerFoot = 0.3048;
export const inchesPerMeter = 39.37007874;

export type TrussDesignWarning = {
  code: string;
  message: string;
  severity: 'info' | 'warning';
};

export type TrussGravityLoadCriteria = {
  tcllPsf: number;
  tcdlPsf: number;
  bcllPsf: number;
  bcdlPsf: number;
  loadDurationFactor: number;
};

export type TrussWindCriteria = {
  enabled: boolean;
  standard: string;
  speedMph: number;
  exposure: string;
  enclosure: string;
  riskCategory: string;
  meanRoofHeightFt: number;
  kz: number;
  kzt: number;
  kd: number;
  externalPressureCoefficient: number;
  internalPressureCoefficient: number;
};

export type TrussSnowCriteria = {
  pgPsf: number | null;
  pfPsf: number | null;
  ce: number | null;
  ct: number | null;
  cs: number | null;
  snowDuration: string;
};

export type TrussDeflectionCriteria = {
  limitRatios: readonly number[];
  estimatedDeflectionInches?: number | null;
};

export type TrussBuildingCodeCriteria = {
  buildingCode: string;
  tpiStandard: string;
  repetitionFactor: string;
};

export type TrussBearingCriteria = {
  bearingWidthInches: number;
  minimumRequiredBearingInches: number;
};

export type TrussDesignCriteria = {
  gravity: TrussGravityLoadCriteria;
  wind: TrussWindCriteria;
  snow: TrussSnowCriteria;
  deflection: TrussDeflectionCriteria;
  buildingCode: TrussBuildingCodeCriteria;
  bearing: TrussBearingCriteria;
};

export type TrussDesignProjectMeta = {
  sequenceNumber?: string;
  jobNumber?: string;
  trussLabel?: string;
  customer?: string;
  designer?: string;
  date?: string;
};

export type ResolvedTrussDesignProjectMeta = Required<TrussDesignProjectMeta>;

export type TrussDesignSection = {
  title: string;
  rows: readonly {
    label: string;
    value: string;
  }[];
};

export type TrussMemberLengthSummary = {
  bottomChordMeters: number;
  topChordMeters: number;
  verticalWebMeters: number;
  diagonalWebMeters: number;
  totalMeters: number;
};

export type TrussDesignGeometrySummary = {
  spanMeters: number;
  spanFeet: number;
  runMeters: number;
  runFeet: number;
  riseMeters: number;
  riseFeet: number;
  topChordLengthMeters: number;
  topChordLengthFeet: number;
  pitchRisePer12: number;
  roofPitchRadians: number;
  roofPitchDegrees: number;
  trussSpacingMeters: number;
  trussSpacingFeet: number;
  trussSpacingInches: number;
  trussCount: number;
  roofSurfaceAreaSquareMeters: number;
  roofSurfaceAreaSquareFeet: number;
  ridgeLengthMeters: number;
  ridgeLengthFeet: number;
};

export type TrussGravityLoadSummary = {
  spacingFt: number;
  topChordLoadPsf: number;
  bottomChordLoadPsf: number;
  totalGravityLoadPsf: number;
  topChordLineLoadPlf: number;
  bottomChordLineLoadPlf: number;
  totalLineLoadPlf: number;
  simpleSpanReactionLbs: number;
  maxSimpleSpanMomentLbFt: number;
  totalLoadPerTrussLbs: number;
};

export type TrussWindLoadSummary = {
  qzPsf: number;
  pressurePsf: number;
  windLineLoadPlf: number;
  windReactionLbs: number;
  conceptualUpliftReactionLbs: number;
  conceptualHorizontalReactionLbs: number;
};

export type TrussDeflectionSummary = {
  spanInches: number;
  limitsInches: readonly {
    ratio: number;
    limitInches: number;
  }[];
  estimatedDeflectionInches: number | null;
  note: string;
};

export type TrussDesignLoadSummary = {
  gravity: TrussGravityLoadSummary;
  wind: TrussWindLoadSummary | null;
  deflection: TrussDeflectionSummary;
};

export type TrussReactionSummary = {
  gravityLeftReactionLbs: number;
  gravityRightReactionLbs: number;
  nonGravityLeftUpliftLbs: number | null;
  nonGravityRightUpliftLbs: number | null;
  conceptualHorizontalReactionLbs: number | null;
  bearingWidthInches: number;
  minimumRequiredBearingInches: number;
  notes: readonly string[];
};

export type TrussDesignSummary = {
  supported: boolean;
  unsupportedReason?: string;
  representativeTruss: TrussPlacement | null;
  representativeTrussId: string | null;
  representativeProfileLabel: string | null;
  criteria: TrussDesignCriteria;
  projectMeta: ResolvedTrussDesignProjectMeta;
  geometry: TrussDesignGeometrySummary | null;
  memberLengths: TrussMemberLengthSummary | null;
  loads: TrussDesignLoadSummary | null;
  reactions: TrussReactionSummary | null;
  sections: readonly TrussDesignSection[];
  warnings: readonly TrussDesignWarning[];
};

const DEFAULT_GRAVITY_CRITERIA: TrussGravityLoadCriteria = {
  tcllPsf: 20,
  tcdlPsf: 7,
  bcllPsf: 0,
  bcdlPsf: 10,
  loadDurationFactor: 1.25,
};

const DEFAULT_WIND_CRITERIA: TrussWindCriteria = {
  enabled: true,
  standard: 'ASCE 7-22',
  speedMph: 150,
  exposure: 'C',
  enclosure: 'Closed',
  riskCategory: 'II',
  meanRoofHeightFt: 15,
  kz: 0.85,
  kzt: 1,
  kd: 0.85,
  externalPressureCoefficient: -0.9,
  internalPressureCoefficient: 0.18,
};

const DEFAULT_SNOW_CRITERIA: TrussSnowCriteria = {
  pgPsf: null,
  pfPsf: null,
  ce: null,
  ct: null,
  cs: null,
  snowDuration: 'NA',
};

const DEFAULT_DEFLECTION_CRITERIA: TrussDeflectionCriteria = {
  limitRatios: [240, 360, 480],
  estimatedDeflectionInches: null,
};

const DEFAULT_BUILDING_CODE_CRITERIA: TrussBuildingCodeCriteria = {
  buildingCode: 'FBC 8th Ed. 2023 Res.',
  tpiStandard: '2014',
  repetitionFactor: 'Varies by load case',
};

const DEFAULT_BEARING_CRITERIA: TrussBearingCriteria = {
  bearingWidthInches: 8,
  minimumRequiredBearingInches: 1.5,
};

export function resolveTrussDesignSummary(params: {
  roof: ResolvedRoofSystem;
  roofSettings?: RoofSystemSettings;
  projectMeta?: TrussDesignProjectMeta;
  criteria?: Partial<TrussDesignCriteria>;
}): TrussDesignSummary {
  const criteria = resolveTrussDesignCriteria(params.criteria);
  const unsupportedWarnings: TrussDesignWarning[] = [
    {
      code: 'preliminary_conceptual_design',
      message: TRUSS_DESIGN_PRELIMINARY_WARNING,
      severity: 'warning',
    },
  ];

  if (!params.roof.supported) {
    return unsupportedSummary({
      criteria,
      projectMeta: resolveProjectMeta(params.projectMeta, null),
      reason: params.roof.unsupportedMessage ?? 'Roof system is not supported for truss design summary.',
      warnings: unsupportedWarnings,
    });
  }

  const representativeTruss = selectRepresentativeTruss(params.roof.trussPlacements);
  if (!representativeTruss) {
    return unsupportedSummary({
      criteria,
      projectMeta: resolveProjectMeta(params.projectMeta, null),
      reason: 'No truss placements are available for the roof design summary.',
      warnings: [
        ...unsupportedWarnings,
        {
          code: 'missing_truss_placements',
          message: 'No truss placements are available for design-detail calculations.',
          severity: 'warning',
        },
      ],
    });
  }

  const spanMeters = resolveTrussSpanMeters(representativeTruss);
  if (!Number.isFinite(spanMeters) || spanMeters <= 0) {
    return unsupportedSummary({
      criteria,
      projectMeta: resolveProjectMeta(params.projectMeta, representativeTruss),
      reason: 'Representative truss span could not be resolved.',
      warnings: [
        ...unsupportedWarnings,
        {
          code: 'invalid_truss_span',
          message: 'Representative truss span could not be resolved from bearing geometry.',
          severity: 'warning',
        },
      ],
    });
  }

  const bearingElevationMeters = (representativeTruss.bearingLeft.y + representativeTruss.bearingRight.y) / 2;
  const runMeters = spanMeters / 2;
  const riseMeters = Math.max(0, representativeTruss.apex.y - bearingElevationMeters);
  const topChordLengthMeters = Math.hypot(runMeters, riseMeters);
  const pitchRisePer12 = runMeters > 0 ? (riseMeters / runMeters) * 12 : 0;
  const roofPitchRadians = Math.atan2(riseMeters, runMeters);
  const roofPitchDegrees = (roofPitchRadians * 180) / Math.PI;
  const trussSpacingMeters = resolveTrussSpacingMeters(params.roof, params.roofSettings);

  const geometry: TrussDesignGeometrySummary = {
    spanMeters,
    spanFeet: spanMeters * ftPerMeter,
    runMeters,
    runFeet: runMeters * ftPerMeter,
    riseMeters,
    riseFeet: riseMeters * ftPerMeter,
    topChordLengthMeters,
    topChordLengthFeet: topChordLengthMeters * ftPerMeter,
    pitchRisePer12,
    roofPitchRadians,
    roofPitchDegrees,
    trussSpacingMeters,
    trussSpacingFeet: trussSpacingMeters * ftPerMeter,
    trussSpacingInches: trussSpacingMeters * inchesPerMeter,
    trussCount: params.roof.trussCount,
    roofSurfaceAreaSquareMeters: params.roof.roofSurfaceAreaSquareMeters,
    roofSurfaceAreaSquareFeet: params.roof.roofSurfaceAreaSquareMeters * ftPerMeter * ftPerMeter,
    ridgeLengthMeters: params.roof.ridgeLengthMeters,
    ridgeLengthFeet: params.roof.ridgeLengthMeters * ftPerMeter,
  };

  const memberLengths = summarizeRepresentativeMemberLengths(representativeTruss.members);
  const loads = resolveLoadSummary({ geometry, criteria });
  const warnings = resolveWarnings({
    baseWarnings: unsupportedWarnings,
    representativeTruss,
    geometry,
    windEnabled: criteria.wind.enabled,
  });
  const reactions = resolveReactionSummary({ loads, criteria, warnings });
  const projectMeta = resolveProjectMeta(params.projectMeta, representativeTruss);
  const summary: TrussDesignSummary = {
    supported: true,
    representativeTruss,
    representativeTrussId: representativeTruss.id,
    representativeProfileLabel: representativeTruss.webProfileLabel ?? null,
    criteria,
    projectMeta,
    geometry,
    memberLengths,
    loads,
    reactions,
    sections: [],
    warnings,
  };

  return {
    ...summary,
    sections: buildDesignSections(summary),
  };
}

export function formatFeet(value: number, precision = 2): string {
  return `${formatNumber(value, precision)} ft`;
}

export function formatInches(value: number, precision = 2): string {
  return `${formatNumber(value, precision)} in`;
}

export function formatPsf(value: number, precision = 1): string {
  return `${formatNumber(value, precision)} psf`;
}

export function formatPlf(value: number, precision = 1): string {
  return `${formatNumber(value, precision)} plf`;
}

export function formatLbs(value: number, precision = 0): string {
  return `${formatNumber(value, precision)} lbs`;
}

export function formatMeters(value: number, precision = 2): string {
  return `${formatNumber(value, precision)} m`;
}

export function formatPitchLabel(pitchRisePer12: number): string {
  if (!Number.isFinite(pitchRisePer12) || pitchRisePer12 <= 0) return 'NA';
  return `${formatNumber(pitchRisePer12, 1)} : 12`;
}

export function formatOptionalNumber(value: number | null | undefined, precision = 1): string {
  return value == null || !Number.isFinite(value) ? 'NA' : formatNumber(value, precision);
}

function resolveTrussDesignCriteria(partial: Partial<TrussDesignCriteria> | undefined): TrussDesignCriteria {
  return {
    gravity: { ...DEFAULT_GRAVITY_CRITERIA, ...partial?.gravity },
    wind: { ...DEFAULT_WIND_CRITERIA, ...partial?.wind },
    snow: { ...DEFAULT_SNOW_CRITERIA, ...partial?.snow },
    deflection: { ...DEFAULT_DEFLECTION_CRITERIA, ...partial?.deflection },
    buildingCode: { ...DEFAULT_BUILDING_CODE_CRITERIA, ...partial?.buildingCode },
    bearing: { ...DEFAULT_BEARING_CRITERIA, ...partial?.bearing },
  };
}

function resolveProjectMeta(
  meta: TrussDesignProjectMeta | undefined,
  truss: TrussPlacement | null,
): ResolvedTrussDesignProjectMeta {
  return {
    sequenceNumber: meta?.sequenceNumber ?? '--',
    jobNumber: meta?.jobNumber ?? '--',
    trussLabel: meta?.trussLabel ?? truss?.webProfileLabel ?? 'Conceptual truss',
    customer: meta?.customer ?? '--',
    designer: meta?.designer ?? '--',
    date: meta?.date ?? '--',
  };
}

function unsupportedSummary(params: {
  criteria: TrussDesignCriteria;
  projectMeta: ResolvedTrussDesignProjectMeta;
  reason: string;
  warnings: readonly TrussDesignWarning[];
}): TrussDesignSummary {
  return {
    supported: false,
    unsupportedReason: params.reason,
    representativeTruss: null,
    representativeTrussId: null,
    representativeProfileLabel: null,
    criteria: params.criteria,
    projectMeta: params.projectMeta,
    geometry: null,
    memberLengths: null,
    loads: null,
    reactions: null,
    sections: [],
    warnings: params.warnings,
  };
}

function selectRepresentativeTruss(trusses: readonly TrussPlacement[]): TrussPlacement | null {
  return trusses.reduce<TrussPlacement | null>((selected, truss) => {
    if (!selected) return truss;
    return resolveTrussSpanMeters(truss) > resolveTrussSpanMeters(selected) ? truss : selected;
  }, null);
}

function resolveTrussSpanMeters(truss: TrussPlacement): number {
  if (Number.isFinite(truss.spanMeters) && (truss.spanMeters ?? 0) > 0) {
    return truss.spanMeters ?? 0;
  }
  return planDistance(truss.bearingLeft, truss.bearingRight);
}

function resolveTrussSpacingMeters(roof: ResolvedRoofSystem, roofSettings: RoofSystemSettings | undefined): number {
  if (Number.isFinite(roof.actualTrussSpacingMeters) && roof.actualTrussSpacingMeters > 0) {
    return roof.actualTrussSpacingMeters;
  }
  const settingsSpacing = roofSettings?.steelTrusses.maxSpacingMeters;
  return Number.isFinite(settingsSpacing) && (settingsSpacing ?? 0) > 0 ? settingsSpacing ?? 0 : 0;
}

function summarizeRepresentativeMemberLengths(members: readonly SteelMemberSegment[]): TrussMemberLengthSummary {
  const totals = {
    bottomChordMeters: 0,
    topChordMeters: 0,
    verticalWebMeters: 0,
    diagonalWebMeters: 0,
    totalMeters: 0,
  };

  members.forEach((member) => {
    const lengthMeters = memberLength(member);
    totals.totalMeters += lengthMeters;
    if (member.memberKind === 'bottom_chord') {
      totals.bottomChordMeters += lengthMeters;
    } else if (isTopChord(member.memberKind)) {
      totals.topChordMeters += lengthMeters;
    } else if (member.memberKind === 'vertical_web') {
      totals.verticalWebMeters += lengthMeters;
    } else if (member.memberKind === 'diagonal_web') {
      totals.diagonalWebMeters += lengthMeters;
    }
  });

  return totals;
}

function resolveLoadSummary(params: {
  geometry: TrussDesignGeometrySummary;
  criteria: TrussDesignCriteria;
}): TrussDesignLoadSummary {
  const gravityCriteria = params.criteria.gravity;
  const topChordLoadPsf = gravityCriteria.tcllPsf + gravityCriteria.tcdlPsf;
  const bottomChordLoadPsf = gravityCriteria.bcllPsf + gravityCriteria.bcdlPsf;
  const totalGravityLoadPsf = topChordLoadPsf + bottomChordLoadPsf;
  const spacingFt = params.geometry.trussSpacingFeet;
  const totalLineLoadPlf = totalGravityLoadPsf * spacingFt;
  const spanFeet = params.geometry.spanFeet;
  const gravity: TrussGravityLoadSummary = {
    spacingFt,
    topChordLoadPsf,
    bottomChordLoadPsf,
    totalGravityLoadPsf,
    topChordLineLoadPlf: topChordLoadPsf * spacingFt,
    bottomChordLineLoadPlf: bottomChordLoadPsf * spacingFt,
    totalLineLoadPlf,
    simpleSpanReactionLbs: (totalLineLoadPlf * spanFeet) / 2,
    maxSimpleSpanMomentLbFt: (totalLineLoadPlf * spanFeet * spanFeet) / 8,
    totalLoadPerTrussLbs: totalLineLoadPlf * spanFeet,
  };

  const windCriteria = params.criteria.wind;
  const wind = windCriteria.enabled
    ? resolveWindSummary({ windCriteria, geometry: params.geometry })
    : null;

  const spanInches = params.geometry.spanMeters * inchesPerMeter;
  return {
    gravity,
    wind,
    deflection: {
      spanInches,
      limitsInches: params.criteria.deflection.limitRatios.map((ratio) => ({
        ratio,
        limitInches: spanInches / ratio,
      })),
      estimatedDeflectionInches: params.criteria.deflection.estimatedDeflectionInches ?? null,
      note: 'Calculated truss deflection requires engineered member properties / truss analysis.',
    },
  };
}

function resolveWindSummary(params: {
  windCriteria: TrussWindCriteria;
  geometry: TrussDesignGeometrySummary;
}): TrussWindLoadSummary {
  const qzPsf =
    0.00256 *
    params.windCriteria.kz *
    params.windCriteria.kzt *
    params.windCriteria.kd *
    params.windCriteria.speedMph *
    params.windCriteria.speedMph;
  const pressurePsf =
    qzPsf * params.windCriteria.externalPressureCoefficient -
    qzPsf * params.windCriteria.internalPressureCoefficient;
  const windLineLoadPlf = pressurePsf * params.geometry.trussSpacingFeet;
  const windReactionLbs = (windLineLoadPlf * params.geometry.spanFeet) / 2;
  return {
    qzPsf,
    pressurePsf,
    windLineLoadPlf,
    windReactionLbs,
    conceptualUpliftReactionLbs: Math.max(0, -windReactionLbs),
    conceptualHorizontalReactionLbs: Math.abs(windReactionLbs),
  };
}

function resolveReactionSummary(params: {
  loads: TrussDesignLoadSummary;
  criteria: TrussDesignCriteria;
  warnings: readonly TrussDesignWarning[];
}): TrussReactionSummary {
  const warningNotes = params.warnings
    .filter((warning) => warning.code !== 'preliminary_conceptual_design')
    .map((warning) => warning.message);
  return {
    gravityLeftReactionLbs: params.loads.gravity.simpleSpanReactionLbs,
    gravityRightReactionLbs: params.loads.gravity.simpleSpanReactionLbs,
    nonGravityLeftUpliftLbs: params.loads.wind?.conceptualUpliftReactionLbs ?? null,
    nonGravityRightUpliftLbs: params.loads.wind?.conceptualUpliftReactionLbs ?? null,
    conceptualHorizontalReactionLbs: params.loads.wind?.conceptualHorizontalReactionLbs ?? null,
    bearingWidthInches: params.criteria.bearing.bearingWidthInches,
    minimumRequiredBearingInches: params.criteria.bearing.minimumRequiredBearingInches,
    notes: [
      `Bearings require ${formatInches(params.criteria.bearing.minimumRequiredBearingInches, 1)} minimum seat unless engineered otherwise.`,
      'Reactions are preliminary simple-span estimates.',
      ...warningNotes,
    ],
  };
}

function resolveWarnings(params: {
  baseWarnings: readonly TrussDesignWarning[];
  representativeTruss: TrussPlacement;
  geometry: TrussDesignGeometrySummary;
  windEnabled: boolean;
}): TrussDesignWarning[] {
  const warnings = [...params.baseWarnings];
  const profileRule = params.representativeTruss.webProfileId
    ? TRUSS_WEB_PROFILE_RULES.find((rule) => rule.profileId === params.representativeTruss.webProfileId)
    : undefined;

  if (profileRule) {
    if (params.geometry.spanFeet < profileRule.minSpanFt || params.geometry.spanFeet > profileRule.maxSpanFt) {
      warnings.push({
        code: 'truss_profile_span_review',
        message: `${profileRule.label} is outside its conceptual span range for ${formatFeet(params.geometry.spanFeet, 1)}.`,
        severity: 'warning',
      });
    }
  } else if (params.geometry.spanFeet > 80) {
    warnings.push({
      code: 'truss_span_requires_engineering_review',
      message: `Truss span ${formatFeet(params.geometry.spanFeet, 1)} exceeds the conceptual truss profile range.`,
      severity: 'warning',
    });
  }

  if (params.windEnabled) {
    warnings.push({
      code: 'conceptual_wind_loads',
      message: 'Wind results are conceptual unless project-specific coefficients and full code load cases are entered.',
      severity: 'warning',
    });
  }

  warnings.push({
    code: 'deflection_requires_engineering',
    message: 'Calculated truss deflection requires engineered member properties / truss analysis.',
    severity: 'info',
  });

  return warnings;
}

function buildDesignSections(summary: TrussDesignSummary): TrussDesignSection[] {
  if (!summary.geometry || !summary.loads || !summary.reactions) return [];

  return [
    {
      title: 'Loading Criteria',
      rows: [
        { label: 'TCLL', value: formatPsf(summary.criteria.gravity.tcllPsf) },
        { label: 'TCDL', value: formatPsf(summary.criteria.gravity.tcdlPsf) },
        { label: 'BCLL', value: formatPsf(summary.criteria.gravity.bcllPsf) },
        { label: 'BCDL', value: formatPsf(summary.criteria.gravity.bcdlPsf) },
        { label: 'Des Ld', value: formatPsf(summary.loads.gravity.totalGravityLoadPsf) },
        { label: 'Spacing', value: `${formatFeet(summary.geometry.trussSpacingFeet, 2)} / ${formatInches(summary.geometry.trussSpacingInches, 1)}` },
      ],
    },
    {
      title: 'Span / Geometry',
      rows: [
        { label: 'Span', value: `${formatMeters(summary.geometry.spanMeters)} / ${formatFeet(summary.geometry.spanFeet)}` },
        { label: 'Rise', value: formatMeters(summary.geometry.riseMeters) },
        { label: 'Run', value: formatMeters(summary.geometry.runMeters) },
        { label: 'Pitch', value: formatPitchLabel(summary.geometry.pitchRisePer12) },
      ],
    },
  ];
}

function isTopChord(kind: SteelMemberKind): boolean {
  return kind === 'top_chord_left' ||
    kind === 'top_chord_right' ||
    kind === 'top_chord_left_eave_extension' ||
    kind === 'top_chord_right_eave_extension';
}

function memberLength(member: SteelMemberSegment): number {
  return distance3(member.start, member.end);
}

function planDistance(a: Pick<RoofVec3, 'x' | 'z'>, b: Pick<RoofVec3, 'x' | 'z'>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distance3(a: RoofVec3, b: RoofVec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return 'NA';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
