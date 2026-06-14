/**
 * Resolves CSI division codes for scope-import activity titles.
 * Earthwork (31) vs Concrete (03) disambiguation for Import from Scope.
 */

const EARTHWORK_TITLE_PATTERNS: RegExp[] = [
  /\bexcavat/i,
  /\bexcavation\b/i,
  /\bfoundation excavation\b/i,
  /\bfooting excavation\b/i,
  /\bexcavat\w*\s+for\s+(the\s+)?foundation\b/i,
  /\bearthwork\b/i,
  /\bgrading\b/i,
  /\brough\s+grade\b/i,
  /\btrenching\b/i,
  /\bbackfill\b/i,
  /\bsite prep(?:aration)?\b/i,
  /\bcompaction\b/i,
  /\bsubgrade\b/i,
  /\baggregate base\b/i,
  /\bhaul[- ]?off\b/i,
  /\bspoil/i,
  /\bcut and fill\b/i,
  /\bcut\/fill\b/i,
  /\b(?:^|\s)cut\b/i,
  /\b(?:^|\s)fill\b/i,
];

const CONCRETE_TITLE_PATTERNS: RegExp[] = [
  /\bplace\s+.+\s+concrete\b/i,
  /\bconcrete placement\b/i,
  /\bfooting concrete\b/i,
  /\bfoundation concrete\b/i,
  /\bslab on grade\b/i,
  /\bslab concrete\b/i,
  /\brebar\b/i,
  /\breinforcement\b/i,
  /\bformwork\b/i,
  /\bvapor barrier\b/i,
  /\bfinishing\b/i,
  /\bcuring\b/i,
  /\bcontrol joints\b/i,
  /\bpour concrete\b/i,
  /\bcast[- ]in[- ]place\b/i,
  /\bcontinuous footings\b/i,
  /\banchor bolt\b/i,
  /\bsill plate\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Corrects a proposed division code based on activity title keywords.
 * Earthwork patterns take precedence over ambiguous "foundation" wording.
 */
export function resolveScopeActivityDivisionCode(
  activityTitle: string,
  proposedDivisionCode: string,
): string {
  const title = activityTitle.trim();
  if (!title) return proposedDivisionCode;

  const lower = title.toLowerCase();

  if (matchesAny(lower, EARTHWORK_TITLE_PATTERNS)) {
    if (matchesAny(lower, CONCRETE_TITLE_PATTERNS) && /\bplace\b.*\bconcrete\b/i.test(lower)) {
      return '03';
    }
    return '31';
  }

  if (matchesAny(lower, CONCRETE_TITLE_PATTERNS) || /\bconcrete\b/i.test(lower)) {
    return '03';
  }

  return proposedDivisionCode;
}

/** Whether scope text implies earthwork division inference. */
export function scopeTextImpliesEarthwork(scopeText: string): boolean {
  const lower = scopeText.toLowerCase();
  return (
    /\b(grading|excavat|trench|backfill|site prep|earthwork|cleanup|debris|haul|compaction|subgrade|cut and fill|cut\/fill)\b/.test(
      lower,
    ) || matchesAny(lower, EARTHWORK_TITLE_PATTERNS)
  );
}

/** Whether scope text implies concrete division inference (excluding pure excavation). */
export function scopeTextImpliesConcrete(scopeText: string): boolean {
  const lower = scopeText.toLowerCase();
  if (scopeTextImpliesEarthwork(lower) && !/\b(concrete|rebar|formwork|slab on grade)\b/.test(lower)) {
    return false;
  }
  return /\b(concrete|slab on grade|rebar|formwork|footing concrete|foundation concrete|anchor bolt|sill plate)\b/.test(
    lower,
  );
}
