import { LengthUnit, VolumeUnit, ConcreteMixDesign, CONCRETE_MIX_DESIGNS } from '../types';

// Convert feet, inches, and fractions to decimal feet
export function convertToDecimalFeet(feet: number, inches: number, fraction: number): number {
  return feet + (inches + fraction) / 12;
}

// Convert length units to feet for calculation
export function convertToFeet(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'feet':
      return value;
    case 'inches':
      return value / 12;
    case 'meters':
      return value * 3.28084;
    case 'centimeters':
      return value * 0.0328084;
    default:
      return value;
  }
}

// Convert cubic feet to specified volume unit
export function convertVolume(cubicFeet: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'cubic_feet':
      return cubicFeet;
    case 'cubic_yards':
      return cubicFeet / 27;
    case 'cubic_meters':
      return cubicFeet * 0.0283168;
    default:
      return cubicFeet;
  }
}

// Calculate volume for a slab in cubic feet
export function calculateSlabVolume(
  length: number,
  width: number,
  thickness: number,
  lengthUnit: LengthUnit
): number {
  const lengthFt = convertToFeet(length, lengthUnit);
  const widthFt = convertToFeet(width, lengthUnit);
  const thicknessFt = convertToFeet(thickness, lengthUnit);
  
  return lengthFt * widthFt * thicknessFt;
}

// Calculate volume for a thickened‐edge slab in cubic feet
export function calculateThickenedEdgeSlabVolume(
  length: number,        // in "value" of unit
  width: number,         // in "value" of unit
  baseThickness: number, // field slab thickness
  edgeThickness: number, // full edge thickness
  edgeWidth: number,     // how far the thickening extends
  unit: LengthUnit
): number {
  // Convert every dimension into feet
  const L = convertToFeet(length, unit);
  const W = convertToFeet(width, unit);
  const T0 = convertToFeet(baseThickness, unit);
  const T1 = convertToFeet(edgeThickness, unit);
  const Ew = convertToFeet(edgeWidth, unit);

  // 1. Base slab volume
  const baseVol = L * W * T0;

  // 2. Thickened edge extra volume
  const perimeter = 2 * (L + W);
  const extraDepth = T1 - T0;
  const edgeVol = perimeter * Ew * extraDepth;

  return baseVol + edgeVol;
}

// Calculate volume for a footer in cubic feet
export function calculateFooterVolume(
  length: number,
  width: number,
  depth: number,
  lengthUnit: LengthUnit
): number {
  const lengthFt = convertToFeet(length, lengthUnit);
  const widthFt = convertToFeet(width, lengthUnit);
  const depthFt = convertToFeet(depth, lengthUnit);
  
  return lengthFt * widthFt * depthFt;
}

// Calculate volume for a square/rectangular column in cubic feet
export function calculateRectColumnVolume(
  width: number,
  length: number,
  height: number,
  lengthUnit: LengthUnit
): number {
  const widthFt = convertToFeet(width, lengthUnit);
  const lengthFt = convertToFeet(length, lengthUnit);
  const heightFt = convertToFeet(height, lengthUnit);
  
  return widthFt * lengthFt * heightFt;
}

// Calculate volume for a round column in cubic feet
export function calculateRoundColumnVolume(
  diameter: number,
  height: number,
  lengthUnit: LengthUnit
): number {
  const diameterFt = convertToFeet(diameter, lengthUnit);
  const heightFt = convertToFeet(height, lengthUnit);
  const radius = diameterFt / 2;
  
  return Math.PI * radius * radius * heightFt;
}

// Calculate volume for a sidewalk in cubic feet
export function calculateSidewalkVolume(
  length: number,
  width: number,
  thickness: number,
  lengthUnit: LengthUnit
): number {
  const lengthFt = convertToFeet(length, lengthUnit);
  const widthFt = convertToFeet(width, lengthUnit);
  const thicknessFt = convertToFeet(thickness, lengthUnit);
  
  return lengthFt * widthFt * thicknessFt;
}

// Calculate number of 80lb bags needed
export function calculateBags(cubicYards: number): number {
  // Approximately 45 bags per cubic yard for 80lb bags
  return Math.ceil(cubicYards * 45);
}

// Calculate concrete mix materials based on volume and design
export function calculateMixMaterials(cubicYards: number, psi: keyof typeof CONCRETE_MIX_DESIGNS): ConcreteMixDesign {
  const mixDesign = CONCRETE_MIX_DESIGNS[psi];
  const totalParts = mixDesign.ratio.cement + mixDesign.ratio.sand + mixDesign.ratio.aggregate;
  
  // Calculate individual volumes in cubic yards
  const cementVolume = (cubicYards * mixDesign.ratio.cement) / totalParts;
  const sandVolume = (cubicYards * mixDesign.ratio.sand) / totalParts;
  const aggregateVolume = (cubicYards * mixDesign.ratio.aggregate) / totalParts;
  
  // Calculate water in gallons based on cement volume and water-cement ratio
  const waterGallons = Math.ceil((cementVolume * 27 * 94 * mixDesign.waterCementRatio) / 8.34); // 8.34 lbs/gallon of water
  
  const materials = {
    cement: Number(cementVolume.toFixed(2)),
    sand: Number(sandVolume.toFixed(2)),
    aggregate: Number(aggregateVolume.toFixed(2)),
    water: waterGallons
  };
  
  return {
    ...mixDesign,
    materials
  };
}

// Generate recommendations based on weather, project type, and dimensions
export function generateRecommendations(
  temperature: number,
  humidity: number,
  windSpeed: number,
  projectType: string,
  dimensions?: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  // Common weather-based recommendations
  if (temperature <= 32) {
    recommendations.push('CRITICAL: Freezing conditions - Use air-entraining admixture (4-7%) and non-chloride accelerator.');
    recommendations.push('Heat mixing water and aggregates to maintain concrete temperature above 50°F.');
    recommendations.push('Protect concrete from freezing until it reaches 70% of design strength.');
  } else if (temperature < 50) {
    recommendations.push('Cold weather conditions - Use non-chloride accelerator (Type C) to speed up setting time.');
    recommendations.push('Consider using Type III (high-early-strength) cement.');
    recommendations.push('Heat mixing water (max 140°F) to maintain proper concrete temperature.');
  } else if (temperature > 85 && temperature <= 90) {
    recommendations.push('Hot weather alert - Use water-reducing retarder (Type D) to maintain workability.');
    recommendations.push('Consider using chilled water or ice as partial water replacement.');
    recommendations.push('Schedule pour for early morning or evening to avoid peak heat.');
  } else if (temperature > 90) {
    recommendations.push('CRITICAL: Extreme heat - Use both water-reducing retarder and polycarboxylate superplasticizer.');
    recommendations.push('Use ice as partial water replacement to control concrete temperature.');
    recommendations.push('Mandatory early morning or evening pour schedule.');
  }

  // Humidity-based recommendations
  if (humidity < 30) {
    recommendations.push('Very low humidity - Increase curing compound application rate by 25%.');
    recommendations.push('Use evaporation retarder immediately after screeding.');
    recommendations.push('Add synthetic fiber reinforcement to control plastic shrinkage cracking.');
  } else if (humidity < 40) {
    recommendations.push('Low humidity - Use water-reducing admixture (Type A) to maintain workability.');
    recommendations.push('Apply evaporation retarder after screeding.');
  } else if (humidity > 80) {
    recommendations.push('High humidity - Reduce water content in mix.');
    recommendations.push('Use air-entraining admixture to improve durability.');
  }

  // Wind-based recommendations
  if (windSpeed > 20) {
    recommendations.push('CRITICAL: High wind - Erect wind breaks to protect fresh concrete.');
    recommendations.push('Increase curing compound application rate by 50%.');
    recommendations.push('Use synthetic microfibers to reduce plastic shrinkage cracking.');
  } else if (windSpeed > 15) {
    recommendations.push('Moderate wind - Use evaporation retarder to prevent rapid moisture loss.');
    recommendations.push('Consider adding synthetic microfibers for crack control.');
  }

  // Project-specific recommendations
  switch (projectType) {
    case 'thickened_edge_slab':
      if (dimensions) {
        const baseThickness = dimensions.baseThickness || 0;
        const edgeThickness = dimensions.edgeThickness || 0;
        
        recommendations.push('Use fiber reinforcement to control cracking at thickness transitions.');
        recommendations.push('Consider adding control joints at thickness transition points.');
        
        if (edgeThickness > baseThickness * 2) {
          recommendations.push('Large thickness difference - Pour edge thickening first, then main slab.');
        }
        
        if (baseThickness < 4/12) {
          recommendations.push('Thin base slab - Consider increasing thickness or adding reinforcement.');
        }
      }
      recommendations.push('Ensure proper consolidation at thickened edges.');
      recommendations.push('Use appropriate sized aggregate for minimum thickness.');
      break;

    case 'sidewalk':
      recommendations.push('Use air-entraining agent (4-7%) for freeze-thaw durability.');
      recommendations.push('Add water-reducing admixture (Type A) for improved workability.');
      
      if (dimensions && dimensions.thickness < 4/12) {
        recommendations.push('Add synthetic microfibers for crack control in thin sections.');
      }
      if (dimensions && dimensions.width > 4) {
        recommendations.push('Use air-entraining admixture for enhanced durability.');
      }
      break;

    case 'slab':
      if (dimensions) {
        const area = dimensions.length * dimensions.width;
        if (area > 400) {
          recommendations.push('Large slab - Use synthetic macro-fibers or welded wire reinforcement.');
          recommendations.push('Install saw-cut control joints at maximum 15-foot intervals.');
        }
        if (dimensions.thickness < 4/12) {
          recommendations.push('Thin slab - Add high-range water reducer for better consolidation.');
        }
      }
      if (temperature > 85) {
        recommendations.push('Use set-retarding admixtures for extended workability.');
      }
      break;

    case 'footer':
      if (dimensions) {
        if (dimensions.width < 2) {
          recommendations.push('Narrow footer - Use small aggregate size (3/8") for better consolidation.');
        }
        if (dimensions.depth < 1) {
          recommendations.push('Shallow footer - Add corrosion inhibitor for minimal reinforcement cover.');
        }
      }
      recommendations.push('Use normal water reducers (Type A) to lower water-cement ratio.');
      if (temperature < 50) {
        recommendations.push('Use non-chloride accelerators for early strength development.');
      }
      break;

    case 'column':
      recommendations.push('Use high-range water reducers for self-consolidating concrete (SCC).');
      recommendations.push('Add viscosity-modifying admixture to prevent segregation.');
      
      if (dimensions && dimensions.height > 10) {
        recommendations.push('Tall column - Use self-consolidating concrete with superplasticizer.');
        recommendations.push('Add viscosity-modifying admixture to maintain stability.');
      }
      
      if (temperature > 85) {
        recommendations.push('Use retarding admixtures or slump-retaining water reducers.');
      }
      break;
  }

  // Critical weather combination warnings
  if (temperature > 85 && humidity < 50 && windSpeed > 10) {
    recommendations.unshift('CRITICAL: High risk of plastic shrinkage - Implement all recommended protective measures.');
  }

  if (temperature < 40 || temperature > 90) {
    recommendations.push('Monitor concrete temperature hourly and adjust protection measures accordingly.');
  }

  return recommendations;
}