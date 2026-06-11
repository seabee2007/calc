import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import { STARTER_LABOR_ROLES } from '../domain/laborRateTypes';

export interface LaborRoleMappingRule {
  keywords: string[];
  roleKey: string;
  roleName: string;
}

/** Keyword → civilian contractor labor role (first match wins). */
export const LABOR_ROLE_MAPPING_RULES: readonly LaborRoleMappingRule[] = [
  {
    keywords: ['form', 'forming', 'bulkhead', 'edge form', 'plywood'],
    roleKey: 'carpenter',
    roleName: 'Carpenter',
  },
  {
    keywords: ['reinforc', 'rebar', 'welded wire', 'wwf', 'steelworker'],
    roleKey: 'ironworker',
    roleName: 'Ironworker',
  },
  {
    keywords: ['concrete', 'place concrete', 'finish', 'trowel', 'screed', 'broom', 'float'],
    roleKey: 'concrete_finisher',
    roleName: 'Concrete Finisher',
  },
  {
    keywords: ['cur', 'saw cut', 'joint', 'control joint'],
    roleKey: 'concrete_finisher',
    roleName: 'Concrete Finisher',
  },
  {
    keywords: [
      'clear',
      'grub',
      'brush',
      'topsoil',
      'excavat',
      'backfill',
      'compact',
      'haul',
      'earthwork',
    ],
    roleKey: 'equipment_operator',
    roleName: 'Equipment Operator',
  },
  {
    keywords: ['masonry', 'block', 'brick', 'mason'],
    roleKey: 'mason',
    roleName: 'Mason',
  },
  {
    keywords: ['plumb', 'pipe', 'fixture'],
    roleKey: 'plumber',
    roleName: 'Plumber',
  },
  {
    keywords: ['electrical', 'conduit', 'wire', 'panel', 'electric'],
    roleKey: 'electrician',
    roleName: 'Electrician',
  },
  {
    keywords: [
      'weatherstrip',
      'weatherstripping',
      'door sweep',
      'threshold',
      'door hardware',
      'garage door weatherstrip',
      'mechanical seal',
    ],
    roleKey: 'carpenter',
    roleName: 'Carpenter',
  },
  {
    keywords: ['hvac', 'duct', 'ventilating', 'air conditioning'],
    roleKey: 'hvac_technician',
    roleName: 'HVAC Technician',
  },
  {
    keywords: ['drywall', 'gypsum'],
    roleKey: 'drywall_installer',
    roleName: 'Drywall Installer',
  },
  {
    keywords: ['paint', 'coating'],
    roleKey: 'painter',
    roleName: 'Painter',
  },
  {
    keywords: ['roof', 'roofing'],
    roleKey: 'roofer',
    roleName: 'Roofer',
  },
];

export const GENERAL_TRADE_ROLE_KEY = 'general_trade';
export const GENERAL_TRADE_ROLE_NAME = 'General Trade';

function buildRateSearchText(rate: ProductionRateLibraryEntry): string {
  return [
    rate.activityName,
    rate.description,
    rate.category,
    rate.subcategory,
    rate.keywords.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Map a production rate description/category to a starter labor role key. */
export function mapProductionRateToLaborRoleKey(rate: ProductionRateLibraryEntry): string {
  const haystack = buildRateSearchText(rate);
  for (const rule of LABOR_ROLE_MAPPING_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return rule.roleKey;
    }
  }
  return GENERAL_TRADE_ROLE_KEY;
}

export function getLaborRoleNameForKey(roleKey: string): string {
  const starter = STARTER_LABOR_ROLES.find((role) => role.roleKey === roleKey);
  if (starter) return starter.roleName;
  if (roleKey === 'ironworker') return 'Ironworker';
  return GENERAL_TRADE_ROLE_NAME;
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

function findProjectRateByRoleKey(
  projectRates: readonly ProjectLaborRate[],
  roleKey: string,
): ProjectLaborRate | undefined {
  return projectRates.find((rate) => rate.isActive && rate.roleKey === roleKey);
}

/** Resolve mapped role to an available project labor rate, falling back to General Trade. */
export function resolveLaborRoleForProductionRate(
  rate: ProductionRateLibraryEntry,
  projectRates: readonly ProjectLaborRate[],
): ResolvedLaborRoleMapping {
  const mappedRoleKey = mapProductionRateToLaborRoleKey(rate);
  const mappedRoleName = getLaborRoleNameForKey(mappedRoleKey);

  let resolvedRoleKey = mappedRoleKey;
  let resolvedRoleName = mappedRoleName;
  let projectRate = findProjectRateByRoleKey(projectRates, mappedRoleKey) ?? null;
  let usedFallback = false;
  let warning: string | null = null;

  if (!projectRate && mappedRoleKey !== GENERAL_TRADE_ROLE_KEY) {
    const generalRate = findProjectRateByRoleKey(projectRates, GENERAL_TRADE_ROLE_KEY);
    if (generalRate) {
      usedFallback = true;
      resolvedRoleKey = GENERAL_TRADE_ROLE_KEY;
      resolvedRoleName = GENERAL_TRADE_ROLE_NAME;
      projectRate = generalRate;
      warning = `Mapped role "${mappedRoleName}" is not on the project labor schedule — using General Trade.`;
    } else {
      warning = `Mapped role "${mappedRoleName}" is not on the project labor schedule.`;
    }
  }

  if (!projectRate) {
    projectRate = findProjectRateByRoleKey(projectRates, GENERAL_TRADE_ROLE_KEY) ?? null;
    if (projectRate && mappedRoleKey !== GENERAL_TRADE_ROLE_KEY) {
      usedFallback = true;
      resolvedRoleKey = GENERAL_TRADE_ROLE_KEY;
      resolvedRoleName = GENERAL_TRADE_ROLE_NAME;
      warning =
        warning ??
        `Mapped role "${mappedRoleName}" is not on the project labor schedule — using General Trade.`;
    }
  }

  return {
    mappedRoleKey,
    mappedRoleName,
    resolvedRoleKey,
    resolvedRoleName,
    projectRate,
    usedFallback,
    warning,
  };
}
