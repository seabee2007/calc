import type { PourPlannerFormState } from '../types/pourPlanner';
import type { USAddress } from '../types/address';
import { formatUSAddress, usAddressFromFields } from '../types/address';

export function applyUSAddressToPourPlanner(
  fields: Partial<PourPlannerFormState>,
  addr: USAddress,
): Partial<PourPlannerFormState> {
  return {
    ...fields,
    jobsiteStreet: addr.street,
    jobsiteStreet2: addr.street2,
    jobsiteCity: addr.city,
    jobsiteState: addr.state,
    jobsiteZip: addr.zip,
  };
}

export function jobsiteFromPourPlannerForm(form: PourPlannerFormState): USAddress {
  return usAddressFromFields({
    jobsiteStreet: form.jobsiteStreet,
    jobsiteStreet2: form.jobsiteStreet2,
    jobsiteCity: form.jobsiteCity,
    jobsiteState: form.jobsiteState,
    jobsiteZip: form.jobsiteZip,
  });
}

/** Label for UI — structured fields first, not WeatherAPI or ambiguous Mapbox names. */
export function jobsiteDisplayAddress(form: PourPlannerFormState): string {
  const structured = formatUSAddress(jobsiteFromPourPlannerForm(form));
  if (structured) return structured;
  return form.jobsiteAddress.trim();
}

export function batchPlantDisplayLine(form: PourPlannerFormState): string {
  return form.batchPlantAddress.trim();
}

export function hasVerifiedJobsiteCoords(form: PourPlannerFormState): boolean {
  return (
    parsePlannerCoord(form.jobsiteLatitude) != null &&
    parsePlannerCoord(form.jobsiteLongitude) != null
  );
}

export function plannerTravelCoords(form: PourPlannerFormState): {
  jobsite?: { lat: number; lng: number };
  plant?: { lat: number; lng: number };
} {
  const jobsiteLat = parsePlannerCoord(form.jobsiteLatitude);
  const jobsiteLng = parsePlannerCoord(form.jobsiteLongitude);
  const plantLat = parsePlannerCoord(form.batchPlantLatitude);
  const plantLng = parsePlannerCoord(form.batchPlantLongitude);
  return {
    jobsite:
      jobsiteLat != null && jobsiteLng != null
        ? { lat: jobsiteLat, lng: jobsiteLng }
        : undefined,
    plant:
      plantLat != null && plantLng != null
        ? { lat: plantLat, lng: plantLng }
        : undefined,
  };
}

export function parsePlannerCoord(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}
