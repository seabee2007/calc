import type { PlywoodCeilingSettings } from '../types';

/** 2" square tube (50.8 mm). */
export const DEFAULT_PLYWOOD_CEILING_TUBE_SIZE_METERS = 0.0508;

/** 24" on center (609.6 mm). */
export const DEFAULT_PLYWOOD_CEILING_BRACE_SPACING_METERS = 0.6096;

/** 4' sheet width (1219.2 mm) — spans the short building dimension per row. */
export const DEFAULT_PLYWOOD_SHEET_WIDTH_METERS = 1.2192;

/** 8' sheet length (2438.4 mm) — runs along the long building dimension. */
export const DEFAULT_PLYWOOD_SHEET_LENGTH_METERS = 2.4384;

/** 3/4" plywood (19.05 mm). */
export const DEFAULT_PLYWOOD_SHEET_THICKNESS_METERS = 0.01905;

/** Half-sheet stagger (4'). */
export const DEFAULT_PLYWOOD_STAGGER_OFFSET_METERS = 1.2192;

/** Visible reveal between adjacent sheets. */
export const DEFAULT_PLYWOOD_PANEL_GAP_METERS = 0.003;

/** Default light plywood finish color. */
export const DEFAULT_PLYWOOD_CEILING_COLOR = '#d4b896';

export const DEFAULT_PLYWOOD_CEILING_WASTE_FACTOR = 0.1;

export function defaultPlywoodCeilingSettings(): PlywoodCeilingSettings {
  return {
    enabled: false,
    ceilingHeightMeters: 2.7,
    plywoodColor: DEFAULT_PLYWOOD_CEILING_COLOR,
    sheetWidthMeters: DEFAULT_PLYWOOD_SHEET_WIDTH_METERS,
    sheetLengthMeters: DEFAULT_PLYWOOD_SHEET_LENGTH_METERS,
    sheetThicknessMeters: DEFAULT_PLYWOOD_SHEET_THICKNESS_METERS,
    braceSpacingMeters: DEFAULT_PLYWOOD_CEILING_BRACE_SPACING_METERS,
    tubeSizeMeters: DEFAULT_PLYWOOD_CEILING_TUBE_SIZE_METERS,
    staggerOffsetMeters: DEFAULT_PLYWOOD_STAGGER_OFFSET_METERS,
    panelGapMeters: DEFAULT_PLYWOOD_PANEL_GAP_METERS,
    wasteFactor: DEFAULT_PLYWOOD_CEILING_WASTE_FACTOR,
  };
}

export function resolvePlywoodCeilingSettings(
  partial: Partial<PlywoodCeilingSettings> | undefined,
): PlywoodCeilingSettings {
  const defaults = defaultPlywoodCeilingSettings();
  if (!partial) return defaults;
  return {
    ...defaults,
    ...partial,
    ceilingHeightMeters: Math.max(0.5, partial.ceilingHeightMeters ?? defaults.ceilingHeightMeters),
    sheetWidthMeters: Math.max(0.1, partial.sheetWidthMeters ?? defaults.sheetWidthMeters),
    sheetLengthMeters: Math.max(0.1, partial.sheetLengthMeters ?? defaults.sheetLengthMeters),
    sheetThicknessMeters: Math.max(0.006, partial.sheetThicknessMeters ?? defaults.sheetThicknessMeters),
    braceSpacingMeters: Math.max(0.2, partial.braceSpacingMeters ?? defaults.braceSpacingMeters),
    tubeSizeMeters: Math.max(0.02, partial.tubeSizeMeters ?? defaults.tubeSizeMeters),
    staggerOffsetMeters: Math.max(0, partial.staggerOffsetMeters ?? defaults.staggerOffsetMeters),
    panelGapMeters: Math.max(0, partial.panelGapMeters ?? defaults.panelGapMeters),
    wasteFactor: Math.max(0, partial.wasteFactor ?? defaults.wasteFactor),
    plywoodColor:
      typeof partial.plywoodColor === 'string' && partial.plywoodColor.trim().length > 0
        ? partial.plywoodColor.trim()
        : defaults.plywoodColor,
  };
}
