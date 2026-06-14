export type ResourceCategoryStatus = 'available' | 'coming-soon';

export type ResourceItemType =
  | 'article'
  | 'pdf'
  | 'table'
  | 'form'
  | 'calculator-reference'
  | 'checklist';

export type ResourceCategory = {
  id: string;
  title: string;
  description: string;
  route: string;
  icon?: string;
  status?: ResourceCategoryStatus;
  tags?: string[];
};

export type ResourceItem = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  type: ResourceItemType;
  route?: string;
  filePath?: string;
  tags?: string[];
  updatedAt?: string;
};

/** Hub categories shown on `/resources`. */
export const RESOURCE_HUB_CATEGORIES: ResourceCategory[] = [
  {
    id: 'concrete',
    title: 'Concrete Resources',
    description:
      'Mix design references, curing guidance, reinforcement notes, and placement resources.',
    route: '/resources/concrete',
    icon: 'layers',
    status: 'available',
    tags: ['trade', 'guides'],
  },
  {
    id: 'estimating',
    title: 'Estimating Tables',
    description:
      'Reference tables, takeoff helpers, cost breakdowns, and bid review checklists.',
    route: '/resources/estimating',
    icon: 'calculator',
    status: 'available',
    tags: ['estimating', 'tables'],
  },
  {
    id: 'forms',
    title: 'Printable Forms',
    description:
      'Field-ready PDFs for reports, inspections, daily logs, QC records, and jobsite documentation.',
    route: '/resources/forms',
    icon: 'file-text',
    status: 'coming-soon',
    tags: ['forms', 'pdf'],
  },
  {
    id: 'conversions',
    title: 'Conversion Tables',
    description:
      'Field-ready unit conversions, measurement formulas, slope references, and material ordering checks.',
    route: '/resources/conversions',
    icon: 'arrow-left-right',
    status: 'available',
    tags: ['calculations', 'tables'],
  },
  {
    id: 'scheduling',
    title: 'Scheduling & CPM',
    description:
      'Planning references, schedule checklists, CPM basics, and field coordination tools.',
    route: '/resources/scheduling',
    icon: 'calendar-range',
    status: 'coming-soon',
    tags: ['scheduling', 'guides'],
  },
  {
    id: 'rfis-fars',
    title: 'RFIs, FARs & Change Orders',
    description:
      'Templates, workflow guides, documentation tips, and contract administration references.',
    route: '/resources/rfis-fars',
    icon: 'file-stack',
    status: 'coming-soon',
    tags: ['contract', 'guides'],
  },
  {
    id: 'qc',
    title: 'Quality Control',
    description:
      'Inspection checklists, deficiency tracking, acceptance criteria notes, and closeout support.',
    route: '/resources/qc',
    icon: 'clipboard-check',
    status: 'coming-soon',
    tags: ['qc', 'checklists'],
  },
  {
    id: 'safety',
    title: 'Safety & Toolbox Talks',
    description:
      'Safety meeting references, toolbox talk templates, hazard checklists, and field reminders.',
    route: '/resources/safety',
    icon: 'shield-check',
    status: 'coming-soon',
    tags: ['safety', 'forms'],
  },
  {
    id: 'closeout',
    title: 'Closeout & Warranty',
    description:
      'Punch list, warranty, turnover, O&M, and final documentation resources.',
    route: '/resources/closeout',
    icon: 'archive',
    status: 'coming-soon',
    tags: ['closeout', 'guides'],
  },
];

/** Future category routes reserved for later batches (not on hub yet). */
export const FUTURE_RESOURCE_CATEGORY_ROUTES = [
  '/resources/field-documentation',
  '/resources/change-orders',
] as const;

export const CONCRETE_RESOURCE_ITEMS: ResourceItem[] = [
  {
    id: 'mix-designs',
    categoryId: 'concrete',
    title: 'Understanding Concrete Mix Designs',
    description:
      'Learn about different concrete mix designs and how to choose the right one for your project based on strength requirements and environmental conditions.',
    type: 'article',
    route: '/resources/mix-designs',
    tags: ['mix design', 'guides'],
  },
  {
    id: 'weather-effects',
    categoryId: 'concrete',
    title: 'Weather Effects on Concrete Curing',
    description:
      'Discover how weather conditions affect concrete curing and what steps you can take to ensure proper curing in hot, cold, or wet conditions.',
    type: 'article',
    route: '/resources/weather-effects',
    tags: ['curing', 'weather'],
  },
  {
    id: 'reinforcement',
    categoryId: 'concrete',
    title: 'Reinforcement Techniques',
    description:
      'Explore different reinforcement methods for concrete structures, including rebar placement, fiber reinforcement, and mesh installation.',
    type: 'article',
    route: '/resources/reinforcement',
    tags: ['rebar', 'guides'],
  },
  {
    id: 'proper-finishing',
    categoryId: 'concrete',
    title: 'Proper Concrete Finishing Methods',
    description:
      'Learn about the different techniques for finishing concrete surfaces, from basic troweling to decorative finishes and surface treatments.',
    type: 'article',
    route: '/resources/proper-finishing',
    tags: ['finishing', 'guides'],
  },
  {
    id: 'common-problems',
    categoryId: 'concrete',
    title: 'Common Concrete Problems',
    description:
      'Identify and prevent common concrete issues such as cracking, scaling, discoloration, and surface defects through proper preparation and techniques.',
    type: 'article',
    route: '/resources/common-problems',
    tags: ['troubleshooting', 'guides'],
  },
  {
    id: 'admixtures',
    categoryId: 'concrete',
    title: 'Admixtures and Their Uses',
    description:
      'Understand the various concrete admixtures available and how they can improve workability, strength, and durability in different conditions.',
    type: 'article',
    route: '/resources/admixtures',
    tags: ['admixtures', 'guides'],
  },
  {
    id: 'external-resources',
    categoryId: 'concrete',
    title: 'External Resources & Standards',
    description:
      'Access industry standards, certifications, and educational resources from leading organizations in concrete construction.',
    type: 'article',
    route: '/resources/external-resources',
    tags: ['standards', 'links'],
  },
];

export function getResourceCategory(id: string): ResourceCategory | undefined {
  return RESOURCE_HUB_CATEGORIES.find((c) => c.id === id);
}

export function getResourceItemsByCategory(categoryId: string): ResourceItem[] {
  if (categoryId === 'concrete') return CONCRETE_RESOURCE_ITEMS;
  return [];
}

/** Filter type chips reserved for future search UI. */
export const RESOURCE_FILTER_TYPE_LABELS = [
  'Forms',
  'Calculations',
  'Tables',
  'Guides',
  'Checklists',
  'Trade-specific',
] as const;
