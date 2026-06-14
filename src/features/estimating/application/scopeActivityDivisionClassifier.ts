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

const DIRECT_MATCHES: Record<string, string[]> = {
  '03': ['concrete', 'slab', 'footing concrete', 'foundation concrete', 'rebar', 'formwork', 'sidewalk', 'driveway', 'curb', 'pad', 'anchor bolt', 'sill plate'],
  '04': ['masonry', 'cmu', 'block', 'brick'],
  '05': ['metal', 'steel', 'metal roof', 'structural steel'],
  '06': ['wood', 'framing', 'carpentry', 'studs', 'sheathing', 'truss'],
  '07': ['roof', 'insulation', 'waterproofing', 'moisture', 'flashing', 'house wrap', 'shingle'],
  '08': ['doors', 'door', 'windows', 'window', 'openings', 'glazing'],
  '09': ['paint', 'drywall', 'flooring', 'ceiling', 'finishes', 'finish', 'trim', 'texture'],
  '22': ['plumbing', 'water line', 'sewer', 'toilet', 'sink'],
  '23': ['hvac', 'air conditioning', 'duct', 'ventilation'],
  '26': ['electrical', 'power', 'lighting', 'panel'],
  '31': ['grading', 'excavation', 'excavate', 'earthwork', 'backfill', 'trenching', 'cleanup', 'debris', 'haul', 'cut', 'fill', 'subgrade', 'compaction', 'site prep', 'aggregate base', 'haul-off', 'spoil'],
  '32': ['paving', 'sidewalk', 'curb', 'fence', 'landscaping', 'parking'],
  '33': ['utility', 'utilities', 'storm', 'water service', 'sewer service'],
};

const BUILDING_SCOPE_PATTERN =
  /\b(building|office|house|facility|structure|single-story|new build|residence|residential)\b/i;

function findDirectMatch(code: string, scopeText: string): string | null {
  const scope = scopeText.toLowerCase();
  return DIRECT_MATCHES[code]?.find((term) => scope.includes(term)) ?? null;
}

/**
 * Deterministic keyword inference for scope division suggestions.
 * Mirrors supabase/functions/suggest-divisions-from-scope keyword fallback.
 */
export function inferDivisionsFromScopeKeywords(scopeText: string): string[] {
  const lower = scopeText.toLowerCase();
  const codes = new Set<string>(['01']);

  if (/\b(remodel|renovation|renovate|addition|demolition|demo|existing|repair|replacement)\b/.test(lower)) {
    codes.add('02');
  }
  if (scopeTextImpliesConcrete(scopeText)) {
    codes.add('03');
  }
  if (/\b(masonry|cmu|block|brick|stone)\b/.test(lower)) {
    codes.add('04');
  }
  if (/\b(metal|steel|structural steel)\b/.test(lower)) {
    codes.add('05');
  }
  if (/\b(wood|framing|lumber|composite|sheathing|truss)\b/.test(lower)) {
    codes.add('06');
  }
  if (/\b(roof|roofing|waterproof|insulation|thermal|moisture|house wrap|shingle)\b/.test(lower)) {
    codes.add('07');
  }
  if (/\b(door|window|opening|glazing)\b/.test(lower)) {
    codes.add('08');
  }
  if (/\b(finish|paint|flooring|tile|drywall|interior|trim|hardware|texture)\b/.test(lower)) {
    codes.add('09');
  }
  if (/\b(plumb|plumbing|fixture|sewer|water line)\b/.test(lower)) {
    codes.add('22');
  }
  if (/\b(hvac|mechanical|air condition|ventilation)\b/.test(lower)) {
    codes.add('23');
  }
  if (/\b(electric|electrical|lighting|power)\b/.test(lower)) {
    codes.add('26');
  }
  if (scopeTextImpliesEarthwork(scopeText)) {
    codes.add('31');
  }
  if (/\b(paving|landscap|fence|parking|curb|sidewalk|site work|exterior)\b/.test(lower)) {
    codes.add('32');
  }
  if (/\b(utilit|storm|sewer|water main|gas line|underground)\b/.test(lower)) {
    codes.add('33');
  }

  for (const code of Object.keys(DIRECT_MATCHES)) {
    if (findDirectMatch(code, scopeText)) codes.add(code);
  }

  if (BUILDING_SCOPE_PATTERN.test(scopeText)) {
    for (const code of ['07', '08', '09', '22', '23', '26']) {
      codes.add(code);
    }
  }

  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
