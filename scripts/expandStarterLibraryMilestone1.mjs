/**
 * Milestone 1 expansion — adds items to per-trade seed files.
 * Run: node scripts/expandStarterLibraryMilestone1.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = path.join(__dirname, '../src/features/estimating/data/starterCostLibrary/seeds');

const NOTES = 'Starter placeholder only. Verify local supplier pricing before proposal.';

function mat(p) {
  return {
    costConfidence: 'placeholder',
    pricingRequired: true,
    notes: NOTES,
    defaultUnitCost: p.defaultUnitCost ?? 0,
    type: 'material',
    ...p,
  };
}

function eq(p) {
  return {
    costConfidence: 'placeholder',
    pricingRequired: true,
    notes: NOTES,
    defaultUnitCost: p.defaultUnitCost ?? 0,
    type: 'equipment',
    unit: p.unit ?? 'day',
    commonUnits: p.commonUnits ?? ['hour', 'day', 'week', 'month'],
    ...p,
  };
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

function expandFile(relPath, newItems) {
  const filePath = path.join(SEEDS, relPath);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const ids = new Set(existing.map((x) => x.id));
  const toAdd = newItems.filter((x) => !ids.has(x.id));
  const merged = [...existing, ...toAdd];
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  console.log(`${relPath}: ${existing.length} → ${merged.length} (+${toAdd.length} new, ${newItems.length - toAdd.length} skipped dupes)`);
  return toAdd.length;
}

// ---------------------------------------------------------------------------
// A1 — concrete-masonry (+79)
// ---------------------------------------------------------------------------
function concreteMasonryItems() {
  const items = [];
  const brickTypes = [
    ['Common brick, modular, red clay', 'Standard modular clay brick for backup masonry, veneer backup, and general masonry wall construction.', '04 21 00', 'Brick', 0.85],
    ['Facing brick, modular, smooth finish', 'Modular facing brick with smooth finish for exposed exterior masonry veneer and accent walls.', '04 21 00', 'Brick', 1.25],
    ['Thin brick veneer, 1/2 in thick, modular', 'Thin brick veneer units for adhered exterior veneer systems over sheathing and backup walls.', '04 43 00', 'Brick', 2.10],
    ['Fire brick, high-alumina, 9x4.5x2.5', 'High-alumina fire brick for fireplace linings, chimneys, and high-temperature masonry applications.', '04 21 00', 'Brick', 3.50],
  ];
  for (const [name, desc, section, sub, cost] of brickTypes) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Masonry', subcategory: sub, csiDivision: '04', csiSection: section, name, description: desc, unit: 'EA', commonUnits: ['EA', 'SF'], defaultUnitCost: cost, tags: ['masonry', 'brick', sub.toLowerCase()] }));
  }

  const brickSizes = ['modular', 'queen', 'king', 'utility', 'economy'];
  for (const sz of brickSizes) {
    items.push(mat({
      id: `material-concrete-masonry-brick-clay-${sz}`,
      category: 'Masonry', subcategory: 'Brick', csiDivision: '04', csiSection: '04 21 00',
      name: `Clay brick, ${sz} size, standard red`,
      description: `${sz.charAt(0).toUpperCase() + sz.slice(1)} size clay brick for load-bearing and veneer masonry walls, chimneys, and site walls.`,
      unit: 'EA', commonUnits: ['EA', 'SF'], defaultUnitCost: 0.75 + brickSizes.indexOf(sz) * 0.15,
      tags: ['brick', 'masonry', sz],
    }));
  }

  const rebarWire = [
    ['Truss wire, 9-gauge, galvanized, 400 LF roll', 'Galvanized truss wire roll for horizontal joint reinforcement in masonry walls and veneer backup.', 'Reinforcement', 45],
    ['Ladder wire, 9-gauge, galvanized, 10 ft section', 'Galvanized ladder wire reinforcement for horizontal joint reinforcement in single-wythe and cavity masonry walls.', 'Reinforcement', 8],
    ['Horizontal joint reinforcement, 2-wire, 9-gauge, 10 ft', 'Two-wire horizontal joint reinforcement for masonry veneer and structural backup wall joint reinforcement.', 'Reinforcement', 6],
    ['Vertical joint reinforcement, 9-gauge, 10 ft', 'Vertical joint reinforcement for masonry walls requiring enhanced vertical load transfer and crack control.', 'Reinforcement', 7],
  ];
  for (const [name, desc, sub, cost] of rebarWire) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Masonry', subcategory: sub, csiDivision: '04', csiSection: '04 05 00', name, description: desc, unit: 'ROLL', commonUnits: ['ROLL', 'LF', 'EA'], defaultUnitCost: cost, tags: ['masonry', 'reinforcement', 'wire'] }));
  }

  const curing = [
    ['Curing blanket, insulated, 6 ft x 25 ft', 'Insulated concrete curing blanket for cold-weather slab and flatwork protection during initial cure period.', 'Accessories', 85],
    ['Evaporation retarder, spray-applied, 5 gal pail', 'Spray-applied evaporation retarder for flatwork and slab surfaces to reduce moisture loss during finishing.', 'Accessories', 42],
    ['Cure-and-seal compound, solvent-based, 5 gal', 'Solvent-based cure-and-seal compound for decorative and standard concrete flatwork cure and surface protection.', 'Accessories', 55],
    ['Curing compound, water-based, 5 gal pail', 'Water-based curing compound for slabs, walls, and columns to retain moisture during the initial curing period.', 'Accessories', 38],
    ['Burlap curing fabric, 36 in x 300 ft roll', 'Wet burlap curing fabric roll for moist-curing concrete slabs, walls, and structural elements.', 'Accessories', 120],
  ];
  for (const [name, desc, sub, cost] of curing) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: sub, csiDivision: '03', csiSection: '03 30 00', name, description: desc, unit: name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['ROLL', 'EA', 'GAL'], defaultUnitCost: cost, tags: ['concrete', 'curing', 'accessories'] }));
  }

  const anchors = [
    ['Wedge anchor, zinc-plated, 1/2 in x 4 in', 'Zinc-plated wedge anchor for fastening equipment, steel, and fixtures to hardened concrete slabs and walls.', 'Accessories', 2.50],
    ['Wedge anchor, stainless steel, 3/8 in x 3 in', 'Stainless steel wedge anchor for exterior and corrosive-environment concrete anchoring applications.', 'Accessories', 4.25],
    ['Sleeve anchor, zinc, 1/4 in x 2 in', 'Zinc sleeve anchor for light-duty fastening to concrete, block, and brick masonry substrates.', 'Accessories', 0.85],
    ['Drop-in anchor, zinc, 1/2 in', 'Drop-in expansion anchor for flush-mount anchoring in concrete for threaded rod and fixture connections.', 'Accessories', 1.75],
    ['Epoxy anchor system, 10 oz cartridge, high-strength', 'Two-component epoxy anchor adhesive cartridge for post-installed rebar and threaded rod in concrete.', 'Accessories', 28],
    ['Mechanical anchor, screw-type, 1/4 in x 2-1/4 in', 'Screw-type concrete anchor for light-gauge steel, furring, and fixture attachment to concrete and masonry.', 'Accessories', 0.65],
  ];
  for (const [name, desc, sub, cost] of anchors) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: sub, csiDivision: '03', csiSection: '03 15 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'BOX'], defaultUnitCost: cost, tags: ['concrete', 'anchor', 'fastener'] }));
  }

  const repair = [
    ['Hydraulic cement, fast-setting, 50 lb bag', 'Fast-setting hydraulic cement for stopping active water leaks in concrete and masonry walls and floors.', 'Grout and Repair', 18],
    ['Polymer-modified patching mortar, 50 lb bag', 'Polymer-modified cementitious patching mortar for repairing spalled and damaged concrete surfaces.', 'Grout and Repair', 22],
    ['Concrete resurfacer, self-leveling, 50 lb bag', 'Self-leveling concrete resurfacer for restoring worn, scaled, or uneven interior and exterior slabs.', 'Grout and Repair', 28],
    ['Epoxy injection resin, low viscosity, 1 gal kit', 'Low-viscosity epoxy injection resin for structural crack repair in concrete walls, slabs, and columns.', 'Grout and Repair', 65],
  ];
  for (const [name, desc, sub, cost] of repair) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: sub, csiDivision: '03', csiSection: '03 60 00', name, description: desc, unit: 'BAG', commonUnits: ['BAG', 'EA'], defaultUnitCost: cost, tags: ['concrete', 'repair', 'patch'] }));
  }

  const accessories = [
    ['Vapor barrier, polyethylene, 10 mil, 10 ft x 100 ft', '10 mil polyethylene vapor barrier roll for under-slab moisture protection in slab-on-grade construction.', 'Accessories', 45],
    ['Welded wire mesh, 6x6 W1.4/W1.4, 5 ft x 150 ft roll', 'Welded wire reinforcement mesh roll for slab-on-grade, driveways, and light structural flatwork reinforcement.', 'Reinforcing Steel', 85],
    ['Fiber reinforcement, synthetic macro, 1.5 lb bag', 'Synthetic macro fiber bag additive for shrinkage and temperature crack control in concrete flatwork.', 'Accessories', 12],
    ['Expansion joint filler, 1/2 in x 4 in x 10 ft', 'Preformed expansion joint filler for isolation and control joints in concrete slabs and flatwork.', 'Accessories', 8],
    ['Waterstop, PVC, 6 in center bulb', 'PVC waterstop profile for construction joints in below-grade concrete walls and water-retaining structures.', 'Accessories', 6],
    ['Dowels, smooth, #4, 18 in length with cap', 'Smooth dowel bars with end caps for contraction joints in concrete slabs-on-grade and pavement.', 'Reinforcing Steel', 3.50],
  ];
  for (const [name, desc, sub, cost] of accessories) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: sub, csiDivision: '03', csiSection: sub === 'Reinforcing Steel' ? '03 20 00' : '03 30 00', name, description: desc, unit: name.includes('roll') ? 'ROLL' : name.includes('bag') ? 'BAG' : 'EA', commonUnits: ['EA', 'ROLL', 'LF', 'BAG'], defaultUnitCost: cost, tags: ['concrete', slug(sub).split('-')[0], 'accessories'] }));
  }

  // CMU variants
  const cmuTypes = [
    ['8x8x16', 'normal weight', 2.25],
    ['8x8x16', 'lightweight', 2.75],
    ['12x8x16', 'normal weight', 3.50],
    ['8x8x16', 'split face', 3.25],
    ['8x8x16', 'glazed', 4.50],
    ['4x8x16', 'normal weight', 1.85],
  ];
  for (const [size, weight, cost] of cmuTypes) {
    items.push(mat({
      id: `material-concrete-masonry-cmu-${slug(size)}-${slug(weight)}`,
      category: 'Masonry', subcategory: 'Concrete Masonry Units', csiDivision: '04', csiSection: '04 22 00',
      name: `CMU block, ${weight}, ${size.replace(/x/g, ' inch x ')} inch`,
      description: `${weight.charAt(0).toUpperCase() + weight.slice(1)} concrete masonry unit, ${size}, for load-bearing walls, partitions, and backup masonry construction.`,
      unit: 'EA', commonUnits: ['EA', 'SF'], defaultUnitCost: cost,
      tags: ['cmu', 'block', 'masonry', weight],
    }));
  }

  // Mortar color variants
  const mortarColors = ['gray', 'buff', 'white', 'tan'];
  for (const color of mortarColors) {
    items.push(mat({
      id: `material-concrete-masonry-mortar-type-s-${color}-80lb`,
      category: 'Masonry', subcategory: 'Mortar and Grout', csiDivision: '04', csiSection: '04 05 00',
      name: `Masonry mortar mix, Type S, ${color}, 80 lb bag`,
      description: `Type S structural masonry mortar mix, ${color} color, 80 lb bag for below-grade and structural masonry wall construction.`,
      unit: 'BAG', commonUnits: ['BAG', 'EA'], defaultUnitCost: 10 + mortarColors.indexOf(color) * 1.5,
      tags: ['mortar', 'masonry', color],
    }));
  }

  // Rebar accessories
  const rebarAcc = [
    ['Rebar chairs, plastic, 2 in height, bag of 100', 'Plastic rebar support chairs for maintaining rebar elevation in slab-on-grade and flatwork.', 18],
    ['Rebar tie wire, 16-gauge, 3.5 lb coil', 'Black annealed rebar tie wire coil for securing reinforcing steel intersections in concrete forms.', 8],
    ['Rebar caps, mushroom, #3-#8, bag of 50', 'Mushroom-style rebar safety caps for protecting exposed vertical rebar on jobsites.', 22],
    ['Mechanical rebar splice, coupler, #5', 'Mechanical rebar coupler for #5 bar splicing in columns, walls, and heavy structural reinforcement.', 12],
  ];
  for (const [name, desc, cost] of rebarAcc) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: 'Reinforcing Steel', csiDivision: '03', csiSection: '03 20 00', name, description: desc, unit: name.includes('bag') || name.includes('coil') ? 'BOX' : 'EA', commonUnits: ['BOX', 'EA'], defaultUnitCost: cost, tags: ['rebar', 'reinforcing', 'accessories'] }));
  }

  // Formwork additions
  const formAdd = [
    ['Form lumber, SPF #2, 2x6 x 12 ft', 'SPF #2 dimensional lumber 2x6 by 12 foot for concrete wall and column formwork construction.', 9],
    ['Form lumber, SPF #2, 2x8 x 12 ft', 'SPF #2 dimensional lumber 2x8 by 12 foot for heavy concrete wall and footing formwork.', 12],
    ['Form tie, fiberglass, 8 in wall', 'Fiberglass form tie for 8 inch concrete wall forms, break-back type for easy removal after pour.', 1.25],
    ['Form clamp, flat bar, 8 in wall', 'Flat bar form clamp for securing plywood and waler formwork on concrete wall forms.', 3.50],
    ['Form release agent, biodegradable, 5 gal', 'Biodegradable form release agent for wood and steel concrete forms, 5 gallon pail.', 48],
  ];
  for (const [name, desc, cost] of formAdd) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Concrete', subcategory: 'Formwork Accessories', csiDivision: '03', csiSection: '03 11 00', name, description: desc, unit: name.includes('gal') ? 'EA' : 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['formwork', 'concrete', 'lumber'] }));
  }

  // Grout variants
  const groutTypes = [
    ['Non-shrink grout, high-strength, 50 lb', 'High-strength non-shrink grout for equipment bases, column bases, and anchor bolt grouting.', 22],
    ['Flowable fill, controlled low-strength, CY', 'Controlled low-strength flowable fill for utility trench backfill and void fill around structures.', 85],
    ['Cellular grout, lightweight, CY', 'Lightweight cellular grout for fill over soft soils, pipe encasement, and annular space fill.', 95],
  ];
  for (const [name, desc, cost] of groutTypes) {
    items.push(mat({ id: `material-concrete-masonry-grout-${slug(name)}`, category: 'Concrete', subcategory: 'Grout and Repair', csiDivision: '03', csiSection: '03 60 00', name: name + (name.includes('CY') ? '' : ' bag'), description: desc + ' Used in structural and non-structural grouting applications.', unit: name.includes('CY') ? 'CY' : 'BAG', commonUnits: ['BAG', 'CY'], defaultUnitCost: cost, tags: ['grout', 'concrete', 'fill'] }));
  }

  // Admixtures
  const admix = [
    ['Water reducer, mid-range, 1 gal', 'Mid-range water reducing admixture for improved workability and strength in ready-mix concrete.', 18],
    ['Air entrainer, 1 gal', 'Air-entraining admixture for freeze-thaw durable exterior concrete in cold climate applications.', 15],
    ['Accelerator, calcium chloride, 50 lb bag', 'Calcium chloride set accelerator for cold-weather concrete placement and early strength gain.', 12],
    ['Retarder, 1 gal', 'Set retarding admixture for hot-weather concrete placement to extend working time.', 20],
  ];
  for (const [name, desc, cost] of admix) {
    items.push(mat({ id: `material-concrete-masonry-admix-${slug(name)}`, category: 'Concrete', subcategory: 'Accessories', csiDivision: '03', csiSection: '03 30 00', name, description: desc, unit: name.includes('bag') ? 'BAG' : 'GAL', commonUnits: ['GAL', 'BAG', 'EA'], defaultUnitCost: cost, tags: ['concrete', 'admixture', 'additive'] }));
  }

  // Flashing for masonry
  const flash = [
    ['Through-wall flashing, copper, 12 in x 50 ft roll', 'Copper through-wall flashing roll for masonry cavity wall moisture management at shelf angles and lintels.', 125],
    ['Weep vent, mortar net, 10 ft section', 'Mortar collection net weep vent for masonry cavity walls to drain moisture at the wall base.', 8],
    ['Lintel, steel angle, 4x3-1/2 x 1/4 in x 10 ft', 'Steel angle lintel for masonry openings, supporting brick and block over window and door openings.', 85],
  ];
  for (const [name, desc, cost] of flash) {
    items.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: 'Masonry', subcategory: 'Flashing', csiDivision: '04', csiSection: '04 05 00', name, description: desc, unit: name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['ROLL', 'EA', 'LF'], defaultUnitCost: cost, tags: ['masonry', 'flashing', 'lintel'] }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// A2 — lumber-framing (+61)
// ---------------------------------------------------------------------------
function lumberFramingItems() {
  const items = [];
  const lvlDepths = ['9-1/2', '11-7/8', '14', '16', '18', '24'];
  for (const d of lvlDepths) {
    items.push(mat({
      id: `material-lumber-framing-lvl-beam-${slug(d)}in`,
      category: 'Lumber / Framing', subcategory: 'Engineered Lumber', csiDivision: '06', csiSection: '06 17 00',
      name: `LVL beam, ${d} inch depth, 1.75 in width, per LF`,
      description: `Laminated veneer lumber beam, ${d} inch depth, for headers, beams, rim boards, and structural framing members.`,
      unit: 'LF', commonUnits: ['LF', 'EA'], defaultUnitCost: 3.5 + lvlDepths.indexOf(d) * 1.2,
      tags: ['lvl', 'engineered lumber', 'beam'],
    }));
  }

  const glulam = [
    ['3-1/8 x 9', '24F-V4', 12],
    ['5-1/8 x 12', '24F-V4', 18],
    ['5-1/8 x 16', '24F-V4', 24],
    ['6-3/4 x 15', '24F-V4', 28],
  ];
  for (const [size, grade, cost] of glulam) {
    items.push(mat({
      id: `material-lumber-framing-glulam-${slug(size)}-${slug(grade)}`,
      category: 'Lumber / Framing', subcategory: 'Engineered Lumber', csiDivision: '06', csiSection: '06 17 00',
      name: `Glulam beam, ${size} inch, ${grade}, per LF`,
      description: `Glued-laminated timber beam, ${size} inch, ${grade} grade, for exposed and concealed structural beam applications.`,
      unit: 'LF', commonUnits: ['LF', 'EA'], defaultUnitCost: cost,
      tags: ['glulam', 'engineered lumber', 'beam'],
    }));
  }

  const trussSpans = ['20 ft', '24 ft', '28 ft', '32 ft', '36 ft', '40 ft'];
  for (const span of trussSpans) {
    items.push(mat({
      id: `material-lumber-framing-roof-truss-${slug(span)}`,
      category: 'Lumber / Framing', subcategory: 'Engineered Lumber', csiDivision: '06', csiSection: '06 17 00',
      name: `Roof truss, common, ${span} span, 4/12 pitch`,
      description: `Prefabricated common roof truss, ${span} span, 4/12 pitch, for residential and light commercial roof framing.`,
      unit: 'EA', commonUnits: ['EA'], defaultUnitCost: 85 + trussSpans.indexOf(span) * 35,
      tags: ['truss', 'roof', 'engineered lumber'],
    }));
  }

  const iJoists = ['9-1/2', '11-7/8', '14', '16'];
  for (const d of iJoists) {
    items.push(mat({
      id: `material-lumber-framing-i-joist-${slug(d)}in`,
      category: 'Lumber / Framing', subcategory: 'Engineered Lumber', csiDivision: '06', csiSection: '06 17 00',
      name: `I-joist, ${d} inch depth, per LF`,
      description: `${d} inch depth I-joist for floor and roof framing systems with OSB web and solid or laminated flanges.`,
      unit: 'LF', commonUnits: ['LF', 'EA'], defaultUnitCost: 2.8 + iJoists.indexOf(d) * 0.6,
      tags: ['i-joist', 'engineered lumber', 'floor framing'],
    }));
  }

  const ridge = [
    ['Ridge board, SPF #2, 1x12 x 16 ft', 'SPF #2 ridge board 1x12 by 16 foot for conventional roof framing at the ridge line.', 18],
    ['Ridge board, SPF #2, 2x12 x 16 ft', 'SPF #2 ridge board 2x12 by 16 foot for heavy roof framing and open ceiling applications.', 32],
    ['Hip rafter, SPF #2, 2x8 x 14 ft', 'SPF #2 hip rafter 2x8 by 14 foot for conventional hip roof framing at the hip line.', 14],
    ['Valley rafter, SPF #2, 2x10 x 12 ft', 'SPF #2 valley rafter 2x10 by 12 foot for intersecting roof valley framing.', 16],
  ];
  for (const [name, desc, cost] of ridge) {
    items.push(mat({ id: `material-lumber-framing-${slug(name)}`, category: 'Lumber / Framing', subcategory: 'Dimensional Lumber', csiDivision: '06', csiSection: '06 10 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['lumber', 'framing', 'rafter'] }));
  }

  const treated = [
    ['2x4 x 8 ft', 'Sill plate', 6],
    ['2x6 x 8 ft', 'Sill plate', 9],
    ['2x8 x 12 ft', 'Post', 18],
    ['4x4 x 8 ft', 'Post', 14],
    ['4x6 x 12 ft', 'Post', 28],
    ['6x6 x 12 ft', 'Post', 45],
  ];
  for (const [size, use, cost] of treated) {
    items.push(mat({
      id: `material-lumber-framing-treated-${slug(size)}-${slug(use)}`,
      category: 'Lumber / Framing', subcategory: 'Treated Lumber', csiDivision: '06', csiSection: '06 10 00',
      name: `Pressure-treated lumber, ${size}, ${use}`,
      description: `Pressure-treated southern pine lumber, ${size}, for ${use.toLowerCase()} applications in contact with concrete or exposed to weather.`,
      unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost,
      tags: ['treated lumber', 'framing', use.toLowerCase()],
    }));
  }

  const blocking = [
    ['Blocking, SPF #2, 2x4 x 14-1/2 in', 'Short SPF #2 blocking for fire blocking and structural bridging between studs.', 2],
    ['Furring strip, SPF, 1x3 x 8 ft', 'SPF furring strip 1x3 by 8 foot for wall furring, ceiling furring, and backing applications.', 3],
    ['Nailer, SPF #2, 2x6 x 8 ft', 'SPF #2 nailer 2x6 by 8 foot for roof edge nailers, curtain wall attachment, and blocking.', 8],
    ['Let-in bracing, SPF, 1x4 x 8 ft', 'SPF let-in diagonal bracing 1x4 by 8 foot for wall lateral bracing in conventional framing.', 4],
    ['Rim board, LVL, 1-1/8 x 11-7/8 x 16 ft', 'LVL rim board for I-joist floor system perimeter closure and load transfer.', 28],
  ];
  for (const [name, desc, cost] of blocking) {
    items.push(mat({ id: `material-lumber-framing-${slug(name)}`, category: 'Lumber / Framing', subcategory: 'Dimensional Lumber', csiDivision: '06', csiSection: '06 10 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['lumber', 'framing', 'blocking'] }));
  }

  // Additional plywood/OSB
  const panels = [
    ['CDX plywood, 1/2 in, 4x8', 'Plywood', 28],
    ['CDX plywood, 5/8 in, 4x8', 'Plywood', 32],
    ['OSB, 7/16 in, 4x8', 'OSB', 18],
    ['OSB, 19/32 in, 4x8 T&G', 'OSB', 24],
    ['Advantech, 3/4 in, 4x8 T&G', 'Subfloor', 42],
    ['Zip System, 7/16 in, 4x8', 'Sheathing', 35],
  ];
  for (const [name, sub, cost] of panels) {
    items.push(mat({
      id: `material-lumber-framing-panel-${slug(name)}`,
      category: 'Lumber / Framing', subcategory: sub, csiDivision: '06', csiSection: '06 16 00',
      name: `Structural panel, ${name}`,
      description: `Structural ${sub.toLowerCase()} panel, ${name}, for wall sheathing, roof decking, and floor subfloor applications.`,
      unit: 'SQ', commonUnits: ['SQ', 'SF', 'EA'], defaultUnitCost: cost,
      tags: ['sheathing', sub.toLowerCase(), 'panel'],
    }));
  }

  // Additional connectors
  const conn = [
    ['Hurricane tie, H1, single wrap', 1.25],
    ['Post cap, CCQ, 4x4 to 4x4', 8],
    ['Hold-down, HDU5, heavy', 18],
    ['Joist hanger, LUS28, 2x8', 3.50],
    ['Strap tie, MST60, 60 inch', 4.50],
    ['Corner brace, 18-gauge, 4x4 inch', 2],
  ];
  for (const [name, cost] of conn) {
    items.push(mat({
      id: `material-lumber-framing-connector-${slug(name)}`,
      category: 'Lumber / Framing', subcategory: 'Framing Connectors', csiDivision: '06', csiSection: '06 05 00',
      name: `Framing connector, ${name}`,
      description: `Structural framing connector, ${name}, for wood-to-wood and wood-to-concrete connections in residential and commercial framing.`,
      unit: 'EA', commonUnits: ['EA', 'BOX'], defaultUnitCost: cost,
      tags: ['connector', 'simpson', 'framing'],
    }));
  }

  // Additional fasteners
  const fast = [
    ['Joist hanger nails, 1-1/2 in, 1 lb box', 6],
    ['Structural screws, 4 in, 50 ct box', 22],
    ['Deck screws, 3 in, stainless, 1 lb', 18],
    ['Finish nails, 15-gauge, 2 in, 1000 ct', 12],
    ['Staples, 1/2 in crown, 16-gauge, box', 8],
  ];
  for (const [name, cost] of fast) {
    items.push(mat({
      id: `material-lumber-framing-fastener-${slug(name)}`,
      category: 'Lumber / Framing', subcategory: 'Fasteners', csiDivision: '06', csiSection: '06 05 00',
      name: `Fastener, ${name}`,
      description: `Construction fastener, ${name}, for framing, sheathing, and finish carpentry applications.`,
      unit: 'BOX', commonUnits: ['BOX', 'EA'], defaultUnitCost: cost,
      tags: ['fastener', 'nails', 'screws'],
    }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// A3 — mep (+94)
// ---------------------------------------------------------------------------
function mepItems() {
  const items = [];
  const dwvSizes = ['1-1/2', '2', '3', '4', '6'];
  const dwvFittings = ['90° elbow', '45° elbow', 'tee', 'coupling', 'cleanout tee', 'wye', 'reducer'];
  for (const size of dwvSizes) {
    for (const fit of dwvFittings) {
      items.push(mat({
        id: `material-mep-pvc-dwv-${slug(fit)}-${slug(size)}in`,
        category: 'Plumbing', subcategory: 'Plumbing', csiDivision: '22', csiSection: '22 11 00',
        name: `PVC DWV fitting, ${fit}, Schedule 40, ${size} inch`,
        description: `PVC drain-waste-vent fitting, ${fit}, Schedule 40, ${size} inch, for sanitary drainage and vent piping systems.`,
        unit: 'EA', commonUnits: ['EA', 'BOX'], defaultUnitCost: 2 + dwvSizes.indexOf(size) * 1.5,
        tags: ['plumbing', 'pvc', 'dwv', fit.toLowerCase()],
      }));
    }
  }

  const copperSizes = ['1/2', '3/4', '1', '1-1/2'];
  const copperFits = ['90° elbow', 'tee', 'coupling', 'cap'];
  for (const size of copperSizes) {
    for (const fit of copperFits) {
      items.push(mat({
        id: `material-mep-copper-${slug(fit)}-${slug(size)}in`,
        category: 'Plumbing', subcategory: 'Plumbing', csiDivision: '22', csiSection: '22 11 00',
        name: `Copper fitting, ${fit}, sweat, ${size} inch`,
        description: `Copper water supply fitting, ${fit}, sweat connection, ${size} inch, for hot and cold water distribution piping.`,
        unit: 'EA', commonUnits: ['EA', 'BOX'], defaultUnitCost: 3 + copperSizes.indexOf(size) * 2,
        tags: ['plumbing', 'copper', 'fitting'],
      }));
    }
  }

  const gasPipe = [
    ['Black steel pipe, Schedule 40, 3/4 in, 10 ft', 'Black steel gas pipe for natural gas and propane distribution in commercial and residential buildings.', 18],
    ['CSST gas tubing, 1/2 in, 25 ft coil', 'Corrugated stainless steel gas tubing for flexible gas appliance connections and distribution.', 45],
    ['Gas shutoff valve, ball, 3/4 in', 'Full-port gas ball shutoff valve for appliance and branch line isolation in gas piping systems.', 22],
    ['Gas flex connector, 3/4 in x 24 in', 'Flexible gas appliance connector for ranges, dryers, and gas-fired equipment connections.', 28],
  ];
  for (const [name, desc, cost] of gasPipe) {
    items.push(mat({ id: `material-mep-${slug(name)}`, category: 'Plumbing', subcategory: 'Plumbing', csiDivision: '22', csiSection: '22 11 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['plumbing', 'gas', 'pipe'] }));
  }

  const emtFits = [
    ['EMT connector, set-screw, 1/2 in', 0.45],
    ['EMT connector, compression, 3/4 in', 0.85],
    ['EMT coupling, set-screw, 1/2 in', 0.35],
    ['EMT coupling, compression, 1 in', 1.25],
    ['EMT LB conduit body, 1/2 in', 8],
    ['EMT LL conduit body, 3/4 in', 12],
    ['EMT LR conduit body, 1 in', 15],
    ['EMT 90° elbow, 1/2 in', 1.50],
    ['EMT 90° elbow, 3/4 in', 2.25],
  ];
  for (const [name, cost] of emtFits) {
    items.push(mat({
      id: `material-mep-electrical-${slug(name)}`,
      category: 'Electrical', subcategory: 'Electrical', csiDivision: '26', csiSection: '26 05 33',
      name, description: `${name} for electrical metallic tubing conduit systems in branch circuit and feeder wiring.`,
      unit: 'EA', commonUnits: ['EA', 'BOX'], defaultUnitCost: cost,
      tags: ['electrical', 'conduit', 'emt'],
    }));
  }

  const devices = [
    ['GFCI receptacle, 20A, tamper resistant, white', 'Ground-fault circuit interrupter receptacle for wet location and code-required GFCI protection.', 16],
    ['AFCI breaker, 15A, single pole', 'Arc-fault circuit interrupter breaker for bedroom and living area branch circuit protection.', 42],
    ['Disconnect switch, 60A, non-fused, NEMA 3R', 'Non-fused safety disconnect switch for HVAC equipment and motor load isolation.', 85],
    ['Junction box, 4x4x2-1/8, weatherproof', 'Weatherproof junction box for exterior electrical splice and device mounting.', 12],
    ['MC cable connector, 1/2 in', 'Metal-clad cable connector for armored cable termination in boxes and panels.', 1.25],
    ['Surge protector, whole-house, 200A panel', 'Whole-house surge protection device for main electrical panel lightning and surge protection.', 125],
  ];
  for (const [name, desc, cost] of devices) {
    items.push(mat({ id: `material-mep-${slug(name)}`, category: 'Electrical', subcategory: 'Electrical', csiDivision: '26', csiSection: '26 27 00', name, description: desc, unit: 'EA', commonUnits: ['EA'], defaultUnitCost: cost, tags: ['electrical', 'device', 'wiring'] }));
  }

  const duct = [
    ['Rectangular duct, galvanized, 24 ga, 12x8 in, per LF', 'Galvanized rectangular ductwork for supply and return air distribution in HVAC systems.', 12],
    ['Rectangular duct, galvanized, 24 ga, 16x10 in, per LF', 'Galvanized rectangular trunk duct for main supply air distribution runs.', 18],
    ['Spiral round duct, galvanized, 8 in diameter, per LF', 'Spiral round galvanized duct for branch duct connections and exposed ductwork.', 8],
    ['Spiral round duct, galvanized, 12 in diameter, per LF', 'Spiral round galvanized duct for main trunk and large branch duct runs.', 14],
    ['Duct elbow, rectangular, 12x8 in, 90°', 'Rectangular duct elbow for changing direction in rectangular ductwork systems.', 22],
    ['Volume damper, manual, 12x8 in', 'Manual volume damper for balancing airflow in rectangular duct branch runs.', 35],
  ];
  for (const [name, desc, cost] of duct) {
    items.push(mat({ id: `material-mep-hvac-${slug(name)}`, category: 'HVAC', subcategory: 'HVAC', csiDivision: '23', csiSection: '23 31 00', name, description: desc, unit: 'LF', commonUnits: ['LF', 'EA'], defaultUnitCost: cost, tags: ['hvac', 'duct', 'air'] }));
  }

  const insul = [
    ['Pipe insulation, fiberglass, 3/4 in ID, 1 in wall', 'Fiberglass pipe insulation for hot and cold water piping thermal and condensation control.', 3],
    ['Pipe insulation, rubber, 1 in ID, 3/4 in wall', 'Closed-cell rubber pipe insulation for refrigeration and chilled water piping systems.', 4],
    ['Duct insulation, fiberglass wrap, R-6, 48 in wide', 'Fiberglass duct wrap insulation for exterior ductwork thermal and condensation control.', 1.25],
    ['Duct liner, fiberglass, 1 in, 58 in wide', 'Fiberglass duct liner for internal acoustic and thermal treatment of sheet metal duct.', 2.50],
  ];
  for (const [name, desc, cost] of insul) {
    items.push(mat({ id: `material-mep-insulation-${slug(name)}`, category: 'HVAC', subcategory: 'HVAC', csiDivision: '23', csiSection: '23 07 00', name, description: desc, unit: name.includes('wide') ? 'SF' : 'LF', commonUnits: ['LF', 'SF', 'ROLL'], defaultUnitCost: cost, tags: ['hvac', 'insulation', 'pipe'] }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// A4 — roofing-exterior (+56)
// ---------------------------------------------------------------------------
function roofingExteriorItems() {
  const items = [];
  const metalRoof = [
    ['Standing-seam metal panel, 24 ga, 16 in coverage, per SF', 'Standing-seam metal roof panel for commercial and residential steep-slope metal roofing systems.', 4.50],
    ['Corrugated metal panel, 29 ga, 2-1/2 in profile, per SF', 'Corrugated metal roof and wall panel for agricultural, utility, and light commercial applications.', 2.25],
    ['Metal roof ridge cap, standing-seam, 10 ft', 'Standing-seam metal ridge cap for weathertight closure at the roof ridge line.', 18],
    ['Metal roof eave trim, 10 ft', 'Metal eave drip trim for roof edge water management on metal roofing systems.', 12],
  ];
  for (const [name, desc, cost] of metalRoof) {
    items.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: 'Roofing', subcategory: 'Metal Roofing', csiDivision: '07', csiSection: '07 41 00', name, description: desc, unit: name.includes('SF') ? 'SF' : 'LF', commonUnits: ['SF', 'LF', 'EA'], defaultUnitCost: cost, tags: ['roofing', 'metal', 'panel'] }));
  }

  const membrane = [
    ['TPO membrane, 60 mil, white, per SF', 'Thermoplastic polyolefin single-ply roof membrane for low-slope commercial roofing systems.', 1.85],
    ['EPDM membrane, 60 mil, black, per SF', 'Ethylene propylene diene monomer single-ply roof membrane for low-slope roofing.', 1.65],
    ['TPO seam tape, 6 in x 100 ft roll', 'TPO membrane seam tape for heat-welded lap seam reinforcement in TPO roofing.', 45],
    ['Roof insulation, polyiso, 2 in, 4x8', 'Polyisocyanurate rigid roof insulation board for tapered and flat low-slope roof assemblies.', 28],
    ['Roof insulation, polyiso, 3 in, 4x8', 'Polyisocyanurate rigid roof insulation board for enhanced R-value in low-slope roofs.', 38],
  ];
  for (const [name, desc, cost] of membrane) {
    items.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: 'Roofing', subcategory: 'Membrane Roofing', csiDivision: '07', csiSection: '07 52 00', name, description: desc, unit: name.includes('SF') ? 'SF' : name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['SF', 'EA', 'ROLL'], defaultUnitCost: cost, tags: ['roofing', 'membrane', 'insulation'] }));
  }

  const stucco = [
    ['Stucco base coat, cement, 80 lb bag', 'Portland cement stucco scratch and brown base coat for three-coat stucco wall systems.', 12],
    ['Stucco finish coat, acrylic, 5 gal pail', 'Acrylic stucco finish coat for color and texture on exterior cement stucco assemblies.', 45],
    ['Stucco lath, galvanized, 2.5 lb, 27 in x 96 in', 'Galvanized stucco lath sheet for scratch coat keying in three-coat stucco systems.', 8],
    ['Stucco control joint, PVC, 10 ft', 'PVC stucco control joint for crack control in stucco wall panel assemblies.', 6],
  ];
  for (const [name, desc, cost] of stucco) {
    items.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: 'Exterior Cladding', subcategory: 'Stucco', csiDivision: '07', csiSection: '07 24 00', name, description: desc, unit: name.includes('bag') ? 'BAG' : name.includes('gal') ? 'EA' : 'EA', commonUnits: ['EA', 'BAG', 'LF'], defaultUnitCost: cost, tags: ['stucco', 'exterior', 'cladding'] }));
  }

  const trim = [
    ['Corner board, PVC, 3-1/2 in, 12 ft', 'PVC exterior corner board trim for siding corner detail and water management.', 14],
    ['Belly band trim, PVC, 5-1/2 in, 12 ft', 'PVC belly band trim for horizontal siding transitions and architectural detail.', 16],
    ['Rake board, PVC, 1x8, 12 ft', 'PVC rake board trim for roof gable edge detail and fascia transition.', 12],
    ['Frieze board, PVC, 1x6, 12 ft', 'PVC frieze board trim at the wall-to-soffit transition on exterior walls.', 10],
  ];
  for (const [name, desc, cost] of trim) {
    items.push(mat({ id: `material-roofing-exterior-trim-${slug(name)}`, category: 'Exterior Cladding', subcategory: 'Siding and Trim', csiDivision: '07', csiSection: '07 46 00', name, description: desc, unit: 'LF', commonUnits: ['LF', 'EA'], defaultUnitCost: cost, tags: ['exterior', 'trim', 'siding'] }));
  }

  const stone = [
    ['Thin stone veneer, natural, flat, per SF', 'Natural thin stone veneer flats for adhered exterior stone veneer wall cladding.', 8],
    ['Thin stone veneer, natural, corner, per LF', 'Natural thin stone veneer corner pieces for exterior stone veneer corner detail.', 18],
    ['Stone veneer mortar, polymer-modified, 50 lb', 'Polymer-modified mortar for setting thin stone veneer on exterior wall assemblies.', 15],
    ['Stone lintel, precast concrete, 4 ft', 'Precast concrete stone-look lintel for masonry and stone veneer opening support.', 45],
  ];
  for (const [name, desc, cost] of stone) {
    items.push(mat({ id: `material-roofing-exterior-stone-${slug(name)}`, category: 'Exterior Cladding', subcategory: 'Stone Veneer', csiDivision: '07', csiSection: '07 44 00', name, description: desc, unit: name.includes('SF') ? 'SF' : name.includes('LF') ? 'LF' : 'EA', commonUnits: ['SF', 'LF', 'BAG'], defaultUnitCost: cost, tags: ['stone', 'veneer', 'exterior'] }));
  }

  const caulk = [
    ['Exterior sealant, silicone, clear, 10 oz tube', 'Silicone exterior sealant for window, door, and siding perimeter joint sealing.', 8],
    ['Exterior sealant, polyurethane, gray, 10 oz tube', 'Polyurethane exterior sealant for masonry, concrete, and metal joint sealing.', 9],
    ['Backer rod, closed cell, 3/4 in, 100 ft roll', 'Closed-cell backer rod for joint backing before exterior sealant application.', 12],
    ['Backer rod, closed cell, 1 in, 100 ft roll', 'Closed-cell backer rod for larger joint backing in exterior sealant applications.', 15],
  ];
  for (const [name, desc, cost] of caulk) {
    items.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: 'Waterproofing', subcategory: 'Below-Grade and Joint Sealants', csiDivision: '07', csiSection: '07 92 00', name, description: desc, unit: name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['EA', 'ROLL'], defaultUnitCost: cost, tags: ['sealant', 'caulk', 'exterior'] }));
  }

  // Window/door additions
  const openings = [
    ['Window, vinyl, double-hung, 3x5 ft', 'Vinyl double-hung window for residential exterior wall window openings.', 285],
    ['Window, vinyl, casement, 2x3 ft', 'Vinyl casement window for kitchen, bath, and utility room applications.', 195],
    ['Exterior door, steel, 3-0 x 6-8, insulated', 'Insulated steel exterior entry door for residential front and rear entry applications.', 325],
    ['Sliding patio door, vinyl, 6 ft', 'Vinyl sliding patio door for rear exit to deck and patio areas.', 485],
  ];
  for (const [name, desc, cost] of openings) {
    items.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: 'Doors / Windows / Openings', subcategory: name.includes('Window') ? 'Windows' : 'Doors', csiDivision: '08', csiSection: '08 50 00', name, description: desc, unit: 'EA', commonUnits: ['EA'], defaultUnitCost: cost, tags: ['window', 'door', 'opening'] }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// A5 — drywall-finishes (+73)
// ---------------------------------------------------------------------------
function drywallFinishesItems() {
  const items = [];
  const cementBoard = [
    ['Cement board, 1/2 in, 3x5 ft', 'Cement backer board for tile underlayment in wet areas, showers, and tub surrounds.', 12],
    ['Cement board, 5/8 in, 4x8 ft', 'Heavy cement backer board for floor tile underlayment and exterior tile applications.', 18],
    ['Cement board screw, 1-1/4 in, 100 ct box', 'Corrosion-resistant cement board screws for attaching backer board to framing.', 8],
  ];
  for (const [name, desc, cost] of cementBoard) {
    items.push(mat({ id: `material-drywall-finishes-${slug(name)}`, category: 'Drywall / Gypsum', subcategory: 'Gypsum Board', csiDivision: '09', csiSection: '09 29 00', name, description: desc, unit: name.includes('box') ? 'BOX' : 'EA', commonUnits: ['EA', 'BOX', 'SF'], defaultUnitCost: cost, tags: ['cement board', 'tile', 'backer'] }));
  }

  const beads = [
    ['Casing bead, vinyl, 1/2 in, 8 ft', 'Vinyl casing bead for gypsum board termination at dissimilar material joints.', 2],
    ['J-bead, vinyl, 1/2 in, 8 ft', 'Vinyl J-bead trim for gypsum board edge termination at openings and soffits.', 2],
    ['L-bead, vinyl, 1/2 in, 8 ft', 'Vinyl L-bead trim for gypsum board edge finishing at ceiling and wall transitions.', 2],
    ['Arch bead, vinyl, flexible, 8 ft', 'Flexible vinyl arch bead for curved gypsum board corner and arch finishing.', 4],
  ];
  for (const [name, desc, cost] of beads) {
    items.push(mat({ id: `material-drywall-finishes-${slug(name)}`, category: 'Drywall / Finishes', subcategory: 'Finishing', csiDivision: '09', csiSection: '09 29 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['drywall', 'bead', 'trim'] }));
  }

  const dwScrews = ['1-1/4 in', '1-5/8 in', '2 in', '2-1/2 in', '3 in'];
  for (const len of dwScrews) {
    items.push(mat({
      id: `material-drywall-finishes-screw-${slug(len)}`,
      category: 'Drywall / Finishes', subcategory: 'Finishing', csiDivision: '09', csiSection: '09 29 00',
      name: `Drywall screw, fine thread, ${len}, 1 lb box`,
      description: `Fine-thread drywall screw, ${len}, for attaching gypsum board to wood and metal framing members.`,
      unit: 'BOX', commonUnits: ['BOX', 'EA'], defaultUnitCost: 6 + dwScrews.indexOf(len) * 1.5,
      tags: ['drywall', 'screw', 'fastener'],
    }));
  }

  const ceiling = [
    ['Acoustic ceiling tile, 2x2 ft, white, box of 12', 'Mineral fiber acoustic ceiling tile for suspended ceiling grid systems in commercial spaces.', 45],
    ['Acoustic ceiling tile, 2x4 ft, white, box of 8', 'Mineral fiber acoustic ceiling tile for 2x4 suspended ceiling grid applications.', 38],
    ['Ceiling grid, main tee, 12 ft', 'Suspended ceiling main tee grid member for acoustic tile ceiling systems.', 8],
    ['Ceiling grid, cross tee, 4 ft', 'Suspended ceiling cross tee grid member for 2x4 and 2x2 tile layouts.', 3],
    ['Ceiling grid, wall angle, 12 ft', 'Suspended ceiling wall angle for perimeter support of acoustic tile ceiling systems.', 4],
    ['Ceiling hanger wire, 12 ga, 100 ft roll', 'Galvanized hanger wire for suspending acoustic ceiling grid from structure above.', 18],
  ];
  for (const [name, desc, cost] of ceiling) {
    items.push(mat({ id: `material-drywall-finishes-${slug(name)}`, category: 'Drywall / Finishes', subcategory: 'Acoustic Ceiling', csiDivision: '09', csiSection: '09 51 00', name, description: desc, unit: name.includes('box') ? 'BOX' : name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['EA', 'BOX', 'LF', 'ROLL'], defaultUnitCost: cost, tags: ['ceiling', 'acoustic', 'tile'] }));
  }

  const flooring = [
    ['Hardwood flooring, oak, 3/4 in x 2-1/4 in, per SF', 'Solid oak hardwood flooring for nail-down installation in living areas and bedrooms.', 5.50],
    ['Engineered hardwood, oak, 3/8 in, per SF', 'Engineered oak hardwood flooring for glue-down or float installation over concrete.', 4.25],
    ['Sheet vinyl, 12 ft wide, per SF', 'Sheet vinyl flooring for bathroom, kitchen, and utility room floor finishes.', 2.50],
    ['LVP flooring, 5 mil wear layer, 22 SF box', 'Luxury vinyl plank flooring with 5 mil wear layer for residential floor finishes.', 3.25],
    ['Wall base, rubber, 4 in, per LF', 'Rubber cove wall base for commercial and residential floor-to-wall transition.', 1.85],
    ['Wall base, vinyl, 4 in, per LF', 'Vinyl wall base for residential and light commercial floor perimeter finish.', 1.25],
  ];
  for (const [name, desc, cost] of flooring) {
    items.push(mat({ id: `material-drywall-finishes-floor-${slug(name)}`, category: 'Flooring', subcategory: name.includes('base') ? 'Wall Base' : name.includes('Hardwood') || name.includes('Engineered') ? 'Hardwood' : 'Resilient Flooring', csiDivision: '09', csiSection: '09 64 00', name, description: desc, unit: name.includes('SF') || name.includes('LF') ? (name.includes('LF') ? 'LF' : 'SF') : 'BOX', commonUnits: ['SF', 'LF', 'BOX'], defaultUnitCost: cost, tags: ['flooring', 'finish', 'floor'] }));
  }

  const paint = [
    ['Epoxy floor coating, 2-part, 3 gal kit', 'Two-part epoxy floor coating for garage, warehouse, and industrial floor protection.', 125],
    ['Anti-slip floor additive, 1 lb bag', 'Anti-slip additive for floor coatings and paint to improve traction on walking surfaces.', 8],
    ['Drywall primer, PVA, 5 gal pail', 'PVA drywall primer for new gypsum board before topcoat paint application.', 28],
    ['Ceiling paint, flat white, 5 gal pail', 'Flat white ceiling paint for interior gypsum board and acoustic ceiling surfaces.', 32],
  ];
  for (const [name, desc, cost] of paint) {
    items.push(mat({ id: `material-drywall-finishes-paint-${slug(name)}`, category: 'Finishes', subcategory: 'Paint', csiDivision: '09', csiSection: '09 91 00', name, description: desc, unit: name.includes('bag') ? 'BAG' : 'EA', commonUnits: ['EA', 'GAL'], defaultUnitCost: cost, tags: ['paint', 'coating', 'finish'] }));
  }

  const tile = [
    ['Ceramic wall tile, 3x6 subway, white, box', 'Ceramic subway wall tile for bathroom and kitchen backsplash and wall tile applications.', 4.50],
    ['Porcelain floor tile, 12x24, gray, box', 'Large-format porcelain floor tile for bathroom, kitchen, and entryway floor finishes.', 5.25],
    ['Tile grout, sanded, 25 lb bag', 'Sanded tile grout for floor and wall tile joints 1/8 inch and wider.', 12],
    ['Tile thinset, modified, 50 lb bag', 'Polymer-modified thinset mortar for setting ceramic and porcelain floor and wall tile.', 15],
    ['Tile trim, bullnose, 3x12, box', 'Ceramic bullnose trim tile for exposed tile edge finishing at wainscot and openings.', 3.50],
  ];
  for (const [name, desc, cost] of tile) {
    items.push(mat({ id: `material-drywall-finishes-tile-${slug(name)}`, category: 'Finishes', subcategory: 'Tile', csiDivision: '09', csiSection: '09 30 00', name, description: desc, unit: name.includes('bag') ? 'BAG' : 'BOX', commonUnits: ['BOX', 'BAG', 'SF'], defaultUnitCost: cost, tags: ['tile', 'grout', 'finish'] }));
  }

  const insulation = [
    ['Spray foam, open cell, 12 in depth, per SF', 'Open-cell spray polyurethane foam insulation for attic and wall cavity air sealing and insulation.', 1.85],
    ['Rigid insulation, EPS, 1 in, 4x8', 'Expanded polystyrene rigid insulation board for exterior wall and foundation insulation.', 12],
    ['Rigid insulation, EPS, 2 in, 4x8', 'Expanded polystyrene rigid insulation board for enhanced exterior continuous insulation.', 22],
    ['Sound batt, mineral wool, 3-1/2 in, 15 in wide', 'Mineral wool sound insulation batt for interior partition acoustic performance.', 1.25],
  ];
  for (const [name, desc, cost] of insulation) {
    items.push(mat({ id: `material-drywall-finishes-insul-${slug(name)}`, category: 'Insulation', subcategory: 'Thermal and Acoustic Insulation', csiDivision: '07', csiSection: '07 21 00', name, description: desc, unit: name.includes('SF') ? 'SF' : 'EA', commonUnits: ['SF', 'EA'], defaultUnitCost: cost, tags: ['insulation', 'thermal', 'acoustic'] }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// A6 — sitework (+82)
// ---------------------------------------------------------------------------
function siteworkItems() {
  const items = [];
  const utilPipe = [
    ['PVC water main, C900, 6 in, 20 ft', 'PVC C900 water main pipe for municipal and private potable water distribution systems.', 85],
    ['PVC water main, C900, 8 in, 20 ft', 'PVC C900 water main pipe for larger capacity potable water distribution mains.', 125],
    ['Ductile iron pipe, 6 in, 18 ft', 'Ductile iron pipe for buried water main and force main applications.', 165],
    ['HDPE force main, DR11, 4 in, 40 ft', 'HDPE force main pipe for sewer pump discharge and pressure piping applications.', 45],
    ['PVC sewer main, SDR-35, 8 in, 14 ft', 'PVC SDR-35 sewer main pipe for gravity sanitary sewer collection systems.', 55],
  ];
  for (const [name, desc, cost] of utilPipe) {
    items.push(mat({ id: `material-sitework-pipe-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: 'Utility Pipe', csiDivision: '33', csiSection: '33 30 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['utility', 'pipe', 'water', 'sewer'] }));
  }

  const utilFits = [
    ['PVC elbow, 45°, C900, 6 in', 35],
    ['PVC tee, C900, 6 in', 48],
    ['PVC reducer, 8x6 in, C900', 42],
    ['Ductile iron coupling, 6 in', 55],
    ['HDPE fusion coupling, 4 in', 18],
    ['PVC cleanout, SDR-35, 4 in', 22],
  ];
  for (const [name, cost] of utilFits) {
    items.push(mat({
      id: `material-sitework-fitting-${slug(name)}`,
      category: 'Sitework / Earthwork', subcategory: 'Utility Pipe', csiDivision: '33', csiSection: '33 30 00',
      name, description: `${name} for buried utility piping systems including water, sewer, and force main connections.`,
      unit: 'EA', commonUnits: ['EA'], defaultUnitCost: cost,
      tags: ['utility', 'fitting', 'pipe'],
    }));
  }

  const manholes = [
    ['Manhole frame and cover, cast iron, 24 in', 'Cast iron manhole frame and cover for sanitary sewer and storm drain access points.', 285],
    ['Manhole cone, precast, 4 ft rise', 'Precast concrete manhole cone section for grade adjustment at manhole access points.', 165],
    ['Manhole barrel, precast, 4 ft x 4 ft', 'Precast concrete manhole barrel section for sanitary sewer and storm drain manholes.', 425],
  ];
  for (const [name, desc, cost] of manholes) {
    items.push(mat({ id: `material-sitework-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: 'Drainage Materials', csiDivision: '33', csiSection: '33 40 00', name, description: desc, unit: 'EA', commonUnits: ['EA'], defaultUnitCost: cost, tags: ['manhole', 'drainage', 'utility'] }));
  }

  const paving = [
    ['Asphalt, base course, per ton', 'Hot-mix asphalt base course for road, parking, and driveway sub-base paving.', 45],
    ['Asphalt, surface course, per ton', 'Hot-mix asphalt surface course for final wearing surface on roads and parking areas.', 55],
    ['Concrete paving, 4 in unreinforced, per SF', 'Unreinforced concrete paving for sidewalks, drives, and light-duty flatwork.', 4.50],
    ['Concrete paving, 6 in unreinforced, per SF', 'Unreinforced concrete paving for heavy-duty sidewalks, drives, and parking areas.', 6.25],
    ['Curb and gutter, cast-in-place, per LF', 'Cast-in-place concrete curb and gutter for street, parking, and site paving edge restraint.', 18],
  ];
  for (const [name, desc, cost] of paving) {
    items.push(mat({ id: `material-sitework-paving-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: 'Paving', csiDivision: '32', csiSection: '32 12 00', name, description: desc, unit: name.includes('ton') ? 'TON' : name.includes('LF') ? 'LF' : 'SF', commonUnits: ['SF', 'TON', 'LF'], defaultUnitCost: cost, tags: ['paving', 'asphalt', 'concrete'] }));
  }

  const erosion = [
    ['Erosion control blanket, straw, 8 ft x 112.5 ft', 'Straw erosion control blanket for slope protection during seeding and site stabilization.', 45],
    ['Hydroseeding mulch, wood fiber, per SF', 'Wood fiber hydroseeding mulch for slope stabilization and lawn establishment.', 0.15],
    ['Silt fence stakes, hardwood, 24 in', 'Hardwood silt fence stakes for installing perimeter sediment control fencing.', 1.25],
    ['Inlet protection, silt sack, standard', 'Silt sack inlet protection for storm drain inlet sediment control during construction.', 35],
  ];
  for (const [name, desc, cost] of erosion) {
    items.push(mat({ id: `material-sitework-erosion-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: 'Aggregates and Erosion Control', csiDivision: '31', csiSection: '31 25 00', name, description: desc, unit: name.includes('SF') ? 'SF' : 'EA', commonUnits: ['EA', 'SF', 'ROLL'], defaultUnitCost: cost, tags: ['erosion', 'sediment', 'sitework'] }));
  }

  const retaining = [
    ['Retaining wall block, concrete, 6 in H x 18 in L', 'Interlocking concrete retaining wall block for segmental retaining wall systems.', 4.50],
    ['Retaining wall block, concrete, 8 in H x 18 in L', 'Interlocking concrete retaining wall block for taller segmental retaining wall courses.', 5.25],
    ['Retaining wall geogrid, 4 ft x 50 ft roll', 'Geogrid reinforcement for segmental retaining wall soil reinforcement and stability.', 85],
    ['Rip-rap stone, 6-12 in, per ton', 'Rip-rap erosion control stone for slope protection, outlet protection, and channel lining.', 35],
    ['Erosion stone, 2-4 in, per ton', 'Clean erosion control stone for drainage layer and slope stabilization applications.', 28],
  ];
  for (const [name, desc, cost] of retaining) {
    items.push(mat({ id: `material-sitework-${slug(name)}`, category: 'Landscaping', subcategory: 'Softscape and Hardscape', csiDivision: '32', csiSection: '32 32 00', name, description: desc, unit: name.includes('ton') ? 'TON' : name.includes('roll') ? 'ROLL' : 'EA', commonUnits: ['EA', 'TON', 'ROLL'], defaultUnitCost: cost, tags: ['retaining', 'stone', 'landscape'] }));
  }

  const seed = [
    ['Grass seed, tall fescue blend, 50 lb bag', 'Tall fescue grass seed blend for lawn establishment and site restoration seeding.', 85],
    ['Wildflower seed mix, native, 5 lb bag', 'Native wildflower seed mix for landscape beds and ecological restoration areas.', 45],
    ['Fertilizer, starter, 50 lb bag', 'Starter fertilizer for new lawn seeding and sod installation root establishment.', 22],
    ['Lawn edging, aluminum, 4 in x 16 ft', 'Aluminum lawn edging for separating lawn from beds, walks, and paved areas.', 12],
    ['Tree spade, root ball wrap, burlap, 48 in', 'Burlap root ball wrap for tree transplanting and nursery stock handling.', 8],
  ];
  for (const [name, desc, cost] of seed) {
    items.push(mat({ id: `material-sitework-landscape-${slug(name)}`, category: 'Landscaping', subcategory: 'Softscape and Hardscape', csiDivision: '32', csiSection: '32 90 00', name, description: desc, unit: name.includes('bag') ? 'BAG' : 'EA', commonUnits: ['BAG', 'EA', 'LF'], defaultUnitCost: cost, tags: ['landscape', 'seed', 'sod'] }));
  }

  const aggregate = [
    ['Crushed stone, #2, per ton', 'Large crushed stone aggregate for subbase, drainage, and heavy-duty base course applications.', 28],
    ['Pea gravel, per ton', 'Pea gravel for drainage fill, pipe bedding, and decorative landscape applications.', 32],
    ['Recycled concrete aggregate, per ton', 'Recycled concrete aggregate for subbase, fill, and road base applications.', 18],
    ['Sand, mason, per ton', 'Mason sand for mortar mixing, paver bedding, and fine grading applications.', 22],
  ];
  for (const [name, desc, cost] of aggregate) {
    items.push(mat({ id: `material-sitework-aggregate-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: 'Aggregates and Erosion Control', csiDivision: '31', csiSection: '31 20 00', name, description: desc, unit: 'TON', commonUnits: ['TON', 'CY'], defaultUnitCost: cost, tags: ['aggregate', 'earthwork', 'fill'] }));
  }

  return items;
}

// ---------------------------------------------------------------------------
// B1-B6 — equipment
// ---------------------------------------------------------------------------
function earthworkEquipItems() {
  const items = [];
  const list = [
    ['Excavator, tracked, 30-ton class', 'Large hydraulic tracked excavator for mass excavation, site grading, and heavy utility trenching.', 'Excavation', 850],
    ['Excavator, tracked, 50-ton class', 'Extra-large hydraulic excavator for deep excavation, mass grading, and major site development.', 'Excavation', 1200],
    ['Bulldozer, D4 class, crawler', 'Crawler bulldozer for rough grading, backfilling, and site clearing on medium-size projects.', 'Excavation', 650],
    ['Bulldozer, D6 class, crawler', 'Large crawler bulldozer for mass grading, push-loading, and heavy site development work.', 'Excavation', 950],
    ['Motor grader, 14 ft blade', 'Motor grader for fine grading, road subgrade preparation, and surface leveling.', 'Excavation', 750],
    ['Smooth-drum compactor, vibratory, 84 in', 'Vibratory smooth-drum roller for soil and aggregate base compaction on large areas.', 'Compaction', 425],
    ['Trench box, 8 ft x 24 ft, steel', 'Steel trench shield box for OSHA-compliant trench excavation protection during utility work.', 'Excavation', 185],
    ['Trench box, 6 ft x 16 ft, aluminum', 'Aluminum trench box for lighter utility trenching with easier handling and setup.', 'Excavation', 125],
    ['Dewatering pump, 2 in, electric submersible', 'Electric submersible dewatering pump for trench, footing, and excavation water removal.', 'Excavation', 45],
    ['Dewatering pump, 4 in, diesel trash pump', 'Diesel trash pump for high-volume dewatering of excavations and flooded site areas.', 'Excavation', 85],
    ['Rock breaker attachment, 20-ton class', 'Hydraulic rock breaker attachment for excavator demolition and rock excavation.', 'Excavation', 350],
    ['Auger attachment, 18 in diameter', 'Hydraulic auger attachment for excavator post hole and pier drilling in soil conditions.', 'Excavation', 125],
    ['Scraper, 14 cu yd, motorized', 'Motorized earth scraper for cut-and-fill grading on large site development projects.', 'Hauling', 650],
    ['Water truck, 2,000 gal, for dust control', 'Water truck for dust suppression on active construction sites and compaction moisture.', 'Compaction', 275],
    ['Sheepsfoot compactor, padfoot drum', 'Padfoot sheepsfoot roller for cohesive soil compaction in fill and subgrade areas.', 'Compaction', 385],
    ['Plate compactor, reversible, 34 in', 'Reversible plate compactor for trench backfill and confined area soil compaction.', 'Compaction', 65],
    ['Skid steer, tracked, high-flow', 'High-flow compact track loader for grading, loading, and attachment-driven earthwork.', 'Loading', 325],
    ['Wheel loader, 3.5 cu yd bucket', 'Front-end wheel loader for loading trucks, stockpiling, and material handling on site.', 'Loading', 550],
    ['Articulated dump truck, 25 ton', 'Articulated off-road dump truck for hauling excavated material on rough site terrain.', 'Hauling', 750],
    ['Off-road haul truck, 35 ton', 'Rigid-frame off-road haul truck for long-distance material hauling on large sites.', 'Hauling', 950],
    ['Soil stabilizer, reclaimer, 8 ft cut', 'Soil stabilizer/reclaimer for in-place mixing of lime, cement, or asphalt into subgrade.', 'Compaction', 850],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-earthwork-${slug(name)}`, category: 'Earthwork Equipment', subcategory: sub, csiDivision: '31', csiSection: '31 23 00', name, description: desc, defaultUnitCost: cost, tags: ['earthwork', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

function concreteEquipItems() {
  const items = [];
  const list = [
    ['Concrete mixer truck, transit mix, 10 CY', 'Transit-mix concrete delivery truck for ready-mix concrete placement on large pours.', 'Placement', 450],
    ['Laser screed, ride-on, 12 ft head', 'Ride-on laser screed for large slab flatness and elevation control during concrete placement.', 'Finishing', 550],
    ['Concrete grinder, walk-behind, 32 in', 'Walk-behind concrete grinder for slab surface preparation, coating removal, and polishing.', 'Finishing', 225],
    ['Concrete scarifier, walk-behind, 8 in cut', 'Walk-behind concrete scarifier for aggressive surface removal and profile preparation.', 'Cutting', 185],
    ['Floor saw, diesel, 24 in blade', 'Diesel floor saw for cutting control joints and openings in cured concrete slabs.', 'Cutting', 275],
    ['Wall saw, hydraulic, track-mounted', 'Track-mounted hydraulic wall saw for cutting openings in concrete and masonry walls.', 'Cutting', 350],
    ['Concrete coring machine, rig-mounted, wet', 'Rig-mounted wet core drill for round penetrations in concrete walls and slabs.', 'Drilling', 125],
    ['Shotcrete pump, dry-mix, trailer', 'Trailer-mounted dry-mix shotcrete pump for slope stabilization and tunnel lining.', 'Placement', 425],
    ['Shotcrete nozzleman equipment set', 'Shotcrete application equipment set including nozzle, hose, and air compressor interface.', 'Placement', 85],
    ['Curing blanket heater, propane, 100K BTU', 'Propane-fired curing blanket heater for cold-weather concrete curing protection.', 'Finishing', 65],
    ['Power trowel, walk-behind, 48 in', 'Walk-behind power trowel for finishing medium-size concrete slabs after bull floating.', 'Finishing', 95],
    ['Bull float, magnesium, 48 in', 'Magnesium bull float for initial floating of freshly placed concrete slab surfaces.', 'Finishing', 35],
    ['Concrete bucket, crane-suspended, 1 CY', 'Crane-suspended concrete bucket for placing concrete in elevated forms and hard-to-reach areas.', 'Placement', 125],
    ['Rebar tier, cordless, battery-powered', 'Cordless battery-powered rebar tying tool for field reinforcement assembly efficiency.', 'Placement', 45],
    ['Concrete pump hose, 4 in x 20 ft section', 'Heavy-duty concrete pump delivery hose section for line pump and boom pump setups.', 'Placement', 85],
    ['Rubbing stone, carborundum, hand', 'Hand rubbing stone for smoothing and finishing formed concrete surfaces and patch areas.', 'Finishing', 12],
    ['Edge trowel, hand, radius', 'Radius edge trowel for forming rounded edges on concrete sidewalks and curbs.', 'Finishing', 18],
    ['Knee boards, aluminum, pair', 'Aluminum knee boards for kneeling on freshly placed concrete during hand finishing.', 'Finishing', 25],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-concrete-${slug(name)}`, category: 'Concrete Equipment', subcategory: sub, csiDivision: '03', csiSection: '03 30 00', name, description: desc, defaultUnitCost: cost, tags: ['concrete', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

function liftingAccessItems() {
  const items = [];
  const list = [
    ['Truck crane, hydraulic, 35-ton capacity', 'Hydraulic truck-mounted crane for steel, HVAC, and material placement on commercial projects.', 'Aerial and Material Handling', 850],
    ['Personnel hoist, rack-and-pinion, 2,000 lb', 'Rack-and-pinion personnel/material hoist for multi-story building construction access.', 'Aerial and Material Handling', 650],
    ['Swing-stage scaffold, 40 ft platform', 'Powered swing-stage scaffold system for exterior facade work on multi-story buildings.', 'Scaffolding', 425],
    ['Mast climbing work platform, dual mast', 'Dual-mast climbing work platform for exterior masonry, EIFS, and facade installation.', 'Scaffolding', 750],
    ['Spider scaffold, modular frame set', 'Modular spider scaffold frame set for irregular and curved facade access.', 'Scaffolding', 185],
    ['Material hoist, 1,000 lb, 50 ft lift', 'Electric material hoist for lifting brick, block, and materials to elevated floors.', 'Aerial and Material Handling', 125],
    ['Personnel lift, push-around, 20 ft', 'Push-around single-personnel lift for interior maintenance and light elevated work.', 'Aerial Lift', 75],
    ['Boom lift, articulating, 80 ft platform height', 'Large articulating boom lift for high-reach exterior facade and steel erection work.', 'Aerial Lift', 550],
    ['Scissor lift, rough-terrain, 32 ft', 'Rough-terrain scissor lift for outdoor elevated work on uneven ground conditions.', 'Aerial Lift', 275],
    ['Forklift, warehouse, 5,000 lb cushion tire', 'Cushion-tire warehouse forklift for indoor material handling on slab surfaces.', 'Material Handling', 185],
    ['Crane mat, timber, 8 ft x 8 ft x 8 in', 'Timber crane mat for distributing outrigger loads on soft ground during crane setup.', 'Material Handling', 45],
    ['Rigging sling, nylon, 6 ft, 6,000 lb', 'Nylon web sling for rigging and lifting materials with crane and hoist equipment.', 'Material Handling', 25],
    ['Chain hoist, manual, 2-ton', 'Manual chain hoist for precise lifting and positioning of equipment and materials.', 'Material Handling', 35],
    ['Outrigger pad, composite, 24 in x 24 in', 'Composite outrigger pad for crane and aerial lift setup on paved and soft surfaces.', 'Material Handling', 18],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-lifting-access-${slug(name)}`, category: 'Lifting / Access', subcategory: sub, csiDivision: '01', csiSection: '01 54 00', name, description: desc, defaultUnitCost: cost, tags: ['lifting', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

function temporarySiteItems() {
  const items = [];
  const list = [
    ['Portable toilet, standard, monthly rental', 'Standard portable toilet unit for construction site worker sanitation requirements.', 'Waste', 85],
    ['Portable toilet, ADA compliant, monthly rental', 'ADA-compliant portable toilet for accessible worker sanitation on construction sites.', 'Waste', 125],
    ['Dumpster, 10 CY, weekly haul', '10 cubic yard roll-off dumpster for construction debris and waste disposal.', 'Waste', 350],
    ['Dumpster, 20 CY, weekly haul', '20 cubic yard roll-off dumpster for medium-size construction waste disposal.', 'Waste', 425],
    ['Dumpster, 30 CY, weekly haul', '30 cubic yard roll-off dumpster for large construction and demolition waste disposal.', 'Waste', 525],
    ['Temporary fence, chain link, 6 ft x 10 ft panel', 'Chain link temporary fence panel for site perimeter security and OSHA compliance.', 'Storage', 35],
    ['Temporary fence, barricade, water-filled, 6 ft', 'Water-filled plastic barricade for traffic control and site perimeter delineation.', 'Storage', 45],
    ['Water trailer, 500 gal, towable', 'Towable water trailer for dust control, compaction, and temporary site water supply.', 'Power', 65],
    ['Water trailer, 1,000 gal, towable', 'Large towable water trailer for extended dust control and site water needs.', 'Power', 95],
    ['Dust control water truck, 2,500 gal', 'Water truck dedicated to dust suppression on active construction and grading sites.', 'Power', 325],
    ['Security camera, wireless, solar-powered', 'Solar-powered wireless security camera for construction site monitoring and theft deterrence.', 'Power', 45],
    ['Tool trailer, enclosed, 16 ft', 'Enclosed tool trailer for secure storage and transport of jobsite tools and equipment.', 'Storage', 55],
    ['Site office trailer, 8x20 ft, furnished', 'Furnished site office trailer for project management, meetings, and plan storage.', 'Storage', 275],
    ['Storage container, 20 ft, wind and watertight', '20-foot shipping container for secure on-site material and equipment storage.', 'Storage', 85],
    ['Storage container, 40 ft, wind and watertight', '40-foot shipping container for large-capacity on-site material storage.', 'Storage', 125],
    ['Temporary power pole, metered, 200A', 'Temporary metered power pole for construction site electrical service during building.', 'Power and Lighting', 185],
    ['Extension cord, heavy-duty, 100 ft, 12/3', 'Heavy-duty 100-foot extension cord for temporary power distribution on jobsites.', 'Power and Lighting', 35],
    ['Job box, gang box, 48 in, lockable', 'Lockable gang box for secure storage of small tools and consumables on jobsites.', 'Storage', 28],
    ['First aid station, ANSI Class A, cabinet', 'ANSI Class A first aid cabinet for OSHA-compliant construction site medical supplies.', 'Storage', 65],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-temporary-site-${slug(name)}`, category: 'Temporary / Site', subcategory: sub, csiDivision: '01', csiSection: '01 50 00', name, description: desc, defaultUnitCost: cost, tags: ['temporary', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

function carpentryFramingItems() {
  const items = [];
  const list = [
    ['Framing nailer, pneumatic, 21° full round head', 'Pneumatic framing nailer for high-speed wood framing, sheathing, and deck fastening.', 'Fastening', 45],
    ['Roofing nailer, pneumatic, coil', 'Pneumatic coil roofing nailer for asphalt shingle and roofing membrane fastening.', 'Fastening', 55],
    ['Finish nailer, pneumatic, 15-gauge angled', '15-gauge angled finish nailer for trim, casing, and finish carpentry applications.', 'Fastening', 35],
    ['Circular saw, worm drive, 7-1/4 in', 'Worm-drive circular saw for heavy-duty framing and cutting of lumber and sheathing.', 'Sawing', 65],
    ['Miter saw, compound, 12 in sliding', '12-inch sliding compound miter saw for precision crosscuts and miter cuts in trim and framing.', 'Sawing', 55],
    ['Table saw, job-site, 10 in portable', 'Portable 10-inch job-site table saw for ripping lumber, plywood, and trim on site.', 'Sawing', 75],
    ['Reciprocating saw, cordless, 18V', 'Cordless reciprocating saw for demolition, rough cutting, and utility work on jobsites.', 'Sawing', 35],
    ['Planer, portable, 3-1/4 in', 'Portable power planer for edge-planing and dimensioning lumber in finish carpentry.', 'Sawing', 45],
    ['Router, plunge, 2-1/4 HP', 'Plunge router for dado cuts, edge profiles, and finish carpentry detail work.', 'Sawing', 55],
    ['Air compressor, portable, 6 gal, electric', 'Portable electric air compressor for powering pneumatic nailers and tools on jobsites.', 'Fastening', 35],
    ['Laser level, rotary, self-leveling', 'Self-leveling rotary laser level for layout, grading reference, and framing alignment.', 'Sawing', 45],
    ['Impact driver, cordless, 18V', 'Cordless impact driver for structural screw and lag bolt installation in framing.', 'Fastening', 25],
    ['Oscillating multi-tool, cordless', 'Cordless oscillating multi-tool for flush cutting, scraping, and detail work in remodeling.', 'Sawing', 30],
    ['Belt sander, 3x21 in', '3x21 inch belt sander for rapid material removal and surface preparation in finish work.', 'Sawing', 28],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-carpentry-framing-${slug(name)}`, category: 'Carpentry / Tools', subcategory: sub, csiDivision: '01', csiSection: '01 54 00', name, description: desc, defaultUnitCost: cost, tags: ['carpentry', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

function drywallFinishesEquipItems() {
  const items = [];
  const list = [
    ['Texture sprayer, hopper gun, pneumatic', 'Pneumatic hopper gun texture sprayer for orange peel and knockdown ceiling textures.', 'Finishing', 35],
    ['Airless paint sprayer, 595 tip, electric', 'Electric airless paint sprayer for high-volume interior and exterior paint application.', 'Finishing', 55],
    ['Paint sprayer, HVLP, cup gun', 'HVLP cup gun paint sprayer for fine-finish trim, cabinet, and detail painting.', 'Finishing', 25],
    ['Floor buffer, 17 in, dual-speed', 'Dual-speed floor buffer for cleaning, buffing, and maintaining finished floor surfaces.', 'Finishing', 35],
    ['Floor polisher, propane, 27 in', 'Propane-powered floor polisher for large-area concrete and terrazzo floor finishing.', 'Grinding', 125],
    ['Carpet stretcher, power, 12 ft', 'Power carpet stretcher for installing wall-to-wall carpet with proper tension.', 'Handling', 45],
    ['Tile saw, wet, 10 in sliding table', '10-inch wet tile saw with sliding table for cutting ceramic and porcelain floor and wall tile.', 'Finishing', 55],
    ['Tile cutter, manual, 24 in rail', 'Manual rail tile cutter for straight cuts in ceramic wall and floor tile.', 'Finishing', 35],
    ['Knee kicker, carpet installation', 'Carpet knee kicker for stretching and positioning carpet during installation.', 'Handling', 18],
    ['Wall trimmer, carpet, electric', 'Electric carpet wall trimmer for tucking carpet edge at baseboards and transitions.', 'Handling', 25],
    ['Heat gun, 1500W, variable temperature', 'Variable-temperature heat gun for shrink wrap, paint stripping, and membrane welding.', 'Finishing', 15],
    ['Drywall lift, panel, 11 ft telescoping', 'Telescoping drywall panel lift for installing ceiling and high wall gypsum board.', 'Handling', 45],
    ['Drywall sander, pole, vacuum-assist', 'Vacuum-assist pole drywall sander for dust-free finishing of gypsum board joints.', 'Finishing', 35],
    ['Wallpaper steamer, electric, 1 gal', 'Electric wallpaper steamer for removing wallpaper and wall coverings during renovation.', 'Finishing', 22],
  ];
  for (const [name, desc, sub, cost] of list) {
    items.push(eq({ id: `equipment-drywall-finishes-${slug(name)}`, category: 'Drywall / Finish Equipment', subcategory: sub, csiDivision: '01', csiSection: '01 54 00', name, description: desc, defaultUnitCost: cost, tags: ['drywall', sub.toLowerCase(), 'rental'] }));
  }
  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const EXPANSIONS = [
  ['materials/concrete-masonry.json', concreteMasonryItems],
  ['materials/lumber-framing.json', lumberFramingItems],
  ['materials/mep.json', mepItems],
  ['materials/roofing-exterior.json', roofingExteriorItems],
  ['materials/drywall-finishes.json', drywallFinishesItems],
  ['materials/sitework.json', siteworkItems],
  ['equipment/earthwork.json', earthworkEquipItems],
  ['equipment/concrete.json', concreteEquipItems],
  ['equipment/lifting-access.json', liftingAccessItems],
  ['equipment/temporary-site.json', temporarySiteItems],
  ['equipment/carpentry-framing.json', carpentryFramingItems],
  ['equipment/drywall-finishes.json', drywallFinishesEquipItems],
];

console.log('=== Milestone 1 Expansion ===\n');
let totalAdded = 0;
for (const [file, fn] of EXPANSIONS) {
  totalAdded += expandFile(file, fn());
}
console.log(`\nTotal new items added: ${totalAdded}`);

