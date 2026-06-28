export type TrussWebProfileId =
  | 'king_post'
  | 'queen_post'
  | 'fink'
  | 'howe'
  | 'double_fink'
  | 'double_howe'
  | 'triple_fink';

export type TrussWebProfileMode = 'auto_by_span' | 'manual';

export type TrussWebProfileRule = {
  profileId: TrussWebProfileId;
  label: string;
  minSpanFt: number;
  maxSpanFt: number;
  description: string;
};

export type TrussWebProfileWarningCode =
  | 'truss_span_requires_engineering_review'
  | 'truss_web_profile_manual_out_of_range'
  | 'truss_web_profile_missing';

export type TrussWebProfileSelection = {
  profileId: TrussWebProfileId;
  label: string;
  spanFt: number;
  warning?: string;
  warningCode?: TrussWebProfileWarningCode;
};

export const TRUSS_WEB_PROFILE_RULES: TrussWebProfileRule[] = [
  {
    profileId: 'king_post',
    label: 'King Post',
    minSpanFt: 0,
    maxSpanFt: 16,
    description: 'Simple short-span pitched truss.',
  },
  {
    profileId: 'queen_post',
    label: 'Queen Post',
    minSpanFt: 10,
    maxSpanFt: 24,
    description: 'Short-to-medium span truss with two vertical posts.',
  },
  {
    profileId: 'fink',
    label: 'Fink',
    minSpanFt: 16,
    maxSpanFt: 36,
    description: 'Common W-web truss for typical residential spans.',
  },
  {
    profileId: 'howe',
    label: 'Howe',
    minSpanFt: 24,
    maxSpanFt: 44,
    description: 'K-web style truss for medium spans or heavier conceptual framing.',
  },
  {
    profileId: 'double_fink',
    label: 'Double Fink',
    minSpanFt: 36,
    maxSpanFt: 60,
    description: 'Multi-panel W-web truss for longer spans.',
  },
  {
    profileId: 'double_howe',
    label: 'Double Howe',
    minSpanFt: 40,
    maxSpanFt: 80,
    description: 'Long-span repeated K-web truss.',
  },
  {
    profileId: 'triple_fink',
    label: 'Triple Fink',
    minSpanFt: 54,
    maxSpanFt: 80,
    description: 'Long-span conceptual truss with repeated W panels.',
  },
];

const TRUSS_WEB_PROFILE_LABELS = new Map(
  TRUSS_WEB_PROFILE_RULES.map((rule) => [rule.profileId, rule.label] as const),
);

export function feetToMeters(feet: number): number {
  return feet * 0.3048;
}

export function metersToFeet(meters: number): number {
  return meters / 0.3048;
}

export function isTrussWebProfileId(value: unknown): value is TrussWebProfileId {
  return typeof value === 'string' && TRUSS_WEB_PROFILE_LABELS.has(value as TrussWebProfileId);
}

export function trussWebProfileLabel(profileId: TrussWebProfileId): string {
  return TRUSS_WEB_PROFILE_LABELS.get(profileId) ?? profileId;
}

export function selectTrussWebProfileForSpan(params: {
  spanMeters: number;
  mode?: TrussWebProfileMode;
  manualProfileId?: TrussWebProfileId;
}): TrussWebProfileSelection {
  const spanFt = metersToFeet(params.spanMeters);

  if (params.mode === 'manual') {
    if (!params.manualProfileId) {
      const profileId = autoProfileIdForSpanFt(spanFt);
      return {
        profileId,
        label: trussWebProfileLabel(profileId),
        spanFt,
        warning: 'Manual truss web profile mode is selected, but no manual profile is set. Auto selection was used.',
        warningCode: 'truss_web_profile_missing',
      };
    }

    const manualRule = TRUSS_WEB_PROFILE_RULES.find((rule) => rule.profileId === params.manualProfileId);
    if (manualRule) {
      const outOfRange = spanFt < manualRule.minSpanFt || spanFt > manualRule.maxSpanFt;
      return {
        profileId: manualRule.profileId,
        label: manualRule.label,
        spanFt,
        warning: outOfRange
          ? `${manualRule.label} is outside its conceptual span range for ${spanFt.toFixed(1)} ft.`
          : spanFt > 80
            ? `Truss span ${spanFt.toFixed(1)} ft exceeds the conceptual range. Engineering review required.`
            : undefined,
        warningCode: outOfRange
          ? 'truss_web_profile_manual_out_of_range'
          : spanFt > 80
            ? 'truss_span_requires_engineering_review'
            : undefined,
      };
    }
  }

  const profileId = autoProfileIdForSpanFt(spanFt);
  return {
    profileId,
    label: trussWebProfileLabel(profileId),
    spanFt,
    warning:
      spanFt > 80
        ? `Truss span ${spanFt.toFixed(1)} ft exceeds the conceptual range. Engineering review required.`
        : undefined,
    warningCode: spanFt > 80 ? 'truss_span_requires_engineering_review' : undefined,
  };
}

function autoProfileIdForSpanFt(spanFt: number): TrussWebProfileId {
  if (spanFt <= 16) return 'king_post';
  if (spanFt <= 24) return 'queen_post';
  if (spanFt <= 36) return 'fink';
  if (spanFt <= 44) return 'howe';
  if (spanFt <= 60) return 'double_fink';
  return 'triple_fink';
}
