import type { LogicSequenceRule } from './logicTypes';

export const CONSTRUCTION_SEQUENCE_RULES: LogicSequenceRule[] = [
  {
    id: 'site-verify-before-excavation',
    name: 'Site verification before excavation',
    whenActivityMatches: { titleIncludes: ['excavat'] },
    expectedPredecessors: [
      {
        titleIncludes: ['utility', 'locat'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Utility locate or site verification usually should happen before excavation.',
      },
    ],
  },
  {
    id: 'clearing-before-grading',
    name: 'Clearing before grading',
    whenActivityMatches: { titleIncludes: ['rough', 'grad'] },
    expectedPredecessors: [
      {
        titleIncludes: ['clear', 'grub'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Clearing and grubbing usually should happen before rough grading.',
      },
    ],
  },
  {
    id: 'layout-before-footing-excavation',
    name: 'Layout before footing excavation',
    whenActivityMatches: { titleIncludes: ['excavat', 'footing'] },
    expectedPredecessors: [
      {
        titleIncludes: ['layout', 'building'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Building layout usually should happen before footing excavation.',
      },
    ],
  },
  {
    id: 'excavate-before-form-footings',
    name: 'Excavation before form footings',
    whenActivityMatches: { titleIncludes: ['form', 'footing'] },
    expectedPredecessors: [
      {
        titleIncludes: ['excavat', 'footing'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footing excavation usually should happen before forming footings.',
      },
    ],
  },
  {
    id: 'excavate-before-footing-rebar',
    name: 'Excavation before footing reinforcement',
    whenActivityMatches: { titleIncludes: ['reinforc', 'footing'] },
    expectedPredecessors: [
      {
        titleIncludes: ['excavat', 'footing'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footing excavation usually should happen before installing reinforcement.',
      },
    ],
  },
  {
    id: 'forms-before-footing-concrete',
    name: 'Forms before footing concrete',
    whenActivityMatches: { titleIncludes: ['place', 'concrete', 'footing'] },
    expectedPredecessors: [
      {
        titleIncludes: ['excavat', 'footing'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footings must normally be excavated before concrete placement.',
      },
      {
        titleIncludes: ['form', 'footing'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footing forms usually should be complete before concrete placement.',
      },
      {
        titleIncludes: ['reinforc', 'footing'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footing reinforcement usually should be complete before concrete placement.',
      },
    ],
  },
  {
    id: 'rebar-before-concrete',
    name: 'Reinforcement before concrete placement',
    whenActivityMatches: { titleIncludes: ['place', 'concrete'] },
    expectedPredecessors: [
      {
        titleIncludes: ['rebar'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Reinforcement usually should be in place before concrete placement.',
      },
      {
        titleIncludes: ['reinforc'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Reinforcement usually should be in place before concrete placement.',
      },
      {
        titleIncludes: ['set', 'form'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Forms usually should be set before concrete placement.',
      },
    ],
  },
  {
    id: 'vapor-before-slab',
    name: 'Vapor barrier before slab placement',
    whenActivityMatches: { titleIncludes: ['place', 'slab'] },
    expectedPredecessors: [
      {
        titleIncludes: ['vapor', 'barrier'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Vapor barrier or base prep usually should happen before slab placement.',
      },
      {
        titleIncludes: ['slab', 'base'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Slab base prep usually should happen before slab placement.',
      },
    ],
  },
  {
    id: 'foundation-before-framing',
    name: 'Foundation before framing',
    whenActivityMatches: { titleIncludes: ['wall', 'fram'] },
    expectedPredecessors: [
      {
        titleIncludes: ['foundation'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Foundation work usually should be complete before wall framing.',
      },
      {
        titleIncludes: ['place', 'slab'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Slab or foundation work usually should be complete before wall framing.',
      },
      {
        titleIncludes: ['footing', 'concrete'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Footing concrete usually should be complete before wall framing.',
      },
    ],
  },
  {
    id: 'framing-before-mep-rough',
    name: 'Framing before MEP rough-in',
    whenActivityMatches: { titleIncludes: ['rough'] },
    expectedPredecessors: [
      {
        titleIncludes: ['fram'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Framing usually should be in place before rough MEP work.',
      },
    ],
  },
  {
    id: 'mep-before-insulation',
    name: 'MEP rough-in before insulation',
    whenActivityMatches: { titleIncludes: ['insulat'] },
    expectedPredecessors: [
      {
        titleIncludes: ['plumb', 'rough'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Plumbing rough-in usually should happen before insulation.',
      },
      {
        titleIncludes: ['electr', 'rough'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Electrical rough-in usually should happen before insulation.',
      },
      {
        titleIncludes: ['hvac', 'rough'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'HVAC rough-in usually should happen before insulation.',
      },
      {
        titleIncludes: ['pull', 'wire'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'In-wall electrical work usually should happen before insulation.',
      },
    ],
  },
  {
    id: 'insulation-before-drywall',
    name: 'Insulation before drywall',
    whenActivityMatches: { titleIncludes: ['drywall'] },
    expectedPredecessors: [
      {
        titleIncludes: ['insulat'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Insulation usually should be complete before drywall installation.',
      },
      {
        titleIncludes: ['plumb', 'rough'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Plumbing rough-in usually should be complete before drywall.',
      },
      {
        titleIncludes: ['electr', 'rough'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Electrical rough-in usually should be complete before drywall.',
      },
      {
        titleIncludes: ['pull', 'wire'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'In-wall electrical work usually should be complete before drywall.',
      },
    ],
  },
  {
    id: 'drywall-before-paint',
    name: 'Drywall before interior paint',
    whenActivityMatches: { titleIncludes: ['paint'] },
    expectedPredecessors: [
      {
        titleIncludes: ['drywall'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Drywall usually should be complete before interior paint.',
      },
    ],
  },
  {
    id: 'cleanup-before-punch',
    name: 'Cleanup before punch list',
    whenActivityMatches: { titleIncludes: ['punch'] },
    expectedPredecessors: [
      {
        titleIncludes: ['final', 'clean'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Final cleanup usually should happen before punch list work.',
      },
      {
        titleIncludes: ['clean'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Cleanup usually should happen before punch list work.',
      },
    ],
  },
  {
    id: 'punch-before-turnover',
    name: 'Punch list before turnover',
    whenActivityMatches: { titleIncludes: ['turnover'] },
    expectedPredecessors: [
      {
        titleIncludes: ['punch'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Punch list work usually should be complete before turnover.',
      },
      {
        titleIncludes: ['final', 'inspect'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Final inspections usually should be complete before turnover.',
      },
    ],
  },
  {
    id: 'concrete-before-cure',
    name: 'Concrete before curing',
    whenActivityMatches: { titleIncludes: ['cur'] },
    expectedPredecessors: [
      {
        titleIncludes: ['place', 'concrete'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Concrete placement usually should happen before curing.',
      },
    ],
  },
  {
    id: 'roof-dry-in-before-interior',
    name: 'Roof dry-in before interior finishes',
    whenActivityMatches: { titleIncludes: ['drywall'] },
    expectedPredecessors: [
      {
        titleIncludes: ['roof', 'dry'],
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'Roof dry-in usually should happen before interior drywall and finishes.',
      },
    ],
  },
];
