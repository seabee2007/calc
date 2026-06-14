export type CalculatorHelpChip =
  | 'core'
  | 'area'
  | 'volume'
  | 'materials'
  | 'stairs'
  | 'pitch'
  | 'circle'
  | 'cost';

export type CalculatorHelpSection = {
  id: string;
  title: string;
  chip: CalculatorHelpChip;
  description: string;
  formulas?: string[];
  inputs?: string[];
  outputs?: string[];
  examples?: string[];
  notes?: string[];
};

export const CALCULATOR_HELP_MODAL_TITLE = 'Arden Field Calculator Help';

export const CALCULATOR_HELP_MODAL_SUBTITLE =
  'Quick reference for dimension math, conversions, and construction calculations.';

export const CALCULATOR_HELP_CHIPS: { id: CalculatorHelpChip; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'area', label: 'Area' },
  { id: 'volume', label: 'Volume' },
  { id: 'materials', label: 'Materials' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'circle', label: 'Circle' },
  { id: 'cost', label: 'Cost' },
];

export const CALCULATOR_HELP_SECTIONS: CalculatorHelpSection[] = [
  {
    id: 'core-dimension-math',
    title: 'Core Dimension Math',
    chip: 'core',
    description:
      'Enter dimensions with FT and IN keys, add fractions with the FRACTION picker, then use +, −, ×, and ÷. After × or ÷, enter a plain number as a multiplier or divisor. After + or −, use FT/IN for the next dimension.',
    formulas: [
      'Dimension + dimension → dimension',
      'Dimension − dimension → dimension',
      'Dimension × scalar → dimension',
      'Scalar × dimension → dimension',
      'Dimension ÷ scalar → dimension',
      'Dimension ÷ dimension → scalar (ratio)',
    ],
    inputs: [
      'Feet-inch-fraction via keypad (FT, IN, FRACTION)',
      'Fraction precision (1/2 through 1/64)',
      'Operators: +, −, ×, ÷',
    ],
    outputs: ['Formatted feet-inch-fraction result', 'Scalar count or ratio when dividing dimensions'],
    examples: [
      '23 FT 2 IN × 3 = 69\' 6"',
      '5 FT 4 1/2 IN + 8 IN = 6\' 0 1/2"',
      '10 FT ÷ 2 FT 2 IN ≈ 4.615 (scalar count)',
      '23 FT 2 IN ÷ 23 FT 2 IN = 1',
    ],
    notes: [
      'Values are stored internally as decimal inches, then rounded to your selected fraction precision.',
      'Adding or subtracting a bare number without FT/IN shows a validation message instead of guessing inches.',
    ],
  },
  {
    id: 'unit-conversions',
    title: 'Unit Conversions',
    chip: 'core',
    description:
      'Convert a single length between field-friendly units. Open the Convert tab, choose the unit you are entering, then read the equivalent values.',
    formulas: [
      'Values are stored internally as decimal inches, then formatted back to each length unit.',
    ],
    inputs: [
      'Source unit (feet & inches, decimal feet, yards, meters, centimeters, or millimeters)',
      'The length value to convert',
    ],
    outputs: ['Feet-inches-fraction', 'Decimal feet', 'Yards', 'Meters', 'Centimeters', 'Millimeters'],
    notes: [
      'Length conversions derive from standard inch ↔ metric factors.',
      'This tab converts length only. Area and volume results are shown on the Area, Volume, Concrete, and Circle tabs.',
    ],
  },
  {
    id: 'area',
    title: 'Area',
    chip: 'area',
    description: 'Calculate floor, slab, or surface area from two dimensions.',
    formulas: ['Area = length × width'],
    inputs: ['Length', 'Width'],
    outputs: ['Square feet', 'Square yards', 'Square meters'],
  },
  {
    id: 'volume',
    title: 'Volume',
    chip: 'volume',
    description: 'Calculate volume from length, width, and height or depth.',
    formulas: ['Volume = length × width × height/depth'],
    inputs: ['Length', 'Width', 'Height or depth'],
    outputs: ['Cubic feet', 'Cubic yards', 'Cubic meters'],
  },
  {
    id: 'board-feet',
    title: 'Board Feet',
    chip: 'materials',
    description: 'Estimate lumber board feet for one piece of dimensional stock.',
    formulas: [
      'Board feet = thickness(in) × width(in) × length(ft) ÷ 12',
      'Total cost = quantity × unit cost',
    ],
    inputs: ['Thickness (inches)', 'Width (inches)', 'Length (feet)', 'Optional quantity and unit cost'],
    outputs: ['Board feet (per piece)', 'Optional total cost when quantity and unit cost are entered'],
    examples: ['2 in × 6 in × 10 ft ÷ 12 = 10 board feet'],
    notes: [
      'Board feet is reported for a single piece. Enter the piece count in the Quantity field to estimate total cost.',
      'Does not include fasteners, adhesives, or labor.',
    ],
  },
  {
    id: 'concrete-volume',
    title: 'Concrete Volume',
    chip: 'materials',
    description: 'Estimate concrete placement volume in cubic yards with an optional waste allowance.',
    formulas: [
      'Volume CY = length(ft) × width(ft) × depth(ft) ÷ 27',
      'Cubic feet = length(ft) × width(ft) × depth(ft)',
      'Total CY = base CY × (1 + waste percent ÷ 100)',
    ],
    inputs: ['Length', 'Width', 'Depth / thickness', 'Waste percent'],
    outputs: ['Cubic feet', 'Cubic yards', 'Cubic yards with waste'],
    examples: ['20 ft × 10 ft × 4 in slab ≈ 2.47 CY before waste'],
    notes: [
      'Enter depth in inches; it is converted to feet before the ÷ 27 cubic-yard conversion.',
      'Order a little extra for over-excavation, spillage, and uneven subgrade.',
    ],
  },
  {
    id: 'blocks-masonry',
    title: 'Blocks / CMU / Masonry',
    chip: 'materials',
    description: 'Estimate masonry unit quantities from wall area and block face size.',
    formulas: [
      'Wall area = wall length × wall height',
      'Block face area = block length × block height',
      'Base block count = wall area ÷ block face area',
      'Total block count = ceiling(base block count × (1 + waste percent ÷ 100))',
    ],
    inputs: ['Wall length', 'Wall height', 'Block length', 'Block height', 'Waste percent'],
    outputs: ['Wall area (sq ft)', 'Estimated block count', 'Adjusted block count with waste'],
    examples: ['40 ft × 8 ft wall using 16 in × 8 in CMU = estimated block count plus waste.'],
    notes: [
      'Does not automatically include mortar, bond beam, grout, rebar, lintels, or openings unless those inputs are explicitly implemented.',
      'Field verify block size, layout, and waste.',
    ],
  },
  {
    id: 'drywall-sheet-goods',
    title: 'Drywall / Sheet Goods',
    chip: 'materials',
    description: 'Estimate sheet count from wall or ceiling area and the selected sheet size.',
    formulas: [
      'Wall area = wall length × wall height',
      'Sheet area = sheet width × sheet length',
      'Base sheet count = total area ÷ sheet area',
      'Total sheet count = ceiling(base sheet count × (1 + waste percent ÷ 100))',
    ],
    inputs: ['Wall length', 'Wall height', 'Sheet width', 'Sheet height', 'Waste percent'],
    outputs: ['Coverage area (sq ft)', 'Sheet count', 'Adjusted sheet count with waste'],
    examples: ['640 SF of drywall ÷ 32 SF per 4×8 sheet = 20 sheets before waste.'],
    notes: [
      'Does not automatically subtract doors or windows unless openings are implemented.',
      'Does not include fasteners, tape, mud, corner bead, or labor.',
    ],
  },
  {
    id: 'stairs',
    title: 'Stairs',
    chip: 'stairs',
    description:
      'Lay out riser height, treads, total run, and stair angle from the total rise, number of risers, and tread depth.',
    formulas: [
      'Actual riser height = total rise ÷ number of risers',
      'Treads = risers − 1',
      'Total run = treads × tread depth',
      'Angle = atan(total rise ÷ total run)',
    ],
    inputs: ['Total rise (feet and inches)', 'Number of risers', 'Tread depth'],
    outputs: [
      'Actual riser height (formatted)',
      'Number of treads',
      'Total run (formatted)',
      'Stair angle (degrees)',
    ],
    notes: [
      'Verify stair dimensions against local building code before construction. This tool is for estimating and layout support only.',
      'Enter the number of risers directly; adjust it until the riser height lands in your target range.',
      'Informational warnings may appear when riser height or tread depth fall outside common rule-of-thumb ranges.',
    ],
  },
  {
    id: 'right-triangle-pitch',
    title: 'Right Triangle / Pitch / Rafter Basics',
    chip: 'pitch',
    description:
      'Solve a right triangle from any two of rise, run, diagonal, pitch, or angle. Common rafter length equals the diagonal.',
    formulas: [
      'Diagonal = √(rise² + run²)',
      'Angle = atan(rise ÷ run)',
      'Pitch = rise per 12 inches of run',
    ],
    inputs: ['Rise', 'Run', 'Diagonal', 'Pitch (rise : 12 run)', 'Angle (degrees)'],
    outputs: ['Rise', 'Run', 'Diagonal', 'Pitch', 'Angle', 'Common rafter length'],
    examples: ['4:12 pitch means 4 inches of rise for every 12 inches of run.'],
    notes: [
      'Hip, valley, and jack rafters are not included in this version.',
    ],
  },
  {
    id: 'circle',
    title: 'Circle',
    chip: 'circle',
    description: 'Calculate radius, diameter, area, and circumference from either radius or diameter.',
    formulas: ['Circumference = π × diameter', 'Area = π × radius²'],
    inputs: ['Radius or diameter'],
    outputs: ['Radius', 'Diameter', 'Circumference', 'Area (sq in and sq ft)'],
  },
  {
    id: 'arc',
    title: 'Arc',
    chip: 'circle',
    description:
      'Arc length, chord, segment rise, and related arc geometry are not available as a dedicated module in this version.',
    notes: [
      'Arc calculations are included when available in the current module.',
      'Use the Circle tab for full-circle area and circumference.',
    ],
  },
  {
    id: 'cylinder-column-volume',
    title: 'Cylinder / Column Volume',
    chip: 'circle',
    description: 'Calculate round column or cylinder volume from diameter and height.',
    formulas: ['Volume = π × radius² × height'],
    inputs: ['Diameter or radius', 'Cylinder height'],
    outputs: ['Cubic feet'],
    notes: [
      'Enter the diameter and a cylinder height on the Circle tab; the cylinder volume appears once a height is entered.',
      'Volume is reported in cubic feet. Divide by 27 for cubic yards if needed.',
    ],
  },
  {
    id: 'cone-volume',
    title: 'Cone Volume',
    chip: 'circle',
    description: 'Calculate conical volume from base diameter and cone height.',
    formulas: ['Volume = (π × radius² × height) ÷ 3'],
    inputs: ['Diameter or radius', 'Cone height'],
    outputs: ['Cubic feet'],
    notes: [
      'Enter the diameter and a cone height on the Circle tab; the cone volume appears once a cone height is entered.',
      'Volume is reported in cubic feet. Divide by 27 for cubic yards if needed.',
    ],
  },
  {
    id: 'cost-per-unit',
    title: 'Cost Per Unit',
    chip: 'cost',
    description:
      'Multiply a calculated quantity by a unit cost to estimate field material cost. Available on module panels that include cost fields.',
    formulas: ['Total cost = quantity × unit cost'],
    inputs: ['Quantity', 'Unit cost'],
    outputs: ['Total cost'],
    notes: [
      'Cost calculations are standalone field estimates and do not automatically update the Estimate Workspace in this phase.',
    ],
  },
];

/** Sections visible for a chip filter (or all when chip is null). */
export function helpSectionsForChip(chip: CalculatorHelpChip | null): CalculatorHelpSection[] {
  if (!chip) return CALCULATOR_HELP_SECTIONS;
  return CALCULATOR_HELP_SECTIONS.filter((s) => s.chip === chip);
}

/** Guard test helper — strings that must never appear in help copy. */
export const PROTECTED_BRAND_TERMS = [
  'Construction Master',
  'Construction Master Pro',
  '4065',
  'Calculated Industries',
] as const;

export function helpContentContainsProtectedBranding(): string[] {
  const blob = JSON.stringify(CALCULATOR_HELP_SECTIONS);
  return PROTECTED_BRAND_TERMS.filter((term) => blob.includes(term));
}
