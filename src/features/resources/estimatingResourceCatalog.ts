export type EstimatingResourceType =
  | 'table'
  | 'checklist'
  | 'formula'
  | 'guide'
  | 'printable'
  | 'reference';

export type EstimatingResourceStatus = 'available' | 'coming-soon';

export type EstimatingResourceBadge = 'Reference' | 'Table' | 'Checklist' | 'Printable-ready';

export type EstimatingResource = {
  id: string;
  title: string;
  description: string;
  type: EstimatingResourceType;
  badge: EstimatingResourceBadge;
  category: string;
  route?: string;
  status: EstimatingResourceStatus;
  tags: string[];
  printable?: boolean;
};

export const ESTIMATING_PAGE_SUBTITLE =
  'Reference tables, takeoff helpers, cost breakdowns, and bid review checklists for construction project teams.';

export const ESTIMATING_DISCLAIMER =
  'These references support estimating workflow and review. Verify quantities, labor, production rates, supplier pricing, subcontractor quotes, tax, bond, insurance, and contract requirements before submitting a proposal.';

export const ARDEN_ESTIMATING_NOTE =
  'These resources are original Arden planning references. They do not replace project documents, local code, contract terms, company pricing, or professional judgment.';

export const PROPRIETARY_DATA_NOTE =
  'Commercial cost databases are not reproduced here. Arden uses approved internal/manual data and user-entered company pricing where applicable.';

/** Vendor/product names that must not appear in estimating resource copy. */
export const PROHIBITED_VENDOR_TERMS = [
  'Procore',
  'Autodesk',
  'RSMeans',
  'Gordian',
  'Craftsman Book',
  'Means Building Construction Cost Data',
  'Calculated Industries',
] as const;

export const ESTIMATING_WORKFLOW_ROWS: {
  step: string;
  whatToVerify: string;
  ardenNote: string;
}[] = [
  {
    step: 'Define the estimate purpose',
    whatToVerify: 'ROM, budget, bid, or control estimate; audience and decision needed',
    ardenNote: 'Match format and detail to how the number will be used',
  },
  {
    step: 'Review the scope documents',
    whatToVerify: 'Drawings, specs, addenda, geotech, surveys, and contract exhibits',
    ardenNote: 'Log revision dates and missing documents before takeoff',
  },
  {
    step: 'Walk the site or document known site conditions',
    whatToVerify: 'Access, staging, utilities, demolition, soil, neighbors, and constraints',
    ardenNote: 'Capture photos and field notes for assumptions',
  },
  {
    step: 'Build the work breakdown',
    whatToVerify: 'Divisions, activities, and self-perform vs. subcontract packages',
    ardenNote: 'Align structure with how the proposal will be presented',
  },
  {
    step: 'Perform quantity takeoff',
    whatToVerify: 'Measured quantities tied to drawing/spec references',
    ardenNote: 'Use consistent units and waste factors',
  },
  {
    step: 'Price labor, materials, equipment, and subcontractors',
    whatToVerify: 'Burdened labor, quoted materials, rental rates, and sub quotes',
    ardenNote: 'Compare subs for scope alignment, not price alone',
  },
  {
    step: 'Add project overhead and indirect costs',
    whatToVerify: 'Supervision, temp facilities, mobilization, and job-specific indirects',
    ardenNote: 'Separate job overhead from home office allocation',
  },
  {
    step: 'Add risk, contingency, tax, bond, insurance, and profit',
    whatToVerify: 'Allowances, escalation, and contract-required fees',
    ardenNote: 'Document basis for contingency and markup',
  },
  {
    step: 'Review assumptions, exclusions, and alternates',
    whatToVerify: 'Written scope boundaries and unresolved selections',
    ardenNote: 'Proposal language should match estimate scope',
  },
  {
    step: 'Convert the estimate into a proposal or schedule of values',
    whatToVerify: 'Client names, dates, totals, attachments, and approval',
    ardenNote: 'Schedule of values should trace to estimate line items',
  },
];

export const ESTIMATE_TYPES_ROWS: {
  estimateType: string;
  whenUsed: string;
  typicalBasis: string;
  riskLevel: string;
}[] = [
  {
    estimateType: 'ROM / feasibility estimate',
    whenUsed: 'Early go/no-go and budget direction',
    typicalBasis: 'Concept plans, historical costs, parametric assumptions',
    riskLevel: 'High',
  },
  {
    estimateType: 'Concept estimate',
    whenUsed: 'Design development and option comparison',
    typicalBasis: 'Schematic layouts, assemblies, allowance-heavy scope',
    riskLevel: 'High',
  },
  {
    estimateType: 'Budget estimate',
    whenUsed: 'Owner budgeting and financing milestones',
    typicalBasis: 'Partial drawings, defined program, major assemblies',
    riskLevel: 'Medium–high',
  },
  {
    estimateType: 'Design-progress estimate',
    whenUsed: 'Tracking cost as design advances',
    typicalBasis: 'Progressive drawing sets and updated quantities',
    riskLevel: 'Medium',
  },
  {
    estimateType: 'Construction document estimate',
    whenUsed: 'Pre-bid validation against near-final documents',
    typicalBasis: 'Issued for construction drawings and specs',
    riskLevel: 'Medium',
  },
  {
    estimateType: 'Bid estimate',
    whenUsed: 'Competitive proposal or GMP submission',
    typicalBasis: 'Complete IFB/IFP documents, quotes, and production plans',
    riskLevel: 'Lower at submission (scope fixed)',
  },
  {
    estimateType: 'Control estimate / project budget',
    whenUsed: 'Cost control during construction',
    typicalBasis: 'Awarded contract, committed costs, forecast changes',
    riskLevel: 'Managed through updates and change orders',
  },
];

export const ESTIMATE_LINE_ITEM_ANATOMY_ROWS: {
  field: string;
  whyItMatters: string;
  example: string;
}[] = [
  { field: 'Division', whyItMatters: 'Organizes work by specification section', example: '03 Concrete' },
  { field: 'Activity', whyItMatters: 'Groups related line items for review', example: 'Slab on grade' },
  { field: 'Work element', whyItMatters: 'Describes the measured task', example: '4" SOG, #4 @ 18" OC' },
  { field: 'Quantity', whyItMatters: 'Takeoff amount driving cost', example: '1,240 SF' },
  { field: 'Unit of measure', whyItMatters: 'Standard unit for pricing and production', example: 'SF' },
  { field: 'Production rate', whyItMatters: 'Links quantity to labor effort', example: '0.08 MH/SF' },
  { field: 'Crew / labor role', whyItMatters: 'Defines who performs the work', example: '3 finishers + 1 laborer' },
  { field: 'Labor cost', whyItMatters: 'Direct labor dollars for self-perform work', example: 'Burdened rate × man-hours' },
  { field: 'Material cost', whyItMatters: 'Permanent materials and supplies', example: 'Concrete, rebar, vapor barrier' },
  { field: 'Equipment cost', whyItMatters: 'Tools and machinery for the task', example: 'Pump, vibrators, forms' },
  { field: 'Subcontract cost', whyItMatters: 'Quoted specialty or trade package', example: 'Flatwork subcontract' },
  { field: 'Indirect cost', whyItMatters: 'Job-specific overhead allocation', example: 'Supervision, temp power' },
  { field: 'Markup / profit', whyItMatters: 'Margin applied per company policy', example: '10% on direct cost' },
  { field: 'Drawing/spec reference', whyItMatters: 'Traceability to source documents', example: 'A-101, Spec 03 30 00' },
  { field: 'Assumptions / exclusions', whyItMatters: 'Documents scope boundaries and risk', example: 'Owner-furnished rebar' },
];

export const COMMON_UNITS_OF_MEASURE_ROWS: {
  unit: string;
  usedFor: string;
  estimatorCheck: string;
}[] = [
  { unit: 'EA', usedFor: 'Countable items', estimatorCheck: 'Confirm count matches plan symbols' },
  { unit: 'LF', usedFor: 'Linear work', estimatorCheck: 'Verify net length vs. gross with waste' },
  { unit: 'SF', usedFor: 'Area work', estimatorCheck: 'Confirm area boundaries and openings' },
  { unit: 'SY', usedFor: 'Paving and earthwork surfaces', estimatorCheck: 'Convert from SF (9 SF = 1 SY)' },
  { unit: 'CF', usedFor: 'Small volume quantities', estimatorCheck: 'Check depth and compaction assumptions' },
  { unit: 'CY', usedFor: 'Concrete and earthwork volume', estimatorCheck: 'Convert from CF (27 CF = 1 CY)' },
  { unit: 'TON', usedFor: 'Aggregate, asphalt, steel by weight', estimatorCheck: 'Confirm density/conversion factor' },
  { unit: 'LB', usedFor: 'Rebar, fasteners, small steel', estimatorCheck: 'Include lap and accessory weight if required' },
  { unit: 'HR', usedFor: 'Labor or equipment hours', estimatorCheck: 'Distinguish man-hours from machine hours' },
  { unit: 'DAY', usedFor: 'Crew or rental duration', estimatorCheck: 'Account for mobilization and standby' },
  { unit: 'LS', usedFor: 'Lump-sum scope packages', estimatorCheck: 'Document inclusions, exclusions, and assumptions' },
];

export const LS_UNIT_WARNING =
  'Use lump sum carefully. Document what is included, excluded, and assumed.';

export const QUANTITY_TAKEOFF_FORMULA_ROWS: {
  calculation: string;
  formula: string;
  commonUse: string;
}[] = [
  { calculation: 'Area', formula: 'length × width', commonUse: 'Slabs, rooms, paving' },
  { calculation: 'Wall area', formula: 'wall length × wall height', commonUse: 'Drywall, paint, masonry' },
  { calculation: 'Volume', formula: 'length × width × depth', commonUse: 'Concrete, excavation' },
  { calculation: 'Cubic yards', formula: 'cubic feet ÷ 27', commonUse: 'Concrete order quantities' },
  { calculation: 'Count by coverage', formula: 'total required quantity ÷ coverage per unit', commonUse: 'Sheets, blocks, fixtures' },
  { calculation: 'Waste quantity', formula: 'base quantity × waste percent', commonUse: 'Material overage allowance' },
  { calculation: 'Adjusted quantity', formula: 'base quantity × (1 + waste percent)', commonUse: 'Order quantities with waste' },
  { calculation: 'Crew-days', formula: 'man-hours ÷ (crew size × hours per day)', commonUse: 'Schedule and labor planning' },
  { calculation: 'Labor cost', formula: 'man-hours × fully burdened labor rate', commonUse: 'Self-perform labor dollars' },
  { calculation: 'Material total', formula: 'quantity × unit cost', commonUse: 'Material line pricing' },
  { calculation: 'Equipment total', formula: 'equipment hours or days × equipment rate', commonUse: 'Owned or rented equipment' },
  { calculation: 'Subcontract total', formula: 'quoted scope + approved alternates', commonUse: 'Specialty trade packages' },
];

export const COST_BREAKDOWN_ROWS: {
  costBucket: string;
  includes: string;
  reviewPrompt: string;
}[] = [
  { costBucket: 'Direct labor', includes: 'Field labor for self-performed work', reviewPrompt: 'Are burdened rates applied?' },
  { costBucket: 'Labor burden', includes: 'Taxes, insurance, benefits, small tools', reviewPrompt: 'Does rate match company settings?' },
  { costBucket: 'Materials', includes: 'Permanent materials and consumables', reviewPrompt: 'Include delivery, tax, and waste?' },
  { costBucket: 'Equipment', includes: 'Owned or rented tools and machinery', reviewPrompt: 'Include operators and mobilization?' },
  { costBucket: 'Subcontractors', includes: 'Quoted trade and specialty packages', reviewPrompt: 'Scope and exclusions aligned?' },
  { costBucket: 'Project overhead / general conditions', includes: 'Superintendent, PM, temp facilities', reviewPrompt: 'Job-specific indirects complete?' },
  { costBucket: 'Home office overhead', includes: 'Corporate support allocation', reviewPrompt: 'Applied per company policy?' },
  { costBucket: 'Permits and fees', includes: 'Building permits, impact fees, inspections', reviewPrompt: 'Included or excluded in contract?' },
  { costBucket: 'Tax', includes: 'Sales/use tax where applicable', reviewPrompt: 'Exempt items and jurisdiction verified?' },
  { costBucket: 'Bond / insurance', includes: 'Performance, payment, liability, builder\'s risk', reviewPrompt: 'Contract requirements met?' },
  { costBucket: 'Contingency', includes: 'Risk allowance for unknowns', reviewPrompt: 'Basis documented separately from profit?' },
  { costBucket: 'Allowances', includes: 'Unresolved or owner-selected items', reviewPrompt: 'Allowance assumptions stated?' },
  { costBucket: 'Profit', includes: 'Company margin target', reviewPrompt: 'Appropriate for project risk?' },
  { costBucket: 'Exclusions', includes: 'Work not in estimate scope', reviewPrompt: 'Listed explicitly in proposal?' },
];

export const LABOR_BURDEN_INTRO =
  'A labor rate used for estimating should usually include more than base wage. Company settings should define how labor burden is calculated for the business. This reference is for planning only and is not legal or accounting advice.';

export const LABOR_BURDEN_ROWS: {
  component: string;
  description: string;
}[] = [
  { component: 'Base wage', description: 'Hourly or salaried field rate before add-ons' },
  { component: 'Payroll taxes', description: 'Employer FICA, unemployment, and statutory costs' },
  { component: 'Workers compensation', description: 'Class-code-based WC allocation' },
  { component: 'Liability/insurance allocation', description: 'General liability and related job allocations' },
  { component: 'Benefits', description: 'Health, retirement, and other employer-paid benefits' },
  { component: 'Paid leave', description: 'Vacation, holiday, and sick time accrual' },
  { component: 'Small tools', description: 'Consumables and minor tools often rolled into burden' },
  { component: 'Supervision allocation', description: 'Foreman or lead time attributed to the crew' },
  { component: 'Company overhead allocation if used', description: 'Home office support when applied at labor level' },
];

export const PRODUCTION_REFERENCE_INTRO =
  'Production-rate-backed estimating connects quantity to labor effort. Instead of guessing a lump sum, the estimator ties a work element to a unit, production rate, crew, and productivity factor.';

export const PRODUCTION_REFERENCE_FORMULAS = [
  'Man-hours = quantity × man-hours per unit × productivity factor',
  'Crew-days = man-hours ÷ (crew size × hours per day)',
  'Labor cost = man-hours × fully burdened labor rate',
];

export const PRODUCTION_REFERENCE_WARNING =
  'Production references are planning aids. Verify against company history, site conditions, crew skill, weather, access, and current project constraints.';

export const TAKEOFF_QA_CHECKLIST_ITEMS: string[] = [
  'Documents received',
  'Drawings/specs reviewed',
  'Scope included',
  'Scope excluded',
  'Quantities measured',
  'Units verified',
  'Waste factors applied',
  'Labor reviewed',
  'Materials priced',
  'Equipment reviewed',
  'Subcontractor quotes compared',
  'Schedule constraints checked',
  'Risk/contingency reviewed',
  'Proposal language checked',
];

export const SUBCONTRACTOR_QUOTE_CHECKLIST_ITEMS: string[] = [
  'Scope matches drawings/specs',
  'Inclusions listed',
  'Exclusions listed',
  'Alternates separated',
  'Taxes clarified',
  'Bond/insurance clarified',
  'Schedule availability confirmed',
  'Lead times reviewed',
  'Qualifications documented',
  'Missing scope assigned',
  'Duplicate scope removed',
];

export const BID_REVIEW_CHECKLIST_ITEMS: string[] = [
  'Estimate total reviewed',
  'Direct costs checked',
  'Indirect costs checked',
  'Markup/profit checked',
  'Tax/bond/insurance checked',
  'Allowances included',
  'Exclusions included',
  'Proposal scope matches estimate',
  'Client/project names correct',
  'Dates correct',
  'Attachments included',
  'Final approval complete',
];

export const CHANGE_ORDER_PRICING_CHECKLIST_ITEMS: string[] = [
  'Change source identified',
  'Existing contract scope checked',
  'Added work described',
  'Deleted work described',
  'Labor priced',
  'Material priced',
  'Equipment priced',
  'Subcontractor backup attached',
  'Markup/tax applied per agreement',
  'Schedule impact noted',
  'Photos/RFIs/FARs linked',
  'Client approval required before proceeding if applicable',
];

export const ESTIMATING_RESOURCES: EstimatingResource[] = [
  {
    id: 'estimating-workflow',
    title: 'Estimating Workflow',
    description:
      'Original Arden process checklist from estimate purpose through proposal handoff.',
    type: 'reference',
    badge: 'Reference',
    category: 'Workflow',
    status: 'available',
    tags: ['workflow', 'process'],
  },
  {
    id: 'estimate-types',
    title: 'Estimate Types',
    description:
      'When to use ROM, budget, bid, and control estimates — with typical basis and risk level.',
    type: 'table',
    badge: 'Table',
    category: 'Classifications',
    status: 'available',
    tags: ['classifications', 'estimate-types'],
  },
  {
    id: 'estimate-line-item-anatomy',
    title: 'Estimate Line Item Anatomy',
    description:
      'Fields that belong on a defensible estimate line and why each one matters.',
    type: 'table',
    badge: 'Table',
    category: 'Structure',
    status: 'available',
    tags: ['line-items', 'structure'],
  },
  {
    id: 'common-units-of-measure',
    title: 'Common Units of Measure',
    description: 'Standard units, typical use, and estimator checks — including lump sum cautions.',
    type: 'table',
    badge: 'Table',
    category: 'Takeoff',
    status: 'available',
    tags: ['units', 'takeoff'],
  },
  {
    id: 'quantity-takeoff-formulas',
    title: 'Quantity Takeoff Formula Reference',
    description:
      'Area, volume, waste, crew-day, and cost formulas for planning quantities and dollars.',
    type: 'table',
    badge: 'Table',
    category: 'Takeoff',
    status: 'available',
    tags: ['formulas', 'takeoff'],
  },
  {
    id: 'cost-breakdown-reference',
    title: 'Cost Breakdown Reference',
    description:
      'Direct and indirect cost buckets with review prompts before bid submission.',
    type: 'table',
    badge: 'Table',
    category: 'Cost',
    status: 'available',
    tags: ['cost', 'overhead'],
  },
  {
    id: 'labor-burden-reference',
    title: 'Labor Burden Reference',
    description:
      'Components that may roll into a fully burdened labor rate for estimating — not legal or accounting advice.',
    type: 'reference',
    badge: 'Reference',
    category: 'Labor',
    status: 'available',
    tags: ['labor', 'burden'],
  },
  {
    id: 'production-reference-guide',
    title: 'Production Reference Guide',
    description:
      'How Arden ties quantities to man-hours, crew-days, and labor cost using production rates.',
    type: 'reference',
    badge: 'Reference',
    category: 'Production',
    status: 'available',
    tags: ['production', 'crew'],
  },
  {
    id: 'takeoff-qa-checklist',
    title: 'Takeoff QA Checklist',
    description: 'Pre-bid review of documents, scope, quantities, pricing, and proposal alignment.',
    type: 'checklist',
    badge: 'Checklist',
    category: 'Checklists',
    status: 'available',
    tags: ['checklist', 'takeoff'],
    printable: true,
  },
  {
    id: 'subcontractor-quote-review',
    title: 'Subcontractor Quote Review Checklist',
    description: 'Compare subcontractor quotes for scope, exclusions, schedule, and qualifications.',
    type: 'checklist',
    badge: 'Checklist',
    category: 'Checklists',
    status: 'available',
    tags: ['checklist', 'subcontractor'],
    printable: true,
  },
  {
    id: 'bid-review-checklist',
    title: 'Bid Review Checklist',
    description: 'Final estimate and proposal review before submission.',
    type: 'checklist',
    badge: 'Checklist',
    category: 'Checklists',
    status: 'available',
    tags: ['checklist', 'bid'],
    printable: true,
  },
  {
    id: 'change-order-pricing',
    title: 'Change Order Pricing Checklist',
    description: 'Price changed work with backup, contract terms, and field documentation.',
    type: 'checklist',
    badge: 'Checklist',
    category: 'Checklists',
    status: 'available',
    tags: ['checklist', 'change-order'],
    printable: true,
  },
];

export const FEATURED_REFERENCE_IDS: string[] = [
  'estimating-workflow',
  'quantity-takeoff-formulas',
  'cost-breakdown-reference',
  'labor-burden-reference',
  'takeoff-qa-checklist',
  'subcontractor-quote-review',
  'bid-review-checklist',
  'change-order-pricing',
];

export function getEstimatingResource(id: string): EstimatingResource | undefined {
  return ESTIMATING_RESOURCES.find((r) => r.id === id);
}

/** @deprecated Use PROHIBITED_VENDOR_TERMS */
export const PROHIBITED_COMMERCIAL_DATABASE_TERMS = PROHIBITED_VENDOR_TERMS;

export function estimatingContentContainsProhibitedTerms(): string[] {
  const blob = JSON.stringify({
    ESTIMATING_RESOURCES,
    ESTIMATING_WORKFLOW_ROWS,
    ESTIMATE_TYPES_ROWS,
    ESTIMATE_LINE_ITEM_ANATOMY_ROWS,
    COMMON_UNITS_OF_MEASURE_ROWS,
    QUANTITY_TAKEOFF_FORMULA_ROWS,
    COST_BREAKDOWN_ROWS,
    LABOR_BURDEN_ROWS,
    TAKEOFF_QA_CHECKLIST_ITEMS,
    SUBCONTRACTOR_QUOTE_CHECKLIST_ITEMS,
    BID_REVIEW_CHECKLIST_ITEMS,
    CHANGE_ORDER_PRICING_CHECKLIST_ITEMS,
    ESTIMATING_DISCLAIMER,
    ARDEN_ESTIMATING_NOTE,
    PRODUCTION_REFERENCE_INTRO,
    PRODUCTION_REFERENCE_WARNING,
    LABOR_BURDEN_INTRO,
  });
  return PROHIBITED_VENDOR_TERMS.filter((term) => blob.includes(term));
}
