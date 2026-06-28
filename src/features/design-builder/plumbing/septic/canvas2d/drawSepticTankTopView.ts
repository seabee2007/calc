import { calculateSepticCapacity } from '../septicCapacity';
import { localToWorld, septicOuterDimensions, sideLocalPoint } from '../septicGeometry';
import type { SepticPoint2D } from '../septicGeometry';
import type { SepticTankModel } from '../septicTypes';

export type SepticTopViewPrimitive =
  | { kind: 'polygon'; id: string; points: SepticPoint2D[] }
  | { kind: 'line'; id: string; start: SepticPoint2D; end: SepticPoint2D }
  | { kind: 'point'; id: string; point: SepticPoint2D; role: 'inlet' | 'outlet' | 'access' }
  | { kind: 'label'; id: string; point: SepticPoint2D; text: string };

export function drawSepticTankTopView(tank: SepticTankModel): SepticTopViewPrimitive[] {
  const outer = septicOuterDimensions(tank);
  const hx = outer.length / 2;
  const hz = outer.width / 2;
  const wall = tank.geometry.wallThicknessM;
  const innerHx = tank.geometry.insideLengthM / 2;
  const innerHz = tank.geometry.insideWidthM / 2;
  const baffleX = -innerHx + tank.geometry.insideLengthM * tank.geometry.firstCompartmentRatio;
  const firstAccessX = -innerHx + tank.geometry.insideLengthM * tank.geometry.firstCompartmentRatio * 0.5;
  const secondAccessX = baffleX + (innerHx - baffleX) * 0.5;
  const accessHalfL = tank.geometry.accessOpeningLengthM / 2;
  const accessHalfW = tank.geometry.accessOpeningWidthM / 2;
  const accessPolygon = (centerX: number, id: string): SepticTopViewPrimitive => ({
    kind: 'polygon',
    id,
    points: [
      localToWorld(tank, { x: centerX - accessHalfL, z: -accessHalfW }),
      localToWorld(tank, { x: centerX + accessHalfL, z: -accessHalfW }),
      localToWorld(tank, { x: centerX + accessHalfL, z: accessHalfW }),
      localToWorld(tank, { x: centerX - accessHalfL, z: accessHalfW }),
    ],
  });
  const capacity = calculateSepticCapacity(tank);
  return [
    {
      kind: 'polygon',
      id: `${tank.id}:outer`,
      points: [
        localToWorld(tank, { x: -hx, z: -hz }),
        localToWorld(tank, { x: hx, z: -hz }),
        localToWorld(tank, { x: hx, z: hz }),
        localToWorld(tank, { x: -hx, z: hz }),
      ],
    },
    {
      kind: 'polygon',
      id: `${tank.id}:inner`,
      points: [
        localToWorld(tank, { x: -hx + wall, z: -hz + wall }),
        localToWorld(tank, { x: hx - wall, z: -hz + wall }),
        localToWorld(tank, { x: hx - wall, z: hz - wall }),
        localToWorld(tank, { x: -hx + wall, z: hz - wall }),
      ],
    },
    {
      kind: 'line',
      id: `${tank.id}:baffle`,
      start: localToWorld(tank, { x: baffleX, z: -innerHz }),
      end: localToWorld(tank, { x: baffleX, z: innerHz }),
    },
    {
      kind: 'line',
      id: `${tank.id}:flow-arrow`,
      start: localToWorld(tank, { x: -innerHx * 0.8, z: 0 }),
      end: localToWorld(tank, { x: innerHx * 0.8, z: 0 }),
    },
    { kind: 'point', id: `${tank.id}:inlet`, point: localToWorld(tank, sideLocalPoint(tank, tank.inletSide)), role: 'inlet' },
    { kind: 'point', id: `${tank.id}:outlet`, point: localToWorld(tank, sideLocalPoint(tank, tank.outletSide)), role: 'outlet' },
    accessPolygon(firstAccessX, `${tank.id}:access-1`),
    accessPolygon(secondAccessX, `${tank.id}:access-2`),
    { kind: 'point', id: `${tank.id}:access-node-1`, point: localToWorld(tank, { x: firstAccessX, z: 0 }), role: 'access' },
    { kind: 'point', id: `${tank.id}:access-node-2`, point: localToWorld(tank, { x: secondAccessX, z: 0 }), role: 'access' },
    ...(tank.labelVisible
      ? [
          {
            kind: 'label' as const,
            id: `${tank.id}:label`,
            point: localToWorld(tank, { x: 0, z: hz + 0.35 }),
            text: `${tank.mark} CMU SEPTIC TANK`,
          },
          {
            kind: 'label' as const,
            id: `${tank.id}:capacity`,
            point: localToWorld(tank, { x: 0, z: hz + 0.62 }),
            text: `${tank.designBasis.capacityGallons} GAL / ${tank.designBasis.capacityM3.toFixed(2)} m3 / ${tank.designBasis.bedroomsAssumed}BR ASSUMED / TOP = ${tank.placement.topSlabTopElevationM.toFixed(2)}m`,
          },
          {
            kind: 'label' as const,
            id: `${tank.id}:computed-capacity`,
            point: localToWorld(tank, { x: 0, z: hz + 0.88 }),
            text: `Liquid volume ${capacity.liquidVolumeGallons.toFixed(0)} gal`,
          },
        ]
      : []),
  ];
}

