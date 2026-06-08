/**
 * Residential Baseline Activity Master.
 *
 * Single-responsibility activity templates (one trade, one action, one phase per
 * card) covering the full residential lifecycle from kickoff to turnover.
 *
 * Codes follow a Division-Phase-Sequence schema: DD-PP-SS.
 * Crew sizes are default scheduling caps, not code mandates.
 *
 * This is a standalone authored dataset. It does not read or modify any saved
 * estimate data. Validate it with validateActivityMasterDataset().
 */

export type ActivityType =
  | 'work'
  | 'inspection'
  | 'milestone'
  | 'curing_lag'
  | 'procurement_lead_time'
  | 'testing';

export type EstimateActivityTemplate = {
  activityCode: string;
  title: string;
  divisionCode: string;
  divisionName: string;
  workPackageCode: string;
  workPackageName: string;
  activityType: ActivityType;
  sequencingCategory: string;
  logicAnchor: string;
  defaultCrewSize: number;
  defaultHoursPerDay: number;
  defaultDurationDays: number;
  defaultUnit: string;
  primaryTrade: string;
  actionDescription: string;
  scheduleEnabled: boolean;
  inspectionRequired?: boolean;
  weatherSensitive?: boolean;
  variant?: 'baseline' | 'slab_on_grade' | 'crawlspace' | 'optional';
  /** Official CSI MasterFormat division code (e.g. "03"). */
  csiDivisionCode?: string;
  /** Official CSI MasterFormat section code (e.g. "03 30 00"). */
  csiSectionCode?: string;
};

type RowInput = {
  code: string;
  title: string;
  divName: string;
  wpName: string;
  type?: ActivityType;
  seq: string;
  anchor: string;
  crew: number;
  dur?: number;
  unit?: string;
  hpd?: number;
  trade: string;
  action: string;
  inspectionRequired?: boolean;
  weatherSensitive?: boolean;
  variant?: EstimateActivityTemplate['variant'];
  csiDivisionCode?: string;
  csiSectionCode?: string;
};

/** Builds a full template row, applying shared defaults. */
function t(row: RowInput): EstimateActivityTemplate {
  const divisionCode = row.code.slice(0, 2);
  const workPackageCode = row.code.slice(0, 5); // DD-PP
  const template: EstimateActivityTemplate = {
    activityCode: row.code,
    title: row.title,
    divisionCode,
    divisionName: row.divName,
    workPackageCode,
    workPackageName: row.wpName,
    activityType: row.type ?? 'work',
    sequencingCategory: row.seq,
    logicAnchor: row.anchor,
    defaultCrewSize: row.crew,
    defaultHoursPerDay: row.hpd ?? 8,
    defaultDurationDays: row.dur ?? 1,
    defaultUnit: row.unit ?? 'EA',
    primaryTrade: row.trade,
    actionDescription: row.action,
    scheduleEnabled: true,
  };
  if (row.inspectionRequired) template.inspectionRequired = true;
  if (row.weatherSensitive) template.weatherSensitive = true;
  if (row.variant && row.variant !== 'baseline') template.variant = row.variant;
  if (row.csiDivisionCode) template.csiDivisionCode = row.csiDivisionCode;
  if (row.csiSectionCode) template.csiSectionCode = row.csiSectionCode;
  return template;
}

const DIV_00 = 'Procurement and Contracting Requirements';
const DIV_01 = 'General Requirements / Project Management';
const DIV_02 = 'Existing Conditions / Selective Demolition';
const DIV_03 = 'Concrete & Substructure';
const DIV_04 = 'Masonry';
const DIV_05 = 'Metals';
const DIV_06 = 'Wood Framing / Superstructure';
const DIV_07 = 'Enclosure & Thermal';
const DIV_08 = 'Openings';
const DIV_09 = 'Finishes';
const DIV_10 = 'Specialties';
const DIV_11 = 'Equipment';
const DIV_12 = 'Cabinets & Casework';
const DIV_13 = 'Special Construction';
const DIV_14 = 'Conveying Equipment';
const DIV_21 = 'Fire Suppression';
const DIV_22 = 'Plumbing';
const DIV_23 = 'HVAC';
const DIV_25 = 'Integrated Automation';
const DIV_26 = 'Electrical';
const DIV_27 = 'Communications';
const DIV_28 = 'Electronic Safety and Security';
const DIV_31 = 'Earthwork & Utilities';
const DIV_32 = 'Exterior Improvements';
const DIV_33 = 'Site Utilities';
const DIV_48 = 'Electrical Power Generation';

export const residentialActivityMaster: EstimateActivityTemplate[] = [
  // ── Division 00 — Project Procurement ────────────────────────────────────
  t({ code: '00-01-01', title: 'Issue owner project requirements', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'owner-requirements', crew: 1, unit: 'LS', trade: 'Owner / General Contractor', action: 'Document owner requirements, project intent, budget expectations, and procurement path before estimate development.' }),
  t({ code: '00-01-02', title: 'Prepare preliminary project scope', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'preliminary-scope', crew: 1, unit: 'LS', trade: 'General Contractor / Estimator', action: 'Prepare the initial written project scope for pricing, schedule planning, and owner review.' }),
  t({ code: '00-01-03', title: 'Prepare preliminary estimate', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'preliminary-estimate', crew: 1, unit: 'LS', trade: 'Estimator', action: 'Develop an early cost estimate using available drawings, scope notes, allowances, and assumptions.' }),
  t({ code: '00-01-04', title: 'Prepare bid estimate', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'bid-estimate', crew: 1, unit: 'LS', trade: 'Estimator', action: 'Prepare the formal bid estimate with divisions, line items, labor, material, equipment, subcontractor, and markup values.' }),
  t({ code: '00-01-05', title: 'Solicit subcontractor quotes', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'subcontractor-quotes', crew: 1, unit: 'LS', trade: 'General Contractor / Estimator', action: 'Request pricing from subcontractors for scoped trade packages.' }),
  t({ code: '00-01-06', title: 'Review subcontractor quotes', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'quote-review', crew: 1, unit: 'LS', trade: 'General Contractor / Estimator', action: 'Review subcontractor proposals for completeness, exclusions, qualifications, and scope gaps.' }),
  t({ code: '00-01-07', title: 'Prepare owner proposal', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'owner-proposal', crew: 1, unit: 'LS', trade: 'General Contractor', action: 'Prepare the formal owner-facing proposal with scope, pricing, assumptions, alternates, and exclusions.' }),
  t({ code: '00-01-08', title: 'Submit owner proposal', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'proposal-submit', crew: 1, unit: 'LS', trade: 'General Contractor', action: 'Submit the proposal package to the owner for review and acceptance.' }),
  t({ code: '00-01-09', title: 'Negotiate proposal revisions', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'proposal-negotiation', crew: 1, unit: 'LS', trade: 'General Contractor / Owner', action: 'Review owner comments and revise scope, price, alternates, or exclusions as required.' }),
  t({ code: '00-01-10', title: 'Receive owner proposal acceptance', divName: DIV_00, wpName: 'Project Procurement', seq: 'procurement', anchor: 'proposal-acceptance', crew: 1, unit: 'LS', trade: 'Owner', action: 'Record owner acceptance of proposal, price, scope, and intended project delivery path.' }),

  // ── Division 00 — Contracting ────────────────────────────────────────────
  t({ code: '00-02-01', title: 'Prepare construction contract', divName: DIV_00, wpName: 'Contracting', seq: 'contracting', anchor: 'contract-draft', crew: 1, unit: 'LS', trade: 'General Contractor', action: 'Prepare the construction agreement with scope, contract amount, payment terms, schedule, exclusions, and owner responsibilities.' }),
  t({ code: '00-02-02', title: 'Review construction contract', divName: DIV_00, wpName: 'Contracting', seq: 'contracting', anchor: 'contract-review', crew: 1, unit: 'LS', trade: 'Owner / General Contractor', action: 'Review contract terms, exhibits, drawings, specifications, allowances, and required attachments before signature.' }),
  t({ code: '00-02-03', title: 'Execute construction contract', divName: DIV_00, wpName: 'Contracting', seq: 'contracting', anchor: 'contract-execution', crew: 1, unit: 'LS', trade: 'Owner / General Contractor', action: 'Execute the contract and establish the formal agreement for construction.' }),
  t({ code: '00-02-04', title: 'Collect initial deposit', divName: DIV_00, wpName: 'Contracting', seq: 'contracting', anchor: 'initial-deposit', crew: 1, unit: 'LS', trade: 'General Contractor / Owner', action: 'Collect the contract-required initial deposit or mobilization payment before releasing work.' }),
  t({ code: '00-02-05', title: 'Issue notice to proceed', divName: DIV_00, wpName: 'Contracting', type: 'milestone', seq: 'contracting', anchor: 'notice-to-proceed', crew: 1, dur: 0, unit: 'LS', trade: 'Owner / General Contractor', action: 'Issue formal notice to proceed after contract execution, deposit, permits, and required startup conditions are satisfied.' }),

  // ── Division 00 — Subcontracting ─────────────────────────────────────────
  t({ code: '00-03-01', title: 'Prepare subcontract agreements', divName: DIV_00, wpName: 'Subcontracting', seq: 'contracting', anchor: 'subcontract-draft', crew: 1, unit: 'LS', trade: 'General Contractor', action: 'Prepare subcontract agreements for selected trade partners with scope, price, schedule, insurance, and payment terms.' }),
  t({ code: '00-03-02', title: 'Execute subcontract agreements', divName: DIV_00, wpName: 'Subcontracting', seq: 'contracting', anchor: 'subcontract-execution', crew: 1, unit: 'LS', trade: 'General Contractor / Subcontractor', action: 'Execute subcontract agreements before releasing subcontractor field work.' }),
  t({ code: '00-03-03', title: 'Collect subcontractor insurance documents', divName: DIV_00, wpName: 'Subcontracting', seq: 'contracting', anchor: 'subcontractor-insurance', crew: 1, unit: 'LS', trade: 'General Contractor / Subcontractor', action: 'Collect certificates of insurance, licenses, bonds, and compliance documents required before field mobilization.' }),

  // ── Division 00 — Procurement Controls ───────────────────────────────────
  t({ code: '00-04-01', title: 'Prepare procurement log', divName: DIV_00, wpName: 'Procurement Controls', seq: 'procurement', anchor: 'procurement-log', crew: 1, unit: 'LS', trade: 'General Contractor / Scheduler', action: 'Create a procurement log for long-lead materials, owner selections, submittals, approvals, order dates, and delivery dates.' }),
  t({ code: '00-04-02', title: 'Release long-lead material orders', divName: DIV_00, wpName: 'Procurement Controls', seq: 'procurement', anchor: 'long-lead-release', crew: 1, unit: 'LS', trade: 'General Contractor / Procurement', action: 'Release approved long-lead materials such as windows, doors, trusses, cabinets, countertops, equipment, or specialty items.' }),
  t({ code: '00-04-03', title: 'Track material delivery status', divName: DIV_00, wpName: 'Procurement Controls', seq: 'procurement', anchor: 'delivery-tracking', crew: 1, unit: 'LS', trade: 'General Contractor / Procurement', action: 'Track vendor confirmations, shipping dates, delivery windows, and delayed material risks.' }),

  // ── Division 01 — Preconstruction & Mobilization ─────────────────────────
  t({ code: '01-01-01', title: 'Project kickoff meeting', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'preconstruction', crew: 1, unit: 'LS', trade: 'General Contractor / PM', action: 'Formal preconstruction kickoff establishing parties, communication path, and start.' }),
  t({ code: '01-01-02', title: 'Baseline schedule issuance', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'preconstruction', crew: 1, unit: 'LS', trade: 'General Contractor / Scheduler', action: 'Publish initial approved logic schedule and baseline dates for trade release.' }),
  t({ code: '01-01-03', title: 'Building permit package submission', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'permitting', crew: 1, unit: 'LS', trade: 'General Contractor / PM', action: 'Submit permit application, drawings, and required documents to AHJ.' }),
  t({ code: '01-01-04', title: 'Building permit approval received', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'permitting', crew: 1, unit: 'LS', trade: 'Municipal Building Department', action: 'Record permit issuance as the authorization-to-start gate.' }),
  t({ code: '01-01-05', title: 'Utility locate request', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'utility-locate', crew: 1, unit: 'LS', trade: 'General Contractor / PM', action: 'Request underground utility locates before excavation and trenching.' }),
  t({ code: '01-01-06', title: 'Temporary construction entrance setup', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'mobilization', crew: 2, unit: 'LS', trade: 'General Contractor', action: 'Establish stabilized site access for equipment and material deliveries.' }),
  t({ code: '01-01-07', title: 'Site mobilization', divName: DIV_01, wpName: 'Preconstruction & Mobilization', seq: 'preconstruction', anchor: 'mobilization', crew: 2, unit: 'LS', trade: 'General Contractor', action: 'Deliver small tools, field materials, signage, and startup support equipment.' }),

  // ── Division 01 — Municipal Inspections ──────────────────────────────────
  t({ code: '01-02-01', title: 'Municipal footing inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'footing-inspection', crew: 1, trade: 'Municipal Building Inspector', action: 'AHJ gate for footing excavation, forms, and reinforcement before placement.' }),
  t({ code: '01-02-02', title: 'Municipal foundation wall inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'foundation-inspection', crew: 1, trade: 'Municipal Building Inspector', action: 'AHJ gate for wall forms, rebar, embedments, and pre-pour readiness.' }),
  t({ code: '01-02-03', title: 'Municipal under-slab plumbing inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'underslab-plumbing-inspection', crew: 1, trade: 'Municipal Plumbing Inspector', action: 'AHJ gate for underground DWV before trench backfill and slab prep.' }),
  t({ code: '01-02-04', title: 'Municipal under-slab electrical inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'underslab-electrical-inspection', crew: 1, trade: 'Municipal Electrical Inspector', action: 'AHJ gate for under-slab raceways or required conduits before cover-up.' }),
  t({ code: '01-02-05', title: 'Municipal slab pre-pour inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'slab-prepour-inspection', crew: 1, trade: 'Municipal Building Inspector', action: 'AHJ gate for vapor layer, reinforcement, and slab readiness before pour.' }),
  t({ code: '01-02-06', title: 'Municipal rough framing inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'framing-inspection', crew: 1, trade: 'Municipal Building Inspector', action: 'AHJ gate for structural framing, wall bracing, and roof framing readiness.' }),
  t({ code: '01-02-07', title: 'Municipal rough plumbing inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'rough-plumbing-inspection', crew: 1, trade: 'Municipal Plumbing Inspector', action: 'AHJ gate for above-grade DWV, water, and gas rough-in.' }),
  t({ code: '01-02-08', title: 'Municipal rough mechanical inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'rough-mechanical-inspection', crew: 1, trade: 'Municipal Mechanical Inspector', action: 'AHJ gate for ducts, exhaust, vents, and mechanical rough systems.' }),
  t({ code: '01-02-09', title: 'Municipal rough electrical inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'rough-electrical-inspection', crew: 1, trade: 'Municipal Electrical Inspector', action: 'AHJ gate for service, boxes, branch wiring, and rough electrical work.' }),
  t({ code: '01-02-10', title: 'Municipal insulation inspection', divName: DIV_01, wpName: 'Municipal Inspections', type: 'inspection', seq: 'inspection-gate', anchor: 'insulation-inspection', crew: 1, trade: 'Municipal Building Inspector', action: 'AHJ gate for insulation and visible enclosure components before close-in.' }),

  // ── Division 01 — Milestones & Closeout ──────────────────────────────────
  t({ code: '01-03-01', title: 'Milestone foundation complete', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'milestone', seq: 'milestone', anchor: 'milestone-foundation', crew: 1, dur: 0, unit: 'LS', trade: 'General Contractor / PM', action: 'Record footing, foundation wall, and substructure completion.' }),
  t({ code: '01-03-02', title: 'Milestone framing complete', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'milestone', seq: 'milestone', anchor: 'milestone-framing', crew: 1, dur: 0, unit: 'LS', trade: 'General Contractor / PM', action: 'Record structural floor, wall, roof framing, and sheathing completion.' }),
  t({ code: '01-03-03', title: 'Milestone dried-in', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'milestone', seq: 'milestone', anchor: 'milestone-dried-in', crew: 1, dur: 0, unit: 'LS', trade: 'General Contractor / PM', action: 'Record enclosure reach-point after WRB, underlayment, and roofing.' }),
  t({ code: '01-03-04', title: 'Milestone rough-in complete', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'milestone', seq: 'milestone', anchor: 'milestone-rough-in', crew: 1, dur: 0, unit: 'LS', trade: 'General Contractor / PM', action: 'Record all rough plumbing, HVAC, electrical, and communications complete.' }),
  t({ code: '01-03-05', title: 'Final building inspection', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'inspection', seq: 'closeout', anchor: 'final-inspection', crew: 1, trade: 'Municipal Building Department', action: 'Final physical structural check to secure building occupancy sign-off.' }),
  t({ code: '01-03-06', title: 'Post-construction deep clean', divName: DIV_01, wpName: 'Milestones & Closeout', seq: 'closeout', anchor: 'final-clean', crew: 3, unit: 'LS', trade: 'Cleaning Crew', action: 'Scrub millwork, clean windows, vacuum, and clear trade dust.' }),
  t({ code: '01-03-07', title: 'Punch list walkthrough', divName: DIV_01, wpName: 'Milestones & Closeout', seq: 'closeout', anchor: 'punch-walkthrough', crew: 2, unit: 'LS', trade: 'General Contractor / PM', action: 'Owner walk to log outstanding finish and quality items.' }),
  t({ code: '01-03-08', title: 'Punch list corrections', divName: DIV_01, wpName: 'Milestones & Closeout', seq: 'closeout', anchor: 'punch-corrections', crew: 2, unit: 'LS', trade: 'General Contractor', action: 'Correct and close out the logged punch list items.' }),
  t({ code: '01-03-09', title: 'Final turnover and warranty handoff', divName: DIV_01, wpName: 'Milestones & Closeout', type: 'milestone', seq: 'closeout', anchor: 'turnover', crew: 1, dur: 0, unit: 'LS', trade: 'General Contractor / PM', action: 'Hand over keys, documents, and warranty package to the owner.' }),

  // ── Division 31 — Site Prep & Grading ────────────────────────────────────
  t({ code: '31-01-01', title: 'Site control and benchmark staking', divName: DIV_31, wpName: 'Site Prep & Grading', seq: 'sitework', anchor: 'site-layout', crew: 2, unit: 'LS', trade: 'Surveyor', action: 'Establish horizontal and vertical control for footprint and elevations.' }),
  t({ code: '31-01-02', title: 'Building footprint layout', divName: DIV_31, wpName: 'Site Prep & Grading', seq: 'sitework', anchor: 'site-layout', crew: 2, unit: 'LS', trade: 'Surveyor', action: 'Stake corners, foundation lines, and offsets for earthwork and concrete.' }),
  t({ code: '31-01-03', title: 'Clear building footprint', divName: DIV_31, wpName: 'Site Prep & Grading', seq: 'sitework', anchor: 'site-clearing', crew: 3, unit: 'SF', trade: 'Earthwork', action: 'Remove vegetation and minor obstructions within the construction area.', weatherSensitive: true }),
  t({ code: '31-01-04', title: 'Strip topsoil at building pad', divName: DIV_31, wpName: 'Site Prep & Grading', seq: 'earthwork', anchor: 'earthwork', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Remove unsuitable topsoil from the pad and working zone.', weatherSensitive: true }),
  t({ code: '31-01-05', title: 'Rough grade building pad', divName: DIV_31, wpName: 'Site Prep & Grading', seq: 'earthwork', anchor: 'rough-grade', crew: 3, unit: 'SF', trade: 'Earthwork', action: 'Establish preliminary pad elevation and working surface for excavation.', weatherSensitive: true }),

  // ── Division 31 — Excavation ─────────────────────────────────────────────
  t({ code: '31-02-01', title: 'Excavate footing trenches', divName: DIV_31, wpName: 'Excavation', seq: 'earthwork', anchor: 'excavation', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Excavate continuous footing trenches to required width and depth.', weatherSensitive: true }),
  t({ code: '31-02-02', title: 'Fine grade footing bottoms', divName: DIV_31, wpName: 'Excavation', seq: 'earthwork', anchor: 'excavation', crew: 2, unit: 'LF', trade: 'Earthwork', action: 'Trim footing trench bottoms to final bearing elevation before formwork.' }),
  t({ code: '31-02-03', title: 'Excavate crawlspace interior', divName: DIV_31, wpName: 'Excavation', seq: 'earthwork', anchor: 'excavation', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Lower crawlspace interior to design subgrade for the crawlspace variant.', weatherSensitive: true, variant: 'crawlspace' }),
  t({ code: '31-02-04', title: 'Excavate slab area to subgrade', divName: DIV_31, wpName: 'Excavation', seq: 'earthwork', anchor: 'excavation', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Lower slab-on-grade interior to design subgrade for the slab variant.', weatherSensitive: true, variant: 'slab_on_grade' }),

  // ── Division 31 — Utility Trenching ──────────────────────────────────────
  t({ code: '31-03-01', title: 'Trench sanitary building drain route', divName: DIV_31, wpName: 'Utility Trenching', seq: 'earthwork', anchor: 'utility-trench', crew: 2, unit: 'LF', trade: 'Earthwork', action: 'Excavate trench path for the underground sanitary building drain.' }),
  t({ code: '31-03-02', title: 'Trench domestic water service route', divName: DIV_31, wpName: 'Utility Trenching', seq: 'earthwork', anchor: 'utility-trench', crew: 2, unit: 'LF', trade: 'Earthwork', action: 'Excavate trench path for the incoming domestic water service.' }),
  t({ code: '31-03-03', title: 'Trench electrical service route', divName: DIV_31, wpName: 'Utility Trenching', seq: 'earthwork', anchor: 'utility-trench', crew: 2, unit: 'LF', trade: 'Earthwork', action: 'Excavate trench path for required underground electrical service raceways.' }),
  t({ code: '31-03-04', title: 'Place utility trench bedding', divName: DIV_31, wpName: 'Utility Trenching', seq: 'earthwork', anchor: 'utility-trench', crew: 2, unit: 'CY', trade: 'Earthwork', action: 'Install approved bedding material below underground lines and conduits.' }),

  // ── Division 31 — Backfill & Grading ─────────────────────────────────────
  t({ code: '31-04-01', title: 'Backfill utility trenches', divName: DIV_31, wpName: 'Backfill & Grading', seq: 'earthwork', anchor: 'backfill', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Backfill utility trenches after inspection and accepted rough utilities.' }),
  t({ code: '31-04-02', title: 'Compact utility trench backfill', divName: DIV_31, wpName: 'Backfill & Grading', seq: 'earthwork', anchor: 'backfill', crew: 2, unit: 'CY', trade: 'Earthwork', action: 'Compact trench backfill in lifts to support slab and adjacent grade.' }),
  t({ code: '31-04-03', title: 'Backfill foundation perimeter', divName: DIV_31, wpName: 'Backfill & Grading', seq: 'earthwork', anchor: 'backfill', crew: 3, unit: 'CY', trade: 'Earthwork', action: 'Return approved fill along the exterior face of completed foundation walls.' }),
  t({ code: '31-04-04', title: 'Compact foundation backfill', divName: DIV_31, wpName: 'Backfill & Grading', seq: 'earthwork', anchor: 'backfill', crew: 2, unit: 'CY', trade: 'Earthwork', action: 'Compact perimeter backfill in lifts to reduce settlement risk.' }),
  t({ code: '31-04-05', title: 'Fine grade around foundation', divName: DIV_31, wpName: 'Backfill & Grading', seq: 'earthwork', anchor: 'backfill', crew: 2, unit: 'SF', trade: 'Earthwork', action: 'Shape surface grades to direct water away from the foundation perimeter.' }),

  // ── Division 31 — Foundation Drainage ────────────────────────────────────
  t({ code: '31-05-01', title: 'Install foundation perimeter drain tile', divName: DIV_31, wpName: 'Foundation Drainage', seq: 'earthwork', anchor: 'foundation-drainage', crew: 2, unit: 'LF', trade: 'Earthwork', action: 'Lay perforated drain pipe in crushed stone along the exterior footing base.' }),

  // ── Division 03 — Footing Concrete ───────────────────────────────────────
  t({ code: '03-01-01', title: 'Set footing forms', divName: DIV_03, wpName: 'Footing Concrete', seq: 'foundation', anchor: 'footing-forms', crew: 3, unit: 'LF', trade: 'Concrete', action: 'Set and brace continuous footing forms to line and grade.', weatherSensitive: true }),
  t({ code: '03-01-02', title: 'Place footing reinforcement', divName: DIV_03, wpName: 'Footing Concrete', seq: 'foundation', anchor: 'footing-rebar', crew: 2, unit: 'LF', trade: 'Concrete / Rebar', action: 'Place continuous footing rebar with required laps and clearances.', inspectionRequired: true }),
  t({ code: '03-01-03', title: 'Place footing concrete', divName: DIV_03, wpName: 'Footing Concrete', seq: 'foundation', anchor: 'footing-concrete', crew: 4, unit: 'CY', trade: 'Concrete', action: 'Place and consolidate footing concrete after the footing inspection.', weatherSensitive: true, csiDivisionCode: '03', csiSectionCode: '03 30 00' }),
  t({ code: '03-01-04', title: 'Foundation concrete curing period', divName: DIV_03, wpName: 'Footing Concrete', type: 'curing_lag', seq: 'foundation', anchor: 'footing-cure', crew: 0, dur: 7, unit: 'DAY', trade: 'Concrete', action: 'Required cure/strength-gain lag before loading footings with wall work.' }),
  t({ code: '03-01-05', title: 'Strip footing forms', divName: DIV_03, wpName: 'Footing Concrete', seq: 'foundation', anchor: 'footing-strip', crew: 2, unit: 'LF', trade: 'Concrete', action: 'Remove footing forms after initial strength gain.' }),

  // ── Division 03 — Foundation Walls ───────────────────────────────────────
  t({ code: '03-02-01', title: 'Set foundation wall forms', divName: DIV_03, wpName: 'Foundation Walls', seq: 'foundation', anchor: 'wall-forms', crew: 4, unit: 'SF', trade: 'Concrete', action: 'Erect and brace foundation wall forms on cured footings.' }),
  t({ code: '03-02-02', title: 'Place foundation wall reinforcement', divName: DIV_03, wpName: 'Foundation Walls', seq: 'foundation', anchor: 'wall-rebar', crew: 2, unit: 'SF', trade: 'Concrete / Rebar', action: 'Install wall rebar, embeds, and anchor bolts before pour.', inspectionRequired: true }),
  t({ code: '03-02-03', title: 'Place foundation wall concrete', divName: DIV_03, wpName: 'Foundation Walls', seq: 'foundation', anchor: 'wall-concrete', crew: 4, unit: 'CY', trade: 'Concrete', action: 'Place and consolidate wall concrete after the foundation inspection.', weatherSensitive: true }),
  t({ code: '03-02-04', title: 'Strip foundation wall forms', divName: DIV_03, wpName: 'Foundation Walls', seq: 'foundation', anchor: 'wall-strip', crew: 3, unit: 'SF', trade: 'Concrete', action: 'Remove wall forms after concrete reaches stripping strength.' }),
  t({ code: '03-02-05', title: 'Apply foundation damp-proofing', divName: DIV_03, wpName: 'Foundation Walls', seq: 'foundation', anchor: 'dampproofing', crew: 2, unit: 'SF', trade: 'Waterproofing', action: 'Coat exterior foundation walls below grade before backfill.', weatherSensitive: true }),

  // ── Division 03 — Slab Preparation ───────────────────────────────────────
  t({ code: '03-03-01', title: 'Place slab subbase stone', divName: DIV_03, wpName: 'Slab Preparation', seq: 'foundation', anchor: 'slab-subbase', crew: 3, unit: 'CY', trade: 'Concrete', action: 'Place and level capillary-break stone beneath the slab.', variant: 'slab_on_grade' }),
  t({ code: '03-03-02', title: 'Install slab vapor barrier', divName: DIV_03, wpName: 'Slab Preparation', seq: 'foundation', anchor: 'vapor-barrier', crew: 2, unit: 'SF', trade: 'Concrete', action: 'Lay and lap vapor retarder over subbase before reinforcement.', variant: 'slab_on_grade' }),
  t({ code: '03-03-03', title: 'Place slab reinforcement', divName: DIV_03, wpName: 'Slab Preparation', seq: 'foundation', anchor: 'slab-rebar', crew: 2, unit: 'SF', trade: 'Concrete / Rebar', action: 'Set slab mesh or rebar on chairs before the slab pre-pour inspection.', inspectionRequired: true, variant: 'slab_on_grade' }),

  // ── Division 03 — Slab Placement ─────────────────────────────────────────
  t({ code: '03-04-01', title: 'Place slab-on-grade concrete', divName: DIV_03, wpName: 'Slab Placement', seq: 'foundation', anchor: 'slab-on-grade', crew: 5, unit: 'CY', trade: 'Concrete', action: 'Place, screed, float, and finish the interior slab after pre-pour gate.', weatherSensitive: true, variant: 'slab_on_grade' }),
  t({ code: '03-04-02', title: 'Slab concrete curing period', divName: DIV_03, wpName: 'Slab Placement', type: 'curing_lag', seq: 'foundation', anchor: 'slab-cure', crew: 0, dur: 7, unit: 'DAY', trade: 'Concrete', action: 'Required slab cure lag before framing loads and floor finishes.', variant: 'slab_on_grade' }),

  // ── Division 03 — Flatwork ───────────────────────────────────────────────
  t({ code: '03-05-01', title: 'Form exterior flatwork', divName: DIV_03, wpName: 'Flatwork', seq: 'exterior', anchor: 'flatwork-forms', crew: 3, unit: 'LF', trade: 'Concrete', action: 'Set forms for driveway, walks, and exterior slabs to grade.', weatherSensitive: true }),
  t({ code: '03-05-02', title: 'Place concrete driveway', divName: DIV_03, wpName: 'Flatwork', seq: 'exterior', anchor: 'flatwork-driveway', crew: 5, unit: 'SF', trade: 'Concrete', action: 'Place and finish the driveway slab.', weatherSensitive: true }),
  t({ code: '03-05-03', title: 'Place concrete walkways', divName: DIV_03, wpName: 'Flatwork', seq: 'exterior', anchor: 'flatwork-walks', crew: 4, unit: 'SF', trade: 'Concrete', action: 'Place and finish exterior walkway slabs.', weatherSensitive: true }),

  // ── Division 02 — Existing Conditions ────────────────────────────────────
  t({ code: '02-01-01', title: 'Perform preconstruction existing conditions survey', divName: DIV_02, wpName: 'Existing Conditions', seq: 'preconstruction', anchor: 'existing-conditions-survey', crew: 1, unit: 'LS', trade: 'General Contractor', action: 'Document existing site, structure, access, utilities, and adjacent conditions before work begins.' }),
  t({ code: '02-01-02', title: 'Protect existing site features', divName: DIV_02, wpName: 'Existing Conditions', seq: 'preconstruction', anchor: 'site-protection', crew: 2, unit: 'LS', trade: 'General Contractor', action: 'Install protection for existing walks, drives, landscaping, utilities, and adjacent improvements to remain.' }),
  t({ code: '02-01-03', title: 'Disconnect existing utilities', divName: DIV_02, wpName: 'Existing Conditions', seq: 'preconstruction', anchor: 'utility-disconnect', crew: 2, unit: 'LS', trade: 'Utility / Licensed Trade', action: 'Coordinate and complete required utility disconnects before demolition or tie-in work.', inspectionRequired: true }),

  // ── Division 02 — Selective Demolition ───────────────────────────────────
  t({ code: '02-02-01', title: 'Remove existing exterior improvements', divName: DIV_02, wpName: 'Selective Demolition', seq: 'demolition', anchor: 'remove-exterior-improvements', crew: 3, unit: 'LS', trade: 'Demolition', action: 'Remove existing exterior slabs, walks, fencing, sheds, minor paving, or site items within the work area.', weatherSensitive: true }),
  t({ code: '02-02-02', title: 'Remove existing interior finishes', divName: DIV_02, wpName: 'Selective Demolition', seq: 'demolition', anchor: 'remove-interior-finishes', crew: 3, unit: 'SF', trade: 'Demolition', action: 'Remove existing flooring, wall finishes, ceiling finishes, cabinets, fixtures, and trim scheduled for demolition.' }),
  t({ code: '02-02-03', title: 'Remove existing nonstructural partitions', divName: DIV_02, wpName: 'Selective Demolition', seq: 'demolition', anchor: 'remove-nonstructural-partitions', crew: 3, unit: 'LF', trade: 'Demolition', action: 'Remove non-load-bearing walls and partitions after confirming structural status.' }),
  t({ code: '02-02-04', title: 'Remove existing doors and windows', divName: DIV_02, wpName: 'Selective Demolition', seq: 'demolition', anchor: 'remove-doors-windows', crew: 2, unit: 'EA', trade: 'Demolition', action: 'Remove doors, frames, windows, and related trim scheduled for replacement.', weatherSensitive: true }),
  t({ code: '02-02-05', title: 'Remove existing roofing material', divName: DIV_02, wpName: 'Selective Demolition', seq: 'demolition', anchor: 'remove-roofing', crew: 4, unit: 'SQ', trade: 'Roofing / Demolition', action: 'Remove existing roof covering, underlayment, damaged flashing, and roofing debris.', weatherSensitive: true }),

  // ── Division 02 — Debris Management ───────────────────────────────────────
  t({ code: '02-03-01', title: 'Haul demolition debris', divName: DIV_02, wpName: 'Debris Management', seq: 'demolition', anchor: 'debris-haul', crew: 2, unit: 'LOAD', trade: 'Demolition', action: 'Load, haul, and dispose of demolition debris in approved containers or disposal facilities.' }),
  t({ code: '02-03-02', title: 'Clean demolition work area', divName: DIV_02, wpName: 'Debris Management', seq: 'demolition', anchor: 'demo-cleanup', crew: 2, unit: 'LS', trade: 'Demolition', action: 'Sweep, clear, and prepare demolished areas for layout, framing, or follow-on trade work.' }),

  // ── Division 04 — Masonry Layout & Accessories ───────────────────────────
  t({ code: '04-01-01', title: 'Layout masonry walls', divName: DIV_04, wpName: 'Masonry Layout', seq: 'masonry', anchor: 'masonry-layout', crew: 2, unit: 'LF', trade: 'Masonry', action: 'Snap lines and verify masonry wall locations, corners, openings, and control points.' }),
  t({ code: '04-01-02', title: 'Install masonry flashing and weeps', divName: DIV_04, wpName: 'Masonry Accessories', seq: 'masonry', anchor: 'masonry-flashing-weeps', crew: 2, unit: 'LF', trade: 'Masonry', action: 'Install flashing, weeps, and drainage accessories at masonry veneer or cavity wall locations.', weatherSensitive: true }),
  t({ code: '04-01-03', title: 'Install masonry wall ties', divName: DIV_04, wpName: 'Masonry Accessories', seq: 'masonry', anchor: 'masonry-wall-ties', crew: 2, unit: 'EA', trade: 'Masonry', action: 'Install anchors, ties, and connectors required to secure masonry veneer to the backup wall.' }),

  // ── Division 04 — Concrete Masonry Units ─────────────────────────────────
  t({ code: '04-02-01', title: 'Lay CMU foundation wall', divName: DIV_04, wpName: 'Concrete Masonry Units', seq: 'masonry', anchor: 'cmu-foundation-wall', crew: 4, unit: 'SF', trade: 'Masonry', action: 'Lay concrete masonry units for foundation, stem wall, or crawlspace wall construction.', weatherSensitive: true }),
  t({ code: '04-02-02', title: 'Install CMU reinforcement', divName: DIV_04, wpName: 'Concrete Masonry Units', seq: 'masonry', anchor: 'cmu-reinforcement', crew: 2, unit: 'LF', trade: 'Masonry / Rebar', action: 'Install vertical and horizontal reinforcement in CMU cells and bond beams.', inspectionRequired: true }),
  t({ code: '04-02-03', title: 'Grout reinforced CMU cells', divName: DIV_04, wpName: 'Concrete Masonry Units', seq: 'masonry', anchor: 'cmu-grout', crew: 3, unit: 'CY', trade: 'Masonry', action: 'Place grout in reinforced CMU cells, bond beams, and required masonry cores.', weatherSensitive: true }),
  t({ code: '04-02-04', title: 'Tool CMU mortar joints', divName: DIV_04, wpName: 'Concrete Masonry Units', seq: 'masonry', anchor: 'cmu-joint-tooling', crew: 2, unit: 'SF', trade: 'Masonry', action: 'Tool and finish CMU mortar joints after units are laid and initial set occurs.' }),

  // ── Division 04 — Brick Veneer ───────────────────────────────────────────
  t({ code: '04-03-01', title: 'Lay brick veneer', divName: DIV_04, wpName: 'Brick Veneer', seq: 'masonry', anchor: 'brick-veneer', crew: 4, unit: 'SF', trade: 'Masonry', action: 'Lay brick veneer with mortar joints, alignment control, and required clearances.', weatherSensitive: true }),
  t({ code: '04-03-02', title: 'Install masonry lintels', divName: DIV_04, wpName: 'Brick Veneer', seq: 'masonry', anchor: 'masonry-lintels', crew: 2, unit: 'EA', trade: 'Masonry / Steel', action: 'Install lintels or shelf angles over masonry wall openings.', inspectionRequired: true }),
  t({ code: '04-03-03', title: 'Clean masonry veneer', divName: DIV_04, wpName: 'Brick Veneer', seq: 'masonry', anchor: 'masonry-cleaning', crew: 2, unit: 'SF', trade: 'Masonry', action: 'Clean mortar smears, residue, and surface stains from completed masonry veneer.' }),

  // ── Division 05 — Structural Steel ───────────────────────────────────────
  t({ code: '05-01-01', title: 'Receive structural steel materials', divName: DIV_05, wpName: 'Structural Steel', seq: 'metals', anchor: 'steel-delivery', crew: 2, unit: 'LS', trade: 'Steel', action: 'Receive, inspect, and stage structural steel beams, columns, plates, and connectors.' }),
  t({ code: '05-01-02', title: 'Install steel columns', divName: DIV_05, wpName: 'Structural Steel', seq: 'metals', anchor: 'steel-columns', crew: 3, unit: 'EA', trade: 'Steel', action: 'Set structural steel columns, verify plumb, and secure base connections.', inspectionRequired: true }),
  t({ code: '05-01-03', title: 'Install steel beams', divName: DIV_05, wpName: 'Structural Steel', seq: 'metals', anchor: 'steel-beams', crew: 4, unit: 'EA', trade: 'Steel', action: 'Set steel beams, align bearing points, and secure bolted or welded connections.', inspectionRequired: true }),
  t({ code: '05-01-04', title: 'Install steel bearing plates', divName: DIV_05, wpName: 'Structural Steel', seq: 'metals', anchor: 'steel-bearing-plates', crew: 2, unit: 'EA', trade: 'Steel', action: 'Install bearing plates, shims, anchors, and required seat plates for structural support.' }),
  t({ code: '05-01-05', title: 'Install steel connectors and hardware', divName: DIV_05, wpName: 'Structural Steel', seq: 'metals', anchor: 'steel-connectors', crew: 2, unit: 'EA', trade: 'Steel / Framing', action: 'Install hangers, straps, hold-downs, anchors, and other metal structural connectors.', inspectionRequired: true }),
  t({ code: '05-01-06', title: 'Perform structural steel inspection', divName: DIV_05, wpName: 'Structural Steel', type: 'inspection', seq: 'inspection-gate', anchor: 'steel-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Inspect steel member placement, connections, anchors, and bearing conditions before cover-up.' }),

  // ── Division 05 — Miscellaneous Metals ───────────────────────────────────
  t({ code: '05-02-01', title: 'Install metal stair components', divName: DIV_05, wpName: 'Miscellaneous Metals', seq: 'metals', anchor: 'metal-stairs', crew: 3, unit: 'EA', trade: 'Miscellaneous Metals', action: 'Install metal stair stringers, brackets, supports, or prefabricated stair components.' }),
  t({ code: '05-02-02', title: 'Install metal railings', divName: DIV_05, wpName: 'Miscellaneous Metals', seq: 'metals', anchor: 'metal-railings', crew: 3, unit: 'LF', trade: 'Miscellaneous Metals', action: 'Install metal guardrails, handrails, brackets, and posts at stairs, decks, or balconies.', inspectionRequired: true }),
  t({ code: '05-02-03', title: 'Install metal access panels', divName: DIV_05, wpName: 'Miscellaneous Metals', seq: 'metals', anchor: 'metal-access-panels', crew: 2, unit: 'EA', trade: 'Miscellaneous Metals', action: 'Install metal access panels, frames, grilles, or miscellaneous metal inserts.' }),

  // ── Division 10 — Accessory Blocking ─────────────────────────────────────
  t({ code: '10-01-01', title: 'Install bath accessories blocking', divName: DIV_10, wpName: 'Accessory Blocking', seq: 'specialties', anchor: 'bath-accessory-blocking', crew: 2, unit: 'EA', trade: 'Carpentry', action: 'Install wall backing for toilet accessories, grab bars, mirrors, and specialty fixtures before drywall.' }),
  t({ code: '10-01-02', title: 'Install closet shelving blocking', divName: DIV_10, wpName: 'Accessory Blocking', seq: 'specialties', anchor: 'closet-blocking', crew: 2, unit: 'LF', trade: 'Carpentry', action: 'Install backing for closet shelving, rods, storage systems, and owner-selected specialty supports.' }),

  // ── Division 10 — Toilet and Bath Accessories ────────────────────────────
  t({ code: '10-02-01', title: 'Install bathroom mirrors', divName: DIV_10, wpName: 'Toilet and Bath Accessories', seq: 'specialties', anchor: 'bath-mirrors', crew: 2, unit: 'EA', trade: 'Specialties', action: 'Install bathroom mirrors after wall finishes and vanities are complete.' }),
  t({ code: '10-02-02', title: 'Install toilet paper holders', divName: DIV_10, wpName: 'Toilet and Bath Accessories', seq: 'specialties', anchor: 'toilet-paper-holders', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install toilet paper holders at finished bathroom walls.' }),
  t({ code: '10-02-03', title: 'Install towel bars and robe hooks', divName: DIV_10, wpName: 'Toilet and Bath Accessories', seq: 'specialties', anchor: 'towel-bars-hooks', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install towel bars, towel rings, robe hooks, and similar bath accessories.' }),
  t({ code: '10-02-04', title: 'Install shower accessories', divName: DIV_10, wpName: 'Toilet and Bath Accessories', seq: 'specialties', anchor: 'shower-accessories', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install shower rods, shower doors, niches, shelves, or other specified shower accessories.' }),

  // ── Division 10 — Storage, Access & Safety Specialties ───────────────────
  t({ code: '10-03-01', title: 'Install closet shelving', divName: DIV_10, wpName: 'Storage Specialties', seq: 'specialties', anchor: 'closet-shelving', crew: 2, unit: 'LF', trade: 'Specialties', action: 'Install closet shelving, rods, brackets, and storage accessories after interior paint.' }),
  t({ code: '10-03-02', title: 'Install attic access panel', divName: DIV_10, wpName: 'Access Specialties', seq: 'specialties', anchor: 'attic-access-panel', crew: 2, unit: 'EA', trade: 'Specialties / Carpentry', action: 'Install attic access panel, pull-down stair, trim, and weatherstripping where required.' }),
  t({ code: '10-03-03', title: 'Install fire extinguisher cabinet', divName: DIV_10, wpName: 'Safety Specialties', seq: 'specialties', anchor: 'fire-extinguisher-cabinet', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install fire extinguisher cabinet or wall bracket where required by project scope.' }),

  // ── Division 10 — Exterior Specialties ───────────────────────────────────
  t({ code: '10-04-01', title: 'Install address numbers', divName: DIV_10, wpName: 'Exterior Specialties', seq: 'specialties', anchor: 'address-numbers', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install exterior address numbers or identification plaques before final inspection.' }),
  t({ code: '10-04-02', title: 'Install mailbox', divName: DIV_10, wpName: 'Exterior Specialties', seq: 'specialties', anchor: 'mailbox', crew: 1, unit: 'EA', trade: 'Specialties', action: 'Install mailbox, post, hardware, or wall-mounted mail receptacle according to project requirements.', weatherSensitive: true }),

  // ── Division 33 — Sanitary Sewer Service ─────────────────────────────────
  t({ code: '33-01-01', title: 'Install sanitary sewer service piping', divName: DIV_33, wpName: 'Sanitary Sewer Service', seq: 'utilities', anchor: 'sanitary-service-pipe', crew: 3, unit: 'LF', trade: 'Site Utilities / Plumbing', action: 'Install sanitary sewer service piping from building drain to public sewer or approved connection point.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-01-02', title: 'Install sanitary cleanouts', divName: DIV_33, wpName: 'Sanitary Sewer Service', seq: 'utilities', anchor: 'sanitary-cleanouts', crew: 2, unit: 'EA', trade: 'Site Utilities / Plumbing', action: 'Install exterior sanitary cleanouts at required intervals and direction changes.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-01-03', title: 'Test sanitary sewer service', divName: DIV_33, wpName: 'Sanitary Sewer Service', type: 'testing', seq: 'utilities', anchor: 'sanitary-test', crew: 1, unit: 'EA', trade: 'Site Utilities / Plumbing', action: 'Perform required sanitary sewer test before backfill or final connection approval.', inspectionRequired: true }),

  // ── Division 33 — Water Service ──────────────────────────────────────────
  t({ code: '33-02-01', title: 'Install domestic water service piping', divName: DIV_33, wpName: 'Water Service', seq: 'utilities', anchor: 'water-service-pipe', crew: 3, unit: 'LF', trade: 'Site Utilities / Plumbing', action: 'Install domestic water service piping from meter or well connection to building entry.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-02-02', title: 'Install water service valve box', divName: DIV_33, wpName: 'Water Service', seq: 'utilities', anchor: 'water-valve-box', crew: 2, unit: 'EA', trade: 'Site Utilities / Plumbing', action: 'Install curb stop, valve box, meter box, or required water service access box.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-02-03', title: 'Pressure test domestic water service', divName: DIV_33, wpName: 'Water Service', type: 'testing', seq: 'utilities', anchor: 'water-pressure-test', crew: 1, unit: 'EA', trade: 'Site Utilities / Plumbing', action: 'Pressure test domestic water service piping before backfill or final tie-in approval.', inspectionRequired: true }),

  // ── Division 33 — Storm Drainage ─────────────────────────────────────────
  t({ code: '33-03-01', title: 'Install storm drainage piping', divName: DIV_33, wpName: 'Storm Drainage', seq: 'utilities', anchor: 'storm-drain-pipe', crew: 3, unit: 'LF', trade: 'Site Utilities', action: 'Install storm drainage piping for roof drains, yard drains, area drains, or site drainage systems.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-03-02', title: 'Install storm drainage structures', divName: DIV_33, wpName: 'Storm Drainage', seq: 'utilities', anchor: 'storm-drain-structures', crew: 3, unit: 'EA', trade: 'Site Utilities', action: 'Install catch basins, drain boxes, cleanouts, or stormwater structures required by site design.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-03-03', title: 'Install downspout drain connections', divName: DIV_33, wpName: 'Storm Drainage', seq: 'utilities', anchor: 'downspout-drain-connections', crew: 2, unit: 'EA', trade: 'Site Utilities', action: 'Connect roof downspouts to underground drainage piping or approved splash/discharge locations.', weatherSensitive: true }),

  // ── Division 33 — Dry Utility Service ────────────────────────────────────
  t({ code: '33-04-01', title: 'Install underground electrical service conduit', divName: DIV_33, wpName: 'Electrical Utility Service', seq: 'utilities', anchor: 'utility-electrical-conduit', crew: 2, unit: 'LF', trade: 'Site Utilities / Electrical', action: 'Install underground electrical service conduit from utility source to service equipment location.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '33-04-02', title: 'Install communications service conduit', divName: DIV_33, wpName: 'Communications Utility Service', seq: 'utilities', anchor: 'utility-comms-conduit', crew: 2, unit: 'LF', trade: 'Site Utilities / Low Voltage', action: 'Install underground communications conduit from service point to structured media or entry location.', weatherSensitive: true }),

  // ── Division 33 — Utility Backfill ───────────────────────────────────────
  t({ code: '33-05-01', title: 'Backfill utility trenches', divName: DIV_33, wpName: 'Utility Backfill', seq: 'utilities', anchor: 'utility-backfill', crew: 3, unit: 'CY', trade: 'Site Utilities / Earthwork', action: 'Backfill utility trenches after inspections, tests, and accepted utility installation.', weatherSensitive: true }),
  t({ code: '33-05-02', title: 'Compact utility trench backfill', divName: DIV_33, wpName: 'Utility Backfill', seq: 'utilities', anchor: 'utility-compaction', crew: 2, unit: 'LF', trade: 'Site Utilities / Earthwork', action: 'Compact utility trench backfill in lifts to reduce settlement and support finished grades.', weatherSensitive: true }),

  // ── Division 06 — Sill & Floor Framing ───────────────────────────────────
  t({ code: '06-01-01', title: 'Install sill plates and anchors', divName: DIV_06, wpName: 'Sill & Floor Framing', seq: 'framing', anchor: 'sill-plate', crew: 2, unit: 'LF', trade: 'Carpentry / Framing', action: 'Set treated sill plates with sill seal on anchor bolts.', csiDivisionCode: '06', csiSectionCode: '06 10 00' }),
  t({ code: '06-01-02', title: 'Set girders and support columns', divName: DIV_06, wpName: 'Sill & Floor Framing', seq: 'framing', anchor: 'girder', crew: 3, unit: 'LF', trade: 'Carpentry / Framing', action: 'Install main beams and support posts for the floor system.' }),
  t({ code: '06-01-03', title: 'Frame floor joists', divName: DIV_06, wpName: 'Sill & Floor Framing', seq: 'framing', anchor: 'floor-joists', crew: 4, unit: 'SF', trade: 'Carpentry / Framing', action: 'Set and hang floor joists over the crawlspace foundation system.', variant: 'crawlspace' }),
  t({ code: '06-01-04', title: 'Install rim and blocking', divName: DIV_06, wpName: 'Sill & Floor Framing', seq: 'framing', anchor: 'floor-joists', crew: 2, unit: 'LF', trade: 'Carpentry / Framing', action: 'Install rim board and joist blocking for the crawlspace floor frame.', variant: 'crawlspace' }),
  t({ code: '06-01-05', title: 'Install subfloor sheathing', divName: DIV_06, wpName: 'Sill & Floor Framing', seq: 'framing', anchor: 'subfloor', crew: 4, unit: 'SF', trade: 'Carpentry / Framing', action: 'Glue and fasten subfloor panels to the joist system.', variant: 'crawlspace' }),

  // ── Division 06 — Wall Framing ───────────────────────────────────────────
  t({ code: '06-02-01', title: 'Frame exterior walls', divName: DIV_06, wpName: 'Wall Framing', seq: 'framing', anchor: 'wall-framing', crew: 5, unit: 'LF', trade: 'Carpentry / Framing', action: 'Build and stand exterior load-bearing wall panels with openings.' }),
  t({ code: '06-02-02', title: 'Frame interior partition walls', divName: DIV_06, wpName: 'Wall Framing', seq: 'framing', anchor: 'partition-framing', crew: 4, unit: 'LF', trade: 'Carpentry / Framing', action: 'Build and set interior partition walls per the floor plan.' }),
  t({ code: '06-02-03', title: 'Plumb and line walls', divName: DIV_06, wpName: 'Wall Framing', seq: 'framing', anchor: 'wall-bracing', crew: 3, unit: 'LF', trade: 'Carpentry / Framing', action: 'Straighten, plumb, and temporarily brace walls for stability.' }),

  // ── Division 06 — Roof & Ceiling Framing ─────────────────────────────────
  t({ code: '06-03-01', title: 'Set roof trusses', divName: DIV_06, wpName: 'Roof & Ceiling Framing', seq: 'framing', anchor: 'roof-structure', crew: 5, unit: 'EA', trade: 'Carpentry / Framing', action: 'Crane and set roof trusses at required spacing.', weatherSensitive: true }),
  t({ code: '06-03-02', title: 'Brace and tie roof trusses', divName: DIV_06, wpName: 'Roof & Ceiling Framing', seq: 'framing', anchor: 'roof-bracing', crew: 3, unit: 'EA', trade: 'Carpentry / Framing', action: 'Install permanent truss bracing and hurricane ties.' }),
  t({ code: '06-03-03', title: 'Install roof sheathing', divName: DIV_06, wpName: 'Roof & Ceiling Framing', seq: 'framing', anchor: 'roof-sheathing', crew: 4, unit: 'SF', trade: 'Carpentry / Framing', action: 'Fasten roof deck panels to the truss system.', weatherSensitive: true }),

  // ── Division 06 — Sheathing ──────────────────────────────────────────────
  t({ code: '06-04-01', title: 'Install wall sheathing', divName: DIV_06, wpName: 'Sheathing', seq: 'framing', anchor: 'wall-sheathing', crew: 4, unit: 'SF', trade: 'Carpentry / Framing', action: 'Fasten structural wall sheathing to the exterior wall frame.' }),
  t({ code: '06-04-02', title: 'Install exterior door and window bucks', divName: DIV_06, wpName: 'Sheathing', seq: 'framing', anchor: 'rough-openings', crew: 2, unit: 'EA', trade: 'Carpentry / Framing', action: 'Prepare and flash rough openings for exterior openings.', inspectionRequired: true }),

  // ── Division 07 — Weather Barrier ────────────────────────────────────────
  t({ code: '07-01-01', title: 'Install weather-resistive barrier', divName: DIV_07, wpName: 'Weather Barrier', seq: 'dry-in', anchor: 'wrb', crew: 3, unit: 'SF', trade: 'Exterior / Weatherproofing', action: 'Apply housewrap over wall sheathing with proper shingle-lap.', weatherSensitive: true }),
  t({ code: '07-01-02', title: 'Flash exterior openings', divName: DIV_07, wpName: 'Weather Barrier', seq: 'dry-in', anchor: 'opening-flashing', crew: 2, unit: 'EA', trade: 'Exterior / Weatherproofing', action: 'Install flashing and tape at window and door rough openings.', weatherSensitive: true }),

  // ── Division 07 — Roofing ────────────────────────────────────────────────
  t({ code: '07-02-01', title: 'Install roof underlayment', divName: DIV_07, wpName: 'Roofing', seq: 'dry-in', anchor: 'roof-underlayment', crew: 3, unit: 'SF', trade: 'Roofing', action: 'Apply underlayment and ice/water shield over the roof deck.', weatherSensitive: true }),
  t({ code: '07-02-02', title: 'Install roof flashing', divName: DIV_07, wpName: 'Roofing', seq: 'dry-in', anchor: 'roof-flashing', crew: 2, unit: 'LF', trade: 'Roofing', action: 'Install valley, step, and penetration flashing.', weatherSensitive: true }),
  t({ code: '07-02-03', title: 'Install roof shingles', divName: DIV_07, wpName: 'Roofing', seq: 'dry-in', anchor: 'roofing', crew: 4, unit: 'SF', trade: 'Roofing', action: 'Install finish roofing to complete the weather-tight roof.', weatherSensitive: true }),

  // ── Division 07 — Exterior Cladding ──────────────────────────────────────
  t({ code: '07-03-01', title: 'Install siding', divName: DIV_07, wpName: 'Exterior Cladding', seq: 'exterior', anchor: 'siding', crew: 4, unit: 'SF', trade: 'Exterior / Siding', action: 'Install exterior wall cladding over the weather barrier.', weatherSensitive: true }),
  t({ code: '07-03-02', title: 'Install exterior trim', divName: DIV_07, wpName: 'Exterior Cladding', seq: 'exterior', anchor: 'exterior-trim', crew: 3, unit: 'LF', trade: 'Exterior / Siding', action: 'Install corner boards, fascia, and exterior trim details.', weatherSensitive: true }),
  t({ code: '07-03-03', title: 'Install gutters and downspouts', divName: DIV_07, wpName: 'Exterior Cladding', seq: 'exterior', anchor: 'gutters', crew: 2, unit: 'LF', trade: 'Exterior', action: 'Install gutters and downspouts to manage roof drainage.', weatherSensitive: true }),

  // ── Division 07 — Sealants ───────────────────────────────────────────────
  t({ code: '07-04-01', title: 'Seal exterior penetrations and joints', divName: DIV_07, wpName: 'Sealants', seq: 'exterior', anchor: 'sealants', crew: 2, unit: 'LF', trade: 'Exterior / Weatherproofing', action: 'Caulk and seal exterior joints, penetrations, and transitions.', weatherSensitive: true }),

  // ── Division 07 — Insulation ─────────────────────────────────────────────
  t({ code: '07-05-01', title: 'Install wall insulation', divName: DIV_07, wpName: 'Insulation', seq: 'insulation', anchor: 'insulation', crew: 3, unit: 'SF', trade: 'Insulation', action: 'Install cavity insulation in exterior walls after rough-in approval.', inspectionRequired: true }),
  t({ code: '07-05-02', title: 'Install ceiling insulation', divName: DIV_07, wpName: 'Insulation', seq: 'insulation', anchor: 'insulation', crew: 3, unit: 'SF', trade: 'Insulation', action: 'Install attic or ceiling insulation to the required thermal value.', inspectionRequired: true }),
  t({ code: '07-05-03', title: 'Install crawlspace insulation', divName: DIV_07, wpName: 'Insulation', seq: 'insulation', anchor: 'insulation', crew: 2, unit: 'SF', trade: 'Insulation', action: 'Insulate the crawlspace floor or perimeter for the crawlspace variant.', variant: 'crawlspace' }),
  t({ code: '07-05-04', title: 'Install air sealing', divName: DIV_07, wpName: 'Insulation', seq: 'insulation', anchor: 'air-sealing', crew: 2, unit: 'LS', trade: 'Insulation', action: 'Seal penetrations and gaps to reduce air leakage before drywall.' }),

  // ── Division 08 — Exterior Openings ──────────────────────────────────────
  t({ code: '08-01-01', title: 'Install exterior windows', divName: DIV_08, wpName: 'Exterior Openings', seq: 'dry-in', anchor: 'windows', crew: 3, unit: 'EA', trade: 'Carpentry / Glazing', action: 'Set, flash, and fasten exterior windows in prepared openings.', weatherSensitive: true }),
  t({ code: '08-01-02', title: 'Install exterior doors', divName: DIV_08, wpName: 'Exterior Openings', seq: 'dry-in', anchor: 'exterior-doors', crew: 2, unit: 'EA', trade: 'Carpentry', action: 'Set and flash exterior doors to complete the building envelope.', weatherSensitive: true }),

  // ── Division 08 — Interior Openings ──────────────────────────────────────
  t({ code: '08-02-01', title: 'Hang interior doors', divName: DIV_08, wpName: 'Interior Openings', seq: 'trim-out', anchor: 'interior-doors', crew: 2, unit: 'EA', trade: 'Finish Carpentry', action: 'Hang and adjust interior doors and jambs after paint.' }),
  t({ code: '08-02-02', title: 'Install door hardware', divName: DIV_08, wpName: 'Interior Openings', seq: 'trim-out', anchor: 'door-hardware', crew: 1, unit: 'EA', trade: 'Finish Carpentry', action: 'Install locksets, hinges, and stops on interior doors.' }),

  // ── Division 22 — Under-Slab Plumbing ────────────────────────────────────
  t({ code: '22-01-01', title: 'Install underground DWV piping', divName: DIV_22, wpName: 'Under-Slab Plumbing', seq: 'rough-in', anchor: 'underslab-dwv', crew: 3, unit: 'LF', trade: 'Plumbing', action: 'Install below-grade drain, waste, and vent piping to design layout.', inspectionRequired: true }),
  t({ code: '22-01-02', title: 'Underground DWV test', divName: DIV_22, wpName: 'Under-Slab Plumbing', type: 'testing', seq: 'rough-in', anchor: 'underslab-dwv-test', crew: 1, unit: 'LS', trade: 'Plumbing', action: 'Pressure/water test underground DWV before backfill and inspection.', inspectionRequired: true }),

  // ── Division 22 — Plumbing Rough-In ──────────────────────────────────────
  t({ code: '22-02-01', title: 'Install above-grade DWV rough-in', divName: DIV_22, wpName: 'Plumbing Rough-In', seq: 'rough-in', anchor: 'rough-plumbing', crew: 3, unit: 'LF', trade: 'Plumbing', action: 'Run above-grade drain, waste, and vent piping in the frame.' }),
  t({ code: '22-02-02', title: 'Install domestic water rough-in', divName: DIV_22, wpName: 'Plumbing Rough-In', seq: 'rough-in', anchor: 'rough-plumbing', crew: 3, unit: 'LF', trade: 'Plumbing', action: 'Run hot and cold water distribution piping to fixture locations.' }),
  t({ code: '22-02-03', title: 'Install gas piping rough-in', divName: DIV_22, wpName: 'Plumbing Rough-In', seq: 'rough-in', anchor: 'rough-gas', crew: 2, unit: 'LF', trade: 'Plumbing', action: 'Run fuel-gas piping to appliance and equipment locations.' }),
  t({ code: '22-02-04', title: 'Set tubs and shower pans', divName: DIV_22, wpName: 'Plumbing Rough-In', seq: 'rough-in', anchor: 'set-tubs', crew: 2, unit: 'EA', trade: 'Plumbing', action: 'Set bathing fixtures that must be installed before wall close-in.' }),
  t({ code: '22-02-05', title: 'Domestic water pressure test', divName: DIV_22, wpName: 'Plumbing Rough-In', type: 'testing', seq: 'rough-in', anchor: 'water-test', crew: 1, unit: 'LS', trade: 'Plumbing', action: 'Pressurize water piping to verify integrity before close-in.', inspectionRequired: true }),
  t({ code: '22-02-06', title: 'Gas piping pressure test', divName: DIV_22, wpName: 'Plumbing Rough-In', type: 'testing', seq: 'rough-in', anchor: 'gas-test', crew: 1, unit: 'LS', trade: 'Plumbing', action: 'Pressure test fuel-gas piping to verify integrity before close-in.', inspectionRequired: true }),

  // ── Division 22 — Plumbing Trim-Out ──────────────────────────────────────
  t({ code: '22-03-01', title: 'Set plumbing fixtures', divName: DIV_22, wpName: 'Plumbing Trim-Out', seq: 'trim-out', anchor: 'plumbing-trim', crew: 2, unit: 'EA', trade: 'Plumbing', action: 'Set sinks, toilets, and fixtures after finishes are in place.' }),
  t({ code: '22-03-02', title: 'Install plumbing trim and connections', divName: DIV_22, wpName: 'Plumbing Trim-Out', seq: 'trim-out', anchor: 'plumbing-trim', crew: 2, unit: 'EA', trade: 'Plumbing', action: 'Install faucets, valves, and final supply/waste connections.' }),
  t({ code: '22-03-03', title: 'Set water heater', divName: DIV_22, wpName: 'Plumbing Trim-Out', seq: 'trim-out', anchor: 'water-heater', crew: 2, unit: 'EA', trade: 'Plumbing', action: 'Set and connect the domestic water heating equipment.' }),

  // ── Division 23 — HVAC Rough-In ──────────────────────────────────────────
  t({ code: '23-01-01', title: 'Set HVAC equipment', divName: DIV_23, wpName: 'HVAC Rough-In', seq: 'rough-in', anchor: 'hvac-equipment', crew: 2, unit: 'EA', trade: 'HVAC', action: 'Set air handler, furnace, or condenser units in position.' }),
  t({ code: '23-01-02', title: 'Install supply and return ductwork', divName: DIV_23, wpName: 'HVAC Rough-In', seq: 'rough-in', anchor: 'rough-mechanical', crew: 3, unit: 'LF', trade: 'HVAC', action: 'Run supply and return duct trunk and branch runs in the frame.' }),
  t({ code: '23-01-03', title: 'Install refrigerant and condensate lines', divName: DIV_23, wpName: 'HVAC Rough-In', seq: 'rough-in', anchor: 'rough-mechanical', crew: 2, unit: 'LF', trade: 'HVAC', action: 'Run refrigerant line sets and condensate drains to equipment.' }),
  t({ code: '23-01-04', title: 'Install exhaust and ventilation runs', divName: DIV_23, wpName: 'HVAC Rough-In', seq: 'rough-in', anchor: 'ventilation', crew: 2, unit: 'LF', trade: 'HVAC', action: 'Run bath, range, and mechanical ventilation duct runs to exterior.' }),
  t({ code: '23-01-05', title: 'Duct leakage test', divName: DIV_23, wpName: 'HVAC Rough-In', type: 'testing', seq: 'rough-in', anchor: 'duct-test', crew: 1, unit: 'LS', trade: 'HVAC', action: 'Test duct system for leakage to verify code compliance.', inspectionRequired: true }),

  // ── Division 23 — HVAC Trim-Out ──────────────────────────────────────────
  t({ code: '23-02-01', title: 'Install registers and grilles', divName: DIV_23, wpName: 'HVAC Trim-Out', seq: 'trim-out', anchor: 'hvac-trim', crew: 2, unit: 'EA', trade: 'HVAC', action: 'Install supply registers and return grilles after finishes.' }),
  t({ code: '23-02-02', title: 'Install thermostats and controls', divName: DIV_23, wpName: 'HVAC Trim-Out', seq: 'trim-out', anchor: 'hvac-controls', crew: 1, unit: 'EA', trade: 'HVAC', action: 'Mount and wire thermostats and system controls.' }),
  t({ code: '23-02-03', title: 'Mechanical ventilation airflow test', divName: DIV_23, wpName: 'HVAC Trim-Out', type: 'testing', seq: 'trim-out', anchor: 'airflow-test', crew: 1, unit: 'LS', trade: 'HVAC', action: 'Measure ventilation airflow to verify required rates.' }),

  // ── Division 26 — Electrical Service ─────────────────────────────────────
  t({ code: '26-01-01', title: 'Set electrical service panel', divName: DIV_26, wpName: 'Electrical Service', seq: 'rough-in', anchor: 'service-panel', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Mount and ground the main service panel and meter base.' }),
  t({ code: '26-01-02', title: 'Install service conductors', divName: DIV_26, wpName: 'Electrical Service', seq: 'rough-in', anchor: 'service-conductors', crew: 2, unit: 'LF', trade: 'Electrical', action: 'Run service-entrance conductors to the panel.' }),

  // ── Division 26 — Electrical Rough-In ────────────────────────────────────
  t({ code: '26-02-01', title: 'Install device boxes', divName: DIV_26, wpName: 'Electrical Rough-In', seq: 'rough-in', anchor: 'rough-electrical', crew: 3, unit: 'EA', trade: 'Electrical', action: 'Mount outlet, switch, and fixture boxes per the electrical plan.', csiDivisionCode: '26', csiSectionCode: '26 05 00' }),
  t({ code: '26-02-02', title: 'Pull branch circuit wiring', divName: DIV_26, wpName: 'Electrical Rough-In', seq: 'rough-in', anchor: 'rough-electrical', crew: 3, unit: 'LF', trade: 'Electrical', action: 'Run branch-circuit conductors from the panel to device boxes.' }),
  t({ code: '26-02-03', title: 'Make rough electrical connections', divName: DIV_26, wpName: 'Electrical Rough-In', seq: 'rough-in', anchor: 'rough-electrical', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Land and splice conductors in boxes and panel for inspection.', inspectionRequired: true }),

  // ── Division 26 — Electrical Trim-Out ────────────────────────────────────
  t({ code: '26-03-01', title: 'Install devices and cover plates', divName: DIV_26, wpName: 'Electrical Trim-Out', seq: 'trim-out', anchor: 'electrical-trim', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Install switches, receptacles, and plates after paint.' }),
  t({ code: '26-03-02', title: 'Install light fixtures', divName: DIV_26, wpName: 'Electrical Trim-Out', seq: 'trim-out', anchor: 'lighting-trim', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Hang and connect interior and exterior light fixtures.' }),
  t({ code: '26-03-03', title: 'Energize and label panel', divName: DIV_26, wpName: 'Electrical Trim-Out', seq: 'trim-out', anchor: 'panel-energize', crew: 1, unit: 'EA', trade: 'Electrical', action: 'Energize circuits and label the completed panel directory.' }),

  // ── Division 27 — Low-Voltage / Communications ───────────────────────────
  t({ code: '27-01-01', title: 'Rough-in low-voltage cabling', divName: DIV_27, wpName: 'Communications Rough-In', seq: 'rough-in', anchor: 'low-voltage-rough', crew: 2, unit: 'LF', trade: 'Low-Voltage / Communications', action: 'Run data, video, and security cabling in open walls.' }),
  t({ code: '27-01-02', title: 'Low-voltage continuity test', divName: DIV_27, wpName: 'Communications Rough-In', type: 'testing', seq: 'rough-in', anchor: 'low-voltage-test', crew: 1, unit: 'LS', trade: 'Low-Voltage / Communications', action: 'Verify cable runs for continuity before wall close-in.' }),
  t({ code: '27-02-01', title: 'Install low-voltage devices', divName: DIV_27, wpName: 'Communications Trim-Out', seq: 'trim-out', anchor: 'low-voltage-trim', crew: 1, unit: 'EA', trade: 'Low-Voltage / Communications', action: 'Terminate jacks, install plates, and mount low-voltage devices.' }),

  // ── Division 09 — Drywall ────────────────────────────────────────────────
  t({ code: '09-01-01', title: 'Hang drywall', divName: DIV_09, wpName: 'Drywall', seq: 'drywall', anchor: 'drywall-hang', crew: 4, unit: 'SF', trade: 'Drywall', action: 'Hang gypsum board on walls and ceilings after insulation approval.', csiDivisionCode: '09', csiSectionCode: '09 20 00' }),
  t({ code: '09-01-02', title: 'Tape and finish drywall', divName: DIV_09, wpName: 'Drywall', seq: 'drywall', anchor: 'drywall-finish', crew: 3, unit: 'SF', trade: 'Drywall', action: 'Tape, mud, and finish drywall joints to a paint-ready surface.' }),
  t({ code: '09-01-03', title: 'Sand drywall', divName: DIV_09, wpName: 'Drywall', seq: 'drywall', anchor: 'drywall-sand', crew: 2, unit: 'SF', trade: 'Drywall', action: 'Sand finished joints smooth before primer.' }),

  // ── Division 09 — Paint ──────────────────────────────────────────────────
  t({ code: '09-02-01', title: 'Prime walls and ceilings', divName: DIV_09, wpName: 'Paint', seq: 'interior-finishes', anchor: 'prime', crew: 3, unit: 'SF', trade: 'Painting', action: 'Apply primer coat to finished drywall surfaces.' }),
  t({ code: '09-02-02', title: 'Paint walls and ceilings', divName: DIV_09, wpName: 'Paint', seq: 'interior-finishes', anchor: 'paint', crew: 3, unit: 'SF', trade: 'Painting', action: 'Apply finish wall and ceiling coats before trim and casework.' }),

  // ── Division 09 — Flooring ───────────────────────────────────────────────
  t({ code: '09-03-01', title: 'Install tile flooring', divName: DIV_09, wpName: 'Flooring', seq: 'interior-finishes', anchor: 'tile-flooring', crew: 3, unit: 'SF', trade: 'Flooring / Tile', action: 'Set and grout tile flooring in wet and designated areas.' }),
  t({ code: '09-03-02', title: 'Install hardwood or laminate flooring', divName: DIV_09, wpName: 'Flooring', seq: 'interior-finishes', anchor: 'wood-flooring', crew: 3, unit: 'SF', trade: 'Flooring', action: 'Install hard-surface flooring in living areas.' }),
  t({ code: '09-03-03', title: 'Install carpet', divName: DIV_09, wpName: 'Flooring', seq: 'trim-out', anchor: 'carpet', crew: 2, unit: 'SF', trade: 'Flooring', action: 'Install carpet and pad after other finishes to limit damage.' }),

  // ── Division 09 — Trim Carpentry ─────────────────────────────────────────
  t({ code: '09-04-01', title: 'Install baseboard and casing', divName: DIV_09, wpName: 'Trim Carpentry', seq: 'trim-out', anchor: 'trim-carpentry', crew: 2, unit: 'LF', trade: 'Finish Carpentry', action: 'Install base, casing, and trim after paint.' }),
  t({ code: '09-04-02', title: 'Install interior millwork', divName: DIV_09, wpName: 'Trim Carpentry', seq: 'trim-out', anchor: 'millwork', crew: 2, unit: 'LF', trade: 'Finish Carpentry', action: 'Install shelving, mantels, and accent millwork.' }),
  t({ code: '09-04-03', title: 'Touch-up paint', divName: DIV_09, wpName: 'Trim Carpentry', seq: 'closeout', anchor: 'paint-touchup', crew: 2, unit: 'LS', trade: 'Painting', action: 'Caulk and touch up paint after trim and fixture installation.' }),

  // ── Division 12 — Cabinets ───────────────────────────────────────────────
  t({ code: '12-01-01', title: 'Install base cabinets', divName: DIV_12, wpName: 'Cabinets', seq: 'trim-out', anchor: 'cabinets', crew: 2, unit: 'LF', trade: 'Cabinet Installer', action: 'Set and level base cabinets after flooring and paint.' }),
  t({ code: '12-01-02', title: 'Install wall cabinets', divName: DIV_12, wpName: 'Cabinets', seq: 'trim-out', anchor: 'cabinets', crew: 2, unit: 'LF', trade: 'Cabinet Installer', action: 'Hang and align upper wall cabinets.' }),

  // ── Division 12 — Countertops ────────────────────────────────────────────
  t({ code: '12-02-01', title: 'Template countertops', divName: DIV_12, wpName: 'Countertops', seq: 'trim-out', anchor: 'countertop-template', crew: 1, unit: 'EA', trade: 'Countertop Fabricator', action: 'Field-measure installed cabinets to create the fabrication template.' }),
  t({ code: '12-02-02', title: 'Fabricate countertops', divName: DIV_12, wpName: 'Countertops', type: 'procurement_lead_time', seq: 'trim-out', anchor: 'countertop-fabricate', crew: 0, dur: 10, unit: 'DAY', trade: 'Countertop Fabricator', action: 'Off-site fabrication lead time from approved template to delivery.' }),
  t({ code: '12-02-03', title: 'Install countertops', divName: DIV_12, wpName: 'Countertops', seq: 'trim-out', anchor: 'countertop-install', crew: 2, unit: 'LF', trade: 'Countertop Fabricator', action: 'Set and seam fabricated countertops on base cabinets.' }),

  // ── Division 11 — Appliances & Equipment ─────────────────────────────────
  t({ code: '11-01-01', title: 'Install kitchen appliances', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'appliances', crew: 2, unit: 'EA', trade: 'Appliance Installer', action: 'Set and connect kitchen appliances after countertops and trim.' }),
  t({ code: '11-01-02', title: 'Install laundry equipment connections', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'appliances', crew: 1, unit: 'EA', trade: 'Appliance Installer', action: 'Connect laundry equipment to finished utility rough-ins.' }),

  // ── Division 32 — Exterior Improvements ──────────────────────────────────
  t({ code: '32-01-01', title: 'Final grade yard', divName: DIV_32, wpName: 'Exterior Improvements', seq: 'exterior', anchor: 'final-grade', crew: 3, unit: 'SF', trade: 'Landscaping', action: 'Establish final yard grades and positive drainage.', weatherSensitive: true }),
  t({ code: '32-01-02', title: 'Install landscaping and sod', divName: DIV_32, wpName: 'Exterior Improvements', seq: 'exterior', anchor: 'landscaping', crew: 3, unit: 'SF', trade: 'Landscaping', action: 'Place topsoil, plantings, and sod across finished grades.', weatherSensitive: true }),
  t({ code: '32-01-03', title: 'Install irrigation system', divName: DIV_32, wpName: 'Exterior Improvements', seq: 'exterior', anchor: 'irrigation', crew: 2, unit: 'LS', trade: 'Landscaping / Irrigation', action: 'Install irrigation lines, heads, and controls.', weatherSensitive: true, variant: 'optional' }),

  // ── Division 08 — Garage Doors & Interior Glazing ────────────────────────
  t({ code: '08-01-04', title: 'Install garage doors', divName: DIV_08, wpName: 'Exterior Openings', seq: 'enclosure', anchor: 'garage-doors', crew: 2, unit: 'EA', trade: 'Garage Doors', action: 'Install garage door panels, tracks, springs, hardware, and opener prep.', weatherSensitive: true }),
  t({ code: '08-03-01', title: 'Install shower doors', divName: DIV_08, wpName: 'Interior Glazing', seq: 'trim-out', anchor: 'shower-doors', crew: 2, unit: 'EA', trade: 'Glazing', action: 'Install shower door panels, tracks, hinges, seals, and related hardware.' }),
  t({ code: '08-03-02', title: 'Install interior mirrors', divName: DIV_08, wpName: 'Interior Glazing', seq: 'trim-out', anchor: 'interior-mirrors', crew: 2, unit: 'EA', trade: 'Glazing', action: 'Install mirrors and related mounting hardware at finished walls.' }),

  // ── Division 09 — Flooring Accessories ───────────────────────────────────
  t({ code: '09-03-04', title: 'Install flooring transitions', divName: DIV_09, wpName: 'Flooring', seq: 'interior-finishes', anchor: 'flooring-transitions', crew: 2, unit: 'LF', trade: 'Flooring', action: 'Install transition strips, reducers, thresholds, and finish flooring trim.' }),

  // ── Division 11 — Individual Appliance Installation ──────────────────────
  t({ code: '11-01-03', title: 'Install range or cooktop', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'range-cooktop', crew: 2, unit: 'EA', trade: 'Appliance Installer', action: 'Install range or cooktop and coordinate required electrical, gas, or ventilation connections.' }),
  t({ code: '11-01-04', title: 'Install dishwasher', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'dishwasher', crew: 2, unit: 'EA', trade: 'Appliance Installer / Plumbing', action: 'Install dishwasher, secure unit, and connect water, drain, and electrical connections.' }),
  t({ code: '11-01-05', title: 'Install microwave or range hood', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'microwave-hood', crew: 2, unit: 'EA', trade: 'Appliance Installer / Electrical', action: 'Install microwave, range hood, or ventilation appliance and connect required power or ducting.' }),
  t({ code: '11-01-06', title: 'Install washer and dryer connections', divName: DIV_11, wpName: 'Appliances & Equipment', seq: 'closeout', anchor: 'washer-dryer', crew: 2, unit: 'EA', trade: 'Appliance Installer', action: 'Set washer and dryer, level units, and connect water, drain, vent, and power as required.' }),

  // ── Division 12 — Casework Additions ─────────────────────────────────────
  t({ code: '12-01-03', title: 'Install laundry cabinets', divName: DIV_12, wpName: 'Cabinets', seq: 'trim-out', anchor: 'laundry-cabinets', crew: 2, unit: 'LF', trade: 'Cabinet Installer', action: 'Install laundry, mudroom, or utility cabinets where required.' }),
  t({ code: '12-01-04', title: 'Install cabinet hardware', divName: DIV_12, wpName: 'Cabinets', seq: 'trim-out', anchor: 'cabinet-hardware', crew: 1, unit: 'EA', trade: 'Cabinet Installer', action: 'Install cabinet pulls, knobs, hinges, drawer slides, and related finish hardware.' }),
  t({ code: '12-02-04', title: 'Install countertop backsplash', divName: DIV_12, wpName: 'Countertops', seq: 'trim-out', anchor: 'backsplash-install', crew: 2, unit: 'SF', trade: 'Countertops / Tile', action: 'Install countertop backsplash material where specified.' }),

  // ── Division 22 — Plumbing Testing ───────────────────────────────────────
  t({ code: '22-01-03', title: 'Test underground plumbing systems', divName: DIV_22, wpName: 'Under-Slab Plumbing', type: 'testing', seq: 'rough-in', anchor: 'underground-plumbing-test', crew: 1, unit: 'EA', trade: 'Plumbing', action: 'Perform required test on underground plumbing before cover or slab placement.', inspectionRequired: true }),
  t({ code: '22-03-04', title: 'Perform final plumbing test', divName: DIV_22, wpName: 'Plumbing Trim-Out', type: 'testing', seq: 'trim-out', anchor: 'final-plumbing-test', crew: 1, unit: 'EA', trade: 'Plumbing', action: 'Test plumbing fixtures, drains, water supply, and equipment before final inspection.', inspectionRequired: true }),

  // ── Division 23 — HVAC Additions ─────────────────────────────────────────
  t({ code: '23-02-04', title: 'Install condensate drain piping', divName: DIV_23, wpName: 'HVAC Rough-In', seq: 'rough-in', anchor: 'condensate-drain', crew: 2, unit: 'LF', trade: 'HVAC', action: 'Install condensate drain piping, traps, and required secondary drain provisions.', inspectionRequired: true }),
  t({ code: '23-03-03', title: 'Start up HVAC system', divName: DIV_23, wpName: 'HVAC Trim-Out', seq: 'trim-out', anchor: 'hvac-startup', crew: 2, unit: 'EA', trade: 'HVAC', action: 'Start, test, and adjust HVAC equipment and verify system operation before final inspection.' }),

  // ── Division 26 — Electrical Additions ───────────────────────────────────
  t({ code: '26-02-04', title: 'Install recessed lighting housings', divName: DIV_26, wpName: 'Electrical Rough-In', seq: 'rough-in', anchor: 'recessed-light-housings', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Install recessed lighting housings or rough-in supports before ceiling cover-up.', inspectionRequired: true }),
  t({ code: '26-02-05', title: 'Perform rough electrical inspection', divName: DIV_26, wpName: 'Electrical Rough-In', type: 'inspection', seq: 'inspection-gate', anchor: 'rough-electrical-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Complete rough electrical inspection before insulation or cover-up.', inspectionRequired: true }),
  t({ code: '26-03-04', title: 'Connect electrical appliances', divName: DIV_26, wpName: 'Electrical Trim-Out', seq: 'trim-out', anchor: 'electrical-appliance-connections', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Make final electrical connections for appliances and equipment.' }),
  t({ code: '26-03-05', title: 'Perform final electrical test', divName: DIV_26, wpName: 'Electrical Trim-Out', type: 'testing', seq: 'trim-out', anchor: 'final-electrical-test', crew: 1, unit: 'EA', trade: 'Electrical', action: 'Test circuits, devices, breakers, GFCI and AFCI protection, and panel labeling before final inspection.', inspectionRequired: true }),

  // ── Division 27 — Communications Additions ───────────────────────────────
  t({ code: '27-01-03', title: 'Install coax cable rough-in', divName: DIV_27, wpName: 'Communications Rough-In', seq: 'rough-in', anchor: 'coax-cable', crew: 2, unit: 'EA', trade: 'Low-Voltage / Communications', action: 'Pull coax cable to planned media, television, or communications locations.' }),
  t({ code: '27-01-04', title: 'Install doorbell wiring', divName: DIV_27, wpName: 'Communications Rough-In', seq: 'rough-in', anchor: 'doorbell-wiring', crew: 1, unit: 'EA', trade: 'Low-Voltage / Communications', action: 'Install doorbell wiring, chime wiring, transformer rough-in, and related low-voltage wiring.' }),
  t({ code: '27-01-05', title: 'Install security system wiring', divName: DIV_27, wpName: 'Communications Rough-In', seq: 'rough-in', anchor: 'security-wiring', crew: 2, unit: 'EA', trade: 'Low-Voltage / Communications', action: 'Pull security, sensor, camera, keypad, or alarm wiring where specified.' }),
  t({ code: '27-02-02', title: 'Terminate coax outlets', divName: DIV_27, wpName: 'Communications Trim-Out', seq: 'trim-out', anchor: 'coax-termination', crew: 1, unit: 'EA', trade: 'Low-Voltage / Communications', action: 'Terminate coax cable, install plates, and label media outlets.' }),

  // ── Division 32 — Exterior Flatwork ──────────────────────────────────────
  t({ code: '32-02-01', title: 'Set driveway forms', divName: DIV_32, wpName: 'Exterior Flatwork', seq: 'exterior', anchor: 'driveway-forms', crew: 3, unit: 'LF', trade: 'Concrete', action: 'Set and brace forms for concrete driveway placement.', weatherSensitive: true }),
  t({ code: '32-02-02', title: 'Place driveway reinforcement', divName: DIV_32, wpName: 'Exterior Flatwork', seq: 'exterior', anchor: 'driveway-reinforcement', crew: 2, unit: 'SF', trade: 'Concrete / Rebar', action: 'Place driveway reinforcement, mesh, dowels, or specified reinforcing before concrete placement.', inspectionRequired: true }),
  t({ code: '32-02-03', title: 'Place concrete driveway', divName: DIV_32, wpName: 'Exterior Flatwork', seq: 'exterior', anchor: 'driveway-concrete', crew: 5, unit: 'CY', trade: 'Concrete', action: 'Place, finish, joint, and cure concrete driveway.', weatherSensitive: true }),
  t({ code: '32-02-04', title: 'Set walkway and patio forms', divName: DIV_32, wpName: 'Exterior Flatwork', seq: 'exterior', anchor: 'walk-patio-forms', crew: 3, unit: 'LF', trade: 'Concrete', action: 'Set and brace forms for concrete walkways, stoops, and patios.', weatherSensitive: true }),
  t({ code: '32-02-05', title: 'Place walkway and patio concrete', divName: DIV_32, wpName: 'Exterior Flatwork', seq: 'exterior', anchor: 'walk-patio-concrete', crew: 5, unit: 'CY', trade: 'Concrete', action: 'Place, finish, joint, and cure concrete walkways, stoops, and patios.', weatherSensitive: true }),

  // ── Division 32 — Landscaping and Irrigation Additions ───────────────────
  t({ code: '32-03-01', title: 'Install irrigation piping', divName: DIV_32, wpName: 'Landscaping and Irrigation', seq: 'exterior', anchor: 'irrigation-piping', crew: 2, unit: 'LF', trade: 'Irrigation', action: 'Install irrigation piping, sleeves, valves, and control wiring before landscape finish.', weatherSensitive: true }),
  t({ code: '32-03-02', title: 'Install irrigation heads', divName: DIV_32, wpName: 'Landscaping and Irrigation', seq: 'exterior', anchor: 'irrigation-heads', crew: 2, unit: 'EA', trade: 'Irrigation', action: 'Install sprinkler heads, emitters, nozzles, and final irrigation components.', weatherSensitive: true }),
  t({ code: '32-03-03', title: 'Install landscape plantings', divName: DIV_32, wpName: 'Landscaping and Irrigation', seq: 'exterior', anchor: 'landscape-plantings', crew: 4, unit: 'LS', trade: 'Landscaping', action: 'Install trees, shrubs, planting beds, mulch, and specified landscape materials.', weatherSensitive: true }),
  t({ code: '32-03-04', title: 'Install sod', divName: DIV_32, wpName: 'Landscaping and Irrigation', seq: 'exterior', anchor: 'sod-install', crew: 4, unit: 'SF', trade: 'Landscaping', action: 'Install sod, roll, water, and establish lawn areas.', weatherSensitive: true }),

  // ── Division 32 — Fencing ─────────────────────────────────────────────────
  t({ code: '32-04-01', title: 'Install fencing posts', divName: DIV_32, wpName: 'Fencing', seq: 'exterior', anchor: 'fence-posts', crew: 3, unit: 'EA', trade: 'Fencing', action: 'Layout and set fence posts at required locations and spacing.', weatherSensitive: true }),
  t({ code: '32-04-02', title: 'Install fencing panels', divName: DIV_32, wpName: 'Fencing', seq: 'exterior', anchor: 'fence-panels', crew: 3, unit: 'LF', trade: 'Fencing', action: 'Install fence rails, panels, pickets, gates, and hardware.' }),

  // ── Division 13 — Special Construction ───────────────────────────────────
  t({ code: '13-01-01', title: 'Review special construction submittals', divName: DIV_13, wpName: 'Special Construction Submittals', seq: 'special-construction', anchor: 'special-construction-submittals', crew: 1, unit: 'LS', trade: 'Project Management', action: 'Review manufacturer submittals, shop drawings, product data, and installation requirements for special construction systems.' }),
  t({ code: '13-01-02', title: 'Receive special construction materials', divName: DIV_13, wpName: 'Special Construction Procurement', seq: 'special-construction', anchor: 'special-construction-delivery', crew: 2, unit: 'LS', trade: 'Special Construction', action: 'Receive, inspect, and stage special construction materials, components, hardware, and accessories.' }),
  t({ code: '13-01-03', title: 'Verify special construction layout', divName: DIV_13, wpName: 'Special Construction Layout', seq: 'special-construction', anchor: 'special-construction-layout', crew: 2, unit: 'LS', trade: 'Special Construction', action: 'Verify layout, dimensions, clearances, anchor locations, and required support conditions before installation.', inspectionRequired: true }),
  t({ code: '13-01-04', title: 'Install special construction anchorage', divName: DIV_13, wpName: 'Special Construction Anchorage', seq: 'special-construction', anchor: 'special-construction-anchorage', crew: 2, unit: 'EA', trade: 'Special Construction', action: 'Install anchors, embedded plates, brackets, fasteners, or support hardware required for special construction systems.', inspectionRequired: true }),
  t({ code: '13-01-05', title: 'Install special construction framing', divName: DIV_13, wpName: 'Special Construction Framing', seq: 'special-construction', anchor: 'special-construction-framing', crew: 3, unit: 'LS', trade: 'Special Construction', action: 'Install structural or support framing for special construction components according to approved layout and manufacturer requirements.', inspectionRequired: true }),
  t({ code: '13-01-06', title: 'Install special construction panels', divName: DIV_13, wpName: 'Special Construction Panels', seq: 'special-construction', anchor: 'special-construction-panels', crew: 3, unit: 'SF', trade: 'Special Construction', action: 'Install special construction wall, roof, enclosure, or partition panels according to approved shop drawings.', weatherSensitive: true }),
  t({ code: '13-01-07', title: 'Seal special construction joints', divName: DIV_13, wpName: 'Special Construction Panels', seq: 'special-construction', anchor: 'special-construction-joint-seal', crew: 2, unit: 'LF', trade: 'Special Construction', action: 'Seal joints, seams, penetrations, and transitions in special construction assemblies.', weatherSensitive: true }),
  t({ code: '13-01-08', title: 'Install special construction accessories', divName: DIV_13, wpName: 'Special Construction Accessories', seq: 'special-construction', anchor: 'special-construction-accessories', crew: 2, unit: 'EA', trade: 'Special Construction', action: 'Install accessories, trim, closure pieces, guards, covers, hardware, and finish components for special construction systems.' }),
  t({ code: '13-01-09', title: 'Inspect special construction installation', divName: DIV_13, wpName: 'Special Construction Inspection', type: 'inspection', seq: 'inspection-gate', anchor: 'special-construction-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Inspect installed special construction systems for layout, anchorage, alignment, clearances, and manufacturer requirements.', inspectionRequired: true }),
  t({ code: '13-01-10', title: 'Correct special construction deficiencies', divName: DIV_13, wpName: 'Special Construction Corrections', seq: 'special-construction', anchor: 'special-construction-corrections', crew: 2, unit: 'LS', trade: 'Special Construction', action: 'Correct deficiencies found during special construction inspection or quality review.' }),

  // ── Division 13 — Pre-Engineered Metal Building ───────────────────────────
  t({ code: '13-02-01', title: 'Receive pre-engineered metal building package', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-delivery', crew: 2, unit: 'LS', trade: 'Metal Building', action: 'Receive and inventory pre-engineered metal building frames, panels, fasteners, trim, and accessories.' }),
  t({ code: '13-02-02', title: 'Verify pre-engineered metal building anchor bolts', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-anchor-bolts', crew: 2, unit: 'EA', trade: 'Metal Building', action: 'Verify anchor bolt layout, projection, spacing, and alignment before metal building frame erection.', inspectionRequired: true }),
  t({ code: '13-02-03', title: 'Erect pre-engineered metal building frames', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-frames', crew: 5, unit: 'EA', trade: 'Metal Building', action: 'Erect primary metal building frames, columns, rafters, and required temporary bracing.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '13-02-04', title: 'Install pre-engineered metal building girts and purlins', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-girts-purlins', crew: 4, unit: 'LF', trade: 'Metal Building', action: 'Install secondary framing members including girts, purlins, eave struts, and related bracing.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '13-02-05', title: 'Install pre-engineered metal building wall panels', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-wall-panels', crew: 4, unit: 'SF', trade: 'Metal Building', action: 'Install metal wall panels, fasteners, closures, and wall trim for the pre-engineered building system.', weatherSensitive: true }),
  t({ code: '13-02-06', title: 'Install pre-engineered metal building roof panels', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-roof-panels', crew: 4, unit: 'SF', trade: 'Metal Building', action: 'Install metal roof panels, fasteners, closures, ridge components, and roof trim for the pre-engineered building system.', weatherSensitive: true }),
  t({ code: '13-02-07', title: 'Install pre-engineered metal building trim', divName: DIV_13, wpName: 'Pre-Engineered Metal Building', seq: 'special-construction', anchor: 'pemb-trim', crew: 3, unit: 'LF', trade: 'Metal Building', action: 'Install metal building corner trim, rake trim, base trim, eave trim, gutters, and downspouts.', weatherSensitive: true }),

  // ── Division 13 — Swimming Pool ───────────────────────────────────────────
  t({ code: '13-03-01', title: 'Layout swimming pool excavation', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-layout', crew: 2, unit: 'LS', trade: 'Pool Contractor', action: 'Lay out pool limits, elevations, access, equipment locations, and required excavation boundaries.', weatherSensitive: true }),
  t({ code: '13-03-02', title: 'Excavate swimming pool shell', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-excavation', crew: 3, unit: 'CY', trade: 'Pool Contractor / Earthwork', action: 'Excavate pool shell, benches, steps, and equipment areas to required shape and depth.', weatherSensitive: true }),
  t({ code: '13-03-03', title: 'Install swimming pool reinforcement', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-reinforcement', crew: 3, unit: 'SF', trade: 'Pool Contractor / Rebar', action: 'Install reinforcing steel for pool shell, steps, bond beam, and required structural elements.', inspectionRequired: true }),
  t({ code: '13-03-04', title: 'Install swimming pool plumbing rough-in', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-plumbing-rough-in', crew: 2, unit: 'LS', trade: 'Pool Contractor / Plumbing', action: 'Install pool plumbing rough-in, drains, returns, skimmers, piping, and equipment connections.', inspectionRequired: true }),
  t({ code: '13-03-05', title: 'Place swimming pool shell concrete', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-shell-concrete', crew: 6, unit: 'CY', trade: 'Pool Contractor / Concrete', action: 'Place shotcrete, gunite, or concrete pool shell after reinforcement and plumbing inspection.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '13-03-06', title: 'Pool shell concrete curing period', divName: DIV_13, wpName: 'Swimming Pool', type: 'curing_lag', seq: 'special-construction', anchor: 'pool-shell-cure', crew: 0, dur: 7, unit: 'DAY', trade: 'Pool Contractor / Concrete', action: 'Allow pool shell concrete to cure before waterproofing, tile, coping, or finish work.' }),
  t({ code: '13-03-07', title: 'Install swimming pool tile and coping', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-tile-coping', crew: 3, unit: 'LF', trade: 'Pool Contractor / Tile', action: 'Install pool waterline tile, coping, trim, and related finish components.', weatherSensitive: true }),
  t({ code: '13-03-08', title: 'Install swimming pool interior finish', divName: DIV_13, wpName: 'Swimming Pool', seq: 'special-construction', anchor: 'pool-interior-finish', crew: 4, unit: 'SF', trade: 'Pool Contractor', action: 'Install plaster, pebble, liner, or other specified pool interior finish.', weatherSensitive: true }),
  t({ code: '13-03-09', title: 'Set swimming pool equipment', divName: DIV_13, wpName: 'Swimming Pool Equipment', seq: 'special-construction', anchor: 'pool-equipment', crew: 2, unit: 'LS', trade: 'Pool Contractor', action: 'Set pool pump, filter, heater, sanitizer, controls, valves, and equipment pad components.' }),
  t({ code: '13-03-10', title: 'Start up swimming pool system', divName: DIV_13, wpName: 'Swimming Pool Startup', seq: 'special-construction', anchor: 'pool-startup', crew: 2, unit: 'LS', trade: 'Pool Contractor', action: 'Fill pool, start equipment, balance water, test systems, and complete pool startup.', inspectionRequired: true }),

  // ── Division 14 — Elevator ────────────────────────────────────────────────
  t({ code: '14-01-01', title: 'Review elevator submittals', divName: DIV_14, wpName: 'Elevator Submittals', seq: 'conveying-equipment', anchor: 'elevator-submittals', crew: 1, unit: 'LS', trade: 'Project Management / Elevator', action: 'Review elevator shop drawings, product data, clearances, electrical requirements, shaft requirements, and installation instructions.' }),
  t({ code: '14-01-02', title: 'Verify elevator shaft rough opening', divName: DIV_14, wpName: 'Elevator Shaft Preparation', seq: 'conveying-equipment', anchor: 'elevator-shaft-rough-opening', crew: 2, unit: 'EA', trade: 'Elevator / Framing', action: 'Verify elevator shaft dimensions, plumbness, clearances, pit depth, overhead clearance, and rough opening requirements.', inspectionRequired: true }),
  t({ code: '14-01-03', title: 'Verify elevator pit construction', divName: DIV_14, wpName: 'Elevator Shaft Preparation', seq: 'conveying-equipment', anchor: 'elevator-pit', crew: 2, unit: 'EA', trade: 'Elevator / Concrete', action: 'Verify elevator pit size, depth, drainage, waterproofing, slab, and embedded items before elevator installation.', inspectionRequired: true }),
  t({ code: '14-01-04', title: 'Install elevator blocking and supports', divName: DIV_14, wpName: 'Elevator Shaft Preparation', seq: 'conveying-equipment', anchor: 'elevator-blocking-supports', crew: 2, unit: 'LS', trade: 'Framing / Elevator', action: 'Install required blocking, backing, supports, embeds, and structural provisions for elevator equipment.', inspectionRequired: true }),
  t({ code: '14-01-05', title: 'Install elevator electrical rough-in', divName: DIV_14, wpName: 'Elevator Rough-In', seq: 'conveying-equipment', anchor: 'elevator-electrical-rough-in', crew: 2, unit: 'LS', trade: 'Electrical', action: 'Install dedicated elevator power, lighting, disconnects, controls, and required electrical rough-in.', inspectionRequired: true }),
  t({ code: '14-01-06', title: 'Receive elevator equipment', divName: DIV_14, wpName: 'Elevator Equipment', seq: 'conveying-equipment', anchor: 'elevator-equipment-delivery', crew: 2, unit: 'LS', trade: 'Elevator', action: 'Receive, inspect, and stage elevator cab, rails, drive equipment, doors, controls, and accessories.' }),
  t({ code: '14-01-07', title: 'Install elevator guide rails', divName: DIV_14, wpName: 'Elevator Installation', seq: 'conveying-equipment', anchor: 'elevator-guide-rails', crew: 3, unit: 'LF', trade: 'Elevator', action: 'Install elevator guide rails, brackets, anchors, and alignment components in the shaft.', inspectionRequired: true }),
  t({ code: '14-01-08', title: 'Install elevator drive equipment', divName: DIV_14, wpName: 'Elevator Installation', seq: 'conveying-equipment', anchor: 'elevator-drive-equipment', crew: 3, unit: 'EA', trade: 'Elevator', action: 'Install elevator drive machinery, controller, hydraulic equipment, or manufacturer-specified drive components.', inspectionRequired: true }),
  t({ code: '14-01-09', title: 'Install elevator cab', divName: DIV_14, wpName: 'Elevator Installation', seq: 'conveying-equipment', anchor: 'elevator-cab', crew: 3, unit: 'EA', trade: 'Elevator', action: 'Install elevator cab, platform, sling, safety components, finishes, and related cab equipment.', inspectionRequired: true }),
  t({ code: '14-01-10', title: 'Install elevator doors and frames', divName: DIV_14, wpName: 'Elevator Installation', seq: 'conveying-equipment', anchor: 'elevator-doors-frames', crew: 3, unit: 'EA', trade: 'Elevator', action: 'Install hoistway doors, frames, sills, headers, interlocks, and cab door equipment.', inspectionRequired: true }),
  t({ code: '14-01-11', title: 'Install elevator controls', divName: DIV_14, wpName: 'Elevator Controls', seq: 'conveying-equipment', anchor: 'elevator-controls', crew: 2, unit: 'LS', trade: 'Elevator', action: 'Install elevator controls, call stations, control wiring, safety circuits, and operating panels.', inspectionRequired: true }),
  t({ code: '14-01-12', title: 'Perform elevator startup and adjustment', divName: DIV_14, wpName: 'Elevator Startup', seq: 'conveying-equipment', anchor: 'elevator-startup-adjustment', crew: 2, unit: 'LS', trade: 'Elevator', action: 'Start up, adjust, test, and calibrate elevator equipment before inspection.', inspectionRequired: true }),
  t({ code: '14-01-13', title: 'Perform elevator inspection', divName: DIV_14, wpName: 'Elevator Inspection', type: 'inspection', seq: 'inspection-gate', anchor: 'elevator-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Complete required elevator inspection, safety testing, and jurisdictional approval before use.', inspectionRequired: true }),
  t({ code: '14-01-14', title: 'Correct elevator inspection deficiencies', divName: DIV_14, wpName: 'Elevator Corrections', seq: 'conveying-equipment', anchor: 'elevator-deficiency-corrections', crew: 2, unit: 'LS', trade: 'Elevator', action: 'Correct elevator deficiencies noted during startup, testing, or inspection.' }),

  // ── Division 14 — Dumbwaiter / Residential Lift ───────────────────────────
  t({ code: '14-02-01', title: 'Verify dumbwaiter rough opening', divName: DIV_14, wpName: 'Dumbwaiter Shaft Preparation', seq: 'conveying-equipment', anchor: 'dumbwaiter-rough-opening', crew: 2, unit: 'EA', trade: 'Dumbwaiter / Framing', action: 'Verify dumbwaiter shaft dimensions, clearances, blocking, access, and rough opening requirements.', inspectionRequired: true }),
  t({ code: '14-02-02', title: 'Install dumbwaiter electrical rough-in', divName: DIV_14, wpName: 'Dumbwaiter Rough-In', seq: 'conveying-equipment', anchor: 'dumbwaiter-electrical-rough-in', crew: 1, unit: 'LS', trade: 'Electrical', action: 'Install power, controls, disconnects, and required electrical rough-in for dumbwaiter equipment.', inspectionRequired: true }),
  t({ code: '14-02-03', title: 'Install dumbwaiter rails and drive equipment', divName: DIV_14, wpName: 'Dumbwaiter Installation', seq: 'conveying-equipment', anchor: 'dumbwaiter-rails-drive', crew: 2, unit: 'LS', trade: 'Dumbwaiter', action: 'Install dumbwaiter rails, drive equipment, motor, controller, and required support hardware.', inspectionRequired: true }),
  t({ code: '14-02-04', title: 'Install dumbwaiter car and doors', divName: DIV_14, wpName: 'Dumbwaiter Installation', seq: 'conveying-equipment', anchor: 'dumbwaiter-car-doors', crew: 2, unit: 'LS', trade: 'Dumbwaiter', action: 'Install dumbwaiter car, landing doors, sills, interlocks, and finish components.', inspectionRequired: true }),
  t({ code: '14-02-05', title: 'Test dumbwaiter operation', divName: DIV_14, wpName: 'Dumbwaiter Startup', type: 'testing', seq: 'conveying-equipment', anchor: 'dumbwaiter-test', crew: 1, unit: 'EA', trade: 'Dumbwaiter', action: 'Test dumbwaiter travel, controls, doors, interlocks, safety devices, and final operation.', inspectionRequired: true }),

  // ── Division 21 — Fire Suppression ────────────────────────────────────────
  t({ code: '21-01-01', title: 'Review fire suppression submittals', divName: DIV_21, wpName: 'Fire Suppression Submittals', seq: 'fire-suppression', anchor: 'fire-suppression-submittals', crew: 1, unit: 'LS', trade: 'Fire Suppression / Project Management', action: 'Review fire sprinkler drawings, product data, hydraulic calculations, and authority requirements before installation.', inspectionRequired: true }),
  t({ code: '21-01-02', title: 'Coordinate fire suppression layout', divName: DIV_21, wpName: 'Fire Suppression Layout', seq: 'fire-suppression', anchor: 'fire-suppression-layout', crew: 1, unit: 'LS', trade: 'Fire Suppression', action: 'Coordinate sprinkler head locations, piping routes, ceiling conflicts, framing clearances, and inspection requirements.', inspectionRequired: true }),
  t({ code: '21-01-03', title: 'Install fire sprinkler service tie-in', divName: DIV_21, wpName: 'Fire Sprinkler Service', seq: 'fire-suppression', anchor: 'sprinkler-water-service-tie-in', crew: 2, unit: 'EA', trade: 'Fire Suppression / Plumbing', action: 'Install fire sprinkler service tie-in, control valve, backflow assembly, or system connection as required.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '21-01-04', title: 'Install fire sprinkler riser', divName: DIV_21, wpName: 'Fire Sprinkler Service', seq: 'fire-suppression', anchor: 'sprinkler-riser', crew: 2, unit: 'EA', trade: 'Fire Suppression', action: 'Install sprinkler riser, valves, gauges, drain, flow switch, tamper switch, and related riser components.', inspectionRequired: true }),
  t({ code: '21-02-01', title: 'Install fire sprinkler main piping', divName: DIV_21, wpName: 'Fire Sprinkler Rough-In', seq: 'fire-suppression', anchor: 'sprinkler-main-piping', crew: 3, unit: 'LF', trade: 'Fire Suppression', action: 'Install fire sprinkler main piping through framing, attic, crawlspace, or ceiling areas.', inspectionRequired: true }),
  t({ code: '21-02-02', title: 'Install fire sprinkler branch piping', divName: DIV_21, wpName: 'Fire Sprinkler Rough-In', seq: 'fire-suppression', anchor: 'sprinkler-branch-piping', crew: 3, unit: 'LF', trade: 'Fire Suppression', action: 'Install fire sprinkler branch piping from mains to sprinkler head locations.', inspectionRequired: true }),
  t({ code: '21-02-03', title: 'Install fire sprinkler head drops', divName: DIV_21, wpName: 'Fire Sprinkler Rough-In', seq: 'fire-suppression', anchor: 'sprinkler-head-drops', crew: 2, unit: 'EA', trade: 'Fire Suppression', action: 'Install sprinkler head drops, adapters, escutcheon rough-ins, and temporary caps before cover-up.', inspectionRequired: true }),
  t({ code: '21-02-04', title: 'Install fire sprinkler pipe hangers', divName: DIV_21, wpName: 'Fire Sprinkler Rough-In', seq: 'fire-suppression', anchor: 'sprinkler-pipe-hangers', crew: 2, unit: 'EA', trade: 'Fire Suppression', action: 'Install pipe hangers, braces, supports, and required seismic or restraint components for sprinkler piping.', inspectionRequired: true }),
  t({ code: '21-02-05', title: 'Pressure test fire sprinkler piping', divName: DIV_21, wpName: 'Fire Sprinkler Testing', type: 'testing', seq: 'fire-suppression', anchor: 'sprinkler-pressure-test', crew: 1, unit: 'EA', trade: 'Fire Suppression', action: 'Perform required hydrostatic or pressure test on sprinkler piping before cover-up.', inspectionRequired: true }),
  t({ code: '21-02-06', title: 'Perform rough fire sprinkler inspection', divName: DIV_21, wpName: 'Fire Sprinkler Inspection', type: 'inspection', seq: 'inspection-gate', anchor: 'rough-sprinkler-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Complete required rough fire sprinkler inspection before insulation, drywall, or cover-up.', inspectionRequired: true }),
  t({ code: '21-03-01', title: 'Install fire sprinkler heads', divName: DIV_21, wpName: 'Fire Sprinkler Trim-Out', seq: 'fire-suppression-trim', anchor: 'sprinkler-heads', crew: 2, unit: 'EA', trade: 'Fire Suppression', action: 'Install final sprinkler heads, escutcheons, covers, plates, and finish trim components.', inspectionRequired: true }),
  t({ code: '21-03-02', title: 'Install fire sprinkler alarm devices', divName: DIV_21, wpName: 'Fire Sprinkler Trim-Out', seq: 'fire-suppression-trim', anchor: 'sprinkler-alarm-devices', crew: 2, unit: 'EA', trade: 'Fire Suppression / Electrical', action: 'Install waterflow switches, tamper switches, bells, alarms, or required sprinkler monitoring devices.', inspectionRequired: true }),
  t({ code: '21-03-03', title: 'Flush fire sprinkler system', divName: DIV_21, wpName: 'Fire Sprinkler Testing', seq: 'fire-suppression-trim', anchor: 'sprinkler-system-flush', crew: 2, unit: 'EA', trade: 'Fire Suppression', action: 'Flush sprinkler piping and remove debris before final testing or acceptance.', inspectionRequired: true }),
  t({ code: '21-03-04', title: 'Perform final fire sprinkler test', divName: DIV_21, wpName: 'Fire Sprinkler Testing', type: 'testing', seq: 'fire-suppression-trim', anchor: 'final-sprinkler-test', crew: 1, unit: 'EA', trade: 'Fire Suppression', action: 'Perform final operational test of fire sprinkler system, alarms, valves, and required devices.', inspectionRequired: true }),
  t({ code: '21-03-05', title: 'Perform final fire sprinkler inspection', divName: DIV_21, wpName: 'Fire Sprinkler Inspection', type: 'inspection', seq: 'inspection-gate', anchor: 'final-sprinkler-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Complete final fire sprinkler inspection and obtain approval before occupancy or turnover.', inspectionRequired: true }),

  // ── Division 25 — Integrated Automation Rough-In ──────────────────────────
  t({ code: '25-01-01', title: 'Review integrated automation submittals', divName: DIV_25, wpName: 'Automation Submittals', seq: 'integrated-automation', anchor: 'automation-submittals', crew: 1, unit: 'LS', trade: 'Automation / Project Management', action: 'Review automation system drawings, device schedules, control requirements, network needs, and integration points.' }),
  t({ code: '25-01-02', title: 'Coordinate integrated automation device locations', divName: DIV_25, wpName: 'Automation Coordination', seq: 'integrated-automation', anchor: 'automation-device-coordination', crew: 1, unit: 'LS', trade: 'Automation', action: 'Coordinate automation panels, sensors, keypads, thermostats, cameras, speakers, access controls, and device locations before rough-in.' }),
  t({ code: '25-01-03', title: 'Install automation control enclosure', divName: DIV_25, wpName: 'Automation Rough-In', seq: 'integrated-automation', anchor: 'automation-control-enclosure', crew: 1, unit: 'EA', trade: 'Automation / Low Voltage', action: 'Install automation control enclosure, backboard, rack location, or structured control panel.' }),
  t({ code: '25-01-04', title: 'Install automation conduit pathways', divName: DIV_25, wpName: 'Automation Rough-In', seq: 'integrated-automation', anchor: 'automation-conduit-pathways', crew: 2, unit: 'LF', trade: 'Automation / Low Voltage', action: 'Install conduit pathways, sleeves, boxes, and raceways for automation wiring and control devices.', inspectionRequired: true }),
  t({ code: '25-01-05', title: 'Pull automation control wiring', divName: DIV_25, wpName: 'Automation Rough-In', seq: 'integrated-automation', anchor: 'automation-control-wiring', crew: 2, unit: 'EA', trade: 'Automation / Low Voltage', action: 'Pull control wiring for automation devices, sensors, keypads, controllers, and integration modules.', inspectionRequired: true }),
  t({ code: '25-01-06', title: 'Pull automation network cabling', divName: DIV_25, wpName: 'Automation Rough-In', seq: 'integrated-automation', anchor: 'automation-network-cabling', crew: 2, unit: 'EA', trade: 'Automation / Low Voltage', action: 'Pull network cabling for automation controllers, access points, media devices, cameras, and connected equipment.', inspectionRequired: true }),
  t({ code: '25-01-07', title: 'Pull audio visual cabling', divName: DIV_25, wpName: 'Audio Visual Rough-In', seq: 'integrated-automation', anchor: 'audio-visual-cabling', crew: 2, unit: 'EA', trade: 'Automation / Audio Visual', action: 'Pull speaker wire, HDMI, fiber, control cable, or audio visual cabling to planned device locations.', inspectionRequired: true }),
  t({ code: '25-01-08', title: 'Pull security automation cabling', divName: DIV_25, wpName: 'Security Automation Rough-In', seq: 'integrated-automation', anchor: 'security-automation-cabling', crew: 2, unit: 'EA', trade: 'Automation / Security', action: 'Pull cabling for security sensors, cameras, keypads, access controls, door contacts, and related automation devices.', inspectionRequired: true }),
  t({ code: '25-01-09', title: 'Perform automation rough-in verification', divName: DIV_25, wpName: 'Automation Rough-In', seq: 'integrated-automation', anchor: 'automation-rough-in-verification', crew: 1, unit: 'LS', trade: 'Automation', action: 'Verify automation rough-in wiring, boxes, device locations, labels, and pathways before cover-up.', inspectionRequired: true }),

  // ── Division 25 — Integrated Automation Trim-Out ──────────────────────────
  t({ code: '25-02-01', title: 'Install automation controllers', divName: DIV_25, wpName: 'Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'automation-controllers', crew: 2, unit: 'EA', trade: 'Automation', action: 'Install automation processors, hubs, controllers, relay modules, and required control hardware.' }),
  t({ code: '25-02-02', title: 'Install automation keypads and touchscreens', divName: DIV_25, wpName: 'Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'automation-keypads-touchscreens', crew: 2, unit: 'EA', trade: 'Automation', action: 'Install automation keypads, touchscreens, wall controls, and related finish devices.' }),
  t({ code: '25-02-03', title: 'Install smart thermostats', divName: DIV_25, wpName: 'Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'smart-thermostats', crew: 1, unit: 'EA', trade: 'Automation / HVAC', action: 'Install smart thermostats and connect them to HVAC control wiring and automation network.' }),
  t({ code: '25-02-04', title: 'Install smart lighting controls', divName: DIV_25, wpName: 'Lighting Automation', seq: 'integrated-automation-trim', anchor: 'smart-lighting-controls', crew: 2, unit: 'EA', trade: 'Automation / Electrical', action: 'Install smart switches, dimmers, lighting controllers, scene controllers, and related control devices.' }),
  t({ code: '25-02-05', title: 'Install automation sensors', divName: DIV_25, wpName: 'Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'automation-sensors', crew: 2, unit: 'EA', trade: 'Automation', action: 'Install occupancy sensors, temperature sensors, leak sensors, door sensors, and other automation sensors.' }),
  t({ code: '25-02-06', title: 'Install security automation devices', divName: DIV_25, wpName: 'Security Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'security-automation-devices', crew: 2, unit: 'EA', trade: 'Automation / Security', action: 'Install cameras, access controls, alarm keypads, motion sensors, contacts, and related security automation devices.' }),
  t({ code: '25-02-07', title: 'Install audio visual devices', divName: DIV_25, wpName: 'Audio Visual Trim-Out', seq: 'integrated-automation-trim', anchor: 'audio-visual-devices', crew: 2, unit: 'EA', trade: 'Automation / Audio Visual', action: 'Install speakers, displays, mounts, media plates, receivers, and related audio visual devices.' }),
  t({ code: '25-02-08', title: 'Terminate automation cabling', divName: DIV_25, wpName: 'Automation Trim-Out', seq: 'integrated-automation-trim', anchor: 'automation-cable-termination', crew: 2, unit: 'EA', trade: 'Automation / Low Voltage', action: 'Terminate automation cabling, label circuits, connect panels, and verify cable continuity.' }),

  // ── Division 25 — Automation Programming and Commissioning ───────────────
  t({ code: '25-03-01', title: 'Program integrated automation system', divName: DIV_25, wpName: 'Automation Commissioning', seq: 'integrated-automation-commissioning', anchor: 'automation-programming', crew: 1, unit: 'LS', trade: 'Automation', action: 'Program automation scenes, schedules, device logic, network settings, integrations, and user interface controls.' }),
  t({ code: '25-03-02', title: 'Test integrated automation devices', divName: DIV_25, wpName: 'Automation Commissioning', type: 'testing', seq: 'integrated-automation-commissioning', anchor: 'automation-device-testing', crew: 1, unit: 'LS', trade: 'Automation', action: 'Test automation devices, controls, sensors, scenes, network communication, and integrated system responses.', inspectionRequired: true }),
  t({ code: '25-03-03', title: 'Commission integrated automation system', divName: DIV_25, wpName: 'Automation Commissioning', seq: 'integrated-automation-commissioning', anchor: 'automation-commissioning', crew: 1, unit: 'LS', trade: 'Automation', action: 'Commission the full automation system and verify owner-ready operation.', inspectionRequired: true }),
  t({ code: '25-03-04', title: 'Train owner on automation system', divName: DIV_25, wpName: 'Automation Turnover', seq: 'closeout', anchor: 'automation-owner-training', crew: 1, unit: 'LS', trade: 'Automation', action: 'Provide owner training for automation controls, apps, scenes, schedules, security functions, and basic troubleshooting.' }),
  t({ code: '25-03-05', title: 'Turn over automation documentation', divName: DIV_25, wpName: 'Automation Turnover', seq: 'closeout', anchor: 'automation-documentation-turnover', crew: 1, unit: 'LS', trade: 'Automation', action: 'Provide automation documentation, network settings, device schedules, warranties, manuals, and access credentials at turnover.' }),

  // ── Division 28 — Security Rough-In ──────────────────────────────────────
  t({ code: '28-01-01', title: 'Review security system rough-in layout', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'security-layout-review', crew: 1, unit: 'LS', trade: 'Security / Low Voltage', action: 'Review camera, alarm, keypad, sensor, and control panel locations before wall rough-in.' }),
  t({ code: '28-01-02', title: 'Install security control panel backbox', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'security-panel-backbox', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install the security control panel backbox or enclosure at the approved equipment location.' }),
  t({ code: '28-01-03', title: 'Install keypad rough-in boxes', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'keypad-rough-in', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install rough-in boxes or mounting rings for alarm keypads and user control stations.' }),
  t({ code: '28-01-04', title: 'Pull security keypad cable', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'keypad-cable', crew: 2, unit: 'LF', trade: 'Security / Low Voltage', action: 'Pull low-voltage control cable from the security control panel to keypad locations.' }),
  t({ code: '28-01-05', title: 'Pull door contact sensor cable', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'door-contact-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull sensor cable to exterior door contact locations before wall close-in.' }),
  t({ code: '28-01-06', title: 'Pull window contact sensor cable', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'window-contact-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull sensor cable to selected window contact locations before wall close-in.' }),
  t({ code: '28-01-07', title: 'Pull motion detector cable', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'motion-detector-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull low-voltage cable to motion detector locations before wall close-in.' }),
  t({ code: '28-01-08', title: 'Pull glass break detector cable', divName: DIV_28, wpName: 'Security Rough-In', seq: 'low-voltage', anchor: 'glass-break-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull low-voltage cable to glass break detector locations where included in the system design.' }),

  // ── Division 28 — Video Surveillance Rough-In ────────────────────────────
  t({ code: '28-02-01', title: 'Install video doorbell rough-in', divName: DIV_28, wpName: 'Video Surveillance Rough-In', seq: 'low-voltage', anchor: 'video-doorbell-rough-in', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install rough-in wiring and box for video doorbell or entry camera device.' }),
  t({ code: '28-02-02', title: 'Pull exterior camera cable', divName: DIV_28, wpName: 'Video Surveillance Rough-In', seq: 'low-voltage', anchor: 'exterior-camera-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull low-voltage or network cable to exterior security camera locations.', weatherSensitive: true }),
  t({ code: '28-02-03', title: 'Pull interior camera cable', divName: DIV_28, wpName: 'Video Surveillance Rough-In', seq: 'low-voltage', anchor: 'interior-camera-cable', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Pull low-voltage or network cable to interior camera locations where included in the system design.' }),
  t({ code: '28-02-04', title: 'Install camera mounting backboxes', divName: DIV_28, wpName: 'Video Surveillance Rough-In', seq: 'low-voltage', anchor: 'camera-backboxes', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install exterior or interior mounting boxes, rings, or backplates for security cameras.' }),

  // ── Division 28 — Security Trim-Out ──────────────────────────────────────
  t({ code: '28-03-01', title: 'Install alarm control panel', divName: DIV_28, wpName: 'Security Trim-Out', seq: 'finish-trim', anchor: 'alarm-panel-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install and terminate the alarm control panel after wall finishes are complete.' }),
  t({ code: '28-03-02', title: 'Install alarm keypads', divName: DIV_28, wpName: 'Security Trim-Out', seq: 'finish-trim', anchor: 'keypad-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install alarm keypads and connect them to the security control panel wiring.' }),
  t({ code: '28-03-03', title: 'Install door contact sensors', divName: DIV_28, wpName: 'Security Trim-Out', seq: 'finish-trim', anchor: 'door-contact-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install and test contact sensors at exterior doors.' }),
  t({ code: '28-03-04', title: 'Install window contact sensors', divName: DIV_28, wpName: 'Security Trim-Out', seq: 'finish-trim', anchor: 'window-contact-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install and test contact sensors at selected windows.' }),
  t({ code: '28-03-05', title: 'Install motion detectors', divName: DIV_28, wpName: 'Security Trim-Out', seq: 'finish-trim', anchor: 'motion-detector-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install, aim, and test motion detectors after interior finishes are complete.' }),
  t({ code: '28-03-06', title: 'Install security cameras', divName: DIV_28, wpName: 'Video Surveillance Trim-Out', seq: 'finish-trim', anchor: 'camera-install', crew: 2, unit: 'EA', trade: 'Security / Low Voltage', action: 'Install and aim security cameras at approved locations.' }),

  // ── Division 28 — Security Commissioning ─────────────────────────────────
  t({ code: '28-04-01', title: 'Program security system', divName: DIV_28, wpName: 'Security Commissioning', seq: 'commissioning', anchor: 'security-programming', crew: 1, unit: 'LS', trade: 'Security / Low Voltage', action: 'Program user codes, zones, device names, notifications, and monitoring settings.' }),
  t({ code: '28-04-02', title: 'Test security system devices', divName: DIV_28, wpName: 'Security Commissioning', type: 'testing', seq: 'commissioning', anchor: 'security-device-test', crew: 1, unit: 'LS', trade: 'Security / Low Voltage', action: 'Test keypads, door sensors, window sensors, motion detectors, cameras, and alarm response functions.', inspectionRequired: true }),
  t({ code: '28-04-03', title: 'Train owner on security system', divName: DIV_28, wpName: 'Security Commissioning', seq: 'closeout', anchor: 'security-owner-training', crew: 1, unit: 'LS', trade: 'Security / Low Voltage', action: 'Provide owner training for security system operation, app access, user codes, and basic troubleshooting.' }),

  // ── Division 48 — Power Generation Planning ──────────────────────────────
  t({ code: '48-01-01', title: 'Review power generation system layout', divName: DIV_48, wpName: 'Power Generation Planning', seq: 'power-generation', anchor: 'power-generation-layout-review', crew: 1, unit: 'LS', trade: 'Electrical / Solar', action: 'Review generator, solar, battery, inverter, transfer switch, and utility interconnection locations.' }),
  t({ code: '48-01-02', title: 'Submit power generation interconnection documents', divName: DIV_48, wpName: 'Power Generation Planning', seq: 'power-generation', anchor: 'interconnection-submittal', crew: 1, unit: 'LS', trade: 'Electrical / Solar', action: 'Submit required utility or AHJ interconnection documents for solar, battery, or generator systems.', inspectionRequired: true }),
  t({ code: '48-01-03', title: 'Receive power generation approval', divName: DIV_48, wpName: 'Power Generation Planning', seq: 'power-generation', anchor: 'power-generation-approval', crew: 1, unit: 'LS', trade: 'Utility / AHJ', action: 'Record approval to install or interconnect the power generation system.', inspectionRequired: true }),

  // ── Division 48 — Standby Generator ──────────────────────────────────────
  t({ code: '48-02-01', title: 'Install generator concrete pad', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-pad', crew: 3, unit: 'EA', trade: 'Concrete / Electrical', action: 'Place concrete pad or approved equipment base for standby generator installation.', weatherSensitive: true }),
  t({ code: '48-02-02', title: 'Set standby generator', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-set', crew: 3, unit: 'EA', trade: 'Electrical / Generator', action: 'Set standby generator on approved pad or base at final equipment location.', weatherSensitive: true }),
  t({ code: '48-02-03', title: 'Install generator feeder conduit', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-feeder-conduit', crew: 2, unit: 'LF', trade: 'Electrical', action: 'Install conduit pathway between generator, transfer switch, and service equipment.' }),
  t({ code: '48-02-04', title: 'Pull generator feeder conductors', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-feeder-conductors', crew: 2, unit: 'LF', trade: 'Electrical', action: 'Pull generator feeder conductors through installed conduit pathways.' }),
  t({ code: '48-02-05', title: 'Install automatic transfer switch', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'transfer-switch', crew: 2, unit: 'EA', trade: 'Electrical', action: 'Install automatic transfer switch and required service or load-side connections.', inspectionRequired: true }),
  t({ code: '48-02-06', title: 'Install generator control wiring', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-control-wiring', crew: 2, unit: 'LF', trade: 'Electrical', action: 'Install low-voltage control wiring between generator, transfer switch, and monitoring equipment.' }),
  t({ code: '48-02-07', title: 'Install generator fuel piping', divName: DIV_48, wpName: 'Standby Generator', seq: 'power-generation', anchor: 'generator-fuel-piping', crew: 2, unit: 'LF', trade: 'Plumbing / Gas', action: 'Install natural gas or propane fuel piping to the standby generator location.', inspectionRequired: true }),
  t({ code: '48-02-08', title: 'Pressure test generator fuel piping', divName: DIV_48, wpName: 'Standby Generator', type: 'testing', seq: 'power-generation', anchor: 'generator-fuel-test', crew: 1, unit: 'EA', trade: 'Plumbing / Gas', action: 'Pressure test generator fuel piping before startup and final connection approval.', inspectionRequired: true }),
  t({ code: '48-02-09', title: 'Start up standby generator', divName: DIV_48, wpName: 'Standby Generator', seq: 'commissioning', anchor: 'generator-startup', crew: 2, unit: 'EA', trade: 'Generator Technician', action: 'Perform generator startup, basic operating checks, and manufacturer-required commissioning steps.', inspectionRequired: true }),

  // ── Division 48 — Solar Photovoltaic ─────────────────────────────────────
  t({ code: '48-03-01', title: 'Install solar roof attachments', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-roof-attachments', crew: 3, unit: 'EA', trade: 'Solar', action: 'Install flashed roof attachments or mounting points for the solar racking system.', weatherSensitive: true }),
  t({ code: '48-03-02', title: 'Install solar racking rails', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-racking', crew: 3, unit: 'LF', trade: 'Solar', action: 'Install solar racking rails and mounting hardware on approved roof or ground supports.', weatherSensitive: true }),
  t({ code: '48-03-03', title: 'Install solar PV modules', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-modules', crew: 4, unit: 'EA', trade: 'Solar', action: 'Install photovoltaic modules on completed racking system.', weatherSensitive: true }),
  t({ code: '48-03-04', title: 'Install solar DC wiring', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-dc-wiring', crew: 3, unit: 'LS', trade: 'Solar / Electrical', action: 'Install DC conductors, string wiring, grounding, and module-level electrical connections.', inspectionRequired: true, weatherSensitive: true }),
  t({ code: '48-03-05', title: 'Install solar inverter', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-inverter', crew: 2, unit: 'EA', trade: 'Solar / Electrical', action: 'Install solar inverter, combiner, or inverter system equipment at approved location.', inspectionRequired: true }),
  t({ code: '48-03-06', title: 'Install solar AC disconnect', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-ac-disconnect', crew: 2, unit: 'EA', trade: 'Solar / Electrical', action: 'Install required AC disconnect or service disconnect for the solar PV system.', inspectionRequired: true }),
  t({ code: '48-03-07', title: 'Install solar production meter', divName: DIV_48, wpName: 'Solar Photovoltaic', seq: 'power-generation', anchor: 'solar-production-meter', crew: 2, unit: 'EA', trade: 'Solar / Electrical', action: 'Install production meter, meter base, or monitoring meter where required by utility or system design.', inspectionRequired: true }),

  // ── Division 48 — Battery Storage ────────────────────────────────────────
  t({ code: '48-04-01', title: 'Install battery storage equipment', divName: DIV_48, wpName: 'Battery Storage', seq: 'power-generation', anchor: 'battery-equipment', crew: 3, unit: 'EA', trade: 'Electrical / Battery Storage', action: 'Install battery cabinet, battery modules, or wall-mounted battery system at approved location.', inspectionRequired: true }),
  t({ code: '48-04-02', title: 'Install battery inverter equipment', divName: DIV_48, wpName: 'Battery Storage', seq: 'power-generation', anchor: 'battery-inverter', crew: 2, unit: 'EA', trade: 'Electrical / Battery Storage', action: 'Install battery inverter, gateway, or energy management equipment.', inspectionRequired: true }),
  t({ code: '48-04-03', title: 'Install battery system conductors', divName: DIV_48, wpName: 'Battery Storage', seq: 'power-generation', anchor: 'battery-conductors', crew: 2, unit: 'LS', trade: 'Electrical / Battery Storage', action: 'Install conductors, raceways, grounding, and control wiring for battery storage system.', inspectionRequired: true }),
  t({ code: '48-04-04', title: 'Configure battery backup circuits', divName: DIV_48, wpName: 'Battery Storage', seq: 'power-generation', anchor: 'battery-backup-circuits', crew: 2, unit: 'LS', trade: 'Electrical / Battery Storage', action: 'Configure backed-up circuits, critical load panel, or energy management settings.', inspectionRequired: true }),

  // ── Division 48 — Power Generation Testing and Closeout ──────────────────
  t({ code: '48-05-01', title: 'Perform power generation electrical inspection', divName: DIV_48, wpName: 'Power Generation Testing', type: 'inspection', seq: 'inspection-gate', anchor: 'power-generation-inspection', crew: 1, unit: 'EA', trade: 'Inspector', action: 'Inspect power generation equipment, conductors, disconnects, labeling, grounding, and interconnection readiness.', inspectionRequired: true }),
  t({ code: '48-05-02', title: 'Commission solar PV system', divName: DIV_48, wpName: 'Power Generation Testing', seq: 'commissioning', anchor: 'solar-commissioning', crew: 2, unit: 'LS', trade: 'Solar / Electrical', action: 'Test solar PV system startup, inverter operation, monitoring, and production output.', inspectionRequired: true }),
  t({ code: '48-05-03', title: 'Commission battery storage system', divName: DIV_48, wpName: 'Power Generation Testing', seq: 'commissioning', anchor: 'battery-commissioning', crew: 2, unit: 'LS', trade: 'Electrical / Battery Storage', action: 'Test battery charge, discharge, backup operation, monitoring, and owner-selected backup settings.', inspectionRequired: true }),
  t({ code: '48-05-04', title: 'Receive utility permission to operate', divName: DIV_48, wpName: 'Power Generation Testing', seq: 'commissioning', anchor: 'permission-to-operate', crew: 1, unit: 'LS', trade: 'Utility', action: 'Record utility permission to operate before enabling grid-interactive solar or battery export functions.', inspectionRequired: true }),
  t({ code: '48-05-05', title: 'Train owner on power generation system', divName: DIV_48, wpName: 'Power Generation Closeout', seq: 'closeout', anchor: 'power-generation-owner-training', crew: 1, unit: 'LS', trade: 'Electrical / Solar', action: 'Provide owner training for generator, solar, battery, monitoring, shutdown, and emergency procedures.' }),
];
