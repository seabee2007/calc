export type DefinitionCategoryId =
  | 'estimating'
  | 'scheduling'
  | 'gantt-cpm'
  | 'cost-markup'
  | 'project-management'
  | 'construction-documents'
  | 'acronyms';

export interface DefinitionCategory {
  id: DefinitionCategoryId | 'all';
  label: string;
}

export interface AppDefinition {
  term: string;
  aliases?: string[];
  category: DefinitionCategoryId;
  shortDefinition: string;
  plainEnglish: string;
  example?: string;
  relatedArea?: string;
}

export const DEFINITION_CATEGORIES: DefinitionCategory[] = [
  { id: 'all', label: 'All' },
  { id: 'estimating', label: 'Estimating' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'gantt-cpm', label: 'Gantt / CPM' },
  { id: 'cost-markup', label: 'Cost & Markup' },
  { id: 'project-management', label: 'Project Management' },
  { id: 'construction-documents', label: 'Construction Documents' },
  { id: 'acronyms', label: 'Acronyms' },
];

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    term: 'Labor Hours',
    aliases: ['labor hours', 'labour hours'],
    category: 'estimating',
    shortDefinition: 'The total number of hours of work needed.',
    plainEnglish: 'If 2 workers each work 8 hours, that is 16 labor hours.',
    example: '2 workers × 8 hours = 16 labor hours.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Man-Day',
    aliases: ['man day', 'man-days', 'man days', 'man-day'],
    category: 'estimating',
    shortDefinition: 'One worker working one full day.',
    plainEnglish: 'If one person works 8 hours, that is usually 1 man-day.',
    example: '40 labor hours ÷ 8 hours per day = 5 man-days.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Crew-Day',
    aliases: ['crew day', 'crew-days', 'crew days', 'crew-day'],
    category: 'estimating',
    shortDefinition: 'One full workday for the whole crew.',
    plainEnglish: 'Crew-days show how many days the full crew may need.',
    example: '40 labor hours ÷ 5 workers ÷ 8 hours per day = 1 crew-day.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Crew Size',
    aliases: ['crew size', 'workers'],
    category: 'estimating',
    shortDefinition: 'The number of workers assigned to an activity.',
    plainEnglish: 'A larger crew may finish faster, but it may cost more.',
    relatedArea: 'Estimate & schedule',
  },
  {
    term: 'Production Rate',
    aliases: ['production rate'],
    category: 'estimating',
    shortDefinition: 'How much work can be completed in a set amount of time.',
    plainEnglish: 'For example, a crew may place 500 square feet of concrete per day.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Quantity',
    category: 'estimating',
    shortDefinition: 'The amount of work being estimated.',
    plainEnglish: 'This could be square feet, cubic yards, linear feet, each, or lump sum.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Unit',
    category: 'estimating',
    shortDefinition: 'The measurement used for the quantity.',
    plainEnglish: 'Common units include SF, LF, CY, EA, and LS.',
    example: 'SF, LF, CY, EA, LS.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Direct Cost',
    category: 'cost-markup',
    shortDefinition: 'Costs directly tied to the work.',
    plainEnglish: 'Labor, materials, equipment, and subcontractors are direct costs.',
    relatedArea: 'Estimate totals',
  },
  {
    term: 'Material Cost',
    category: 'estimating',
    shortDefinition: 'The cost of materials needed for the work.',
    plainEnglish: 'Concrete, lumber, pipe, wire, drywall, and paint are materials.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Equipment Cost',
    category: 'estimating',
    shortDefinition: 'The cost of equipment needed for the work.',
    plainEnglish: 'Examples include excavators, lifts, pumps, compactors, or rentals.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Subcontractor Cost',
    aliases: ['sub cost', 'subcontract'],
    category: 'estimating',
    shortDefinition: 'The cost of work performed by another contractor.',
    plainEnglish: 'Examples include electrical, plumbing, HVAC, roofing, or specialty work.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Indirect Cost',
    category: 'cost-markup',
    shortDefinition: 'Project costs not tied to one specific activity.',
    plainEnglish:
      'Examples include supervision, temporary facilities, cleanup, safety, and admin support.',
    relatedArea: 'Estimate totals',
  },
  {
    term: 'Overhead',
    category: 'cost-markup',
    shortDefinition: 'Business costs added to the estimate.',
    plainEnglish:
      'Overhead helps cover company costs like office staff, insurance, software, and management.',
    relatedArea: 'Estimate settings',
  },
  {
    term: 'Profit',
    category: 'cost-markup',
    shortDefinition: 'The money the contractor earns above cost.',
    plainEnglish: 'Profit is not the same as overhead. It is the contractor’s return for doing the work.',
    relatedArea: 'Estimate settings',
  },
  {
    term: 'Contingency',
    category: 'cost-markup',
    shortDefinition: 'Money set aside for unknowns or risk.',
    plainEnglish: 'This helps cover unexpected costs.',
    relatedArea: 'Estimate settings',
  },
  {
    term: 'Tax',
    category: 'cost-markup',
    shortDefinition: 'Sales tax or other tax applied to the estimate.',
    plainEnglish: 'Tax rules depend on location and project type.',
    relatedArea: 'Estimate settings',
  },
  {
    term: 'Markup',
    category: 'cost-markup',
    shortDefinition: 'An added percentage used to cover overhead, profit, or risk.',
    plainEnglish: 'Markup increases the price above raw cost.',
    relatedArea: 'Estimate settings',
  },
  {
    term: 'Final Sell Price',
    aliases: ['sell price', 'bid price'],
    category: 'cost-markup',
    shortDefinition: 'The final price presented to the owner or client.',
    plainEnglish: 'This is the total price after costs, overhead, profit, contingency, and tax.',
    relatedArea: 'Estimate totals',
  },
  {
    term: 'Activity',
    category: 'scheduling',
    shortDefinition: 'A task or piece of work in the estimate or schedule.',
    plainEnglish:
      'Examples include mobilize project, form footings, place concrete, and install drywall.',
    relatedArea: 'Schedule & estimate',
  },
  {
    term: 'Activity Code',
    aliases: ['activity code', 'code'],
    category: 'scheduling',
    shortDefinition: 'A unique number for a schedule activity.',
    plainEnglish: 'The app uses codes like 03-01-02 to organize the work.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Division',
    category: 'scheduling',
    shortDefinition: 'A major category of construction work.',
    plainEnglish: 'Examples include Concrete, Earthwork, Electrical, Plumbing, and Finishes.',
    relatedArea: 'Estimate divisions',
  },
  {
    term: 'Work Package',
    category: 'scheduling',
    shortDefinition: 'A group of related activities inside a division.',
    plainEnglish: 'For example, Concrete may include footings, slab, and sidewalks.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'Predecessor',
    category: 'scheduling',
    shortDefinition: 'An activity that must happen before another activity.',
    plainEnglish: 'You usually place rebar before pouring concrete.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Successor',
    category: 'scheduling',
    shortDefinition: 'An activity that comes after another activity.',
    plainEnglish: 'Place concrete may be the successor to set forms.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Logic Link',
    aliases: ['logic link', 'relationship'],
    category: 'scheduling',
    shortDefinition: 'A connection between two activities.',
    plainEnglish: 'It tells the schedule what must happen before or after something else.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Finish-to-Start (FS)',
    aliases: ['FS', 'finish to start', 'finish-to-start'],
    category: 'gantt-cpm',
    shortDefinition: 'The next activity starts after the first one finishes.',
    plainEnglish: 'This is the most common relationship.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Start-to-Start (SS)',
    aliases: ['SS', 'start to start', 'start-to-start'],
    category: 'gantt-cpm',
    shortDefinition: 'The next activity can start after the first one starts.',
    plainEnglish: 'Two tasks can overlap.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Finish-to-Finish (FF)',
    aliases: ['FF', 'finish to finish', 'finish-to-finish'],
    category: 'gantt-cpm',
    shortDefinition: 'The next activity finishes after the first one finishes.',
    plainEnglish: 'Useful when two activities must finish together or close together.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Start-to-Finish (SF)',
    aliases: ['SF', 'start to finish', 'start-to-finish'],
    category: 'gantt-cpm',
    shortDefinition: 'The next activity finishes after the first one starts.',
    plainEnglish: 'This is less common.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Lag',
    aliases: ['lag days'],
    category: 'gantt-cpm',
    shortDefinition: 'A delay between linked activities.',
    plainEnglish: 'If concrete needs 3 days to cure before framing, that is lag time.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'Early Start (ES)',
    aliases: ['ES', 'early start'],
    category: 'gantt-cpm',
    shortDefinition: 'The earliest day an activity can start.',
    plainEnglish: 'This is based on predecessor logic.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Early Finish (EF)',
    aliases: ['EF', 'early finish'],
    category: 'gantt-cpm',
    shortDefinition: 'The earliest day an activity can finish.',
    plainEnglish: 'Early Start plus duration.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Late Start (LS)',
    aliases: ['LS', 'late start'],
    category: 'gantt-cpm',
    shortDefinition: 'The latest day an activity can start without delaying the project.',
    plainEnglish: 'If it starts later than this, the project may slip.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Late Finish (LF)',
    aliases: ['LF', 'late finish'],
    category: 'gantt-cpm',
    shortDefinition: 'The latest day an activity can finish without delaying the project.',
    plainEnglish: 'If it finishes later than this, the project may slip.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Total Float',
    aliases: ['float', 'total float'],
    category: 'gantt-cpm',
    shortDefinition: 'How many days an activity can move without delaying the whole project.',
    plainEnglish:
      'If an activity has 5 days of float, it can slip 5 days before it hurts the final completion date.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Free Float',
    aliases: ['free float'],
    category: 'gantt-cpm',
    shortDefinition: 'How many days an activity can move without delaying the next activity.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Critical Path',
    aliases: ['critical path', 'CP'],
    category: 'gantt-cpm',
    shortDefinition: 'The chain of activities that controls the project finish date.',
    plainEnglish: 'If a critical path activity is late, the whole project may be late.',
    relatedArea: 'Level III Gantt',
  },
  {
    term: 'Level III Gantt',
    aliases: ['level 3 gantt', 'gantt chart'],
    category: 'gantt-cpm',
    shortDefinition: 'A detailed schedule chart that shows activities by day.',
    plainEnglish: 'It shows when each activity starts, finishes, and how much float it has.',
    relatedArea: 'Level III Gantt tab',
  },
  {
    term: 'Resource Histogram',
    aliases: ['histogram', 'resource chart'],
    category: 'gantt-cpm',
    shortDefinition: 'A chart that shows daily labor or crew needs.',
    plainEnglish: 'It helps find days where too many workers are needed.',
    relatedArea: 'Schedule exports',
  },
  {
    term: 'Resource Leveling',
    aliases: ['leveling', 'resource leveling'],
    category: 'gantt-cpm',
    shortDefinition: 'Moving noncritical work to smooth out labor needs.',
    plainEnglish: 'The goal is to reduce overloading without delaying the project.',
    relatedArea: 'Schedule tools',
  },
  {
    term: 'RFI',
    aliases: ['request for information'],
    category: 'construction-documents',
    shortDefinition: 'Request for Information.',
    plainEnglish:
      'A question sent when something in the plans, specs, or field conditions needs clarification.',
    relatedArea: 'Planner RFIs',
  },
  {
    term: 'FAR',
    aliases: ['field adjustment request'],
    category: 'construction-documents',
    shortDefinition: 'Field Adjustment Request.',
    plainEnglish: 'A request to adjust work in the field without changing the whole project design.',
    relatedArea: 'Planner adjustments',
  },
  {
    term: 'Change Order',
    aliases: ['CO', 'change order'],
    category: 'construction-documents',
    shortDefinition: 'A formal change to scope, cost, or time.',
    plainEnglish: 'Used when the project changes after the original agreement.',
    relatedArea: 'Planner change orders',
  },
  {
    term: 'Submittal',
    category: 'construction-documents',
    shortDefinition: 'A document, product data, or sample sent for review.',
    plainEnglish: 'Examples include material data, shop drawings, colors, or equipment specs.',
    relatedArea: 'Project documents',
  },
  {
    term: 'Punch List',
    aliases: ['punchlist'],
    category: 'project-management',
    shortDefinition: 'A list of final items to fix before turnover.',
    plainEnglish: 'These are usually small incomplete or corrective items.',
    relatedArea: 'Project closeout',
  },
  {
    term: 'Turnover',
    aliases: ['project turnover', 'closeout'],
    category: 'project-management',
    shortDefinition: 'Final handoff of the project to the owner.',
    plainEnglish: 'This may include final inspections, keys, warranties, and closeout documents.',
    relatedArea: 'Project closeout',
  },
  {
    term: 'Scope of Work',
    aliases: ['scope', 'SOW', 'project scope'],
    category: 'construction-documents',
    shortDefinition: 'The written description of what work must be done.',
    plainEnglish: 'It tells the contractor and owner what is included.',
    relatedArea: 'New project form',
  },
  {
    term: 'Exclusion',
    aliases: ['exclusions'],
    category: 'construction-documents',
    shortDefinition: 'Work that is not included.',
    plainEnglish: 'Exclusions help prevent confusion about what the estimate covers.',
    relatedArea: 'Proposals & estimates',
  },
  {
    term: 'Allowance',
    category: 'construction-documents',
    shortDefinition: 'A budget placeholder for something not fully selected yet.',
    plainEnglish: 'For example, a cabinet allowance or fixture allowance.',
    relatedArea: 'Estimate line items',
  },
  {
    term: 'CPM',
    aliases: ['critical path method'],
    category: 'acronyms',
    shortDefinition: 'Critical Path Method.',
    plainEnglish: 'A way to plan activities and find which tasks control the finish date.',
    relatedArea: 'Logic Network',
  },
  {
    term: 'SF',
    aliases: ['square feet', 'sq ft'],
    category: 'acronyms',
    shortDefinition: 'Square feet.',
    plainEnglish: 'A unit used to measure area, like floor or wall area.',
    relatedArea: 'Estimate quantities',
  },
  {
    term: 'CY',
    aliases: ['cubic yards', 'cubic yard'],
    category: 'acronyms',
    shortDefinition: 'Cubic yards.',
    plainEnglish: 'A unit often used for concrete, dirt, or bulk material volume.',
    relatedArea: 'Estimate quantities',
  },
  {
    term: 'LF',
    aliases: ['linear feet', 'lineal feet'],
    category: 'acronyms',
    shortDefinition: 'Linear feet.',
    plainEnglish: 'A unit used to measure length, like pipe, curb, or trim.',
    relatedArea: 'Estimate quantities',
  },
  {
    term: 'EA',
    aliases: ['each'],
    category: 'acronyms',
    shortDefinition: 'Each.',
    plainEnglish: 'A unit used when you count one item at a time.',
    relatedArea: 'Estimate quantities',
  },
  {
    term: 'LS',
    aliases: ['lump sum'],
    category: 'acronyms',
    shortDefinition: 'Lump sum.',
    plainEnglish: 'One total price for a whole item or package of work.',
    relatedArea: 'Estimate quantities',
  },
];

export function normalizeDefinitionSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function definitionMatchesQuery(definition: AppDefinition, query: string): boolean {
  const normalized = normalizeDefinitionSearchQuery(query);
  if (!normalized) return true;

  const haystack = [
    definition.term,
    ...(definition.aliases ?? []),
    definition.shortDefinition,
    definition.plainEnglish,
    definition.example ?? '',
    definition.relatedArea ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function filterDefinitions(options: {
  definitions?: AppDefinition[];
  query?: string;
  category?: DefinitionCategoryId | 'all';
  focusTerm?: string;
}): AppDefinition[] {
  const {
    definitions = APP_DEFINITIONS,
    query = '',
    category = 'all',
    focusTerm,
  } = options;

  const effectiveQuery = focusTerm?.trim() || query;

  return definitions.filter((definition) => {
    const categoryMatch = category === 'all' || definition.category === category;
    if (!categoryMatch) return false;
    return definitionMatchesQuery(definition, effectiveQuery);
  });
}

export function findDefinitionByTerm(term: string): AppDefinition | undefined {
  const normalized = normalizeDefinitionSearchQuery(term);
  return APP_DEFINITIONS.find((definition) => {
    if (normalizeDefinitionSearchQuery(definition.term) === normalized) return true;
    return (definition.aliases ?? []).some(
      (alias) => normalizeDefinitionSearchQuery(alias) === normalized,
    );
  });
}
