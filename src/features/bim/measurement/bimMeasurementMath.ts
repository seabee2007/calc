import type { BimMeasurementMode, BimModelUnit } from '../types';

export interface MeasurementPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface BimMeasurementResult {
  mode: Exclude<BimMeasurementMode, 'off'>;
  points: MeasurementPoint3D[];
  closed: boolean;
  totalLength: number;
  area: number | null;
  perimeter: number | null;
  unit: 'LF' | 'SF';
  quantity: number;
  modelUnit: BimModelUnit;
  scaleConfirmed: boolean;
  calibrationScaleFactor: number;
  calibrated: boolean;
  approximate: boolean;
}

export type CalibrationDistanceUnit = 'feet' | 'inches' | 'meters';

export interface BimScaleCalibration {
  scaleFactor: number;
  knownDistance: number;
  knownDistanceUnit: CalibrationDistanceUnit;
  knownDistanceFeet: number;
  rawDistance: number;
  rawDistanceFeet: number;
  calibratedAt: string;
}

export function convertModelUnitsToFeet(unit: BimModelUnit): number {
  switch (unit) {
    case 'feet':
      return 1;
    case 'inches':
      return 1 / 12;
    case 'millimeters':
      return 0.00328084;
    case 'meters':
    default:
      return 3.28084;
  }
}

export function convertCalibrationDistanceToFeet(value: number, unit: CalibrationDistanceUnit): number {
  switch (unit) {
    case 'inches':
      return value / 12;
    case 'meters':
      return value * 3.28084;
    case 'feet':
    default:
      return value;
  }
}

export function calculateCalibrationScaleFactor(params: {
  knownDistance: number;
  knownDistanceUnit: CalibrationDistanceUnit;
  rawModelDistance: number;
  modelUnit: BimModelUnit;
}): BimScaleCalibration | null {
  const knownDistanceFeet = convertCalibrationDistanceToFeet(
    params.knownDistance,
    params.knownDistanceUnit,
  );
  const rawDistanceFeet = params.rawModelDistance * convertModelUnitsToFeet(params.modelUnit);
  if (knownDistanceFeet <= 0 || rawDistanceFeet <= 0) return null;

  return {
    scaleFactor: knownDistanceFeet / rawDistanceFeet,
    knownDistance: params.knownDistance,
    knownDistanceUnit: params.knownDistanceUnit,
    knownDistanceFeet,
    rawDistance: params.rawModelDistance,
    rawDistanceFeet,
    calibratedAt: new Date().toISOString(),
  };
}

function distance(a: MeasurementPoint3D, b: MeasurementPoint3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function calculatePolylineLength(points: readonly MeasurementPoint3D[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

export function calculatePolygonArea3D(points: readonly MeasurementPoint3D[]): number {
  if (points.length < 3) return 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    x += (current.y - next.y) * (current.z + next.z);
    y += (current.z - next.z) * (current.x + next.x);
    z += (current.x - next.x) * (current.y + next.y);
  }
  return 0.5 * Math.hypot(x, y, z);
}

export function calculatePlanarityDeviation(points: readonly MeasurementPoint3D[]): number {
  if (points.length < 4) return 0;
  const [a, b, c] = points;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const normal = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  const normalLength = Math.hypot(normal.x, normal.y, normal.z);
  if (normalLength === 0) return 0;
  let maxDeviation = 0;
  for (const point of points.slice(3)) {
    const ap = { x: point.x - a.x, y: point.y - a.y, z: point.z - a.z };
    const deviation = Math.abs(
      (ap.x * normal.x + ap.y * normal.y + ap.z * normal.z) / normalLength,
    );
    maxDeviation = Math.max(maxDeviation, deviation);
  }
  return maxDeviation;
}

export function roundMeasurement(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMeasurementResult(params: {
  mode: Exclude<BimMeasurementMode, 'off'>;
  points: MeasurementPoint3D[];
  closed: boolean;
  modelUnit: BimModelUnit;
  scaleConfirmed: boolean;
  calibrationScaleFactor?: number;
  calibrated?: boolean;
}): BimMeasurementResult {
  const calibrationScaleFactor = params.calibrationScaleFactor ?? 1;
  const calibrated = Boolean(params.calibrated);
  const feetFactor = convertModelUnitsToFeet(params.modelUnit) * calibrationScaleFactor;
  const worldLength = calculatePolylineLength(params.points);
  const totalLength = roundMeasurement(worldLength * feetFactor);

  if (params.mode === 'line') {
    return {
      mode: 'line',
      points: params.points,
      closed: false,
      totalLength,
      area: null,
      perimeter: null,
      unit: 'LF',
      quantity: totalLength,
      modelUnit: params.modelUnit,
      scaleConfirmed: params.scaleConfirmed,
      calibrationScaleFactor,
      calibrated,
      approximate: false,
    };
  }

  const perimeterWorld =
    params.closed && params.points.length >= 3
      ? worldLength + distance(params.points[params.points.length - 1], params.points[0])
      : worldLength;
  const areaWorld = params.closed ? calculatePolygonArea3D(params.points) : 0;
  const area = params.closed ? roundMeasurement(areaWorld * feetFactor * feetFactor) : null;

  return {
    mode: 'area',
    points: params.points,
    closed: params.closed,
    totalLength,
    area,
    perimeter: params.closed ? roundMeasurement(perimeterWorld * feetFactor) : null,
    unit: 'SF',
    quantity: area ?? 0,
    modelUnit: params.modelUnit,
    scaleConfirmed: params.scaleConfirmed,
    calibrationScaleFactor,
    calibrated,
    approximate: calculatePlanarityDeviation(params.points) > 0.05,
  };
}
