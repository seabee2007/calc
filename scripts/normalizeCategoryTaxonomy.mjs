/**
 * Normalize production-rate category fields in approved JSON files.
 * Maps raw PDF/manual section titles to estimator-facing picker categories.
 *
 * Usage: node scripts/normalizeCategoryTaxonomy.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPROVED_DIR = join(process.cwd(), 'data/estimating/production-rates/approved');

/** @type {Record<string, Record<string, string>>} */
const EXACT_MAP = {
  '01': {
    Barricades: 'Temporary Controls',
    'CESE Mobilization or Demobilization': 'Mobilization & Demobilization',
    'Jobsite Portolet': 'Temporary Facilities',
    'Lot location and lines, for large quantities,': 'Field Engineering',
    'Project Sign': 'Temporary Facilities',
    'Roads and Sidewalks': 'Temporary Facilities',
    Scaffolding: 'Temporary Controls',
    'Survey, conventional, topographical': 'Field Engineering',
    'Temporary Fencing': 'Temporary Controls',
    'Temporary Protective Walkways': 'Temporary Controls',
    'Tool Kit Inventory': 'Temporary Facilities',
    'Trailer Mounted Floodlight Set': 'Temporary Facilities',
  },
  '04': {
    'Anchor Bolts': 'Masonry Accessories',
    'Brick Veneer Masonry': 'Brick Masonry',
    'Brick Washing': 'Masonry Cleaning & Repair',
    'Cleaning Masonry': 'Masonry Cleaning & Repair',
    'Concrete Block': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Back-up': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Bond Beam': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Column or Pilaster': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Exterior': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Exterior (0010) Normal weight, tooled two sides, reinforced, alternate courses 8- by 16-inch units, 8 inches thick':
      'Concrete Masonry Units (CMU)',
    'Concrete Block, Foundation Wall': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Interlocking': 'Concrete Masonry Units (CMU)',
    'Concrete Block, Partitions': 'Concrete Masonry Units (CMU)',
    'Control Joint': 'Masonry Accessories',
    Grouting: 'Masonry Mortar & Grout',
    'Hollow, not reinforced,': 'Concrete Masonry Units (CMU)',
    'Hollow, reinforced alternate courses': 'Concrete Masonry Units (CMU)',
    'Hooked, with nut and washer': 'Masonry Accessories',
    'Including horizontal reinforcing and grout': 'Masonry Reinforcement',
    'Including reinforcing and grout': 'Masonry Reinforcement',
    'Masonry Anchors': 'Masonry Accessories',
    'Masonry Reinforcing Bars': 'Masonry Reinforcement',
    Mortar: 'Masonry Mortar & Grout',
    'Normal weight, cut joints, horizontal joint reinforcing, no vertical reinforcing, hollow or solid':
      'Concrete Masonry Units (CMU)',
    'Not including reinforcing and grout': 'Concrete Masonry Units (CMU)',
    'Pointing Masonry': 'Masonry Cleaning & Repair',
    'Regular block, 8 inches high, including reinforcing (two #5 bars) and grout':
      'Concrete Masonry Units (CMU)',
    'Reinforced, alternate courses': 'Concrete Masonry Units (CMU)',
    'Solid, not reinforced,': 'Concrete Masonry Units (CMU)',
    'Solid, reinforced alternate courses': 'Concrete Masonry Units (CMU)',
    'Terra Cotta Masonry Components': 'Terra Cotta Masonry',
    'Terra Cotta Tile': 'Terra Cotta Masonry',
    'Vent Box': 'Masonry Accessories',
  },
  '05': {
    'Cold Formed Metal Joist Framing': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Joist Framing': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Joist Framing Bracing': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Joist Framing Bridging': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Joist Framing Roof Rafters': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Joist Framing Soffits and Canopies': 'Cold-Formed Metal Framing',
    'Cold Formed Metal Roof Trusses': 'Cold-Formed Metal Framing',
    'Cutting Steel': 'Metal Fabrications',
    'Hand burning, includes preparation, torch cutting and grinding, no staging. Steel to:':
      'Metal Fabrications',
    'Single pass,': 'Metal Fabrications',
    'Structural Metal Stud Framing': 'Cold-Formed Metal Framing',
    'Structural Metal Stud Framing Bridging': 'Cold-Formed Metal Framing',
    'Structural Metal Stud Framing Stud Walls': 'Cold-Formed Metal Framing',
    'Structural Steel Fabrication': 'Structural Steel',
    'Structural Steel For Buildings': 'Structural Steel',
    'Welding Steel, Structural': 'Structural Steel',
  },
  '06': {
    'Beam and Girder Framing': 'Rough Carpentry',
    Blocking: 'Rough Carpentry',
    'Ceiling Framing': 'Rough Carpentry',
    'Exterior Wood Door Frames and Accessories': 'Finish Carpentry',
    'Exterior, modern, plain trim 3-foot opening, in-swing,': 'Finish Carpentry',
    Furring: 'Rough Carpentry',
    'Heavy Framing': 'Rough Carpentry',
    'Interior Wood Door Jamb and Frames': 'Finish Carpentry',
    'Joist Framing': 'Rough Carpentry',
    'Miscellaneous Framing': 'Rough Carpentry',
    'Moldings, Exterior': 'Finish Carpentry',
    'Moldings, Soffits': 'Finish Carpentry',
    'Moldings, Trim': 'Finish Carpentry',
    'Moldings, Window and Door': 'Finish Carpentry',
    'On ceilings': 'Rough Carpentry',
    Paneling: 'Finish Carpentry',
    'Paneling, Plywood': 'Finish Carpentry',
    'Plywood, prefinished, 1/4 inch thick, 4- by 8-foot sheets': 'Finish Carpentry',
    'Plywood, prefinished, 3/4 inch thick, 4- by 8-foot sheets': 'Finish Carpentry',
    'Posts and Columns': 'Rough Carpentry',
    'Ridge board,': 'Rough Carpentry',
    'Roof Framing': 'Rough Carpentry',
    'Roofs,': 'Rough Carpentry',
    'Rough Carpentry': 'Rough Carpentry',
    'Sheathing Roofs': 'Sheathing',
    'Sill and Ledger Framing': 'Rough Carpentry',
    'Single bottom and double top plate,': 'Rough Carpentry',
    Sleepers: 'Rough Carpentry',
    'Soffit and Canopy Framing': 'Rough Carpentry',
    'Steel, galvanized, 18 gauge,': 'Rough Carpentry',
    Subfloor: 'Sheathing',
    'To steel construction': 'Rough Carpentry',
    Underlayment: 'Sheathing',
    'Wall Framing': 'Rough Carpentry',
    'Walls,': 'Rough Carpentry',
    'Window trim set, including casings, header, stops, stool and apron (0050) 2 1/2 inches wide, minimum':
      'Finish Carpentry',
    'Wood Bracing': 'Rough Carpentry',
    'Wood Stairs and Railings': 'Wood Stairs & Railings',
    'Wood strips, on walls, 1 by 2 inches or 1 by 3 inches': 'Finish Carpentry',
    'Wood, for joists 16 inches on center': 'Rough Carpentry',
  },
  '07': {
    '(0010) 4-inch-face height': 'Flashing & Sheet Metal',
    '(0010) Aluminum, copper, galvanized and stainless steel of various thicknesses and widths, average':
      'Flashing & Sheet Metal',
    '(0010) Corrugated or ribbed, various thicknesses': 'Roofing',
    '(0010) Corrugated panels, roofing, various weights': 'Roofing',
    '(0010) Fibrous/cementitious, finished wall, 1 inch thick attic': 'Insulation',
    '(0010) Minimum, i.e., 30 gauge': 'Flashing & Sheet Metal',
    'Acrylic latex caulk, 11 ounce cartridge': 'Joint Sealants',
    'Aluminum Roof Panels': 'Roofing',
    'Aluminum Siding Panels': 'Siding & Exterior Panels',
    'Asphalt Roof Shingles': 'Roofing',
    'Bituminous Asphalt Coating': 'Waterproofing',
    'Blanket Insulation for Walls': 'Insulation',
    'Blown Insulation': 'Insulation',
    'Caulking and Sealant Options': 'Joint Sealants',
    'Cementitious Damp Proofing': 'Waterproofing',
    'Cementitious Waterproofing': 'Waterproofing',
    'Clay Tiles': 'Roofing',
    'Closed cell, spray polyurethane foam, 2 pounds per CF density': 'Insulation',
    'Concrete Tiles': 'Roofing',
    'Copper standing seam roofing, over 10 squares,': 'Roofing',
    'Downspout Elbows': 'Flashing & Sheet Metal',
    Downspouts: 'Flashing & Sheet Metal',
    'Fiberglass Panels': 'Siding & Exterior Panels',
    'Foam Board Insulation': 'Insulation',
    'Gravel Stop': 'Roofing',
    Gutters: 'Flashing & Sheet Metal',
    'Membrane Waterproofing': 'Waterproofing',
    'Metal Roof Tiles': 'Roofing',
    'On slabs,': 'Waterproofing',
    'Plywood Siding Option': 'Siding & Exterior Panels',
    'Poured Loose-Fill Insulation': 'Insulation',
    'Reglets and Accessories': 'Flashing & Sheet Metal',
    'Rigid Insulation': 'Insulation',
    'Roof Deck Insulation': 'Insulation',
    'Roof Vents': 'Roofing',
    'Rubber Sheet Flashing and Counter Flashing': 'Flashing & Sheet Metal',
    'Sheathing Roofs': 'Sheathing',
    'Sheet Metal Flashing and Counter Flashing': 'Flashing & Sheet Metal',
    'Silicone Bases Water Repellents': 'Waterproofing',
    'Snow Guard': 'Roofing',
    'Sprayed-On Insulation': 'Insulation',
    'Steel Roofing Panels': 'Roofing',
    'Steel Siding': 'Siding & Exterior Panels',
    Subfloor: 'Sheathing',
    Underlayment: 'Sheathing',
    'Vapor Retarders': 'Waterproofing',
    'Various materiels, e.g., fiberboard, fiberglass, perlite, extruded polystyrene, etc., based on thickness':
      'Insulation',
    'Various materiels, e.g., fiberglass, unfaced or faced; Isocyanurate (4 by 8 sheet) foil faced both sides; perlite; etc.':
      'Insulation',
    'Various materiels, i.e., cellulose, fiberglass, or mineral wool; average for thickness indicated':
      'Insulation',
    'Various types, e.g., aluminum, copper, steel, etc.': 'Flashing & Sheet Metal',
    'Various types, e.g., wood, cedar bevel;': 'Siding & Exterior Panels',
    'Various types;': 'Siding & Exterior Panels',
    'Vinyl Siding': 'Siding & Exterior Panels',
    'Wall installation, includes drilling and patching from outside, two 1-inch-diameter holes at 16 inches on center, top and middle point of wall, add to above for:':
      'Insulation',
    'Wood Board Siding': 'Siding & Exterior Panels',
    'Wood Shakes (Hand-split red cedar shakes)': 'Roofing',
    'Wood Shingles': 'Roofing',
  },
  '08': {
    '(0010) 2 feet 6 inches wide': 'Doors & Frames',
    '(0010) Threshold, 3-foot-long saddles, aluminum,': 'Hardware',
    'Access Doors and Frames': 'Doors & Frames',
    'Aircraft Hanger Doors': 'Overhead Doors',
    'Aluminum Louvers': 'Louvers & Vents',
    'Aluminum Screen and Storm Doors and Frames': 'Doors & Frames',
    'Aluminum Windows': 'Windows',
    'Aluminum, narrow stile, average by size opening': 'Windows',
    'Average, up to 5 3/4-inch-jamb depth, standard height, various openings': 'Doors & Frames',
    'Bi-fold, overhead, 20 pounds per SF wind load, includes electronic operation': 'Overhead Doors',
    'Bolts, Flush': 'Hardware',
    'Dead Locks': 'Hardware',
    'Dead Locks (0010) Various types, maximum': 'Hardware',
    'Door Closers': 'Hardware',
    'Door Stops': 'Hardware',
    'Doors-Mechanical Seals, Weatherstripping (0010) Doors, wood frame, interlocking, for 3- by 7-foot door, zinc or bronze':
      'Hardware',
    'Doors—Mechanical Seals, Weatherstripping': 'Hardware',
    'Double Hung': 'Windows',
    'Double hung, sash, single lite': 'Windows',
    'Entrance Doors and Frames': 'Doors & Frames',
    'Kick Plates': 'Hardware',
    Lockset: 'Hardware',
    'Mortise Locksets': 'Hardware',
    'Overhead Commercial Doors': 'Overhead Doors',
    'Panic Devices': 'Hardware',
    'Panic Devices (0010) Various types, minimum (0020) Maximum': 'Hardware',
    'Plastic domes, flush or curb mounted': 'Skylights',
    'Push-Pull Plates': 'Hardware',
    'Residential Garage Doors': 'Overhead Doors',
    'Secure Storage Doors and Frames': 'Doors & Frames',
    'Selective Demolition Doors': 'Selective Demolition',
    'Selective Demolition Windows': 'Selective Demolition',
    Skylights: 'Skylights',
    'Sliding Glass Vinyl-Clad Wood Doors': 'Doors & Frames',
    'Smooth Wood Doors': 'Doors & Frames',
    'Solid vinyl, average quality, double insulated glass': 'Windows',
    'Standard Hollow Metal Doors': 'Doors & Frames',
    'Standard Hollow Metal Frames': 'Doors & Frames',
    'Steel Detention Doors and Frames': 'Doors & Frames',
    'Stock units, casement': 'Windows',
    Thresholds: 'Hardware',
    'Various materiels, including trim, e.g., aluminum, steel, wood, etc.': 'Doors & Frames',
    'Various types of doors of standard size': 'Doors & Frames',
    'Wall Louvers': 'Louvers & Vents',
    'Wood Screens': 'Windows',
    'Wood Windows': 'Windows',
  },
  '09': {
    '1/2 inch thick on': 'Drywall',
    '5/8 inch thick on': 'Drywall',
    'Access Floors': 'Flooring',
    'Accessories, Gypsum Board': 'Drywall',
    'Accessories, Plaster': 'Plaster & Stucco',
    'Average times for various surfaces': 'Painting & Coatings',
    'Average times for various surfaces, including steel': 'Painting & Coatings',
    'Cabinets and Casework': 'Specialties',
    'Carpet Tile': 'Flooring',
    'Ceiling Suspension System': 'Ceilings',
    'Ceiling Tile': 'Ceilings',
    'Ceramic Tile': 'Tile',
    'Chain link or wire metal, picket, and stockade; one side, water base': 'Painting & Coatings',
    'Commercial Grade Carpet Pad': 'Flooring',
    'Concrete or wood, oil base primer/sealer coat or latex': 'Painting & Coatings',
    'Doors and Windows': 'Painting & Coatings',
    'Doors and Windows, Exterior': 'Painting & Coatings',
    'Doors, flush, 3 by 7 feet, both sides, including frame and trim, (0010) roll and brush, each coat':
      'Painting & Coatings',
    'Doors, panel, or French, both sides, including frame and trim (0030) roll and brush, each coat':
      'Painting & Coatings',
    'Drywall, concrete, masonry, or plaster, smooth finish, each coat': 'Painting & Coatings',
    'Expanded metal, flat, screwed to framing, 3/4 inch, 1.76 pounds per SF': 'Plaster & Stucco',
    'Exterior Steel Coatings': 'Painting & Coatings',
    'Exterior Surface Preparation': 'Painting & Coatings',
    'Exterior stucco, with bonding agent, three coats, no mesh included,': 'Plaster & Stucco',
    Fences: 'Painting & Coatings',
    'Fiberglass Reinforced Plastic Panels': 'Wall Finishes',
    'Flooring Transition Strip': 'Flooring',
    Floors: 'Plaster & Stucco',
    'Gauging Plaster, (100 pound bags)': 'Plaster & Stucco',
    'Gypsum Board Ceilings': 'Drywall',
    'Gypsum Board Walls': 'Drywall',
    'Gypsum Lath': 'Plaster & Stucco',
    'Gypsum Plaster on Walls and Ceilings, (80 pound bags)': 'Plaster & Stucco',
    'Indoor Athletic Carpet': 'Flooring',
    'Interior Surface Preparation': 'Painting & Coatings',
    'Keenes Cement': 'Plaster & Stucco',
    'Keenes Cement, (100 pound bags)': 'Plaster & Stucco',
    'Latex Underlayment': 'Flooring',
    'Metal Channel Furring': 'Drywall',
    'Metal Lath': 'Plaster & Stucco',
    'Metal Studs and Track': 'Drywall',
    'Miscellaneous Resilient Tile Flooring': 'Flooring',
    'Miscellaneous, Exterior': 'Painting & Coatings',
    'On beams, columns, or soffits, various widths': 'Painting & Coatings',
    'Paints and protective coatings, sprayed in field': 'Painting & Coatings',
    'Partition Wall, Gypsum Board': 'Drywall',
    'Perlite or Vermiculite, (100 pound bags)': 'Plaster & Stucco',
    'Quarry Tile': 'Tile',
    'Resilient Base': 'Flooring',
    'Rubber and Vinyl Sheet Flooring': 'Flooring',
    'Screwed to grid, channel, or joists, 1/2 or 5/8 inch thick': 'Drywall',
    'Security Mesh': 'Specialties',
    'Sheet Carpeting': 'Flooring',
    'Siding, Exterior': 'Wall Finishes',
    'Siding, Miscellaneous': 'Wall Finishes',
    'Structural steel, per coat': 'Painting & Coatings',
    'Stucco, Portland Cement Plastering': 'Plaster & Stucco',
    'Suspended Ceilings': 'Ceilings',
    'Suspended Ceilings, Complete Including standard suspension system (not including carrier channels) Ceiling board, fiberglass or mineral fiber, on 15/16-inch suspension bar, various sizes (0010) minimum':
      'Ceilings',
    'Suspended ceiling, for gypsum board or plaster, 1 1/2- or 2-inch carriers': 'Ceilings',
    'Trim, Exterior': 'Wall Finishes',
    Wallpaper: 'Wall Finishes',
    'Walls and Ceilings': 'Wall Finishes',
    'Walls, Masonry, Concrete Masonry Unit, Exterior': 'Wall Finishes',
    'Walls, nailed or screwed to studs, various widths': 'Wall Finishes',
    'Windows, per side, single lite type, brushwork': 'Painting & Coatings',
    Wood: 'Flooring',
    'Wood Parquet': 'Flooring',
  },
  '10': {
    'Commercial Toilet Accessories': 'Toilet Accessories',
    'Directory Boards': 'Signage & Display',
    'Divider panels, free standing, fiber core, fabric face straight, various types': 'Specialties',
    'Fixed Chalkboards': 'Signage & Display',
    'Fixed Tackboards': 'Signage & Display',
    'Flagpoles, Wall Mounted': 'Signage & Display',
    'For 5 foot wide panels, multiply by 1.05.': 'Specialties',
    'Ground set, not including base or foundation, various types, labor determined by height,':
      'Signage & Display',
    'Lockers, steel': 'Lockers & Storage',
    'Manufactured Wood Casework, Stock Units': 'Specialties',
    'Metal 6 feet 3 inches high, 3 feet wide': 'Specialties',
    'Metal Toilet Compartments': 'Toilet Accessories',
    'Office Furniture': 'Specialties',
    'Partitions, Shower': 'Specialties',
    'Partitions, Woven Wire': 'Specialties',
    'Parts Bins': 'Lockers & Storage',
    'Portable Fire Extinguishers': 'Fire Protection Specialties',
    'Residential Laundry Appliances': 'Specialties',
    'Restaurant Furniture': 'Specialties',
    'Security Gates': 'Specialties',
    Shelving: 'Lockers & Storage',
    'Solid Surface Countertops': 'Specialties',
    'Visual Display Surfaces': 'Signage & Display',
    'Wall Screens': 'Specialties',
    'Wall hung, aluminum or wood frame, by size': 'Signage & Display',
    'Wall panels, 4 feet wide, for tool or stockroom enclosures, channel frame, 1 1/2-inch-diamond mesh, 10-gauge wire':
      'Specialties',
  },
  '11': {
    'Residential Laundry Appliances': 'Specialties',
  },
  '12': {
    '(0030) Kitchen base cabinets, not including counter tops': 'Casework',
    'Manufactured Wood Casework, Stock Units': 'Casework',
    'Office Furniture': 'Furniture',
    'Restaurant Furniture': 'Furniture',
  },
  '13': {
    '(0070) 10-foot-eave height': 'Metal Building Systems',
    '(0090) 10-foot-eave height': 'Metal Building Systems',
    '(0110) 10-foot-eave height': 'Metal Building Systems',
    '20-foot width': 'Metal Building Systems',
    '30- to 40-foot width': 'Metal Building Systems',
    '50- to 100-foot width': 'Metal Building Systems',
    'A-Model (high-pitched roof) unlimited length': 'Metal Building Systems',
    'Antenna, Radio Tower': 'Towers',
    'Fabric shell, 60-foot-clear span, not including foundation or floors': 'Fabric Structures',
    'Framed Fabric Structures': 'Fabric Structures',
    'Framed Fabric Structures (Continued)': 'Fabric Structures',
    'Minimum suggested crew size: Structure installation: one steelworker (crew leader), four laborers, two equipment operators.':
      'Metal Building Systems',
    'P-Model (Straight sidewalls and arched roof. Optimizes useable space by raising the arch to above the sidewalls.) Typical Ultimate Building Machine type. Unlimited length':
      'Metal Building Systems',
    'P-Model (Straight sidewalls and arched roof. Optimizes useable space by raising the arch to above the sidewalls.) Typical ultimate building machine type. Unlimited length':
      'Metal Building Systems',
    'P-Model (Straight sidewalls and arched roof. Optimizes useable space by raising the arch to above the sidewalls.) Typical ultimate building machine type. Unlimited length.':
      'Metal Building Systems',
    'Portable and Mobile Buildings': 'Portable & Mobile Buildings',
    'Q-Model (Maximize usable interior space with no poles or beams), typical K-Span, arch style otherwise known as Quonset hut, unlimited length':
      'Metal Building Systems',
    'S-Model (high, straight sidewalls and curved arch roof) unlimited length': 'Metal Building Systems',
    'Special Construction': 'Special Construction',
    'Steel Towers': 'Towers',
    'Weapons Clearing Facility': 'Protective Facilities',
  },
  '21': {
    'Diesel-Drive Fire Pumps Including controller, fittings, and relief valve': 'Fire Pumps',
    'Dry-pipe Sprinkler System Components': 'Fire Sprinkler Systems',
    'Electric-Drive Fire Pumps Including controller, fittings, and relief valve': 'Fire Pumps',
    'FM200 Fire Extinguishing System': 'Fire Suppression Equipment',
    'FM200 Fire Extinguishing System (0010) Alarm, audio': 'Fire Suppression Equipment',
    'FM200 system, filled, including mounting bracket': 'Fire Suppression Equipment',
    'Including controller, fittings, and relief valve': 'Fire Pumps',
    'Pipe, black steel, threaded, schedule 40': 'Fire Sprinkler Systems',
    'Pipe, tee, 150 pound, black malleable': 'Fire Sprinkler Systems',
  },
  '22': {
    '1-inch wall,': 'Plumbing Insulation',
    '1/2-inch, 3/4-inch or 1-inch wall': 'Plumbing Insulation',
    '2-inch wall,': 'Plumbing Insulation',
    '3/8-inch wall,': 'Plumbing Insulation',
    'Bath Tubs': 'Plumbing Fixtures',
    'Cast Iron Pipe': 'Plumbing Piping',
    'Drinking Water Fountains': 'Plumbing Fixtures',
    'Electric Water Coolers': 'Plumbing Fixtures',
    'Finishes,': 'Plumbing Fixtures',
    Globe: 'Valves & Accessories',
    'Laundry Sinks': 'Plumbing Fixtures',
    Lavatories: 'Plumbing Fixtures',
    'Piping Insulation': 'Plumbing Insulation',
    'Piping Insulation Fiberglass, with all-service jacket 1-inch wall': 'Plumbing Insulation',
    'Piping Insulation Fiberglass, with all-service jacket 2-inch wall': 'Plumbing Insulation',
    'Sanitary Sewerage Pumps': 'Plumbing Equipment',
    'Service Sinks': 'Plumbing Fixtures',
    Showers: 'Plumbing Fixtures',
    Sinks: 'Plumbing Fixtures',
    'Steel Pipe, Threaded': 'Plumbing Piping',
    'Sump Pumps': 'Plumbing Equipment',
    'Urinals, Commercial': 'Plumbing Fixtures',
    'Valves, Brass': 'Valves & Accessories',
    'Valves, Bronze': 'Valves & Accessories',
    'Valves, Plastic': 'Valves & Accessories',
    'Water Closets': 'Plumbing Fixtures',
    'Water Filters': 'Plumbing Equipment',
    'Water Heaters': 'Plumbing Equipment',
    'Water Piping Specialties': 'Plumbing Piping',
  },
  '23': {
    'Fabricate Sheet Metal Duct': 'Ductwork',
    'Fuel oil storage tanks set on floor': 'HVAC Equipment',
    'General duty valves for HVAC piping': 'HVAC Piping',
    'Grills and Registers (Plaster Ground)': 'HVAC Accessories',
    'Hood and Ventilation Equipment': 'HVAC Accessories',
    'Install Fiber Duct for Slab Heating or Cooling System': 'Ductwork',
    'Install Sheet Metal Duct (rectangular)': 'Ductwork',
    'Install Sheet Metal Duct (round)': 'Ductwork',
    'Install Single Package Air Conditioning Units': 'HVAC Equipment',
    'Install Split System Air Conditioning Units': 'HVAC Equipment',
    'Install Window Type Air Conditioners': 'HVAC Equipment',
    'Install and plumb hot water storage tanks': 'HVAC Equipment',
    'Install circulators': 'HVAC Equipment',
    'Minimum suggested crew size two steelworkers': 'HVAC Equipment',
    'Pneumatic and Electric control for air conditioning units': 'Controls',
    'Set and connect expansion tanks': 'HVAC Equipment',
    'Set and connect forced air furnaces complete (less duct, diffusers, and hard wiring)': 'HVAC Equipment',
    'Set and connect iron sectional boilers with insulating jacket and safety devices': 'HVAC Equipment',
  },
  '26': {
    '5-foot length, screw cover with fittings and supports': 'Conduit & Raceways',
    'Automatic Transfer Switches': 'Generation & Transfer',
    'Combination starters, magnetic FVNR with circuit breaker or fused switch and heater': 'Devices & Wiring',
    'Common Work Results for Electrical': 'Electrical Accessories',
    'Connect Small Appliances': 'Devices & Wiring',
    'Control stations, heavy duty': 'Devices & Wiring',
    'Diesel Engine Driven Generator Sets': 'Generation & Transfer',
    'Excavate trench for duct or direct burial of cable': 'Electrical Accessories',
    'Exterior Lighting': 'Lighting',
    'Fire and Heat Detectors': 'Electrical Accessories',
    'General Duty 240V, 3 Pole NEMA 1, fusible': 'Devices & Wiring',
    'Grounding and Bonding for Electrical Systems': 'Electrical Accessories',
    'Heavy Duty, 240V, 3 Pole NEMA 3R, fusible': 'Devices & Wiring',
    'Heavy Duty, 600V, 3 Pole NEMA 1, nonfusible': 'Devices & Wiring',
    'Install Boxes for non-metallic cable': 'Devices & Wiring',
    'Install Incandescent Lighting Fixtures up to 150 Watts-Medium Base': 'Lighting',
    'Install Primary Protective Devices': 'Devices & Wiring',
    'Install Pull Boxes': 'Conduit & Raceways',
    'Install Receptacles and Plates': 'Devices & Wiring',
    'Install Rigid Steel Conduit': 'Conduit & Raceways',
    'Install Secondary Conductors and Service Drops': 'Wire & Cable',
    'Install Service Entrance, Four- Conductor': 'Panels & Distribution',
    'Install Standard Grade Toggle Switches and Plates': 'Devices & Wiring',
    'Install Tactical Distribution Load Centers': 'Panels & Distribution',
    'Install Tent Electrical': 'Lighting',
    'Install Thin Wall and Flexible Conduit': 'Conduit & Raceways',
    'Install Transformer on Poles': 'Generation & Transfer',
    'Install Type non-metallic cable': 'Wire & Cable',
    'Install Voltage Regulators': 'Generation & Transfer',
    'Install and wire complete oil-filled transformer': 'Generation & Transfer',
    'Install capacitor bank with associated equipment': 'Generation & Transfer',
    'Install circuit breakers, enclosed, NEMA type 1, 600 volt, three poles': 'Wire & Cable',
    'Install constant current regulator and control devices for street lighting': 'Lighting',
    'Install direct burial cable in trench': 'Wire & Cable',
    'Install metal light standards (30 feet) (See Note 2)': 'Lighting',
    'Install panel boards, lighting, and power four-wire, three-phase, 100 to 225 ampere main lugs':
      'Panels & Distribution',
    'Install safety switch, three poles, general or heavy duty': 'Devices & Wiring',
    'Ladder type, galvanized steel with fittings and supports': 'Conduit & Raceways',
    'Manual Transfer Switches': 'Generation & Transfer',
    'Medium Voltage Lightning Arrester': 'Generation & Transfer',
    'Medium Voltage Switchgear': 'Generation & Transfer',
    'Minimum suggested crew size: one electrician, one operator.': 'Electrical Accessories',
    'Minimum suggested crew size: two laborers.': 'Electrical Accessories',
    'Motor Starters and Controllers': 'Devices & Wiring',
    'Motor starters and controls, magnetic full voltage non-reversing (FVNR) with heaters and enclosures':
      'Devices & Wiring',
    'Outlet Boxes for Low Voltage Applications': 'Conduit & Raceways',
    'Pull cable into duct': 'Wire & Cable',
    'Pull cable into duct underground service to building': 'Wire & Cable',
    'String Primary Conductors': 'Wire & Cable',
    'Tactical Generator Sets': 'Generation & Transfer',
    'Tactical Generator Sets (USMC)': 'Generation & Transfer',
    'Tactical Generator Sets (USN)': 'Generation & Transfer',
    Testing: 'Electrical Accessories',
    'Transformers and Switches': 'Generation & Transfer',
    'transformer in vault or building': 'Generation & Transfer',
  },
  '31': {
    '(0010) Jackhammer, 2.5-inch diameter (medium)': 'Excavation',
    Backfill: 'Backfill & Compaction',
    'Backfill and Compact': 'Backfill & Compaction',
    'Backfill by hand including compaction, add': 'Backfill & Compaction',
    'Brush mowing, tractor with rotary mower': 'Clearing & Grubbing',
    'Chain trencher, 40 horsepower, operator riding': 'Trenching',
    'Clear and Grub Site': 'Clearing & Grubbing',
    'Common earth with no sheeting or dewatering included': 'Excavation',
    'Common earth, chain trencher, 12 horsepower, operator walking': 'Trenching',
    'Cut and chip trees; 3 CYD crawler loader, brush chipper, and chain saws': 'Clearing & Grubbing',
    'Dense hard clay with no sheeting or dewatering included': 'Excavation',
    'Driven Piles': 'Pile Installation',
    'Erosion Control': 'Erosion & Sedimentation Control',
    'Excavate Footings': 'Excavation',
    'Excavation for Minor Structures': 'Excavation',
    'Hand excavation, trim for pipe bells': 'Excavation',
    'Loam and sandy clay with no sheeting or dewatering included': 'Excavation',
    'Machine excavation, for spread footings and small building foundations': 'Excavation',
    'Remove selective trees, onsite using chain saws and chipper,': 'Clearing & Grubbing',
    'Sand and gravel with no sheeting or dewatering included': 'Excavation',
    'Selective Clearing': 'Clearing & Grubbing',
    'Sheet Piling Systems': 'Sheet Piling & Shoring',
    'Strip and Stockpile Topsoil': 'Site Preparation',
  },
  '33': {
    'Antenna, Radio Tower': 'Communications Infrastructure',
    'Bulk Fuel Receiving and Dispensing': 'Fuel Systems',
    'Diesel Fuel Distribution': 'Fuel Systems',
    'Fabric Pillow Water Storage Tanks': 'Water Storage',
    'Fire Hydrants': 'Water Utilities',
    'Gasoline Distribution': 'Fuel Systems',
    'Install galvanized culvert (bolted)': 'Storm Drainage',
    'Install galvanized pipe culverts': 'Storm Drainage',
    'Manholes, precast concrete, with iron racks and pulling irons, and cast iron cover': 'Utility Structures',
    'Minimum suggested crew size: two equipment operators, 28 laborers': 'Utility Structures',
    'Plastic Coated, Fabric, Pillow Fuel Tanks': 'Fuel Systems',
    'Plastic Sewage Pipe (No excavation)': 'Sanitary Sewer',
    'Steel Water Storage Tanks': 'Water Storage',
    'Storm Drainage Manholes, Frames, Covers': 'Storm Drainage',
    'Tactical Culvert Denial': 'Tactical Utilities',
    'Tactical Water Distribution System': 'Tactical Utilities',
    'Underground duct, banks ready for concrete fill': 'Electrical Ductbanks',
    'Water Supply Miscellaneous': 'Water Utilities',
    'Water Supply PVC Pipe': 'Water Utilities',
    'Water Supply Tactical Hoseline': 'Tactical Utilities',
  },
  '34': {
    'Airfield Wind Cones': 'Airfield Facilities',
    'Concrete Track Cross Ties': 'Rail Infrastructure',
    'Manufactured Helipads': 'Airfield Facilities',
    'Pavement Marking': 'Traffic & Safety',
    'Runway and Taxiway Lighting Systems': 'Airfield Facilities',
    'Suggested crew size: one equipment operator, four laborers': 'Airfield Facilities',
    'Suggested crew size: one equipment operator, nine laborers': 'Airfield Facilities',
    'Timber Track Cross Ties': 'Rail Infrastructure',
    'Traffic Signal Systems': 'Traffic & Safety',
    'Vehicle Crash Barriers': 'Traffic & Safety',
    'Vehicle Guide Rails': 'Traffic & Safety',
  },
  '35': {
    'Floating Construction': 'Marine Structures',
    'For quick estimates:': 'Marine Structures',
    'Marine Bollards and Cleats': 'Marine Hardware',
    'Marine Fenders (0010) Place in leads and drive (0020) Lash with wire rope (0030) Install fenders':
      'Marine Hardware',
    'Minimum suggested crew for above elements 3 divers.': 'Marine Structures',
    'Underwater Structures Construction (Cabling)': 'Underwater Structures',
    'Underwater Structures Construction (Surveys)': 'Underwater Structures',
  },
};

/** Regex fallbacks applied when exact match fails. Order matters. */
const REGEX_FALLBACKS = [
  { pattern: /^[APQS]-[Mm]odel/i, division: '13', target: 'Metal Building Systems' },
  { pattern: /minimum suggested crew/i, division: '13', target: 'Metal Building Systems' },
  { pattern: /minimum suggested crew/i, division: '23', target: 'HVAC Equipment' },
  { pattern: /minimum suggested crew/i, division: '26', target: 'Electrical Accessories' },
  { pattern: /minimum suggested crew/i, division: '33', target: 'Utility Structures' },
  { pattern: /minimum suggested crew/i, division: '35', target: 'Marine Structures' },
  { pattern: /suggested crew size/i, division: '34', target: 'Airfield Facilities' },
  { pattern: /\(continued\)/i, division: '13', target: 'Fabric Structures' },
  { pattern: /^\(\d{4}\)/, division: '13', target: 'Metal Building Systems' },
  { pattern: /^\d+-foot width$/i, division: '13', target: 'Metal Building Systems' },
  { pattern: /^\d+- to \d+-foot width$/i, division: '13', target: 'Metal Building Systems' },
];

/**
 * @param {string} division
 * @param {string} category
 * @returns {string | null}
 */
function resolveCategory(division, category) {
  const divMap = EXACT_MAP[division];
  if (divMap?.[category]) {
    return divMap[category];
  }

  for (const rule of REGEX_FALLBACKS) {
    if (rule.division === division && rule.pattern.test(category)) {
      return rule.target;
    }
  }

  return null;
}

function main() {
  const files = readdirSync(APPROVED_DIR).filter((name) => name.endsWith('.approved.json'));
  let totalChanged = 0;
  /** @type {Record<string, number>} */
  const changedByDiv = {};
  /** @type {Map<string, { division: string; count: number }>} */
  const unmapped = new Map();
  const filesWritten = [];

  for (const file of files) {
    const filePath = join(APPROVED_DIR, file);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    let fileChanged = 0;

    for (const record of data.records) {
      const division = record.division || record.divisionCode;
      const current = record.category;
      if (!division || !current) continue;

      const resolved = resolveCategory(division, current);
      if (resolved && resolved !== current) {
        record.category = resolved;
        fileChanged++;
        totalChanged++;
        changedByDiv[division] = (changedByDiv[division] || 0) + 1;
      } else if (!resolved && EXACT_MAP[division] && !Object.values(EXACT_MAP[division]).includes(current)) {
        const key = `${division}::${current}`;
        const existing = unmapped.get(key) || { division, count: 0 };
        existing.count++;
        unmapped.set(key, existing);
      }
    }

    if (fileChanged > 0) {
      writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      filesWritten.push({ file, changed: fileChanged });
    }
  }

  console.log('=== Category Taxonomy Normalization ===\n');
  console.log(`Total records changed: ${totalChanged}`);
  console.log('\nChanged by division:');
  for (const [div, count] of Object.entries(changedByDiv).sort()) {
    console.log(`  Div ${div}: ${count}`);
  }

  console.log('\nFiles written:');
  for (const { file, changed } of filesWritten) {
    console.log(`  ${file}: ${changed} records`);
  }

  if (unmapped.size > 0) {
    console.log('\n⚠ Unmapped categories (no change applied):');
    for (const [key, { division, count }] of [...unmapped.entries()].sort()) {
      const cat = key.split('::').slice(1).join('::');
      console.log(`  Div ${division} (${count}): ${cat}`);
    }
    process.exitCode = 1;
  } else {
    console.log('\n✓ All categories mapped successfully.');
  }
}

main();
