import type {
  MixComplianceResult,
  MixDesignAdvisorFormState,
  MixProjectUse,
  ProfessionalMixDesignResult,
} from '../types/mixDesignAdvisor';
import {
  calculateEvaporationRateImperial,
  getEvaporationRiskLevel,
  getMaxAllowedWaterCementRatio,
  parseMixDesignPsi,
  type MixClimate,
  type MixExposure,
} from './mixDesign';

export function isExteriorFlatworkUse(use: MixProjectUse): boolean {
  return (
    use === 'driveway' ||
    use === 'sidewalk' ||
    use === 'exterior_flatwork' ||
    use === 'marine_coastal' ||
    use === 'curb_gutter'
  );
}

export function getTargetAirContent(
  exposure: MixExposure,
  climate: MixClimate,
  airEntrainmentRequired: boolean,
  exteriorFlatwork: boolean,
): [number, number] {
  if (!airEntrainmentRequired && !exteriorFlatwork && exposure === 'none') {
    return climate === 'tropical' ? [2, 4] : [3, 5];
  }

  const table =
    climate === 'tropical'
      ? { none: [2, 4], F1: [3, 5], F2: [4, 6], F3: [5, 7] }
      : { none: [3, 5], F1: [4, 6], F2: [5, 7], F3: [6, 8] };

  const key = exteriorFlatwork && exposure === 'none' ? 'F1' : exposure;
  return table[key] as [number, number];
}

export function getRequiredAverageStrengthPsi(designPsi: number): number {
  return Math.round(designPsi * 1.15);
}

export function getSlumpRange(
  slumpTarget: number,
  pumpRequired: boolean,
): [number, number] {
  const target = pumpRequired ? Math.max(slumpTarget, 4) : slumpTarget;
  const spread = pumpRequired ? 2 : 1.5;
  return [Math.max(2, target - spread), target + spread];
}

export function evaluateMixCompliance(input: {
  waterCementRatio: number;
  maxAllowedWaterCementRatio: number;
  slumpTarget: number;
  maxAllowedSlump: number;
  waterReducerRecommended: boolean;
  targetAirMid: number;
  minAirContent: number;
  exteriorFlatwork: boolean;
  airEntrainmentRequired: boolean;
  temperatureF: number;
  evaporationRateMetric: number;
  sulfateExposure: boolean;
  chlorideExposure: boolean;
  pumpRequired: boolean;
  haulTimeMinutes: number;
}): MixComplianceResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  if (input.waterCementRatio > input.maxAllowedWaterCementRatio + 0.001) {
    failures.push('Water-cement ratio exceeds durability limit.');
  }

  if (
    input.slumpTarget > input.maxAllowedSlump &&
    !input.waterReducerRecommended
  ) {
    warnings.push('High slump target without water reducer may reduce strength.');
  }

  if (input.exteriorFlatwork && !input.airEntrainmentRequired) {
    failures.push('Exterior flatwork requires proper air entrainment.');
  }

  if (input.airEntrainmentRequired && input.targetAirMid < input.minAirContent) {
    failures.push('Target air content below minimum for specified exposure.');
  }

  if (input.temperatureF > 90) {
    warnings.push('Hot weather concreting precautions required.');
  }

  if (input.temperatureF < 40) {
    warnings.push('Cold weather protection and accelerator may be required.');
  }

  if (input.evaporationRateMetric > 1.0) {
    failures.push(
      'High evaporation risk. Reschedule or apply immediate mitigation.',
    );
  } else if (input.evaporationRateMetric > 0.5) {
    warnings.push('Moderate evaporation risk — use fogging, windbreaks, and curing compound.');
  }

  if (input.sulfateExposure && input.waterCementRatio > 0.45) {
    failures.push('Sulfate exposure requires lower water-cement ratio (≤ 0.45).');
  }

  if (input.chlorideExposure && input.waterCementRatio > 0.4) {
    failures.push('Chloride exposure requires water-cement ratio ≤ 0.40.');
  }

  if (input.pumpRequired && input.slumpTarget < 4) {
    warnings.push('Pump placement typically requires minimum 4 in slump at discharge.');
  }

  if (input.haulTimeMinutes > 90) {
    warnings.push('Extended haul time — verify retarder dosage and revolutions per spec.');
  }

  const status =
    failures.length > 0 ? 'Reject' : warnings.length > 0 ? 'Caution' : 'OK';

  return { status, warnings, failures };
}

function getMitigationSteps(metricRate: number): string[] {
  if (metricRate <= 0.5) {
    return ['Standard curing procedures are adequate.'];
  }
  if (metricRate <= 1.0) {
    return [
      'Erect windbreaks or sun-shades around placement area.',
      'Fog lightly during finishing; apply curing compound when bleeding stops.',
      'Consider early-morning placement.',
    ];
  }
  return [
    'Apply evaporation retarder after screeding.',
    'Mandatory wet curing or curing compound immediately.',
    'Strongly consider rescheduling placement.',
  ];
}

export function buildProfessionalMixRecommendation(params: {
  form: Pick<
    MixDesignAdvisorFormState,
    | 'projectUse'
    | 'selectedPsi'
    | 'exposure'
    | 'slumpTargetIn'
    | 'maxAggregateIn'
    | 'placementMethod'
    | 'finishType'
    | 'pumpRequired'
    | 'cementType'
    | 'scmOption'
    | 'chlorideExposure'
    | 'sulfateExposure'
    | 'freezeThawExposure'
    | 'haulTimeMinutes'
    | 'airEntrainmentRequired'
    | 'climate'
  >;
  tempF: number;
  humidityPercent: number;
  windMph: number;
}): ProfessionalMixDesignResult {
  const { form, tempF, humidityPercent, windMph } = params;
  const designPsi = parseMixDesignPsi(form.selectedPsi);
  const exteriorFlatwork = isExteriorFlatworkUse(form.projectUse);
  const marineCoastal = form.projectUse === 'marine_coastal';
  const slumpTarget = parseFloat(form.slumpTargetIn) || (form.pumpRequired ? 5 : 4);
  const haulTimeMinutes = parseInt(form.haulTimeMinutes, 10) || 0;

  const exposure =
    form.freezeThawExposure || exteriorFlatwork
      ? form.exposure === 'none'
        ? 'F1'
        : form.exposure
      : form.exposure;

  const airEntrainmentRequired =
    form.airEntrainmentRequired || exteriorFlatwork || form.freezeThawExposure;

  const maxAllowedWaterCementRatio = getMaxAllowedWaterCementRatio({
    psi: designPsi,
    exposure,
    sulfateExposure: form.sulfateExposure,
    chlorideExposure: form.chlorideExposure,
    marineCoastal,
  });

  const waterCementRatio = maxAllowedWaterCementRatio;
  const targetAir = getTargetAirContent(
    exposure,
    form.climate,
    airEntrainmentRequired,
    exteriorFlatwork,
  );
  const targetAirMid = (targetAir[0] + targetAir[1]) / 2;

  const tempC = ((tempF - 32) * 5) / 9;
  const aeFactor = tempC > 38 ? 1.25 : tempC < 4 ? 0.6 : 1.0;
  const evaporationRate = calculateEvaporationRateImperial(
    tempF,
    humidityPercent,
    windMph,
  );

  const hotWeather = tempF > 90 || (form.climate === 'tropical' && tempF > 85);
  const coldWeather = tempF < 40;
  const waterReducerRecommended =
    hotWeather || form.pumpRequired || slumpTarget >= 5 || form.placementMethod === 'pump';

  const maxAllowedSlump = form.pumpRequired ? 7 : 6;
  const slumpRange = getSlumpRange(slumpTarget, form.pumpRequired);

  const compliance = evaluateMixCompliance({
    waterCementRatio,
    maxAllowedWaterCementRatio,
    slumpTarget,
    maxAllowedSlump,
    waterReducerRecommended,
    targetAirMid,
    minAirContent: targetAir[0],
    exteriorFlatwork,
    airEntrainmentRequired,
    temperatureF: tempF,
    evaporationRateMetric: evaporationRate.metric,
    sulfateExposure: form.sulfateExposure,
    chlorideExposure: form.chlorideExposure,
    pumpRequired: form.pumpRequired,
    haulTimeMinutes,
  });

  const admixtureRecommendations: string[] = [];
  if (airEntrainmentRequired) {
    admixtureRecommendations.push(
      `Air-entraining admixture to ${targetAir[0]}–${targetAir[1]}% total air.`,
    );
  }
  if (waterReducerRecommended) {
    admixtureRecommendations.push(
      'Mid-range water reducer (Type A/F) for workability — do not increase mix water.',
    );
  }
  if (hotWeather) {
    admixtureRecommendations.push('Type D retarding water reducer for hot weather.');
    admixtureRecommendations.push(
      'Consider chilled water or ice replacement per supplier trial data.',
    );
  }
  if (coldWeather) {
    admixtureRecommendations.push(
      'Non-chloride accelerator (Type C) only when necessary for cold weather.',
    );
  } else if (!hotWeather && haulTimeMinutes > 45) {
    admixtureRecommendations.push('Retarder dosage adjusted for haul time and temperature.');
  }

  const scmRecommendation =
    form.scmOption === 'none'
      ? hotWeather
        ? 'Consider 15–25% fly ash or slag to reduce heat of hydration.'
        : 'No SCM required for this exposure; optional for sustainability.'
      : {
          fly_ash: '15–25% Class F fly ash replacement of cement.',
          slag: '25–50% ground granulated slag replacement.',
          silica_fume: '5–10% silica fume for high durability / low permeability.',
          fly_ash_slag: 'Combined fly ash + slag per supplier submittal.',
        }[form.scmOption];

  const cementitiousContentLbPerYd: [number, number] =
    designPsi >= 5000 ? [650, 750] : designPsi >= 4000 ? [550, 650] : [500, 600];

  const hotWeatherPrecautions: string[] = hotWeather
    ? [
        'Schedule placement early morning or evening.',
        'Do not add water at jobsite — use admixtures for slump adjustment.',
        'Fog aggregate and forms; use light-colored curing compound.',
        'Monitor concrete temperature at discharge (target ≤ 90°F).',
      ]
    : [];

  const coldWeatherPrecautions: string[] = coldWeather
    ? [
        'Heat mixing water (max 140°F); protect concrete from freezing.',
        'Use insulated blankets; verify minimum protection temperature.',
        'Avoid calcium chloride in reinforced concrete.',
      ]
    : [];

  let pumpabilityWarning: string | undefined;
  if (form.pumpRequired && slumpTarget < 4) {
    pumpabilityWarning = 'Slump may be low for pump lines — confirm with supplier.';
  } else if (form.pumpRequired && form.maxAggregateIn === '1.5') {
    pumpabilityWarning = '1.5 in max aggregate may require smaller rock for some pump lines.';
  }

  let finishabilityWarning: string | undefined;
  if (form.finishType === 'hard_trowel' && targetAirMid > 3) {
    finishabilityWarning =
      'High air content can make hard-trowel finish difficult — coordinate with supplier.';
  }
  if (evaporationRate.metric > 0.75 && form.finishType === 'exposed_aggregate') {
    finishabilityWarning =
      'High evaporation risk for exposed aggregate — plan timing and surface retarder.';
  }

  const curingMethod =
    coldWeather
      ? 'Insulated curing blankets; maintain above 50°F for 48+ hours.'
      : hotWeather
        ? 'Continuous moist cure or high-efficiency curing compound immediately after finishing.'
        : exteriorFlatwork || exposure !== 'none'
          ? 'Wet cure 7 days or membrane curing compound per ACI 308.'
          : 'Curing compound after bleed water disappears; minimum 7 days protection.';

  const durabilityCheck: string[] = [
    `Max w/c ratio: ${maxAllowedWaterCementRatio.toFixed(2)} (held for strength/durability).`,
    `Target air: ${targetAir[0]}–${targetAir[1]}%.`,
    form.sulfateExposure ? 'Sulfate-resistant cement (Type V) or equivalent SCM strategy.' : 'No sulfate exposure selected.',
    form.chlorideExposure ? 'Low permeability mix; avoid chloride accelerators.' : 'Standard chloride limits for reinforced concrete.',
  ];

  const workabilityCheck: string[] = [
    `Target slump: ${slumpRange[0]}–${slumpRange[1]} in at placement.`,
    `Max aggregate: ${form.maxAggregateIn} in.`,
    waterReducerRecommended
      ? 'Water reducer recommended for workability without added water.'
      : 'Workability via design w/c and aggregate grading.',
  ];

  const evapRisk = getEvaporationRiskLevel(evaporationRate.metric);
  const weatherRisk: string[] = [
    `Evaporation: ${evaporationRate.metric.toFixed(2)} kg/m²·hr (${evapRisk.level} risk).`,
    `Ambient ${tempF}°F, ${humidityPercent}% RH, wind ${windMph} mph.`,
    ...getMitigationSteps(evaporationRate.metric),
  ];

  const placementNotes: string[] = [
    `Placement method: ${form.placementMethod.replace('_', ' ')}.`,
    `Finish: ${form.finishType.replace('_', ' ')}.`,
    haulTimeMinutes > 0 ? `Haul time: ${haulTimeMinutes} min — coordinate retarder with batch plant.` : '',
    'Verify trial batch and supplier submittal before ordering.',
  ].filter(Boolean);

  const recommendations: string[] = [
    ...admixtureRecommendations,
    ...hotWeatherPrecautions,
    ...coldWeatherPrecautions,
    ...compliance.warnings,
    ...compliance.failures,
    ...getMitigationSteps(evaporationRate.metric),
  ];

  return {
    waterCementRatio,
    maxAllowedWaterCementRatio,
    targetAir,
    aeFactor,
    evaporationRate,
    recommendations,
    designPsi,
    requiredAverageStrengthPsi: getRequiredAverageStrengthPsi(designPsi),
    slumpRange,
    recommendedAggregateSize: `${form.maxAggregateIn} in`,
    cementitiousContentLbPerYd,
    waterReducerRecommendation: waterReducerRecommended
      ? 'Mid-range water reducer — maintain w/c; do not add water at jobsite.'
      : 'Optional low-range water reducer per supplier.',
    retarderAcceleratorRecommendation: coldWeather
      ? 'Non-chloride accelerator per cold-weather plan.'
      : hotWeather
        ? 'Type D retarding water reducer.'
        : haulTimeMinutes > 45
          ? 'Retarder dosed for haul time and temperature.'
          : 'None required under current conditions.',
    scmRecommendation,
    curingMethod,
    hotWeatherPrecautions,
    coldWeatherPrecautions,
    pumpabilityWarning,
    finishabilityWarning,
    compliance,
    durabilityCheck,
    workabilityCheck,
    weatherRisk,
    admixtureRecommendations,
    placementNotes,
    waterReducerRecommended,
    exteriorFlatwork,
  };
}
