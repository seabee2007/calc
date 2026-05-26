import { US_STATES_TERRITORIES } from '../constants/usStatesTerritories';

export const US_COUNTRY_LABEL = 'United States' as const;

const VALID_STATE_CODES = new Set(US_STATES_TERRITORIES.map((s) => s.value));

function buildStateNameToCode(): Record<string, string> {
  const map: Record<string, string> = {
    'u.s. virgin islands': 'VI',
    'us virgin islands': 'VI',
    'virgin islands': 'VI',
  };
  for (const { value, label } of US_STATES_TERRITORIES) {
    const name = label.split(/[—–-]/).pop()?.trim().toLowerCase();
    if (name) map[name] = value;
  }
  return map;
}

const STATE_NAME_TO_CODE: Record<string, string> = buildStateNameToCode();

export function isUSStateOrTerritoryName(text: string): boolean {
  return Boolean(STATE_NAME_TO_CODE[text.trim().toLowerCase()]);
}

/** Territory / island name — not a street line (common in Mapbox Guam results). */
export function isTerritoryPlaceName(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(guam|puerto rico|u\.?s\.? virgin islands|virgin islands)$/i.test(t)) {
    return true;
  }
  return isUSStateOrTerritoryName(t);
}

/** Drop leading territory tokens from comma-separated address parts. */
function stripLeadingTerritoryParts(
  parts: string[],
): { parts: string[]; stateHint: string } {
  const remaining = [...parts];
  let stateHint = '';
  while (remaining.length > 0 && isTerritoryPlaceName(remaining[0])) {
    const code = resolveStateCode(remaining[0]);
    if (code) stateHint = code;
    else if (/\bguam\b/i.test(remaining[0])) stateHint = 'GU';
    else if (/\bpuerto rico\b/i.test(remaining[0])) stateHint = 'PR';
    else if (/\bvirgin islands\b/i.test(remaining[0])) stateHint = 'VI';
    remaining.shift();
  }
  return { parts: remaining, stateHint };
}

function pickVerifiedStreet(userStreet: string, parsedStreet: string): string {
  const user = userStreet.trim();
  const parsed = parsedStreet.trim();
  if (!parsed) return user;
  if (isTerritoryPlaceName(parsed)) return user;
  if (user && /\d/.test(user) && !/\d/.test(parsed)) return user;
  const parsedSegments = parsed.split(',').map((s) => s.trim()).filter(Boolean);
  if (
    user &&
    parsedSegments.length > 0 &&
    parsedSegments.every((seg) => isTerritoryPlaceName(seg))
  ) {
    return user;
  }
  return parsed;
}

/** Resolve to a 2-letter state/territory code, or empty if unknown. */
export function resolveStateCode(input: string): string {
  const t = input.trim();
  if (!t) return '';
  if (/^[A-Z]{2}$/i.test(t)) {
    const up = t.toUpperCase();
    return VALID_STATE_CODES.has(up) ? up : '';
  }
  return STATE_NAME_TO_CODE[t.toLowerCase()] ?? '';
}

export function normalizeStateCode(input: string): string {
  return resolveStateCode(input);
}

export interface USAddress {
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: typeof US_COUNTRY_LABEL;
}

export const EMPTY_US_ADDRESS: USAddress = {
  street: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country: US_COUNTRY_LABEL,
};

export function copyUSAddress(addr?: Partial<USAddress> | null): USAddress {
  if (!addr) return { ...EMPTY_US_ADDRESS };
  return {
    street: addr.street ?? '',
    street2: addr.street2 ?? '',
    city: addr.city ?? '',
    state: normalizeStateCode(addr.state ?? ''),
    zip: addr.zip ?? '',
    country: US_COUNTRY_LABEL,
  };
}

/** Project has enough address to pre-fill pricing / planner flows. */
export function hasProjectJobsite(addr?: Partial<USAddress> | null): boolean {
  if (!addr) return false;
  return Boolean(
    addr.city?.trim() &&
      addr.state?.trim() &&
      (addr.street?.trim() || addr.zip?.trim()),
  );
}

export function formatUSAddress(addr: Partial<USAddress>): string {
  const streetParts = [addr.street?.trim(), addr.street2?.trim()].filter(Boolean);
  const streetLine = streetParts.join(', ');
  const city = addr.city?.trim() ?? '';
  const state = (addr.state?.trim() ?? '').toUpperCase();
  const zip = addr.zip?.trim() ?? '';

  if (!city && !state && !zip && !streetLine) return '';

  const cityStateZip = [city, state && zip ? `${state} ${zip}` : state || zip]
    .filter(Boolean)
    .join(', ');

  return [streetLine, cityStateZip, US_COUNTRY_LABEL].filter(Boolean).join(', ');
}

/** Full mailing-style address including ZIP (proposals, exports). */
export function isUSAddressComplete(addr: Partial<USAddress>): boolean {
  const zip = (addr.zip ?? '').trim();
  return Boolean(
    addr.city?.trim() &&
      addr.state?.trim() &&
      zip &&
      /^\d{5}(-\d{4})?$/.test(zip),
  );
}

/** Enough for Mapbox geocoding — street, city, and state/territory; ZIP optional. */
export function isUSAddressGeocodable(addr: Partial<USAddress>): boolean {
  return Boolean(
    addr.street?.trim() && addr.city?.trim() && addr.state?.trim(),
  );
}

export interface USAddressValidation {
  ok: boolean;
  errors: string[];
}

export function validateUSAddress(
  addr: Partial<USAddress>,
  options?: { requireStreet?: boolean; requireZip?: boolean },
): USAddressValidation {
  const errors: string[] = [];
  const requireStreet = options?.requireStreet ?? true;
  const requireZip = options?.requireZip ?? false;

  if (requireStreet && !addr.street?.trim()) {
    errors.push('Street address is required.');
  }
  if (!addr.city?.trim()) {
    errors.push('City is required.');
  }
  if (!addr.state?.trim()) {
    errors.push('State / territory is required.');
  }
  const zip = addr.zip?.trim() ?? '';
  if (requireZip && !zip) {
    errors.push('ZIP code is required.');
  } else if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    errors.push('Enter a valid 5-digit ZIP code.');
  }

  const blob = [addr.street, addr.city, addr.state, addr.zip]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (
    blob &&
    !addr.city?.trim() &&
    /^(guam|puerto rico|virgin islands)$/i.test(blob.trim())
  ) {
    errors.push('Add city (and ZIP if known) — territory name alone is too ambiguous.');
  }

  return { ok: errors.length === 0, errors };
}

/** Parse legacy single-line or pipe-delimited onboarding addresses. */
export function parseLegacyUSAddress(raw: string): USAddress {
  const trimmed = raw.trim();
  if (!trimmed) return { ...EMPTY_US_ADDRESS };

  if (trimmed.includes('|')) {
    const [street = '', street2 = '', city = '', state = '', zip = ''] = trimmed.split('|');
    return {
      street: street.trim(),
      street2: street2.trim(),
      city: city.trim(),
      state: normalizeStateCode(state.trim()),
      zip: zip.replace(/\D/g, '').slice(0, 5),
      country: US_COUNTRY_LABEL,
    };
  }

  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1] ?? '';

  const stateMatch = trimmed.match(
    /\b([A-Z]{2})\b(?=[\s,]*\d{5})|,\s*([A-Za-z ]{2,})\s+(\d{5})/,
  );
  let state = '';
  if (stateMatch) {
    state = normalizeStateCode((stateMatch[1] || stateMatch[2] || '').trim());
  }

  let street = trimmed;
  let city = '';
  if (zip) {
    const beforeZip = trimmed.replace(/\b\d{5}(-\d{4})?\b.*$/, '').trim();
    let parts = beforeZip
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^united states$/i.test(p));
    const stripped = stripLeadingTerritoryParts(parts);
    parts = stripped.parts;
    if (stripped.stateHint && !state) state = stripped.stateHint;

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const stateFromName = STATE_NAME_TO_CODE[lastPart.toLowerCase()];
      if (stateFromName) {
        state = stateFromName;
        city = parts.length >= 3 ? parts[parts.length - 2] : '';
        street = parts.length >= 3 ? parts.slice(0, -2).join(', ') : parts[0];
      } else if (parts.length >= 3 && /^[A-Z]{2}$/i.test(parts[parts.length - 1])) {
        state = resolveStateCode(parts[parts.length - 1]) || parts[parts.length - 1].toUpperCase();
        city = parts[parts.length - 2];
        street = parts.slice(0, -2).join(', ');
      } else {
      const stateOnly = lastPart.match(/^([A-Z]{2})$/i);
      if (stateOnly) {
        state = stateOnly[1].toUpperCase();
        city = parts.length >= 3 ? parts[parts.length - 2] : '';
        street = parts.slice(0, stateOnly ? (city ? -2 : -1) : -1).join(', ');
        if (!city && parts.length === 2) {
          street = parts[0];
        }
      } else {
        city = lastPart.replace(/\b[A-Z]{2}\s*$/i, '').trim();
        street = parts.slice(0, -1).join(', ');
        const abbr = lastPart.match(/\b([A-Z]{2})\s*$/i);
        if (abbr && !state) state = abbr[1].toUpperCase();
      }
      }
    } else if (parts.length === 1 && !state) {
      city = parts[0];
      street = '';
    }
  }

  if (!state && /\bguam\b/i.test(trimmed)) state = 'GU';
  if (!state && /\bpuerto rico\b/i.test(trimmed)) state = 'PR';
  if (!state && /\b(u\.?s\.? )?virgin islands\b/i.test(trimmed)) state = 'VI';

  if (!zip && trimmed.includes(',')) {
    let looseParts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^united states$/i.test(p));
    const looseStripped = stripLeadingTerritoryParts(looseParts);
    looseParts = looseStripped.parts;
    if (looseStripped.stateHint && !state) state = looseStripped.stateHint;
    if (looseParts.length >= 2 && /^[A-Z]{2}$/i.test(looseParts[looseParts.length - 1])) {
      const code = resolveStateCode(looseParts[looseParts.length - 1]);
      if (code) {
        state = code;
        city = looseParts[looseParts.length - 2];
        street = looseParts.slice(0, -2).join(', ');
      }
    } else if (looseParts.length >= 2) {
      city = looseParts[looseParts.length - 1];
      street = looseParts.slice(0, -1).join(', ');
    }
  }

  if (isTerritoryPlaceName(street)) {
    street = '';
  }

  if (state === 'GU' && /\bguam\b/i.test(city)) {
    city = city.replace(/\bguam\b/gi, '').trim();
  }
  if (state === 'PR' && /\bpuerto rico\b/i.test(city)) {
    city = city.replace(/\bpuerto rico\b/gi, '').trim();
  }

  return sanitizeUSAddress({
    street,
    street2: '',
    city,
    state,
    zip,
  });
}

/** Strip city/state/zip tokens from street; normalize state to 2-letter code. */
export function sanitizeUSAddress(addr?: Partial<USAddress> | null): USAddress {
  const base = copyUSAddress(addr);
  let { street, street2, city, state, zip } = base;

  state = resolveStateCode(state);

  const cityTrim = city.trim();
  const cityLower = cityTrim.toLowerCase();

  if (cityTrim && isUSStateOrTerritoryName(cityTrim)) {
    if (!state) state = resolveStateCode(cityTrim);
    city = '';
  }

  if (/^[A-Z]{2}$/i.test(cityTrim) && cityTrim.toUpperCase() === state) {
    city = '';
  }

  if (cityLower && street) {
    const segments = street.split(',').map((p) => p.trim()).filter(Boolean);
    const filtered = segments.filter((seg) => seg.toLowerCase() !== cityLower);
    if (filtered.length > 0 && filtered.length < segments.length) {
      street = filtered.join(', ');
    }
  }

  return {
    street: street.trim(),
    street2: street2.trim(),
    city: cityTrim,
    state,
    zip: zip.replace(/\D/g, '').slice(0, 5),
    country: US_COUNTRY_LABEL,
  };
}

/** Merge Mapbox formatted line with user-entered fields (avoid state landing in city). */
export function mergeVerifiedJobsiteAddress(
  userInput: USAddress,
  formattedLine: string,
): USAddress {
  const user = sanitizeUSAddress(userInput);
  const parsed = parseLegacyUSAddress(formattedLine);

  const state = resolveStateCode(parsed.state) || user.state;
  let city = parsed.city.trim() || user.city;

  if (isUSStateOrTerritoryName(city)) {
    city = user.city;
  }
  if (resolveStateCode(parsed.city)) {
    city = user.city;
  }
  if (!city) {
    city = user.city;
  }

  return sanitizeUSAddress({
    street: pickVerifiedStreet(user.street, parsed.street),
    street2: parsed.street2 || user.street2,
    city,
    state,
    zip: parsed.zip || user.zip,
  });
}

/** Fix jobsite rows where state was saved into the city field or state is a full name. */
export function repairJobsiteAddress(addr?: Partial<USAddress> | null): USAddress {
  return sanitizeUSAddress(addr);
}

/** True when formatted address should geocode within Guam (state GU, zip 969xx, or name). */
export function isGuamAddressString(text: string): boolean {
  const t = text.trim();
  return (
    /\bguam\b/i.test(t) ||
    /\b969(?:1\d|2\d|3[0-2])\b/.test(t) ||
    /(?:^|[,\s])GU(?:\s*,|\s+\d{5}|\s*,|\s+|$)/i.test(t)
  );
}

/** Build address from form fields — preserves spaces while typing (trim only on format/validate). */
/** If a full address was pasted into street only, split into structured fields. */
export function normalizeUSAddressInput(addr: USAddress): USAddress {
  const hasStructured =
    Boolean(addr.city?.trim()) && Boolean(addr.state?.trim());

  if (hasStructured) {
    return { ...addr, country: US_COUNTRY_LABEL };
  }

  const blob = [addr.street, addr.street2, addr.city, addr.state, addr.zip]
    .filter(Boolean)
    .join(', ')
    .trim();

  if (!blob) {
    return { ...addr, country: US_COUNTRY_LABEL };
  }

  const parsed = parseLegacyUSAddress(blob);
  return {
    street: parsed.street || addr.street,
    street2: addr.street2 || parsed.street2,
    city: parsed.city || addr.city,
    state: parsed.state || addr.state,
    zip: parsed.zip || addr.zip,
    country: US_COUNTRY_LABEL,
  };
}

export function usAddressFromFields(fields: {
  jobsiteStreet?: string;
  jobsiteStreet2?: string;
  jobsiteCity?: string;
  jobsiteState?: string;
  jobsiteZip?: string;
}): USAddress {
  return {
    street: fields.jobsiteStreet ?? '',
    street2: fields.jobsiteStreet2 ?? '',
    city: fields.jobsiteCity ?? '',
    state: normalizeStateCode(fields.jobsiteState ?? ''),
    zip: fields.jobsiteZip ?? '',
    country: US_COUNTRY_LABEL,
  };
}
