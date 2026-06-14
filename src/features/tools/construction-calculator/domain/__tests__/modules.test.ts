import { describe, expect, it } from 'vitest';
import { calculateArea } from '../modules/areaModule';
import { calculateVolume } from '../modules/volumeModule';
import { calculateBoardFeetModule } from '../modules/boardFeetModule';
import { calculateConcrete } from '../modules/concreteModule';
import { calculateBlocks } from '../modules/blocksModule';
import { calculateDrywall } from '../modules/drywallModule';
import { calculateStairs } from '../modules/stairsModule';
import { calculateRightTriangle } from '../modules/rightTriangleModule';
import { calculateCircle } from '../modules/circleModule';
import { calculateCostPerUnit } from '../modules/costPerUnit';
import { toDecimalInches } from '../constructionDimensionMath';

describe('area module', () => {
  it('calculates square feet from length and width', () => {
    const result = calculateArea({ lengthInches: 120, widthInches: 120 });
    expect(result.squareFeet).toBe(100);
  });
});

describe('volume module', () => {
  it('calculates cubic yards', () => {
    const result = calculateVolume({
      lengthInches: 36,
      widthInches: 36,
      heightInches: 36,
    });
    expect(result.cubicYards).toBe(1);
  });
});

describe('board feet module', () => {
  it('calculates board feet', () => {
    const result = calculateBoardFeetModule({
      thicknessInches: 2,
      widthInches: 6,
      lengthFeet: 10,
    });
    expect(result.boardFeet).toBe(10);
  });
});

describe('concrete module', () => {
  it('applies waste percent to cubic yards', () => {
    const result = calculateConcrete({
      lengthInches: 360,
      widthInches: 360,
      depthInches: 4,
      wastePercent: 10,
    });
    expect(result.cubicYards).toBeGreaterThan(0);
    expect(result.cubicYardsWithWaste).toBeGreaterThan(result.cubicYards);
  });
});

describe('blocks module', () => {
  it('counts blocks for a wall', () => {
    const result = calculateBlocks({
      wallLengthInches: 240,
      wallHeightInches: 96,
      blockLengthInches: 16,
      blockHeightInches: 8,
      wastePercent: 0,
    });
    expect(result.blockCount).toBeGreaterThan(0);
  });
});

describe('drywall module', () => {
  it('counts sheets for a wall', () => {
    const result = calculateDrywall({
      wallLengthInches: 144,
      wallHeightInches: 96,
      sheetWidthInches: 48,
      sheetHeightInches: 96,
      wastePercent: 0,
    });
    expect(result.sheetCount).toBe(3);
  });
});

describe('stairs module', () => {
  it('calculates riser height with precision', () => {
    const totalRise = toDecimalInches({ feet: 9, inches: 4 });
    const result = calculateStairs({
      totalRiseInches: totalRise,
      riserCount: 15,
      treadDepthInches: 10,
      precision: 16,
    });
    expect(result.riserHeightFormatted).toBe(`7 7/16"`);
  });
});

describe('right triangle module', () => {
  it('computes pitch 4:12 angle', () => {
    const result = calculateRightTriangle({ pitchRise: 4, pitchRun: 12 });
    expect(result).not.toBeNull();
    expect(result!.pitchRise).toBe(4);
    expect(result!.angleDegrees).toBeCloseTo(18.43, 1);
  });
});

describe('circle module', () => {
  it('calculates area and circumference', () => {
    const result = calculateCircle({ diameterInches: 12 });
    expect(result.radiusInches).toBe(6);
    expect(result.areaSqFt).toBeCloseTo(0.785, 2);
    expect(result.circumferenceInches).toBeCloseTo(37.6991, 2);
  });
});

describe('cost per unit', () => {
  it('multiplies quantity by unit cost', () => {
    const result = calculateCostPerUnit({ quantity: 10, unitCost: 4.5 });
    expect(result.totalCost).toBe(45);
  });
});
