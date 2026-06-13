/** Supplementary pass to hit Milestone 1 count targets. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = path.join(__dirname, '../src/features/estimating/data/starterCostLibrary/seeds');
const NOTES = 'Starter placeholder only. Verify local supplier pricing before proposal.';
const mat = (p) => ({ costConfidence: 'placeholder', pricingRequired: true, notes: NOTES, defaultUnitCost: p.defaultUnitCost ?? 0, type: 'material', ...p });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

function add(rel, items) {
  const fp = path.join(SEEDS, rel);
  const ex = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const ids = new Set(ex.map((x) => x.id));
  const toAdd = items.filter((x) => !ids.has(x.id));
  fs.writeFileSync(fp, JSON.stringify([...ex, ...toAdd], null, 2));
  console.log(`${rel}: ${ex.length} → ${ex.length + toAdd.length} (+${toAdd.length})`);
}

// concrete-masonry +16
const cm = [];
for (const psi of [3200, 3800, 4200, 4800]) {
  cm.push(mat({
    id: `material-concrete-masonry-rmc-${psi}-psi-6in-slump`,
    category: 'Concrete', subcategory: 'Ready-Mix Concrete', csiDivision: '03', csiSection: '03 30 00',
    name: `Ready-mix concrete, ${psi} PSI, 6-inch slump`,
    description: `Plant-batched ready-mix concrete at ${psi} PSI with 6-inch slump for formed walls, columns, and pumpable placements.`,
    unit: 'CY', commonUnits: ['CY'], defaultUnitCost: 120 + psi * 0.01, tags: ['concrete', 'ready-mix'],
  }));
}
const cmNames = [
  ['Brick, solid, modular, sandblast finish', 'Sandblast finish solid modular brick for exposed masonry veneer and accent band courses.', 'Masonry', 'Brick', '04', '04 21 00', 1.45],
  ['Brick, glazed, modular, white', 'Glazed modular brick for interior feature walls and sanitary masonry applications.', 'Masonry', 'Brick', '04', '04 21 00', 2.85],
  ['Anchor bolt, F1554, 3/4 x 12 in, galvanized', 'Galvanized anchor bolt for structural steel column and equipment base anchoring to concrete.', 'Concrete', 'Accessories', '03', '03 15 00', 8.5],
  ['Anchor bolt, J-type, 1/2 x 10 in, galvanized', 'J-type anchor bolt for embedment in concrete foundations and equipment pad anchoring.', 'Concrete', 'Accessories', '03', '03 15 00', 4.25],
  ['Concrete sealer, penetrating, 5 gal', 'Penetrating concrete sealer for protecting exterior concrete from moisture and salt intrusion.', 'Concrete', 'Accessories', '03', '03 30 00', 55],
  ['Form panel, steel-ply, 2x4 ft', 'Steel-ply form panel for repetitive concrete wall and column forming on commercial projects.', 'Concrete', 'Formwork Accessories', '03', '03 11 00', 45],
  ['Form panel, steel-ply, 2x8 ft', 'Large steel-ply form panel for high-production concrete wall forming systems.', 'Concrete', 'Formwork Accessories', '03', '03 11 00', 85],
  ['Tie rod, form, 3/4 in x 5 ft', 'Form tie rod for through-wall concrete formwork alignment and pressure resistance.', 'Concrete', 'Formwork Accessories', '03', '03 11 00', 12],
  ['Brick lintel, steel angle, 3x3 x 1/4 x 6 ft', 'Steel angle brick lintel for supporting masonry over window and door openings.', 'Masonry', 'Flashing', '04', '04 05 00', 65],
  ['Control joint profile, PVC, 1/2 x 1-1/2 in x 10 ft', 'PVC control joint profile for tooled control joints in concrete flatwork and sidewalks.', 'Concrete', 'Accessories', '03', '03 30 00', 6],
  ['Rebar splice, mechanical, #6', 'Mechanical rebar splice coupler for #6 bar in columns and heavy structural reinforcement.', 'Concrete', 'Reinforcing Steel', '03', '03 20 00', 15],
  ['Fiber mesh, micro-synthetic, 1 lb bag', 'Micro-synthetic fiber bag additive for shrinkage crack control in residential concrete flatwork.', 'Concrete', 'Accessories', '03', '03 30 00', 8],
];
for (const [name, desc, cat, sub, div, sec, cost] of cmNames) {
  cm.push(mat({ id: `material-concrete-masonry-${slug(name)}`, category: cat, subcategory: sub, csiDivision: div, csiSection: sec, name, description: desc, unit: 'EA', commonUnits: ['EA', 'BOX', 'LF'], defaultUnitCost: cost, tags: ['concrete', 'masonry'] }));
}
add('materials/concrete-masonry.json', cm);

// lumber-framing +9
const lf = [];
const lumberSizes = [['2x4', 8], ['2x6', 10], ['2x8', 12], ['2x10', 14], ['2x12', 16]];
for (const [nom, len] of lumberSizes) {
  lf.push(mat({
    id: `material-lumber-framing-spf-select-${nom}-${len}ft`,
    category: 'Lumber / Framing', subcategory: 'Dimensional Lumber', csiDivision: '06', csiSection: '06 10 00',
    name: `Framing lumber, SPF Select, ${nom} x ${len}'`,
    description: `Kiln-dried SPF Select dimensional lumber, ${nom} by ${len} foot, for exposed framing and premium carpentry applications.`,
    unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: 5 + len * 0.5, tags: ['lumber', 'framing', nom],
  }));
}
const lfExtra = [
  ['Plywood, marine grade, 3/4 in, 4x8', 'Marine-grade plywood panel for moisture-exposed sheathing and specialty applications.', 'Plywood', 55],
  ['OSB, radiant barrier, 7/16 in, 4x8', 'OSB panel with radiant barrier foil for roof decking energy efficiency.', 'OSB', 28],
  ['Beam, LVL, 1.75 x 11-7/8 in, 20 ft', 'LVL beam 20 foot length for window and door header framing in load-bearing walls.', 'Engineered Lumber', 65],
  ['Connector, skewed joist hanger, LSSU', 'Skewed joist hanger for angled joist connections at hip and valley framing conditions.', 'Framing Connectors', 5],
];
for (const [name, desc, sub, cost] of lfExtra) {
  lf.push(mat({ id: `material-lumber-framing-${slug(name)}`, category: 'Lumber / Framing', subcategory: sub, csiDivision: '06', csiSection: '06 16 00', name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF', 'SQ'], defaultUnitCost: cost, tags: ['lumber', 'framing'] }));
}
add('materials/lumber-framing.json', lf);

// mep +14
const mep = [];
const pipeSizes = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2'];
for (const sz of pipeSizes) {
  mep.push(mat({
    id: `material-mep-pvc-schedule-80-${slug(sz)}in-10ft`,
    category: 'Plumbing', subcategory: 'Plumbing', csiDivision: '22', csiSection: '22 11 00',
    name: `PVC pipe, Schedule 80, ${sz} inch, 10 ft`,
    description: `PVC Schedule 80 pipe, ${sz} inch, 10 foot stick for high-pressure and industrial plumbing applications.`,
    unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: 5 + pipeSizes.indexOf(sz) * 4, tags: ['plumbing', 'pvc', 'pipe'],
  }));
}
const mepExtra = [
  ['Water meter, 3/4 in, residential', 'Residential water meter for potable water service entry and utility billing connection.', 125],
  ['Backflow preventer, 1 in, reduced pressure', 'Reduced pressure backflow preventer for irrigation and fire line cross-connection protection.', 285],
  ['Conduit, PVC, Schedule 40, 1 in, 10 ft', 'PVC electrical conduit for underground and encased electrical branch circuit routing.', 8],
  ['Panel, sub, 100A, 20-space', '100 amp sub-panel for garage, shop, and addition electrical distribution.', 185],
  ['Thermostat, smart, WiFi, programmable', 'WiFi-enabled smart thermostat for HVAC zone control and energy management.', 165],
  ['Exhaust fan, bath, 80 CFM, with light', 'Bathroom exhaust fan with integrated light for moisture and odor ventilation.', 65],
  ['Condensate pump, 120V, with safety switch', 'Condensate removal pump for HVAC air handler and furnace condensate drainage.', 85],
  ['Duct sealant, mastic, 1 gal', 'HVAC duct mastic sealant for sealing duct joints and connections in air distribution.', 22],
];
for (const [name, desc, cost] of mepExtra) {
  const isHvac = name.includes('Thermostat') || name.includes('Exhaust') || name.includes('Condensate') || name.includes('Duct');
  const isElec = name.includes('Conduit') || name.includes('Panel');
  mep.push(mat({
    id: `material-mep-${slug(name)}`, category: isHvac ? 'HVAC' : isElec ? 'Electrical' : 'Plumbing',
    subcategory: isHvac ? 'HVAC' : isElec ? 'Electrical' : 'Plumbing', csiDivision: isHvac ? '23' : isElec ? '26' : '22',
    csiSection: isHvac ? '23 37 00' : isElec ? '26 27 00' : '22 11 00', name, description: desc,
    unit: 'EA', commonUnits: ['EA'], defaultUnitCost: cost, tags: ['mep', 'plumbing', 'electrical', 'hvac'],
  }));
}
add('materials/mep.json', mep);

// roofing-exterior +27
const re = [];
const shingleColors = ['charcoal', 'weathered wood', 'slate gray', 'desert tan', 'forest green'];
for (const color of shingleColors) {
  re.push(mat({
    id: `material-roofing-exterior-shingle-arch-${slug(color)}`,
    category: 'Roofing', subcategory: 'Asphalt Shingle Roofing', csiDivision: '07', csiSection: '07 31 00',
    name: `Architectural shingle, ${color}, per square`,
    description: `Architectural asphalt shingle, ${color} color, per square coverage for steep-slope residential and commercial roofing.`,
    unit: 'SQ', commonUnits: ['SQ', 'bundle'], defaultUnitCost: 95 + shingleColors.indexOf(color) * 5, tags: ['roofing', 'shingle', color],
  }));
}
const reItems = [
  ['Roof vent, turtle type, aluminum', 'Aluminum turtle-type roof vent for attic exhaust ventilation on shingle roof systems.', 'Roofing', 'Flashing', 18],
  ['Pipe boot, EPDM, 1-1/2 in', 'EPDM pipe boot flashing for plumbing vent penetration through shingle roof surfaces.', 'Roofing', 'Flashing', 12],
  ['Pipe boot, EPDM, 3 in', 'EPDM pipe boot flashing for larger vent and pipe penetrations through roofing.', 'Roofing', 'Flashing', 15],
  ['Skylight, fixed, 2x4 ft, curb mount', 'Fixed curb-mount skylight for natural daylight in sloped roof applications.', 'Roofing', 'Flashing', 285],
  ['Gutter, aluminum, 5 in K-style, 10 ft', 'Aluminum K-style gutter section for roof edge water collection and drainage.', 'Exterior Cladding', 'Siding and Trim', 12],
  ['Downspout, aluminum, 3x4 in, 10 ft', 'Aluminum downspout for conveying roof runoff from gutter to grade or drain.', 'Exterior Cladding', 'Siding and Trim', 10],
  ['Soffit panel, vinyl, vented, 12 ft', 'Vented vinyl soffit panel for eave ventilation and finished soffit appearance.', 'Exterior Cladding', 'Siding and Trim', 14],
  ['Fascia vent, aluminum, 8 ft', 'Aluminum fascia vent strip for concealed eave intake ventilation at the roof edge.', 'Exterior Cladding', 'Siding and Trim', 8],
  ['Window flashing tape, 4 in x 75 ft', 'Flexible window flashing tape for pan and jamb flashing at rough window openings.', 'Waterproofing', 'Below-Grade and Joint Sealants', 35],
  ['Flashing, step, aluminum, 5x7 in', 'Aluminum step flashing for sidewall to shingle roof intersection waterproofing.', 'Roofing', 'Flashing', 2],
  ['Flashing, valley, W-type, 24 in x 10 ft', 'W-type valley flashing for open valley shingle roof water management.', 'Roofing', 'Flashing', 22],
  ['Siding, fiber cement, 4x8 panel', 'Fiber cement panel siding for contemporary exterior wall cladding applications.', 'Exterior Cladding', 'Siding and Trim', 28],
  ['Siding, board and batten, fiber cement, 12 ft', 'Fiber cement board and batten siding for vertical exterior cladding detail.', 'Exterior Cladding', 'Siding and Trim', 18],
  ['Exterior paint, acrylic latex, 5 gal', 'Acrylic latex exterior paint for siding, trim, and exterior wood and fiber cement.', 'Exterior Cladding', 'Siding and Trim', 85],
  ['Stucco mesh, fiberglass, 38 in x 150 ft', 'Fiberglass stucco reinforcing mesh for EIFS and cement stucco wall systems.', 'Exterior Cladding', 'Stucco', 65],
  ['EIFS base coat, 5 gal pail', 'Exterior insulation and finish system base coat for EIFS wall cladding applications.', 'Exterior Cladding', 'Stucco', 45],
  ['EIFS finish coat, 5 gal pail', 'EIFS finish coat for color and texture on exterior insulation and finish systems.', 'Exterior Cladding', 'Stucco', 55],
  ['Stone cap, precast concrete, 24 in', 'Precast concrete wall cap for masonry and stone wall top course protection.', 'Exterior Cladding', 'Stone Veneer', 35],
  ['Weep screed, galvanized, 10 ft', 'Galvanized weep screed for stucco and stone veneer base termination and drainage.', 'Exterior Cladding', 'Stucco', 8],
  ['Window, fixed picture, 4x3 ft, vinyl', 'Fixed picture vinyl window for non-operable daylight and view applications.', 'Doors / Windows / Openings', 'Windows', 225],
  ['Garage door, steel, 16x7 ft, insulated', 'Insulated steel sectional garage door for residential two-car garage openings.', 'Doors / Windows / Openings', 'Doors', 685],
  ['Exterior door, fiberglass, 3-0 x 6-8, insulated', 'Insulated fiberglass exterior entry door for residential front entry applications.', 'Doors / Windows / Openings', 'Doors', 425],
];
for (const [name, desc, cat, sub, cost] of reItems) {
  const div = cat.includes('Doors') ? '08' : cat.includes('Waterproofing') ? '07' : '07';
  const sec = cat.includes('Doors') ? '08 50 00' : sub === 'Stucco' ? '07 24 00' : sub === 'Stone Veneer' ? '07 44 00' : '07 31 00';
  re.push(mat({ id: `material-roofing-exterior-${slug(name)}`, category: cat, subcategory: sub, csiDivision: div, csiSection: sec, name, description: desc, unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: cost, tags: ['exterior', 'roofing'] }));
}
add('materials/roofing-exterior.json', re);

// drywall-finishes +36
const df = [];
const gypBoard = [
  ['1/4 in', 'flexible gypsum board for curved walls and archway construction applications'],
  ['3/8 in', 'lightweight gypsum board for overlay and mobile home renovation applications'],
  ['5/8 in abuse-resistant', 'abuse-resistant gypsum board for corridors, classrooms, and high-traffic areas'],
  ['5/8 in shaft liner', 'shaft liner gypsum board for mechanical and elevator shaft wall assemblies'],
];
for (const [thick, desc] of gypBoard) {
  df.push(mat({
    id: `material-drywall-finishes-gypsum-${slug(thick)}-4x8`,
    category: 'Drywall / Gypsum', subcategory: 'Gypsum Board', csiDivision: '09', csiSection: '09 29 00',
    name: `Gypsum board, ${thick}, 4x8`,
    description: `${thick.charAt(0).toUpperCase() + thick.slice(1)} gypsum wallboard, 4 foot by 8 foot, for ${desc}.`,
    unit: 'EA', commonUnits: ['EA', 'SF'], defaultUnitCost: 10 + gypBoard.indexOf([thick, desc]) * 3, tags: ['drywall', 'gypsum'],
  }));
}
const dfItems = [
  ['Corner bead, vinyl, bullnose, 8 ft', 'Vinyl bullnose corner bead for rounded outside corner gypsum board finishing.', 'Finishing', 3],
  ['Control joint, zinc, 8 ft', 'Zinc control joint for gypsum board expansion and movement joint treatment.', 'Finishing', 4],
  ['Tape, paper, 2-1/16 in x 500 ft', 'Paper joint tape roll for gypsum board joint finishing and embedding.', 'Finishing', 8],
  ['Tape, fiberglass mesh, 2 in x 300 ft', 'Fiberglass mesh tape for gypsum board joint reinforcement and crack prevention.', 'Finishing', 12],
  ['Primer, stain-blocking, 1 gal', 'Stain-blocking primer for covering water stains and tannin bleed before painting.', 'Paint', 28],
  ['Paint, exterior latex, flat, 5 gal', 'Exterior flat latex paint for soffits, ceilings, and protected exterior surfaces.', 'Paint', 95],
  ['Paint, interior latex, semi-gloss, 5 gal', 'Interior semi-gloss latex paint for trim, doors, and wet-area wall surfaces.', 'Paint', 85],
  ['Wood stain, interior, oil-based, 1 gal', 'Oil-based interior wood stain for finishing trim, doors, and exposed wood.', 'Paint', 32],
  ['Polyurethane, water-based, satin, 1 gal', 'Water-based satin polyurethane for protecting interior wood floors and trim.', 'Paint', 45],
  ['Carpet, broadloom, nylon, per SY', 'Nylon broadloom carpet for office, bedroom, and living area floor finishes.', 'Resilient Flooring', 18],
  ['Carpet pad, rebond, 7/16 in, per SF', 'Rebond carpet cushion pad for residential and commercial carpet installations.', 'Resilient Flooring', 0.65],
  ['Transition strip, metal, carpet to tile', 'Metal transition strip for carpet to tile floor height and material change.', 'Resilient Flooring', 8],
  ['Reducer strip, vinyl, 6 ft', 'Vinyl floor reducer strip for transitioning between different floor finish heights.', 'Resilient Flooring', 6],
  ['Tile, mosaic, glass, 12x12 sheet', 'Glass mosaic tile sheet for decorative backsplash and accent wall tile applications.', 'Tile', 12],
  ['Tile, porcelain, large format, 24x48', 'Large-format porcelain tile for modern floor and wall tile installations.', 'Tile', 8],
  ['Grout, unsanded, 25 lb bag', 'Unsanded tile grout for wall tile joints 1/8 inch and narrower.', 'Tile', 14],
  ['Grout sealer, penetrating, 1 qt', 'Penetrating grout sealer for protecting tile grout from staining and moisture.', 'Tile', 18],
  ['Underlayment, cork, 1/4 in, 4x8', 'Cork underlayment board for sound reduction under hard surface flooring.', 'Resilient Flooring', 22],
  ['Underlayment, foam, 1/4 in, roll', 'Foam floor underlayment roll for laminate and floating floor installations.', 'Resilient Flooring', 0.35],
  ['Insulation, spray foam kit, open cell, 200 bd ft', 'Open-cell spray foam kit for air sealing and insulating small cavity areas.', 'Thermal and Acoustic Insulation', 185],
  ['Insulation, rock wool, 4 in, 16 in wide', 'Mineral wool insulation batt for fire-rated and acoustic partition assemblies.', 'Thermal and Acoustic Insulation', 1.85],
  ['Insulation, rigid, polyiso, 1 in, 4x8', 'Polyisocyanurate rigid insulation for interior and exterior continuous insulation.', 'Thermal and Acoustic Insulation', 18],
  ['Acoustic sealant, latex, 28 oz tube', 'Acoustic sealant for sealing gypsum board perimeters in sound-rated partitions.', 'Finishing', 6],
  ['Resilient channel, 25 ga, 8 ft', 'Resilient furring channel for decoupling gypsum board from framing in sound-rated walls.', 'Finishing', 3],
  ['Sound clip, rubber, for resilient channel', 'Rubber sound isolation clip for resilient channel attachment in acoustic assemblies.', 'Finishing', 2],
  ['Access panel, gypsum, 12x12 in', 'Gypsum access panel for providing access to valves, cleanouts, and junction boxes.', 'Finishing', 18],
  ['Corner guard, vinyl, 2x48 in', 'Vinyl corner guard for protecting gypsum board corners in high-traffic corridors.', 'Finishing', 8],
  ['Wallcovering, vinyl, Type II, per SF', 'Commercial vinyl wallcovering Type II for durable interior wall finish surfaces.', 'Paint', 2.25],
  ['Wallpaper adhesive, clay-based, 1 gal', 'Clay-based wallpaper adhesive for installing vinyl and paper wallcoverings.', 'Paint', 15],
  ['Drywall adhesive, latex, 28 oz tube', 'Latex drywall adhesive for bonding gypsum board to concrete and masonry substrates.', 'Finishing', 5],
  ['Leveling compound, self-leveling, 50 lb bag', 'Self-leveling underlayment for correcting uneven subfloors before finish flooring.', 'Resilient Flooring', 28],
  ['Moisture barrier, 6 mil poly, 10 ft x 100 ft', '6 mil polyethylene moisture barrier for under-slab and crawl space moisture control.', 'Thermal and Acoustic Insulation', 35],
];
for (const [name, desc, sub, cost] of dfItems) {
  const cat = sub === 'Tile' ? 'Finishes' : sub === 'Paint' ? 'Finishes' : sub === 'Resilient Flooring' ? 'Flooring' : sub.includes('Insulation') ? 'Insulation' : 'Drywall / Finishes';
  df.push(mat({
    id: `material-drywall-finishes-${slug(name)}`, category: cat, subcategory: sub,
    csiDivision: sub === 'Tile' ? '09' : sub.includes('Insulation') ? '07' : '09',
    csiSection: sub === 'Tile' ? '09 30 00' : sub.includes('Insulation') ? '07 21 00' : '09 29 00',
    name, description: `${name} for interior finish and drywall assembly applications including ${desc.toLowerCase()}.`,
    unit: name.includes('SF') || name.includes('SY') ? (name.includes('SY') ? 'SY' : 'SF') : name.includes('bag') ? 'BAG' : name.includes('roll') ? 'ROLL' : 'EA',
    commonUnits: ['EA', 'SF', 'BOX', 'BAG'], defaultUnitCost: cost, tags: ['drywall', 'finish'],
  }));
}
add('materials/drywall-finishes.json', df);

// sitework +45
const sw = [];
const utilSizes = ['4', '6', '8', '10', '12'];
for (const sz of utilSizes) {
  sw.push(mat({
    id: `material-sitework-storm-pipe-rcp-${sz}in-8ft`,
    category: 'Sitework / Earthwork', subcategory: 'Drainage Materials', csiDivision: '33', csiSection: '33 40 00',
    name: `Reinforced concrete pipe, ${sz} inch, Class III, 8 ft`,
    description: `Reinforced concrete pipe, ${sz} inch diameter, Class III, 8 foot length for storm sewer and culvert applications.`,
    unit: 'EA', commonUnits: ['EA', 'LF'], defaultUnitCost: 85 + utilSizes.indexOf(sz) * 65, tags: ['storm', 'pipe', 'drainage'],
  }));
}
const swItems = [
  ['Fire hydrant, ductile iron, 5-1/4 in barrel', 'Ductile iron fire hydrant for municipal and private fire protection water supply systems.', 'Utility Pipe', 1850],
  ['Gate valve, resilient wedge, 6 in', 'Resilient wedge gate valve for water main branch isolation and system control.', 'Utility Pipe', 425],
  ['Water service line, copper, Type K, 1 in, per LF', 'Type K copper water service line for building water service entry from main to meter.', 'Utility Pipe', 12],
  ['Meter pit, precast concrete, 30 in', 'Precast concrete meter pit for housing water meter and service valve at property line.', 'Utility Pipe', 285],
  ['Septic tank, precast concrete, 1,000 gal', 'Precast concrete septic tank for on-site wastewater treatment in non-sewered areas.', 'Drainage Materials', 1250],
  ['Leach field chamber, plastic, 34 in x 52 in', 'Plastic leach field chamber for septic system effluent dispersal in drain fields.', 'Drainage Materials', 45],
  ['Grease interceptor, 50 GPM, concrete', 'Concrete grease interceptor for commercial kitchen wastewater pretreatment.', 'Drainage Materials', 850],
  ['Oil-water separator, 100 GPM', 'Oil-water separator for vehicle maintenance and parking area runoff pretreatment.', 'Drainage Materials', 2500],
  ['Bio-retention soil mix, per CY', 'Engineered bio-retention soil mix for rain garden and stormwater BMP installations.', 'Softscape and Hardscape', 65],
  ['Permeable paver, concrete, 4x8, per SF', 'Permeable interlocking concrete paver for stormwater infiltration parking and walks.', 'Softscape and Hardscape', 6],
  ['Geogrid, biaxial, 4 ft x 50 ft roll', 'Biaxial geogrid for subgrade stabilization under roads, parking, and paved areas.', 'Aggregates and Erosion Control', 95],
  ['Geocell, HDPE, 8 in depth, per SF', 'HDPE geocell confinement system for slope stabilization and load support over soft soils.', 'Aggregates and Erosion Control', 3.50],
  ['Filter fabric, nonwoven, 15 ft x 300 ft', 'Nonwoven geotextile filter fabric for subsurface drainage and separation applications.', 'Aggregates and Erosion Control', 85],
  ['Riprap fabric, heavy-duty, 15 ft x 100 ft', 'Heavy-duty geotextile for underlayment beneath rip-rap and erosion control stone.', 'Aggregates and Erosion Control', 65],
  ['Precast curb, 6 in x 18 in, 4 ft', 'Precast concrete curb section for parking lot and street curb installation.', 'Paving', 18],
  ['Precast gutter, 12 in, 4 ft', 'Precast concrete gutter section for drainage alongside curbs and paved areas.', 'Paving', 22],
  ['Detectable warning plate, cast iron, 2x4 ft', 'Cast iron detectable warning surface plate for ADA-compliant truncated dome at crossings.', 'Paving', 285],
  ['Traffic paint, waterborne, white, 5 gal', 'Waterborne traffic paint for parking lot striping, arrows, and pavement markings.', 'Paving', 55],
  ['Pavement marking tape, white, 4 in x 36 yd', 'Preformed pavement marking tape for durable parking lot and road lane markings.', 'Paving', 35],
  ['Speed bump, asphalt, 6 ft', 'Asphalt speed bump for traffic calming in parking lots and private drives.', 'Paving', 45],
  ['Wheel stop, precast concrete, 6 ft', 'Precast concrete wheel stop for parking stall vehicle positioning in parking lots.', 'Paving', 35],
  ['Bollard, steel pipe, 6 in x 36 in, filled', 'Steel pipe bollard filled with concrete for vehicle impact protection at building entries.', 'Paving', 85],
  ['Tree grate, cast iron, 4x4 ft', 'Cast iron tree grate for protecting tree root zones in hardscape and sidewalk areas.', 'Softscape and Hardscape', 125],
  ['Tree well, precast concrete, 4x4 ft', 'Precast concrete tree well for urban street tree planting in sidewalk hardscape.', 'Softscape and Hardscape', 185],
  ['Irrigation sprinkler, rotor, 15-50 ft', 'Gear-driven rotor sprinkler for landscape irrigation coverage of large turf areas.', 'Softscape and Hardscape', 12],
  ['Irrigation controller, 12-station, outdoor', 'Outdoor irrigation controller for automated landscape watering schedule management.', 'Softscape and Hardscape', 185],
  ['Drip irrigation, 1/2 in tubing, 100 ft', 'Half-inch drip irrigation tubing for efficient landscape bed and shrub watering.', 'Softscape and Hardscape', 18],
  ['Landscape boulder, granite, 18-24 in', 'Granite landscape boulder for decorative accent in planting beds and entry features.', 'Softscape and Hardscape', 85],
  ['Decorative rock, river rock, 2-4 in, per ton', 'River rock decorative stone for dry creek beds, landscape beds, and ground cover.', 'Softscape and Hardscape', 45],
  ['Concrete sand, per ton', 'Concrete sand for pipe bedding, paver base, and fine grading under hardscape.', 'Aggregates and Erosion Control', 22],
  ['Bank run gravel, per ton', 'Bank run gravel for subbase, fill, and general site grading applications.', 'Aggregates and Erosion Control', 18],
  ['Structural fill, compacted, per CY', 'Compacted structural fill for building pad preparation and site grading.', 'Aggregates and Erosion Control', 15],
  ['Lime, hydrated, 50 lb bag', 'Hydrated lime for soil stabilization and masonry mortar mixing applications.', 'Aggregates and Erosion Control', 8],
  ['Portland cement, Type I, 94 lb bag', 'Type I portland cement bag for small concrete batches, grout, and mortar mixing.', 'Aggregates and Erosion Control', 12],
  ['Curing compound, wax-based, 5 gal', 'Wax-based curing compound for horizontal concrete curing on paving and flatwork.', 'Paving', 42],
  ['Joint sealant, hot-pour, 30 lb block', 'Hot-pour joint sealant for sealing expansion joints in concrete paving and sidewalks.', 'Paving', 8],
  ['Doweling basket, 1-1/4 in dowel, 12 ft', 'Doweling basket assembly for load transfer at transverse joints in concrete paving.', 'Paving', 15],
  ['Underdrain pipe, perforated, 4 in, 100 ft', 'Perforated underdrain pipe for subsurface drainage behind retaining walls and subgrades.', 'Drainage Materials', 35],
  ['French drain, prefabricated, 12 in x 100 ft', 'Prefabricated French drain system for foundation and yard subsurface drainage.', 'Drainage Materials', 125],
  ['Catch basin adapter, 4 in', 'Catch basin adapter fitting for connecting lateral drain pipe to catch basin inlet.', 'Drainage Materials', 12],
];
for (const [name, desc, sub, cost] of swItems) {
  sw.push(mat({
    id: `material-sitework-${slug(name)}`, category: 'Sitework / Earthwork', subcategory: sub,
    csiDivision: sub === 'Softscape and Hardscape' ? '32' : sub === 'Paving' ? '32' : '33',
    csiSection: sub === 'Softscape and Hardscape' ? '32 90 00' : sub === 'Paving' ? '32 12 00' : '33 40 00',
    name, description: desc, unit: name.includes('ton') ? 'TON' : name.includes('CY') ? 'CY' : name.includes('SF') ? 'SF' : name.includes('LF') ? 'LF' : name.includes('roll') ? 'ROLL' : name.includes('bag') ? 'BAG' : 'EA',
    commonUnits: ['EA', 'TON', 'CY', 'LF', 'SF'], defaultUnitCost: cost, tags: ['sitework', 'utility', 'drainage'],
  }));
}
add('materials/sitework.json', sw);

console.log('\nSupplementary pass complete.');
