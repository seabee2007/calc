/**
 * Central registry of all Seabee activity assemblies.
 *
 * Each assembly bundles a ConstructionActivityTemplate with:
 *   - Quantity input specs (what the user is asked to enter)
 *   - Line item quantity mappings (how inputs become line item quantities)
 *
 * Used by the assembly picker UI and the instantiateFromAssemblySpec function.
 */
import type { ActivityAssemblySpec, DivisionAssemblyGroup } from '../domain/seabeeAssemblyTypes';
import {
  SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS,
  SEABEE_DIVISION_03_CONCRETE,
  SEABEE_PLACE_CONTINUOUS_FOOTING_ACTIVITY,
  SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
  SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from './seabeeConcreteSeeds';
import {
  SEABEE_BACKFILL_AND_COMPACT_LINE_ITEMS,
  SEABEE_CLEAR_AND_GRUB_ACTIVITY,
  SEABEE_CLEAR_AND_GRUB_LINE_ITEMS,
  SEABEE_DIVISION_31_EARTHWORK,
  SEABEE_EXCAVATE_FOOTINGS_ACTIVITY,
  SEABEE_EXCAVATE_FOOTINGS_LINE_ITEMS,
  SEABEE_BACKFILL_AND_COMPACT_ACTIVITY,
} from './seabeeEarthworkSeeds';

// ── Division 03 — Concrete ───────────────────────────────────────────────────

export const ASSEMBLY_PLACE_SLAB_ON_GRADE: ActivityAssemblySpec = {
  id: 'asm-03-place-slab-on-grade',
  divisionCode: SEABEE_DIVISION_03_CONCRETE.code,
  divisionName: SEABEE_DIVISION_03_CONCRETE.name,
  activityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
  displayName: 'Place Slab on Grade',
  description:
    'Edge forms, vapor barrier, WWF, concrete placement, finish, cure, and sawcut joints.',
  quantityInputs: [
    {
      id: 'slabAreaSf',
      label: 'Slab Area',
      unit: 'SF',
      description: 'Total slab area',
      formulaHint: 'length × width',
    },
    {
      id: 'slabConcreteCyd',
      label: 'Concrete Volume',
      unit: 'CYD',
      description: 'Total concrete required',
      formulaHint: 'area (SF) × thickness (in) ÷ 12 ÷ 27',
    },
    {
      id: 'slabPerimeterLf',
      label: 'Slab Perimeter',
      unit: 'LF',
      description: 'Perimeter of slab for edge forms',
      formulaHint: '2 × (length + width)',
    },
    {
      id: 'controlJointLf',
      label: 'Control Joint Length',
      unit: 'LF',
      description: 'Total length of sawcut control joints',
      formulaHint: 'typically every 10–15 ft on center',
    },
  ],
  lineItemQuantityMap: [
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[0].id, // ali-form-slab-edge
      quantityInputId: 'slabPerimeterLf',
      quantityFormulaHint: 'slabPerimeterLf',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[1].id, // ali-vapor-barrier
      quantityInputId: 'slabAreaSf',
      quantityMultiplier: 1.05,
      quantityFormulaHint: 'slabAreaSf × 1.05 (5% overlap waste)',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[2].id, // ali-wwf
      quantityInputId: 'slabAreaSf',
      quantityMultiplier: 1.10,
      quantityFormulaHint: 'slabAreaSf × 1.10 (10% overlap waste)',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[3].id, // ali-place-concrete
      quantityInputId: 'slabConcreteCyd',
      quantityFormulaHint: 'slabConcreteCyd',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[4].id, // ali-finish-concrete
      quantityInputId: 'slabAreaSf',
      quantityFormulaHint: 'slabAreaSf',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[5].id, // ali-cure-concrete
      quantityInputId: 'slabAreaSf',
      quantityFormulaHint: 'slabAreaSf',
    },
    {
      lineItemTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS[6].id, // ali-sawcut-joints
      quantityInputId: 'controlJointLf',
      quantityFormulaHint: 'controlJointLf',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  keyProductionRateIds: ['03-31-05.70-0320', '03-35-29.30-0040'],
};

export const ASSEMBLY_PLACE_CONTINUOUS_FOOTING: ActivityAssemblySpec = {
  id: 'asm-03-place-continuous-footing',
  divisionCode: SEABEE_DIVISION_03_CONCRETE.code,
  divisionName: SEABEE_DIVISION_03_CONCRETE.name,
  activityTemplateId: SEABEE_PLACE_CONTINUOUS_FOOTING_ACTIVITY.id,
  displayName: 'Place Continuous Footing',
  description: 'Form, reinforce (#4–#7 rebar), and pour continuous wall footing.',
  quantityInputs: [
    {
      id: 'footingContactSf',
      label: 'Form Contact Surface',
      unit: 'SF',
      description: 'SF of concrete surface in direct contact with forms (both sides)',
      formulaHint: '2 sides × footing height (ft) × total LF',
    },
    {
      id: 'footingRebarTon',
      label: 'Reinforcing Steel',
      unit: 'Ton',
      description: 'Total weight of rebar in footings',
      formulaHint: 'footingLf × bar weight (lb/ft) × bars per footing ÷ 2000',
    },
    {
      id: 'footingConcreteCyd',
      label: 'Concrete Volume',
      unit: 'CYD',
      description: 'Total footing concrete volume',
      formulaHint: 'total LF × width (ft) × depth (ft) ÷ 27',
    },
  ],
  lineItemQuantityMap: [
    {
      lineItemTemplateId: SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS[0].id, // ali-footing-forms
      quantityInputId: 'footingContactSf',
      quantityFormulaHint: 'footingContactSf',
    },
    {
      lineItemTemplateId: SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS[1].id, // ali-footing-rebar
      quantityInputId: 'footingRebarTon',
      quantityFormulaHint: 'footingRebarTon',
    },
    {
      lineItemTemplateId: SEABEE_CONTINUOUS_FOOTING_LINE_ITEMS[2].id, // ali-footing-concrete
      quantityInputId: 'footingConcreteCyd',
      quantityFormulaHint: 'footingConcreteCyd',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  keyProductionRateIds: ['03-31-05.70-0130'],
};

// ── Division 31 — Earthwork ──────────────────────────────────────────────────

export const ASSEMBLY_CLEAR_AND_GRUB: ActivityAssemblySpec = {
  id: 'asm-31-clear-and-grub',
  divisionCode: SEABEE_DIVISION_31_EARTHWORK.code,
  divisionName: SEABEE_DIVISION_31_EARTHWORK.name,
  activityTemplateId: SEABEE_CLEAR_AND_GRUB_ACTIVITY.id,
  displayName: 'Clear and Grub Site',
  description:
    'Cut and chip light trees (to 6-inch dia.) and grub stumps. Adjust density for heavier trees.',
  quantityInputs: [
    {
      id: 'siteAcres',
      label: 'Site Area',
      unit: 'Acre',
      description: 'Total area to clear and grub',
      formulaHint: 'area (SF) ÷ 43,560',
    },
  ],
  lineItemQuantityMap: [
    {
      lineItemTemplateId: SEABEE_CLEAR_AND_GRUB_LINE_ITEMS[0].id, // ali-clear-grub-cut-light
      quantityInputId: 'siteAcres',
      quantityFormulaHint: 'siteAcres',
    },
    {
      lineItemTemplateId: SEABEE_CLEAR_AND_GRUB_LINE_ITEMS[1].id, // ali-clear-grub-stumps-light
      quantityInputId: 'siteAcres',
      quantityFormulaHint: 'siteAcres',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  keyProductionRateIds: ['31-11-10.10-0010'],
};

export const ASSEMBLY_EXCAVATE_FOOTINGS: ActivityAssemblySpec = {
  id: 'asm-31-excavate-footings',
  divisionCode: SEABEE_DIVISION_31_EARTHWORK.code,
  divisionName: SEABEE_DIVISION_31_EARTHWORK.name,
  activityTemplateId: SEABEE_EXCAVATE_FOOTINGS_ACTIVITY.id,
  displayName: 'Excavate Footings',
  description:
    'Machine-excavate continuous footing trenches (common earth, 1–4 ft deep) and backfill after pour.',
  quantityInputs: [
    {
      id: 'excavationCyd',
      label: 'Excavation Volume',
      unit: 'Bank CYD',
      description: 'Volume of material to excavate for footings',
      formulaHint: 'trench LF × width (ft) × depth (ft) ÷ 27',
    },
    {
      id: 'backfillCyd',
      label: 'Backfill Volume',
      unit: 'CYD',
      description: 'Volume to backfill after footing cure (excavation minus footing volume)',
      formulaHint: 'excavationCyd − footingConcreteCyd',
    },
  ],
  lineItemQuantityMap: [
    {
      lineItemTemplateId: SEABEE_EXCAVATE_FOOTINGS_LINE_ITEMS[0].id, // ali-excavate-trench
      quantityInputId: 'excavationCyd',
      quantityFormulaHint: 'excavationCyd',
    },
    {
      lineItemTemplateId: SEABEE_EXCAVATE_FOOTINGS_LINE_ITEMS[1].id, // ali-backfill-trench
      quantityInputId: 'backfillCyd',
      quantityFormulaHint: 'backfillCyd',
    },
  ],
  defaultCrewSize: 2,
  defaultHoursPerDay: 8,
  keyProductionRateIds: ['31-23-16.13-0010'],
};

export const ASSEMBLY_BACKFILL_AND_COMPACT: ActivityAssemblySpec = {
  id: 'asm-31-backfill-compact',
  divisionCode: SEABEE_DIVISION_31_EARTHWORK.code,
  divisionName: SEABEE_DIVISION_31_EARTHWORK.name,
  activityTemplateId: SEABEE_BACKFILL_AND_COMPACT_ACTIVITY.id,
  displayName: 'Backfill and Compact',
  description: 'Backfill structural fill in lifts with front-end loader, 100-ft haul.',
  quantityInputs: [
    {
      id: 'backfillVolumeCyd',
      label: 'Backfill Volume',
      unit: 'CYD',
      description: 'Volume of material to backfill and compact',
    },
  ],
  lineItemQuantityMap: [
    {
      lineItemTemplateId: SEABEE_BACKFILL_AND_COMPACT_LINE_ITEMS[0].id, // ali-backfill-compact
      quantityInputId: 'backfillVolumeCyd',
      quantityFormulaHint: 'backfillVolumeCyd',
    },
  ],
  defaultCrewSize: 2,
  defaultHoursPerDay: 8,
  keyProductionRateIds: ['31-23-16.13-0090'],
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const SEABEE_ASSEMBLY_GROUPS: DivisionAssemblyGroup[] = [
  {
    divisionCode: '31',
    divisionName: 'Earthwork',
    assemblies: [
      ASSEMBLY_CLEAR_AND_GRUB,
      ASSEMBLY_EXCAVATE_FOOTINGS,
      ASSEMBLY_BACKFILL_AND_COMPACT,
    ],
  },
  {
    divisionCode: '03',
    divisionName: 'Concrete',
    assemblies: [
      ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
      ASSEMBLY_PLACE_SLAB_ON_GRADE,
    ],
  },
];

/** Flat map of all assemblies by ID for fast lookup. */
export const SEABEE_ASSEMBLY_BY_ID = new Map<string, ActivityAssemblySpec>(
  SEABEE_ASSEMBLY_GROUPS.flatMap((g) => g.assemblies).map((a) => [a.id, a]),
);
