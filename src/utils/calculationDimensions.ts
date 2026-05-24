import type { Calculation } from '../types/index';
import type { MixProfileType } from '../types/curing';
import type { LengthUnit } from '../types';

function formatDim(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (Math.abs(value - Math.round(value)) < 0.01) {
    return String(Math.round(value));
  }
  return value.toFixed(1);
}

/** Thickness-like dimensions are stored as decimal feet — show in inches. */
function formatThicknessInches(thicknessFt: number): string {
  if (!Number.isFinite(thicknessFt) || thicknessFt <= 0) return '';
  return formatDim(thicknessFt * 12);
}

function lengthUnitLabel(unit: LengthUnit): string {
  switch (unit) {
    case 'feet':
      return 'ft';
    case 'inches':
      return 'in';
    case 'meters':
      return 'm';
    case 'centimeters':
      return 'cm';
    default:
      return 'ft';
  }
}

const VALID_PSI = ['2500', '3000', '4000', '5000'] as const;

const PSI_FROM_MIX_PROFILE: Partial<Record<MixProfileType, string>> = {
  standard: '3000',
  highEarly: '4000',
  highStrength: '5000',
  rapidSet: '4000',
};

/** Resolve PSI from a saved calculation (direct field or mix profile fallback). */
export function getCalculationPsi(calculation: Calculation | undefined): string | null {
  if (!calculation) return null;

  if (calculation.psi != null && String(calculation.psi).trim() !== '') {
    const digits = String(calculation.psi).replace(/[^\d]/g, '');
    if (VALID_PSI.includes(digits as (typeof VALID_PSI)[number])) {
      return digits;
    }
  }

  if (calculation.mixProfile && PSI_FROM_MIX_PROFILE[calculation.mixProfile]) {
    return PSI_FROM_MIX_PROFILE[calculation.mixProfile] ?? null;
  }

  return null;
}

/** Human-readable area / footprint from a saved concrete calculation. */
export function formatCalculationSlabSize(
  calculation: Calculation | undefined,
  lengthUnit: LengthUnit = 'feet',
): string {
  if (!calculation?.dimensions) return '';

  const d = calculation.dimensions;
  const unit = lengthUnitLabel(lengthUnit);

  switch (calculation.type) {
    case 'slab':
    case 'sidewalk': {
      const length = formatDim(d.length);
      const width = formatDim(d.width);
      if (!length || !width) return '';
      const thickness = formatThicknessInches(d.thickness);
      const area = `${length} × ${width} ${unit}`;
      return thickness ? `${area} (${thickness} in thick)` : area;
    }
    case 'thickened_edge_slab': {
      const length = formatDim(d.length);
      const width = formatDim(d.width);
      if (!length || !width) return '';
      const base = formatThicknessInches(d.baseThickness ?? d.base_thickness);
      const area = `${length} × ${width} ${unit}`;
      return base ? `${area} (${base} in base)` : area;
    }
    case 'footer': {
      const length = formatDim(d.length);
      const width = formatDim(d.width);
      if (!length || !width) return '';
      return `${length} × ${width} ${unit}`;
    }
    case 'column': {
      const diameter = formatDim(d.diameter);
      if (diameter) {
        const height = formatDim(d.height);
        return height ? `Ø ${diameter} ${unit} × ${height} ${unit} high` : `Ø ${diameter} ${unit}`;
      }
      const length = formatDim(d.length);
      const width = formatDim(d.width);
      const height = formatDim(d.height);
      if (!length || !width) return '';
      return height
        ? `${length} × ${width} ${unit} × ${height} ${unit} high`
        : `${length} × ${width} ${unit}`;
    }
    default:
      return '';
  }
}
