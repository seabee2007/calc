import type { CmuInfillPanel, CmuInfillPlasterSettings, CmuInfillSystemParameters } from '../types';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import type { ResolvedInfillPanelBounds } from './infillPanelBoundsResolver';

export const DEFAULT_CMU_INFILL_PLASTER: CmuInfillPlasterSettings = {
  enabled: true,
  finish: 'textured',
  profileLabel: '3-coat plaster',
  interiorEnabled: true,
  interiorFinish: 'smooth',
  interiorProfileLabel: '3-coat plaster',
};

const PLASTER_RENDER_THICKNESS_METERS = 0.008;
const PLASTER_RENDER_BIAS_METERS = 0.002;
const OPENING_FRAME_TRIM_COVERAGE_METERS = 0.055;

export type PlasterOpening = ResolvedCmuOpening & {
  wallSegmentId?: string;
};

export type InfillPlasterPanelPlacement = {
  id: string;
  panelId: string;
  hostSegmentId: string;
  side: 'exterior' | 'interior';
  surfaceKind:
    | 'field'
    | 'left_return'
    | 'right_return'
    | 'opening_left_jamb'
    | 'opening_right_jamb'
    | 'opening_head'
    | 'opening_sill';
  finish: CmuInfillPlasterSettings['finish'];
  profileLabel: string;
  center: { x: number; y: number; z: number };
  widthMeters: number;
  heightMeters: number;
  thicknessMeters: number;
  rotationY: number;
  areaSquareMeters: number;
};

export function normalizeCmuInfillPlasterSettings(
  partial?: Partial<CmuInfillPlasterSettings> | null,
): CmuInfillPlasterSettings {
  return {
    enabled: partial?.enabled ?? DEFAULT_CMU_INFILL_PLASTER.enabled,
    finish: partial?.finish === 'smooth' ? 'smooth' : DEFAULT_CMU_INFILL_PLASTER.finish,
    profileLabel: partial?.profileLabel?.trim() || DEFAULT_CMU_INFILL_PLASTER.profileLabel,
    interiorEnabled: partial?.interiorEnabled ?? partial?.enabled ?? DEFAULT_CMU_INFILL_PLASTER.interiorEnabled,
    interiorFinish:
      partial?.interiorFinish === 'textured' || partial?.interiorFinish === 'smooth'
        ? partial.interiorFinish
        : DEFAULT_CMU_INFILL_PLASTER.interiorFinish,
    interiorProfileLabel:
      partial?.interiorProfileLabel?.trim() || DEFAULT_CMU_INFILL_PLASTER.interiorProfileLabel,
  };
}

export function normalizeCmuInfillSystem(
  partial?: Partial<CmuInfillSystemParameters> | null,
): CmuInfillSystemParameters {
  return {
    kind: 'cmu_infill_system',
    panels: [...(partial?.panels ?? [])],
    plaster: normalizeCmuInfillPlasterSettings(partial?.plaster),
  };
}

export function totalInfillPlasterAreaSquareMeters(
  placements: readonly Pick<InfillPlasterPanelPlacement, 'areaSquareMeters'>[],
): number {
  return placements.reduce((sum, placement) => sum + placement.areaSquareMeters, 0);
}

export function resolveInfillPlasterPanelPlacements(params: {
  infillSystem?: CmuInfillSystemParameters | null;
  panelBounds?: readonly ResolvedInfillPanelBounds[] | null;
  openings?: readonly PlasterOpening[] | null;
  wallThicknessMeters?: number;
  plasterThicknessMeters?: number;
  renderBiasMeters?: number;
}): InfillPlasterPanelPlacement[] {
  const infillSystem = normalizeCmuInfillSystem(params.infillSystem);
  const plaster = infillSystem.plaster;
  if (!plaster.enabled && !plaster.interiorEnabled) return [];

  const panelById = new Map(infillSystem.panels.map((panel) => [panel.id, panel]));
  const openings = params.openings ?? [];
  const wallThicknessMeters = Math.max(0, params.wallThicknessMeters ?? 0);
  const thicknessMeters = Math.max(0.001, params.plasterThicknessMeters ?? PLASTER_RENDER_THICKNESS_METERS);
  const renderBiasMeters = Math.max(0, params.renderBiasMeters ?? PLASTER_RENDER_BIAS_METERS);
  const panelEdgeFaceOverlapMeters = wallThicknessMeters > 0 ? wallThicknessMeters / 2 : 0;

  return (params.panelBounds ?? []).flatMap((bounds) => {
    const panel = panelById.get(bounds.panelId);
    if (!panel || !isPlasterEligiblePanel(panel)) return [];
    return [
      ...(plaster.enabled
        ? [
            ...createPanelFacePlacements({
              bounds,
              openings,
              side: 'exterior',
              finish: plaster.finish,
              profileLabel: plaster.profileLabel,
              wallThicknessMeters,
              thicknessMeters,
              renderBiasMeters,
              panelEdgeFaceOverlapMeters,
            }),
            ...createPanelEdgeReturnPlacements({
              bounds,
              plaster,
              wallThicknessMeters,
              thicknessMeters,
              renderBiasMeters,
            }),
            ...createOpeningReturnPlacements({
              bounds,
              openings,
              side: 'exterior',
              finish: plaster.finish,
              profileLabel: plaster.profileLabel,
              wallThicknessMeters,
              thicknessMeters,
              renderBiasMeters,
            }),
          ]
        : []),
      ...(plaster.interiorEnabled
        ? [
            ...createPanelFacePlacements({
              bounds,
              openings,
              side: 'interior',
              finish: plaster.interiorFinish,
              profileLabel: plaster.interiorProfileLabel,
              wallThicknessMeters,
              thicknessMeters,
              renderBiasMeters,
              panelEdgeFaceOverlapMeters,
            }),
            ...createOpeningReturnPlacements({
              bounds,
              openings,
              side: 'interior',
              finish: plaster.interiorFinish,
              profileLabel: plaster.interiorProfileLabel,
              wallThicknessMeters,
              thicknessMeters,
              renderBiasMeters,
            }),
          ]
        : []),
    ];
  });
}

function isPlasterEligiblePanel(panel: CmuInfillPanel): boolean {
  return panel.infillZone !== 'below_grade';
}

function pointAlongBounds(bounds: ResolvedInfillPanelBounds, stationMeters: number): { x: number; z: number } {
  return {
    x: bounds.hostWallCenterlineStart.x + bounds.tangent.x * stationMeters,
    z: bounds.hostWallCenterlineStart.z + bounds.tangent.z * stationMeters,
  };
}

function createPanelFacePlacements(params: {
  bounds: ResolvedInfillPanelBounds;
  openings: readonly PlasterOpening[];
  side: InfillPlasterPanelPlacement['side'];
  finish: CmuInfillPlasterSettings['finish'];
  profileLabel: string;
  wallThicknessMeters: number;
  thicknessMeters: number;
  renderBiasMeters: number;
  panelEdgeFaceOverlapMeters: number;
}): InfillPlasterPanelPlacement[] {
  const sideMultiplier = params.side === 'exterior' ? 1 : -1;
  return subtractOpeningsFromPanel(params.bounds, params.openings, params.panelEdgeFaceOverlapMeters).map(
    (rect, index) => {
      const centerStation = (rect.startStationMeters + rect.endStationMeters) / 2;
      const centerY = (rect.bottomElevationMeters + rect.topElevationMeters) / 2;
      const centerline = pointAlongBounds(params.bounds, centerStation);
      const faceOffset =
        sideMultiplier *
        (params.wallThicknessMeters / 2 + params.thicknessMeters / 2 + params.renderBiasMeters);
      const widthMeters = rect.endStationMeters - rect.startStationMeters;
      const heightMeters = rect.topElevationMeters - rect.bottomElevationMeters;
      return {
        id: `${params.bounds.panelId}-plaster-${params.side}-${index}`,
        panelId: params.bounds.panelId,
        hostSegmentId: params.bounds.hostSegmentId,
        side: params.side,
        surfaceKind: 'field' as const,
        finish: params.finish,
        profileLabel: params.profileLabel,
        center: {
          x: centerline.x + params.bounds.outwardNormal.x * faceOffset,
          y: centerY,
          z: centerline.z + params.bounds.outwardNormal.z * faceOffset,
        },
        widthMeters,
        heightMeters,
        thicknessMeters: params.thicknessMeters,
        rotationY: -Math.atan2(params.bounds.tangent.z, params.bounds.tangent.x),
        areaSquareMeters: widthMeters * heightMeters,
      };
    },
  );
}

function createPanelEdgeReturnPlacements(params: {
  bounds: ResolvedInfillPanelBounds;
  plaster: CmuInfillPlasterSettings;
  wallThicknessMeters: number;
  thicknessMeters: number;
  renderBiasMeters: number;
}): InfillPlasterPanelPlacement[] {
  if (params.wallThicknessMeters <= 0) return [];
  const heightMeters = params.bounds.topElevationMeters - params.bounds.bottomElevationMeters;
  if (heightMeters <= 0.001) return [];

  const baseRotationY = -Math.atan2(params.bounds.tangent.z, params.bounds.tangent.x);
  const centerY = (params.bounds.bottomElevationMeters + params.bounds.topElevationMeters) / 2;
  const returnDepthMeters = Math.max(
    0.001,
    params.wallThicknessMeters + params.thicknessMeters + params.renderBiasMeters,
  );
  const centerDepthOffsetMeters = (params.thicknessMeters + params.renderBiasMeters) / 2;
  const faceOffsetMeters = params.thicknessMeters / 2 + params.renderBiasMeters;

  return [
    {
      edge: 'left_return' as const,
      stationMeters: params.bounds.startStationMeters,
      stationOffsetMeters: -faceOffsetMeters,
      rotationY: baseRotationY - Math.PI / 2,
    },
    {
      edge: 'right_return' as const,
      stationMeters: params.bounds.endStationMeters,
      stationOffsetMeters: faceOffsetMeters,
      rotationY: baseRotationY + Math.PI / 2,
    },
  ].map((edge) => {
    const edgeCenterline = pointAlongBounds(params.bounds, edge.stationMeters);
    return {
      id: `${params.bounds.panelId}-plaster-${edge.edge}`,
      panelId: params.bounds.panelId,
      hostSegmentId: params.bounds.hostSegmentId,
      side: 'exterior',
      surfaceKind: edge.edge,
      finish: params.plaster.finish,
      profileLabel: params.plaster.profileLabel,
      center: {
        x:
          edgeCenterline.x +
          params.bounds.tangent.x * edge.stationOffsetMeters +
          params.bounds.outwardNormal.x * centerDepthOffsetMeters,
        y: centerY,
        z:
          edgeCenterline.z +
          params.bounds.tangent.z * edge.stationOffsetMeters +
          params.bounds.outwardNormal.z * centerDepthOffsetMeters,
      },
      widthMeters: returnDepthMeters,
      heightMeters,
      thicknessMeters: params.thicknessMeters,
      rotationY: edge.rotationY,
      areaSquareMeters: returnDepthMeters * heightMeters,
    };
  });
}

function createOpeningReturnPlacements(params: {
  bounds: ResolvedInfillPanelBounds;
  openings: readonly PlasterOpening[];
  side: InfillPlasterPanelPlacement['side'];
  finish: CmuInfillPlasterSettings['finish'];
  profileLabel: string;
  wallThicknessMeters: number;
  thicknessMeters: number;
  renderBiasMeters: number;
}): InfillPlasterPanelPlacement[] {
  if (params.wallThicknessMeters <= 0) return [];
  const baseRotationY = -Math.atan2(params.bounds.tangent.z, params.bounds.tangent.x);
  const returnDepthMeters = Math.max(
    0.001,
    params.wallThicknessMeters + params.thicknessMeters + params.renderBiasMeters,
  );
  const depthCenterOffsetMeters = 0;
  const edgeInsetMeters = 0;
  const cornerOverlapMeters = Math.max(params.thicknessMeters + params.renderBiasMeters * 2, 0.012);

  return params.openings
    .filter((opening) => opening.wallSegmentId === params.bounds.hostSegmentId)
    .flatMap((opening) => {
      const startStationMeters = Math.max(params.bounds.startStationMeters, opening.roughStartAlongMeters);
      const endStationMeters = Math.min(params.bounds.endStationMeters, opening.roughEndAlongMeters);
      const bottomElevationMeters = Math.max(params.bounds.bottomElevationMeters, opening.roughBottomMeters);
      const topElevationMeters = Math.min(params.bounds.topElevationMeters, opening.roughTopMeters);
      const actualStartStationMeters = Math.max(
        startStationMeters,
        Math.min(endStationMeters, opening.actualStartAlongMeters),
      );
      const actualEndStationMeters = Math.max(
        startStationMeters,
        Math.min(endStationMeters, opening.actualEndAlongMeters),
      );
      const actualBottomElevationMeters = Math.max(
        bottomElevationMeters,
        Math.min(topElevationMeters, opening.actualBottomMeters),
      );
      const actualTopElevationMeters = Math.max(
        bottomElevationMeters,
        Math.min(topElevationMeters, opening.actualTopMeters),
      );
      const leftRevealStationMeters = Math.max(
        startStationMeters,
        actualStartStationMeters - OPENING_FRAME_TRIM_COVERAGE_METERS,
      );
      const rightRevealStationMeters = Math.min(
        endStationMeters,
        actualEndStationMeters + OPENING_FRAME_TRIM_COVERAGE_METERS,
      );
      const openingWidthMeters = rightRevealStationMeters - leftRevealStationMeters;
      const openingHeightMeters = actualTopElevationMeters - actualBottomElevationMeters;
      if (openingWidthMeters <= 0.001 || openingHeightMeters <= 0.001) return [];

      const returnStartStationMeters = Math.max(
        params.bounds.startStationMeters,
        startStationMeters - cornerOverlapMeters,
      );
      const returnEndStationMeters = Math.min(
        params.bounds.endStationMeters,
        endStationMeters + cornerOverlapMeters,
      );
      const returnCenterStationMeters = (returnStartStationMeters + returnEndStationMeters) / 2;
      const returnWidthMeters = returnEndStationMeters - returnStartStationMeters;
      const returnCenterline = pointAlongBounds(params.bounds, returnCenterStationMeters);
      const leftJambStartStationMeters = Math.min(startStationMeters, leftRevealStationMeters);
      const leftJambEndStationMeters = Math.max(startStationMeters, leftRevealStationMeters);
      const rightJambStartStationMeters = Math.min(rightRevealStationMeters, endStationMeters);
      const rightJambEndStationMeters = Math.max(rightRevealStationMeters, endStationMeters);
      const leftJambCenterStationMeters = (leftJambStartStationMeters + leftJambEndStationMeters) / 2;
      const rightJambCenterStationMeters = (rightJambStartStationMeters + rightJambEndStationMeters) / 2;
      const leftJambThicknessMeters = Math.max(
        params.thicknessMeters,
        leftJambEndStationMeters - leftJambStartStationMeters + cornerOverlapMeters,
      );
      const rightJambThicknessMeters = Math.max(
        params.thicknessMeters,
        rightJambEndStationMeters - rightJambStartStationMeters + cornerOverlapMeters,
      );
      const jambBottomElevationMeters = Math.max(
        params.bounds.bottomElevationMeters,
        actualBottomElevationMeters - cornerOverlapMeters,
      );
      const jambTopElevationMeters = Math.min(
        params.bounds.topElevationMeters,
        actualTopElevationMeters + cornerOverlapMeters,
      );
      const jambHeightMeters = jambTopElevationMeters - jambBottomElevationMeters;
      if (returnWidthMeters <= 0.001 || jambHeightMeters <= 0.001) return [];
      const jambCenterY = (jambBottomElevationMeters + jambTopElevationMeters) / 2;
      const centerAtStation = (stationMeters: number, stationOffsetMeters: number, y: number) => {
        const centerline = pointAlongBounds(params.bounds, stationMeters);
        return {
          x:
            centerline.x +
            params.bounds.tangent.x * stationOffsetMeters +
            params.bounds.outwardNormal.x * depthCenterOffsetMeters,
          y,
          z:
            centerline.z +
            params.bounds.tangent.z * stationOffsetMeters +
            params.bounds.outwardNormal.z * depthCenterOffsetMeters,
        };
      };
      const centerAtReturnSpan = (y: number) => ({
        x: returnCenterline.x + params.bounds.outwardNormal.x * depthCenterOffsetMeters,
        y,
        z: returnCenterline.z + params.bounds.outwardNormal.z * depthCenterOffsetMeters,
      });
      const headRevealElevationMeters = Math.min(
        topElevationMeters,
        actualTopElevationMeters + OPENING_FRAME_TRIM_COVERAGE_METERS,
      );
      const headStartElevationMeters = Math.min(headRevealElevationMeters, topElevationMeters);
      const headEndElevationMeters = Math.max(headRevealElevationMeters, topElevationMeters);
      const headHeightMeters = Math.max(
        params.thicknessMeters,
        headEndElevationMeters - headStartElevationMeters + cornerOverlapMeters,
      );
      const headCenterElevationMeters = (headStartElevationMeters + headEndElevationMeters) / 2;
      const common = {
        panelId: params.bounds.panelId,
        hostSegmentId: params.bounds.hostSegmentId,
        side: params.side,
        finish: params.finish,
        profileLabel: params.profileLabel,
      };
      const placements: InfillPlasterPanelPlacement[] = [
        {
          ...common,
          id: `${params.bounds.panelId}-plaster-${params.side}-${opening.id}-left-jamb`,
          surfaceKind: 'opening_left_jamb',
          center: centerAtStation(leftJambCenterStationMeters, edgeInsetMeters, jambCenterY),
          widthMeters: returnDepthMeters,
          heightMeters: jambHeightMeters,
          thicknessMeters: leftJambThicknessMeters,
          rotationY: baseRotationY + Math.PI / 2,
          areaSquareMeters: returnDepthMeters * jambHeightMeters,
        },
        {
          ...common,
          id: `${params.bounds.panelId}-plaster-${params.side}-${opening.id}-right-jamb`,
          surfaceKind: 'opening_right_jamb',
          center: centerAtStation(rightJambCenterStationMeters, -edgeInsetMeters, jambCenterY),
          widthMeters: returnDepthMeters,
          heightMeters: jambHeightMeters,
          thicknessMeters: rightJambThicknessMeters,
          rotationY: baseRotationY - Math.PI / 2,
          areaSquareMeters: returnDepthMeters * jambHeightMeters,
        },
        {
          ...common,
          id: `${params.bounds.panelId}-plaster-${params.side}-${opening.id}-head`,
          surfaceKind: 'opening_head',
          center: centerAtReturnSpan(headCenterElevationMeters - edgeInsetMeters),
          widthMeters: returnWidthMeters,
          heightMeters: headHeightMeters,
          thicknessMeters: returnDepthMeters,
          rotationY: baseRotationY,
          areaSquareMeters: returnDepthMeters * returnWidthMeters,
        },
      ];

      if (opening.type !== 'door' && actualBottomElevationMeters > params.bounds.bottomElevationMeters + 0.001) {
        const sillRevealElevationMeters = Math.max(
          bottomElevationMeters,
          actualBottomElevationMeters - OPENING_FRAME_TRIM_COVERAGE_METERS,
        );
        const sillStartElevationMeters = Math.min(bottomElevationMeters, sillRevealElevationMeters);
        const sillEndElevationMeters = Math.max(bottomElevationMeters, sillRevealElevationMeters);
        const sillHeightMeters = Math.max(
          params.thicknessMeters,
          sillEndElevationMeters - sillStartElevationMeters + cornerOverlapMeters,
        );
        const sillCenterElevationMeters = (sillStartElevationMeters + sillEndElevationMeters) / 2;
        placements.push({
          ...common,
          id: `${params.bounds.panelId}-plaster-${params.side}-${opening.id}-sill`,
          surfaceKind: 'opening_sill',
          center: centerAtReturnSpan(sillCenterElevationMeters + edgeInsetMeters),
          widthMeters: returnWidthMeters,
          heightMeters: sillHeightMeters,
          thicknessMeters: returnDepthMeters,
          rotationY: baseRotationY,
          areaSquareMeters: returnDepthMeters * returnWidthMeters,
        });
      }

      return placements;
    });
}

type PlasterRect = {
  startStationMeters: number;
  endStationMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
};

function subtractOpeningsFromPanel(
  bounds: ResolvedInfillPanelBounds,
  openings: readonly PlasterOpening[],
  panelEdgeFaceOverlapMeters = 0,
): PlasterRect[] {
  let rects: PlasterRect[] = [
    {
      startStationMeters: bounds.startStationMeters - panelEdgeFaceOverlapMeters,
      endStationMeters: bounds.endStationMeters + panelEdgeFaceOverlapMeters,
      bottomElevationMeters: bounds.bottomElevationMeters,
      topElevationMeters: bounds.topElevationMeters,
    },
  ];

  openings
    .filter((opening) => opening.wallSegmentId === bounds.hostSegmentId)
    .forEach((opening) => {
      const frameOutside = openingFrameOutsideRect(bounds, opening);
      const cut: PlasterRect = {
        startStationMeters: frameOutside.startStationMeters,
        endStationMeters: frameOutside.endStationMeters,
        bottomElevationMeters: frameOutside.bottomElevationMeters,
        topElevationMeters: frameOutside.topElevationMeters,
      };
      if (cut.endStationMeters <= cut.startStationMeters || cut.topElevationMeters <= cut.bottomElevationMeters) {
        return;
      }
      rects = rects.flatMap((rect) => splitRectAroundOpening(rect, cut));
    });

  return rects.filter(
    (rect) =>
      rect.endStationMeters - rect.startStationMeters > 0.001 &&
      rect.topElevationMeters - rect.bottomElevationMeters > 0.001,
  );
}

function openingFrameOutsideRect(bounds: ResolvedInfillPanelBounds, opening: PlasterOpening): PlasterRect {
  const roughStart = Math.max(bounds.startStationMeters, opening.roughStartAlongMeters);
  const roughEnd = Math.min(bounds.endStationMeters, opening.roughEndAlongMeters);
  const roughBottom = Math.max(bounds.bottomElevationMeters, opening.roughBottomMeters);
  const roughTop = Math.min(bounds.topElevationMeters, opening.roughTopMeters);
  const actualStart = Math.max(roughStart, Math.min(roughEnd, opening.actualStartAlongMeters));
  const actualEnd = Math.max(roughStart, Math.min(roughEnd, opening.actualEndAlongMeters));
  const actualBottom = Math.max(roughBottom, Math.min(roughTop, opening.actualBottomMeters));
  const actualTop = Math.max(roughBottom, Math.min(roughTop, opening.actualTopMeters));

  return {
    startStationMeters: Math.max(roughStart, actualStart - OPENING_FRAME_TRIM_COVERAGE_METERS),
    endStationMeters: Math.min(roughEnd, actualEnd + OPENING_FRAME_TRIM_COVERAGE_METERS),
    bottomElevationMeters: Math.max(roughBottom, actualBottom - OPENING_FRAME_TRIM_COVERAGE_METERS),
    topElevationMeters: Math.min(roughTop, actualTop + OPENING_FRAME_TRIM_COVERAGE_METERS),
  };
}

function splitRectAroundOpening(rect: PlasterRect, cut: PlasterRect): PlasterRect[] {
  const overlapLeft = Math.max(rect.startStationMeters, cut.startStationMeters);
  const overlapRight = Math.min(rect.endStationMeters, cut.endStationMeters);
  const overlapBottom = Math.max(rect.bottomElevationMeters, cut.bottomElevationMeters);
  const overlapTop = Math.min(rect.topElevationMeters, cut.topElevationMeters);
  if (overlapRight <= overlapLeft || overlapTop <= overlapBottom) return [rect];

  const pieces: PlasterRect[] = [];
  if (rect.startStationMeters < overlapLeft) {
    pieces.push({ ...rect, endStationMeters: overlapLeft });
  }
  if (overlapRight < rect.endStationMeters) {
    pieces.push({ ...rect, startStationMeters: overlapRight });
  }
  if (rect.bottomElevationMeters < overlapBottom) {
    pieces.push({
      startStationMeters: overlapLeft,
      endStationMeters: overlapRight,
      bottomElevationMeters: rect.bottomElevationMeters,
      topElevationMeters: overlapBottom,
    });
  }
  if (overlapTop < rect.topElevationMeters) {
    pieces.push({
      startStationMeters: overlapLeft,
      endStationMeters: overlapRight,
      bottomElevationMeters: overlapTop,
      topElevationMeters: rect.topElevationMeters,
    });
  }
  return pieces;
}
