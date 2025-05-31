// Pure helpers for Rebar & Fiber Optimizer

export type RebarSize = '#1' | '#2' | '#3' | '#4' | '#5' | '#6' | '#7' | '#8';

export interface RebarPick {
  size: RebarSize;
  spacingXIn: number;  // X-direction spacing
  spacingYIn: number;  // Y-direction spacing
}

export interface ColumnRebarPick {
  size: RebarSize;
  verticalBars: number;  // For columns - number of vertical bars
}

export type FiberType = 'micro' | 'macro' | 'steel';
export type DutyLevel = 'light' | 'med' | 'heavy';

export interface CutListItem {
  lengthFt: number;
  qty: number;
}

export interface RebarResult {
  pick: RebarPick;
  listX: CutListItem[];
  listY: CutListItem[];
  totalBars: number;
  totalLinearFt: number;
}

export interface ColumnRebarResult {
  pick: ColumnRebarPick;
  verticalBars: CutListItem[];
  tieList: CutListItem[];
  totalBars: number;
  totalLinearFt: number;
}

export interface FiberResult {
  dose: number;
  totalLb: number;
  bags: number;
  bagWeight: number;
}

export interface MeshResult {
  sheets: number;
  sheetSize: string;
  totalSqFt: number;
}

const BAR_DIAMETER_IN: Record<RebarSize, number> = {
  '#1': 0.125,
  '#2': 0.25,
  '#3': 0.375,
  '#4': 0.5,
  '#5': 0.625,
  '#6': 0.75,
  '#7': 0.875,
  '#8': 1.0,
};

/**
 * Decide bar size + spacing from slab thickness (inches)
 * Rule of thumb: #4 @ 12" for <5.5", #5 for 6-8", #6 for >8"
 */
export function pickRebar(thicknessIn: number, spacingXIn: number = 12, spacingYIn: number = 12): RebarPick {
  let size: RebarSize;
  if (thicknessIn < 5.5) size = '#4';
  else if (thicknessIn <= 8) size = '#5';
  else size = '#6';
  
  return { size, spacingXIn, spacingYIn };
}

/**
 * Decide column rebar configuration
 */
export function pickColumnRebar(widthFt: number, lengthFt: number, verticalBars?: number): ColumnRebarPick {
  // Calculate perimeter for vertical bar estimation
  const perimeter = 2 * (widthFt + lengthFt) * 12; // in inches
  
  // Default: one bar every 6-8 inches around perimeter
  const defaultVerticalBars = verticalBars || Math.max(4, Math.ceil(perimeter / 8));
  
  // Size based on column dimensions
  const maxDimension = Math.max(widthFt, lengthFt);
  let size: RebarSize;
  if (maxDimension < 1) size = '#4';
  else if (maxDimension < 2) size = '#5';
  else size = '#6';
  
  return { size, verticalBars: defaultVerticalBars };
}

/**
 * Build a grouped cut list with proper cover and lap splice calculations
 * 
 * @param slabSpanFt - Total slab dimension in feet (e.g., 10 ft)
 * @param spacingIn - Rebar spacing in inches (e.g., 12")
 * @param coverIn - Concrete cover in inches (e.g., 3")
 * @param stockFt - Stock rebar length available (e.g., 20 ft)
 * @param size - Rebar size for lap splice calculation
 */
export function buildCutList(
  slabSpanFt: number,
  spacingIn: number,
  coverIn: number,
  stockFt: number = 20,
  size: RebarSize = '#4'
): CutListItem[] {
  // Convert slab span to inches for calculations
  const slabSpanIn = slabSpanFt * 12;
  
  // Calculate clear span (subtract cover from both ends)
  const clearSpanIn = slabSpanIn - (2 * coverIn);
  
  // Number of bars needed based on spacing
  const barsNeeded = Math.ceil(clearSpanIn / spacingIn) + 1;
  
  // Required rebar length (clear span, no additional cover)
  const requiredLengthFt = clearSpanIn / 12;
  
  // Lap splice length (30 × bar diameter)
  const lapSpliceFt = (30 * BAR_DIAMETER_IN[size]) / 12;

  const list: CutListItem[] = [];

  for (let i = 0; i < barsNeeded; i++) {
    if (requiredLengthFt <= stockFt) {
      // Single piece fits - use exact required length
      addBar(requiredLengthFt);
    } else {
      // Need to splice - split into two pieces with overlap
      // First piece: stock length minus half the lap splice
      const firstPieceFt = stockFt - (lapSpliceFt / 2);
      
      // Second piece: remaining length plus half the lap splice
      const remainingFt = requiredLengthFt - firstPieceFt;
      const secondPieceFt = remainingFt + (lapSpliceFt / 2);
      
      addBar(firstPieceFt);
      addBar(secondPieceFt);
    }
  }

  return mergeLikeLengths(list);

  function addBar(lengthFt: number) {
    // Round up to nearest inch
    const roundedLength = Math.ceil(lengthFt * 12) / 12;
    const existing = list.find(item => Math.abs(item.lengthFt - roundedLength) < 0.1);
    
    if (existing) {
      existing.qty += 1;
    } else {
      list.push({ lengthFt: roundedLength, qty: 1 });
    }
  }

  function mergeLikeLengths(items: CutListItem[]): CutListItem[] {
    return items.sort((a, b) => a.lengthFt - b.lengthFt);
  }
}

/**
 * Calculate complete rebar solution for a rectangular slab
 */
export function calculateRebar(
  lengthFt: number,
  widthFt: number,
  thicknessIn: number,
  coverIn: number = 2,
  stockFt: number = 20,
  manualSize?: RebarSize,
  spacingXIn: number = 12,
  spacingYIn: number = 12
): RebarResult {
  const pick = manualSize 
    ? { size: manualSize, spacingXIn, spacingYIn } 
    : pickRebar(thicknessIn, spacingXIn, spacingYIn);
  
  // Generate cut lists for both directions using actual slab dimensions
  const listX = buildCutList(widthFt, pick.spacingXIn, coverIn, stockFt, pick.size);
  const listY = buildCutList(lengthFt, pick.spacingYIn, coverIn, stockFt, pick.size);
  
  // Calculate totals
  const totalBars = listX.reduce((sum, item) => sum + item.qty, 0) + 
                    listY.reduce((sum, item) => sum + item.qty, 0);
  
  const totalLinearFt = listX.reduce((sum, item) => sum + (item.lengthFt * item.qty), 0) +
                        listY.reduce((sum, item) => sum + (item.lengthFt * item.qty), 0);

  return {
    pick,
    listX,
    listY,
    totalBars,
    totalLinearFt
  };
}

/**
 * Calculate rebar for columns (vertical bars + ties)
 */
export function calculateColumnRebar(
  widthFt: number,
  lengthFt: number,
  heightFt: number,
  coverIn: number = 1.5,
  stockFt: number = 20,
  manualSize?: RebarSize,
  verticalBars?: number
): ColumnRebarResult {
  const pick = manualSize 
    ? { size: manualSize, verticalBars: verticalBars || 4 }
    : pickColumnRebar(widthFt, lengthFt, verticalBars);
  
  // Vertical bars - full height minus top/bottom cover
  const clearHeightFt = heightFt - (2 * coverIn) / 12;
  const verticalBarList: CutListItem[] = [];
  
  // Calculate number of vertical bars needed
  for (let i = 0; i < pick.verticalBars; i++) {
    if (clearHeightFt <= stockFt) {
      addBar(verticalBarList, clearHeightFt);
    } else {
      // Need to splice vertical bars
      const lapSpliceFt = (40 * BAR_DIAMETER_IN[pick.size]) / 12; // 40x for vertical bars
      const firstPieceFt = stockFt - lapSpliceFt;
      const secondPieceFt = clearHeightFt - firstPieceFt + lapSpliceFt;
      
      addBar(verticalBarList, firstPieceFt);
      addBar(verticalBarList, secondPieceFt);
    }
  }
  
  // Tie bars - calculate perimeter and spacing
  const tiePerimeter = 2 * ((widthFt - 2 * coverIn / 12) + (lengthFt - 2 * coverIn / 12));
  const tieSpacing = Math.min(16, pick.size === '#4' ? 12 : pick.size === '#5' ? 10 : 8); // in inches
  const numberOfTies = Math.ceil((heightFt * 12) / tieSpacing);
  
  const tieList: CutListItem[] = [];
  for (let i = 0; i < numberOfTies; i++) {
    addBar(tieList, tiePerimeter);
  }
  
  // Calculate totals
  const totalBars = verticalBarList.reduce((sum, item) => sum + item.qty, 0) + 
                    tieList.reduce((sum, item) => sum + item.qty, 0);
  
  const totalLinearFt = verticalBarList.reduce((sum, item) => sum + (item.lengthFt * item.qty), 0) +
                        tieList.reduce((sum, item) => sum + (item.lengthFt * item.qty), 0);

  return {
    pick,
    verticalBars: mergeLikeLengths(verticalBarList),
    tieList: mergeLikeLengths(tieList),
    totalBars,
    totalLinearFt
  };

  function addBar(list: CutListItem[], lengthFt: number) {
    const roundedLength = Math.ceil(lengthFt * 12) / 12;
    const existing = list.find(item => Math.abs(item.lengthFt - roundedLength) < 0.1);
    
    if (existing) {
      existing.qty += 1;
    } else {
      list.push({ lengthFt: roundedLength, qty: 1 });
    }
  }

  function mergeLikeLengths(items: CutListItem[]): CutListItem[] {
    return items.sort((a, b) => a.lengthFt - b.lengthFt);
  }
}

/**
 * Return fiber dosage (lb/yd³) based on type + duty level
 * Based on industry standards and manufacturer specs
 */
export function pickFiberDose(
  type: FiberType,
  duty: DutyLevel = 'med'
): number {
  switch (type) {
    case 'micro':
      // Micro polypropylene - plastic shrinkage control
      return duty === 'light' ? 0.75 : duty === 'med' ? 1.0 : 1.5;
      
    case 'macro':
      // Macro synthetic - light structural replacement
      return duty === 'light' ? 3 : duty === 'med' ? 4 : 5;
      
    case 'steel':
      // Steel fiber - structural applications
      return duty === 'light' ? 30 : duty === 'med' ? 50 : 70;
      
    default:
      return 1.0;
  }
}

/**
 * Calculate fiber requirements for given concrete volume
 */
export function calculateFiber(
  cubicYards: number,
  type: FiberType,
  duty: DutyLevel = 'med'
): FiberResult {
  const dose = pickFiberDose(type, duty);
  const totalLb = dose * cubicYards;
  
  // Typical bag weights by fiber type
  const bagWeight = type === 'steel' ? 40 : type === 'macro' ? 50 : 1;
  const bags = Math.ceil(totalLb / bagWeight);
  
  return {
    dose,
    totalLb,
    bags,
    bagWeight
  };
}

/**
 * Calculate welded wire mesh requirements
 * Standard 5'×10' sheets with 6"×6" grid
 */
export function calculateMesh(
  lengthFt: number,
  widthFt: number
): MeshResult {
  const totalSqFt = lengthFt * widthFt;
  
  // Standard sheet: 5' × 10' = 50 sq ft
  // Account for 6" overlap on all sides
  const effectiveSheetArea = 4.5 * 9.5; // 42.75 sq ft effective
  const sheets = Math.ceil(totalSqFt / effectiveSheetArea);
  
  return {
    sheets,
    sheetSize: "5' × 10'",
    totalSqFt
  };
}

/**
 * Generate CSV content for cut list export
 */
export function generateCutListCSV(
  rebarResult: RebarResult,
  projectInfo: {
    lengthFt: number;
    widthFt: number;
    thicknessIn: number;
    coverIn: number;
  }
): string {
  const { pick, listX, listY, totalBars, totalLinearFt } = rebarResult;
  
  let csv = 'Reinforcement Cut List\n\n';
  csv += `Project: ${projectInfo.lengthFt}' × ${projectInfo.widthFt}' × ${projectInfo.thicknessIn}"\n`;
  csv += `Cover: ${projectInfo.coverIn}"\n`;
  csv += `Bar Size: ${pick.size} @ ${pick.spacingXIn}" o.c.\n\n`;
  
  csv += 'Direction,Length (ft),Quantity\n';
  
  // X-direction bars
  listX.forEach(item => {
    csv += `X-Direction,${item.lengthFt},${item.qty}\n`;
  });
  
  // Y-direction bars  
  listY.forEach(item => {
    csv += `Y-Direction,${item.lengthFt},${item.qty}\n`;
  });
  
  csv += `\nTotal Bars: ${totalBars}\n`;
  csv += `Total Linear Feet: ${totalLinearFt.toFixed(1)}\n`;
  
  return csv;
}

/**
 * Convert decimal feet to feet and inches format
 * Example: 9.66667 → { feet: 9, inches: 8 } → "9 ft 8 in"
 */
export function feetToFeetInches(decimalFeet: number): { feet: number; inches: number; display: string } {
  const feet = Math.floor(decimalFeet);
  const remainingInches = Math.round((decimalFeet - feet) * 12);
  
  // Handle case where rounding up gives us 12 inches
  if (remainingInches === 12) {
    return {
      feet: feet + 1,
      inches: 0,
      display: `${feet + 1} ft`
    };
  }
  
  const display = remainingInches === 0 
    ? `${feet} ft` 
    : `${feet} ft ${remainingInches} in`;
  
  return {
    feet,
    inches: remainingInches,
    display
  };
}

/**
 * Test function to validate calculations
 * Example: 10'x10'x4" slab with 3" cover, #4 rebar
 * Expected: Clear span = 10' - 6" = 9.5'
 * Rebar length needed = 9.5' (fits in 20' stock)
 * Lap splice = 30 × 0.5" = 15" = 1.25'
 */
// Uncomment to run test:
// testCalculation(); 