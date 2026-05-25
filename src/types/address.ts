export const US_COUNTRY_LABEL = 'United States' as const;

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
    const parts = beforeZip.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      city = lastPart.replace(/\b[A-Z]{2}\s*$/i, '').trim();
      street = parts.slice(0, -1).join(', ');
      const abbr = lastPart.match(/\b([A-Z]{2})\s*$/i);
      if (abbr && !state) state = abbr[1].toUpperCase();
    } else if (parts.length === 1 && !state) {
      city = parts[0];
      street = '';
    }
  }

  if (!state && /\bguam\b/i.test(trimmed)) state = 'GU';
  if (!state && /\bpuerto rico\b/i.test(trimmed)) state = 'PR';
  if (!state && /\b(u\.?s\.? )?virgin islands\b/i.test(trimmed)) state = 'VI';

  if (state === 'GU' && /\bguam\b/i.test(city)) {
    city = city.replace(/\bguam\b/gi, '').trim();
  }
  if (state === 'PR' && /\bpuerto rico\b/i.test(city)) {
    city = city.replace(/\bpuerto rico\b/gi, '').trim();
  }

  return {
    street,
    street2: '',
    city,
    state,
    zip,
    country: US_COUNTRY_LABEL,
  };
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  guam: 'GU',
  'puerto rico': 'PR',
  'u.s. virgin islands': 'VI',
  'us virgin islands': 'VI',
  'northern mariana islands': 'MP',
  'american samoa': 'AS',
  'district of columbia': 'DC',
};

export function normalizeStateCode(input: string): string {
  const t = input.trim();
  if (!t) return '';
  if (/^[A-Z]{2}$/i.test(t)) return t.toUpperCase();
  return STATE_NAME_TO_CODE[t.toLowerCase()] ?? t.toUpperCase();
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
