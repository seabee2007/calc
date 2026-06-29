import type { DesignEstimatePreviewLine } from '../types';

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
