import { describe, expect, it } from 'vitest';
import {
  calculateQuickFeasibilityEstimate,
  createQuickFeasibilityInputsForLocation,
  DEFAULT_QUICK_FEASIBILITY_INPUTS,
  getDefaultLocationCodeFromProject,
  getSquareFootPricingImportantLimitations,
  getSquareFootPricingLocationByCode,
  QUICK_FEASIBILITY_PREVIEW_HINT,
  resolveQuickFeasibilityBaseRate,
  SQUARE_FOOT_PRICING_NATIONAL_BASELINE,
  validateQuickFeasibilityInputs,
} from '../application/estimateQuickFeasibility';
import { squareFootPricingData } from '../data/squareFootPricingData';

function expectAllFinite(result: ReturnType<typeof calculateQuickFeasibilityEstimate>): void {
  expect(Number.isFinite(result.baseCost)).toBe(true);
  expect(Number.isFinite(result.adjustedCost)).toBe(true);
  expect(Number.isFinite(result.likelyTotal)).toBe(true);
  expect(Number.isFinite(result.lowTotal)).toBe(true);
  expect(Number.isFinite(result.highTotal)).toBe(true);
  expect(Number.isFinite(result.adjustedCostPerSF)).toBe(true);
}

function guamInputs() {
  return createQuickFeasibilityInputsForLocation('GU', {
    areaSF: 2_000,
    projectType: 'newConstruction',
    finishLevel: 'standard',
    complexityLevel: 'average',
    siteCondition: 'easyFlatAccess',
    mepIntensity: 'none',
    contingencyPercent: 0,
    locationAdjustmentFactor: 1,
  });
}

describe('estimateQuickFeasibility dataset pricing', () => {
  it('Guam location returns suggested base rate 294', () => {
    const location = getSquareFootPricingLocationByCode('GU');
    expect(location?.newConstruction.suggestedMidWithContractorOHProfit).toBe(294);
    expect(resolveQuickFeasibilityBaseRate(createQuickFeasibilityInputsForLocation('GU'))).toBe(294);
  });

  it('Guam location has planning range 195-350', () => {
    const location = getSquareFootPricingLocationByCode('GU');
    expect(location?.newConstruction.planningLow).toBe(195);
    expect(location?.newConstruction.planningHigh).toBe(350);
  });

  it('state lookup works for GA, CA, HI, AK', () => {
    expect(getSquareFootPricingLocationByCode('GA')?.name).toBe('Georgia');
    expect(getSquareFootPricingLocationByCode('CA')?.name).toBe('California');
    expect(getSquareFootPricingLocationByCode('HI')?.name).toBe('Hawaii');
    expect(getSquareFootPricingLocationByCode('AK')?.name).toBe('Alaska');
  });

  it('unknown location falls back to national baseline 195', () => {
    expect(resolveQuickFeasibilityBaseRate({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      locationCode: 'ZZ',
      basePricePerSf: 0,
      basePricePerSfOverridden: false,
    })).toBe(SQUARE_FOOT_PRICING_NATIONAL_BASELINE);
  });

  it('does not multiply selected location rate by locationFactorVsNational195', () => {
    const result = calculateQuickFeasibilityEstimate(guamInputs());
    expect(result.baseCost).toBe(588_000);
    expect(result.locationFactorVsNational195).toBe(1.508);
    expect(result.adjustedCost).toBe(588_000);
  });

  it('computes 2,000 SF x Guam $294/SF = $588,000 base cost before other multipliers', () => {
    const result = calculateQuickFeasibilityEstimate(guamInputs());
    expect(result.baseCost).toBe(588_000);
    expect(result.resolvedBasePricePerSf).toBe(294);
  });

  it('premium finish applies finish multiplier', () => {
    const baseline = calculateQuickFeasibilityEstimate(guamInputs());
    const premium = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      finishLevel: 'premium',
    });

    expect(premium.multipliers.finish).toBe(squareFootPricingData.finishMultipliers.premium);
    expect(premium.adjustedCost).toBeGreaterThan(baseline.adjustedCost);
  });

  it('site condition applies site multiplier', () => {
    const baseline = calculateQuickFeasibilityEstimate(guamInputs());
    const remote = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      siteCondition: 'remoteIslandOrHardLogistics',
    });

    expect(remote.multipliers.siteCondition).toBe(
      squareFootPricingData.siteConditionMultipliers.remoteIslandOrHardLogistics,
    );
    expect(remote.adjustedCost).toBeGreaterThan(baseline.adjustedCost);
  });

  it('MEP app-level multiplier applies', () => {
    const baseline = calculateQuickFeasibilityEstimate(guamInputs());
    const dense = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      mepIntensity: 'dense',
    });

    expect(dense.multipliers.mep).toBe(1.3);
    expect(dense.adjustedCost).toBeGreaterThan(baseline.adjustedCost);
  });

  it('contingency applies to likely budget', () => {
    const withoutContingency = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      contingencyPercent: 0,
    });
    const withContingency = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      contingencyPercent: 10,
    });

    expect(withoutContingency.likelyTotal).toBe(588_000);
    expect(withContingency.likelyTotal).toBe(646_800);
  });

  it('returns safe zero preview for blank inputs', () => {
    const result = calculateQuickFeasibilityEstimate(DEFAULT_QUICK_FEASIBILITY_INPUTS);

    expect(result.isValid).toBe(false);
    expect(result.validationMessages).toEqual([QUICK_FEASIBILITY_PREVIEW_HINT]);
    expect(result.likelyTotal).toBe(0);
    expectAllFinite(result);
  });

  it('does not produce NaN or Infinity for invalid inputs', () => {
    const result = calculateQuickFeasibilityEstimate({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: Number.NaN,
      basePricePerSf: Number.POSITIVE_INFINITY,
      locationAdjustmentFactor: -5,
      contingencyPercent: 500,
    });

    expect(result.isValid).toBe(false);
    expectAllFinite(result);
  });

  it('exposes dataset important limitations for UI warnings', () => {
    const limitations = getSquareFootPricingImportantLimitations();
    expect(limitations.length).toBeGreaterThan(0);
    expect(limitations.some((note) => note.includes('early budgeting only'))).toBe(true);
    expect(limitations.some((note) => note.includes('work breakdown/activity estimate'))).toBe(
      true,
    );
  });

  it('parses project location label into default location code when possible', () => {
    expect(
      getDefaultLocationCodeFromProject({ locationLabel: '123 Main St, Tamuning, GU 96913' }),
    ).toBe('GU');
    expect(getDefaultLocationCodeFromProject({ jobsiteState: 'CA' })).toBe('CA');
  });

  it('uses wider remodel risk spread than new construction', () => {
    const newConstruction = calculateQuickFeasibilityEstimate(guamInputs());
    const remodel = calculateQuickFeasibilityEstimate({
      ...guamInputs(),
      projectType: 'moderateRemodel',
    });

    const newSpread =
      (newConstruction.highTotal - newConstruction.lowTotal) / newConstruction.likelyTotal;
    const remodelSpread = (remodel.highTotal - remodel.lowTotal) / remodel.likelyTotal;

    expect(remodelSpread).toBeGreaterThan(newSpread);
  });

  it('validateQuickFeasibilityInputs returns preview hint when area or base rate missing', () => {
    expect(
      validateQuickFeasibilityInputs({
        ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
        areaSF: 0,
      }),
    ).toEqual([QUICK_FEASIBILITY_PREVIEW_HINT]);
  });
});
