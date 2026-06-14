import type { BoardFeetModuleInput, BoardFeetModuleOutput } from '../constructionCalculatorTypes';
import { calculateBoardFeet } from '../constructionDimensionMath';
import { sanitizeNonNegative } from '../constructionCalculatorValidators';

export function calculateBoardFeetModule(input: BoardFeetModuleInput): BoardFeetModuleOutput {
  const thickness = sanitizeNonNegative(input.thicknessInches);
  const width = sanitizeNonNegative(input.widthInches);
  const lengthFeet = sanitizeNonNegative(input.lengthFeet);
  const boardFeet = calculateBoardFeet(thickness, width, lengthFeet);
  return { boardFeet: Math.round(boardFeet * 100) / 100 };
}
