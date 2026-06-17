import type { Profile } from '../types/fieldPlanner';
import type { Project } from '../types';
import { formatUSAddress, parseLegacyUSAddress } from '../types/address';
import type { WeatherForecastWidgetConfig, WeatherSourceKind } from '../lib/dashboardLayout';
import {
  defaultJobsiteProjectId,
  projectsWithJobsite,
  type ProjectJobsiteOption,
} from './weatherWidgetProjects';

export interface MyWeatherLocation {
  query: string;
  label: string;
}

export interface WeatherSourceSelection {
  source: WeatherSourceKind | 'setup';
  projectId: string | null;
}

function profileAddressQuery(profile: Profile | null | undefined): string | null {
  if (!profile) return null;
  const query = formatUSAddress({
    street: profile.businessAddressStreet ?? '',
    street2: profile.businessAddressStreet2 ?? '',
    city: profile.businessAddressCity ?? '',
    state: profile.businessAddressState ?? '',
    zip: profile.businessAddressPostalCode ?? '',
  });
  return query.trim() || null;
}

function profileAddressLabel(profile: Profile | null | undefined): string | null {
  if (!profile) return null;
  const city = profile.businessAddressCity?.trim();
  const state = profile.businessAddressState?.trim();
  const cityState = [city, state].filter(Boolean).join(', ');
  return cityState || null;
}

function companyAddressQuery(legacyAddress: string | null | undefined): string | null {
  const raw = legacyAddress?.trim();
  if (!raw) return null;
  const parsed = parseLegacyUSAddress(raw);
  const query = formatUSAddress(parsed);
  return query.trim() || null;
}

function companyAddressLabel(legacyAddress: string | null | undefined): string | null {
  const raw = legacyAddress?.trim();
  if (!raw) return null;
  const parsed = parseLegacyUSAddress(raw);
  const cityState = [parsed.city?.trim(), parsed.state?.trim()].filter(Boolean).join(', ');
  return cityState || null;
}

/** Resolve a geocode query + short label for My Weather. */
export function resolveMyWeatherLocation(
  profile: Profile | null | undefined,
  companyAddress: string | null | undefined,
): MyWeatherLocation | null {
  const profileQuery = profileAddressQuery(profile);
  if (profileQuery) {
    return {
      query: profileQuery,
      label: profileAddressLabel(profile) ?? 'My location',
    };
  }

  const companyQuery = companyAddressQuery(companyAddress);
  if (companyQuery) {
    return {
      query: companyQuery,
      label: companyAddressLabel(companyAddress) ?? 'Company location',
    };
  }

  return null;
}

export function hasMyWeatherLocation(
  profile: Profile | null | undefined,
  companyAddress: string | null | undefined,
): boolean {
  return resolveMyWeatherLocation(profile, companyAddress) != null;
}

export function resolveDefaultWeatherSource(
  profile: Profile | null | undefined,
  companyAddress: string | null | undefined,
  projects: Project[],
  saved?: WeatherForecastWidgetConfig | null,
): WeatherSourceSelection {
  const myWeather = resolveMyWeatherLocation(profile, companyAddress);
  const siteOptions = projectsWithJobsite(projects);

  if (saved?.selectedWeatherSource === 'my' && myWeather) {
    return { source: 'my', projectId: null };
  }

  if (saved?.selectedWeatherSource === 'project' && saved.selectedProjectId) {
    const exists = siteOptions.some((opt) => opt.id === saved.selectedProjectId);
    if (exists) {
      return { source: 'project', projectId: saved.selectedProjectId };
    }
  }

  if (myWeather) {
    return { source: 'my', projectId: null };
  }

  const projectId = defaultJobsiteProjectId(projects);
  if (projectId) {
    return { source: 'project', projectId };
  }

  return { source: 'setup', projectId: null };
}

export function weatherSubtitleLine(
  source: WeatherSourceKind,
  locationLabel: string,
): string {
  if (source === 'my') {
    return `My Weather · ${locationLabel}`;
  }
  return `Jobsite forecast · ${locationLabel}`;
}

export function activeProjectOption(
  projectId: string | null,
  siteOptions: ProjectJobsiteOption[],
): ProjectJobsiteOption | null {
  if (!projectId) return null;
  return siteOptions.find((opt) => opt.id === projectId) ?? null;
}
