import type { Project } from '../types';
import type { ProposalData } from '../types/proposal';
import { formatPlacementPourDateTime } from './placementPourDate';
import {
  hydrateProposalAddresses,
  mergeProjectIntoProposalFields,
  mergeProjectJobsiteIntoClientAddress,
} from './proposalAddress';
import {
  buildProposalLineItemsFromProject,
  getProjectEstimateSourceLabels,
  projectHasImportablePricing,
} from './proposalPricingImport';
import { hydrateProposalPricing } from './proposalPricing';
import { proposalIndirectFromData } from '../components/proposals/ProposalPricingEditor';
import { formatUSPhoneNumber } from './phoneFormat';

type CompanyTaxSettings = {
  taxSystem?: string;
  taxRatePercent?: number;
  taxApplication?: string;
};

export function buildDefaultProposalTitle(projectName: string): string {
  const name = projectName.trim();
  return name ? `${name} - Proposal` : 'Proposal';
}

/** Scope from project description, or a summary from saved estimate sources. */
export function resolveProjectScopeOfWork(project: Project): string {
  const description = project.description?.trim();
  if (description) return description;

  const sources = getProjectEstimateSourceLabels(project);
  if (sources.length === 0) return '';

  return `This proposal covers ${sources.join(', ').toLowerCase()} work documented in the project estimate.`;
}

export function resolveProjectDateLabel(project: Pick<Project, 'pourDate'>): string | undefined {
  if (!project.pourDate) return undefined;
  return formatPlacementPourDateTime(project.pourDate) ?? undefined;
}

export function buildIntroductionFromProject(project: Project): string {
  const projectName = project.name?.trim() || 'your project';
  const scopeText = project.description?.trim();
  if (scopeText) {
    return `We are pleased to submit this proposal for ${projectName}. ${scopeText}`;
  }
  return `We are pleased to submit this proposal for ${projectName}.`;
}

export interface ImportProjectIntoProposalOptions {
  /** When true, only fill empty proposal fields (default). When false, overwrite from project. */
  overwriteEmptyOnly?: boolean;
  importPricing?: boolean;
  companySettings?: CompanyTaxSettings;
}

function shouldFill(current: string | undefined, overwriteEmptyOnly: boolean): boolean {
  return overwriteEmptyOnly ? !current?.trim() : true;
}

/** Merge selected project fields into proposal snapshot data. */
export function importProjectIntoProposal(
  current: ProposalData,
  project: Project,
  options: ImportProjectIntoProposalOptions = {},
): ProposalData {
  const overwriteEmptyOnly = options.overwriteEmptyOnly !== false;
  const scope = resolveProjectScopeOfWork(project);
  const projectDate = resolveProjectDateLabel(project);
  const ci = project.clientInfo;

  let next = mergeProjectIntoProposalFields(current, project);

  if (shouldFill(next.projectTitle, overwriteEmptyOnly) && project.name?.trim()) {
    next = { ...next, projectTitle: project.name.trim() };
  }

  if (shouldFill(next.scope, overwriteEmptyOnly) && scope) {
    next = { ...next, scope };
  }

  if (shouldFill(next.introduction, overwriteEmptyOnly)) {
    next = { ...next, introduction: buildIntroductionFromProject(project) };
  }

  if (shouldFill(next.date, overwriteEmptyOnly) && projectDate) {
    next = { ...next, date: projectDate };
  }

  if (shouldFill(next.clientEmail, overwriteEmptyOnly) && ci?.clientEmail?.trim()) {
    next = { ...next, clientEmail: ci.clientEmail.trim() };
  }

  if (shouldFill(next.clientPhone, overwriteEmptyOnly) && ci?.clientPhone?.trim()) {
    next = {
      ...next,
      clientPhone: formatUSPhoneNumber(ci.clientPhone.trim()) || ci.clientPhone.trim(),
    };
  }

  next = mergeProjectJobsiteIntoClientAddress(next, project.jobsiteAddress);

  if (options.importPricing && projectHasImportablePricing(project)) {
    const lineItems = buildProposalLineItemsFromProject(project);
    const companySettings = options.companySettings;
    next = hydrateProposalPricing(
      hydrateProposalAddresses({
        ...next,
        ...lineItems,
        pricingIndirect: {
          ...proposalIndirectFromData(next, companySettings),
          wasteFactorPercent: project.wasteFactor ?? next.pricingIndirect?.wasteFactorPercent ?? 10,
        },
      }),
      companySettings,
    );
  }

  return next;
}

export function proposalClientInfoFromData(
  data: ProposalData,
): Pick<
  ProposalData,
  'clientName' | 'clientCompany' | 'clientPhone' | 'clientEmail' | 'clientAddressParts'
> {
  return {
    clientName: data.clientName,
    clientCompany: data.clientCompany,
    clientPhone: data.clientPhone,
    clientEmail: data.clientEmail,
    clientAddressParts: data.clientAddressParts,
  };
}

export function projectClientInfoFromProposalData(data: ProposalData) {
  return {
    clientName: data.clientName.trim(),
    clientCompany: data.clientCompany?.trim(),
    clientPhone: data.clientPhone?.trim(),
    clientEmail: data.clientEmail?.trim(),
    clientAddressSameAsJobsite: false,
    clientAddress: data.clientAddressParts,
  };
}
