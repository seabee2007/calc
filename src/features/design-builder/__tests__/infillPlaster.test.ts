import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset, type CmuBuildingPreset } from '../domain/designBuilderPreset';
import { buildInfillWallProxyPieces, normalizeCmuInfillSystem, resolveInfillPlasterPanelPlacements, totalInfillPlasterAreaSquareMeters } from '../domain/infillPlaster';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview, squareMetersToSquareFeet } from '../quantity/designQuantityFormulas';

function frameGeometryForPreset(preset: CmuBuildingPreset) {
  return generateDesignGeometry(
    buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      roofSystem: preset.roofSystem,
    }),
  );
}

function framePreviewForPreset(preset: CmuBuildingPreset) {
  const geometry = frameGeometryForPreset(preset);
  return {
    geometry,
    lines: buildFrameInfillEstimatePreview({
      designModelId: 'model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem: preset.roofSystem,
    }),
  };
}

describe('infill plaster', () => {
  it('normalizes legacy infill systems with plaster enabled by default', () => {
    const normalized = normalizeCmuInfillSystem({ kind: 'cmu_infill_system', panels: [] });
    expect(normalized.plaster.enabled).toBe(true);
    expect(normalized.plaster.finish).toBe('textured');
    expect(normalized.plaster.profileLabel).toBe('3-coat plaster');
    expect(normalized.plaster.interiorEnabled).toBe(true);
    expect(normalized.plaster.interiorFinish).toBe('smooth');
    expect(normalized.plaster.interiorProfileLabel).toBe('3-coat plaster');
  });

  it('preserves disabled plaster and normalizes smooth finish', () => {
    const normalized = normalizeCmuInfillSystem({
      kind: 'cmu_infill_system',
      panels: [],
      plaster: {
        enabled: false,
        finish: 'smooth',
        profileLabel: '',
        interiorEnabled: false,
        interiorFinish: 'textured',
        interiorProfileLabel: '',
      },
    });
    expect(normalized.plaster.enabled).toBe(false);
    expect(normalized.plaster.finish).toBe('smooth');
    expect(normalized.plaster.profileLabel).toBe('3-coat plaster');
    expect(normalized.plaster.interiorEnabled).toBe(false);
    expect(normalized.plaster.interiorFinish).toBe('textured');
    expect(normalized.plaster.interiorProfileLabel).toBe('3-coat plaster');
  });

  it('creates positive exterior plaster placements clipped around openings', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const grossArea = (geometry.resolvedInfillPanelBounds ?? []).reduce(
      (sum, bounds) => sum + bounds.clearWidthMeters * bounds.clearHeightMeters,
      0,
    );

    const exteriorPlacements = placements.filter((placement) => placement.side === 'exterior');
    const interiorPlacements = placements.filter((placement) => placement.side === 'interior');

    expect(exteriorPlacements.length).toBeGreaterThan((geometry.resolvedInfillPanelBounds ?? []).length);
    expect(interiorPlacements.length).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(exteriorPlacements)).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(interiorPlacements)).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(interiorPlacements.filter((placement) => placement.surfaceKind === 'field'))).toBeLessThan(grossArea);
    expect(interiorPlacements.every((placement) => placement.finish === 'smooth')).toBe(true);
    expect(placements.every((placement) => placement.areaSquareMeters > 0)).toBe(true);
  });

  it('wraps plaster onto both vertical panel edge returns', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const panelBounds = geometry.resolvedInfillPanelBounds ?? [];
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds,
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const returnPlacements = placements.filter(
      (placement) => placement.surfaceKind === 'left_return' || placement.surfaceKind === 'right_return',
    );
    const panelIds = panelBounds
      .map((bounds) => bounds.panelId)
      .filter((panelId) => !panelId.includes('-below-'));

    expect(returnPlacements).toHaveLength(panelIds.length * 2);
    expect(returnPlacements.every((placement) => placement.side === 'exterior')).toBe(true);
    panelIds.forEach((panelId) => {
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'left_return')).toBe(true);
      expect(returnPlacements.some((placement) => placement.panelId === panelId && placement.surfaceKind === 'right_return')).toBe(true);
    });
    expect(returnPlacements.every((placement) => placement.widthMeters > preset.wall.wallThicknessMeters)).toBe(true);
  });

  it('covers rough opening reveal with field plaster up to the door frame edge', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters,
    );
    expect(opening).toBeDefined();
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const openingReturnPlacements = placements.filter((placement) =>
      placement.surfaceKind.startsWith('opening_'),
    );
    const exteriorFieldPlacements = placements.filter(
      (placement) => placement.side === 'exterior' && placement.surfaceKind === 'field',
    );
    const interiorFieldPlacements = placements.filter(
      (placement) => placement.side === 'interior' && placement.surfaceKind === 'field',
    );

    expect(openingReturnPlacements).toHaveLength(0);
    expect(exteriorFieldPlacements.length).toBeGreaterThan(0);
    expect(interiorFieldPlacements.length).toBeGreaterThan(0);

    const bounds = (geometry.resolvedInfillPanelBounds ?? []).find(
      (candidate) => candidate.hostSegmentId === opening!.wallSegmentId,
    );
    expect(bounds).toBeDefined();

    const fieldEdgeNearOpening = (
      side: 'exterior' | 'interior',
      edge: 'left' | 'right',
    ) =>
      placements
        .filter(
          (placement) =>
            placement.hostSegmentId === opening!.wallSegmentId &&
            placement.side === side &&
            placement.surfaceKind === 'field',
        )
        .map((placement) => {
          const centerStation =
            (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
            (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
          const start = centerStation - placement.widthMeters / 2;
          const end = centerStation + placement.widthMeters / 2;
          const bottom = placement.center.y - placement.heightMeters / 2;
          const top = placement.center.y + placement.heightMeters / 2;
          if (bottom >= opening!.actualTopMeters || top <= opening!.actualBottomMeters) return null;
          if (edge === 'left' && end <= opening!.actualStartAlongMeters + 0.001) return end;
          if (edge === 'right' && start >= opening!.actualEndAlongMeters - 0.001) return start;
          return null;
        })
        .filter((station): station is number => station != null)
        .sort((left, right) => (edge === 'left' ? right - left : left - right))[0];

    expect(fieldEdgeNearOpening('exterior', 'left')).toBeCloseTo(opening!.actualStartAlongMeters, 3);
    expect(fieldEdgeNearOpening('exterior', 'right')).toBeCloseTo(opening!.actualEndAlongMeters, 3);
    expect(fieldEdgeNearOpening('interior', 'left')).toBeCloseTo(opening!.actualStartAlongMeters, 3);
    expect(fieldEdgeNearOpening('interior', 'right')).toBeCloseTo(opening!.actualEndAlongMeters, 3);
    expect(fieldEdgeNearOpening('exterior', 'left')).toBeGreaterThan(opening!.roughStartAlongMeters + 0.01);
  });

  it('keeps field plaster on both sides when actual door edge is near the rough opening end', () => {
    const hostSegmentId = 'segment-test';
    const bounds = {
      panelId: 'infill-segment-test-0',
      hostSegmentId,
      startStationMeters: 0,
      endStationMeters: 5,
      clearWidthMeters: 5,
      bottomElevationMeters: 0,
      topElevationMeters: 2.8,
      clearHeightMeters: 2.8,
      hostWallCenterlineStart: { x: 0, y: 0, z: 0 },
      hostWallCenterlineEnd: { x: 5, y: 0, z: 0 },
      tangent: { x: 1, y: 0, z: 0 },
      outwardNormal: { x: 0, y: 0, z: 1 },
      inwardNormal: { x: 0, y: 0, z: -1 },
      leftSupportInsideFaceWorld: { x: 0, y: 0, z: 0 },
      rightSupportInsideFaceWorld: { x: 5, y: 0, z: 0 },
      leftSupportInsideFaceStation: 0,
      rightSupportInsideFaceStation: 5,
    };
    const opening = {
      id: 'door-test',
      type: 'door' as const,
      wallSegmentId: hostSegmentId,
      roughStartAlongMeters: 1.56,
      roughEndAlongMeters: 2.73,
      actualStartAlongMeters: 1.713,
      actualEndAlongMeters: 2.688,
      roughBottomMeters: 0,
      roughTopMeters: 2.1,
      actualBottomMeters: 0,
      actualTopMeters: 2.1,
      roughOpeningWidthMeters: 1.17,
      roughOpeningHeightMeters: 2.1,
      actualWidthMeters: 0.975,
      actualHeightMeters: 2.1,
    };
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: normalizeCmuInfillSystem({
        kind: 'cmu_infill_system',
        panels: [{ id: bounds.panelId, hostSegmentId, infillZone: 'above_grade' as const }],
      }),
      panelBounds: [bounds],
      openings: [opening],
      wallThicknessMeters: 0.19,
    });
    const rightFieldEdge = placements
      .filter(
        (placement) =>
          placement.side === 'exterior' &&
          placement.surfaceKind === 'field' &&
          placement.hostSegmentId === hostSegmentId,
      )
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds.hostWallCenterlineStart.x) * bounds.tangent.x +
          (placement.center.z - bounds.hostWallCenterlineStart.z) * bounds.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        if (
          bottom < opening.actualTopMeters &&
          top > opening.actualBottomMeters &&
          start >= opening.actualEndAlongMeters - 0.001
        ) {
          return start;
        }
        return null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => left - right)[0];
    const leftFieldEdge = placements
      .filter(
        (placement) =>
          placement.side === 'exterior' &&
          placement.surfaceKind === 'field' &&
          placement.hostSegmentId === hostSegmentId,
      )
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds.hostWallCenterlineStart.x) * bounds.tangent.x +
          (placement.center.z - bounds.hostWallCenterlineStart.z) * bounds.tangent.z;
        const end = centerStation + placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        if (
          bottom < opening.actualTopMeters &&
          top > opening.actualBottomMeters &&
          end <= opening.actualStartAlongMeters + 0.001
        ) {
          return end;
        }
        return null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => right - left)[0];

    expect(rightFieldEdge).toBeCloseTo(opening.actualEndAlongMeters, 3);
    expect(leftFieldEdge).toBeCloseTo(opening.actualStartAlongMeters, 3);
  });

  it('extends field plaster through reveal when actual start is near rough start', () => {
    const hostSegmentId = 'segment-test';
    const bounds = {
      panelId: 'infill-segment-test-0',
      hostSegmentId,
      startStationMeters: 0,
      endStationMeters: 6,
      clearWidthMeters: 6,
      bottomElevationMeters: 0,
      topElevationMeters: 2.8,
      clearHeightMeters: 2.8,
      hostWallCenterlineStart: { x: 0, y: 0, z: 0 },
      hostWallCenterlineEnd: { x: 6, y: 0, z: 0 },
      tangent: { x: 1, y: 0, z: 0 },
      outwardNormal: { x: 0, y: 0, z: 1 },
      inwardNormal: { x: 0, y: 0, z: -1 },
      leftSupportInsideFaceWorld: { x: 0, y: 0, z: 0 },
      rightSupportInsideFaceWorld: { x: 6, y: 0, z: 0 },
      leftSupportInsideFaceStation: 0,
      rightSupportInsideFaceStation: 6,
    };
    const opening = {
      id: 'door-left-trim',
      type: 'door' as const,
      wallSegmentId: hostSegmentId,
      roughStartAlongMeters: 3.51,
      roughEndAlongMeters: 4.68,
      actualStartAlongMeters: 3.513,
      actualEndAlongMeters: 4.488,
      roughBottomMeters: 0,
      roughTopMeters: 2.1,
      actualBottomMeters: 0,
      actualTopMeters: 2.1,
      roughOpeningWidthMeters: 1.17,
      roughOpeningHeightMeters: 2.1,
      actualWidthMeters: 0.975,
      actualHeightMeters: 2.1,
    };
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: normalizeCmuInfillSystem({
        kind: 'cmu_infill_system',
        panels: [{ id: bounds.panelId, hostSegmentId, infillZone: 'above_grade' as const }],
      }),
      panelBounds: [bounds],
      openings: [opening],
      wallThicknessMeters: 0.19,
    });
    const leftFieldEdge = placements
      .filter(
        (placement) =>
          placement.side === 'exterior' &&
          placement.surfaceKind === 'field' &&
          placement.hostSegmentId === hostSegmentId,
      )
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds.hostWallCenterlineStart.x) * bounds.tangent.x +
          (placement.center.z - bounds.hostWallCenterlineStart.z) * bounds.tangent.z;
        const end = centerStation + placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        if (
          bottom < opening.actualTopMeters &&
          top > opening.actualBottomMeters &&
          end <= opening.actualStartAlongMeters + 0.001
        ) {
          return end;
        }
        return null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => right - left)[0];

    expect(leftFieldEdge).toBeCloseTo(opening.actualStartAlongMeters, 3);
    expect(leftFieldEdge).toBeGreaterThanOrEqual(opening.roughStartAlongMeters - 0.001);
  });

  it('cuts the main plaster field at the door frame edge', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters,
    );
    expect(opening).toBeDefined();
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const hostFieldPlacements = placements.filter(
      (placement) =>
        placement.hostSegmentId === opening!.wallSegmentId &&
        placement.side === 'exterior' &&
        placement.surfaceKind === 'field',
    );
    const bounds = (geometry.resolvedInfillPanelBounds ?? []).find(
      (candidate) => candidate.hostSegmentId === opening!.wallSegmentId,
    );
    expect(bounds).toBeDefined();
    const frameStart = opening!.actualStartAlongMeters;
    const frameEnd = opening!.actualEndAlongMeters;
    const frameBottom = opening!.actualBottomMeters;
    const frameTop = opening!.actualTopMeters;
    const overlapToleranceMeters = 0.001;
    const fieldCrossesFrameOpening = hostFieldPlacements.some((placement) => {
      const centerStation =
        (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
        (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
      const start = centerStation - placement.widthMeters / 2;
      const end = centerStation + placement.widthMeters / 2;
      const bottom = placement.center.y - placement.heightMeters / 2;
      const top = placement.center.y + placement.heightMeters / 2;
      return (
        start < frameEnd - overlapToleranceMeters &&
        end > frameStart + overlapToleranceMeters &&
        bottom < frameTop - overlapToleranceMeters &&
        top > frameBottom + overlapToleranceMeters
      );
    });
    const leftFieldEdge = hostFieldPlacements
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
          (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const end = centerStation + placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        return bottom < frameTop && top > frameBottom && end <= frameStart + 0.001 ? end : null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => right - left)[0];
    const rightFieldEdge = hostFieldPlacements
      .map((placement) => {
        const centerStation =
          (placement.center.x - bounds!.hostWallCenterlineStart.x) * bounds!.tangent.x +
          (placement.center.z - bounds!.hostWallCenterlineStart.z) * bounds!.tangent.z;
        const start = centerStation - placement.widthMeters / 2;
        const bottom = placement.center.y - placement.heightMeters / 2;
        const top = placement.center.y + placement.heightMeters / 2;
        return bottom < frameTop && top > frameBottom && start >= frameEnd - 0.001 ? start : null;
      })
      .filter((edge): edge is number => edge != null)
      .sort((left, right) => left - right)[0];

    expect(fieldCrossesFrameOpening).toBe(false);
    expect(leftFieldEdge).toBeCloseTo(frameStart, 6);
    expect(rightFieldEdge).toBeCloseTo(frameEnd, 6);
  });

  it('adds three Division 09 plaster coat lines using matching net area', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const { geometry, lines } = framePreviewForPreset(preset);
    const placements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const exteriorPlacements = placements.filter((placement) => placement.side === 'exterior');
    const interiorPlacements = placements.filter((placement) => placement.side === 'interior');
    const expectedExteriorSquareFeet = squareMetersToSquareFeet(totalInfillPlasterAreaSquareMeters(exteriorPlacements));
    const expectedInteriorSquareFeet = squareMetersToSquareFeet(totalInfillPlasterAreaSquareMeters(interiorPlacements));
    const plasterLines = lines.filter((line) => line.id.startsWith('infill-plaster-'));

    expect(plasterLines.map((line) => line.id)).toEqual([
      'infill-plaster-scratch-coat',
      'infill-plaster-base-coat',
      'infill-plaster-finish-coat',
      'infill-plaster-interior-scratch-coat',
      'infill-plaster-interior-base-coat',
      'infill-plaster-interior-finish-coat',
    ]);
    expect(plasterLines.every((line) => line.divisionCode === '09')).toBe(true);
    expect(plasterLines.every((line) => line.unit === 'SF')).toBe(true);
    expect(plasterLines.slice(0, 3).every((line) => line.quantity === Number(expectedExteriorSquareFeet.toFixed(2)))).toBe(true);
    expect(plasterLines.slice(3).every((line) => line.quantity === Number(expectedInteriorSquareFeet.toFixed(2)))).toBe(true);
    expect(plasterLines[2].description).toContain('Textured');
    expect(plasterLines[5].description).toContain('Smooth');
  });

  it('omits plaster quantities when disabled', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const disabled = {
      ...preset,
      infillSystem: {
        ...preset.infillSystem,
        plaster: {
          ...normalizeCmuInfillSystem(preset.infillSystem).plaster,
          enabled: false,
          interiorEnabled: false,
        },
      },
    };
    const { geometry, lines } = framePreviewForPreset(disabled);

    expect(resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
    })).toHaveLength(0);
    expect(lines.some((line) => line.id.startsWith('infill-plaster-'))).toBe(false);
  });

  it('splits infill wall proxy solids around opening frame cutouts', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = frameGeometryForPreset(preset);
    const opening = geometry.wallCmuLayout.roughOpenings.find(
      (candidate) => candidate.actualStartAlongMeters > candidate.roughStartAlongMeters,
    );
    expect(opening).toBeDefined();
    const segment = geometry.wallSegments.find((candidate) => candidate.segmentId === opening!.wallSegmentId);
    expect(segment).toBeDefined();

    const solidWall = buildInfillWallProxyPieces({
      segmentLengthMeters: segment!.lengthMeters,
      wallHeightMeters: segment!.heightMeters,
      wallThicknessMeters: segment!.thicknessMeters,
      hostSegmentId: segment!.segmentId,
      openings: [],
    });
    const pieces = buildInfillWallProxyPieces({
      segmentLengthMeters: segment!.lengthMeters,
      wallHeightMeters: segment!.heightMeters,
      wallThicknessMeters: segment!.thicknessMeters,
      hostSegmentId: segment!.segmentId,
      openings: geometry.wallCmuLayout.roughOpenings,
    });

    expect(solidWall).toHaveLength(1);
    expect(pieces.length).toBeGreaterThan(1);
    const solidArea = solidWall.reduce((sum, piece) => sum + piece.lengthMeters * piece.heightMeters, 0);
    const pieceArea = pieces.reduce((sum, piece) => sum + piece.lengthMeters * piece.heightMeters, 0);
    expect(pieceArea).toBeLessThan(solidArea);
  });
});
