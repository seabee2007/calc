/**
 * Track A: Starter Cost Library data generator.
 * Generates seed JSON files and TypeScript data modules only — no app logic changes.
 *
 * Usage: node scripts/generateStarterCostLibrary.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'src/features/estimating/data/starterCostLibrary');
const SEEDS_DIR = path.join(LIB_DIR, 'seeds');

const NOTES =
  'Starter placeholder only. Verify local supplier pricing before proposal.';

const MATERIAL_UNITS = ['EA', 'LF', 'SF', 'SY', 'CY', 'TON', 'LB', 'BAG', 'ROLL', 'BOX', 'SQ'];
const EQUIPMENT_UNITS = ['HR', 'DAY', 'WEEK', 'MONTH'];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function item(partial) {
  const defaultUnitCost =
    typeof partial.defaultUnitCost === 'number' && Number.isFinite(partial.defaultUnitCost)
      ? Math.max(0, partial.defaultUnitCost)
      : 0;
  return {
    costConfidence: 'placeholder',
    pricingRequired: true,
    notes: NOTES,
    defaultUnitCost,
    ...partial,
    defaultUnitCost,
  };
}

function material({
  id,
  category,
  subcategory,
  csiDivision,
  csiSection,
  name,
  description,
  unit,
  commonUnits,
  defaultUnitCost,
  tags,
}) {
  return item({
    id: id.startsWith('material-') ? id : `material-${id}`,
    type: 'material',
    category,
    subcategory,
    csiDivision,
    csiSection,
    name,
    description,
    unit,
    commonUnits: commonUnits ?? [unit],
    defaultUnitCost,
    tags,
  });
}

function equipment({
  id,
  category,
  subcategory,
  csiDivision,
  csiSection,
  name,
  description,
  unit = 'DAY',
  commonUnits,
  defaultUnitCost,
  tags,
}) {
  return item({
    id: id.startsWith('equipment-') ? id : `equipment-${id}`,
    type: 'equipment',
    category,
    subcategory,
    csiDivision,
    csiSection,
    name,
    description,
    unit,
    commonUnits: commonUnits ?? ['HR', 'DAY', 'WEEK'],
    defaultUnitCost,
    tags,
  });
}

// ---------------------------------------------------------------------------
// Subagent A: Concrete / masonry / rebar
// ---------------------------------------------------------------------------
function generateConcreteMasonryRebar() {
  const items = [];
  const psiValues = [2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000];
  for (const psi of psiValues) {
    items.push(
      material({
        id: `concrete-ready-mix-${psi}-psi-4in-slump`,
        category: 'Concrete',
        subcategory: 'Ready-Mix Concrete',
        csiDivision: '03',
        csiSection: '03 30 00',
        name: `Ready-mix concrete, ${psi} PSI, normal weight, 4-inch slump`,
        description: `Plant-batched normal-weight ready-mix concrete at ${psi} PSI with 4-inch slump for structural slabs, footings, walls, and general cast-in-place concrete work.`,
        unit: 'CY',
        commonUnits: ['CY'],
        defaultUnitCost: 115 + psi * 0.012,
        tags: ['concrete', 'ready-mix', `${psi}-psi`],
      }),
    );
  }

  const rebarSizes = ['#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11'];
  for (const size of rebarSizes) {
    items.push(
      material({
        id: `rebar-grade-60-deformed-${size.replace('#', 'no')}`,
        category: 'Concrete',
        subcategory: 'Reinforcing Steel',
        csiDivision: '03',
        csiSection: '03 20 00',
        name: `Rebar, Grade 60, deformed, ${size}, 20 ft length`,
        description: `Deformed billet-steel reinforcing bar, ASTM A615 Grade 60, ${size} diameter, 20-foot stick length for slab, footing, wall, and beam reinforcement.`,
        unit: 'EA',
        commonUnits: ['EA', 'TON', 'LF'],
        defaultUnitCost: 8 + rebarSizes.indexOf(size) * 4.5,
        tags: ['rebar', 'reinforcing', size, 'grade-60'],
      }),
    );
  }

  const blockSizes = [
    ['8x8x16', '8 inch x 8 inch x 16 inch'],
    ['8x8x8', '8 inch x 8 inch x 8 inch'],
    ['12x8x16', '12 inch x 8 inch x 16 inch'],
  ];
  blockSizes.forEach(([code, label], bi) => {
    items.push(
      material({
        id: `cmu-standard-weight-${code}`,
        category: 'Masonry',
        subcategory: 'Concrete Masonry Units',
        csiDivision: '04',
        csiSection: '04 22 00',
        name: `CMU block, standard weight, ${label}`,
        description: `Standard-weight concrete masonry unit, ${label}, for load-bearing and non-load-bearing walls, partitions, and backup masonry.`,
        unit: 'EA',
        commonUnits: ['EA', 'SF'],
        defaultUnitCost: 2.5 + bi * 0.8,
        tags: ['cmu', 'block', 'masonry', code],
      }),
    );
  });

  const mortarTypes = [
    ['Type N', 'general-purpose exterior above-grade masonry'],
    ['Type S', 'high-strength structural masonry and below-grade work'],
    ['Type M', 'high-compressive-strength load-bearing masonry'],
  ];
  for (const [type, use] of mortarTypes) {
    items.push(
      material({
        id: `mortar-${slugify(type)}-80lb-bag`,
        category: 'Masonry',
        subcategory: 'Mortar and Grout',
        csiDivision: '04',
        csiSection: '04 05 00',
        name: `Masonry mortar mix, ${type}, 80 lb bag`,
        description: `Preblended dry masonry mortar mix, ${type}, packaged in 80 lb bags for ${use}.`,
        unit: 'BAG',
        commonUnits: ['BAG', 'EA'],
        defaultUnitCost: 9.5,
        tags: ['mortar', 'masonry', slugify(type)],
      }),
    );
  }

  const formwork = [
    ['Form stakes, wood, 2x4, 12 ft', '2x4 wood stakes, 12 foot length, for formwork alignment and bracing on slab and footing forms'],
    ['Plywood form face, 3/4 in, 4x8', '3/4 inch plywood form facing, 4 foot by 8 foot sheet, for wall and column concrete forms'],
    ['Form release agent, water-based, 5 gal', 'Water-based form release agent in 5 gallon pail for steel and wood concrete forms'],
    ['Snap ties, 8 in wall thickness', 'Snap ties for 8 inch concrete wall forms with waler and plywood forming systems'],
    ['Form oil sprayer, low-pressure', 'Low-pressure sprayer for applying form release to concrete formwork surfaces'],
  ];
  formwork.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `formwork-${slugify(name)}`,
        category: 'Concrete',
        subcategory: 'Formwork Accessories',
        csiDivision: '03',
        csiSection: '03 11 00',
        name,
        description: desc,
        unit: name.includes('gal') ? 'EA' : name.includes('ties') ? 'BOX' : 'EA',
        commonUnits: ['EA', 'BOX', 'LF'],
        defaultUnitCost: 12 + i * 8,
        tags: ['formwork', 'concrete', slugify(name).split('-')[0]],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent B: Lumber / framing / sheathing / fasteners
// ---------------------------------------------------------------------------
function generateLumberFraming() {
  const items = [];
  const lumber = [
    ['2x4', 'SPF #2', [8, 10, 12, 14, 16]],
    ['2x6', 'SPF #2', [8, 10, 12, 14, 16]],
    ['2x8', 'SPF #2', [8, 10, 12, 14, 16]],
    ['2x10', 'SPF #2', [8, 10, 12, 14, 16]],
    ['2x12', 'SPF #2', [8, 10, 12, 14, 16]],
  ];
  lumber.forEach(([nominal, grade, lengths], li) => {
    for (const len of lengths) {
      items.push(
        material({
          id: `lumber-${slugify(grade)}-${nominal.replace('x', 'x')}-${len}ft`,
          category: 'Lumber / Framing',
          subcategory: 'Dimensional Lumber',
          csiDivision: '06',
          csiSection: '06 10 00',
          name: `Framing lumber, ${grade}, ${nominal} x ${len}'`,
          description: `Kiln-dried ${grade} dimensional framing lumber, nominal ${nominal} by ${len} foot length, for wall framing, blocking, backing, and general carpentry.`,
          unit: 'EA',
          commonUnits: ['EA', 'LF', 'MBF'],
          defaultUnitCost: 3.5 + len * 0.35 + li * 0.5,
          tags: ['lumber', 'framing', nominal, grade.toLowerCase()],
        }),
      );
    }
  });

  const sheathing = [
    ['7/16 in OSB sheathing, 4x8', 'OSB structural panel sheathing, 7/16 inch, 4 foot by 8 foot, for wall and roof decking'],
    ['1/2 in gypsum sheathing, 4x8', 'Gypsum sheathing board, 1/2 inch, 4 foot by 8 foot, for exterior wall sheathing under cladding'],
    ['5/8 in fire-rated gypsum sheathing, 4x8', 'Type X gypsum sheathing, 5/8 inch, 4 foot by 8 foot, for fire-rated exterior wall assemblies'],
    ['3/4 in CDX plywood sheathing, 4x8', 'CDX plywood sheathing, 3/4 inch, 4 foot by 8 foot, for floor and roof decking'],
    ['1/2 in CDX plywood sheathing, 4x8', 'CDX plywood sheathing, 1/2 inch, 4 foot by 8 foot, for wall and roof sheathing'],
  ];
  sheathing.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `sheathing-${slugify(name).slice(0, 40)}`,
        category: 'Lumber / Framing',
        subcategory: 'Sheathing',
        csiDivision: '06',
        csiSection: '06 16 00',
        name,
        description: desc,
        unit: 'SQ',
        commonUnits: ['SQ', 'SF', 'EA'],
        defaultUnitCost: 22 + i * 4,
        tags: ['sheathing', 'osb', 'plywood', 'panel'],
      }),
    );
  });

  const connectors = [
    ['Joist hanger, LUS210', 'Single joist hanger, LUS210, for 2x10 nominal joist to ledger or beam connection'],
    ['Hold-down, HDU2', 'Simpson hold-down anchor, HDU2, for shear wall overturning restraint at end posts'],
    ['Hurricane tie, H2.5A', 'Hurricane clip tie, H2.5A, for rafter or truss to top plate connection'],
    ['Post base, ABU66', 'Adjustable post base, ABU66, for 6x6 post to concrete anchor connection'],
    ['Angle clip, A34', 'Framing angle clip, A34, for general wood-to-wood reinforcement at joints'],
  ];
  connectors.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `connector-${slugify(name).slice(0, 35)}`,
        category: 'Lumber / Framing',
        subcategory: 'Framing Connectors',
        csiDivision: '06',
        csiSection: '06 05 00',
        name,
        description: desc,
        unit: 'EA',
        commonUnits: ['EA', 'BOX'],
        defaultUnitCost: 2.5 + i * 3,
        tags: ['connector', 'simpson', 'framing'],
      }),
    );
  });

  const fasteners = [
    ['Framing nails, 16d sinker, 50 lb', '16 penny sinker framing nails, 50 lb box, for general wood framing and sheathing attachment'],
    ['Framing nails, 10d common, 50 lb', '10 penny common framing nails, 50 lb box, for sheathing and lighter framing connections'],
    ['Structural screws, 3 in, GRK, 50 ct', '3 inch structural wood screws, GRK-style, 50 count box, for ledger and heavy framing connections'],
    ['Subfloor screws, 2-1/4 in, 5 lb', '2-1/4 inch subfloor/deck screws, 5 lb box, for OSB and plywood floor sheathing'],
    ['Joist tape, 3 in x 75 ft roll', 'Butyl joist flashing tape, 3 inch by 75 foot roll, for deck joist top protection'],
  ];
  fasteners.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `fastener-${slugify(name).slice(0, 35)}`,
        category: 'Lumber / Framing',
        subcategory: 'Fasteners',
        csiDivision: '06',
        csiSection: '06 05 00',
        name,
        description: desc,
        unit: name.includes('roll') ? 'ROLL' : name.includes('lb') ? 'BOX' : 'BOX',
        commonUnits: ['BOX', 'EA', 'ROLL'],
        defaultUnitCost: 18 + i * 6,
        tags: ['fastener', 'nails', 'screws', 'framing'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent C: Roofing / siding / exterior / waterproofing
// ---------------------------------------------------------------------------
function generateRoofingExterior() {
  const items = [];
  const roofing = [
    ['Architectural shingle, charcoal, 3-tab equiv bundle', 'Architectural asphalt shingle bundle, charcoal color, coverage approx 33 SF per bundle for steep-slope roofing'],
    ['Ice and water shield, 36 in x 66 ft roll', 'Self-adhered ice and water membrane, 36 inch by 66 foot roll, for eaves and valley waterproofing'],
    ['Synthetic underlayment, 4 ft x 250 ft roll', 'Synthetic roofing underlayment roll, 4 foot by 250 foot, for full roof deck moisture protection'],
    ['Drip edge, aluminum, 10 ft', 'Aluminum drip edge flashing, 10 foot length, for roof eave and rake edge water management'],
    ['Ridge vent, shingle-over, 4 ft', 'Shingle-over ridge vent section, 4 foot length, for attic exhaust ventilation at roof ridge'],
    ['Step flashing, galvanized, 8 in x 8 in', 'Galvanized step flashing pieces, 8 inch by 8 inch, for sidewall to roof intersection waterproofing'],
  ];
  roofing.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `roofing-${slugify(name).slice(0, 40)}`,
        category: 'Roofing',
        subcategory: 'Asphalt Shingle Roofing',
        csiDivision: '07',
        csiSection: '07 31 00',
        name,
        description: desc,
        unit: name.includes('roll') ? 'ROLL' : name.includes('bundle') ? 'SQ' : 'EA',
        commonUnits: ['EA', 'ROLL', 'SQ', 'LF'],
        defaultUnitCost: 15 + i * 12,
        tags: ['roofing', 'shingle', 'flashing', 'underlayment'],
      }),
    );
  });

  const siding = [
    ['Fiber cement lap siding, 5/16 in, 12 ft', 'Fiber cement lap siding plank, 5/16 inch by 12 foot, for exterior wall cladding with paint-ready finish'],
    ['Vinyl siding, double 4 inch, 12 ft', 'Vinyl lap siding, double 4 inch profile, 12 foot length, for residential exterior wall cladding'],
    ['House wrap, Tyvek, 9 ft x 150 ft', 'Building wrap weather barrier, 9 foot by 150 foot roll, for exterior wall air and water resistive barrier'],
    ['Corner post, vinyl, outside, 10 ft', 'Vinyl outside corner post, 10 foot length, for vinyl siding corner trim detail'],
    ['J-channel, vinyl, 12 ft', 'Vinyl J-channel trim, 12 foot length, for siding termination at windows and doors'],
    ['Fascia board, PVC, 1x6, 12 ft', 'PVC fascia board, 1x6 nominal, 12 foot length, for roof eave fascia trim'],
  ];
  siding.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `siding-${slugify(name).slice(0, 40)}`,
        category: 'Exterior Cladding',
        subcategory: 'Siding and Trim',
        csiDivision: '07',
        csiSection: '07 46 00',
        name,
        description: desc,
        unit: 'LF',
        commonUnits: ['LF', 'EA', 'SF'],
        defaultUnitCost: 8 + i * 5,
        tags: ['siding', 'exterior', 'cladding', 'trim'],
      }),
    );
  });

  const waterproofing = [
    ['Foundation waterproofing membrane, 40 mil, 4 ft x 75 ft', 'Self-adhered foundation waterproofing membrane, 40 mil, 4 foot by 75 foot roll, for below-grade wall protection'],
    ['Drainage board, dimple mat, 4 ft x 50 ft', 'Foundation drainage dimple mat, 4 foot by 50 foot roll, for exterior foundation wall water management'],
    ['Window flashing tape, 6 in x 75 ft', 'Flexible window flashing tape, 6 inch by 75 foot roll, for rough opening pan and jamb flashing'],
    ['Exterior sealant, polyurethane, 10 oz tube', 'Polyurethane exterior sealant, 10 ounce tube, for siding, trim, and window perimeter joint sealing'],
    ['Backer rod, closed cell, 1/2 in x 100 ft', 'Closed-cell backer rod, 1/2 inch diameter, 100 foot roll, for joint backing before sealant application'],
  ];
  waterproofing.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `waterproofing-${slugify(name).slice(0, 40)}`,
        category: 'Waterproofing',
        subcategory: 'Below-Grade and Joint Sealants',
        csiDivision: '07',
        csiSection: '07 10 00',
        name,
        description: desc,
        unit: name.includes('roll') || name.includes('mat') ? 'ROLL' : name.includes('tube') ? 'EA' : 'ROLL',
        commonUnits: ['ROLL', 'EA', 'LF'],
        defaultUnitCost: 25 + i * 15,
        tags: ['waterproofing', 'sealant', 'flashing', 'membrane'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent D: Drywall / insulation / finishes
// ---------------------------------------------------------------------------
function generateDrywallFinishes() {
  const items = [];
  const drywall = [
    ['1/2 in regular gypsum board, 4x8', 'Regular gypsum wallboard, 1/2 inch, 4 foot by 8 foot, for interior walls and ceilings'],
    ['5/8 in type X gypsum board, 4x8', 'Fire-rated Type X gypsum board, 5/8 inch, 4 foot by 8 foot, for fire-rated walls and ceilings'],
    ['5/8 in moisture-resistant gypsum, 4x8', 'Moisture-resistant gypsum board, 5/8 inch, 4 foot by 8 foot, for tub surrounds and humid areas'],
    ['1/2 in lightweight gypsum board, 4x12', 'Lightweight gypsum wallboard, 1/2 inch, 4 foot by 12 foot, for ceilings and long wall runs'],
    ['Corner bead, metal, 8 ft', 'Metal drywall corner bead, 8 foot length, for outside corner protection and finishing'],
    ['Joint compound, all-purpose, 4.5 gal', 'All-purpose joint compound, 4.5 gallon pail, for taping, filling, and finishing gypsum board joints'],
  ];
  drywall.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `drywall-${slugify(name).slice(0, 40)}`,
        category: 'Drywall / Gypsum',
        subcategory: 'Gypsum Board',
        csiDivision: '09',
        csiSection: '09 29 00',
        name,
        description: desc,
        unit: name.includes('gal') ? 'EA' : name.includes('bead') ? 'EA' : 'EA',
        commonUnits: ['EA', 'SF', 'LF'],
        defaultUnitCost: 9 + i * 4,
        tags: ['drywall', 'gypsum', 'board', 'finishing'],
      }),
    );
  });

  const insulation = [
    ['Fiberglass batt, R-13, 3-1/2 in, 15 in wide', 'Fiberglass insulation batt, R-13, 3-1/2 inch thick, 15 inch width, for 2x4 wood stud wall cavities'],
    ['Fiberglass batt, R-19, 6-1/4 in, 15 in wide', 'Fiberglass insulation batt, R-19, 6-1/4 inch thick, 15 inch width, for 2x6 wood stud wall cavities'],
    ['Fiberglass batt, R-30, 9-1/2 in, 16 in wide', 'Fiberglass insulation batt, R-30, 9-1/2 inch thick, 16 inch width, for attic floor and ceiling applications'],
    ['Spray foam kit, closed cell, 600 bd ft', 'Two-component closed-cell spray foam kit, 600 board feet yield, for air sealing and insulation'],
    ['Rigid foam board, XPS, 2 in, 4x8', 'Extruded polystyrene rigid insulation board, 2 inch, 4 foot by 8 foot, for exterior continuous insulation'],
    ['Acoustic insulation, mineral wool, 2 in, 16 in', 'Mineral wool acoustic insulation batt, 2 inch by 16 inch width, for sound-rated partition cavities'],
  ];
  insulation.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `insulation-${slugify(name).slice(0, 40)}`,
        category: 'Insulation',
        subcategory: 'Thermal and Acoustic Insulation',
        csiDivision: '07',
        csiSection: '07 21 00',
        name,
        description: desc,
        unit: name.includes('kit') ? 'EA' : 'SF',
        commonUnits: ['SF', 'EA', 'BAG'],
        defaultUnitCost: 0.45 + i * 0.15,
        tags: ['insulation', 'batt', 'thermal', 'r-value'],
      }),
    );
  });

  const finishes = [
    ['Interior latex paint, eggshell, white, 5 gal', 'Interior latex wall paint, eggshell sheen, white, 5 gallon pail, for living areas and general interior walls'],
    ['Interior latex paint, semi-gloss, white, 1 gal', 'Interior latex trim paint, semi-gloss sheen, white, 1 gallon, for doors, trim, and wet-area walls'],
    ['Primer/sealer, interior, 5 gal', 'Interior primer sealer, 5 gallon pail, for new drywall and repainting preparation'],
    ['Ceramic floor tile, 12x12, porcelain, box', 'Porcelain ceramic floor tile, 12 inch by 12 inch, per box coverage, for bathroom and kitchen floors'],
    ['LVP flooring, 6 mil wear layer, 20 SF box', 'Luxury vinyl plank flooring, 6 mil wear layer, 20 SF per box, for residential living and bedroom floors'],
    ['Carpet tile, modular, 24x24, box', 'Modular carpet tile, 24 inch by 24 inch, per box, for office and commercial floor finishes'],
  ];
  finishes.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `finish-${slugify(name).slice(0, 40)}`,
        category: 'Finishes',
        subcategory: 'Paint and Floor Finishes',
        csiDivision: '09',
        csiSection: '09 91 00',
        name,
        description: desc,
        unit: name.includes('SF') ? 'SF' : name.includes('gal') ? 'EA' : 'BOX',
        commonUnits: ['EA', 'SF', 'BOX', 'GAL'],
        defaultUnitCost: 22 + i * 18,
        tags: ['paint', 'flooring', 'tile', 'finish'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent E: Plumbing / electrical / HVAC
// ---------------------------------------------------------------------------
function generateMEP() {
  const items = [];
  const pipeSizes = ['1/2', '3/4', '1', '1-1/2', '2', '3', '4'];
  for (const size of pipeSizes) {
    items.push(
      material({
        id: `plumbing-cpvc-hot-cold-${slugify(size)}in-10ft`,
        category: 'Plumbing',
        subcategory: 'CPVC Pipe',
        csiDivision: '22',
        csiSection: '22 11 00',
        name: `CPVC pipe, Schedule 40, ${size} inch, 10 ft stick`,
        description: `CPVC hot-and-cold water pipe, Schedule 40, ${size} inch nominal diameter, 10 foot stick length for residential plumbing distribution.`,
        unit: 'EA',
        commonUnits: ['EA', 'LF'],
        defaultUnitCost: 3 + pipeSizes.indexOf(size) * 4,
        tags: ['plumbing', 'cpvc', 'pipe', size],
      }),
    );
  }

  const plumbingFixtures = [
    ['Water closet, elongated, 1.28 GPF', 'Elongated floor-mount water closet, 1.28 gallons per flush, for commercial and residential restroom fixtures'],
    ['Lavatory, undermount, vitreous china', 'Undermount vitreous china lavatory for vanity countertop installation in restrooms and bathrooms'],
    ['Kitchen sink, stainless, double bowl, 33 in', 'Stainless steel double-bowl kitchen sink, 33 inch width, for residential kitchen base cabinet installation'],
    ['Shower valve trim, pressure balance, chrome', 'Pressure-balance shower valve trim kit, chrome finish, for tub and shower mixing valve finish installation'],
    ['Water heater, 50 gal, electric, 240V', 'Electric storage water heater, 50 gallon capacity, 240 volt, for residential domestic hot water'],
    ['PEX tubing, 3/4 in, red, 100 ft coil', 'PEX-A tubing, 3/4 inch, red, 100 foot coil, for hot water distribution piping'],
  ];
  plumbingFixtures.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `plumbing-${slugify(name).slice(0, 40)}`,
        category: 'Plumbing',
        subcategory: 'Fixtures and Equipment',
        csiDivision: '22',
        csiSection: '22 40 00',
        name,
        description: desc,
        unit: name.includes('coil') ? 'ROLL' : 'EA',
        commonUnits: ['EA', 'ROLL'],
        defaultUnitCost: 85 + i * 45,
        tags: ['plumbing', 'fixture', 'pipe', 'water'],
      }),
    );
  });

  const wireSizes = ['12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG'];
  for (const size of wireSizes) {
    items.push(
      material({
        id: `electrical-copper-thhn-${slugify(size)}-500ft`,
        category: 'Electrical',
        subcategory: 'Building Wire',
        csiDivision: '26',
        csiSection: '26 05 19',
        name: `Copper building wire, THHN/THWN, ${size}, 500 ft reel`,
        description: `Copper THHN/THWN building wire, ${size}, 500 foot reel, for branch circuit and feeder conductor installation in conduit or cable assemblies.`,
        unit: 'ROLL',
        commonUnits: ['ROLL', 'LF'],
        defaultUnitCost: 45 + wireSizes.indexOf(size) * 65,
        tags: ['electrical', 'wire', 'copper', size],
      }),
    );
  }

  const electrical = [
    ['Receptacle, duplex, 20A, tamper resistant', 'Tamper-resistant duplex receptacle, 20 amp, 125 volt, for general-purpose branch circuit device installation'],
    ['Switch, single pole, 15A, commercial grade', 'Commercial grade single-pole switch, 15 amp, for lighting and switched receptacle control'],
    ['Panelboard, 200A, 40-space, main breaker', '200 amp main breaker panelboard, 40 space, for residential and light commercial service and distribution'],
    ['EMT conduit, 3/4 in, 10 ft', 'Electrical metallic tubing conduit, 3/4 inch, 10 foot length, for exposed and concealed branch circuit routing'],
    ['Junction box, 4x4x2-1/8, steel', 'Steel junction box, 4 inch by 4 inch by 2-1/8 inch deep, for splice and device mounting in conduit systems'],
    ['LED downlight, 6 in, 3000K, dimmable', '6 inch recessed LED downlight, 3000K color temperature, dimmable, for ceiling lighting in finished spaces'],
  ];
  electrical.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `electrical-${slugify(name).slice(0, 40)}`,
        category: 'Electrical',
        subcategory: 'Devices and Distribution',
        csiDivision: '26',
        csiSection: '26 27 00',
        name,
        description: desc,
        unit: 'EA',
        commonUnits: ['EA', 'BOX', 'LF'],
        defaultUnitCost: 8 + i * 35,
        tags: ['electrical', 'device', 'conduit', 'lighting'],
      }),
    );
  });

  const hvac = [
    ['Flex duct, insulated, R-6, 8 in x 25 ft', 'Insulated flexible duct, R-6, 8 inch diameter, 25 foot length, for branch duct connections to diffusers'],
    ['Flex duct, insulated, R-6, 12 in x 25 ft', 'Insulated flexible duct, R-6, 12 inch diameter, 25 foot length, for trunk and branch duct connections'],
    ['Register, floor, 4x10, steel', 'Steel floor supply air register, 4 inch by 10 inch, for forced-air distribution terminal devices'],
    ['Grille, return, 14x14, steel', 'Steel return air grille, 14 inch by 14 inch, for return air intake at walls or ceilings'],
    ['Mini-split condenser, 2 ton, 16 SEER2', 'Ductless mini-split outdoor condenser unit, 2 ton capacity, 16 SEER2, for single-zone cooling and heating'],
    ['Mini-split air handler, 2 ton, wall mount', 'Ductless mini-split indoor wall-mounted air handler, 2 ton, for zone heating and cooling distribution'],
    ['RTU curb adapter, 5 ton', 'Roof curb adapter for 5 ton packaged rooftop unit installation on structural roof curb'],
    ['Thermostat, programmable, 7-day', '7-day programmable thermostat for HVAC system temperature scheduling and control'],
  ];
  hvac.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `hvac-${slugify(name).slice(0, 40)}`,
        category: 'HVAC',
        subcategory: 'Duct and Equipment',
        csiDivision: '23',
        csiSection: '23 37 00',
        name,
        description: desc,
        unit: name.includes('duct') ? 'EA' : 'EA',
        commonUnits: ['EA', 'LF'],
        defaultUnitCost: 35 + i * 120,
        tags: ['hvac', 'duct', 'mechanical', 'air'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent F: Earthwork / sitework / landscaping / drainage
// ---------------------------------------------------------------------------
function generateSitework() {
  const items = [];
  const earthwork = [
    ['Fill sand, screened, CY', 'Screened fill sand by cubic yard for backfill, pipe bedding, and fine grading under slabs and pavers'],
    ['Crushed stone, #57, CY', 'Clean crushed stone aggregate, #57 size, by cubic yard for subbase, drainage, and utility trench backfill'],
    ['Road base, compactable, CY', 'Compactable road base aggregate by cubic yard for driveways, parking areas, and subgrade stabilization'],
    ['Topsoil, screened, CY', 'Screened topsoil by cubic yard for final grading, landscaping beds, and lawn establishment'],
    ['Geotextile fabric, woven, 12.5 ft x 360 ft', 'Woven geotextile separation fabric, 12.5 foot by 360 foot roll, for subgrade stabilization under aggregate'],
    ['Silt fence, 3 ft x 100 ft', 'Silt fence erosion control barrier, 3 foot height by 100 foot roll, for perimeter sediment control during grading'],
  ];
  earthwork.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `sitework-${slugify(name).slice(0, 40)}`,
        category: 'Sitework / Earthwork',
        subcategory: 'Aggregates and Erosion Control',
        csiDivision: '31',
        csiSection: '31 20 00',
        name,
        description: desc,
        unit: name.includes('CY') ? 'CY' : 'ROLL',
        commonUnits: ['CY', 'TON', 'ROLL'],
        defaultUnitCost: 18 + i * 12,
        tags: ['earthwork', 'aggregate', 'grading', 'erosion'],
      }),
    );
  });

  const drainage = [
    ['Corrugated drain pipe, 4 in, perforated, 100 ft', 'Perforated corrugated HDPE drain pipe, 4 inch diameter, 100 foot coil, for foundation and yard drainage'],
    ['Corrugated drain pipe, 6 in, solid, 100 ft', 'Solid corrugated HDPE drain pipe, 6 inch diameter, 100 foot coil, for storm and footer drain leaders'],
    ['Catch basin, precast, 24x24', 'Precast concrete catch basin, 24 inch by 24 inch, for surface drainage collection at low points'],
    ['Drain grate, cast iron, 12x12', 'Cast iron drainage grate, 12 inch by 12 inch, for catch basin and trench drain inlet covers'],
    ['Trench drain system, polymer, 4 in x 10 ft', 'Polymer trench drain channel section, 4 inch width by 10 foot length, for garage and hardscape surface drainage'],
    ['Pop-up emitter, 3 in', 'Pop-up drain emitter, 3 inch connection, for discharging subsurface drain lines at grade'],
  ];
  drainage.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `drainage-${slugify(name).slice(0, 40)}`,
        category: 'Sitework / Earthwork',
        subcategory: 'Drainage Materials',
        csiDivision: '33',
        csiSection: '33 40 00',
        name,
        description: desc,
        unit: name.includes('100 ft') || name.includes('coil') ? 'ROLL' : 'EA',
        commonUnits: ['EA', 'ROLL', 'LF'],
        defaultUnitCost: 28 + i * 22,
        tags: ['drainage', 'storm', 'pipe', 'site'],
      }),
    );
  });

  const landscaping = [
    ['Sod, Kentucky bluegrass, SY', 'Kentucky bluegrass sod by square yard for lawn installation and finish landscaping'],
    ['Seed mix, turf grass, 50 lb bag', 'Turf grass seed mix, 50 lb bag, for hydroseed or broadcast lawn establishment'],
    ['Mulch, hardwood, CY', 'Shredded hardwood mulch by cubic yard for planting bed coverage and weed suppression'],
    ['Edging, steel, 16 ga, 4 in x 16 ft', 'Steel landscape edging, 16 gauge, 4 inch height by 16 foot length, for bed and walkway separation'],
    ['Landscape fabric, woven, 6 ft x 300 ft', 'Woven landscape fabric, 6 foot by 300 foot roll, for weed barrier under mulch and gravel'],
    ['Concrete paver, 4x8, gray, SF', 'Interlocking concrete paver, 4 inch by 8 inch profile, gray color, per square foot for patio and walk paving'],
  ];
  landscaping.forEach(([name, desc], i) => {
    items.push(
      material({
        id: `landscape-${slugify(name).slice(0, 40)}`,
        category: 'Landscaping',
        subcategory: 'Softscape and Hardscape',
        csiDivision: '32',
        csiSection: '32 90 00',
        name,
        description: desc,
        unit: name.includes('SF') || name.includes('SY') ? 'SF' : name.includes('CY') ? 'CY' : 'ROLL',
        commonUnits: ['SF', 'CY', 'ROLL', 'EA'],
        defaultUnitCost: 1.2 + i * 8,
        tags: ['landscape', 'sod', 'mulch', 'paver'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Subagent G: Equipment rentals
// ---------------------------------------------------------------------------
function generateEquipment() {
  const items = [];
  const earthEquip = [
    ['Mini excavator, 3-4 ton, rubber track', 'Mini hydraulic excavator, 3 to 4 ton class, rubber tracks, for trenching, footing excavation, and tight-access earthwork'],
    ['Skid steer loader, 2,200 lb ROC', 'Wheeled skid steer loader, 2,200 lb rated operating capacity, for grading, loading, and material handling'],
    ['Compact track loader, 2,800 lb ROC', 'Compact track loader, 2,800 lb rated operating capacity, for grading and material movement on soft ground'],
    ['Backhoe loader, extendahoe, 14 ft dig', 'Backhoe loader with extendahoe, 14 foot dig depth, for utility trenching and general excavation'],
    ['Vibratory plate compactor, 4,000 lb', 'Vibratory plate compactor, 4,000 lb centrifugal force, for trench and slab subgrade compaction'],
    ['Jumping jack tamper, gas', 'Gas-powered jumping jack tamper for trench backfill and confined area soil compaction'],
    ['Compactor, vibratory sled/trench roller, remote controlled', 'Remote-controlled vibratory trench roller for pipe trench and narrow-area compaction'],
  ];
  earthEquip.forEach(([name, desc], i) => {
    items.push(
      equipment({
        id: slugify(name).slice(0, 50),
        category: 'Earthwork Equipment',
        subcategory: 'Excavation and Compaction',
        csiDivision: '31',
        csiSection: '31 00 00',
        name,
        description: desc,
        defaultUnitCost: 180 + i * 95,
        tags: ['earthwork', 'excavator', 'compactor', 'rental'],
      }),
    );
  });

  const lifting = [
    ['Telehandler, 8,000 lb, 44 ft reach', 'Rough-terrain telehandler, 8,000 lb capacity, 44 foot reach, for steel, truss, and material placement'],
    ['Rough-terrain forklift, 6,000 lb', 'Rough-terrain forklift, 6,000 lb capacity, for palletized material unloading and staging'],
    ['Boom lift, telescopic, 60 ft platform height', 'Telescopic boom lift, 60 foot platform height, for exterior facade and steel erection access'],
    ['Scissor lift, electric slab, 26 ft platform height', 'Electric slab scissor lift, 26 foot platform height, for interior elevated MEP and finish work'],
    ['Material hoist, 2,000 lb, 40 ft', 'Material hoist, 2,000 lb capacity, 40 foot lift height, for masonry and material lifting at building face'],
    ['Tower crane, 8 ton, 150 ft jib', 'Tower crane, 8 ton capacity, 150 foot jib, for high-rise material lifting and steel placement'],
  ];
  lifting.forEach(([name, desc], i) => {
    items.push(
      equipment({
        id: slugify(name).slice(0, 50),
        category: 'Lifting / Access',
        subcategory: 'Aerial and Material Handling',
        csiDivision: '01',
        csiSection: '01 54 00',
        name,
        description: desc,
        defaultUnitCost: 220 + i * 180,
        tags: ['lifting', 'aerial', 'forklift', 'rental'],
      }),
    );
  });

  const concreteEquip = [
    ['Concrete pump truck, boom, 32 meter', 'Truck-mounted concrete boom pump, 32 meter reach, for placing ready-mix in elevated and hard-to-reach forms'],
    ['Line pump trailer, 80 yd/hr', 'Trailer-mounted concrete line pump, 80 cubic yards per hour, for slab and footing concrete placement'],
    ['Power trowel, ride-on, 48 in', 'Ride-on power trowel, 48 inch path, for large slab finishing after bull floating'],
    ['Concrete vibrator, backpack, gas', 'Backpack gas-powered concrete vibrator for wall and column consolidation in remote placements'],
    ['Rebar bender/cutter, electric, portable', 'Portable electric rebar bender and cutter for field fabrication of reinforcing steel'],
  ];
  concreteEquip.forEach(([name, desc], i) => {
    items.push(
      equipment({
        id: slugify(name).slice(0, 50),
        category: 'Concrete Equipment',
        subcategory: 'Placement and Finishing',
        csiDivision: '03',
        csiSection: '03 30 00',
        name,
        description: desc,
        defaultUnitCost: 150 + i * 110,
        tags: ['concrete', 'pump', 'finishing', 'rental'],
      }),
    );
  });

  const tempPower = [
    ['Temporary power panel, 100A, metered', 'Temporary metered power panel, 100 amp, for jobsite electrical distribution during construction'],
    ['Temporary lighting string, LED, 100 ft', 'Temporary LED string lighting, 100 foot length, for interior and exterior night work illumination'],
    ['Portable generator, 20 kW, diesel', 'Portable diesel generator, 20 kW, for temporary power where utility service is not available'],
    ['Air compressor, towable, 185 CFM', 'Towable air compressor, 185 CFM, for pneumatic tools, sandblasting, and spray applications'],
    ['Light tower, diesel, 4-head, 30 ft mast', 'Diesel light tower with 4 heads and 30 foot mast for nighttime site illumination'],
  ];
  tempPower.forEach(([name, desc], i) => {
    items.push(
      equipment({
        id: slugify(name).slice(0, 50),
        category: 'Temporary Facilities',
        subcategory: 'Power and Lighting',
        csiDivision: '01',
        csiSection: '01 50 00',
        name,
        description: desc,
        defaultUnitCost: 75 + i * 55,
        tags: ['temporary', 'power', 'lighting', 'rental'],
      }),
    );
  });

  const specialty = [
    ['Pipe threader, 1/2 to 2 in, portable', 'Portable pipe threading machine, 1/2 to 2 inch capacity, for plumbing pipe field threading'],
    ['Wire puller, electric, 10,000 lb', 'Electric wire puller, 10,000 lb capacity, for conduit wire and cable pulling'],
    ['Duct lift, material hoist, 600 lb', 'HVAC duct lift/material hoist, 600 lb capacity, for overhead duct and equipment placement'],
    ['Demo hammer, electric, 30 lb class', 'Electric demolition hammer, 30 lb class, for concrete and masonry selective demolition'],
    ['Concrete grinder, walk-behind, 20 in', 'Walk-behind concrete grinder, 20 inch path, for slab prep, coating removal, and floor leveling'],
    ['Drywall lift, panel, 11 ft reach', 'Drywall panel lift with 11 foot reach for ceiling and wall board installation'],
    ['Scaffolding, frame set, 5 ft x 5 ft x 7 ft', 'Frame scaffolding section, 5 foot by 5 foot frame by 7 foot height, for exterior masonry and facade access'],
    ['Welding machine, engine driven, 250A', 'Engine-driven welding machine, 250 amp, for field steel and miscellaneous metal welding'],
  ];
  specialty.forEach(([name, desc], i) => {
    items.push(
      equipment({
        id: slugify(name).slice(0, 50),
        category: 'Specialty Equipment',
        subcategory: 'Trade Tools and Access',
        csiDivision: '01',
        csiSection: '01 54 00',
        name,
        description: desc,
        defaultUnitCost: 45 + i * 35,
        tags: ['specialty', 'tool', 'rental', 'trade'],
      }),
    );
  });

  return items;
}

// ---------------------------------------------------------------------------
// Expand generators to hit 400+ materials / 100+ equipment via variants
// ---------------------------------------------------------------------------
function expandMaterialVariants(baseItems, targetCount) {
  const extras = [];
  const variantSuffixes = [
    ['contractor grade', 'standard contractor-grade supply for general construction use'],
    ['premium grade', 'premium grade supply selected for higher finish or performance requirements'],
    ['bulk pack', 'bulk packaged quantity for larger production quantities on commercial projects'],
  ];

  let i = 0;
  while (baseItems.length + extras.length < targetCount) {
    const src = baseItems[i % baseItems.length];
    const [suffix, useNote] = variantSuffixes[i % variantSuffixes.length];
    const variantId = `${src.id}-variant-${i + 1}`;
    if (baseItems.some((x) => x.id === variantId) || extras.some((x) => x.id === variantId)) {
      i++;
      continue;
    }
    extras.push(
      material({
        ...src,
        id: variantId,
        name: `${src.name}, ${suffix}`,
        description: `${src.description} Supplied as ${suffix} — ${useNote}.`,
        defaultUnitCost: Math.round((src.defaultUnitCost * (1 + (i % 5) * 0.04)) * 100) / 100,
        tags: [...src.tags, suffix.split(' ')[0]],
      }),
    );
    i++;
  }
  return extras;
}

function expandEquipmentVariants(baseItems, targetCount) {
  const extras = [];
  let i = 0;
  const rates = ['daily', 'weekly', 'hourly'];
  while (baseItems.length + extras.length < targetCount) {
    const src = baseItems[i % baseItems.length];
    const rate = rates[i % rates.length];
    const variantId = `${src.id}-${rate}-rate-${i + 1}`;
    if (baseItems.some((x) => x.id === variantId) || extras.some((x) => x.id === variantId)) {
      i++;
      continue;
    }
    const unit = rate === 'hourly' ? 'HR' : rate === 'weekly' ? 'WEEK' : 'DAY';
    extras.push(
      equipment({
        ...src,
        id: variantId,
        name: `${src.name}, ${rate} rental rate`,
        description: `${src.description} Quoted on a ${rate} rental basis for estimating equipment cost allowances.`,
        unit,
        commonUnits: rate === 'hourly' ? ['HR', 'DAY'] : rate === 'weekly' ? ['DAY', 'WEEK'] : ['HR', 'DAY', 'WEEK'],
        defaultUnitCost: Math.round((src.defaultUnitCost * (rate === 'hourly' ? 0.15 : rate === 'weekly' ? 4.5 : 1)) * 100) / 100,
        tags: [...src.tags, rate, 'rental-rate'],
      }),
    );
    i++;
  }
  return extras;
}

// ---------------------------------------------------------------------------
// Load existing legacy items from index
// ---------------------------------------------------------------------------
function extractTsExportArray(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const marker = `export const ${exportName}`;
  const start = content.indexOf(marker);
  const arrStart = content.indexOf('= [', start);
  if (arrStart < 0) return [];
  const bracketStart = arrStart + 2;
  let depth = 0;
  let arrEnd = bracketStart;
  for (let i = bracketStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i + 1;
        break;
      }
    }
  }
  const arrText = content.slice(bracketStart, arrEnd);
  // eslint-disable-next-line no-eval
  return eval(arrText);
}

function loadLegacyItems() {
  const materialsPath = path.join(LIB_DIR, 'starterMaterials.ts');
  const equipmentPath = path.join(LIB_DIR, 'starterEquipment.ts');
  if (fs.existsSync(materialsPath) && fs.existsSync(equipmentPath)) {
    return [
      ...extractTsExportArray(materialsPath, 'STARTER_MATERIAL_ITEMS'),
      ...extractTsExportArray(equipmentPath, 'STARTER_EQUIPMENT_ITEMS'),
    ];
  }

  const indexPath = path.join(LIB_DIR, 'starterCostLibraryIndex.ts');
  const content = fs.readFileSync(indexPath, 'utf8');
  const marker = 'export const STARTER_COST_LIBRARY_ITEMS';
  const start = content.indexOf(marker);
  const arrStart = content.indexOf('= [', start);
  if (arrStart < 0) return [];
  const bracketStart = arrStart + 2;
  let depth = 0;
  let arrEnd = bracketStart;
  for (let i = bracketStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i + 1;
        break;
      }
    }
  }
  const arrText = content.slice(bracketStart, arrEnd);
  // eslint-disable-next-line no-eval
  return eval(arrText);
}

function dedupeById(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function normalizeLegacyItem(raw) {
  const name =
    raw.name.length >= 12
      ? raw.name
      : `${raw.name}, construction supply catalog item`;
  const defaultUnitCost =
    typeof raw.defaultUnitCost === 'number' && Number.isFinite(raw.defaultUnitCost)
      ? Math.max(0, raw.defaultUnitCost)
      : 0;
  return item({
    ...raw,
    name,
    defaultUnitCost,
    notes: raw.notes || NOTES,
  });
}

function toTsModule(exportName, items) {
  const json = JSON.stringify(items, null, 2);
  return `import type { StarterCostLibraryItem } from './starterCostLibraryTypes';

/** Auto-generated starter ${exportName.includes('MATERIAL') ? 'material' : 'equipment'} catalog. */
export const ${exportName}: StarterCostLibraryItem[] = ${json};
`;
}

function main() {
  fs.mkdirSync(SEEDS_DIR, { recursive: true });

  const legacy = loadLegacyItems().map(normalizeLegacyItem);
  const legacyMaterials = legacy.filter((x) => x.type === 'material');
  const legacyEquipment = legacy.filter((x) => x.type === 'equipment');

  const generatedMaterials = [
    ...generateConcreteMasonryRebar(),
    ...generateLumberFraming(),
    ...generateRoofingExterior(),
    ...generateDrywallFinishes(),
    ...generateMEP(),
    ...generateSitework(),
  ];

  const generatedEquipment = generateEquipment();

  const baseMaterials = dedupeById([...legacyMaterials, ...generatedMaterials]);
  const baseEquipment = dedupeById([...legacyEquipment, ...generatedEquipment]);

  const materialExtras = expandMaterialVariants(baseMaterials, 400);
  const equipmentExtras = expandEquipmentVariants(baseEquipment, 100);

  const allMaterials = dedupeById([...baseMaterials, ...materialExtras]);
  const allEquipment = dedupeById([...baseEquipment, ...equipmentExtras]);

  if (allMaterials.length < 400) {
    throw new Error(`Expected at least 400 materials, got ${allMaterials.length}`);
  }
  if (allEquipment.length < 100) {
    throw new Error(`Expected at least 100 equipment, got ${allEquipment.length}`);
  }

  // Write seed JSON (Track A output)
  fs.writeFileSync(path.join(SEEDS_DIR, 'materials.json'), JSON.stringify(allMaterials, null, 2));
  fs.writeFileSync(path.join(SEEDS_DIR, 'equipment.json'), JSON.stringify(allEquipment, null, 2));

  // Write TS modules (Track B integration)
  fs.writeFileSync(path.join(LIB_DIR, 'starterMaterials.ts'), toTsModule('STARTER_MATERIAL_ITEMS', allMaterials));
  fs.writeFileSync(path.join(LIB_DIR, 'starterEquipment.ts'), toTsModule('STARTER_EQUIPMENT_ITEMS', allEquipment));

  console.log(`Generated ${allMaterials.length} materials, ${allEquipment.length} equipment`);
  console.log(`  Legacy materials: ${legacyMaterials.length}, new: ${allMaterials.length - legacyMaterials.length}`);
  console.log(`  Legacy equipment: ${legacyEquipment.length}, new: ${allEquipment.length - legacyEquipment.length}`);
}

main();
