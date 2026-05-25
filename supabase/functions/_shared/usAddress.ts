export function formatUSAddress(parts: {
  street?: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const streetParts = [parts.street?.trim(), parts.street2?.trim()].filter(Boolean);
  const streetLine = streetParts.join(", ");
  const city = parts.city.trim();
  const state = parts.state.trim().toUpperCase();
  const zip = (parts.zip ?? "").trim();
  const cityStateZip = zip
    ? [city, `${state} ${zip}`.trim()].filter(Boolean).join(", ")
    : [city, state].filter(Boolean).join(", ");
  return [streetLine, cityStateZip, "United States"].filter(Boolean).join(", ");
}

/** Validation for Mapbox geocoding — ZIP optional. */
export function validateUSAddressParts(parts: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string | null {
  if (!parts.street?.trim()) return "Street address is required.";
  if (!parts.city?.trim()) return "City is required.";
  if (!parts.state?.trim()) return "State / territory is required.";
  const zip = parts.zip?.trim() ?? "";
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    return "Enter a valid 5-digit ZIP code.";
  }
  return null;
}
