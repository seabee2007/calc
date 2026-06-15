import type { DimensionParts, DimensionValue } from './constructionCalculatorTypes';
import { buildDimensionValue } from './constructionCalculatorFormatters';
import { toDecimalInches } from './constructionDimensionMath';

/**
 * Parse construction dimension text into a DimensionValue.
 * Returns null for unparseable input (never throws).
 */
export function parseConstructionDimension(text: string): DimensionValue | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const normalized = trimmed
      .replace(/″|''/g, '"')
      .replace(/′|'/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Decimal feet: "9.5 ft", ".5 ft", "10.5 FT"
    const decimalFeetMatch = normalized.match(/^(-?\d*\.?\d+)\s*(?:ft|feet|foot)\.?$/i);
    if (decimalFeetMatch) {
      const feet = parseFloat(decimalFeetMatch[1]);
      if (!Number.isFinite(feet)) return null;
      return buildDimensionValue({ feet: 0, inches: feet * 12 });
    }

    // Decimal inches: "9.875 in", "112 in"
    const decimalInchesMatch = normalized.match(/^(-?\d*\.?\d+)\s*(?:in|inch|inches|"*)$/i);
    if (decimalInchesMatch && !normalized.includes("'")) {
      const inches = parseFloat(decimalInchesMatch[1]);
      if (!Number.isFinite(inches)) return null;
      return buildDimensionValue({ inches });
    }

    // Bare inches with quote: "112""
    const bareInchesQuote = normalized.match(/^(-?\d+(?:\.\d+)?)"$/);
    if (bareInchesQuote) {
      const inches = parseFloat(bareInchesQuote[1]);
      if (!Number.isFinite(inches)) return null;
      return buildDimensionValue({ inches });
    }

    // Feet + inches + optional fraction: 9' 3 1/2", 9 ft 3 in, 9-3 1/2
    const feetInchPatterns = [
      /^(-?\d+)\s*(?:'|ft|feet)\s*(-?\d+(?:\s+\d+\/\d+)?)\s*(?:"|in|inches)?$/i,
      /^(-?\d+)\s*-\s*(-?\d+(?:\s+\d+\/\d+)?)$/,
      /^(-?\d+)\s*(?:'|ft)\s*(-?\d+(?:\s+\d+\/\d+)?)$/i,
    ];

    for (const pattern of feetInchPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const feet = parseInt(match[1], 10);
        const inchPart = match[2].trim();
        const parts = parseInchFractionPart(inchPart);
        if (!parts) return null;
        return buildDimensionValue({ feet, ...parts });
      }
    }

    // Feet only: 9', 9 ft
    const feetOnlyMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet)\.?$/i);
    if (feetOnlyMatch) {
      const val = parseFloat(feetOnlyMatch[1]);
      if (!Number.isFinite(val)) return null;
      if (String(feetOnlyMatch[1]).includes('.')) {
        return buildDimensionValue({ inches: val * 12 });
      }
      return buildDimensionValue({ feet: val });
    }

    // Fraction inches only: 4 1/2", 4-1/2
    const fracInchesMatch = normalized.match(/^(-?\d+)\s+(\d+)\/(\d+)\s*"?\s*$/);
    if (fracInchesMatch) {
      return buildDimensionValue({
        inches: parseInt(fracInchesMatch[1], 10),
        numerator: parseInt(fracInchesMatch[2], 10),
        denominator: parseInt(fracInchesMatch[3], 10),
      });
    }

    const fracOnlyMatch = normalized.match(/^(-?\d+)\/(\d+)\s*"?\s*$/);
    if (fracOnlyMatch) {
      return buildDimensionValue({
        numerator: parseInt(fracOnlyMatch[1], 10),
        denominator: parseInt(fracOnlyMatch[2], 10),
      });
    }

    // Whole inches only: 8 in, 8"
    const wholeInchesMatch = normalized.match(/^(-?\d+)\s*(?:"|in)?$/i);
    if (wholeInchesMatch && !normalized.includes("'") && !normalized.includes('-')) {
      const inches = parseInt(wholeInchesMatch[1], 10);
      if (!Number.isFinite(inches)) return null;
      return buildDimensionValue({ inches });
    }

    // Dash fraction inches: 9-3 1/2 (already handled above) or 3-1/2
    const dashFracMatch = normalized.match(/^(-?\d+)\s*-\s*(\d+)\/(\d+)$/);
    if (dashFracMatch) {
      return buildDimensionValue({
        inches: parseInt(dashFracMatch[1], 10),
        numerator: parseInt(dashFracMatch[2], 10),
        denominator: parseInt(dashFracMatch[3], 10),
      });
    }

    return null;
  } catch {
    return null;
  }
}

function parseInchFractionPart(part: string): Pick<DimensionParts, 'inches' | 'numerator' | 'denominator'> | null {
  const fracMatch = part.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (fracMatch) {
    return {
      inches: parseInt(fracMatch[1], 10),
      numerator: parseInt(fracMatch[2], 10),
      denominator: parseInt(fracMatch[3], 10),
    };
  }
  const whole = parseInt(part, 10);
  if (Number.isFinite(whole)) {
    return { inches: whole };
  }
  return null;
}

export function dimensionValueToDecimalInches(value: DimensionValue): number {
  if (value.parts) {
    return toDecimalInches(value.parts);
  }
  return value.decimalInches;
}
