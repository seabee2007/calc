import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import { STARTER_LABOR_ROLES } from '../domain/laborRateTypes';
import type { WorkElementForLaborResolution } from './laborRateResolver';

export interface LaborRoleMappingRule {
  keywords: string[];
  roleKey: string;
  roleName: string;
}

export const GENERAL_TRADE_ROLE_KEY = 'general_trade';
export const GENERAL_TRADE_ROLE_NAME = 'General Trade';

interface LaborRoleMappingBucket {
  priority: number;
  roleKey: string;
  roleName: string;
  match: (haystack: string) => boolean;
}

const HVAC_PHRASE_TERMS = [
  'hvac',
  'ductwork',
  'diffuser',
  'ventilating',
  'air conditioning',
  'air handler',
  'fan coil',
  'condenser',
  'refrigerant',
  'supply air',
  'return air',
  'mechanical ventilation',
  'ventilation equipment',
];
const HVAC_WORD_TERMS = ['duct', 'ducts', 'register', 'grille', 'damper'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match whole words/phrases to avoid false positives like "duct" inside "production". */
function includesBoundedTerm(haystack: string, term: string): boolean {
  const normalized = term.toLowerCase();
  if (normalized.includes(' ')) {
    return haystack.includes(normalized);
  }
  return new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i').test(haystack);
}

function includesAnyBounded(haystack: string, terms: string[]): boolean {
  return terms.some((term) => includesBoundedTerm(haystack, term));
}

function includesAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function includesKeyword(haystack: string, keyword: string): boolean {
  return haystack.includes(keyword.toLowerCase());
}

function matchesHvacContext(haystack: string): boolean {
  if (includesAny(haystack, HVAC_PHRASE_TERMS)) return true;
  if (includesAnyBounded(haystack, HVAC_WORD_TERMS)) return true;
  if (
    includesBoundedTerm(haystack, 'mechanical') &&
    includesAnyBounded(haystack, ['ventilation', 'duct', 'louver'])
  ) {
    return true;
  }
  return false;
}

function matchesFormworkContext(haystack: string): boolean {
  const formworkTerms = [
    'formwork',
    'forming',
    'forms in place',
    'form in place',
    'walls, forms in place',
    'job-built plywood',
    'job built plywood',
    'wall form',
    'wall forms',
    'beam form',
    'beam forms',
    'column form',
    'column forms',
    'footing form',
    'edge form',
    'bulkhead',
    'spandrel form',
    'plywood form',
    'form board',
  ];
  if (includesAny(haystack, formworkTerms)) return true;
  if (includesAnyBounded(haystack, ['forms', 'formwork', 'forming'])) return true;
  if (
    includesBoundedTerm(haystack, 'plywood') &&
    includesAny(haystack, ['form', 'wall', 'beam', 'column', 'footing', 'slab', 'edge', 'girder'])
  ) {
    return true;
  }
  if (
    includesBoundedTerm(haystack, 'form') &&
    includesAny(haystack, ['wall', 'beam', 'column', 'footing', 'slab', 'edge', 'girder', 'culvert'])
  ) {
    return true;
  }
  return false;
}

function matchesWeldingContext(haystack: string): boolean {
  if (includesAny(haystack, ['welded wire', 'wwf'])) return false;

  const weldingTerms = [
    'welding',
    'welder',
    'welded connection',
    'weld connection',
    'shop weld',
    'field weld',
    'site weld',
    'fillet weld',
    'stick welding',
    'welding plates',
    'welding plate',
  ];
  if (includesAny(haystack, weldingTerms)) return true;

  const structuralContext = includesAny(haystack, [
    'structural steel',
    'steel truss',
    'steel trusses',
    'metal fabrication',
    'metal fabrications',
    'plates, bars',
    'plates bars',
    'beams, columns, or trusses',
    'beams columns or trusses',
  ]);

  if (
    structuralContext &&
    includesAnyBounded(haystack, [
      'weld',
      'welds',
      'welded',
      'fabricate',
      'fabrication',
      'fabricating',
    ])
  ) {
    return true;
  }

  if (
    includesAny(haystack, ['structural steel', 'steel']) &&
    includesBoundedTerm(haystack, 'trusses') &&
    !includesAny(haystack, ['erection', 'install', 'installation', 'bolted'])
  ) {
    return true;
  }

  return false;
}

/** Priority-ordered conservative trade buckets (lower priority number wins first). */
const LABOR_ROLE_MAPPING_BUCKETS: readonly LaborRoleMappingBucket[] = [
  {
    priority: 5,
    roleKey: 'carpenter',
    roleName: 'Carpenter',
    match: matchesFormworkContext,
  },
  {
    priority: 10,
    roleKey: 'carpenter',
    roleName: 'Carpenter',
    match: (haystack) => {
      const doorOpeningTerms = [
        'weatherstrip',
        'weatherstripping',
        'door sweep',
        'threshold',
        'door hardware',
        'garage door weatherstrip',
        'mechanical seal',
        'door frame',
        'door jamb',
        'door casing',
        'overhead door',
        'storefront door',
      ];
      if (includesAny(haystack, doorOpeningTerms)) return true;

      if (includesKeyword(haystack, 'louver') && !matchesHvacContext(haystack)) {
        return true;
      }

      return false;
    },
  },
  {
    priority: 20,
    roleKey: 'hvac_technician',
    roleName: 'HVAC Technician',
    match: matchesHvacContext,
  },
  {
    priority: 30,
    roleKey: 'electrician',
    roleName: 'Electrician',
    match: (haystack) =>
      includesAny(haystack, [
        'electrical',
        'electrician',
        'conduit',
        'wire pull',
        'wiring',
        'panelboard',
        'switchgear',
        'lighting fixture',
        'electric panel',
      ]) || /\belectric\b/.test(haystack),
  },
  {
    priority: 40,
    roleKey: 'plumber',
    roleName: 'Plumber',
    match: (haystack) =>
      includesAny(haystack, [
        'plumbing',
        'plumber',
        'sanitary',
        'lavatory',
        'water closet',
        'toilet',
        'sink',
        'drain line',
        'water line',
        'domestic water',
        'plumbing fixture',
      ]) ||
      (includesKeyword(haystack, 'plumb') && !includesKeyword(haystack, 'plumbing fixture schedule')),
  },
  {
    priority: 60,
    roleKey: 'welder',
    roleName: 'Welder',
    match: matchesWeldingContext,
  },
  {
    priority: 65,
    roleKey: 'ironworker',
    roleName: 'Ironworker',
    match: (haystack) =>
      includesAny(haystack, ['rebar', 'reinforc', 'welded wire', 'wwf', 'steelworker', 'ironworker']),
  },
  {
    priority: 70,
    roleKey: 'concrete_finisher',
    roleName: 'Concrete Finisher',
    match: (haystack) => {
      if (includesAny(haystack, ['place concrete', 'slab on grade', 'slab', 'trowel', 'screed', 'broom finish', 'float finish'])) {
        return true;
      }
      if (includesAny(haystack, ['saw cut', 'control joint', 'construction joint'])) return true;
      if (includesKeyword(haystack, 'concrete') && includesAny(haystack, ['place', 'finish', 'pour', 'flatwork'])) {
        return true;
      }
      return false;
    },
  },
  {
    priority: 80,
    roleKey: 'equipment_operator',
    roleName: 'Equipment Operator',
    match: (haystack) =>
      includesAny(haystack, [
        'excavat',
        'earthwork',
        'backfill',
        'compact',
        'topsoil',
        'grub',
        'clear and grub',
        'site clearing',
        'haul',
        'trench',
        'flagpole foundation',
      ]),
  },
  {
    priority: 85,
    roleKey: 'general_trade',
    roleName: 'General Trade',
    match: (haystack) => includesAny(haystack, ['flagpole', 'flag pole']),
  },
  {
    priority: 90,
    roleKey: 'mason',
    roleName: 'Mason',
    match: (haystack) => includesAny(haystack, ['masonry', 'block wall', 'brick', 'mason']),
  },
  {
    priority: 100,
    roleKey: 'drywall_installer',
    roleName: 'Drywall Installer',
    match: (haystack) => includesAny(haystack, ['drywall', 'gypsum']),
  },
  {
    priority: 105,
    roleKey: 'painter',
    roleName: 'Painter',
    match: (haystack) => {
      const paintingTerms = [
        'paint',
        'painting',
        'coating',
        'roll and brush',
        'roll & brush',
        'brushwork',
        'first coat',
        'second coat',
        'each coat',
        'primer',
        'finish coat',
        'spray, first coat',
        'spray first coat',
      ];
      if (includesAny(haystack, paintingTerms)) return true;
      if (includesKeyword(haystack, 'spray') && includesAny(haystack, ['coat', 'paint'])) return true;
      if (includesKeyword(haystack, 'brush') && includesAny(haystack, ['coat', 'paint', 'roll'])) {
        return true;
      }
      return false;
    },
  },
  {
    priority: 120,
    roleKey: 'roofer',
    roleName: 'Roofer',
    match: (haystack) => includesAny(haystack, ['roof', 'roofing']),
  },
];

/** @deprecated Kept for reference; matching uses priority buckets instead. */
export const LABOR_ROLE_MAPPING_RULES: readonly LaborRoleMappingRule[] = LABOR_ROLE_MAPPING_BUCKETS.map(
  (bucket) => ({
    keywords: [],
    roleKey: bucket.roleKey,
    roleName: bucket.roleName,
  }),
);

export function buildWorkElementSearchText(
  workElement: WorkElementForLaborResolution | ProductionRateLibraryEntry,
): string {
  if ('keywords' in workElement && Array.isArray(workElement.keywords)) {
    const figureTitle = 'figureTitle' in workElement ? workElement.figureTitle : null;
    return [
      workElement.activityName,
      workElement.description,
      figureTitle,
      workElement.category,
      workElement.subcategory,
      workElement.keywords.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  return [
    workElement.activityName,
    workElement.description,
    workElement.category,
    workElement.subcategory,
    ...(workElement.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Map a production rate description/category to a starter labor role key. */
export function mapProductionRateToLaborRoleKey(
  rate: ProductionRateLibraryEntry | WorkElementForLaborResolution,
): string {
  const haystack = buildWorkElementSearchText(rate);
  const bucket = [...LABOR_ROLE_MAPPING_BUCKETS].sort((a, b) => a.priority - b.priority).find((entry) =>
    entry.match(haystack),
  );
  return bucket?.roleKey ?? GENERAL_TRADE_ROLE_KEY;
}

export function getLaborRoleNameForKey(roleKey: string): string {
  const starter = STARTER_LABOR_ROLES.find((role) => role.roleKey === roleKey);
  if (starter) return starter.roleName;
  if (roleKey === 'ironworker') return 'Ironworker';
  return GENERAL_TRADE_ROLE_NAME;
}

export {
  resolveLaborRoleForProductionRate,
  type ResolvedLaborRoleMapping,
} from './laborRateResolver';

