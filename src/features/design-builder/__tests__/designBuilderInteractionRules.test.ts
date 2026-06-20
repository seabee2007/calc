import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  clampOpeningToWall,
  createOpeningDraft,
  projectHitToWallOffset,
  resolveWallFaceFromHit,
  snapOffsetToModule,
  summarizeOpeningPlacementStatus,
  validateOpeningPlacement,
} from '../domain/designBuilderInteractionRules';
import { generateCmuLayout } from '../geometry/designGeometry';

describe('designBuilderInteractionRules', () => {
  const preset = createFiveBySixCmuBuildingPreset();

  it('resolves wall face from hit userData', () => {
    expect(resolveWallFaceFromHit({ wallFace: 'south' })).toBe('south');
    expect(resolveWallFaceFromHit({ wallFace: 'invalid' })).toBeNull();
    expect(resolveWallFaceFromHit(undefined)).toBeNull();
  });

  it('projects hit point to position along wall', () => {
    expect(projectHitToWallOffset('south', { x: 0, y: 0, z: 2.5 }, preset.wall)).toBeCloseTo(3, 6);
    expect(projectHitToWallOffset('east', { x: 3, y: 0, z: 0 }, preset.wall)).toBeCloseTo(2.5, 6);
  });

  it('clamps opening offset within wall length', () => {
    expect(clampOpeningToWall({ wallFace: 'south', offsetMeters: 10, widthMeters: 0.9 }, preset.wall)).toBeCloseTo(5.1, 6);
    expect(clampOpeningToWall({ wallFace: 'south', offsetMeters: -1, widthMeters: 0.9 }, preset.wall)).toBe(0);
  });

  it('creates door and window opening drafts', () => {
    const door = createOpeningDraft('door', 'south', 2.4, preset.wall, 'door-test');
    const window = createOpeningDraft('window', 'east', 2.1, preset.wall, 'window-test');

    expect(door.type).toBe('door');
    expect(door.id).toBe('door-test');
    expect(window.type).toBe('window');
    expect(window.sillHeightMeters).toBe(1);
  });

  it('snaps offset to CMU module grid', () => {
    const snapped = snapOffsetToModule(2.35, 0.9, preset.wall, 'south');
    expect(snapped).toBeCloseTo(2.4, 6);
  });

  it('detects invalid overlap between openings', () => {
    const opening = preset.wall.openings[0];
    const overlapping = {
      ...opening,
      id: 'overlap-test',
      offsetMeters: preset.wall.openings[1].offsetMeters,
    };
    const validation = validateOpeningPlacement(overlapping, preset.wall);
    expect(validation.isValid).toBe(false);
    expect(validation.warnings.some((warning) => /overlap/i.test(warning))).toBe(true);
  });

  it('summarizes clean vs cut-block jamb status from layout engine', () => {
    const clean = summarizeOpeningPlacementStatus(preset.wall.openings[0], preset.wall);
    expect(['clean', 'half_block', 'cut_block']).toContain(clean.kind);

    const awkward = summarizeOpeningPlacementStatus(
      { ...preset.wall.openings[0], offsetMeters: 2.37 },
      preset.wall,
    );
    expect(awkward.label.length).toBeGreaterThan(0);
  });

  it('moving opening changes jamb closure layout and grout quantities', () => {
    const baseLayout = generateCmuLayout(preset.wall);
    const doorId = preset.wall.openings.find((opening) => opening.type === 'door')?.id;
    const movedWall = {
      ...preset.wall,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'door' ? { ...opening, offsetMeters: 1.0 } : opening,
      ),
    };
    const movedLayout = generateCmuLayout(movedWall);
    const beforeCells = baseLayout.jambGroutCells.filter((cell) => cell.openingId === doorId);
    const afterCells = movedLayout.jambGroutCells.filter((cell) => cell.openingId === doorId);

    expect(movedLayout.openingCourseClosures.length).toBe(baseLayout.openingCourseClosures.length);
    expect(beforeCells.length).toBeGreaterThan(0);
    expect(afterCells.some((cell, index) => cell.x !== beforeCells[index]?.x || cell.z !== beforeCells[index]?.z)).toBe(true);
  });
});
