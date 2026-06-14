export interface ProjectScopeTemplate {
  id: string;
  label: string;
  category: string;
  description: string;
  scopeText: string;
}

export const PROJECT_SCOPE_TEMPLATES: readonly ProjectScopeTemplate[] = [
  // ─── Residential ────────────────────────────────────────────────────────────
  {
    id: 'res-wood-frame-house',
    label: 'New Single-Family Wood-Frame House',
    category: 'Residential',
    description: 'Full construction of a new wood-frame residence on a prepared lot',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall furnish all labor, materials, equipment, tools, supervision, and services necessary to construct a new single-family wood-frame residence on the prepared lot, including foundation, framing, exterior sheathing and wrap, roofing, windows and exterior doors, mechanical rough-ins, insulation, drywall, interior trim, painting, and site cleanup.

INCLUSIONS:
- Perimeter footings and slab-on-grade or crawlspace foundation per plans
- Pressure-treated sill plates and anchor bolts
- Exterior wall framing (2×6 @ 16″ o.c.) including headers and shear panels
- Roof framing — trusses or stick-framed per plans
- OSB roof sheathing, underlayment, and asphalt shingle roofing
- Exterior OSB wall sheathing and house wrap
- Windows and exterior doors (owner allowance)
- Rough mechanical — electrical, plumbing, HVAC per licensed subs
- R-21 wall and R-49 attic insulation (or per energy code)
- 5/8″ drywall, tape, texture, and paint (2 coats)
- Interior doors, trim, and hardware (owner allowance)
- Site cleanup and haul-off of construction debris

EXCLUSIONS:
- Permits and fees unless specifically included
- Site grading and excavation beyond standard footprint cut
- Landscaping, fencing, and hardscape
- Appliances and finish hardware above allowance
- Solar or specialty systems
- Detached structures

ASSUMPTIONS:
- Permit-ready plans provided by owner before mobilization
- Site is cleared, rough-graded, and accessible to delivery trucks
- Utility stubs (water, sewer, gas, electric) are at or near the building pad
- Owner selections (windows, doors, fixtures, finishes) confirmed before framing
- Normal 7 AM–5 PM work hours, Monday–Friday

KNOWN QUANTITIES:
- Living area: _____ SF
- Garage: _____ SF
- Slab/foundation: _____ SF @ _____ in. thick
- Exterior walls: _____ LF
- Roof area: _____ SQ
- Drywall: _____ SF

SPECIAL CONDITIONS:
- HOA or municipal inspections — coordinate with owner
- Adjacent lot proximity — confirm setbacks before layout
- Tight access sites may require smaller equipment

ESTIMATING NOTES:
- Division 03: Foundation and slab
- Division 06: Wood framing, sheathing, and exterior trim
- Division 07: Insulation, house wrap, and roofing
- Division 08: Windows and exterior doors
- Division 09: Drywall, paint, and interior finishes
- Division 22/23/26: Mechanical subs (labor only if self-perform)
- Missing quantities: slab SF, wall LF, roof SQ, window count, door count`,
  },
  {
    id: 'res-addition',
    label: 'Residential Addition',
    category: 'Residential',
    description: 'New addition attached to an existing residence',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a new addition to the existing residence as shown on the approved plans, including new footings and foundation, wood framing, roofing tied into the existing structure, exterior finish to match, all interior finishes, and connection of mechanical systems to the existing home.

INCLUSIONS:
- Demo of existing exterior wall(s) at connection point
- New continuous spread footings and stem wall or slab foundation
- Wood-frame walls and roof structure tied to existing framing
- Roofing system matched to existing (shingles, underlayment, flashing)
- Exterior siding, trim, and paint to match existing
- Insulation per current energy code
- Drywall, texture, and paint throughout addition
- Electrical, plumbing, and HVAC extension from existing systems
- Windows and exterior doors per plans
- Interior trim, doors, and hardware to match existing

EXCLUSIONS:
- Structural upgrades to existing portions of home not required by code
- Whole-house rewire, replumb, or HVAC replacement
- Landscaping or site restoration beyond building footprint
- Furniture, appliances, or owner-supplied fixtures beyond scope
- Permits and fees unless specifically included

ASSUMPTIONS:
- Engineered plans approved and permit issued before mobilization
- Existing framing is sound and does not require sistering or replacement
- Owner will be occupying home during construction; access schedule TBD
- Utility disconnects/reconnects coordinated with owner

KNOWN QUANTITIES:
- Addition footprint: _____ SF
- New foundation: _____ LF or _____ SF slab
- New roof area: _____ SQ
- New exterior wall area: _____ SF
- New drywall: _____ SF

SPECIAL CONDITIONS:
- Occupied home — maintain weather-tight envelope at all times
- Dust and noise mitigation required during occupied hours
- Temporary hoarding/plastic barrier between addition and living space

ESTIMATING NOTES:
- Division 02: Selective demolition of existing exterior wall
- Division 03: New footings and foundation
- Division 06: New framing and roof structure
- Division 07: Roofing tie-in, insulation, house wrap
- Division 09: Drywall and interior finishes
- Division 26/22/23: Electrical, plumbing, HVAC extensions
- Missing quantities: addition SF, foundation LF, roof SQ`,
  },
  {
    id: 'res-renovation',
    label: 'Whole-Home Renovation / Remodel',
    category: 'Residential',
    description: 'Full interior renovation of an existing residence',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform a whole-home interior renovation including selective demolition, structural modifications as required, updated mechanical systems, new insulation where accessible, drywall repair or replacement, kitchen and bathroom upgrades, flooring, painting, trim, and final site cleanup.

INCLUSIONS:
- Selective interior demolition of finishes per plans
- Structural modifications (beam, header, wall removal) per engineer's stamp
- Electrical panel upgrade or extension and device replacement
- Plumbing rough-in and fixture replacement
- HVAC ductwork modification and equipment replacement as required
- Insulation upgrade where walls and ceilings are open
- New drywall, tape, texture, and paint throughout
- Kitchen cabinetry and countertops (owner allowance)
- Bathroom tile, fixtures, vanities (owner allowance)
- New flooring throughout (owner selection)
- Interior trim and doors replaced to match design intent

EXCLUSIONS:
- Foundation or exterior structural work
- Roofing, exterior siding, or window replacement unless noted in plans
- Landscaping, fencing, or hardscape
- Items specifically noted as owner-furnished
- Asbestos, lead, or mold remediation unless included as a separate line item

ASSUMPTIONS:
- Home is vacated during construction
- Owner selections submitted and approved before rough-in begins
- Existing structural framing is sound absent the items listed in plans
- Hazardous material testing completed by owner before demo

KNOWN QUANTITIES:
- Total home SF: _____
- Kitchen SF: _____
- Bath count: _____
- Drywall replacement: _____ SF
- Flooring: _____ SF

SPECIAL CONDITIONS:
- Rolling phase schedule if owner returns during project
- Coordinate with HOA for dumpster placement and work hours
- All demo debris separated for disposal/recycling per local ordinance

ESTIMATING NOTES:
- Division 02: Demo and selective removal
- Division 06: Structural modifications and blocking
- Division 09: Drywall, flooring, tile, paint
- Division 10/12: Cabinetry and specialties (allowance basis)
- Division 22/23/26: MEP rough-in and trim
- Missing quantities: SF by room, fixture count, cabinet LF, flooring SF`,
  },
  {
    id: 'res-garage-shop',
    label: 'Residential Garage / Workshop',
    category: 'Residential',
    description: 'Detached or attached residential garage or shop building',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall furnish all labor, materials, equipment, and services to construct a new detached or attached garage/workshop, including footings and slab, wood-frame or post-frame structure, overhead doors, service door, roofing, electrical service and interior lighting, and site cleanup.

INCLUSIONS:
- Continuous perimeter footings and reinforced slab-on-grade
- Pressure-treated sill plates and anchor system
- Wood stud or post-frame exterior wall construction
- Roof trusses, sheathing, underlayment, and asphalt shingle roofing
- Overhead garage door(s) with opener(s)
- Exterior service door
- Exterior siding and trim to match or complement home
- Electrical subpanel, branch circuits, and interior LED shop lighting
- Exterior GFI outlet(s)

EXCLUSIONS:
- HVAC unless specifically included
- Plumbing rough-in unless specifically included
- Interior finish (drywall, paint) unless specifically included
- Epoxy floor coating or specialty floor unless specifically included
- Landscaping and site restoration beyond building pad

ASSUMPTIONS:
- Site graded and accessible before mobilization
- Owner to obtain permits; contractor to pull sub-permits as required
- Utility stub (electric) available within _____ ft of new structure
- HOA approval obtained before construction

KNOWN QUANTITIES:
- Footprint: _____ SF (_____ W × _____ D)
- Slab: _____ SF @ _____ in. thick, _____ PSI mix
- Overhead door openings: _____ qty (_____ W × _____ H each)
- Roof area: _____ SQ

SPECIAL CONDITIONS:
- Overhead utility lines — confirm clearances before erection
- Shared driveway/easement — verify no encroachment before layout

ESTIMATING NOTES:
- Division 03: Footings and slab
- Division 06: Framing, sheathing, and roofing
- Division 08: Overhead doors and service door
- Division 26: Electrical subpanel and wiring
- Missing quantities: slab SF, door count/size, electrical circuits`,
  },
  {
    id: 'res-concrete-driveway',
    label: 'Concrete Driveway & Approach',
    category: 'Residential',
    description: 'Residential concrete driveway, apron, and approach work',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall remove the existing driveway surface (if applicable), prepare the subgrade, install aggregate base, form, and place a new concrete driveway and apron per the approved plan, including all curing, sealing, and cleanup.

INCLUSIONS:
- Removal and disposal of existing asphalt or concrete driveway
- Subgrade cut or fill to establish grade
- Compacted crushed aggregate base (_____ in. depth)
- Concrete forms, pour, and finish — broom finish standard
- Concrete mix: _____ PSI, air-entrained per local climate requirements
- Control joints at _____ ft intervals
- Curing compound applied immediately after finish
- Concrete sealer (_____ coats) applied after cure
- Site cleanup and haul-off of debris

EXCLUSIONS:
- Decorative stamped or colored concrete unless specifically included
- Curb cuts requiring municipal ROW permit
- Landscaping restoration beyond edge of work
- Garage approach or apron beyond _____ ft from structure

ASSUMPTIONS:
- Owner obtains encroachment/ROW permit if work extends to public street
- Existing underground irrigation and utilities marked before excavation
- Suitable soil bearing; no soft spots requiring over-excavation

KNOWN QUANTITIES:
- Driveway area: _____ SF
- Slab thickness: _____ in.
- Concrete volume: _____ CY
- Base depth: _____ in. over _____ SF

SPECIAL CONDITIONS:
- Maintain access to garage for 48–72 hours minimum cure before traffic
- Wet weather contingency — concrete placement requires forecast dry window

ESTIMATING NOTES:
- Division 02: Demo and haul-off of existing surface
- Division 03: Concrete, forms, base, and curing
- Missing quantities: total SF, thickness, CY volume, base aggregate depth`,
  },
  {
    id: 'res-foundation-slab',
    label: 'Residential Foundation / Slab',
    category: 'Residential',
    description: 'Perimeter footings and slab-on-grade for a new residence',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform all earthwork, forming, reinforcing, and concrete placement to construct the perimeter footings and slab-on-grade foundation for a new single-family residence per the engineered foundation plan.

INCLUSIONS:
- Stake-out and excavation of perimeter footing trench to bearing depth
- Compacted crushed stone or sand sub-base under slab
- Vapor barrier (10-mil poly minimum)
- Perimeter footing forms, rebar per engineer, and concrete pour
- Slab forming, re-mesh or rebar per engineer, and pour
- Slab finish: broom finish for covered areas, smooth trowel for garage
- Anchor bolts or sill plate hardware embedded per plan
- Curing blanket or compound per spec
- Form stripping and cleanup

EXCLUSIONS:
- Rough plumbing under-slab unless specifically included
- Radon mitigation piping unless specifically included
- Deep foundations (piers, pilings) unless required by soils report
- Structural fill or import soil beyond standard grading

ASSUMPTIONS:
- Engineered foundation plan stamped and approved before mobilization
- Soils report confirms bearing capacity at footing depth
- Lot is rough-graded; no significant rock or groundwater
- Rough plumbing stubs by others before slab pour if required

KNOWN QUANTITIES:
- Slab area: _____ SF
- Slab thickness: _____ in.
- Footing depth: _____ in. below grade
- Footing size: _____ W × _____ D
- Concrete volume: _____ CY

SPECIAL CONDITIONS:
- Winter pour — cold-weather concrete protection plan required if temps below 40°F
- Coordinate slab pour date with plumbing sub for rough-in inspection

ESTIMATING NOTES:
- Division 03: All concrete and forming
- Division 31: Excavation and compaction
- Missing quantities: slab SF, footing LF and size, CY volume, rebar lbs`,
  },
  {
    id: 'res-deck-porch',
    label: 'Deck / Covered Porch',
    category: 'Residential',
    description: 'Wood or composite deck or covered porch attached to residence',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a new attached deck or covered porch, including footing installation, pressure-treated framing, decking surface, railing system, and stairway as shown on the approved plan.

INCLUSIONS:
- Drilled concrete piers or spread footings per plan
- Pressure-treated (PT) ledger board with flashing and lag bolts into rim
- PT beam and joist framing at _____ in. o.c.
- Decking surface: composite (owner allowance) or 5/4 PT
- Code-compliant guard and handrail system (42″ residential)
- Stair stringer, treads, and handrail to grade
- Flashing at all ledger and post base connections
- Stainless or hot-dipped galvanized hardware throughout

EXCLUSIONS:
- Pergola or overhead shade structure unless specifically included
- Screened enclosure unless specifically included
- Electrical outlets or lighting unless specifically included
- Landscaping or site restoration beyond deck perimeter

ASSUMPTIONS:
- Existing ledger attachment point is sound — contractor to verify before framing
- Permit-ready plans or approved site plan provided by owner
- Grade under deck does not require significant excavation or retaining

KNOWN QUANTITIES:
- Deck area: _____ SF
- Joist span: _____ ft
- Pier count: _____
- Stair runs: _____ flights
- Railing LF: _____

SPECIAL CONDITIONS:
- Ledger attachment inspection required before decking begins
- Final inspection required before use — do not occupy until final

ESTIMATING NOTES:
- Division 03: Concrete piers or spread footings
- Division 06: PT framing, decking, and railing
- Missing quantities: deck SF, pier count, railing LF, stair count`,
  },

  // ─── Masonry & Concrete ─────────────────────────────────────────────────────
  {
    id: 'mas-cmu-building',
    label: 'CMU Block Building Shell',
    category: 'Masonry & Concrete',
    description: 'Concrete masonry unit structural shell for commercial/industrial use',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall furnish all labor, materials, equipment, and supervision to construct a concrete masonry unit (CMU) building shell, including footings, reinforced block walls, bond beams, pilasters, lintels, and roof bearing ledgers, complete per the structural drawings and specifications.

INCLUSIONS:
- Concrete perimeter footings with dowels per structural plan
- Standard weight CMU block wall (_____ in. nominal) — fully grouted cells per engineer
- Horizontal and vertical rebar per structural engineer's schedule
- Bond beams at _____ ft intervals and at all openings
- CMU pilasters and columns per plan
- Precast or formed concrete lintels at all door and window openings
- Roof bearing ledger or bond beam at top of wall
- Control joints at _____ ft intervals per masonry spec
- Parapet construction to height per plans
- Clean-down wash of exposed CMU faces

EXCLUSIONS:
- Roof structure, roofing, or deck unless specifically included
- Interior CMU partition walls unless specifically included
- Exterior stucco, paint, or coating system unless specifically included
- EIFS or other cladding over CMU
- Mechanical, electrical, and plumbing

ASSUMPTIONS:
- Structural drawings stamped and approved before mobilization
- Footing inspection approved before first course of block
- Concrete delivery accessible to all wall lines
- Grout and rebar inspections coordinated with special inspector

KNOWN QUANTITIES:
- CMU wall area: _____ SF
- Block courses: _____ (_____ ft height)
- Footings: _____ LF
- Door openings: _____ qty
- Window openings: _____ qty

SPECIAL CONDITIONS:
- Special inspection required — masonry per IBC Chapter 17
- Hot or cold weather masonry protection plan required if temps exceed range
- Grout pour lifts not to exceed 5 ft without cleanout or intermediate inspection

ESTIMATING NOTES:
- Division 03: Footings and any CIP concrete elements
- Division 04: CMU block, mortar, grout, rebar, accessories
- Missing quantities: wall SF, block courses, footing LF, opening count`,
  },
  {
    id: 'mas-cip-concrete',
    label: 'Cast-in-Place Concrete Structure',
    category: 'Masonry & Concrete',
    description: 'CIP concrete walls, columns, and elevated decks',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform all forming, reinforcing, placing, finishing, and curing of a cast-in-place (CIP) concrete structure including walls, columns, and elevated slabs or decks as shown on the structural drawings.

INCLUSIONS:
- Forming system — gang forms, conventional lumber, or proprietary system
- Rebar fabrication and placement per structural engineer's schedule
- Concrete placement (pump or crane bucket) and vibration
- Concrete mix design per structural specifications
- Wall and column forms stripped after minimum cure per ACI 347
- Elevated slab forming (shore and re-shore per engineer)
- Slab finish as specified (broom, trowel, or textured)
- Curing and sealing per specification
- Form hardware removal and surface patch

EXCLUSIONS:
- Concrete testing and special inspection (by owner's testing lab)
- Post-tensioning unless specifically included
- Architectural exposed concrete (AEC) finishes above standard formwork
- Waterproofing or below-grade membrane unless specifically included

ASSUMPTIONS:
- Structural drawings approved and RFIs resolved before mobilization
- Concrete testing and special inspection arranged by owner
- Mix design submitted and approved 2 weeks before first placement
- No rock or groundwater issues below footing elevation

KNOWN QUANTITIES:
- Wall area: _____ SF (_____ in. thick)
- Column count: _____ @ _____ in. dia. or _____ × _____ in.
- Elevated slab: _____ SF @ _____ in. thick
- Concrete volume: _____ CY total
- Rebar: _____ tons estimated

SPECIAL CONDITIONS:
- Pour sequence schedule required for walls over 20 ft tall
- Re-shoring plan required for elevated decks above occupied space
- Freeze protection plan required if ambient temps below 40°F during cure

ESTIMATING NOTES:
- Division 03: All CIP concrete, forming, rebar, accessories
- Missing quantities: wall SF/thickness, slab SF/thickness, column count, CY volume`,
  },
  {
    id: 'mas-slab-on-grade',
    label: 'Slab-on-Grade (Commercial / Industrial)',
    category: 'Masonry & Concrete',
    description: 'Reinforced industrial or commercial slab-on-grade with spec finish',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall place a reinforced slab-on-grade for commercial or industrial use, including subgrade preparation, aggregate base, vapor barrier, reinforcement, concrete placement, and specified flatwork finish and curing, ready for owner's floor treatment or direct occupancy.

INCLUSIONS:
- Subgrade proof-roll and recompaction as required
- Crushed aggregate base (_____ in. compacted)
- 10-mil poly vapor retarder with lapped and taped joints
- Rebar or fiber reinforcement per structural plan
- Concrete placement by pump: _____ PSI mix, w/c ≤ _____
- Laser screed or strike-off to specified F-number (Ff/Fl _____)
- Power trowel finish — burnished or medium per spec
- Saw-cut control joints within 24 hours of placement
- Curing compound — ASTM C309 Type 2
- Edge isolation joints at columns and walls

EXCLUSIONS:
- Sub-slab drainage, vapor barrier system upgrades, or under-slab fill
- Specialty floor treatments (epoxy, polished, sealed) unless specifically included
- Post-tensioning unless specifically included
- Slab thickening or turn-downs at dock doors unless shown on plan

ASSUMPTIONS:
- Subgrade compaction testing by owner's geotechnical firm before pour
- Mix design submitted and approved before placement
- Flatwork flatness (F-number) tolerance agreed before mobilization
- Climate conditions acceptable for pour — no rain in forecast window

KNOWN QUANTITIES:
- Slab area: _____ SF
- Slab thickness: _____ in.
- Concrete volume: _____ CY
- Base depth: _____ in.
- Control joint spacing: _____ ft grid

SPECIAL CONDITIONS:
- Large slab — coordinate pour sequence and day-of logistics with plant
- F-number survey immediately after first 72 hours per ASTM E1155
- Joint filler/sealant by others after 90-day cure

ESTIMATING NOTES:
- Division 03: Slab, base, reinforcement, forming
- Division 31: Subgrade excavation and compaction
- Missing quantities: SF, thickness, CY, base depth, F-number requirement`,
  },
  {
    id: 'mas-footings-foundation',
    label: 'Footings & Foundation Walls',
    category: 'Masonry & Concrete',
    description: 'Spread footings and CIP or CMU foundation walls',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall excavate, form, reinforce, and place concrete spread footings and foundation walls (cast-in-place or CMU) per the structural plans, including damp-proofing, drainage, and backfill as required.

INCLUSIONS:
- Excavation to bearing depth per geotechnical report
- Spread footing forming, rebar, and concrete placement
- Foundation wall — CIP forming and placement or reinforced CMU per plan
- Horizontal and vertical rebar per structural engineer's schedule
- Key joint between footing and wall
- Damp-proofing (bituminous coating) on exterior of foundation wall below grade
- Perimeter drain tile at footing level and gravel envelope
- Structural backfill in compacted lifts after walls reach design strength
- Form hardware removal and surface prep

EXCLUSIONS:
- Full waterproofing membrane (above damp-proofing) unless specifically included
- Insulation of foundation wall unless specifically included
- Interior drainage mat, sump pit, or basement drainage system
- Concrete testing and special inspection (owner's testing lab)

ASSUMPTIONS:
- Soils report confirms bearing capacity at design footing depth
- No significant rock, soft spots, or groundwater encountered
- Footing inspection passed before wall placement
- Owner's special inspector onsite for all pours

KNOWN QUANTITIES:
- Footing LF: _____ @ _____ W × _____ D
- Foundation wall: _____ SF (_____ H × _____ LF)
- Concrete volume: _____ CY
- Excavation depth: _____ ft

SPECIAL CONDITIONS:
- Shoring required if excavation depth exceeds OSHA slope requirements
- Dewatering plan required if groundwater encountered
- Backfill not permitted until wall reaches 75% design strength

ESTIMATING NOTES:
- Division 03: Footings, foundation walls, concrete
- Division 31: Excavation, backfill, compaction
- Missing quantities: footing LF and size, wall SF, CY volume`,
  },
  {
    id: 'mas-retaining-wall',
    label: 'Retaining Wall',
    category: 'Masonry & Concrete',
    description: 'Reinforced concrete or CMU retaining wall with drainage',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a reinforced retaining wall (cast-in-place concrete or CMU as specified) including footing, stem wall, drainage aggregate, and backfill, designed to retain the indicated grade change per the structural and geotechnical requirements.

INCLUSIONS:
- Excavation to footing depth including any over-excavation for drainage
- Footing forming, rebar, and concrete placement
- Stem wall — CIP forms and concrete or reinforced CMU per structural plan
- Rebar per engineer's schedule — horizontal and vertical dowels
- Bond beams at top of CMU walls
- Filter fabric and crushed gravel drainage blanket behind wall
- Weep holes or perforated drain pipe at footing level
- Backfill in compacted lifts not to exceed 12 in.
- Cap block, coping stone, or concrete cap at wall top

EXCLUSIONS:
- Geotechnical engineering and testing (by owner)
- Decorative stone veneer over wall unless specifically included
- Fencing or railing on top of wall unless specifically included
- Landscaping above retained grade

ASSUMPTIONS:
- Engineered wall drawings stamped and approved before mobilization
- Soils report confirms bearing capacity and Rankine/Coulomb parameters
- Retained grade material is clean structural fill or existing soil
- Special inspection provided by owner's testing lab

KNOWN QUANTITIES:
- Wall length: _____ LF
- Retained height: _____ ft (max)
- Footing width: _____ in. × _____ in. deep
- Concrete volume: _____ CY
- Drain aggregate: _____ CY

SPECIAL CONDITIONS:
- Wall height over 4 ft requires engineer's stamp and building permit in most jurisdictions
- Backfill not permitted until wall concrete reaches 75% design strength
- Surcharge loads (vehicles, structures) within H/2 of wall top — report to engineer

ESTIMATING NOTES:
- Division 03: Footing and CIP stem wall
- Division 04: CMU stem wall (if applicable)
- Division 31: Excavation, drainage, and backfill
- Missing quantities: LF, retained height, footing size, CY concrete and gravel`,
  },
  {
    id: 'mas-site-concrete',
    label: 'Site Concrete (Walks, Curbs, Pads)',
    category: 'Masonry & Concrete',
    description: 'Sidewalks, curbs, equipment pads, and miscellaneous flatwork',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall furnish and place miscellaneous site concrete including sidewalks, ADA-compliant ramps, curb and gutter, equipment pads, and other flatwork as shown on the site plan, including subgrade preparation and control joints.

INCLUSIONS:
- Subgrade excavation and compaction
- Crushed aggregate base per local standard
- Sidewalk: _____ in. concrete, broom finish, per ADA cross-slope requirements
- ADA ramps with truncated dome detectable warning surface
- Curb and gutter — APWA Type _____ or per plan
- Equipment pads: _____ PSI, _____ in. thick with anchor bolts per mfr.
- Control joints at _____ ft intervals on walks and pads
- Edge forms stripped and back-of-curb backfill completed

EXCLUSIONS:
- Asphalt paving adjacent to curb (by paving sub)
- Landscaping or irrigation adjacent to walks
- Utility valve boxes or manholes adjustments
- Concrete sealing unless specifically included

ASSUMPTIONS:
- Site graded and base material approved by owner's testing lab before pour
- Utility conflicts resolved and underground utilities marked
- ADA ramp design approved by owner before forming

KNOWN QUANTITIES:
- Sidewalk: _____ SF @ _____ in. thick
- ADA ramps: _____ qty
- Curb and gutter: _____ LF
- Equipment pads: _____ qty (_____ SF each)
- Concrete volume: _____ CY total

SPECIAL CONDITIONS:
- ROW work requires traffic control plan and encroachment permit
- Wet weather window — verify forecast before scheduled pours

ESTIMATING NOTES:
- Division 03: All site concrete flatwork
- Division 31: Subgrade and base preparation
- Missing quantities: walk SF, curb LF, pad sizes, CY total`,
  },

  // ─── Metal & Pre-Engineered ──────────────────────────────────────────────────
  {
    id: 'metal-pemb',
    label: 'Pre-Engineered Metal Building (PEMB)',
    category: 'Metal & Pre-Engineered',
    description: 'Pre-engineered metal building supply and erection on a prepared slab',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall supply, deliver, and erect a pre-engineered metal building (PEMB) as specified, including all primary and secondary steel framing, roof and wall panels, doors, trim, and accessories on the owner-provided slab foundation. Building is designed and certified by the manufacturer's engineer of record.

INCLUSIONS:
- PEMB package — primary rigid frames, columns, and rafters
- Secondary framing — purlins, girts, and eave struts
- Roof panels: _____ gauge PBR or standing seam, _____ color
- Wall panels: _____ gauge, _____ color
- Ridge cap, eave trim, corner trim, base angle, and flashing
- Framed openings for doors and windows per plan
- Walk doors (_____ qty) and overhead doors (_____ qty)
- Skylight panels or translucent panels at roof (if included)
- Gutters and downspouts
- Anchor bolt setting by contractor per PEMB engineer's plan

EXCLUSIONS:
- Concrete slab and foundation (by owner or separate contract)
- Mechanical, electrical, and plumbing
- Interior liner panels or insulation system unless specifically included
- Interior partition walls
- Permits — PEMB drawings submitted by contractor; permit fees by owner

ASSUMPTIONS:
- Slab is poured, cured, and anchor bolts set per PEMB manufacturer's template before erection
- Site is accessible for crane and steel delivery flatbeds
- PEMB manufacturer's drawings approved by local authority before mobilization
- Owner-approved color selections submitted before manufacturing release

KNOWN QUANTITIES:
- Building footprint: _____ W × _____ D ft
- Eave height: _____ ft
- Roof slope: _____ :12
- Bay spacing: _____ ft
- Door openings: _____ walk + _____ overhead

SPECIAL CONDITIONS:
- Crane set-up area required — clear staging zone minimum _____ ft from building
- Erection halted for winds over 25 mph
- Lightning protection coordination if owner requires system

ESTIMATING NOTES:
- Division 13: PEMB supply and erect
- Division 05: Anchor bolts and base plate leveling
- Division 08: Commercial doors
- Missing quantities: footprint, eave height, bay spacing, door count`,
  },
  {
    id: 'metal-warehouse',
    label: 'Metal Warehouse / Storage Building',
    category: 'Metal & Pre-Engineered',
    description: 'Metal frame or PEMB warehouse with dock doors and basic utilities',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a metal-frame or pre-engineered metal warehouse/storage building, including foundation, structural steel, roof and wall systems, dock and drive-through doors, and basic electrical service and lighting, ready for owner's storage or operational use.

INCLUSIONS:
- Concrete perimeter footings and reinforced slab-on-grade
- PEMB or structural steel frame per engineer's design
- Metal roof and wall panel system
- Insulated wall panels or liner system where required
- Overhead sectional dock door(s) with dock seals and bumpers
- Drive-in door(s) — overhead sectional or bi-fold per plan
- Walk doors at _____ qty locations
- Rain gutters and downspouts
- Electrical service panel, interior LED high-bay lighting, and exit/emergency lighting
- Site drainage swales or curbing at dock approach

EXCLUSIONS:
- Mezzanine or office buildout unless specifically included
- Sprinkler system unless specifically included
- HVAC beyond unit heater rough-in unless specifically included
- Dock levelers and dock equipment (by owner)
- Signage

ASSUMPTIONS:
- Civil site work and utilities to building by others or separate contract
- Soil bearing confirmed by geotechnical report
- Owner to furnish dock leveler equipment for contractor installation if required

KNOWN QUANTITIES:
- Building SF: _____ (_____ W × _____ D)
- Eave height: _____ ft
- Slab thickness: _____ in., _____ PSI
- Dock doors: _____ qty (_____ W × _____ H)
- Drive-in doors: _____ qty

SPECIAL CONDITIONS:
- Dock approach grades — verify 2% max slope for truck leveling
- Fire lane and egress access maintained throughout construction

ESTIMATING NOTES:
- Division 03: Slab and foundation
- Division 13: PEMB or Division 05: Structural steel
- Division 08: Overhead and walk doors
- Division 26: Electrical service and lighting
- Missing quantities: SF, eave height, slab thickness, door count`,
  },
  {
    id: 'metal-hangar',
    label: 'Aircraft Hangar',
    category: 'Metal & Pre-Engineered',
    description: 'Pre-engineered aircraft hangar with bi-fold or hydraulic door',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a pre-engineered aircraft hangar including foundation, PEMB structure with clear-span interior, bi-fold or hydraulic hangar door, aircraft-rated slab, and electrical service, ready for owner's aviation use and aircraft occupancy.

INCLUSIONS:
- Engineered concrete footings and aircraft-rated slab-on-grade (reinforced, joints sealed)
- PEMB clear-span rigid frame structure — eave height per FAA/owner requirement
- Metal roof and wall panels
- Bi-fold or hydraulic hangar door system — full opening width per plan
- Walk-through door(s) in hangar door panels or side walls
- Aircraft tie-down anchors (if requested)
- 200A+ electrical service, LED high-bay lighting, and 120V outlets
- Gutters, downspouts, and site drainage at apron edge

EXCLUSIONS:
- Apron concrete (airport authority jurisdiction) unless specifically included
- HVAC unless specifically included
- Fire suppression system unless required by local code
- Avionics, equipment, or owner's tenant improvements

ASSUMPTIONS:
- Airport Authority approval and building permit obtained before mobilization
- Hangar door manufacturer's shop drawings approved before fabrication
- Crane access available at site without obstructing taxiway operations
- Slab joint map submitted to owner for aircraft wheel load review

KNOWN QUANTITIES:
- Hangar footprint: _____ W × _____ D ft
- Door opening width: _____ ft, door height: _____ ft
- Clear height at ridge: _____ ft
- Slab area: _____ SF @ _____ in. thick
- Aircraft tie-downs: _____ qty

SPECIAL CONDITIONS:
- FAA notification (Form 7460) may be required for construction equipment height
- Coordinate construction with airport operations; no disruption to active taxiways
- Hangar door commissioning and load test required before acceptance

ESTIMATING NOTES:
- Division 03: Aircraft-rated slab and footings
- Division 13: PEMB and hangar door system
- Division 26: Electrical service, lighting
- Missing quantities: footprint, door width/height, slab SF, electrical load`,
  },
  {
    id: 'metal-canopy',
    label: 'Metal Canopy / Shade Structure',
    category: 'Metal & Pre-Engineered',
    description: 'Free-standing or attached metal canopy or shade structure',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall design and construct a metal canopy or shade structure, including drilled piers or spread footings, structural steel columns and beams, metal roof decking or standing seam panels, and all trim and drainage, as shown on the approved plan.

INCLUSIONS:
- Drilled concrete piers or spread footings per structural engineer
- Structural steel columns, beams, and purlins
- Metal roof panel — standing seam or PBR as specified
- Gutters, downspouts, and splash blocks as required
- Column base plates, anchor bolts, and grouting
- Primer paint or galvanized finish per specification
- Electrical conduit stub-out for future lighting (if required)

EXCLUSIONS:
- LED canopy lighting fixtures unless specifically included
- Electrical power and wiring unless specifically included
- Enclosed side panels or screens unless specifically included
- Foundation drainage or site grading

ASSUMPTIONS:
- Structural drawings stamped and approved before mobilization
- Existing pavement or slab has adequate sub-base for pier installation
- No underground utility conflicts at pier locations (USA markings confirmed)

KNOWN QUANTITIES:
- Canopy area: _____ SF (_____ W × _____ D)
- Column count: _____
- Eave height: _____ ft
- Pier diameter: _____ in., depth: _____ ft

SPECIAL CONDITIONS:
- Core drilling or vacuum excavation required if piers are in existing paving
- Wind and seismic design per local building code — submit calculations with permit

ESTIMATING NOTES:
- Division 03: Piers and anchor bolts
- Division 05: Structural steel frame
- Division 07: Roof panels, gutters, and trim
- Missing quantities: canopy SF, column count, pier size and depth`,
  },
  {
    id: 'metal-pemb-office',
    label: 'PEMB with Office Buildout',
    category: 'Metal & Pre-Engineered',
    description: 'Pre-engineered metal building with integrated climate-controlled office',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall supply and erect a pre-engineered metal building and complete the interior office portion, including insulated liner walls, drywall partitions, drop ceiling, flooring, HVAC, electrical, plumbing, and full finish work, delivering a climate-controlled office ready for occupancy alongside the open shop or warehouse area.

INCLUSIONS:
- Full PEMB supply and erection (see metal-pemb scope)
- Office area demising wall — insulated metal liner or stud framing to roof
- Interior stud partition walls per floor plan
- Batt insulation in office walls and ceiling
- 5/8″ drywall, tape, texture, and paint
- Suspended acoustical ceiling tile grid and tiles
- Commercial carpet or LVT flooring in office area
- Mini-split HVAC or ducted system for office zone
- Restroom rough-in and fixtures (_____ restrooms)
- 200A office electrical subpanel, lighting, and outlets
- Office exterior entry door with hardware and closer

EXCLUSIONS:
- Furniture, millwork, or casework unless specifically included
- Data/IT cabling (Cat6, fiber) unless specifically included
- Security system or access control
- Signage

ASSUMPTIONS:
- Floor plan finalized and approved before framing office partitions
- Plumbing stub-in location confirmed with mechanical engineer before slab pour
- Office HVAC sized for standard office occupancy load

KNOWN QUANTITIES:
- Office footprint: _____ SF
- Shop/warehouse footprint: _____ SF
- Total building: _____ SF
- Restrooms: _____ qty
- Office ceiling height: _____ ft

SPECIAL CONDITIONS:
- Phase 1: PEMB erection; Phase 2: Office buildout — sequence per schedule
- Occupied office during Phase 2 if phasing required

ESTIMATING NOTES:
- Division 03: Slab and foundation
- Division 09: Office drywall, ceiling, flooring, paint
- Division 13: PEMB erection
- Division 22/23/26: MEP for office zone
- Missing quantities: office SF, shop SF, restroom count, ceiling height`,
  },

  // ─── Commercial ─────────────────────────────────────────────────────────────
  {
    id: 'com-office-buildout',
    label: 'Commercial Office Buildout',
    category: 'Commercial',
    description: 'Interior office buildout in an existing commercial shell or TI',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall complete the interior office buildout within the tenant's demised premises, including demising wall improvements, interior partition walls, suspended acoustical ceiling, HVAC distribution, electrical, data conduit, plumbing (if applicable), flooring, and all finish work per the construction documents.

INCLUSIONS:
- Demising wall framing and drywall per lease plan
- Interior partition wall framing and 5/8″ drywall, to deck above or to ACT height
- Suspended acoustical ceiling grid and tiles (2×4 or 2×2 per plan)
- HVAC branch ductwork, diffusers, and thermostats for office zones
- Electrical panel circuits, outlets, switches, and LED lighting
- Data/communications conduit and pull string (wiring by owner's IT)
- Restroom buildout per ADA if included in TI scope
- Commercial carpet or LVP flooring throughout
- Interior doors — hollow metal frame and solid-core door with hardware
- Storefront or suite entry door per landlord standard

EXCLUSIONS:
- Main HVAC mechanical equipment beyond air handlers/VAV boxes
- Main electrical service panel (landlord's responsibility)
- Furniture, audio/visual, or security systems
- Millwork and cabinetry beyond break room counter unless specifically included

ASSUMPTIONS:
- Shell is fully enclosed with working HVAC main, electrical main, and plumbing mains
- Landlord work completed and punch list cleared before tenant contractor begins
- Owner's architect/space planner provides construction documents before mobilization
- After-hours work not required unless schedule demands

KNOWN QUANTITIES:
- Tenant SF: _____
- Partition walls: _____ LF
- Offices/rooms: _____ qty
- Restrooms: _____ qty
- Ceiling type: _____

SPECIAL CONDITIONS:
- Building management system coordination required for HVAC integration
- Elevator and loading dock scheduling for material deliveries
- Fire alarm tie-in requires building fire alarm contractor

ESTIMATING NOTES:
- Division 09: Drywall, ceiling, flooring, paint
- Division 10: Signage, specialties
- Division 22/23/26: MEP for tenant zone
- Missing quantities: tenant SF, partition LF, room count, restroom count`,
  },
  {
    id: 'com-retail-ti',
    label: 'Retail Tenant Improvement',
    category: 'Commercial',
    description: 'Retail store buildout or renovation in a shopping center shell',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall complete the retail tenant improvement within the demised premises including storefront, sales floor buildout, back-of-house finishes, lighting, HVAC, electrical, plumbing, and all finishes per the tenant's prototype standards and construction documents.

INCLUSIONS:
- Storefront glazing, framing, and entry doors per landlord criteria
- Demising wall improvements and tenant's interior partition walls
- Sales floor slab patch/repair and LVT or polished concrete flooring
- Drop or open web steel joist/deck exposed ceiling per retail standard
- LED track and accent lighting per tenant prototype plan
- HVAC distribution — ductwork, grilles, and thermostats
- Electrical panel circuits and convenience outlets for display fixtures
- Back-of-house partition walls, drywall, and paint
- Break room or employee restroom if required by tenant

EXCLUSIONS:
- Tenant's merchandise fixtures, shelving, and display units
- Signage beyond interior directional
- POS and technology systems
- Exterior signage (landlord permit)

ASSUMPTIONS:
- Prototype drawings issued to contractor before mobilization
- Landlord allowance (TI dollars) confirmed in lease before start
- Tenant prototype standards approved — no design changes after permit submittal
- Store opening date drives schedule — no float

KNOWN QUANTITIES:
- Retail SF: _____
- Back-of-house SF: _____
- Storefront: _____ LF
- Lighting circuits: _____ qty
- Restrooms: _____ qty

SPECIAL CONDITIONS:
- Mall or shopping center hours restrictions — night/weekend work for noisy operations
- Coordinate with center management for all utility tie-ins and shutoffs
- Grand opening deadline — liquidated damage clause may apply

ESTIMATING NOTES:
- Division 08: Storefront and entry doors
- Division 09: Flooring, drywall, paint, ceiling
- Division 26: Lighting and electrical
- Missing quantities: total SF, storefront LF, lighting fixture count, electrical panel size`,
  },
  {
    id: 'com-restaurant-ti',
    label: 'Restaurant Tenant Improvement',
    category: 'Commercial',
    description: 'Full restaurant buildout including kitchen hood, grease trap, and dining area',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform a complete restaurant tenant improvement including kitchen buildout (hood, grease trap, make-up air, walk-in cooler rough-in), dining room finishes, bar area (if applicable), restrooms, HVAC, plumbing, electrical, and all finishes per the construction documents and Health Department requirements.

INCLUSIONS:
- Kitchen hood — Type I UL-listed hood with exhaust and make-up air unit
- Grease interceptor (in-ground or in-line per AHJ)
- Kitchen plumbing — prep sinks, floor drains, hand sinks per Health Dept. plan
- Walk-in cooler/freezer curb and rough-in utilities (units by owner)
- Kitchen electrical — 3-phase service drops to equipment per schedule
- Quarry tile or sealed concrete kitchen floor and base
- Dining room — LVT, polished concrete, or tile flooring per design
- Acoustic wall panels, drywall, and paint in dining room
- Bar top, back bar rough-in (millwork by owner)
- Restrooms — full ADA-compliant buildout
- HVAC — separate kitchen exhaust zone and dining HVAC zones

EXCLUSIONS:
- Kitchen equipment (owner-supplied and owner-installed unless noted)
- Millwork, custom cabinetry, and signage unless specifically included
- Exterior patio or drive-through
- POS, AV, and technology systems

ASSUMPTIONS:
- Health Department pre-application meeting completed before final design
- Utility capacities (gas, electric, water, sewer) confirmed by landlord before lease execution
- All equipment submittals from owner received before kitchen rough-in begins
- Occupancy group A-2 permit obtained before mobilization

KNOWN QUANTITIES:
- Dining SF: _____
- Kitchen SF: _____
- Bar SF: _____
- Restrooms: _____ qty
- Hood length: _____ ft

SPECIAL CONDITIONS:
- Fire suppression system in kitchen hood requires coordination with fire authority
- Health Department inspection milestone before equipment rough-in
- Grease interceptor sizing by plumbing engineer per projected GPH load

ESTIMATING NOTES:
- Division 09: Dining finishes, flooring, tile
- Division 10/11: Kitchen hood and equipment rough-in
- Division 22: Plumbing, grease trap, floor drains
- Division 23: HVAC, make-up air, exhaust
- Division 26: Electrical service, equipment drops
- Missing quantities: dining SF, kitchen SF, hood LF, restroom count, equipment schedule`,
  },
  {
    id: 'com-medical-dental',
    label: 'Medical / Dental Office TI',
    category: 'Commercial',
    description: 'Medical or dental office tenant improvement with exam rooms and specialty systems',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall complete a medical or dental office tenant improvement including clinical exam or operatory rooms, reception, waiting room, break room, and provider offices, with dedicated medical gas rough-in, enhanced electrical, medical-grade HVAC, and all specified finishes per the construction documents and infection control requirements.

INCLUSIONS:
- Interior partition walls — standard and infection-control (full-height to deck)
- 5/8″ drywall with abuse-resistant finish coat in clinical areas
- Suspended acoustical ceiling with gasketed tiles in clinical zones
- Medical gas rough-in — oxygen, vacuum, nitrous, air, (by certified piping contractor)
- Enhanced electrical: isolated ground circuits, 20A circuits per operatory per plan
- HVAC — dedicated units for clinical zones, pressure differential where required
- Plumbing: hand-wash sinks at each clinical room, autoclave, darkroom (if applicable)
- LVT or sheet vinyl flooring in clinical areas; carpet in waiting/offices
- Window film or lead lining for radiograph rooms (dental/radiology)
- Reception counter and nurse station millwork (per allowance or design)
- Provider call, panic, and nurse call system rough-in (systems by owner)

EXCLUSIONS:
- Medical equipment (chairs, units, imaging) — supply and installation by owner
- Sterilization casework beyond rough-in unless specifically included
- IT/data wiring beyond conduit
- Signage and ADA way-finding beyond building standard

ASSUMPTIONS:
- Medical equipment submittals received before rough-in begins
- Infection control risk assessment (ICRA) protocol agreed before mobilization if adjacent to occupied clinical space
- Medical gas certifying agency inspections coordinated by contractor

KNOWN QUANTITIES:
- Total TI SF: _____
- Operatory / exam rooms: _____ qty
- Provider offices: _____ qty
- Waiting / reception SF: _____
- Restrooms: _____ qty

SPECIAL CONDITIONS:
- ICRA barrier and negative-pressure zone required if adjacent to occupied medical facility
- All mechanical/electrical per NFPA 99 Chapter 6 (Category 3 minimum unless otherwise required)
- Certificate of Occupancy requires medical gas certification before opening

ESTIMATING NOTES:
- Division 09: Drywall, flooring, ceiling, paint
- Division 22: Plumbing, medical gas rough-in
- Division 23: HVAC clinical zones
- Division 26: Enhanced electrical circuits, isolated grounds
- Division 28: Nurse call rough-in
- Missing quantities: TI SF, room count, gas outlets per room`,
  },
  {
    id: 'com-restroom-reno',
    label: 'Restroom Renovation',
    category: 'Commercial',
    description: 'Full ADA restroom renovation in occupied commercial building',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall renovate existing commercial restroom(s) to current ADA standards, including demo of existing finishes, plumbing fixture replacement, full tile work, new accessories, HVAC exhaust upgrade, and electrical, while maintaining adjacent facilities in service throughout construction.

INCLUSIONS:
- Demolition of existing tile, fixtures, partitions, and ceiling
- Plumbing rough-in adjustments for ADA fixture placement
- Wall-hung or floor-mounted water closets — ADA height and clearances
- Lavatories with ADA knee clearance; sensor faucets per code
- Urinals (men's room) — sensor flush, ADA-compliant
- Ceramic or porcelain floor and wall tile — full height to ceiling
- Epoxy or cement grout throughout
- Suspended drywall or tile ceiling with exhaust grille
- LED lighting and exhaust fan
- Stainless steel accessories — grab bars (ASTM F446), TP holders, mirror, paper towel
- Toilet partition system — powder-coat steel or phenolic per selection
- Entry door ADA hardware

EXCLUSIONS:
- Plumbing supply and drain mains beyond within-restroom connections
- Structural modifications outside restroom footprint
- Exterior or building-system exhaust ductwork beyond connection point

ASSUMPTIONS:
- Facility provides at least one operable restroom for occupants throughout construction
- Existing drain and supply lines are in serviceable condition
- Tile selection submitted and approved before demo begins

KNOWN QUANTITIES:
- Restrooms: _____ qty (_____ men's / _____ women's / _____ single-occupancy)
- Each restroom SF: _____
- Fixtures per room: _____ WC, _____ lavatory, _____ urinal

SPECIAL CONDITIONS:
- Night/weekend work may be required to maintain daytime restroom access
- Occupied building — maintain dust control and odor mitigation
- ADA compliance sign-off required by building official before reopening

ESTIMATING NOTES:
- Division 09: Tile, drywall, paint, ceiling, accessories
- Division 10: Toilet partitions, specialty accessories
- Division 22: Plumbing fixtures and rough-in
- Division 26: Electrical, lighting, exhaust
- Missing quantities: restroom count, SF per room, fixture count`,
  },
  {
    id: 'com-warehouse-ti',
    label: 'Warehouse Tenant Improvement',
    category: 'Commercial',
    description: 'Warehouse TI with dock improvements, office, and electrical upgrades',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform the tenant improvement of a leased warehouse space including office buildout, slab modifications, dock door upgrades, electrical service expansion, and lighting upgrade per the approved construction documents.

INCLUSIONS:
- Office/mezzanine buildout per floor plan (see com-office-buildout scope)
- Dock door replacement or addition — sectional overhead, seals, and bumpers
- Dock leveler installation (equipment by owner; installation by contractor)
- Slab saw-cut, core drilling, and patch for new plumbing or dock pits
- LED high-bay warehouse lighting replacing existing fluorescent
- Electrical panel addition or upgrade for warehouse equipment loads
- Floor marking — painted safety lanes and rack footprint per owner's plan
- Restroom expansion or upgrade if required by code change of occupancy

EXCLUSIONS:
- Rack systems, shelving, and material handling equipment (by owner)
- Sprinkler system modifications (by fire protection sub, may be separate contract)
- Exterior signage and site work beyond building footprint
- Exterior dock apron concrete (by civil contractor or owner)

ASSUMPTIONS:
- Lease confirmed and landlord approval of TI plans obtained
- Sprinkler engineer's fire protection drawings issued before permit submittal
- Owner provides rack and equipment layout for floor marking before slab work

KNOWN QUANTITIES:
- Warehouse SF: _____
- Office SF: _____
- Dock doors: _____ qty
- High-bay light fixtures: _____ qty
- Electrical circuits added: _____ qty

SPECIAL CONDITIONS:
- Operational warehouse — phase work to maintain product storage and receiving
- Coordinate power outages with owner for after-hours cutover
- Occupied dock doors — temporary dock protection during replacement

ESTIMATING NOTES:
- Division 08: Dock doors and levelers
- Division 09: Office finishes
- Division 26: Electrical upgrade and lighting
- Division 22: Plumbing and slab core drilling
- Missing quantities: warehouse SF, dock count, light fixture count, electrical ampacity`,
  },

  // ─── Civil & Site Work ───────────────────────────────────────────────────────
  {
    id: 'civil-site-prep',
    label: 'Site Preparation & Clearing',
    category: 'Civil & Site Work',
    description: 'Clearing, grubbing, demolition, and rough grading for a new project site',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform all site preparation work including clearing and grubbing, removal and disposal of vegetation and existing structures, rough grading, and erosion and sediment control installation to establish a construction-ready site per the approved grading and erosion control plan.

INCLUSIONS:
- Clearing and grubbing of trees, brush, stumps, and root mass within clearing limits
- Tree removal with stump grinding or full root extraction
- Demolition of existing structures within site limits (foundations, slabs, fencing)
- Topsoil stripping and stockpile on-site
- Rough grading to within _____ in. of design grade
- Import fill or export of unsuitable material as required
- Erosion and sediment control (silt fence, inlet protection, stabilized entrance)
- Temporary seeding of disturbed areas not under active construction

EXCLUSIONS:
- Final grading and fine grading
- Utility demolition (gas, electric, telecom) — by respective utility companies
- Asbestos or environmental remediation
- Tree preservation of protected trees outside clearing limits

ASSUMPTIONS:
- Survey and clearing limits staked before mobilization
- Permits: land disturbance permit, tree removal permit, and demolition permit in place
- Utility locates (811) completed and marked before clearing
- Disposal site for vegetative debris and demolition waste identified

KNOWN QUANTITIES:
- Clearing area: _____ AC
- Trees over 6″ DBH: _____ estimated
- Existing structures: _____ SF of slab/pavement, _____ LF of fencing
- Cut/fill balance: _____ CY estimated

SPECIAL CONDITIONS:
- Protected trees or wetlands — field flag before clearing; do not encroach
- NPDES/SWPPP compliance required for sites over 1 acre
- Archaeological survey area — notify engineer if artifacts discovered

ESTIMATING NOTES:
- Division 02: Demo, clearing, and disposal
- Division 31: Earthwork, grading, erosion control
- Missing quantities: clearing acres, tree count, existing demo SF, cut/fill CY`,
  },
  {
    id: 'civil-parking-lot',
    label: 'Parking Lot (Asphalt or Concrete)',
    category: 'Civil & Site Work',
    description: 'New parking lot construction with striping, lighting, and drainage',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a new parking lot per the approved site plan including subgrade preparation, aggregate base, asphalt or concrete paving, curb and gutter, ADA-compliant accessible stalls, pavement markings, wheel stops, and site lighting as specified.

INCLUSIONS:
- Subgrade excavation to design grade and proof-roll
- Crushed aggregate base: _____ in. compacted
- Asphalt pavement: _____ in. base course + _____ in. surface course (or concrete _____ in.)
- Concrete curb and gutter — APWA standard or per plan
- Concrete ADA-accessible stalls with truncated dome ramps at each accessible route
- Pavement marking — 4″ white lines, handicap symbols, fire lane striping (thermoplastic)
- Precast concrete wheel stops
- Site lighting — pole-mounted LED fixtures per photometric plan
- Storm drain inlets and underground storm pipe to point of discharge

EXCLUSIONS:
- Underground utilities not associated with storm drainage or site lighting
- Landscaping and irrigation within parking islands
- Traffic signal modifications at public street
- Signage beyond pavement markings

ASSUMPTIONS:
- Civil drawings stamped and permitted before mobilization
- Utility locates and conflicts resolved before subgrade work
- Geotechnical report confirms pavement section design
- Lighting luminaire submittals approved before pole ordering

KNOWN QUANTITIES:
- Total paving area: _____ SF
- Parking stalls: _____ total (_____ ADA)
- Curb and gutter: _____ LF
- Light poles: _____ qty
- Storm inlets: _____ qty

SPECIAL CONDITIONS:
- Phased paving if portion of lot must remain open during construction
- Traffic control plan required if adjacent to public road
- Final striping after paving cures minimum 30 days (asphalt)

ESTIMATING NOTES:
- Division 03: Concrete curb, gutter, sidewalk
- Division 31: Subgrade and base
- Division 32: Asphalt or concrete paving, striping
- Division 33: Storm drainage
- Missing quantities: paving SF, curb LF, stall count, pole count`,
  },
  {
    id: 'civil-drainage',
    label: 'Stormwater Drainage & Detention',
    category: 'Civil & Site Work',
    description: 'Storm sewer, retention/detention pond, and stormwater management installation',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall install the stormwater management system per the approved civil drawings, including inlet structures, underground storm pipe, retention or detention basin grading, outlet structure, and all erosion control measures, to meet the design storm event requirements and local authority requirements.

INCLUSIONS:
- Excavation, bedding, and installation of storm drain pipe (RCP, HDPE, or PVC per plan)
- Curb inlets, drop inlets, and junction boxes per structure schedule
- Headwall or flared end section at outfall locations
- Retention/detention pond grading and shaping per design contours
- Pond outlet structure including weir, riser, and barrel pipe
- Slope armor — rip rap, grouted stone, or erosion control mat at outfall
- Re-grading and seeding of basin side slopes (permanent seed mix)
- Emergency overflow spillway
- Upstream SWPPP controls throughout construction

EXCLUSIONS:
- Water quality structures (bioretention, sand filter) beyond basic detention unless specifically included
- Underground proprietary detention systems unless specifically included
- Wetland mitigation or permitting

ASSUMPTIONS:
- Civil/stormwater design stamped and agency-approved before mobilization
- Downstream point of discharge confirmed adequate for design flow
- Stormwater permit (NPDES) in place before earthwork
- As-built survey provided to engineer before final inspection

KNOWN QUANTITIES:
- Storm pipe: _____ LF (_____ in. dia.)
- Inlets and structures: _____ qty
- Pond volume: _____ CY of excavation
- Pond footprint: _____ SF
- Rip rap: _____ CY

SPECIAL CONDITIONS:
- Basin must be functional before final grading to manage construction runoff
- Outfall connection to existing public system requires ROW permit
- Pond seeding window: spring or fall application only

ESTIMATING NOTES:
- Division 31: Pond excavation and grading
- Division 33: Storm pipe, inlets, and outfall structures
- Missing quantities: pipe LF by diameter, structure count, pond CY, rip rap CY`,
  },
  {
    id: 'civil-utility-trenching',
    label: 'Utility Trenching & Installation',
    category: 'Civil & Site Work',
    description: 'Site utility trenching for water, sewer, gas, or electrical conduit',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform utility trenching, pipe or conduit installation, bedding, and backfill for site underground utilities as indicated on the civil plans, including water main, sanitary sewer, storm sewer, gas service, and/or electrical conduit as applicable to the project scope.

INCLUSIONS:
- Machine excavation of utility trench to design depth
- Hand excavation within 18″ of existing utilities
- Granular pipe bedding and initial backfill to 12″ above pipe crown
- Utility installation: ___ water main (PVC Sch 40 or DI per spec), ___ sewer (PVC SDR-35), ___ gas (HDPE), ___ electrical conduit (PVC Sch 40 or rigid)
- Tracer wire and warning tape 12″ above all non-metallic utilities
- Structural backfill in compacted lifts (native or select fill per plan)
- Surface restoration — pavement patch or gravel per plan
- Pressure test or mandrel test per utility type before backfill

EXCLUSIONS:
- Utility connection fees and meter installation (by utility company)
- Directional boring or horizontal directional drilling (separate line item)
- Rock excavation beyond standard pricing unless confirmed by soils report
- Building mechanical connections beyond 5 ft from exterior wall

ASSUMPTIONS:
- Utility plans approved by AHJ before mobilization
- 811 utility locates completed and marked; contractor notified of all conflicts
- Soils suitable for open-cut trenching — no groundwater or OSHA shoring trigger
- Owner's testing lab performs compaction testing on backfill

KNOWN QUANTITIES:
- Trench depth: _____ ft average
- Water main: _____ LF @ _____ in.
- Sewer main: _____ LF @ _____ in.
- Electrical conduit: _____ LF @ _____ in.
- Gas service: _____ LF
- Manholes: _____ qty; Vaults: _____ qty

SPECIAL CONDITIONS:
- Traffic control plan required for any trenching in or adjacent to roadway
- Dewatering plan on standby if groundwater encountered
- All pressure tests witnessed by owner's representative before backfill

ESTIMATING NOTES:
- Division 31: Excavation, bedding, backfill
- Division 33: Site utilities and structures
- Missing quantities: LF by utility type and size, structure count, trench depth`,
  },
  {
    id: 'civil-roadway',
    label: 'Roadway / Access Road Construction',
    category: 'Civil & Site Work',
    description: 'New asphalt or aggregate access road or private roadway',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall construct a new roadway or access road per the approved civil plans, including earthwork, subgrade preparation, base aggregate, paving (asphalt or aggregate surface), drainage ditches or pipe, culverts, and traffic control, suitable for the design vehicle loading and traffic volume.

INCLUSIONS:
- Clearing and grubbing of road corridor
- Cut and fill earthwork to design subgrade grade and cross-section
- Subgrade compaction to 95% modified Proctor
- Crushed aggregate base: _____ in. compacted (AASHTO No. 57 or equivalent)
- Asphalt surface: _____ in. compacted hot-mix or treated aggregate surface per design
- Roadway crown — 2% cross-slope to drainage
- Roadside drainage ditch grading and seeding
- Culvert crossings — _____ dia. HDPE or RCP, headwalls per plan
- Guardrail at drop-offs exceeding 4 ft where required

EXCLUSIONS:
- Concrete pavement unless specifically included
- Traffic signals, signs, and pavement markings (by civil specialty sub)
- Utility relocations in corridor
- Permits and right-of-way fees

ASSUMPTIONS:
- Roadway alignment and design cross-section established on approved civil drawings
- Soils report available; unsuitable material quantities known before bid
- Access to staging and borrow/disposal areas identified

KNOWN QUANTITIES:
- Road length: _____ LF
- Road width: _____ ft
- Cut: _____ CY; Fill: _____ CY
- Base: _____ CY; Asphalt: _____ tons
- Culverts: _____ qty (_____ dia. × _____ LF each)

SPECIAL CONDITIONS:
- Active public road crossing — off-hours paving and traffic control
- Dust control on aggregate surface until final paving
- Compaction testing at subgrade and each base lift

ESTIMATING NOTES:
- Division 02: Clearing and demo
- Division 31: Earthwork, subgrade, compaction
- Division 32: Aggregate base and asphalt
- Division 33: Culverts and drainage
- Missing quantities: LF, width, cut/fill CY, base CY, asphalt tons, culvert count`,
  },
  {
    id: 'civil-grading',
    label: 'Mass Grading & Earthwork',
    category: 'Civil & Site Work',
    description: 'Mass cut and fill earthwork to bring site to rough grade',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform mass grading and earthwork to bring the site to the design rough grade shown on the approved grading plan, including stripping, cut and fill operations, import or export of material as required, compaction, and erosion control throughout the work.

INCLUSIONS:
- Topsoil stripping (_____ in. average depth) and stockpile for reuse
- Mass excavation (cut) and embankment (fill) per grading plan
- Proof-roll subgrade and recompact soft areas
- Compaction to 95% standard Proctor in fill areas
- Import structural fill if cut material is insufficient or unsuitable
- Export of unsuitable material to approved disposal site
- SWPPP — silt fence, inlet protection, and stabilized construction entrance
- Temporary seed and mulch on completed slopes not under active construction
- Rough grade tolerance within _____ tenths of design grade

EXCLUSIONS:
- Fine grading and finish grading
- Paving, curbing, or underground utilities
- Rock blasting or grinding unless confirmed by geotechnical investigation
- Topsoil placement in landscape areas (separate bid item)

ASSUMPTIONS:
- Geotechnical report confirms shrinkage/swell factors used in earthwork calculations
- Cut-fill balance verified by engineer before mobilization; import/export quantities TBD
- Owner's testing lab provides compaction testing throughout
- Haul routes and disposal/borrow sites identified before mobilization

KNOWN QUANTITIES:
- Site area: _____ AC
- Stripping: _____ CY
- Cut: _____ CY (bank measure)
- Fill required: _____ CY (compacted)
- Import: _____ CY; Export: _____ CY

SPECIAL CONDITIONS:
- NPDES permit required if site exceeds 1 acre disturbance
- Dewatering plan required if seasonal high water table encountered
- Coordinate mass grading with utility contractor for pre-grading utility work

ESTIMATING NOTES:
- Division 31: All earthwork, stripping, grading, compaction, erosion control
- Missing quantities: site acres, cut CY, fill CY, import/export CY, stripping depth`,
  },

  // ─── Specialty & Repair ──────────────────────────────────────────────────────
  {
    id: 'spec-roofing',
    label: 'Roofing Replacement / Repair',
    category: 'Specialty & Repair',
    description: 'Full tear-off and replacement or repair of commercial or residential roofing',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform a complete tear-off and replacement of the existing roofing system (or targeted repair sections as defined), including removal of existing membrane or shingles, decking inspection and repair, installation of new insulation, membrane or shingles, all flashing, penetration details, and perimeter edge metal per the specifications and manufacturer's installation requirements.

INCLUSIONS:
- Tear-off and disposal of existing roofing (_____ layers max)
- Decking inspection — repair or replace deteriorated decking as encountered
- Tapered insulation or flat insulation system per specification
- New roofing membrane — TPO, EPDM, PVC, or modified bitumen per spec
  (or asphalt shingles with synthetic underlayment for steep-slope)
- Perimeter edge metal and gravel stop
- Reflashing at all penetrations — pipes, curbs, drains, skylights
- New drain bowls and strainers at roof drains
- New pipe penetration pitch pockets or prefabricated flashings
- HVAC curb flashing and counter-flashing
- Manufacturer's standard warranty (_____ years)

EXCLUSIONS:
- HVAC unit replacement or repositioning
- Structural decking reinforcement beyond localized repair
- Interior water damage repair
- Gutters and downspouts unless specifically included

ASSUMPTIONS:
- Roof access confirmed — roof hatch, ladder, or boom lift available
- Existing deck condition unknown until tear-off; contingency allowance for deck replacement
- Work sequence accommodates building operations below

KNOWN QUANTITIES:
- Roof area: _____ SQ (100 SF each)
- Drain count: _____
- Penetrations/curbs: _____ qty
- Insulation R-value: _____

SPECIAL CONDITIONS:
- Maintain waterproofing at end of each workday — no overnight open deck
- Owner notification required for any hot work (torch-applied) permits
- Roof load capacity verification before staging ballasted materials

ESTIMATING NOTES:
- Division 07: Roofing, insulation, flashings, edge metal
- Missing quantities: roof SQ, drain count, penetration/curb count, insulation R-value`,
  },
  {
    id: 'spec-exterior-envelope',
    label: 'Exterior Envelope Repair & Waterproofing',
    category: 'Specialty & Repair',
    description: 'Caulking, waterproofing, sealant, and exterior skin repair',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall investigate and repair the building exterior envelope, including recaulking of all joints and penetrations, repair of deteriorated stucco, brick, or EIFS, application of waterproofing coating or membrane at walls and below-grade areas, and restoration of windows and door perimeters to eliminate water intrusion per the inspection report recommendations.

INCLUSIONS:
- Complete removal and replacement of existing joint sealants at exterior joints, windows, and penetrations
- Sealant type per joint spec: _____ (silicone/polyurethane) at joints, _____ at windows
- Stucco repair: crack routing, patching, and texture match
- EIFS repair: foam replacement, base coat, finish coat, and sealant
- Brick tuckpointing at deteriorated mortar joints
- Below-grade waterproofing membrane at foundation walls (negative or positive side)
- Window flashing pan and head flashing installation where missing
- Through-wall flashing repair at lintels and shelf angles
- Scaffolding, swing stage, or lift access as required

EXCLUSIONS:
- Window or door replacement unless specifically included
- Full stucco or EIFS system replacement beyond repair areas
- Interior water damage repair
- Roofing unless at parapet or transition with wall

ASSUMPTIONS:
- Inspection report or scope of work document identifies all areas for repair
- Mock-up of sealant and stucco repair approved before production work
- Owner provides access to all exterior faces of building

KNOWN QUANTITIES:
- Exterior wall area: _____ SF
- Joint sealant LF: _____
- Stucco repair: _____ SF
- Brick tuckpointing: _____ SF
- Below-grade membrane: _____ SF

SPECIAL CONDITIONS:
- Occupied building — maintain egress and prevent debris fall over occupied areas
- Swing stage or aerial work platform permit required for work above 36 ft
- Weather window: sealants and coatings require min 40°F and dry surface

ESTIMATING NOTES:
- Division 07: Waterproofing, sealants, caulking, envelope repair
- Division 04: Brick tuckpointing
- Missing quantities: sealant LF, stucco repair SF, wall area, below-grade membrane SF`,
  },
  {
    id: 'spec-interior-finishes',
    label: 'Interior Finishes Package',
    category: 'Specialty & Repair',
    description: 'Flooring, painting, ceiling, and trim refresh of an existing interior',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform an interior finishes refresh package including flooring replacement, paint, ceiling tile replacement, trim repair, and other cosmetic improvements as specified, restoring the space to updated, presentable condition without structural modifications.

INCLUSIONS:
- Remove and dispose of existing flooring (carpet, VCT, or LVT)
- New flooring installation: _____ (carpet/LVT/VCT/tile) per owner's selection
- Wall prep — patch, skim coat, and sand all wall surfaces
- Interior paint — 2 coats finish, ceilings one coat white
- Replace damaged or stained acoustical ceiling tiles in place
- Replace or repaint base molding and door trim
- Interior door hardware replacement (hardware allowance)
- Clean and touch-up millwork surfaces

EXCLUSIONS:
- Structural wall or partition changes
- Electrical, plumbing, or HVAC modifications
- Window treatments beyond cleaning
- Furniture and equipment

ASSUMPTIONS:
- Space is vacant during construction
- Owner's finish selections confirmed and materials ordered before mobilization
- All flooring areas accessible — no need to move heavy equipment or built-ins

KNOWN QUANTITIES:
- Total area: _____ SF
- Flooring: _____ SF
- Paint — walls: _____ SF; ceilings: _____ SF
- ACT tiles to replace: _____ SF
- Doors: _____ qty

SPECIAL CONDITIONS:
- Dust control and HEPA filtration required if space is adjacent to occupied areas
- Phase work if some areas must remain in use during project

ESTIMATING NOTES:
- Division 09: Flooring, drywall patch, paint, ceiling tile
- Division 10: Hardware and specialties
- Missing quantities: total SF by finish type, door count, ACT tiles SF`,
  },
  {
    id: 'spec-demolition',
    label: 'Selective / Full Demolition',
    category: 'Specialty & Repair',
    description: 'Interior selective demolition or complete building demolition and site clearing',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform selective interior demolition or complete building demolition as specified, including all mechanical, electrical, and plumbing disconnects, structural removal, debris haul-off to licensed disposal facility, and restoration of the remaining structure or site to a clean, construction-ready condition.

INCLUSIONS:
- Utility disconnects — capping and abandonment of all services within demolition limits
- Selective or full building demolition per scope documents
- Removal of all mechanical equipment, ductwork, electrical panels, and plumbing fixtures
- Structural demolition — concrete slab removal (saw-cut and break), framing, masonry
- Foundation removal if included in scope
- Debris sorting, haul-off, and disposal at licensed facility (recycling of metals where feasible)
- Site grading and backfill of pit or excavation to match surrounding grade

EXCLUSIONS:
- Asbestos, lead, PCB, or mold abatement (by certified abatement contractor before demo)
- Tree removal and stump grinding (separate bid item)
- Utility company disconnects at meter (coordinated by owner with utility)

ASSUMPTIONS:
- Hazardous material survey (asbestos, lead) completed and clearance given before demo
- All utility services disconnected at the meter before contractor mobilization
- Demolition permit issued before start
- Salvage items identified and removed by owner before mobilization

KNOWN QUANTITIES:
- Building footprint: _____ SF (or selective demo area: _____ SF)
- Slab area to remove: _____ SF @ _____ in. thick
- Debris estimated: _____ tons
- Haul distance to disposal: _____ miles approximate

SPECIAL CONDITIONS:
- Adjacent occupied structures — vibration and dust monitoring required
- Dust suppression required during mechanical demolition
- Structural shoring of adjacent walls before selective demo

ESTIMATING NOTES:
- Division 02: Selective and full demolition, utility disconnects
- Division 31: Site grading and backfill after demolition
- Missing quantities: building SF, slab SF, estimated tons of debris, haul distance`,
  },
  {
    id: 'spec-disaster-repair',
    label: 'Disaster Repair (Storm, Flood, Fire)',
    category: 'Specialty & Repair',
    description: 'Emergency stabilization and repair following storm, flood, or fire damage',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform emergency stabilization and disaster repair to the structure following documented storm, flood, or fire damage, including temporary protection, removal of damaged materials, drying and decontamination, structural repairs, and full reconstruction of damaged portions to pre-loss condition or better, per the insurance scope of loss or owner's approved repair plan.

INCLUSIONS:
- Emergency response — temporary board-up, roof tarp, and structural bracing
- Water extraction and structural drying (dehumidifiers and air movers as required)
- Mold assessment and remediation as documented (if triggered by moisture intrusion)
- Removal and disposal of all damaged materials per IICRC S500/S520 protocols (water) or fire-damaged material protocols
- Structural repairs — framing, sheathing, roofing, and exterior skin
- Replacement of all damaged interior finishes — drywall, flooring, paint, trim, ceilings
- MEP repairs — damaged wiring, plumbing, ductwork per licensed sub-contractors
- Smoke odor mitigation treatments (ozone, dry ice blasting) for fire losses

EXCLUSIONS:
- Contents cleaning, storage, and restoration (by contents sub)
- Structural engineering and testing fees (by owner's engineer)
- Code upgrades beyond those required at damaged scope
- Pre-existing conditions not caused by the insured event

ASSUMPTIONS:
- Insurance adjuster scope of loss reviewed and agreed before reconstruction begins
- Moisture readings confirm dry standard (< 16% wood MC) before enclosure
- Photo and moisture documentation completed at each phase for insurance
- Permits obtained before reconstruction work begins

KNOWN QUANTITIES:
- Affected area: _____ SF
- Damaged roofing: _____ SQ
- Damaged drywall: _____ SF
- Structural members replaced: _____ (describe)
- Drying equipment duration: _____ days estimated

SPECIAL CONDITIONS:
- Insurance supplement process — contractor to document all scope changes for adjuster
- Occupied home or building — relocate affected occupants before work begins
- Air quality testing after mold remediation required before re-occupancy

ESTIMATING NOTES:
- Division 02: Demo and removal of damaged materials
- Division 06/07/09: Structural and interior restoration
- Division 22/23/26: MEP repair
- Missing quantities: affected SF, roof SQ, drywall SF, structural members`,
  },
  {
    id: 'spec-military-encap',
    label: 'Military / Federal Encapsulation & Abatement',
    category: 'Specialty & Repair',
    description: 'Lead paint encapsulation or hazardous material abatement on federal or military property',
    scopeText: `PROJECT SCOPE SUMMARY:
The contractor shall perform lead-based paint (LBP) encapsulation or removal, asbestos abatement, or other hazardous material work on federal or military property in full compliance with applicable DoD, EPA, and OSHA regulations, including worker protection, air monitoring, waste disposal, and documentation requirements.

INCLUSIONS:
- Pre-work meeting and safety plan submission per EM 385-1-1 (USACE) requirements
- Site-specific health and safety plan (SSHP) and activity hazard analysis (AHA)
- Containment barrier system (negative pressure enclosure where required)
- Worker PPE — supplied air or PAPR respirators, Tyvek suits, gloves per exposure assessment
- LBP encapsulation with approved encapsulant coating (USEPA RRP compliant)
  OR LBP removal and HEPA vacuuming per OSHA 29 CFR 1926.62
- Asbestos abatement per OSHA 29 CFR 1926.1101 and NESHAP 40 CFR Part 61
- Air monitoring — clearance testing by certified industrial hygienist
- Waste profiling, containerization (UN-rated drums), and manifested disposal to licensed TSDF
- Post-abatement clearance air sampling and documentation
- Final closeout report per contract requirements

EXCLUSIONS:
- Structural repairs or painting beyond encapsulant topcoat
- PCB or mercury remediation unless separately scoped
- Waste disposal transportation fees if billed directly by carrier

ASSUMPTIONS:
- Owner (DoD or federal agency) provides certified air monitoring and industrial hygiene oversight
- Access to installation coordinated — background checks, base access credentials, escorts as required
- Work hours subject to installation policy
- COR (Contracting Officer's Representative) identified and available for daily inspection

KNOWN QUANTITIES:
- LBP surface area: _____ SF
- Asbestos ACM: _____ SF or _____ LF of pipe insulation
- Waste drums estimated: _____ qty
- Containment area: _____ SF

SPECIAL CONDITIONS:
- Stop-work authority vested in safety officer and COR
- All personnel must hold current OSHA 30 (construction) and applicable state abatement licenses
- Daily air monitoring results submitted to COR before work continues next day

ESTIMATING NOTES:
- Division 02: Hazardous material abatement and encapsulation
- Allowance for waste disposal (variable based on waste classification)
- Missing quantities: LBP SF, ACM SF/LF, waste drum count, containment zone SF`,
  },
] as const;

export function getProjectScopeTemplateById(id: string): ProjectScopeTemplate | undefined {
  return PROJECT_SCOPE_TEMPLATES.find(t => t.id === id);
}

export function getProjectScopeTemplatesByCategory(): Record<string, ProjectScopeTemplate[]> {
  const result: Record<string, ProjectScopeTemplate[]> = {};
  for (const template of PROJECT_SCOPE_TEMPLATES) {
    if (!result[template.category]) {
      result[template.category] = [];
    }
    result[template.category].push(template);
  }
  return result;
}
