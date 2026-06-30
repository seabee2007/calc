import type { DesignEstimatePreviewLine } from '../types';
import {
  metersToFeet,
  roundQuantity,
  squareMetersToSquareFeet,
} from '../quantity/designQuantityFormulas';
import {
  classifyDesignQuantityForScope,
  hasComponentConcreteRows,
} from './designBuilderImportRules';
import type {
  DesignActivityDraft,
  DesignActivityDraftStatus,
  DesignActivityOperation,
  DesignQuantityUsage,
  DesignQuantityUsageDestination,
  DesignQuantityUsageReviewStatus,
  DesignQuantityUsageRole,
} from './designScopeTypes';

type ConcreteComponentConfig = {
  quantityType: string;
  slug: string;
  componentName: string;
  category: string;
  beamFormwork?: {
    includeSoffit: boolean;
    geometryKind: string;
  };
};

const CONCRETE_VOLUME_COMPONENTS: Record<string, ConcreteComponentConfig> = {
  isolated_footings_volume: {
    quantityType: 'isolated_footings_volume',
    slug: 'isolated-footings',
    componentName: 'Isolated Footings',
    category: 'Isolated Footings',
  },
  rc_columns_volume: {
    quantityType: 'rc_columns_volume',
    slug: 'rc-columns',
    componentName: 'RC Columns',
    category: 'RC Columns',
  },
  rc_plinth_beams_volume: {
    quantityType: 'rc_plinth_beams_volume',
    slug: 'rc-plinth-beams',
    componentName: 'RC Plinth Beams',
    category: 'RC Plinth Beams',
    beamFormwork: { includeSoffit: false, geometryKind: 'plinth_beam' },
  },
  rc_tie_beams_volume: {
    quantityType: 'rc_tie_beams_volume',
    slug: 'rc-tie-beams',
    componentName: 'RC Tie Beams',
    category: 'RC Tie Beams',
    beamFormwork: { includeSoffit: true, geometryKind: 'tie_beam' },
  },
  rc_roof_beams_volume: {
    quantityType: 'rc_roof_beams_volume',
    slug: 'rc-roof-beams',
    componentName: 'RC Roof Beams',
    category: 'RC Roof Beams',
    beamFormwork: { includeSoffit: true, geometryKind: 'roof_beam' },
  },
  interior_floor_slab_volume: {
    quantityType: 'interior_floor_slab_volume',
    slug: 'interior-floor-slab',
    componentName: 'Interior Floor Slab',
    category: 'Interior Floor Slab',
  },
  raked_concrete_cap_volume: {
    quantityType: 'raked_concrete_cap_volume',
    slug: 'raked-concrete-cap',
    componentName: 'Raked Concrete Cap',
    category: 'Raked Concrete Cap',
  },
};

const CONCRETE_VOLUME_TYPES = new Set(Object.keys(CONCRETE_VOLUME_COMPONENTS));

export function buildDesignQuantityUsages(input: {
  previewLines: readonly DesignEstimatePreviewLine[];
}): DesignQuantityUsage[] {
  const componentConcreteExists = hasComponentConcreteRows(input.previewLines);
  const usages: DesignQuantityUsage[] = [];

  for (const line of input.previewLines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      usages.push(excludedUsage(line, 'Zero quantity.'));
      continue;
    }

    if (line.quantityType === 'rc_structural_concrete_volume' && componentConcreteExists) {
      usages.push(rollupUsage(line, 'Summary rollup excluded because component concrete quantities are present.'));
      continue;
    }

    if (CONCRETE_VOLUME_TYPES.has(line.quantityType)) {
      usages.push(...concreteVolumeUsages(line));
      continue;
    }

    if (line.quantityType === 'raked_concrete_cap_linear_length') {
      usages.push(...rakedCapFormworkUsages(line));
      continue;
    }

    usages.push(...compatibilityUsages(line, input.previewLines));
  }

  return usages;
}

export function groupDesignUsagesIntoActivities(
  usages: readonly DesignQuantityUsage[],
): DesignActivityDraft[] {
  const grouped = new Map<string, DesignQuantityUsage[]>();
  for (const usage of usages) {
    if (!usage.activityKey || !usage.activityTitle) continue;
    const existing = grouped.get(usage.activityKey);
    if (existing) existing.push(usage);
    else grouped.set(usage.activityKey, [usage]);
  }

  return [...grouped.entries()]
    .map(([activityKey, activityUsages]) => buildActivityDraft(activityKey, activityUsages))
    .sort((left, right) => left.divisionCode.localeCompare(right.divisionCode) || left.title.localeCompare(right.title));
}

function concreteVolumeUsages(line: DesignEstimatePreviewLine): DesignQuantityUsage[] {
  const config = CONCRETE_VOLUME_COMPONENTS[line.quantityType];
  if (!config) return compatibilityUsages(line, [line]);

  const usages = [
    concretePlaceLaborUsage(line, config),
    concreteMaterialUsage(line, config),
  ];

  if (line.quantityType === 'isolated_footings_volume') {
    usages.push(footingFormworkUsage(line, config));
  } else if (line.quantityType === 'rc_columns_volume') {
    usages.push(columnFormworkUsage(line, config));
  } else if (config.beamFormwork) {
    usages.push(beamFormworkUsage(line, config, config.beamFormwork.includeSoffit));
  } else if (line.quantityType === 'interior_floor_slab_volume') {
    usages.push(slabEdgeFormUsage(line, config));
  }

  return usages;
}

function concretePlaceLaborUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  return baseUsage({
    id: `usage:${line.id}:place-concrete-labor`,
    line,
    destination: 'activity_line_item',
    role: 'place_concrete_labor',
    activityKey: concreteActivityKey(config.slug, 'place'),
    activityTitle: concreteActivityTitle(config.componentName, 'Place Concrete'),
    description: `Place concrete, ${config.componentName}`,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    reviewStatus: 'needs_rate',
    metadata: {
      componentName: config.componentName,
      sourceUnitSystem: 'model_preview',
      operation: 'place_concrete',
    },
  });
}

function concreteMaterialUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  return baseUsage({
    id: `usage:${line.id}:ready-mix-material`,
    line,
    destination: 'material_resource',
    role: 'concrete_material',
    activityKey: concreteActivityKey(config.slug, 'place'),
    activityTitle: concreteActivityTitle(config.componentName, 'Place Concrete'),
    description: `Ready-mix concrete, ${config.componentName}`,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    reviewStatus: 'material_only',
    unitCost: 0,
    totalCost: 0,
    metadata: {
      componentName: config.componentName,
      sourceUnitSystem: 'model_preview',
      operation: 'concrete_material',
    },
  });
}

function footingFormworkUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  const footings = arrayParam<Record<string, unknown>>(line, 'footings');
  if (!footings.length) {
    return missingGeometryUsage({
      line,
      config,
      idSuffix: 'formwork',
      activityOperation: 'formwork',
      description: `Footing formwork, ${config.componentName}`,
      unit: 'SF',
      reviewReason: 'Footing formwork requires footing geometry in the quantity snapshot.',
      formula: 'sum(2 * (width + length) * thickness)',
      geometryKinds: ['isolated_footing'],
    });
  }

  let areaM2 = 0;
  for (const footing of footings) {
    const width = numberParam(footing.widthMeters);
    const length = numberParam(footing.lengthMeters);
    const thickness = numberParam(footing.thicknessMeters);
    areaM2 += 2 * (width + length) * thickness;
  }
  const areaSf = roundQuantity(squareMetersToSquareFeet(areaM2), 2);
  return derivedFormworkUsage({
    line,
    config,
    idSuffix: 'formwork',
    description: `Footing formwork, ${config.componentName}`,
    quantity: areaSf,
    unit: 'SF',
    formula: 'sum(2 * (width + length) * thickness)',
    geometryKinds: ['isolated_footing'],
    metadata: {
      sourceUnitSystem: 'metric',
      formedSides: 'all_sides',
      derivedAreaSquareMeters: roundQuantity(areaM2, 4),
      derivedAreaSquareFeet: areaSf,
      footingCount: footings.length,
    },
  });
}

function columnFormworkUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  const columns = arrayParam<Record<string, unknown>>(line, 'columns');
  if (!columns.length) {
    return missingGeometryUsage({
      line,
      config,
      idSuffix: 'formwork',
      activityOperation: 'formwork',
      description: `Column formwork, ${config.componentName}`,
      unit: 'SF',
      reviewReason: 'Column formwork requires column geometry in the quantity snapshot.',
      formula: 'sum(2 * (width + depth) * height)',
      geometryKinds: ['rc_column'],
    });
  }

  let areaM2 = 0;
  for (const column of columns) {
    const width = numberParam(column.widthMeters);
    const depth = numberParam(column.depthMeters);
    const height = numberParam(column.heightMeters);
    areaM2 += 2 * (width + depth) * height;
  }
  const areaSf = roundQuantity(squareMetersToSquareFeet(areaM2), 2);
  return derivedFormworkUsage({
    line,
    config,
    idSuffix: 'formwork',
    description: `Column formwork, ${config.componentName}`,
    quantity: areaSf,
    unit: 'SF',
    formula: 'sum(2 * (width + depth) * height)',
    geometryKinds: ['rc_column'],
    reviewReason: 'Column formwork area is derived from gross column faces; verify beam/footing intersections.',
    metadata: {
      sourceUnitSystem: 'metric',
      derivedAreaSquareMeters: roundQuantity(areaM2, 4),
      derivedAreaSquareFeet: areaSf,
      columnCount: columns.length,
    },
  });
}

function beamFormworkUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
  includeSoffit: boolean,
): DesignQuantityUsage {
  const beams = arrayParam<Record<string, unknown>>(line, 'beams');
  if (!beams.length) {
    return missingGeometryUsage({
      line,
      config,
      idSuffix: 'formwork',
      activityOperation: 'formwork',
      description: `Beam formwork, ${config.componentName}`,
      unit: 'SF',
      reviewReason: 'Beam formwork requires beam geometry in the quantity snapshot.',
      formula: 'sum(2 * depth * span + soffit_width * span)',
      geometryKinds: ['structural_beam'],
    });
  }

  let sideAreaM2 = 0;
  let soffitAreaM2 = 0;
  let spanMeters = 0;
  for (const beam of beams) {
    const span = distance3d(pointParam(beam.startPoint), pointParam(beam.endPoint));
    const width = numberParam(beam.widthMeters);
    const depth = numberParam(beam.depthMeters);
    spanMeters += span;
    sideAreaM2 += 2 * depth * span;
    if (includeSoffit) soffitAreaM2 += width * span;
  }
  const areaM2 = sideAreaM2 + soffitAreaM2;
  const areaSf = roundQuantity(squareMetersToSquareFeet(areaM2), 2);
  return derivedFormworkUsage({
    line,
    config,
    idSuffix: 'formwork',
    description: `Beam formwork, ${config.componentName}`,
    quantity: areaSf,
    unit: 'SF',
    formula: 'sum(2 * depth * span + soffit_width * span)',
    geometryKinds: ['structural_beam'],
    metadata: {
      sourceUnitSystem: 'metric',
      includeSoffit,
      sideAreaSquareMeters: roundQuantity(sideAreaM2, 4),
      soffitAreaSquareMeters: roundQuantity(soffitAreaM2, 4),
      derivedAreaSquareMeters: roundQuantity(areaM2, 4),
      derivedAreaSquareFeet: areaSf,
      totalSpanMeters: roundQuantity(spanMeters, 4),
      beamCount: beams.length,
    },
  });
}

function slabEdgeFormUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  const slab = objectParam(line.parameterSnapshot.interiorFloorSlab);
  const perimeterMeters = numberParam(
    line.parameterSnapshot.interiorFloorSlabPerimeterMeters ??
      slab?.edgePerimeterMeters ??
      slab?.perimeterMeters,
  );
  const thicknessMeters = numberParam(slab?.thicknessMeters);

  if (perimeterMeters <= 0) {
    return missingGeometryUsage({
      line,
      config,
      idSuffix: 'edge-forms',
      activityOperation: 'formwork',
      description: `Slab edge forms, ${config.componentName}`,
      unit: 'LF',
      reviewReason: 'Slab edge formwork requires footprint perimeter.',
      formula: 'interior_slab_perimeter',
      geometryKinds: ['interior_floor_slab'],
    });
  }

  const lengthLf = roundQuantity(metersToFeet(perimeterMeters), 2);
  return derivedFormworkUsage({
    line,
    config,
    idSuffix: 'edge-forms',
    description: `Slab edge forms, ${config.componentName}`,
    quantity: lengthLf,
    unit: 'LF',
    formula: 'interior_slab_perimeter',
    geometryKinds: ['interior_floor_slab'],
    activityLabel: 'Edge Forms',
    metadata: {
      sourceUnitSystem: 'metric',
      derivedLengthMeters: roundQuantity(perimeterMeters, 4),
      derivedLengthFeet: lengthLf,
      slabThicknessMeters: thicknessMeters,
      derivedEdgeAreaSquareMeters: roundQuantity(perimeterMeters * thicknessMeters, 4),
      derivedEdgeAreaSquareFeet: roundQuantity(squareMetersToSquareFeet(perimeterMeters * thicknessMeters), 2),
    },
  });
}

function rakedCapFormworkUsages(line: DesignEstimatePreviewLine): DesignQuantityUsage[] {
  const config = CONCRETE_VOLUME_COMPONENTS.raked_concrete_cap_volume;
  return [rakedCapLinearFormworkUsage(line, config)];
}

function rakedCapLinearFormworkUsage(
  line: DesignEstimatePreviewLine,
  config: ConcreteComponentConfig,
): DesignQuantityUsage {
  const lengthMeters = numberParam(line.parameterSnapshot.rakedCapLinearLengthMeters);
  const lengthFeet = numberParam(line.parameterSnapshot.rakedCapLinearLengthFeet) || line.quantity;
  const segmentIds = Array.isArray(line.parameterSnapshot.gableEndSegmentIds)
    ? line.parameterSnapshot.gableEndSegmentIds
    : [];
  return baseUsage({
    id: `usage:${line.id}:formwork`,
    line,
    destination: 'activity_line_item',
    role: 'formwork_labor',
    activityKey: concreteActivityKey(config.slug, 'formwork'),
    activityTitle: concreteActivityTitle(config.componentName, 'Formwork'),
    description: `Raked cap formwork, ${config.componentName}`,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    derived: true,
    reviewStatus: 'needs_rate',
    derivationSource: {
      previewLineIds: [line.id],
      modelObjectIds: [line.designObjectId],
      geometryKinds: ['raked_concrete_cap'],
    },
    metadata: {
      sourceUnitSystem: 'metric',
      derivedLengthMeters: roundQuantity(lengthMeters, 4),
      derivedLengthFeet: roundQuantity(lengthFeet, 2),
      geometryCount: segmentIds.length,
      displayQuantity: line.quantity,
      displayUnit: line.unit,
      formula: line.formula,
    },
  });
}

function compatibilityUsages(
  line: DesignEstimatePreviewLine,
  allLines: readonly DesignEstimatePreviewLine[],
): DesignQuantityUsage[] {
  const classification = classifyDesignQuantityForScope(line, allLines);
  const mapped = mapLegacyDestination(classification.destination);
  const title = compatibilityActivityTitle(classification.packageKey, line);
  const enabled = classification.includeByDefault && mapped !== 'excluded' && mapped !== 'rollup';
  const isLabor = mapped === 'activity_line_item';
  const isMaterial = mapped === 'material_resource' || mapped === 'equipment_resource';
  const reviewStatus: DesignQuantityUsageReviewStatus =
    !enabled || mapped === 'excluded'
      ? 'excluded'
      : mapped === 'reference_only' || mapped === 'rollup'
        ? 'reference_only'
        : isMaterial
          ? 'material_only'
          : isLabor
            ? 'needs_rate'
            : 'needs_review';

  return [
    baseUsage({
      id: `usage:${line.id}:${mapped}`,
      line,
      destination: mapped,
      role: legacyRoleForDestination(mapped),
      activityKey: mapped === 'reference_only' || mapped === 'rollup' || mapped === 'excluded'
        ? null
        : classification.packageKey,
      activityTitle: mapped === 'reference_only' || mapped === 'rollup' || mapped === 'excluded'
        ? null
        : title,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      formula: line.formula,
      enabled,
      locked: classification.locked,
      reviewStatus,
      reviewReason: classification.reason,
      metadata: {
        packageKey: classification.packageKey,
        packageKind: classification.packageKind,
        preferredUnit: classification.preferredUnit,
        legacyRole: classification.role,
        keywords: classification.keywords,
      },
    }),
  ];
}

function derivedFormworkUsage(params: {
  line: DesignEstimatePreviewLine;
  config: ConcreteComponentConfig;
  idSuffix: string;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  geometryKinds: string[];
  metadata: Record<string, unknown>;
  reviewReason?: string;
  activityLabel?: string;
}): DesignQuantityUsage {
  const activityLabel = params.activityLabel ?? 'Formwork';
  return baseUsage({
    id: `usage:${params.line.id}:${params.idSuffix}`,
    line: params.line,
    destination: 'activity_line_item',
    role: 'formwork_labor',
    activityKey: concreteActivityKey(params.config.slug, params.idSuffix === 'edge-forms' ? 'edge-forms' : 'formwork'),
    activityTitle: concreteActivityTitle(params.config.componentName, activityLabel),
    description: params.description,
    quantity: params.quantity,
    unit: params.unit,
    formula: params.formula,
    derived: true,
    reviewStatus: 'needs_rate',
    reviewReason: params.reviewReason ?? null,
    derivationSource: {
      previewLineIds: [params.line.id],
      modelObjectIds: [params.line.designObjectId],
      geometryKinds: params.geometryKinds,
    },
    metadata: params.metadata,
  });
}

function missingGeometryUsage(params: {
  line: DesignEstimatePreviewLine;
  config: ConcreteComponentConfig;
  idSuffix: string;
  activityOperation: DesignActivityOperation;
  description: string;
  unit: string;
  reviewReason: string;
  formula: string;
  geometryKinds: string[];
}): DesignQuantityUsage {
  return baseUsage({
    id: `usage:${params.line.id}:${params.idSuffix}:review`,
    line: params.line,
    destination: 'activity_line_item',
    role: 'formwork_labor',
    activityKey: concreteActivityKey(params.config.slug, params.idSuffix === 'edge-forms' ? 'edge-forms' : params.activityOperation),
    activityTitle: concreteActivityTitle(
      params.config.componentName,
      params.idSuffix === 'edge-forms' ? 'Edge Forms' : 'Formwork',
    ),
    description: params.description,
    quantity: 0,
    unit: params.unit,
    formula: params.formula,
    derived: true,
    enabled: false,
    locked: false,
    reviewStatus: 'needs_review',
    reviewReason: params.reviewReason,
    derivationSource: {
      previewLineIds: [params.line.id],
      modelObjectIds: [params.line.designObjectId],
      geometryKinds: params.geometryKinds,
    },
    metadata: {
      sourceUnitSystem: 'metric',
      missingGeometry: true,
    },
  });
}

function rollupUsage(line: DesignEstimatePreviewLine, reason: string): DesignQuantityUsage {
  return baseUsage({
    id: `usage:${line.id}:rollup`,
    line,
    destination: 'rollup',
    role: 'rollup',
    activityKey: null,
    activityTitle: null,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    enabled: false,
    locked: true,
    reviewStatus: 'reference_only',
    reviewReason: reason,
    metadata: {
      rollup: true,
    },
  });
}

function excludedUsage(line: DesignEstimatePreviewLine, reason: string): DesignQuantityUsage {
  return baseUsage({
    id: `usage:${line.id}:excluded`,
    line,
    destination: 'excluded',
    role: 'excluded',
    activityKey: null,
    activityTitle: null,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    formula: line.formula,
    enabled: false,
    locked: true,
    reviewStatus: 'excluded',
    reviewReason: reason,
    metadata: {},
  });
}

function baseUsage(params: {
  id: string;
  line: DesignEstimatePreviewLine;
  destination: DesignQuantityUsageDestination;
  role: DesignQuantityUsageRole;
  activityKey: string | null;
  activityTitle: string | null;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  derived?: boolean;
  enabled?: boolean;
  locked?: boolean;
  reviewStatus: DesignQuantityUsageReviewStatus;
  reviewReason?: string | null;
  unitCost?: number;
  totalCost?: number;
  derivationSource?: DesignQuantityUsage['derivationSource'];
  metadata: Record<string, unknown>;
}): DesignQuantityUsage {
  return {
    id: params.id,
    sourcePreviewLineId: params.line.id,
    sourceQuantityType: params.line.quantityType,
    sourceLine: params.line,
    enabled: params.enabled ?? true,
    locked: params.locked ?? false,
    destination: params.destination,
    role: params.role,
    activityKey: params.activityKey,
    activityTitle: params.activityTitle,
    description: params.description,
    quantity: params.quantity,
    unit: params.unit,
    formula: params.formula,
    derived: params.derived ?? false,
    reviewStatus: params.reviewStatus,
    reviewReason: params.reviewReason ?? null,
    productionRateId: null,
    candidates: [],
    matchConfidence: null,
    matchReason: null,
    manualOverride: null,
    unitCost: params.unitCost,
    totalCost: params.totalCost,
    derivationSource: params.derivationSource,
    metadata: {
      sourceDescription: params.line.description,
      designObjectId: params.line.designObjectId,
      divisionCode: params.line.divisionCode,
      divisionName: params.line.divisionName,
      ...params.metadata,
    },
  };
}

function buildActivityDraft(activityKey: string, usages: DesignQuantityUsage[]): DesignActivityDraft {
  const first = usages[0]!;
  const enabledUsages = usages.filter((usage) => usage.enabled);
  const laborUsages = enabledUsages.filter((usage) => usage.destination === 'activity_line_item');
  const materialUsages = enabledUsages.filter(
    (usage) => usage.destination === 'material_resource' || usage.destination === 'equipment_resource',
  );
  const warnings = [
    ...new Set(
      usages
        .map((usage) => usage.reviewReason)
        .filter((reason): reason is string => Boolean(reason?.trim())),
    ),
  ];

  return {
    key: activityKey,
    title: first.activityTitle ?? activityKey,
    divisionCode: stringMeta(first, 'divisionCode') || '00',
    divisionName: stringMeta(first, 'divisionName') || 'Unassigned',
    category: stringMeta(first, 'componentName') || first.activityTitle || activityKey,
    scheduleEnabled: laborUsages.length > 0,
    sourceObjectIds: unique(usages.map((usage) => stringMeta(usage, 'designObjectId')).filter(Boolean)),
    sourcePreviewLineIds: unique(usages.map((usage) => usage.sourcePreviewLineId).filter(Boolean)),
    operation: operationForActivityKey(activityKey),
    defaultSequenceGroup: activityKey,
    usages,
    warnings,
    status: activityStatus(usages, laborUsages, materialUsages),
  };
}

function activityStatus(
  usages: readonly DesignQuantityUsage[],
  laborUsages: readonly DesignQuantityUsage[],
  materialUsages: readonly DesignQuantityUsage[],
): DesignActivityDraftStatus {
  const enabledUsages = usages.filter((usage) => usage.enabled);
  if (enabledUsages.length === 0) return usages.some((usage) => usage.reviewStatus === 'needs_review') ? 'needs_review' : 'excluded';
  if (enabledUsages.some((usage) => usage.reviewStatus === 'needs_review')) return 'needs_review';
  if (laborUsages.some((usage) => usage.reviewStatus === 'needs_rate')) return 'needs_rate';
  if (laborUsages.length > 0) return 'ready';
  if (materialUsages.length > 0) return 'material_only';
  return 'reference_only';
}

function operationForActivityKey(activityKey: string): DesignActivityOperation {
  if (activityKey.endsWith(':place')) return 'place_concrete';
  if (activityKey.endsWith(':formwork') || activityKey.endsWith(':edge-forms')) return 'formwork';
  if (activityKey.includes('reinforcement')) return 'reinforcement';
  if (activityKey.includes('reference')) return 'reference';
  return 'install';
}

function concreteActivityKey(componentSlug: string, operation: string): string {
  return `concrete:${componentSlug}:${operation}`;
}

function concreteActivityTitle(componentName: string, operation: string): string {
  return `03 Concrete - ${componentName} - ${operation}`;
}

function compatibilityActivityTitle(packageKey: string, line: DesignEstimatePreviewLine): string {
  if (packageKey === '04-masonry-cmu-wall-system') return '04 Masonry - CMU Wall System';
  if (packageKey === '04-masonry-grout-reinforcement-support') return '04 Masonry - Bond Beam / Grout / Reinforcement Support';
  if (packageKey === '05-metals-roof-framing') return '05 Metals - Steel Roof Framing';
  if (packageKey === '07-roofing-cladding-trim-soffit') return '07 Roofing - Corrugated Roof Panels / Trim / Soffit';
  if (packageKey === '08-openings-doors-windows') return '08 Openings - Door and Window Units';
  if (packageKey.startsWith('09-finishes-plaster')) return '09 Finishes - Plaster';
  return `${line.divisionCode || '00'} ${line.divisionName || 'Unassigned'} - ${line.description}`;
}

function mapLegacyDestination(destination: string): DesignQuantityUsageDestination {
  if (destination === 'activity_line_item') return 'activity_line_item';
  if (destination === 'material_resource') return 'material_resource';
  if (destination === 'equipment_resource') return 'equipment_resource';
  if (destination === 'rollup') return 'rollup';
  if (destination === 'excluded' || destination === 'placeholder') return 'excluded';
  return 'reference_only';
}

function legacyRoleForDestination(destination: DesignQuantityUsageDestination): DesignQuantityUsageRole {
  if (destination === 'activity_line_item') return 'primary_labor_driver';
  if (destination === 'material_resource') return 'material_takeoff';
  if (destination === 'equipment_resource') return 'equipment_takeoff';
  if (destination === 'rollup') return 'rollup';
  if (destination === 'excluded') return 'excluded';
  return 'reference';
}

function arrayParam<T>(line: DesignEstimatePreviewLine, key: string): T[] {
  const value = line.parameterSnapshot[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function objectParam(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numberParam(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pointParam(value: unknown): { x: number; y: number; z: number } {
  const point = objectParam(value);
  return {
    x: numberParam(point?.x),
    y: numberParam(point?.y),
    z: numberParam(point?.z),
  };
}

function distance3d(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): number {
  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function stringMeta(usage: DesignQuantityUsage, key: string): string {
  const value = usage.metadata[key];
  return typeof value === 'string' ? value : '';
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
