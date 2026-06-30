import {
  matchQuantityToProductionRates,
} from '../../estimating/application/matchQuantityToProductionRates';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import { classifyDesignQuantityForScope } from './designBuilderImportRules';
import type {
  DesignQuantityClassification,
  DesignScopePackage,
  DesignScopePackageKind,
  DesignScopePackageQuantity,
  DesignScopePackageStatus,
} from './designScopeTypes';

export function buildDesignScopePackages(input: {
  previewLines: readonly DesignEstimatePreviewLine[];
  persistedQuantityItems: readonly DesignQuantityItem[];
  productionRates: readonly ProductionRateLibraryEntry[];
}): DesignScopePackage[] {
  const persistedByPreviewId = new Map(
    input.persistedQuantityItems.map((item) => [
      String(item.metadata.previewLineId ?? item.quantityType),
      item,
    ]),
  );

  const quantities = input.previewLines.map((line) => {
    const classification = classifyDesignQuantityForScope(line, input.previewLines);
    const persistedQuantityItem =
      persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType);

    return buildPackageQuantity({
      line,
      persistedQuantityItem,
      classification,
      productionRates: input.productionRates,
    });
  });

  const grouped = new Map<string, DesignScopePackageQuantity[]>();
  for (const quantity of quantities) {
    const existing = grouped.get(quantity.classification.packageKey);
    if (existing) {
      existing.push(quantity);
    } else {
      grouped.set(quantity.classification.packageKey, [quantity]);
    }
  }

  return [...grouped.entries()]
    .map(([key, packageQuantities]) => buildPackage(key, packageQuantities))
    .sort((left, right) => left.divisionCode.localeCompare(right.divisionCode) || left.title.localeCompare(right.title));
}

function buildPackageQuantity(params: {
  line: DesignEstimatePreviewLine;
  persistedQuantityItem?: DesignQuantityItem;
  classification: DesignQuantityClassification;
  productionRates: readonly ProductionRateLibraryEntry[];
}): DesignScopePackageQuantity {
  const { line, classification } = params;

  if (
    classification.destination !== 'activity_line_item' ||
    !classification.includeByDefault
  ) {
    return {
      line,
      persistedQuantityItem: params.persistedQuantityItem,
      classification,
      candidates: [],
      selectedProductionRateId: null,
      assignmentStatus:
        classification.destination === 'excluded' ||
        classification.destination === 'placeholder' ||
        classification.destination === 'rollup'
          ? 'excluded'
          : 'not_required',
      manualOverride: null,
    };
  }

  const match = matchQuantityToProductionRates(
    {
      divisionCode: line.divisionCode,
      divisionName: line.divisionName,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      quantityType: line.quantityType,
      formula: line.formula,
      parameterSnapshot: line.parameterSnapshot,
      keywords: classification.keywords,
    },
    params.productionRates,
  );

  if (match.status === 'auto_matched') {
    return {
      line,
      persistedQuantityItem: params.persistedQuantityItem,
      classification,
      candidates: match.candidates,
      selectedProductionRateId: match.productionRateId,
      assignmentStatus: 'auto_matched',
      manualOverride: null,
    };
  }

  return {
    line,
    persistedQuantityItem: params.persistedQuantityItem,
    classification: {
      ...classification,
      reason:
        classification.reason ??
        (match.status === 'review_required' ? match.issue : match.reason),
    },
    candidates: match.status === 'review_required' ? match.candidates : [],
    selectedProductionRateId: null,
    assignmentStatus: match.status === 'excluded' ? 'excluded' : 'review_required',
    manualOverride: null,
  };
}

function buildPackage(
  key: string,
  quantities: DesignScopePackageQuantity[],
): DesignScopePackage {
  const first = quantities[0]!;
  const meta = packageMeta(first.classification.packageKind, key, first.line);
  const warnings = packageWarnings(quantities);
  const sourceObjectIds = [
    ...new Set(quantities.map((quantity) => quantity.line.designObjectId)),
  ];

  return {
    key,
    kind: first.classification.packageKind,
    title: meta.title,
    divisionCode: meta.divisionCode,
    divisionName: meta.divisionName,
    category: meta.category,
    scheduleEnabled: quantities.some(
      (quantity) =>
        quantity.classification.destination === 'activity_line_item' &&
        quantity.classification.includeByDefault,
    ),
    sourceObjectIds,
    locationLabel: meta.locationLabel,
    quantities,
    warnings,
    status: packageStatus(quantities),
  };
}

function packageStatus(
  quantities: readonly DesignScopePackageQuantity[],
): DesignScopePackageStatus {
  const includedActivityRows = quantities.filter(
    (quantity) =>
      quantity.classification.destination === 'activity_line_item' &&
      quantity.classification.includeByDefault,
  );

  if (includedActivityRows.length === 0) return 'excluded';

  return includedActivityRows.every(
    (quantity) =>
      quantity.assignmentStatus === 'auto_matched' ||
      quantity.assignmentStatus === 'verified_rate' ||
      quantity.assignmentStatus === 'manual_override',
  )
    ? 'ready'
    : 'review_required';
}

function packageWarnings(
  quantities: readonly DesignScopePackageQuantity[],
): string[] {
  const warnings = new Set<string>();

  for (const quantity of quantities) {
    const reason = quantity.classification.reason;
    if (reason) warnings.add(`${quantity.line.description}: ${reason}`);
    if (quantity.assignmentStatus === 'review_required') {
      warnings.add(`${quantity.line.description}: production-rate assignment required.`);
    }
  }

  return [...warnings];
}

function packageMeta(
  kind: DesignScopePackageKind,
  key: string,
  line: DesignEstimatePreviewLine,
): {
  title: string;
  divisionCode: string;
  divisionName: string;
  category: string;
  locationLabel: string | null;
} {
  switch (kind) {
    case 'concrete_structural':
      return meta('03', 'Concrete', '03 Concrete - Structural Concrete Components', 'Structural Concrete Components', 'Building / Structural Frame');
    case 'concrete_raked_cap':
      return meta('03', 'Concrete', '03 Concrete - Raked Concrete Cap', 'Raked Concrete Cap', 'Gable End System');
    case 'masonry_cmu_wall':
      return meta('04', 'Masonry', '04 Masonry - CMU Wall System', 'CMU Wall System', 'CMU Infill Panels');
    case 'masonry_grout_reinforcement':
      return meta('04', 'Masonry', '04 Masonry - Bond Beam / Grout / Reinforcement Support', 'Bond Beam / Grout / Reinforcement Support', 'CMU Infill Panels');
    case 'metals_roof_framing':
      return meta('05', 'Metals', '05 Metals - Steel Roof Framing', 'Steel Roof Framing', 'Roof System');
    case 'roofing_cladding_trim':
      return meta('07', 'Thermal & Moisture Protection', '07 Roofing - Corrugated Roof Panels / Trim / Soffit', 'Corrugated Roof Panels / Trim / Soffit', 'Roof System');
    case 'openings_doors_windows':
      return meta('08', 'Openings', '08 Openings - Door and Window Units', 'Door and Window Units', 'Wall Openings');
    case 'finishes_plaster': {
      const side = stringParam(line, 'plasterSide');
      const label = side ? `${capitalize(side)} Plaster` : 'Plaster';
      return meta('09', 'Finishes', `09 Finishes - ${label}`, label, side ? `${capitalize(side)} Wall Faces` : 'Wall Faces');
    }
    default:
      return meta(
        line.divisionCode || '00',
        line.divisionName || 'Reference',
        key.startsWith('00-reference-review')
          ? 'Reference / Review Quantities'
          : `${line.divisionCode || '00'} ${line.divisionName || 'Reference'} - Reference Quantities`,
        'Reference Quantities',
        null,
      );
  }
}

function meta(
  divisionCode: string,
  divisionName: string,
  title: string,
  category: string,
  locationLabel: string | null,
) {
  return { divisionCode, divisionName, title, category, locationLabel };
}

function stringParam(line: DesignEstimatePreviewLine, key: string): string | null {
  const value = line.parameterSnapshot[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}`;
}
