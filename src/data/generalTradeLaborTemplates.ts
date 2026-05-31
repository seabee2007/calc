import type {
  GeneralTrade,
  GeneralTradeStarterTemplate,
  ProductionRateType,
} from '../types/generalTradeLabor';
import { GENERAL_TRADES } from '../types/generalTradeLabor';

function tpl(
  trade: GeneralTrade,
  activity: string,
  unit: string,
  productionRate: number,
  productionRateType: ProductionRateType,
  defaultCrewSize: number,
  defaultLaborRate = 65,
  description?: string,
): GeneralTradeStarterTemplate {
  return {
    trade,
    activity,
    unit,
    productionRate,
    productionRateType,
    defaultCrewSize,
    defaultLaborRate,
    description: description ?? `${trade} — ${activity}`,
  };
}

export const GENERAL_TRADE_STARTER_TEMPLATES: GeneralTradeStarterTemplate[] = [
  // Sitework
  tpl('Sitework', 'Fine grading', 'SF', 1200, 'unitsPerLaborDay', 2),
  tpl('Sitework', 'Hand excavation', 'CY', 3, 'laborHoursPerUnit', 2),
  tpl('Sitework', 'Install silt fence', 'LF', 250, 'unitsPerLaborDay', 2),
  // Demolition
  tpl('Demolition', 'Interior selective demo', 'SF', 400, 'unitsPerLaborDay', 2),
  tpl('Demolition', 'Remove drywall', 'SF', 800, 'unitsPerLaborDay', 2),
  tpl('Demolition', 'Remove flooring', 'SF', 500, 'unitsPerLaborDay', 2),
  // Carpentry
  tpl('Carpentry', 'Rough blocking', 'LF', 200, 'unitsPerLaborDay', 2),
  tpl('Carpentry', 'Install plywood sheathing', 'SF', 600, 'unitsPerLaborDay', 2),
  tpl('Carpentry', 'Misc carpentry', 'HR', 1, 'unitsPerLaborHour', 1),
  // Framing
  tpl('Framing', 'Wood wall framing', 'LF', 100, 'unitsPerLaborDay', 3),
  tpl('Framing', 'Metal stud framing', 'LF', 120, 'unitsPerLaborDay', 3),
  tpl('Framing', 'Install roof trusses', 'EA', 10, 'unitsPerLaborDay', 4),
  // Drywall
  tpl('Drywall', 'Hang drywall', 'SF', 700, 'unitsPerLaborDay', 2),
  tpl('Drywall', 'Tape and finish drywall', 'SF', 450, 'unitsPerLaborDay', 2),
  tpl('Drywall', 'Patch drywall', 'EA', 1.5, 'laborHoursPerUnit', 1),
  // Painting
  tpl('Painting', 'Paint walls', 'SF', 900, 'unitsPerLaborDay', 2),
  tpl('Painting', 'Paint ceiling', 'SF', 700, 'unitsPerLaborDay', 2),
  tpl('Painting', 'Paint doors', 'EA', 0.75, 'laborHoursPerUnit', 1),
  // Flooring
  tpl('Flooring', 'Install LVP flooring', 'SF', 500, 'unitsPerLaborDay', 2),
  tpl('Flooring', 'Install ceramic tile', 'SF', 180, 'unitsPerLaborDay', 2),
  tpl('Flooring', 'Install carpet tile', 'SF', 700, 'unitsPerLaborDay', 2),
  // Masonry
  tpl('Masonry', 'CMU block wall', 'SF', 180, 'unitsPerLaborDay', 3),
  tpl('Masonry', 'Brick veneer', 'SF', 120, 'unitsPerLaborDay', 3),
  tpl('Masonry', 'Repoint masonry', 'SF', 80, 'unitsPerLaborDay', 2),
  // Roofing
  tpl('Roofing', 'Asphalt shingles', 'SQ', 10, 'unitsPerLaborDay', 4),
  tpl('Roofing', 'Metal roofing panels', 'SF', 900, 'unitsPerLaborDay', 3),
  tpl('Roofing', 'Roof demo', 'SQ', 15, 'unitsPerLaborDay', 3),
  // Plumbing
  tpl('Plumbing', 'Install toilet', 'EA', 1.5, 'laborHoursPerUnit', 1),
  tpl('Plumbing', 'Install sink', 'EA', 2, 'laborHoursPerUnit', 1),
  tpl('Plumbing', 'Rough-in water line', 'LF', 120, 'unitsPerLaborDay', 2),
  // Electrical
  tpl('Electrical', 'Install light fixture', 'EA', 1, 'laborHoursPerUnit', 1),
  tpl('Electrical', 'Install receptacle', 'EA', 0.75, 'laborHoursPerUnit', 1),
  tpl('Electrical', 'Pull branch circuit wire', 'LF', 500, 'unitsPerLaborDay', 2),
  // HVAC
  tpl('HVAC', 'Install ductwork', 'LF', 100, 'unitsPerLaborDay', 2),
  tpl('HVAC', 'Install register', 'EA', 0.5, 'laborHoursPerUnit', 1),
  tpl('HVAC', 'Install mini split', 'EA', 8, 'laborHoursPerUnit', 2),
  // Insulation
  tpl('Insulation', 'Batt insulation', 'SF', 1000, 'unitsPerLaborDay', 2),
  tpl('Insulation', 'Blown insulation', 'SF', 1500, 'unitsPerLaborDay', 2),
  tpl('Insulation', 'Rigid board insulation', 'SF', 600, 'unitsPerLaborDay', 2),
  // Doors / Windows
  tpl('Doors / Windows', 'Install interior door', 'EA', 2, 'laborHoursPerUnit', 1),
  tpl('Doors / Windows', 'Install exterior door', 'EA', 4, 'laborHoursPerUnit', 2),
  tpl('Doors / Windows', 'Install window', 'EA', 3, 'laborHoursPerUnit', 2),
  // Finish Carpentry
  tpl('Finish Carpentry', 'Install baseboard', 'LF', 250, 'unitsPerLaborDay', 1),
  tpl('Finish Carpentry', 'Install crown molding', 'LF', 120, 'unitsPerLaborDay', 1),
  tpl('Finish Carpentry', 'Install cabinets', 'LF', 30, 'unitsPerLaborDay', 2),
  // Landscaping
  tpl('Landscaping', 'Install sod', 'SF', 1500, 'unitsPerLaborDay', 3),
  tpl('Landscaping', 'Plant shrubs', 'EA', 30, 'unitsPerLaborDay', 2),
  tpl('Landscaping', 'Mulch beds', 'CY', 12, 'unitsPerLaborDay', 2),
  // General Labor
  tpl('General Labor', 'Cleanup', 'HR', 1, 'unitsPerLaborHour', 1),
  tpl('General Labor', 'Material handling', 'HR', 1, 'unitsPerLaborHour', 1),
  tpl('General Labor', 'Site protection', 'SF', 1000, 'unitsPerLaborDay', 2),
];

export function getTrades(): GeneralTrade[] {
  return [...GENERAL_TRADES];
}

export function getActivitiesForTrade(trade: GeneralTrade): string[] {
  return GENERAL_TRADE_STARTER_TEMPLATES.filter((t) => t.trade === trade).map(
    (t) => t.activity,
  );
}

export function findStarterTemplate(
  trade: GeneralTrade,
  activity: string,
): GeneralTradeStarterTemplate | undefined {
  return GENERAL_TRADE_STARTER_TEMPLATES.find(
    (t) => t.trade === trade && t.activity === activity,
  );
}
