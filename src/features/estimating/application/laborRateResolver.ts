import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import type { ProjectActivityLineItem } from '../domain/constructionActivityTypes';
import { applyLaborRateToLineItem, findDefaultProjectLaborRate, findFirstActiveProjectLaborRate } from './laborPricingCalculator';
import {
  GENERAL_TRADE_ROLE_KEY,
  GENERAL_TRADE_ROLE_NAME,
  buildWorkElementSearchText,
  getLaborRoleNameForKey,
  mapProductionRateToLaborRoleKey,
} from './laborRoleMapping';

export type LaborRateResolutionSource =
  | 'explicit'
  | 'mapped'
  | 'fallback_general_trade'
  | 'fallback_default_rate'
  | 'missing';

export interface WorkElementForLaborResolution {
  activityName: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  keywords?: string[];
}

export interface ResolveLaborRateForWorkElementInput {
  workElement: WorkElementForLaborResolution | ProductionRateLibraryEntry;
  projectLaborRates: readonly ProjectLaborRate[];
  preferredRoleKey?: string | null;
  preferredRoleId?: string | null;
  preferredRoleName?: string | null;
}

export interface ResolvedLaborRate {
  laborRoleId: string | null;
  laborRoleKey: string;
  laborRoleName: string;
  hourlyRateSnapshot: number;
  fullyBurdenedRateSnapshot: number;
  projectRate: ProjectLaborRate | null;
  mappedRoleKey: string;
  mappedRoleName: string;
  resolutionSource: LaborRateResolutionSource;
  warning?: string;
}

function findActiveProjectRateByRoleKey(
  projectRates: readonly ProjectLaborRate[],
  roleKey: string,
): ProjectLaborRate | undefined {
  return projectRates.find((rate) => rate.isActive && rate.roleKey === roleKey);
}

function findActiveProjectRateById(
  projectRates: readonly ProjectLaborRate[],
  roleId: string | null | undefined,
): ProjectLaborRate | undefined {
  if (!roleId) return undefined;
  return projectRates.find((rate) => rate.isActive && rate.id === roleId);
}

function toResolvedRate(
  projectRate: ProjectLaborRate,
  mappedRoleKey: string,
  mappedRoleName: string,
  resolutionSource: Exclude<LaborRateResolutionSource, 'missing'>,
): ResolvedLaborRate {
  return {
    laborRoleId: projectRate.id,
    laborRoleKey: projectRate.roleKey,
    laborRoleName: projectRate.roleName,
    hourlyRateSnapshot: projectRate.hourlyRate,
    fullyBurdenedRateSnapshot: projectRate.fullyBurdenedRate,
    projectRate,
    mappedRoleKey,
    mappedRoleName,
    resolutionSource,
  };
}

function toMissingRate(mappedRoleKey: string, mappedRoleName: string): ResolvedLaborRate {
  return {
    laborRoleId: null,
    laborRoleKey: mappedRoleKey,
    laborRoleName: mappedRoleName,
    hourlyRateSnapshot: 0,
    fullyBurdenedRateSnapshot: 0,
    projectRate: null,
    mappedRoleKey,
    mappedRoleName,
    resolutionSource: 'missing',
    warning: 'Missing labor rate',
  };
}

export interface ResolvedLaborRoleMapping {
  mappedRoleKey: string;
  mappedRoleName: string;
  resolvedRoleKey: string;
  resolvedRoleName: string;
  projectRate: ProjectLaborRate | null;
  usedFallback: boolean;
  warning: string | null;
}

export function resolveLaborRateForWorkElement(
  input: ResolveLaborRateForWorkElementInput,
): ResolvedLaborRate {
  const mappedRoleKey = mapProductionRateToLaborRoleKey(input.workElement);
  const mappedRoleName = getLaborRoleNameForKey(mappedRoleKey);

  const explicitRate =
    findActiveProjectRateById(input.projectLaborRates, input.preferredRoleId) ??
    (input.preferredRoleKey
      ? findActiveProjectRateByRoleKey(input.projectLaborRates, input.preferredRoleKey)
      : undefined);

  if (explicitRate) {
    return toResolvedRate(explicitRate, mappedRoleKey, mappedRoleName, 'explicit');
  }

  const mappedRate = findActiveProjectRateByRoleKey(input.projectLaborRates, mappedRoleKey);
  if (mappedRate) {
    return toResolvedRate(mappedRate, mappedRoleKey, mappedRoleName, 'mapped');
  }

  const generalTradeRate = findActiveProjectRateByRoleKey(
    input.projectLaborRates,
    GENERAL_TRADE_ROLE_KEY,
  );
  if (generalTradeRate) {
    return toResolvedRate(
      generalTradeRate,
      mappedRoleKey,
      mappedRoleName,
      'fallback_general_trade',
    );
  }

  const defaultRate = findDefaultProjectLaborRate(input.projectLaborRates);
  if (defaultRate) {
    return toResolvedRate(
      defaultRate,
      mappedRoleKey,
      mappedRoleName,
      'fallback_default_rate',
    );
  }

  const firstActiveRate = findFirstActiveProjectLaborRate(input.projectLaborRates);
  if (firstActiveRate) {
    return toResolvedRate(
      firstActiveRate,
      mappedRoleKey,
      mappedRoleName,
      'fallback_default_rate',
    );
  }

  return toMissingRate(mappedRoleKey, mappedRoleName);
}

export function workElementFromProductionRate(
  rate: ProductionRateLibraryEntry,
): WorkElementForLaborResolution {
  return {
    activityName: rate.activityName,
    description: rate.description,
    category: rate.category,
    subcategory: rate.subcategory,
    keywords: rate.keywords,
  };
}

export function workElementFromLineItem(item: ProjectActivityLineItem): WorkElementForLaborResolution {
  return {
    activityName: item.name,
    description: item.description,
    category: null,
    subcategory: null,
    keywords: item.sourceProductionRateLabel ? [item.sourceProductionRateLabel] : [],
  };
}

export function applyResolvedLaborRateToLineItem(
  item: ProjectActivityLineItem,
  resolved: ResolvedLaborRate,
): ProjectActivityLineItem {
  if (!resolved.projectRate) {
    return item;
  }
  return applyLaborRateToLineItem(item, resolved.projectRate);
}

export function formatLaborRatePreview(resolved: ResolvedLaborRate): string {
  if (resolved.fullyBurdenedRateSnapshot <= 0) {
    return `Labor: ${resolved.laborRoleName}`;
  }
  return `Labor: ${resolved.laborRoleName} · $${resolved.fullyBurdenedRateSnapshot.toFixed(2)}/hr`;
}

export function shouldShowLaborFallbackHint(resolved: ResolvedLaborRate): boolean {
  return (
    resolved.projectRate != null &&
    resolved.mappedRoleKey !== resolved.laborRoleKey &&
    (resolved.resolutionSource === 'fallback_general_trade' ||
      resolved.resolutionSource === 'fallback_default_rate')
  );
}

export function getLaborFallbackHint(resolved: ResolvedLaborRate): string | null {
  if (!shouldShowLaborFallbackHint(resolved)) return null;
  if (resolved.resolutionSource === 'fallback_general_trade') {
    return `Using ${GENERAL_TRADE_ROLE_NAME}`;
  }
  if (resolved.resolutionSource === 'fallback_default_rate') {
    return `Using ${resolved.laborRoleName}`;
  }
  return null;
}

/** Resolve mapped role to an available project labor rate through the resolver pipeline. */
export function resolveLaborRoleForProductionRate(
  rate: ProductionRateLibraryEntry,
  projectRates: readonly ProjectLaborRate[],
): ResolvedLaborRoleMapping {
  const mappedRoleKey = mapProductionRateToLaborRoleKey(rate);
  const mappedRoleName = getLaborRoleNameForKey(mappedRoleKey);
  const resolved = resolveLaborRateForWorkElement({
    workElement: rate,
    projectLaborRates: projectRates,
  });

  return {
    mappedRoleKey,
    mappedRoleName,
    resolvedRoleKey: resolved.laborRoleKey,
    resolvedRoleName: resolved.laborRoleName,
    projectRate: resolved.projectRate,
    usedFallback:
      resolved.resolutionSource === 'fallback_general_trade' ||
      resolved.resolutionSource === 'fallback_default_rate',
    warning: resolved.warning ?? null,
  };
}

export { buildWorkElementSearchText };
