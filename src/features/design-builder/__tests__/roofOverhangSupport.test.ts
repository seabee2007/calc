import { describe, expect, it } from 'vitest';
import {
  claddingEaveElevationMeters,
  claddingHorizontalRunMeters,
  gableEndOutwardNormal2D,
  resolveCladdingPerimeterWithOverhangs,
  resolveEaveRunExtensionMeters,
  resolveFixedRoofPitch,
} from '../domain/roofOverhangSupport';
import { resolveGableRoofEdgeOffsets } from '../domain/roofFootprintSupport';

describe('roof overhang geometry', () => {
  const bearing = [
    { x: -3, z: -2.5 },
    { x: 3, z: -2.5 },
    { x: 3, z: 2.5 },
    { x: -3, z: 2.5 },
  ];

  it('applies eave and gable-end overhangs independently on perpendicular edges', () => {
    const cladding = resolveCladdingPerimeterWithOverhangs({
      bearingPerimeter: bearing,
      ridgeAxis: 'localX',
      eaveOverhangMeters: 0.5,
      gableEndOverhangMeters: 1,
    });
    expect(cladding[0]!.x).toBeCloseTo(-4, 3);
    expect(cladding[0]!.z).toBeCloseTo(-3, 3);
    expect(cladding[1]!.x).toBeCloseTo(4, 3);
    expect(cladding[1]!.z).toBeCloseTo(-3, 3);
  });

  it('extends rafter run horizontally at fixed pitch for side eave overhang', () => {
    const extension = resolveEaveRunExtensionMeters({
      bearingHalfRunMeters: 2.5,
      rafterRiseMeters: 1,
      eaveOverhangMeters: 0.5,
    });
    expect(extension).toBeCloseTo(0.5, 3);
  });

  it('keeps pitch and lowers cladding eave per the side-eave acceptance example', () => {
    const structuralHalfRunMeters = 3;
    const structuralRiseMeters = 1.5;
    const sideEaveOverhangMeters = 0.6;
    const structuralEaveY = 10;
    const pitch = resolveFixedRoofPitch({ structuralHalfRunMeters, structuralRiseMeters });
    expect(pitch.pitchRadians).toBeCloseTo(Math.atan2(1.5, 3), 6);
    expect(claddingHorizontalRunMeters({ structuralHalfRunMeters, sideEaveOverhangMeters })).toBeCloseTo(3.6, 3);
    expect(
      claddingEaveElevationMeters({
        structuralEaveY,
        fixedSlope: pitch.slope,
        sideEaveOverhangMeters,
      }),
    ).toBeCloseTo(structuralEaveY - Math.tan(pitch.pitchRadians) * 0.6, 3);
  });

  it('classifies long edges as eave sides when ridge runs along the long axis', () => {
    const offsets = resolveGableRoofEdgeOffsets({
      bearing,
      ridgeAxis: 'localX',
      eaveOverhangMeters: 0.5,
      gableEndOverhangMeters: 1,
    });
    expect(offsets).toEqual([0.5, 1, 0.5, 1]);
  });

  it('uses outward gable normals perpendicular to the gable wall face', () => {
    const startNormal = gableEndOutwardNormal2D({ bearing, ridgeAxis: 'localX', atStartGable: true });
    const endNormal = gableEndOutwardNormal2D({ bearing, ridgeAxis: 'localX', atStartGable: false });
    expect(startNormal.x).toBeCloseTo(-1, 3);
    expect(endNormal.x).toBeCloseTo(1, 3);
    expect(startNormal.z).toBeCloseTo(0, 3);
    expect(endNormal.z).toBeCloseTo(0, 3);
  });
});
