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
  exteriorSegmentIds?: ReadonlySet<string>;
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
  const isExteriorHost = (hostSegmentId: string) =>
    !params.exteriorSegmentIds || params.exteriorSegmentIds.has(hostSegmentId);

  return (params.panelBounds ?? []).flatMap((bounds) => {
    const panel = panelById.get(bounds.panelId);
    if (!panel || !isPlasterEligiblePanel(panel)) return [];
    if (!isExteriorHost(bounds.hostSegmentId)) {
      if (!plaster.interiorEnabled) return [];
      const partitionFaceParams = {
        bounds,
        openings,
        finish: plaster.interiorFinish,
        profileLabel: plaster.interiorProfileLabel,
        wallThicknessMeters,
        thicknessMeters,
        renderBiasMeters,
        panelEdgeFaceOverlapMeters,
      };
      return [
        ...createPanelFacePlacements({ ...partitionFaceParams, side: 'interior' }),
        ...createPanelFacePlacements({ ...partitionFaceParams, side: 'exterior' }),
      ];
    }
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
          ]
        : []),
    ];
  });
}

function isPlasterEligiblePanel(panel: CmuInfillPanel): boolean {
  return panel.infillZone !== 'below_grade';
}

function pointAlongBounds(bounds: ResolvedInfillPanelBounds, stationMeters: number): { x: number; z: number } {
  const infillCenterlineOffset = bounds.infillCenterlineInwardOffsetMeters ?? 0;
  return {
    x:
      bounds.hostWallCenterlineStart.x +
      bounds.tangent.x * stationMeters +
      bounds.inwardNormal.x * infillCenterlineOffset,
    z:
      bounds.hostWallCenterlineStart.z +
      bounds.tangent.z * stationMeters +
      bounds.inwardNormal.z * infillCenterlineOffset,
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
      const cut = openingPlasterCutRect(bounds, opening);
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

function openingPlasterCutRect(bounds: ResolvedInfillPanelBounds, opening: PlasterOpening): PlasterRect {
  const roughStart = Math.max(bounds.startStationMeters, opening.roughStartAlongMeters);
  const roughEnd = Math.min(bounds.endStationMeters, opening.roughEndAlongMeters);
  const roughBottom = Math.max(bounds.bottomElevationMeters, opening.roughBottomMeters);
  const roughTop = Math.min(bounds.topElevationMeters, opening.roughTopMeters);
  const actualStart = Math.max(roughStart, Math.min(roughEnd, opening.actualStartAlongMeters));
  const actualEnd = Math.max(roughStart, Math.min(roughEnd, opening.actualEndAlongMeters));
  const actualBottom = Math.max(roughBottom, Math.min(roughTop, opening.actualBottomMeters));
  const actualTop = Math.max(roughBottom, Math.min(roughTop, opening.actualTopMeters));

  return {
    startStationMeters: actualStart,
    endStationMeters: actualEnd,
    bottomElevationMeters: actualBottom,
    topElevationMeters: actualTop,
  };
}

function openingFrameCutRect(
  bounds: Pick<
    ResolvedInfillPanelBounds,
    'startStationMeters' | 'endStationMeters' | 'bottomElevationMeters' | 'topElevationMeters'
  >,
  opening: PlasterOpening,
): PlasterRect {
  return {
    startStationMeters: Math.max(bounds.startStationMeters, opening.actualStartAlongMeters),
    endStationMeters: Math.min(bounds.endStationMeters, opening.actualEndAlongMeters),
    bottomElevationMeters: Math.max(bounds.bottomElevationMeters, opening.actualBottomMeters),
    topElevationMeters: Math.min(bounds.topElevationMeters, opening.actualTopMeters),
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

export type InfillWallProxyPiece = {
  lengthMeters: number;
  heightMeters: number;
  thicknessMeters: number;
  centerStationMeters: number;
  centerElevationMeters: number;
};

export function buildInfillWallProxyPieces(params: {
  segmentLengthMeters: number;
  wallHeightMeters: number;
  wallThicknessMeters: number;
  hostSegmentId: string;
  openings: readonly PlasterOpening[];
  trimStartMeters?: number;
  trimEndMeters?: number;
}): InfillWallProxyPiece[] {
  const trimStartMeters = Math.max(0, params.trimStartMeters ?? 0);
  const trimEndMeters = Math.max(0, params.trimEndMeters ?? 0);
  const segmentBounds: Pick<
    ResolvedInfillPanelBounds,
    'startStationMeters' | 'endStationMeters' | 'bottomElevationMeters' | 'topElevationMeters' | 'hostSegmentId'
  > = {
    hostSegmentId: params.hostSegmentId,
    startStationMeters: trimStartMeters,
    endStationMeters: Math.max(trimStartMeters, params.segmentLengthMeters - trimEndMeters),
    bottomElevationMeters: 0,
    topElevationMeters: params.wallHeightMeters,
  };

  let rects: PlasterRect[] = [
    {
      startStationMeters: segmentBounds.startStationMeters,
      endStationMeters: segmentBounds.endStationMeters,
      bottomElevationMeters: segmentBounds.bottomElevationMeters,
      topElevationMeters: segmentBounds.topElevationMeters,
    },
  ];

  params.openings
    .filter((opening) => opening.wallSegmentId === params.hostSegmentId)
    .forEach((opening) => {
      const cut = openingFrameCutRect(segmentBounds, opening);
      if (cut.endStationMeters <= cut.startStationMeters || cut.topElevationMeters <= cut.bottomElevationMeters) {
        return;
      }
      rects = rects.flatMap((rect) => splitRectAroundOpening(rect, cut));
    });

  return rects
    .filter(
      (rect) =>
        rect.endStationMeters - rect.startStationMeters > 0.001 &&
        rect.topElevationMeters - rect.bottomElevationMeters > 0.001,
    )
    .map((rect) => ({
      lengthMeters: rect.endStationMeters - rect.startStationMeters,
      heightMeters: rect.topElevationMeters - rect.bottomElevationMeters,
      thicknessMeters: params.wallThicknessMeters,
      centerStationMeters: (rect.startStationMeters + rect.endStationMeters) / 2,
      centerElevationMeters: (rect.bottomElevationMeters + rect.topElevationMeters) / 2,
    }));
}
