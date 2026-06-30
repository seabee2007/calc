import type { DesignEstimatePreviewLine } from '../types';
import type {
  DesignQuantityClassification,
  DesignQuantityDestination,
  DesignScopePackageKind,
} from './designScopeTypes';

export type DesignBuilderImportPolicy = 'include' | 'review_required' | 'exclude';

export interface DesignBuilderScheduleGroupRule {
  key: string;
  title: string;
  divisionCode: string;
  divisionName: string;
  category: string;
}

export interface DesignBuilderImportRule {
  quantityType: string;
  policy?: DesignBuilderImportPolicy;
  preferredUnit?: string;
  keywords?: readonly string[];
  scheduleGroup: DesignBuilderScheduleGroupRule;
  excludeReason?: string;
  reviewReason?: string;
}

export interface DesignBuilderImportRuleResult {
  policy: DesignBuilderImportPolicy;
  reason: string | null;
  preferredUnit?: string;
  keywords: readonly string[];
  scheduleGroup: DesignBuilderScheduleGroupRule;
}

const CONCRETE_FOOTINGS: DesignBuilderScheduleGroupRule = {
  key: '03-concrete-isolated-footings',
  title: '03 Concrete - Isolated Footings',
  divisionCode: '03',
  divisionName: 'Concrete',
  category: 'Isolated Footings',
};

const CONCRETE_COLUMNS: DesignBuilderScheduleGroupRule = {
  key: '03-concrete-rc-columns',
  title: '03 Concrete - RC Columns',
  divisionCode: '03',
  divisionName: 'Concrete',
  category: 'RC Columns',
};

const CONCRETE_BEAMS: DesignBuilderScheduleGroupRule = {
  key: '03-concrete-rc-beams',
  title: '03 Concrete - RC Beams',
  divisionCode: '03',
  divisionName: 'Concrete',
  category: 'RC Beams',
};

const CONCRETE_SLAB: DesignBuilderScheduleGroupRule = {
  key: '03-concrete-interior-floor-slab',
  title: '03 Concrete - Interior Floor Slab',
  divisionCode: '03',
  divisionName: 'Concrete',
  category: 'Interior Floor Slab',
};

const CONCRETE_RAKED_CAP: DesignBuilderScheduleGroupRule = {
  key: '03-concrete-raked-concrete-cap',
  title: '03 Concrete - Raked Concrete Cap',
  divisionCode: '03',
  divisionName: 'Concrete',
  category: 'Raked Concrete Cap',
};

const MASONRY_WALL: DesignBuilderScheduleGroupRule = {
  key: '04-masonry-cmu-wall-system',
  title: '04 Masonry - CMU Wall System',
  divisionCode: '04',
  divisionName: 'Masonry',
  category: 'CMU Wall System',
};

const ROOF_SOFFIT: DesignBuilderScheduleGroupRule = {
  key: '07-roof-soffit',
  title: '07 Thermal & Moisture Protection - Roof / Soffit',
  divisionCode: '07',
  divisionName: 'Thermal & Moisture Protection',
  category: 'Roof / Soffit',
};

const METALS_ROOF: DesignBuilderScheduleGroupRule = {
  key: '05-metals-roof-framing',
  title: '05 Metals - Roof Framing',
  divisionCode: '05',
  divisionName: 'Metals',
  category: 'Roof Framing',
};

const DEFAULT_RULES: Record<string, DesignBuilderImportRule> = {
  isolated_footings_volume: {
    quantityType: 'isolated_footings_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'footing', 'place concrete', 'isolated footing'],
    scheduleGroup: CONCRETE_FOOTINGS,
  },
  rc_columns_volume: {
    quantityType: 'rc_columns_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'column', 'place concrete', 'formed concrete'],
    scheduleGroup: CONCRETE_COLUMNS,
  },
  rc_roof_beams_volume: {
    quantityType: 'rc_roof_beams_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'beam', 'place concrete', 'formed concrete'],
    scheduleGroup: CONCRETE_BEAMS,
  },
  rc_plinth_beams_volume: {
    quantityType: 'rc_plinth_beams_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'beam', 'plinth beam', 'place concrete'],
    scheduleGroup: CONCRETE_BEAMS,
  },
  rc_tie_beams_volume: {
    quantityType: 'rc_tie_beams_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'beam', 'tie beam', 'place concrete'],
    scheduleGroup: CONCRETE_BEAMS,
  },
  interior_floor_slab_volume: {
    quantityType: 'interior_floor_slab_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'slab on grade', 'floor slab', 'place concrete'],
    scheduleGroup: CONCRETE_SLAB,
  },
  raked_concrete_cap_volume: {
    quantityType: 'raked_concrete_cap_volume',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'raked cap', 'formed concrete', 'place concrete'],
    scheduleGroup: CONCRETE_RAKED_CAP,
  },
  raked_concrete_cap_linear_length: {
    quantityType: 'raked_concrete_cap_linear_length',
    policy: 'review_required',
    preferredUnit: 'LF',
    keywords: ['formwork', 'raked cap', 'linear', 'concrete form'],
    scheduleGroup: CONCRETE_RAKED_CAP,
    reviewReason: 'Linear raked cap quantity may represent formwork or reference length; verify the work element.',
  },
  raked_concrete_cap_reinforcement_placeholder: {
    quantityType: 'raked_concrete_cap_reinforcement_placeholder',
    policy: 'exclude',
    preferredUnit: 'EA',
    keywords: ['reinforcement', 'rebar'],
    scheduleGroup: CONCRETE_RAKED_CAP,
    excludeReason: 'Placeholder quantity reserved for future structural detailing.',
  },
  rc_structural_concrete_volume: {
    quantityType: 'rc_structural_concrete_volume',
    policy: 'review_required',
    preferredUnit: 'CYD',
    keywords: ['concrete', 'structural concrete', 'place concrete'],
    scheduleGroup: {
      key: '03-concrete-structural-total',
      title: '03 Concrete - Structural Concrete Total',
      divisionCode: '03',
      divisionName: 'Concrete',
      category: 'Structural Concrete Total',
    },
    reviewReason: 'Summary rollup must be reviewed before import.',
  },
  cmu_block_count: {
    quantityType: 'cmu_block_count',
    preferredUnit: 'EA',
    keywords: ['cmu', 'block', 'masonry'],
    scheduleGroup: MASONRY_WALL,
  },
  cmu_wall_net_area: {
    quantityType: 'cmu_wall_net_area',
    preferredUnit: 'SF',
    keywords: ['cmu', 'masonry', 'wall'],
    scheduleGroup: MASONRY_WALL,
  },
  cmu_core_fill_grout: {
    quantityType: 'cmu_core_fill_grout',
    preferredUnit: 'CYD',
    keywords: ['cmu', 'grout', 'core fill'],
    scheduleGroup: MASONRY_WALL,
  },
  cmu_total_grout: {
    quantityType: 'cmu_total_grout',
    policy: 'review_required',
    preferredUnit: 'CYD',
    keywords: ['cmu', 'grout', 'core fill'],
    scheduleGroup: MASONRY_WALL,
    reviewReason: 'Total grout may overlap opening, bond beam, and closure grout component rows.',
  },
  roof_surface_area: {
    quantityType: 'roof_surface_area',
    preferredUnit: 'SF',
    keywords: ['roof', 'roofing', 'surface'],
    scheduleGroup: ROOF_SOFFIT,
  },
  corrugated_metal_roofing_area: {
    quantityType: 'corrugated_metal_roofing_area',
    preferredUnit: 'SF',
    keywords: ['roof', 'corrugated metal', 'roofing panel'],
    scheduleGroup: ROOF_SOFFIT,
  },
  roof_soffit_panel_area: {
    quantityType: 'roof_soffit_panel_area',
    preferredUnit: 'SF',
    keywords: ['soffit', 'panel', 'roof'],
    scheduleGroup: ROOF_SOFFIT,
  },
  roof_fascia_trim_length: {
    quantityType: 'roof_fascia_trim_length',
    preferredUnit: 'LF',
    keywords: ['fascia', 'trim', 'roof'],
    scheduleGroup: ROOF_SOFFIT,
  },
  ridge_cap_length: {
    quantityType: 'ridge_cap_length',
    preferredUnit: 'LF',
    keywords: ['ridge cap', 'roof', 'metal'],
    scheduleGroup: ROOF_SOFFIT,
  },
  steel_roof_truss_count: {
    quantityType: 'steel_roof_truss_count',
    preferredUnit: 'EA',
    keywords: ['steel', 'truss', 'roof truss'],
    scheduleGroup: METALS_ROOF,
  },
  steel_truss_chords_web_allowance: {
    quantityType: 'steel_truss_chords_web_allowance',
    preferredUnit: 'LF',
    keywords: ['steel', 'truss', 'web', 'chord'],
    scheduleGroup: METALS_ROOF,
  },
  steel_purlin_length: {
    quantityType: 'steel_purlin_length',
    preferredUnit: 'LF',
    keywords: ['steel', 'purlin', 'roof framing'],
    scheduleGroup: METALS_ROOF,
  },
  truss_base_plate_count: {
    quantityType: 'truss_base_plate_count',
    preferredUnit: 'EA',
    keywords: ['steel', 'base plate', 'truss'],
    scheduleGroup: METALS_ROOF,
  },
  truss_anchor_bolt_count: {
    quantityType: 'truss_anchor_bolt_count',
    preferredUnit: 'EA',
    keywords: ['anchor bolt', 'bolt', 'truss'],
    scheduleGroup: METALS_ROOF,
  },
};

const COMPONENT_CONCRETE_QUANTITY_TYPES = new Set([
  'isolated_footings_volume',
  'rc_columns_volume',
  'rc_roof_beams_volume',
  'rc_plinth_beams_volume',
  'rc_tie_beams_volume',
  'interior_floor_slab_volume',
  'raked_concrete_cap_volume',
]);

function fallbackScheduleGroup(line: DesignEstimatePreviewLine): DesignBuilderScheduleGroupRule {
  const divisionCode = line.divisionCode.trim() || '00';
  const divisionName = line.divisionName.trim() || 'Unassigned';
  return {
    key: `${divisionCode}-${line.quantityType.replace(/_/g, '-')}`,
    title: `${divisionCode} ${divisionName} - ${line.description}`,
    divisionCode,
    divisionName,
    category: line.description,
  };
}

export function hasComponentConcreteRows(lines: readonly DesignEstimatePreviewLine[]): boolean {
  return lines.some(
    (line) =>
      COMPONENT_CONCRETE_QUANTITY_TYPES.has(line.quantityType) &&
      Number.isFinite(line.quantity) &&
      line.quantity > 0,
  );
}

export function getDesignBuilderImportRule(
  line: DesignEstimatePreviewLine,
): DesignBuilderImportRule {
  return (
    DEFAULT_RULES[line.quantityType] ?? {
      quantityType: line.quantityType,
      policy: 'review_required',
      preferredUnit: line.unit,
      keywords: [line.description],
      scheduleGroup: fallbackScheduleGroup(line),
      reviewReason: 'No Design Builder import rule exists for this quantity type.',
    }
  );
}

export function resolveDesignBuilderImportRule(
  line: DesignEstimatePreviewLine,
  allLines: readonly DesignEstimatePreviewLine[],
): DesignBuilderImportRuleResult {
  const rule = getDesignBuilderImportRule(line);

  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    return {
      policy: 'exclude',
      reason: 'Zero quantity.',
      preferredUnit: rule.preferredUnit,
      keywords: rule.keywords ?? [],
      scheduleGroup: rule.scheduleGroup,
    };
  }

  if (line.quantityType === 'rc_structural_concrete_volume' && hasComponentConcreteRows(allLines)) {
    return {
      policy: 'exclude',
      reason: 'Summary rollup; importing this with component concrete rows would double count.',
      preferredUnit: rule.preferredUnit,
      keywords: rule.keywords ?? [],
      scheduleGroup: rule.scheduleGroup,
    };
  }

  if (rule.policy === 'exclude') {
    return {
      policy: 'exclude',
      reason: rule.excludeReason ?? 'Excluded by Design Builder import rule.',
      preferredUnit: rule.preferredUnit,
      keywords: rule.keywords ?? [],
      scheduleGroup: rule.scheduleGroup,
    };
  }

  if (rule.policy === 'review_required') {
    return {
      policy: 'review_required',
      reason: rule.reviewReason ?? 'Review required by Design Builder import rule.',
      preferredUnit: rule.preferredUnit,
      keywords: rule.keywords ?? [],
      scheduleGroup: rule.scheduleGroup,
    };
  }

  return {
    policy: 'include',
    reason: null,
    preferredUnit: rule.preferredUnit,
    keywords: rule.keywords ?? [],
    scheduleGroup: rule.scheduleGroup,
  };
}

type ScopeRule = {
  destination: DesignQuantityDestination;
  packageKind: DesignScopePackageKind;
  packageKey: string;
  role: DesignQuantityClassification['role'];
  preferredUnit?: string;
  keywords: readonly string[];
  includeByDefault?: boolean;
  locked?: boolean;
  reason?: string | null;
};

const STRUCTURAL_CONCRETE_PACKAGE = '03-concrete-structural-components';
const RAKED_CAP_PACKAGE = '03-concrete-raked-cap';
const MASONRY_WALL_PACKAGE = '04-masonry-cmu-wall-system';
const MASONRY_GROUT_PACKAGE = '04-masonry-grout-reinforcement-support';
const METALS_ROOF_PACKAGE = '05-metals-roof-framing';
const ROOFING_PACKAGE = '07-roofing-cladding-trim-soffit';
const OPENINGS_PACKAGE = '08-openings-doors-windows';
const REFERENCE_PACKAGE = '00-reference-review';

const SCOPE_RULES: Record<string, ScopeRule> = {
  isolated_footings_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'footing', 'place concrete']),
  rc_columns_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'column', 'place concrete']),
  rc_roof_beams_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'roof beam', 'place concrete']),
  rc_plinth_beams_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'plinth beam', 'place concrete']),
  rc_tie_beams_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'tie beam', 'place concrete']),
  interior_floor_slab_volume: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'slab on grade', 'floor slab']),
  slab_concrete: activityRule('concrete_structural', STRUCTURAL_CONCRETE_PACKAGE, 'CYD', ['concrete', 'slab', 'place concrete']),
  raked_concrete_cap_volume: activityRule('concrete_raked_cap', RAKED_CAP_PACKAGE, 'CYD', ['concrete', 'raked cap', 'formed concrete']),
  raked_concrete_cap_linear_length: referenceRule('concrete_raked_cap', RAKED_CAP_PACKAGE, 'LF', ['raked cap', 'formwork'], 'Reference length for raked cap formwork; verify before using as labor.'),
  raked_concrete_cap_reinforcement_placeholder: placeholderRule('concrete_raked_cap', RAKED_CAP_PACKAGE, 'EA', ['reinforcement', 'raked cap']),

  cmu_wall_net_area: activityRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'SF', ['cmu', 'masonry', 'wall']),
  cmu_block_count: materialRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'EA', ['cmu', 'block', 'masonry']),
  mortar_allowance: materialRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'BAG', ['mortar', 'masonry']),
  cmu_lintels: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'LF', ['lintel', 'bond beam', 'masonry']),
  cmu_core_fill_grout: materialRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'CYD', ['cmu', 'core fill', 'grout']),
  cmu_bond_beam: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'LF', ['bond beam', 'masonry']),
  cmu_bond_beam_grout: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['bond beam', 'grout']),
  cmu_jamb_grout: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['jamb', 'grout']),
  cmu_lintel_grout: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['lintel', 'grout']),
  grouted_cells_columns: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'EA', ['grouted cells', 'masonry']),
  cmu_opening_grout_total: referenceRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['opening grout', 'rollup'], 'Opening grout total is a coordination reference.'),
  cmu_sill_grout: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['sill', 'grout']),
  cmu_closure_grout: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['closure', 'grout']),
  cmu_closure_cut_blocks: materialRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'EA', ['cmu', 'cut block']),
  cmu_lintel_closure_cut_blocks: materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'EA', ['lintel', 'cut block']),
  opening_rough_area: referenceRule('masonry_cmu_wall', MASONRY_WALL_PACKAGE, 'SF', ['opening', 'rough opening'], 'Opening rough area is a masonry coordination reference.'),

  door_window_units: activityRule('openings_doors_windows', OPENINGS_PACKAGE, 'EA', ['door', 'window', 'opening']),
  opening_actual_area: referenceRule('openings_doors_windows', OPENINGS_PACKAGE, 'SF', ['door', 'window', 'opening area'], 'Opening area is an alternate/reference pricing basis.'),

  steel_roof_truss_count: activityRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'EA', ['steel', 'truss', 'roof framing']),
  steel_truss_count: activityRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'EA', ['steel', 'truss', 'roof framing']),
  hip_ridge_end_support_frame_count: activityRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'EA', ['steel', 'hip roof', 'support frame']),
  steel_purlin_length: activityRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'LF', ['steel', 'purlin', 'roof framing']),
  hip_steel_framing_length: activityRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'LF', ['steel', 'hip roof framing']),
  steel_truss_chords_web_allowance: materialRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'LF', ['steel', 'truss', 'web', 'chord']),
  truss_base_plate_count: materialRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'EA', ['base plate', 'steel']),
  truss_anchor_bolt_count: materialRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'EA', ['anchor bolt', 'steel']),
  roof_framing_reference_length: referenceRule('metals_roof_framing', METALS_ROOF_PACKAGE, 'LF', ['roof framing', 'reference'], 'Reference framing length; verify before using as labor.'),

  corrugated_metal_roofing_area: activityRule('roofing_cladding_trim', ROOFING_PACKAGE, 'SF', ['roof', 'corrugated metal', 'roofing']),
  roof_soffit_panel_area: activityRule('roofing_cladding_trim', ROOFING_PACKAGE, 'SF', ['soffit', 'panel', 'roof']),
  ridge_cap_length: materialRule('roofing_cladding_trim', ROOFING_PACKAGE, 'LF', ['ridge cap', 'roofing']),
  roof_fascia_trim_length: materialRule('roofing_cladding_trim', ROOFING_PACKAGE, 'LF', ['fascia', 'roof trim']),
  roof_surface_area: referenceRule('roofing_cladding_trim', ROOFING_PACKAGE, 'SF', ['roof area', 'reference'], 'Roof surface area is a reference when roofing panel area exists.'),
  roof_area: referenceRule('roofing_cladding_trim', ROOFING_PACKAGE, 'SF', ['roof area', 'reference'], 'Roof area is a reference when roofing panel area exists.'),

  infill_plaster_scratch_coat_area: activityRule('finishes_plaster', '09-finishes-plaster', 'SF', ['plaster', 'scratch coat']),
  infill_plaster_base_coat_area: activityRule('finishes_plaster', '09-finishes-plaster', 'SF', ['plaster', 'base coat']),
  infill_plaster_finish_coat_area: activityRule('finishes_plaster', '09-finishes-plaster', 'SF', ['plaster', 'finish coat']),

  interior_floor_tile_installed_area: activityRule('reference', REFERENCE_PACKAGE, 'SF', ['floor tile', 'tile installation']),
  interior_floor_tile_full_count: materialRule('reference', REFERENCE_PACKAGE, 'EA', ['floor tile']),
  interior_floor_tile_cut_count: materialRule('reference', REFERENCE_PACKAGE, 'EA', ['floor tile', 'cut tile']),
  interior_floor_thinset_bags: materialRule('reference', REFERENCE_PACKAGE, 'BAG', ['thinset']),
  interior_floor_thinset_volume: referenceRule('reference', REFERENCE_PACKAGE, 'M3', ['thinset'], 'Thinset volume is a reference for bag takeoff.'),
  interior_floor_grout_bags: materialRule('reference', REFERENCE_PACKAGE, 'BAG', ['floor grout']),
  interior_floor_grout_volume: referenceRule('reference', REFERENCE_PACKAGE, 'M3', ['floor grout'], 'Floor grout volume is a reference for bag takeoff.'),
};

function activityRule(
  packageKind: DesignScopePackageKind,
  packageKey: string,
  preferredUnit: string,
  keywords: readonly string[],
): ScopeRule {
  return {
    destination: 'activity_line_item',
    packageKind,
    packageKey,
    role: 'primary_labor_driver',
    includeByDefault: true,
    preferredUnit,
    keywords,
  };
}

function materialRule(
  packageKind: DesignScopePackageKind,
  packageKey: string,
  preferredUnit: string,
  keywords: readonly string[],
): ScopeRule {
  return {
    destination: 'material_resource',
    packageKind,
    packageKey,
    role: 'material_takeoff',
    includeByDefault: true,
    preferredUnit,
    keywords,
  };
}

function referenceRule(
  packageKind: DesignScopePackageKind,
  packageKey: string,
  preferredUnit: string,
  keywords: readonly string[],
  reason: string,
): ScopeRule {
  return {
    destination: 'reference_only',
    packageKind,
    packageKey,
    role: 'reference',
    includeByDefault: true,
    preferredUnit,
    keywords,
    reason,
  };
}

function placeholderRule(
  packageKind: DesignScopePackageKind,
  packageKey: string,
  preferredUnit: string,
  keywords: readonly string[],
): ScopeRule {
  return {
    destination: 'placeholder',
    packageKind,
    packageKey,
    role: 'placeholder',
    includeByDefault: false,
    locked: true,
    preferredUnit,
    keywords,
    reason: 'Placeholder quantity reserved for future detailing.',
  };
}

function hasPositiveLine(
  lines: readonly DesignEstimatePreviewLine[],
  quantityTypes: readonly string[],
): boolean {
  const types = new Set(quantityTypes);
  return lines.some((line) => types.has(line.quantityType) && Number.isFinite(line.quantity) && line.quantity > 0);
}

function parameterString(line: DesignEstimatePreviewLine, key: string): string | null {
  const value = line.parameterSnapshot[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function plasterPackageKey(line: DesignEstimatePreviewLine): string {
  const side = parameterString(line, 'plasterSide') ?? 'unspecified';
  const finish = parameterString(line, 'finish') ?? parameterString(line, 'plasterFinish') ?? 'plaster';
  return `09-finishes-plaster-${side.toLowerCase()}-${finish.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function concreteRollupClassification(
  line: DesignEstimatePreviewLine,
  allLines: readonly DesignEstimatePreviewLine[],
  base: ScopeRule,
): ScopeRule {
  if (hasComponentConcreteRows(allLines)) {
    return {
      ...base,
      destination: 'rollup',
      role: 'rollup',
      includeByDefault: false,
      locked: true,
      reason: 'Summary rollup excluded because component concrete quantities are present.',
    };
  }
  return {
    ...base,
    destination: 'quality_check',
    role: 'reference',
    includeByDefault: true,
    locked: false,
    reason: 'Only structural concrete rollup is available; review before converting to a labor driver.',
  };
}

function totalGroutClassification(
  allLines: readonly DesignEstimatePreviewLine[],
  base: ScopeRule,
): ScopeRule {
  const hasComponentGrout = hasPositiveLine(allLines, [
    'cmu_core_fill_grout',
    'cmu_bond_beam_grout',
    'cmu_jamb_grout',
    'cmu_lintel_grout',
    'cmu_sill_grout',
    'cmu_closure_grout',
  ]);
  if (!hasComponentGrout) return base;
  return {
    ...base,
    destination: 'rollup',
    role: 'rollup',
    includeByDefault: false,
    locked: true,
    reason: 'Total grout rollup excluded because component grout quantities are present.',
  };
}

function roofAreaClassification(
  allLines: readonly DesignEstimatePreviewLine[],
  base: ScopeRule,
): ScopeRule {
  if (!hasPositiveLine(allLines, ['corrugated_metal_roofing_area'])) return base;
  return {
    ...base,
    destination: 'reference_only',
    role: 'reference',
    includeByDefault: true,
    locked: false,
    reason: 'Roof area kept as reference because corrugated metal roofing area is present.',
  };
}

function cmuLintelClassification(line: DesignEstimatePreviewLine, base: ScopeRule): ScopeRule {
  const lintelType = parameterString(line, 'lintelType');
  if (lintelType === 'none') {
    return {
      ...base,
      destination: 'excluded',
      role: 'excluded',
      includeByDefault: false,
      locked: true,
      reason: 'No lintel type selected.',
    };
  }
  if (lintelType === 'bond_beam' && /precast/i.test(line.description)) {
    return {
      ...base,
      destination: 'reference_only',
      role: 'reference',
      reason: 'Lintel snapshot says bond_beam but description says precast; review naming before pricing.',
    };
  }
  return base;
}

function fallbackScopeRule(line: DesignEstimatePreviewLine): ScopeRule {
  return {
    destination: 'reference_only',
    packageKind: 'reference',
    packageKey: `${REFERENCE_PACKAGE}-${line.divisionCode || '00'}`,
    role: 'reference',
    includeByDefault: true,
    locked: false,
    preferredUnit: line.unit,
    keywords: [line.description, line.quantityType],
    reason: 'No destination-aware scope rule exists for this quantity type; kept as reference for review.',
  };
}

export function classifyDesignQuantityForScope(
  line: DesignEstimatePreviewLine,
  allLines: readonly DesignEstimatePreviewLine[],
): DesignQuantityClassification {
  let rule = SCOPE_RULES[line.quantityType] ?? fallbackScopeRule(line);

  if (line.quantityType === 'rc_structural_concrete_volume') {
    rule = concreteRollupClassification(line, allLines, {
      destination: 'rollup',
      packageKind: 'concrete_structural',
      packageKey: STRUCTURAL_CONCRETE_PACKAGE,
      role: 'rollup',
      includeByDefault: false,
      locked: false,
      preferredUnit: 'CYD',
      keywords: ['concrete', 'structural concrete'],
      reason: 'Summary rollup requires review before import.',
    });
  } else if (line.quantityType === 'cmu_total_grout') {
    rule = totalGroutClassification(allLines, materialRule('masonry_grout_reinforcement', MASONRY_GROUT_PACKAGE, 'CYD', ['cmu', 'grout']));
  } else if (line.quantityType === 'roof_area' || line.quantityType === 'roof_surface_area') {
    rule = roofAreaClassification(allLines, rule);
  } else if (line.quantityType === 'cmu_lintels') {
    rule = cmuLintelClassification(line, rule);
  } else if (line.quantityType.startsWith('infill_plaster_')) {
    rule = {
      ...rule,
      packageKey: plasterPackageKey(line),
    };
  }

  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    return {
      previewLineId: line.id,
      quantityType: line.quantityType,
      destination: 'excluded',
      packageKind: rule.packageKind,
      packageKey: rule.packageKey,
      role: 'excluded',
      includeByDefault: false,
      locked: true,
      reason: 'Zero quantity.',
      preferredUnit: rule.preferredUnit,
      keywords: rule.keywords,
    };
  }

  return {
    previewLineId: line.id,
    quantityType: line.quantityType,
    destination: rule.destination,
    packageKind: rule.packageKind,
    packageKey: rule.packageKey,
    role: rule.role,
    includeByDefault: rule.includeByDefault ?? true,
    locked: rule.locked ?? false,
    reason: rule.reason ?? null,
    preferredUnit: rule.preferredUnit,
    keywords: rule.keywords,
  };
}
