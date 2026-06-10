/**
 * Central registry of all NTRP activity assemblies.
 *
 * Each assembly bundles a ConstructionActivityTemplate with:
 *   - Quantity input specs (what the user is asked to enter)
 *   - Line item quantity mappings (how inputs become line item quantities)
 *
 * Used by the assembly picker UI and the instantiateFromAssemblySpec function.
 */
import type { ActivityAssemblySpec, DivisionAssemblyGroup } from '../domain/activityAssemblyTypes';
import {
  CONTINUOUS_FOOTING_LINE_ITEMS,
  DIV03_CONCRETE,
  PLACE_CONTINUOUS_FOOTING_ACTIVITY,
  PLACE_SLAB_ON_GRADE_ACTIVITY,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from './div03ConcreteSeeds';
import {
  BACKFILL_AND_COMPACT_LINE_ITEMS,
  CLEAR_AND_GRUB_ACTIVITY,
  CLEAR_AND_GRUB_LINE_ITEMS,
  DIV31_EARTHWORK,
  EXCAVATE_FOOTINGS_ACTIVITY,
  EXCAVATE_FOOTINGS_LINE_ITEMS,
  BACKFILL_AND_COMPACT_ACTIVITY,
} from './div31EarthworkSeeds';

// ── Division 03 — Concrete ───────────────────────────────────────────────────

export const ASSEMBLY_PLACE_SLAB_ON_GRADE: ActivityAssemblySpec = {
  id: 'asm-03-place-slab-on-grade',
  divisionCode: DIV03_CONCRETE.code,
  divisionName: DIV03_CONCRETE.name,
  activityTemplateId: PLACE_SLAB_ON_GRADE_ACTIVITY.id,
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
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[0].id, // ali-form-slab-edge
      quantityInputId: 'slabPerimeterLf',
      quantityFormulaHint: 'slabPerimeterLf',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[1].id, // ali-vapor-barrier
      quantityInputId: 'slabAreaSf',
      quantityMultiplier: 1.05,
      quantityFormulaHint: 'slabAreaSf × 1.05 (5% overlap waste)',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[2].id, // ali-wwf
      quantityInputId: 'slabAreaSf',
      quantityMultiplier: 1.10,
      quantityFormulaHint: 'slabAreaSf × 1.10 (10% overlap waste)',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[3].id, // ali-place-concrete
      quantityInputId: 'slabConcreteCyd',
      quantityFormulaHint: 'slabConcreteCyd',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[4].id, // ali-finish-concrete
      quantityInputId: 'slabAreaSf',
      quantityFormulaHint: 'slabAreaSf',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[5].id, // ali-cure-concrete
      quantityInputId: 'slabAreaSf',
      quantityFormulaHint: 'slabAreaSf',
    },
    {
      lineItemTemplateId: PLACE_SLAB_ON_GRADE_LINE_ITEMS[6].id, // ali-sawcut-joints
      quantityInputId: 'controlJointLf',
      quantityFormulaHint: 'controlJointLf',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  templateMasterCode: PLACE_SLAB_ON_GRADE_ACTIVITY.code,
  keyProductionRateIds: ['03-31-05.70-0320', '03-35-29.30-0040'],
};

export const ASSEMBLY_PLACE_CONTINUOUS_FOOTING: ActivityAssemblySpec = {
  id: 'asm-03-place-continuous-footing',
  divisionCode: DIV03_CONCRETE.code,
  divisionName: DIV03_CONCRETE.name,
  activityTemplateId: PLACE_CONTINUOUS_FOOTING_ACTIVITY.id,
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
      lineItemTemplateId: CONTINUOUS_FOOTING_LINE_ITEMS[0].id, // ali-footing-forms
      quantityInputId: 'footingContactSf',
      quantityFormulaHint: 'footingContactSf',
    },
    {
      lineItemTemplateId: CONTINUOUS_FOOTING_LINE_ITEMS[1].id, // ali-footing-rebar
      quantityInputId: 'footingRebarTon',
      quantityFormulaHint: 'footingRebarTon',
    },
    {
      lineItemTemplateId: CONTINUOUS_FOOTING_LINE_ITEMS[2].id, // ali-footing-concrete
      quantityInputId: 'footingConcreteCyd',
      quantityFormulaHint: 'footingConcreteCyd',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  templateMasterCode: PLACE_CONTINUOUS_FOOTING_ACTIVITY.code,
  keyProductionRateIds: ['03-31-05.70-0130'],
};

// ── Division 31 — Earthwork ──────────────────────────────────────────────────

export const ASSEMBLY_CLEAR_AND_GRUB: ActivityAssemblySpec = {
  id: 'asm-31-clear-and-grub',
  divisionCode: DIV31_EARTHWORK.code,
  divisionName: DIV31_EARTHWORK.name,
  activityTemplateId: CLEAR_AND_GRUB_ACTIVITY.id,
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
      lineItemTemplateId: CLEAR_AND_GRUB_LINE_ITEMS[0].id, // ali-clear-grub-cut-light
      quantityInputId: 'siteAcres',
      quantityFormulaHint: 'siteAcres',
    },
    {
      lineItemTemplateId: CLEAR_AND_GRUB_LINE_ITEMS[1].id, // ali-clear-grub-stumps-light
      quantityInputId: 'siteAcres',
      quantityFormulaHint: 'siteAcres',
    },
  ],
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  templateMasterCode: CLEAR_AND_GRUB_ACTIVITY.code,
  keyProductionRateIds: ['31-11-10.10-0010'],
};

export const ASSEMBLY_EXCAVATE_FOOTINGS: ActivityAssemblySpec = {
  id: 'asm-31-excavate-footings',
  divisionCode: DIV31_EARTHWORK.code,
  divisionName: DIV31_EARTHWORK.name,
  activityTemplateId: EXCAVATE_FOOTINGS_ACTIVITY.id,
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
      lineItemTemplateId: EXCAVATE_FOOTINGS_LINE_ITEMS[0].id, // ali-excavate-trench
      quantityInputId: 'excavationCyd',
      quantityFormulaHint: 'excavationCyd',
    },
    {
      lineItemTemplateId: EXCAVATE_FOOTINGS_LINE_ITEMS[1].id, // ali-backfill-trench
      quantityInputId: 'backfillCyd',
      quantityFormulaHint: 'backfillCyd',
    },
  ],
  defaultCrewSize: 2,
  defaultHoursPerDay: 8,
  templateMasterCode: EXCAVATE_FOOTINGS_ACTIVITY.code,
  keyProductionRateIds: ['31-23-16.13-0010'],
};

export const ASSEMBLY_BACKFILL_AND_COMPACT: ActivityAssemblySpec = {
  id: 'asm-31-backfill-compact',
  divisionCode: DIV31_EARTHWORK.code,
  divisionName: DIV31_EARTHWORK.name,
  activityTemplateId: BACKFILL_AND_COMPACT_ACTIVITY.id,
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
      lineItemTemplateId: BACKFILL_AND_COMPACT_LINE_ITEMS[0].id, // ali-backfill-compact
      quantityInputId: 'backfillVolumeCyd',
      quantityFormulaHint: 'backfillVolumeCyd',
    },
  ],
  defaultCrewSize: 2,
  defaultHoursPerDay: 8,
  templateMasterCode: BACKFILL_AND_COMPACT_ACTIVITY.code,
  keyProductionRateIds: ['31-23-16.13-0090'],
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const CA_ASSEMBLY_GROUPS: DivisionAssemblyGroup[] = [
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
export const CA_ASSEMBLY_BY_ID = new Map<string, ActivityAssemblySpec>(
  CA_ASSEMBLY_GROUPS.flatMap((g) => g.assemblies).map((a) => [a.id, a]),
);
