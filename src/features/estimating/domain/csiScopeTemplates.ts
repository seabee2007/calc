import { normalizeCsiDivisionCode, isKnownCsiDivision } from './csiDivisions';

export interface CsiScopeTemplateOption {
  divisionCode: string;
  scopeName: string;
  label: string;
}

export const CUSTOM_UNASSIGNED_SCOPE_LABEL = 'Custom / Unassigned Scope';

const DEFAULT_SCOPE_BY_DIVISION: Readonly<Record<string, string>> = {
  '03': 'Cast-in-Place Concrete',
};

/** Recommended scope names by CSI division (display/suggestion only; stored as scope_name text). */
const SCOPE_TEMPLATES_BY_DIVISION: Readonly<Record<string, readonly string[]>> = {
  '00': [
    'Bidding Requirements',
    'Contract Requirements',
    'Procurement Allowances',
  ],
  '01': [
    'Mobilization',
    'Supervision',
    'Temporary Facilities',
    'Safety',
    'Quality Control',
    'Closeout',
  ],
  '02': [
    'Demolition',
    'Selective Demolition',
    'Site Investigation',
    'Hazardous Material Handling',
  ],
  '03': [
    'Cast-in-Place Concrete',
    'Concrete Reinforcement',
    'Slab on Grade',
    'Footings',
    'Concrete Walls',
    'Concrete Columns',
    'Concrete Finishing',
    'Saw Cutting and Curing',
    'Site Concrete',
  ],
  '04': [
    'Concrete Unit Masonry',
    'Brick Masonry',
    'Stone Masonry',
    'Masonry Reinforcement',
    'Masonry Cleaning',
  ],
  '05': [
    'Structural Steel',
    'Metal Fabrications',
    'Metal Stairs',
    'Miscellaneous Metals',
  ],
  '06': [
    'Rough Carpentry',
    'Finish Carpentry',
    'Wood Framing',
    'Sheathing',
    'Trim and Millwork',
  ],
  '07': [
    'Waterproofing',
    'Insulation',
    'Roofing',
    'Flashing and Sheet Metal',
    'Sealants',
    'Vapor Barriers',
  ],
  '08': [
    'Doors',
    'Frames',
    'Windows',
    'Storefronts',
    'Hardware',
    'Glazing',
  ],
  '09': [
    'Drywall',
    'Painting',
    'Flooring',
    'Tile',
    'Ceilings',
    'Wall Finishes',
    'Base and Trim',
  ],
  '10': [
    'Toilet Accessories',
    'Signage',
    'Fire Extinguishers',
    'Lockers',
    'Partitions',
  ],
  '11': [
    'Residential Equipment',
    'Commercial Equipment',
    'Appliances',
    'Specialty Equipment',
  ],
  '12': [
    'Casework',
    'Countertops',
    'Window Treatments',
    'Furniture',
  ],
  '13': [
    'Pre-engineered Structures',
    'Special Purpose Rooms',
    'Fabric Structures',
  ],
  '14': [
    'Elevators',
    'Lifts',
    'Dumbwaiters',
  ],
  '21': [
    'Fire Sprinkler Systems',
    'Fire Pumps',
    'Standpipes',
  ],
  '22': [
    'Domestic Water',
    'Sanitary Waste',
    'Storm Drainage',
    'Plumbing Fixtures',
    'Water Heaters',
  ],
  '23': [
    'Ductwork',
    'Air Distribution',
    'HVAC Equipment',
    'Refrigerant Piping',
    'Controls',
    'Testing and Balancing',
  ],
  '25': [
    'Building Automation',
    'Controls Integration',
    'Monitoring Systems',
  ],
  '26': [
    'Electrical Service',
    'Distribution',
    'Lighting',
    'Devices',
    'Grounding',
    'Panels',
    'Conduit and Wiring',
  ],
  '27': [
    'Data Cabling',
    'Telecom',
    'Network Equipment',
    'Audio Visual',
  ],
  '28': [
    'Fire Alarm',
    'Access Control',
    'CCTV',
    'Intrusion Detection',
  ],
  '31': [
    'Clearing and Grubbing',
    'Excavation',
    'Grading',
    'Trenching',
    'Backfill',
    'Compaction',
    'Hauling',
  ],
  '32': [
    'Asphalt Paving',
    'Concrete Paving',
    'Landscaping',
    'Fencing',
    'Site Furnishings',
    'Irrigation',
  ],
  '33': [
    'Water Utilities',
    'Sanitary Sewer',
    'Storm Sewer',
    'Electrical Utilities',
    'Communications Utilities',
  ],
  '34': [
    'Roadways',
    'Railways',
    'Transportation Signage',
  ],
  '35': [
    'Marine Structures',
    'Shoreline Protection',
    'Dredging',
  ],
  '40': [
    'Process Piping',
    'Process Valves',
    'Process Supports',
  ],
  '41': [
    'Conveyors',
    'Material Handling Equipment',
    'Hoists',
  ],
  '42': [
    'Process Heating',
    'Process Cooling',
    'Drying Equipment',
  ],
  '43': [
    'Pumps',
    'Tanks',
    'Compressors',
    'Process Storage',
  ],
  '44': [
    'Waste Treatment',
    'Pollution Control',
    'Scrubbers',
  ],
  '45': [
    'Manufacturing Equipment',
    'Production Lines',
    'Specialty Process Equipment',
  ],
  '46': [
    'Water Treatment',
    'Wastewater Treatment',
    'Filtration',
    'Pumps',
  ],
  '48': [
    'Generators',
    'Solar Power',
    'Battery Storage',
    'Transfer Switches',
  ],
};

function resolveDivisionCode(divisionCode?: string | null): string {
  const normalized = normalizeCsiDivisionCode(divisionCode);
  return isKnownCsiDivision(normalized) ? normalized : '';
}

function scopeNamesForDivision(divisionCode: string): readonly string[] {
  return SCOPE_TEMPLATES_BY_DIVISION[divisionCode] ?? [];
}

export function normalizeScopeName(value?: string | null): string {
  if (value == null) return '';
  return value.trim().replace(/\s+/g, ' ');
}

function scopeNamesMatch(a: string, b: string): boolean {
  return normalizeScopeName(a).localeCompare(normalizeScopeName(b), undefined, {
    sensitivity: 'base',
  }) === 0;
}

export function getScopeTemplatesForDivision(
  divisionCode?: string | null,
): CsiScopeTemplateOption[] {
  const code = resolveDivisionCode(divisionCode);
  if (!code) return [];

  return scopeNamesForDivision(code).map((scopeName) => ({
    divisionCode: code,
    scopeName,
    label: scopeName,
  }));
}

export function getScopeTemplateOptions(
  divisionCode?: string | null,
): CsiScopeTemplateOption[] {
  return getScopeTemplatesForDivision(divisionCode);
}

export function isKnownScopeTemplate(
  divisionCode?: string | null,
  scopeName?: string | null,
): boolean {
  const code = resolveDivisionCode(divisionCode);
  const normalized = normalizeScopeName(scopeName);
  if (!code || !normalized) return false;

  return scopeNamesForDivision(code).some((template) => scopeNamesMatch(template, normalized));
}

export function getDefaultScopeForDivision(divisionCode?: string | null): string {
  const code = resolveDivisionCode(divisionCode);
  if (!code) return '';

  const explicitDefault = DEFAULT_SCOPE_BY_DIVISION[code];
  if (explicitDefault) return explicitDefault;

  const templates = scopeNamesForDivision(code);
  return templates[0] ?? '';
}
