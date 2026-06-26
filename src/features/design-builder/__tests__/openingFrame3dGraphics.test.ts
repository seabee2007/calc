import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import {
  createOpeningFrame3dGroup,
  FRAME_TRIM_METERS,
  groupHasRoughOpeningGuide,
  groupHasSelectionOutline,
  readOpeningFrameOutlineDimensionsFromGroup,
  resolveOpeningFrameCenterWorld,
  resolveOpeningFrame3dVisibility,
  resolveOpeningFrameOutlineDimensions,
  resolveRoughOpeningGuideDimensions,
  SELECTION_OUTLINE_COLOR,
  SELECTION_OUTLINE_EPSILON_METERS,
} from '../domain/openingFrame3dGraphics';

const wall = {
  lengthMeters: 12,
  widthMeters: 8,
  heightMeters: 2.8,
  wallThicknessMeters: 0.19,
  blockHeightMeters: 0.2,
  blockDepthMeters: 0.39,
  blockLengthMeters: 0.39,
  openings: [],
} as const;

function sampleDoorOpening(overrides: Partial<ResolvedCmuOpening> = {}): ResolvedCmuOpening {
  return {
    id: 'door-1',
    type: 'door',
    wallFace: 'south',
    actualWidthMeters: 0.9,
    actualHeightMeters: 2.1,
    actualAreaSquareMeters: 0.9 * 2.1,
    roughOpeningWidthMeters: 1.2,
    roughOpeningHeightMeters: 2.3,
    roughOpeningAreaSquareMeters: 1.2 * 2.3,
    roughStartAlongMeters: 4.85,
    roughEndAlongMeters: 6.05,
    roughBottomMeters: 0,
    roughTopMeters: 2.2,
    actualStartAlongMeters: 5,
    actualEndAlongMeters: 5.9,
    actualBottomMeters: 0,
    actualTopMeters: 2.1,
    lintelType: 'bond_beam',
    lintelBearingMeters: 0.2,
    lintelCourseCount: 1,
    lintelLengthMeters: 1.4,
    lintelHeightMeters: 0.2,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: 1,
    jambGroutCellCount: 2,
    groutCellsAboveOpening: 0,
    groutCellsBelowWindow: 0,
    openingFrameMaterial: 'none',
    ...overrides,
  };
}

describe('openingFrame3dGraphics', () => {
  it('selected door outline bounds match rendered frame bounds', () => {
    const opening = sampleDoorOpening();
    const group = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: true, showOpeningLayout: false });
    const expected = resolveOpeningFrameOutlineDimensions(opening, wall.wallThicknessMeters);
    const outline = readOpeningFrameOutlineDimensionsFromGroup(group);

    expect(outline).not.toBeNull();
    expect(outline!.widthMeters).toBeCloseTo(expected.widthMeters + SELECTION_OUTLINE_EPSILON_METERS * 2, 6);
    expect(outline!.heightMeters).toBeCloseTo(expected.heightMeters + SELECTION_OUTLINE_EPSILON_METERS * 2, 6);
    expect(outline!.depthMeters).toBeCloseTo(expected.depthMeters + SELECTION_OUTLINE_EPSILON_METERS * 2, 6);
  });

  it('selected window outline bounds match rendered frame bounds', () => {
    const opening = sampleDoorOpening({
      id: 'window-1',
      type: 'window',
      actualWidthMeters: 1.2,
      actualHeightMeters: 1.0,
      roughOpeningWidthMeters: 1.3,
      roughOpeningHeightMeters: 1.1,
      actualBottomMeters: 0.9,
      roughBottomMeters: 0.85,
    });
    const group = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: true, showOpeningLayout: false });
    const expected = resolveOpeningFrameOutlineDimensions(opening, wall.wallThicknessMeters);
    const outline = readOpeningFrameOutlineDimensionsFromGroup(group);

    expect(outline!.widthMeters).toBeCloseTo(expected.widthMeters + SELECTION_OUTLINE_EPSILON_METERS * 2, 6);
    expect(outline!.heightMeters).toBeCloseTo(expected.heightMeters + SELECTION_OUTLINE_EPSILON_METERS * 2, 6);
  });

  it('rough-opening dimensions do not determine the normal teal selection outline', () => {
    const opening = sampleDoorOpening();
    const frameOutline = resolveOpeningFrameOutlineDimensions(opening, wall.wallThicknessMeters);
    const roughGuide = resolveRoughOpeningGuideDimensions(opening, wall.wallThicknessMeters);

    expect(frameOutline.widthMeters).toBeCloseTo(opening.actualWidthMeters + FRAME_TRIM_METERS * 2, 6);
    expect(frameOutline.heightMeters).toBeCloseTo(opening.actualHeightMeters + FRAME_TRIM_METERS * 2, 6);
    expect(frameOutline.widthMeters).not.toBeCloseTo(roughGuide.widthMeters, 2);
    expect(frameOutline.heightMeters).not.toBeCloseTo(roughGuide.heightMeters, 2);
    expect(roughGuide.widthMeters).toBeGreaterThan(opening.actualWidthMeters);
  });

  it('applies host infill centerline offset to frame world center', () => {
    const opening = sampleDoorOpening();
    const center = resolveOpeningFrameCenterWorld(opening, {
      centerlineStart: { x: 0, z: 0 },
      tangent: { x: 1, z: 0 },
      inwardNormal: { x: 0, z: 1 },
      infillCenterlineInwardOffsetMeters: -0.015,
    });

    expect(center.x).toBeCloseTo((opening.actualStartAlongMeters + opening.actualEndAlongMeters) / 2, 6);
    expect(center.z).toBeCloseTo(-0.015, 6);
  });

  it('deselecting removes the teal outline', () => {
    const opening = sampleDoorOpening();
    const selected = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: true });
    const deselected = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: false });

    expect(groupHasSelectionOutline(selected)).toBe(true);
    expect(groupHasSelectionOutline(deselected)).toBe(false);
  });

  it('selecting a different object removes the prior opening outline', () => {
    const opening = sampleDoorOpening();
    const selected = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: true });
    const unselected = createOpeningFrame3dGroup(opening, wall, 0.1, { selected: false });

    expect(groupHasSelectionOutline(selected)).toBe(true);
    expect(groupHasSelectionOutline(unselected)).toBe(false);
  });

  it('rough-opening guide is hidden by default in 3D', () => {
    const opening = sampleDoorOpening();
    const group = createOpeningFrame3dGroup(opening, wall, 0.1, {
      selected: true,
      showOpeningLayout: false,
    });

    expect(groupHasRoughOpeningGuide(group)).toBe(false);
  });

  it('rough-opening guide appears only when Show opening layout is enabled and opening is selected or hovered', () => {
    const opening = sampleDoorOpening();
    const hidden = createOpeningFrame3dGroup(opening, wall, 0.1, {
      selected: true,
      showOpeningLayout: false,
    });
    const selectedGuide = createOpeningFrame3dGroup(opening, wall, 0.1, {
      selected: true,
      showOpeningLayout: true,
    });
    const hoveredGuide = createOpeningFrame3dGroup(opening, wall, 0.1, {
      hovered: true,
      showOpeningLayout: true,
    });
    const idle = createOpeningFrame3dGroup(opening, wall, 0.1, {
      showOpeningLayout: true,
    });

    expect(groupHasRoughOpeningGuide(hidden)).toBe(false);
    expect(groupHasRoughOpeningGuide(selectedGuide)).toBe(true);
    expect(groupHasRoughOpeningGuide(hoveredGuide)).toBe(true);
    expect(groupHasRoughOpeningGuide(idle)).toBe(false);
  });

  it('rough-opening guide uses amber styling, not teal', () => {
    const opening = sampleDoorOpening();
    const group = createOpeningFrame3dGroup(opening, wall, 0.1, {
      selected: true,
      showOpeningLayout: true,
    });
    const guide = group.children.find((child) => child.userData.openingRoughOpeningGuide) as THREE.LineSegments;
    const outline = group.children.find((child) => child.userData.openingSelectionOutline) as THREE.LineSegments;

    expect(guide).toBeTruthy();
    expect(outline).toBeTruthy();
    expect((guide.material as THREE.LineDashedMaterial).color.getHex()).toBe(0xf59e0b);
    expect((outline.material as THREE.LineBasicMaterial).color.getHex()).toBe(SELECTION_OUTLINE_COLOR);
  });

  it('visibility policy keeps frame meshes always visible in normal view', () => {
    expect(
      resolveOpeningFrame3dVisibility({
        selected: false,
        hovered: false,
        preview: false,
        showOpeningLayout: false,
      }),
    ).toEqual({
      showFrameMeshes: true,
      showSelectionOutline: false,
      showHoverOutline: false,
      showRoughOpeningGuide: false,
    });
  });

  it('preview ghost always shows frame meshes and selection outline on top', () => {
    const opening = sampleDoorOpening();
    const group = createOpeningFrame3dGroup(opening, wall, 0.1, {
      preview: true,
      valid: true,
      showOpeningLayout: false,
    });

    expect(
      resolveOpeningFrame3dVisibility({
        selected: false,
        hovered: false,
        preview: true,
        showOpeningLayout: false,
      }),
    ).toEqual({
      showFrameMeshes: true,
      showSelectionOutline: true,
      showHoverOutline: false,
      showRoughOpeningGuide: false,
    });
    expect(group.renderOrder).toBe(10);
    expect(groupHasSelectionOutline(group)).toBe(true);

    const frameMesh = group.children
      .flatMap((child) => (child instanceof THREE.Group ? child.children : [child]))
      .find((child) => child instanceof THREE.Mesh) as THREE.Mesh | undefined;
    expect(frameMesh).toBeTruthy();
    expect((frameMesh!.material as THREE.MeshStandardMaterial).depthTest).toBe(false);
    expect((frameMesh!.material as THREE.MeshStandardMaterial).depthWrite).toBe(false);
  });
});
