export interface ConstructionUnit {
  code: string;
  label: string;
  description: string;
}

export const DEFAULT_UNIT_CODES: readonly string[] = [
  'EA',
  'LS',
  'SF',
  'LF',
  'CY',
  'CF',
  'SY',
  'HR',
  'DAY',
  'TON',
  'LB',
  'BAG',
  'SHEET',
  'BOX',
  'ROLL',
  'SET',
  'LOT',
];

const RAW_CONSTRUCTION_UNITS: ConstructionUnit[] = [
  { code: 'EA', label: 'Each', description: 'Count or general unit for individual items' },
  { code: 'LS', label: 'Lump sum', description: 'Count or general lump sum amount' },
  { code: 'LOT', label: 'Lot', description: 'Count or general lot grouping' },
  { code: 'SET', label: 'Set', description: 'Count or general set of items' },
  { code: 'PAIR', label: 'Pair', description: 'Count or general pair of items' },
  { code: 'DAY', label: 'Day', description: 'Count, general, or equipment work day' },
  { code: 'WK', label: 'Week', description: 'Count, general, or equipment week' },
  { code: 'MO', label: 'Month', description: 'Count or general month' },
  { code: 'IN', label: 'Inch', description: 'Length measurement in inches' },
  { code: 'FT', label: 'Foot', description: 'Length measurement in feet' },
  { code: 'YD', label: 'Yard', description: 'Length measurement in yards' },
  { code: 'LF', label: 'Linear foot', description: 'Length measured along a line' },
  { code: 'LM', label: 'Linear meter', description: 'Length measured in meters' },
  { code: 'MI', label: 'Mile', description: 'Length measurement in miles' },
  { code: 'SI', label: 'Square inch', description: 'Area measurement in square inches' },
  { code: 'SF', label: 'Square foot', description: 'Area measurement in square feet' },
  { code: 'SY', label: 'Square yard', description: 'Area measurement in square yards' },
  { code: 'SM', label: 'Square meter', description: 'Area measurement in square meters' },
  { code: 'SQ', label: 'Square', description: 'Area measured as square units' },
  { code: 'CF', label: 'Cubic foot', description: 'Volume measurement in cubic feet' },
  { code: 'CY', label: 'Cubic yard', description: 'Volume measurement in cubic yards' },
  { code: 'CM', label: 'Cubic meter', description: 'Volume measurement in cubic meters' },
  { code: 'GAL', label: 'Gallon', description: 'Volume measurement in gallons' },
  { code: 'QT', label: 'Quart', description: 'Volume measurement in quarts' },
  { code: 'L', label: 'Liter', description: 'Volume measurement in liters' },
  { code: 'OZ', label: 'Ounce', description: 'Weight measurement in ounces' },
  { code: 'LB', label: 'Pound', description: 'Weight measurement in pounds' },
  { code: 'TON', label: 'Ton', description: 'Weight measurement in tons' },
  { code: 'KG', label: 'Kilogram', description: 'Weight measurement in kilograms' },
  { code: 'MT', label: 'Metric ton', description: 'Weight measurement in metric tons' },
  { code: 'BAG', label: 'Bag', description: 'Concrete or masonry bag unit' },
  { code: 'YD3', label: 'Cubic yard', description: 'Concrete volume in cubic yards' },
  { code: 'CMU', label: 'Concrete masonry unit', description: 'Concrete masonry block unit' },
  { code: 'BLOCK', label: 'Block', description: 'Masonry block unit' },
  { code: 'BRICK', label: 'Brick', description: 'Masonry brick unit' },
  { code: 'BAR', label: 'Bar', description: 'Rebar or steel bar unit' },
  { code: 'STICK', label: 'Stick', description: 'Rebar or steel stick unit' },
  { code: 'BD', label: 'Board', description: 'Lumber board unit' },
  { code: 'BF', label: 'Board foot', description: 'Lumber board foot measurement' },
  { code: 'MBF', label: 'Thousand board feet', description: 'Lumber thousand board feet' },
  { code: 'SHEET', label: 'Sheet', description: 'Lumber or framing sheet unit' },
  { code: 'PLY', label: 'Plywood sheet', description: 'Lumber plywood sheet unit' },
  { code: 'PC', label: 'Piece', description: 'Lumber or framing piece unit' },
  { code: 'BOX', label: 'Box', description: 'Electrical or packaging box unit' },
  { code: 'CIR', label: 'Circuit', description: 'Electrical circuit unit' },
  { code: 'RUN', label: 'Run', description: 'Electrical or plumbing run unit' },
  { code: 'DROP', label: 'Drop', description: 'Electrical drop unit' },
  { code: 'FIX', label: 'Fixture', description: 'Plumbing fixture unit' },
  { code: 'RISER', label: 'Riser', description: 'Plumbing riser unit' },
  { code: 'CFM', label: 'Cubic feet per minute', description: 'HVAC airflow measurement' },
  { code: 'DUCT', label: 'Duct', description: 'HVAC duct unit' },
  { code: 'HR', label: 'Hour', description: 'Equipment or labor hour unit' },
  { code: 'MH', label: 'Man-hour', description: 'Equipment or labor man-hour unit' },
  { code: 'MD', label: 'Man-day', description: 'Equipment or labor man-day unit' },
  { code: 'CD', label: 'Crew-day', description: 'Equipment or labor crew-day unit' },
  { code: 'ROLL', label: 'Roll', description: 'Packaging roll unit' },
  { code: 'BUNDLE', label: 'Bundle', description: 'Packaging bundle unit' },
  { code: 'PALLET', label: 'Pallet', description: 'Packaging pallet unit' },
  { code: 'LOAD', label: 'Load', description: 'Packaging load unit' },
  { code: 'TRUCK', label: 'Truckload', description: 'Packaging truckload unit' },
];

function dedupeUnits(units: ConstructionUnit[]): ConstructionUnit[] {
  const byCode = new Map<string, ConstructionUnit>();
  for (const unit of units) {
    if (!byCode.has(unit.code)) {
      byCode.set(unit.code, unit);
    }
  }
  return [...byCode.values()];
}

export const CONSTRUCTION_UNITS: ConstructionUnit[] = dedupeUnits(RAW_CONSTRUCTION_UNITS);

const UNIT_BY_CODE = new Map(CONSTRUCTION_UNITS.map((unit) => [unit.code, unit]));

export function formatConstructionUnitOption(unit: ConstructionUnit): string {
  return `${unit.code} — ${unit.label}`;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function rankUnitMatch(unit: ConstructionUnit, query: string): number {
  if (!query) return 0;

  const code = unit.code.toLowerCase();
  const label = unit.label.toLowerCase();
  const description = unit.description.toLowerCase();

  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (label.startsWith(query)) return 2;
  if (code.includes(query)) return 3;
  if (label.includes(query)) return 4;
  if (description.includes(query)) return 5;
  return Number.POSITIVE_INFINITY;
}

function unitMatchesQuery(unit: ConstructionUnit, query: string): boolean {
  if (!query) return true;

  const code = unit.code.toLowerCase();
  const label = unit.label.toLowerCase();
  const description = unit.description.toLowerCase();

  return (
    code.includes(query) ||
    label.includes(query) ||
    description.includes(query)
  );
}

function sortUnitsForEmptyQuery(units: ConstructionUnit[]): ConstructionUnit[] {
  const defaultRank = new Map(DEFAULT_UNIT_CODES.map((code, index) => [code, index]));

  return [...units].sort((left, right) => {
    const leftDefault = defaultRank.get(left.code);
    const rightDefault = defaultRank.get(right.code);

    if (leftDefault !== undefined && rightDefault !== undefined) {
      return leftDefault - rightDefault;
    }
    if (leftDefault !== undefined) return -1;
    if (rightDefault !== undefined) return 1;
    return left.code.localeCompare(right.code);
  });
}

export function filterConstructionUnits(query: string): ConstructionUnit[] {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return sortUnitsForEmptyQuery(CONSTRUCTION_UNITS);
  }

  return CONSTRUCTION_UNITS.filter((unit) => unitMatchesQuery(unit, normalizedQuery)).sort(
    (left, right) => {
      const leftRank = rankUnitMatch(left, normalizedQuery);
      const rightRank = rankUnitMatch(right, normalizedQuery);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.code.localeCompare(right.code);
    },
  );
}

export function findConstructionUnitByCode(code: string): ConstructionUnit | undefined {
  return UNIT_BY_CODE.get(code.trim().toUpperCase());
}
