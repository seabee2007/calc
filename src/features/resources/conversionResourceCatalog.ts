export type ConversionSectionKind =
  | 'table'
  | 'formulas'
  | 'warnings'
  | 'mistake-cards'
  | 'trade-cards'
  | 'grouped-table'
  | 'coming-soon';

export type ConversionSectionStatus = 'available' | 'coming-soon';

export type ConversionTableRow = {
  id: string;
  from: string;
  to: string;
  factor: string;
  formula: string;
  useCase?: string;
  note?: string;
};

export type ConversionSection = {
  id: string;
  title: string;
  description: string;
  kind: ConversionSectionKind;
  status: ConversionSectionStatus;
  badge?: string;
  printable?: boolean;
};

export const CONVERSION_PAGE_SUBTITLE =
  'Field-ready unit conversions, measurement formulas, slope references, and material ordering checks for construction teams.';

export const CONVERSION_ROUNDING_NOTE =
  'Conversion tables are rounded for field reference. Use project specifications, supplier units, and calculator precision for final ordering.';

export const CONVERSION_FIELD_NOTE =
  'These tables are quick references. Verify supplier units, material densities, plan scales, and project specifications before ordering material.';

export const WEIGHT_DENSITY_WARNING =
  'Density varies by supplier, moisture, compaction, aggregate type, and mix design. Confirm with the supplier before ordering.';

export const WEIGHT_TO_VOLUME_WARNING =
  'Weight-to-volume conversions require material density. Do not convert tons to cubic yards without knowing the material and moisture/compaction condition.';

export const MATERIAL_WEIGHTS_NOTE =
  'Material weights vary by moisture, compaction, mix design, alloy, supplier, and manufacturing method. Use supplier data for final load, hauling, and structural checks.';

export const REBAR_WEIGHT_NOTE =
  'Approximate rebar weight can be estimated from bar diameter and steel density, but bar-size tables should be used for field estimating.';

export const ROOF_PITCH_FOOTPRINT_NOTE =
  'Pitch factor and actual roof area should be calculated before ordering roofing material. Footprint area is not the same as sloped roof surface area.';

export const LUMBER_NOMINAL_NOTE =
  'Nominal lumber size is not actual dressed size. Use the estimating convention required by the supplier or project.';

export const PROHIBITED_CONVERSION_TERMS = [
  'Procore',
  'Autodesk',
  'RSMeans',
  'NCCER',
  'Gordian',
  'compiled from NIST',
  'compiled from ACI',
  'compiled from RSMeans',
  'compiled from NCCER',
] as const;

// --- Section 1: Basic Length Conversions ---

export const BASIC_LENGTH_CONVERSION_ROWS: ConversionTableRow[] = [
  {
    id: 'm-ft',
    from: 'Meters',
    to: 'Feet',
    factor: '3.28084',
    formula: 'ft = m × 3.28084',
    useCase: 'Metric plan dimensions to field feet',
  },
  {
    id: 'ft-m',
    from: 'Feet',
    to: 'Meters',
    factor: '0.3048',
    formula: 'm = ft × 0.3048',
    useCase: 'Imperial field measurements to metric specs',
  },
  {
    id: 'm-in',
    from: 'Meters',
    to: 'Inches',
    factor: '39.3701',
    formula: 'in = m × 39.3701',
    useCase: 'Metric to fractional inch layout',
  },
  {
    id: 'ft-in',
    from: 'Feet',
    to: 'Inches',
    factor: '12',
    formula: 'in = ft × 12',
    useCase: 'Decimal feet to inch fractions',
  },
  {
    id: 'in-ft',
    from: 'Inches',
    to: 'Feet',
    factor: '0.083333',
    formula: 'ft = in ÷ 12',
    useCase: 'Inch dimensions to decimal feet for volume',
  },
  {
    id: 'ft-yd',
    from: 'Feet',
    to: 'Yards',
    factor: '0.333333',
    formula: 'yd = ft ÷ 3',
    useCase: 'Run lengths to yardage',
  },
  {
    id: 'yd-ft',
    from: 'Yards',
    to: 'Feet',
    factor: '3',
    formula: 'ft = yd × 3',
    useCase: 'Fabric or pipe yardage to feet',
  },
  {
    id: 'in-mm',
    from: 'Inches',
    to: 'Millimeters',
    factor: '25.4',
    formula: 'mm = in × 25.4',
    useCase: 'Imperial to metric fabrication',
  },
  {
    id: 'mm-in',
    from: 'Millimeters',
    to: 'Inches',
    factor: '0.0393701',
    formula: 'in = mm ÷ 25.4',
    useCase: 'Metric tile or hardware to inches',
  },
  {
    id: 'in-cm',
    from: 'Inches',
    to: 'Centimeters',
    factor: '2.54',
    formula: 'cm = in × 2.54',
    useCase: 'Small imperial to metric lengths',
  },
  {
    id: 'cm-in',
    from: 'Centimeters',
    to: 'Inches',
    factor: '0.393701',
    formula: 'in = cm ÷ 2.54',
    useCase: 'Metric hardware to imperial layout',
  },
  {
    id: 'yd-m',
    from: 'Yards',
    to: 'Meters',
    factor: '0.9144',
    formula: 'm = yd × 0.9144',
    useCase: 'Yard-based specs to metric',
  },
  {
    id: 'm-yd',
    from: 'Meters',
    to: 'Yards',
    factor: '1.09361',
    formula: 'yd = m × 1.09361',
    useCase: 'Metric to yard-based ordering',
  },
  {
    id: 'mi-ft',
    from: 'Miles',
    to: 'Feet',
    factor: '5,280',
    formula: 'ft = mi × 5,280',
    useCase: 'Highway or utility run lengths',
  },
  {
    id: 'km-mi',
    from: 'Kilometers',
    to: 'Miles',
    factor: '0.621371',
    formula: 'mi = km × 0.621371',
    useCase: 'Metric site distances to miles',
  },
  {
    id: 'km-m',
    from: 'Kilometers',
    to: 'Meters',
    factor: '1,000',
    formula: 'm = km × 1,000',
    useCase: 'Kilometer to meter field checks',
  },
];

// --- Section 2: Area Conversions ---

export const AREA_CONVERSION_ROWS: ConversionTableRow[] = [
  {
    id: 'sf-sy',
    from: 'Square feet (SF)',
    to: 'Square yards (SY)',
    factor: '÷ 9',
    formula: 'SY = SF ÷ 9',
    useCase: 'Flooring, carpet, and turf ordering',
  },
  {
    id: 'sy-sf',
    from: 'Square yards (SY)',
    to: 'Square feet (SF)',
    factor: '× 9',
    formula: 'SF = SY × 9',
    useCase: 'Yard-based quotes to square feet',
  },
  {
    id: 'ac-sf',
    from: 'Acres',
    to: 'Square feet (SF)',
    factor: '43,560',
    formula: 'SF = acres × 43,560',
    useCase: 'Site area to buildable square footage',
  },
  {
    id: 'sf-ac',
    from: 'Square feet (SF)',
    to: 'Acres',
    factor: '÷ 43,560',
    formula: 'acres = SF ÷ 43,560',
    useCase: 'Building footprint to land area',
  },
  {
    id: 'sq-sf',
    from: 'Roofing squares',
    to: 'Square feet (SF)',
    factor: '× 100',
    formula: 'SF = squares × 100',
    useCase: 'Roofing material ordering',
  },
  {
    id: 'sf-sq',
    from: 'Square feet (SF)',
    to: 'Roofing squares',
    factor: '÷ 100',
    formula: 'squares = SF ÷ 100',
    useCase: 'Roof area to squares for shingles',
  },
];

// --- Section 3: Volume Conversions ---

export const VOLUME_CONVERSION_ROWS: ConversionTableRow[] = [
  {
    id: 'cf-cy',
    from: 'Cubic feet (CF)',
    to: 'Cubic yards (CY)',
    factor: '÷ 27',
    formula: 'CY = CF ÷ 27',
    useCase: 'Slab and footing volume to order yards',
  },
  {
    id: 'cy-cf',
    from: 'Cubic yards (CY)',
    to: 'Cubic feet (CF)',
    factor: '× 27',
    formula: 'CF = CY × 27',
    useCase: 'Ready-mix tickets to cubic feet',
  },
  {
    id: 'gal-cf',
    from: 'Gallons (US)',
    to: 'Cubic feet (CF)',
    factor: '÷ 7.48052',
    formula: 'CF = gallons ÷ 7.48052',
    useCase: 'Tank or container volume checks',
  },
  {
    id: 'cf-gal',
    from: 'Cubic feet (CF)',
    to: 'Gallons (US)',
    factor: '× 7.48052',
    formula: 'gallons = CF × 7.48052',
    useCase: 'Volume to liquid capacity',
  },
];

export const VOLUME_CONSTRUCTION_NOTES: string[] = [
  'Concrete is commonly ordered in cubic yards.',
  'Small container and tank volumes may be checked in cubic feet or gallons.',
  'Always convert slab depth from inches to feet before calculating cubic feet.',
];

// --- Section 4: Weight / Material Ordering ---

export const WEIGHT_ORDERING_FORMULAS: string[] = [
  'Tons = cubic yards × tons per cubic yard',
  'Cubic yards = tons ÷ tons per cubic yard',
];

export const WEIGHT_PLANNING_EXAMPLES: string[] = [
  'Normal-weight concrete: approximately 2.0 tons per cubic yard',
  'Gravel/base: commonly estimated around 1.3–1.5 tons per cubic yard',
  'Mulch, topsoil, and fill: varies widely by moisture and material',
];

// --- Section 5: Lumber / Board Feet ---

export const LUMBER_BOARD_FEET_FORMULAS: string[] = [
  'Board feet = thickness(in) × width(in) × length(ft) ÷ 12',
  'Cubic feet = board feet ÷ 12',
  'Board feet = cubic feet × 12',
];

export const LUMBER_LF_EXAMPLES: string[] = [
  '2×4 linear feet to board feet: LF × 0.667',
  '2×6 linear feet to board feet: LF × 1.000',
  '2×8 linear feet to board feet: LF × 1.333',
];

// --- Section 6: Imperial Fraction to Metric ---

export const IMPERIAL_FRACTION_METRIC_ROWS: {
  imperial: string;
  decimalInches: string;
  millimeters: string;
}[] = [
  { imperial: '1/16', decimalInches: '0.0625', millimeters: '1.59' },
  { imperial: '1/8', decimalInches: '0.125', millimeters: '3.18' },
  { imperial: '3/16', decimalInches: '0.1875', millimeters: '4.76' },
  { imperial: '1/4', decimalInches: '0.25', millimeters: '6.35' },
  { imperial: '3/8', decimalInches: '0.375', millimeters: '9.53' },
  { imperial: '1/2', decimalInches: '0.5', millimeters: '12.70' },
  { imperial: '5/8', decimalInches: '0.625', millimeters: '15.88' },
  { imperial: '3/4', decimalInches: '0.75', millimeters: '19.05' },
  { imperial: '7/8', decimalInches: '0.875', millimeters: '22.23' },
  { imperial: '1', decimalInches: '1.0', millimeters: '25.40' },
  { imperial: '1-1/2', decimalInches: '1.5', millimeters: '38.10' },
  { imperial: '2', decimalInches: '2.0', millimeters: '50.80' },
  { imperial: '3', decimalInches: '3.0', millimeters: '76.20' },
  { imperial: '4', decimalInches: '4.0', millimeters: '101.60' },
  { imperial: '6', decimalInches: '6.0', millimeters: '152.40' },
  { imperial: '8', decimalInches: '8.0', millimeters: '203.20' },
  { imperial: '10', decimalInches: '10.0', millimeters: '254.00' },
  { imperial: '12', decimalInches: '12.0', millimeters: '304.80' },
  { imperial: '16', decimalInches: '16.0', millimeters: '406.40' },
  { imperial: '24', decimalInches: '24.0', millimeters: '609.60' },
  { imperial: '36', decimalInches: '36.0', millimeters: '914.40' },
  { imperial: '48', decimalInches: '48.0', millimeters: '1219.20' },
  { imperial: '96', decimalInches: '96.0', millimeters: '2438.40' },
];

// --- Section 7: Roof Slope / Pitch ---

export const ROOF_SLOPE_FORMULAS: string[] = [
  'Angle = atan(rise ÷ run)',
  'Percent slope = rise ÷ run × 100',
  'For roof pitch: run = 12 inches, rise = pitch value in inches',
];

export const ROOF_SLOPE_ROWS: {
  pitch: string;
  risePer12: string;
  percentSlope: string;
  angle: string;
}[] = [
  { pitch: '1:12', risePer12: '1"', percentSlope: '8.33%', angle: '4.76°' },
  { pitch: '2:12', risePer12: '2"', percentSlope: '16.67%', angle: '9.46°' },
  { pitch: '3:12', risePer12: '3"', percentSlope: '25.00%', angle: '14.04°' },
  { pitch: '4:12', risePer12: '4"', percentSlope: '33.33%', angle: '18.43°' },
  { pitch: '5:12', risePer12: '5"', percentSlope: '41.67%', angle: '22.62°' },
  { pitch: '6:12', risePer12: '6"', percentSlope: '50.00%', angle: '26.57°' },
  { pitch: '7:12', risePer12: '7"', percentSlope: '58.33%', angle: '30.26°' },
  { pitch: '8:12', risePer12: '8"', percentSlope: '66.67%', angle: '33.69°' },
  { pitch: '9:12', risePer12: '9"', percentSlope: '75.00%', angle: '36.87°' },
  { pitch: '10:12', risePer12: '10"', percentSlope: '83.33%', angle: '39.81°' },
  { pitch: '12:12', risePer12: '12"', percentSlope: '100.00%', angle: '45.00°' },
];

// --- Section 8: Common Mistakes ---

export const CONVERSION_MISTAKE_CARDS: { title: string; body: string }[] = [
  {
    title: 'Decimal feet are not feet-inches',
    body: 'A plan dimension of 3.75 ft is 3 ft 9 in, not 3 ft 75 in. Convert the decimal portion by multiplying by 12.',
  },
  {
    title: 'Slab thickness must be converted from inches to feet',
    body: 'A 6-inch slab is 0.5 ft thick. Using 6 as the depth in a cubic feet formula will overstate volume by twelve times.',
  },
  {
    title: 'Cubic yards and tons are not interchangeable',
    body: 'Material weight depends on density, moisture, and compaction. Convert between volume and weight only when you know tons per cubic yard for that specific material.',
  },
  {
    title: 'Roofing footprint area is not roof surface area',
    body: 'Plan footprint square footage ignores pitch. Apply a pitch factor or calculate sloped surface area before ordering squares or bundles.',
  },
  {
    title: 'Square feet and square yards are not the same',
    body: 'Nine square feet equal one square yard. Carpet, turf, and some flooring are quoted in square yards while takeoffs are often in square feet.',
  },
  {
    title: 'Metric tile dimensions must be converted before layout checks',
    body: 'A 600 mm tile is not 6 inches. Convert metric module sizes to inches or millimeters consistently before verifying counts and grout joints.',
  },
  {
    title: 'Board feet and linear feet are not the same',
    body: 'Linear feet count length only. Board feet include cross-section. A 2×4 and a 2×8 of the same length have different board-foot quantities.',
  },
];

// --- Section 9: Trade Quick Reference ---

export const TRADE_QUICK_REFERENCE_CARDS: { trade: string; mismatch: string }[] = [
  {
    trade: 'Concrete & masonry',
    mismatch: 'Feet and inches on plans → cubic yards for ordering',
  },
  {
    trade: 'Framing & lumber',
    mismatch: 'Linear feet and nominal sizes → board feet and stock lengths',
  },
  {
    trade: 'Roofing',
    mismatch: 'Building footprint → pitch-adjusted roof area → squares and bundles',
  },
  {
    trade: 'Earthwork',
    mismatch: 'Bank volume, loose volume, compacted volume, and tons',
  },
  {
    trade: 'Flooring / tile / hardscape',
    mismatch: 'Square feet → square yards or metric tile sizes',
  },
];

// --- Section 11: Length Imperial to Metric ---

export const LENGTH_IMPERIAL_TO_METRIC_ROWS: {
  imperial: string;
  centimeters: string;
  millimeters: string;
  meters: string;
}[] = [
  { imperial: '1 in', centimeters: '2.54', millimeters: '25.4', meters: '0.0254' },
  { imperial: '6 in', centimeters: '15.24', millimeters: '152.4', meters: '0.1524' },
  { imperial: '1 ft', centimeters: '30.48', millimeters: '304.8', meters: '0.3048' },
  { imperial: '1 yd', centimeters: '91.44', millimeters: '914.4', meters: '0.9144' },
  { imperial: '6 ft', centimeters: '182.88', millimeters: '1828.8', meters: '1.8288' },
  { imperial: '12 ft', centimeters: '365.76', millimeters: '3657.6', meters: '3.6576' },
  { imperial: '30 ft', centimeters: '914.4', millimeters: '9144', meters: '9.144' },
  { imperial: '50 ft', centimeters: '1524', millimeters: '15240', meters: '15.24' },
];

// --- Section 12: Length Metric to Imperial ---

export const LENGTH_METRIC_TO_IMPERIAL_ROWS: {
  metric: string;
  inches: string;
  feet: string;
}[] = [
  { metric: '1 cm', inches: '0.3937', feet: '0.03281' },
  { metric: '5 cm', inches: '1.9685', feet: '0.16404' },
  { metric: '10 cm', inches: '3.9370', feet: '0.32808' },
  { metric: '1 m', inches: '39.3701', feet: '3.28084' },
  { metric: '3 m', inches: '118.110', feet: '9.84252' },
  { metric: '5 m', inches: '196.850', feet: '16.4042' },
  { metric: '10 m', inches: '393.701', feet: '32.8084' },
  { metric: '15 m', inches: '590.551', feet: '49.2126' },
  { metric: '25 m', inches: '984.252', feet: '82.0210' },
];

// --- Section 13: Area Imperial to Metric ---

export const AREA_IMPERIAL_TO_METRIC_ROWS: {
  squareYards: string;
  squareMeters: string;
}[] = [
  { squareYards: '1 yd²', squareMeters: '0.83613' },
  { squareYards: '2 yd²', squareMeters: '1.67225' },
  { squareYards: '5 yd²', squareMeters: '4.18064' },
  { squareYards: '10 yd²', squareMeters: '8.36127' },
  { squareYards: '25 yd²', squareMeters: '20.9032' },
];

// --- Section 14: Area Metric to Imperial ---

export const AREA_METRIC_TO_IMPERIAL_ROWS: {
  squareMeters: string;
  squareYards: string;
}[] = [
  { squareMeters: '1 m²', squareYards: '1.19599' },
  { squareMeters: '2 m²', squareYards: '2.39198' },
  { squareMeters: '5 m²', squareYards: '5.97995' },
  { squareMeters: '10 m²', squareYards: '11.9599' },
  { squareMeters: '25 m²', squareYards: '29.8998' },
];

// --- Section 15: General Conversion Chart ---

export const GENERAL_CONVERSION_ROWS: {
  from: string;
  to: string;
  multiplyBy: string;
  notes?: string;
}[] = [
  { from: 'Acres', to: 'Hectares', multiplyBy: '0.404686' },
  { from: 'Acres', to: 'Square yards', multiplyBy: '4,840' },
  { from: 'Board feet', to: 'Cubic inches', multiplyBy: '144' },
  { from: 'Board feet', to: 'Cubic feet', multiplyBy: '0.083333' },
  { from: 'Centimeters', to: 'Inches', multiplyBy: '0.393701' },
  { from: 'Cubic feet', to: 'Liters', multiplyBy: '28.3168' },
  { from: 'Cubic inches', to: 'Cubic centimeters', multiplyBy: '16.3871' },
  { from: 'Cubic meters', to: 'Cubic feet', multiplyBy: '35.3147' },
  { from: 'Cubic meters', to: 'Cubic yards', multiplyBy: '1.30795' },
  { from: 'Cubic yards', to: 'Cubic meters', multiplyBy: '0.764555' },
  { from: 'Degrees', to: 'Radians', multiplyBy: '0.0174533' },
  { from: 'Fahrenheit', to: 'Celsius', multiplyBy: '(°F − 32) × 0.555556', notes: 'Formula, not a single factor' },
  { from: 'Celsius', to: 'Fahrenheit', multiplyBy: '(°C × 1.8) + 32', notes: 'Formula, not a single factor' },
  { from: 'Feet', to: 'Centimeters', multiplyBy: '30.48' },
  { from: 'Feet', to: 'Meters', multiplyBy: '0.3048' },
  { from: 'Feet', to: 'Millimeters', multiplyBy: '304.8' },
  { from: 'Gallons, US', to: 'Cubic feet', multiplyBy: '0.133681' },
  { from: 'Gallons, US', to: 'Cubic inches', multiplyBy: '231' },
  { from: 'Gallons, US', to: 'Liters', multiplyBy: '3.78541' },
  { from: 'Hectares', to: 'Acres', multiplyBy: '2.47105' },
  { from: 'Inches', to: 'Centimeters', multiplyBy: '2.54' },
  { from: 'Inches', to: 'Millimeters', multiplyBy: '25.4' },
  { from: 'Kilograms', to: 'Pounds', multiplyBy: '2.20462' },
  { from: 'Kilometers', to: 'Miles', multiplyBy: '0.621371' },
  { from: 'Kilometers', to: 'Nautical miles', multiplyBy: '0.539957' },
  { from: 'Liters', to: 'Gallons, US', multiplyBy: '0.264172' },
  { from: 'Meters', to: 'Feet', multiplyBy: '3.28084' },
  { from: 'Meters', to: 'Inches', multiplyBy: '39.3701' },
  { from: 'Meters', to: 'Yards', multiplyBy: '1.09361' },
  { from: 'Miles', to: 'Kilometers', multiplyBy: '1.60934' },
  { from: 'Miles', to: 'Feet', multiplyBy: '5,280' },
  { from: 'Miles', to: 'Nautical miles', multiplyBy: '0.868976' },
  { from: 'Nautical miles', to: 'Feet', multiplyBy: '6,076.12' },
  { from: 'Nautical miles', to: 'Miles', multiplyBy: '1.15078' },
  { from: 'Pounds', to: 'Grams', multiplyBy: '453.592' },
  { from: 'Pounds', to: 'Kilograms', multiplyBy: '0.453592' },
  { from: 'Pounds per foot', to: 'Kilograms per meter', multiplyBy: '1.48816' },
  { from: 'Pounds per square foot', to: 'Kilograms per square meter', multiplyBy: '4.88243' },
  { from: 'Radians', to: 'Degrees', multiplyBy: '57.2958' },
  { from: 'Square centimeters', to: 'Square inches', multiplyBy: '0.155' },
  { from: 'Square feet', to: 'Square meters', multiplyBy: '0.092903' },
  { from: 'Square inches', to: 'Square centimeters', multiplyBy: '6.4516' },
  { from: 'Square inches', to: 'Square millimeters', multiplyBy: '645.16' },
  { from: 'Square kilometers', to: 'Acres', multiplyBy: '247.105' },
  { from: 'Square kilometers', to: 'Square miles', multiplyBy: '0.386102' },
  { from: 'Square meters', to: 'Square feet', multiplyBy: '10.7639' },
  { from: 'Square miles', to: 'Square kilometers', multiplyBy: '2.58999' },
  { from: 'Metric tons', to: 'Pounds', multiplyBy: '2,204.62' },
  { from: 'Metric tons', to: 'Long tons', multiplyBy: '0.984207' },
  { from: 'Metric tons', to: 'Short tons', multiplyBy: '1.10231' },
  { from: 'Yards', to: 'Meters', multiplyBy: '0.9144' },
];

// --- Section 16: Material Weights ---

export type MaterialWeightRow = {
  material: string;
  approximateWeight: string;
  unit: string;
  notes?: string;
};

export type MaterialWeightGroup = {
  group: string;
  rows: MaterialWeightRow[];
};

export const MATERIAL_WEIGHT_GROUPS: MaterialWeightGroup[] = [
  {
    group: 'Concrete',
    rows: [
      { material: 'Stone, reinforced', approximateWeight: '150', unit: 'lb/ft³' },
      { material: 'Stone, plain', approximateWeight: '144', unit: 'lb/ft³' },
      { material: 'Slag, plain', approximateWeight: '130', unit: 'lb/ft³' },
      { material: 'Cinder, reinforced', approximateWeight: '100–115', unit: 'lb/ft³' },
    ],
  },
  {
    group: 'Lightweight concrete',
    rows: [
      { material: 'Aerocrete', approximateWeight: '50–80', unit: 'lb/ft³' },
      { material: 'Cinder fill', approximateWeight: '60', unit: 'lb/ft³' },
      { material: 'Haydite', approximateWeight: '85–100', unit: 'lb/ft³' },
      { material: 'Nailcode', approximateWeight: '75', unit: 'lb/ft³' },
      { material: 'Perlite', approximateWeight: '35–50', unit: 'lb/ft³' },
      { material: 'Pumice', approximateWeight: '60–90', unit: 'lb/ft³' },
      { material: 'Vermiculite', approximateWeight: '25–60', unit: 'lb/ft³' },
    ],
  },
  {
    group: 'Mortar and plaster',
    rows: [
      { material: 'Masonry mortar', approximateWeight: '116', unit: 'lb/ft³' },
      { material: 'Gypsum plaster, sand', approximateWeight: '104–120', unit: 'lb/ft³' },
      { material: 'Gypsum plaster, perlite', approximateWeight: '50–55', unit: 'lb/ft³' },
      { material: 'Portland cement plaster, sand', approximateWeight: '104–120', unit: 'lb/ft³' },
      { material: 'Portland cement plaster, perlite', approximateWeight: '50–55', unit: 'lb/ft³' },
      { material: 'Portland cement plaster, vermiculite', approximateWeight: '50–55', unit: 'lb/ft³' },
    ],
  },
  {
    group: 'Brick and block',
    rows: [
      { material: 'Common clay brick', approximateWeight: '120', unit: 'lb/ft³', notes: 'Solid unit weight' },
      { material: 'Concrete block, normal weight', approximateWeight: '125', unit: 'lb/ft³' },
      { material: 'Concrete block, lightweight', approximateWeight: '85', unit: 'lb/ft³' },
      { material: 'Hollow tile, structural', approximateWeight: '80–100', unit: 'lb/ft³' },
      { material: '4-inch brick veneer wall', approximateWeight: '40', unit: 'lb/ft²', notes: 'Wall assembly, not unit volume' },
      { material: '8-inch CMU wall', approximateWeight: '80', unit: 'lb/ft²', notes: 'Wall assembly, not unit volume' },
    ],
  },
  {
    group: 'Soil, sand, and gravel',
    rows: [
      { material: 'Cinder and ashes', approximateWeight: '40–45', unit: 'lb/ft³' },
      { material: 'Clay, damp/plastic', approximateWeight: '110', unit: 'lb/ft³' },
      { material: 'Clay, dry', approximateWeight: '63', unit: 'lb/ft³' },
      { material: 'Clay and gravel, dry', approximateWeight: '100', unit: 'lb/ft³' },
      { material: 'Earth, dry/loose', approximateWeight: '76', unit: 'lb/ft³' },
      { material: 'Earth, dry/packed', approximateWeight: '95', unit: 'lb/ft³' },
      { material: 'Earth, moist/loose', approximateWeight: '78', unit: 'lb/ft³' },
      { material: 'Earth, moist/packed', approximateWeight: '96', unit: 'lb/ft³' },
      { material: 'Earth, mud/packed', approximateWeight: '115', unit: 'lb/ft³' },
      { material: 'Sand or gravel, dry/loose', approximateWeight: '90–105', unit: 'lb/ft³' },
      { material: 'Sand or gravel, dry/packed', approximateWeight: '100–120', unit: 'lb/ft³' },
      { material: 'Sand or gravel, wet', approximateWeight: '118–120', unit: 'lb/ft³' },
    ],
  },
  {
    group: 'Stone',
    rows: [
      { material: 'Granite', approximateWeight: '165', unit: 'lb/ft³', notes: 'Approximate' },
      { material: 'Limestone', approximateWeight: '160', unit: 'lb/ft³', notes: 'Approximate' },
      { material: 'Marble', approximateWeight: '168', unit: 'lb/ft³', notes: 'Approximate' },
      { material: 'Sandstone / bluestone', approximateWeight: '145', unit: 'lb/ft³', notes: 'Approximate' },
      { material: 'Slate', approximateWeight: '175', unit: 'lb/ft³', notes: 'Approximate' },
    ],
  },
  {
    group: 'Wood',
    rows: [
      { material: 'Birch / red oak', approximateWeight: '44', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Northern white cedar', approximateWeight: '22', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Western red cedar', approximateWeight: '23', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Southern cypress', approximateWeight: '32', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Douglas fir', approximateWeight: '34', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Commercial white fir', approximateWeight: '27', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Hemlock', approximateWeight: '28–29', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Hard maple', approximateWeight: '42', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'White oak', approximateWeight: '47', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Northern pine', approximateWeight: '25', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Southern pine', approximateWeight: '29', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Ponderosa pine', approximateWeight: '28', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Shortleaf southern pine', approximateWeight: '36', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Yellow poplar', approximateWeight: '28', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Redwood', approximateWeight: '28', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
      { material: 'Black walnut', approximateWeight: '38', unit: 'lb/ft³', notes: 'At about 12% moisture content' },
    ],
  },
  {
    group: 'Metals',
    rows: [
      { material: 'Aluminum, cast', approximateWeight: '165', unit: 'lb/ft³' },
      { material: 'Brass, red', approximateWeight: '546', unit: 'lb/ft³' },
      { material: 'Brass/yellow/extruded bronze', approximateWeight: '528', unit: 'lb/ft³' },
      { material: 'Bronze, commercial', approximateWeight: '552', unit: 'lb/ft³' },
      { material: 'Bronze, statuary', approximateWeight: '509', unit: 'lb/ft³' },
      { material: 'Copper, cast or rolled', approximateWeight: '556', unit: 'lb/ft³' },
      { material: 'Cast gray iron', approximateWeight: '450', unit: 'lb/ft³' },
      { material: 'Wrought iron', approximateWeight: '485', unit: 'lb/ft³' },
      { material: 'Lead', approximateWeight: '710', unit: 'lb/ft³' },
      { material: 'Monel', approximateWeight: '552', unit: 'lb/ft³' },
      { material: 'Nickel', approximateWeight: '555', unit: 'lb/ft³' },
      { material: 'Stainless steel, rolled', approximateWeight: '492–510', unit: 'lb/ft³' },
      { material: 'Steel, rolled', approximateWeight: '490', unit: 'lb/ft³' },
      { material: 'Zinc, rolled or cast', approximateWeight: '440', unit: 'lb/ft³' },
    ],
  },
];

// --- Section 17: Rebar ---

export const REBAR_REFERENCE_ROWS: {
  barSize: string;
  nominalDiameter: string;
  weightPerFoot: string;
}[] = [
  { barSize: '#3', nominalDiameter: '0.375 in', weightPerFoot: '0.376 lb/ft' },
  { barSize: '#4', nominalDiameter: '0.500 in', weightPerFoot: '0.668 lb/ft' },
  { barSize: '#5', nominalDiameter: '0.625 in', weightPerFoot: '1.043 lb/ft' },
  { barSize: '#6', nominalDiameter: '0.750 in', weightPerFoot: '1.502 lb/ft' },
  { barSize: '#7', nominalDiameter: '0.875 in', weightPerFoot: '2.044 lb/ft' },
  { barSize: '#8', nominalDiameter: '1.000 in', weightPerFoot: '2.670 lb/ft' },
  { barSize: '#9', nominalDiameter: '1.128 in', weightPerFoot: '3.400 lb/ft' },
  { barSize: '#10', nominalDiameter: '1.270 in', weightPerFoot: '4.303 lb/ft' },
  { barSize: '#11', nominalDiameter: '1.410 in', weightPerFoot: '5.313 lb/ft' },
  { barSize: '#14', nominalDiameter: '1.693 in', weightPerFoot: '7.650 lb/ft' },
  { barSize: '#18', nominalDiameter: '2.257 in', weightPerFoot: '13.600 lb/ft' },
];

// --- Section registry ---

export const CONVERSION_SECTIONS: ConversionSection[] = [
  {
    id: 'basic-length-conversions',
    title: 'Basic Length Conversions',
    description: 'Canonical length factors between metric and imperial units for field and office checks.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'area-conversions',
    title: 'Area Conversions',
    description: 'Square feet, square yards, acres, and roofing squares for takeoff and ordering.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'volume-conversions',
    title: 'Volume Conversions',
    description: 'Cubic feet, cubic yards, and gallons with construction ordering notes.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'weight-material-ordering',
    title: 'Weight / Material Ordering Conversions',
    description: 'Volume-to-weight formulas and planning examples — confirm density before ordering.',
    kind: 'formulas',
    status: 'available',
    badge: 'Reference',
  },
  {
    id: 'lumber-board-feet',
    title: 'Lumber / Board Foot Conversions',
    description: 'Board-foot formulas and common dimensional lumber linear-foot factors.',
    kind: 'formulas',
    status: 'available',
    badge: 'Reference',
  },
  {
    id: 'imperial-fraction-metric',
    title: 'Imperial Fraction to Metric Reference',
    description: 'Fractional inches to decimal inches and millimeters for layout and fabrication.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'roof-slope-pitch',
    title: 'Roof Slope / Pitch Reference',
    description: 'Common roof pitches with percent slope and angle — footprint is not roof area.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'common-conversion-mistakes',
    title: 'Common Construction Conversion Mistakes',
    description: 'Unit mismatches that cause ordering errors, quantity overruns, and rework.',
    kind: 'mistake-cards',
    status: 'available',
    badge: 'Reference',
  },
  {
    id: 'trade-quick-reference',
    title: 'Trade Quick Reference',
    description: 'The most common unit mismatch by trade — what to convert before ordering.',
    kind: 'trade-cards',
    status: 'available',
    badge: 'Reference',
  },
  {
    id: 'printable-conversion-pack',
    title: 'Printable Conversion Pack',
    description: 'PDF-ready conversion sheets for field crews and estimators.',
    kind: 'coming-soon',
    status: 'coming-soon',
    printable: true,
  },
  {
    id: 'length-imperial-to-metric',
    title: 'Length: Imperial to Metric',
    description: 'Quick lookup from common imperial lengths to centimeters, millimeters, and meters.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'length-metric-to-imperial',
    title: 'Length: Metric to Imperial',
    description: 'Quick lookup from common metric lengths to inches and feet.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'area-imperial-to-metric',
    title: 'Area: Imperial to Metric',
    description: 'Square yards to square meters for flooring and site area checks.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'area-metric-to-imperial',
    title: 'Area: Metric to Imperial',
    description: 'Square meters to square yards for imperial-based ordering.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'general-conversion-chart',
    title: 'General Conversion Chart',
    description: 'Compact multiply-by reference for common construction unit conversions.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
  {
    id: 'material-weights-density',
    title: 'Material Weights / Density Reference',
    description: 'Approximate material weights for planning — confirm with supplier for final checks.',
    kind: 'grouped-table',
    status: 'available',
    badge: 'Reference',
  },
  {
    id: 'rebar-diameter-weight',
    title: 'Rebar Diameter and Weight Reference',
    description: 'Standard bar sizes with nominal diameter and weight per linear foot.',
    kind: 'table',
    status: 'available',
    badge: 'Table',
  },
];

export const FEATURED_CONVERSION_IDS: string[] = [
  'basic-length-conversions',
  'area-conversions',
  'volume-conversions',
  'imperial-fraction-metric',
  'roof-slope-pitch',
  'common-conversion-mistakes',
  'trade-quick-reference',
  'length-imperial-to-metric',
  'length-metric-to-imperial',
  'area-imperial-to-metric',
  'area-metric-to-imperial',
  'general-conversion-chart',
  'material-weights-density',
  'rebar-diameter-weight',
];

export function getConversionSection(id: string): ConversionSection | undefined {
  return CONVERSION_SECTIONS.find((s) => s.id === id);
}

export function conversionContentContainsProhibitedTerms(): string[] {
  const blob = JSON.stringify({
    CONVERSION_SECTIONS,
    BASIC_LENGTH_CONVERSION_ROWS,
    AREA_CONVERSION_ROWS,
    VOLUME_CONVERSION_ROWS,
    VOLUME_CONSTRUCTION_NOTES,
    WEIGHT_ORDERING_FORMULAS,
    WEIGHT_PLANNING_EXAMPLES,
    LUMBER_BOARD_FEET_FORMULAS,
    LUMBER_LF_EXAMPLES,
    IMPERIAL_FRACTION_METRIC_ROWS,
    ROOF_SLOPE_ROWS,
    CONVERSION_MISTAKE_CARDS,
    TRADE_QUICK_REFERENCE_CARDS,
    LENGTH_IMPERIAL_TO_METRIC_ROWS,
    LENGTH_METRIC_TO_IMPERIAL_ROWS,
    AREA_IMPERIAL_TO_METRIC_ROWS,
    AREA_METRIC_TO_IMPERIAL_ROWS,
    GENERAL_CONVERSION_ROWS,
    MATERIAL_WEIGHT_GROUPS,
    REBAR_REFERENCE_ROWS,
    CONVERSION_PAGE_SUBTITLE,
    CONVERSION_ROUNDING_NOTE,
    CONVERSION_FIELD_NOTE,
    WEIGHT_DENSITY_WARNING,
    WEIGHT_TO_VOLUME_WARNING,
    MATERIAL_WEIGHTS_NOTE,
    REBAR_WEIGHT_NOTE,
    ROOF_PITCH_FOOTPRINT_NOTE,
    LUMBER_NOMINAL_NOTE,
  });
  return PROHIBITED_CONVERSION_TERMS.filter((term) => blob.includes(term));
}
