import type { RightTriangleModuleInput, RightTriangleModuleOutput } from '../constructionCalculatorTypes';
import {
  degreesFromPitch,
  pitchFromRiseRun,
} from '../constructionDimensionMath';
import { sanitizeFinite } from '../constructionCalculatorValidators';

export function calculateRightTriangle(input: RightTriangleModuleInput): RightTriangleModuleOutput | null {
  let rise = input.riseInches;
  let run = input.runInches;
  let diagonal = input.diagonalInches;
  let angle = input.angleDegrees;
  let pitchRise = input.pitchRise;
  let pitchRun = input.pitchRun ?? 12;

  const known = countKnown({ rise, run, diagonal, angle, pitchRise, pitchRun });

  if (known < 2 && !(pitchRise !== undefined && pitchRun !== undefined)) return null;

  if (pitchRise !== undefined && pitchRun !== undefined && rise === undefined && run === undefined) {
    run = 12;
    rise = pitchRise;
  }

  if (angle !== undefined && rise === undefined && run === undefined) {
    const rad = (angle * Math.PI) / 180;
    run = 12;
    rise = Math.tan(rad) * run;
  }

  if (rise !== undefined && run !== undefined) {
    diagonal = Math.sqrt(rise * rise + run * run);
  } else if (rise !== undefined && diagonal !== undefined) {
    run = Math.sqrt(diagonal * diagonal - rise * rise);
  } else if (run !== undefined && diagonal !== undefined) {
    rise = Math.sqrt(diagonal * diagonal - run * run);
  } else if (rise !== undefined && angle !== undefined) {
    run = rise / Math.tan((angle * Math.PI) / 180);
    diagonal = Math.sqrt(rise * rise + run * run);
  } else if (run !== undefined && angle !== undefined) {
    rise = run * Math.tan((angle * Math.PI) / 180);
    diagonal = Math.sqrt(rise * rise + run * run);
  }

  rise = sanitizeFinite(rise ?? 0);
  run = sanitizeFinite(run ?? 0);
  diagonal = sanitizeFinite(diagonal ?? Math.sqrt(rise * rise + run * run));
  const pitch = pitchFromRiseRun(rise, run);
  const angleDegrees = angle ?? degreesFromPitch(rise, run);

  return {
    riseInches: round4(rise),
    runInches: round4(run),
    diagonalInches: round4(diagonal),
    pitchRise: pitch.rise,
    pitchRun: pitch.run,
    angleDegrees: round4(angleDegrees),
    commonRafterLengthInches: round4(diagonal),
  };
}

function countKnown(values: Record<string, number | undefined>): number {
  return Object.values(values).filter((v) => v !== undefined && Number.isFinite(v)).length;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
