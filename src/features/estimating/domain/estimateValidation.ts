import type {
  EstimateLineItemInput,
  EstimatePricingInput,
  EstimateSnapshotInput,
  EstimateWarning,
  EstimateWarningCode,
  EstimateQuantityFormula,
} from './estimateTypes';

function createWarning(
  code: EstimateWarningCode,
  message: string,
  options?: { lineItemId?: string; fieldPath?: string },
): EstimateWarning {
  return {
    code,
    message,
    lineItemId: options?.lineItemId,
    fieldPath: options?.fieldPath,
  };
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function isFiniteNonNegative(value: number | undefined): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isFinitePositive(value: number | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

function validatePercentField(
  value: number | undefined,
  fieldPath: string,
  warnings: EstimateWarning[],
  lineItemId?: string,
): void {
  if (value === undefined) return;
  if (!isFiniteNumber(value)) {
    warnings.push(
      createWarning('non_finite_number_normalized', 'Non-finite percent was normalized to 0.', {
        lineItemId,
        fieldPath,
      }),
    );
    return;
  }
  if (value < 0 || value > 100) {
    warnings.push(
      createWarning('invalid_percent_clamped', 'Percent was clamped to the 0-100 range.', {
        lineItemId,
        fieldPath,
      }),
    );
  }
}

function validateCostField(
  value: number | undefined,
  fieldPath: string,
  warnings: EstimateWarning[],
  lineItemId?: string,
): void {
  if (value === undefined) return;
  if (!isFiniteNumber(value)) {
    warnings.push(
      createWarning('non_finite_number_normalized', 'Non-finite cost was normalized to 0.', {
        lineItemId,
        fieldPath,
      }),
    );
    return;
  }
  if (value < 0) {
    warnings.push(
      createWarning('negative_cost_clamped', 'Negative cost was clamped to 0.', {
        lineItemId,
        fieldPath,
      }),
    );
  }
}

function validateQuantityFormulaInputs(
  line: EstimateLineItemInput,
  warnings: EstimateWarning[],
  formula: EstimateQuantityFormula,
): void {
  const quantity = line.quantity;
  const dimensions = quantity.dimensions;
  const lineItemId = line.id;

  switch (formula) {
    case 'area': {
      if (!isFinitePositive(dimensions?.length) || !isFinitePositive(dimensions?.width)) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Area formula requires positive length and width.',
            { lineItemId, fieldPath: 'quantity.dimensions' },
          ),
        );
      }
      break;
    }
    case 'wall_area': {
      if (!isFinitePositive(dimensions?.length) || !isFinitePositive(dimensions?.height)) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Wall area formula requires positive length and height.',
            { lineItemId, fieldPath: 'quantity.dimensions' },
          ),
        );
      }
      break;
    }
    case 'net_wall_area': {
      const hasGrossFromDims =
        isFinitePositive(dimensions?.length) && isFinitePositive(dimensions?.height);
      const hasGrossFromQuantity = isFinitePositive(quantity.quantity);
      if (!hasGrossFromDims && !hasGrossFromQuantity) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Net wall area formula requires gross wall area or dimensions.',
            { lineItemId, fieldPath: 'quantity' },
          ),
        );
      }
      break;
    }
    case 'volume_cubic_feet': {
      if (
        !isFinitePositive(dimensions?.length) ||
        !isFinitePositive(dimensions?.width) ||
        !isFinitePositive(dimensions?.height)
      ) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Volume formula requires positive length, width, and height.',
            { lineItemId, fieldPath: 'quantity.dimensions' },
          ),
        );
      }
      break;
    }
    case 'concrete_cubic_yards': {
      const hasVolumeFromDims =
        isFinitePositive(dimensions?.length) &&
        isFinitePositive(dimensions?.width) &&
        isFinitePositive(dimensions?.height);
      const hasVolumeFromQuantity = isFinitePositive(quantity.quantity);
      if (!hasVolumeFromDims && !hasVolumeFromQuantity) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Concrete cubic yards formula requires cubic feet quantity or dimensions.',
            { lineItemId, fieldPath: 'quantity' },
          ),
        );
      }
      break;
    }
    case 'quantity_with_waste': {
      if (!isFiniteNonNegative(quantity.quantity)) {
        warnings.push(
          createWarning('missing_line_quantity', 'Quantity with waste requires a base quantity.', {
            lineItemId,
            fieldPath: 'quantity.quantity',
          }),
        );
      }
      break;
    }
    case 'material_coverage_units': {
      if (!isFinitePositive(quantity.quantity) || !isFinitePositive(quantity.coveragePerUnit)) {
        warnings.push(
          createWarning(
            'missing_quantity_formula_input',
            'Material coverage formula requires positive quantity and coverage per unit.',
            { lineItemId, fieldPath: 'quantity' },
          ),
        );
      }
      break;
    }
    default:
      break;
  }
}

export function validateEstimateLineItemInput(line: EstimateLineItemInput): EstimateWarning[] {
  const warnings: EstimateWarning[] = [];

  if (!line.description.trim()) {
    warnings.push(
      createWarning('missing_line_description', 'Line description is empty.', {
        lineItemId: line.id,
        fieldPath: 'description',
      }),
    );
  }

  const formula = line.quantity.formula ?? 'quantity_with_waste';
  validateQuantityFormulaInputs(line, warnings, formula);
  validatePercentField(line.quantity.wastePercent, 'quantity.wastePercent', warnings, line.id);

  if (line.labor) {
    if (!isFinitePositive(line.labor.productionRate) || !line.labor.productionRateType) {
      warnings.push(
        createWarning(
          'missing_production_rate',
          'Labor input requires productionRate and productionRateType.',
          { lineItemId: line.id, fieldPath: 'labor.productionRate' },
        ),
      );
    }
    if (!isFinitePositive(line.labor.laborRate)) {
      warnings.push(
        createWarning('missing_labor_rate', 'Labor input requires a positive laborRate.', {
          lineItemId: line.id,
          fieldPath: 'labor.laborRate',
        }),
      );
    }
    validatePercentField(line.labor.burdenPercent, 'labor.burdenPercent', warnings, line.id);
    validateCostField(line.labor.laborRate, 'labor.laborRate', warnings, line.id);
  }

  if (line.material) {
    if (!isFinitePositive(line.material.unitCost)) {
      warnings.push(
        createWarning(
          'missing_material_unit_cost',
          'Material input requires a positive unitCost.',
          { lineItemId: line.id, fieldPath: 'material.unitCost' },
        ),
      );
    }
    validateCostField(line.material.unitCost, 'material.unitCost', warnings, line.id);
  }

  if (line.equipment) {
    if (!isFinitePositive(line.equipment.rate) || !line.equipment.rateType) {
      warnings.push(
        createWarning(
          'missing_equipment_rate',
          'Equipment input requires rate and rateType.',
          { lineItemId: line.id, fieldPath: 'equipment.rate' },
        ),
      );
    }
    validateCostField(line.equipment.rate, 'equipment.rate', warnings, line.id);
  }

  if (line.subcontractor) {
    if (!isFiniteNumber(line.subcontractor.cost)) {
      warnings.push(
        createWarning(
          'missing_subcontractor_cost',
          'Subcontractor input requires a numeric cost.',
          { lineItemId: line.id, fieldPath: 'subcontractor.cost' },
        ),
      );
    }
    validateCostField(line.subcontractor.cost, 'subcontractor.cost', warnings, line.id);
  }

  return warnings;
}

function validatePricingInput(pricing: EstimatePricingInput | undefined): EstimateWarning[] {
  const warnings: EstimateWarning[] = [];

  if (!pricing) return warnings;

  validateCostField(pricing.indirectCost, 'pricing.indirectCost', warnings);
  validatePercentField(pricing.overheadPercent, 'pricing.overheadPercent', warnings);
  validatePercentField(pricing.profitPercent, 'pricing.profitPercent', warnings);
  validatePercentField(pricing.contingencyPercent, 'pricing.contingencyPercent', warnings);
  validatePercentField(pricing.taxPercent, 'pricing.taxPercent', warnings);

  return warnings;
}

export function validateEstimateSnapshotInput(input: EstimateSnapshotInput): EstimateWarning[] {
  const warnings: EstimateWarning[] = [];

  if (input.lineItems.length === 0) {
    warnings.push(
      createWarning(
        'empty_estimate_lines',
        'Estimate has no line items. Snapshot totals will be zero.',
        { fieldPath: 'lineItems' },
      ),
    );
  }

  for (const line of input.lineItems) {
    warnings.push(...validateEstimateLineItemInput(line));
  }

  warnings.push(...validatePricingInput(input.pricing));
  return warnings;
}

