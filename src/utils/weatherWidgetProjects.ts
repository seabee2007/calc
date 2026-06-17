import type { Project } from '../types';
import { formatUSAddress, hasProjectJobsite } from '../types/address';

export interface ProjectJobsiteOption {
  id: string;
  name: string;
  query: string;
  label: string;
}

export function projectJobsiteQuery(project: Project): string | null {
  if (!hasProjectJobsite(project.jobsiteAddress)) return null;
  const query = formatUSAddress(project.jobsiteAddress!);
  return query.trim() || null;
}

export function jobsiteLabel(project: Project): string {
  const addr = project.jobsiteAddress;
  if (!addr) return project.name;
  const cityState = [addr.city?.trim(), addr.state?.trim()].filter(Boolean).join(', ');
  return cityState || project.name;
}

/** Active projects with enough jobsite address to geocode a forecast query. */
export function projectsWithJobsite(projects: Project[]): ProjectJobsiteOption[] {
  return projects
    .map((project) => {
      const query = projectJobsiteQuery(project);
      if (!query) return null;
      return {
        id: project.id,
        name: project.name,
        query,
        label: jobsiteLabel(project),
      };
    })
    .filter((row): row is ProjectJobsiteOption => row !== null);
}

/** Default: most recently updated project with a jobsite, else first available. */
export function defaultJobsiteProjectId(projects: Project[]): string | null {
  const withSite = projects
    .filter((p) => projectJobsiteQuery(p))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return withSite[0]?.id ?? null;
}
