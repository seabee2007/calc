import type { CmuInfillPanel, CmuInfillPlasterSettings, CmuInfillSystemParameters } from '../types';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import type { ResolvedInfillPanelBounds } from './infillPanelBoundsResolver';

export const DEFAULT_CMU_INFILL_PLASTER: CmuInfillPlasterSettings = {
  enabled: true,
  finish: 'textured',
  profileLabel: '3-coat plaster',
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
  surfaceKind: 'field' | 'left_return' | 'right_return';
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
  if (!plaster.enabled) return [];

  const panelById = new Map(infillSystem.panels.map((panel) => [panel.id, panel]));
  const openings = params.openings ?? [];
  const wallThicknessMeters = Math.max(0, params.wallThicknessMeters ?? 0);
  const thicknessMeters = Math.max(0.001, params.plasterThicknessMeters ?? PLASTER_RENDER_THICKNESS_METERS);
  const renderBiasMeters = Math.max(0, params.renderBiasMeters ?? PLASTER_RENDER_BIAS_METERS);
  const panelEdgeFaceOverlapMeters = wallThicknessMeters > 0 ? wallThicknessMeters / 2 : 0;

  return (params.panelBounds ?? []).flatMap((bounds) => {
    const panel = panelById.get(bounds.panelId);
    if (!panel || !isPlasterEligiblePanel(panel)) return [];
    const fieldPlacements = subtractOpeningsFromPanel(bounds, openings, panelEdgeFaceOverlapMeters).map((rect, index) => {
      const centerStation = (rect.startStationMeters + rect.endStationMeters) / 2;
      const centerY = (rect.bottomElevationMeters + rect.topElevationMeters) / 2;
      const centerline = pointAlongBounds(bounds, centerStation);
      const outwardOffset = wallThicknessMeters / 2 + thicknessMeters / 2 + renderBiasMeters;
      const widthMeters = rect.endStationMeters - rect.startStationMeters;
      const heightMeters = rect.topElevationMeters - rect.bottomElevationMeters;
      return {
        id: `${bounds.panelId}-plaster-${index}`,
        panelId: bounds.panelId,
        hostSegmentId: bounds.hostSegmentId,
        surfaceKind: 'field' as const,
        finish: plaster.finish,
        profileLabel: plaster.profileLabel,
        center: {
          x: centerline.x + bounds.outwardNormal.x * outwardOffset,
          y: centerY,
          z: centerline.z + bounds.outwardNormal.z * outwardOffset,
        },
        widthMeters,
        heightMeters,
        thicknessMeters,
        rotationY: -Math.atan2(bounds.tangent.z, bounds.tangent.x),
        areaSquareMeters: widthMeters * heightMeters,
      };
    });
    return [
      ...fieldPlacements,
      ...createPanelEdgeReturnPlacements({
        bounds,
        plaster,
        wallThicknessMeters,
        thicknessMeters,
        renderBiasMeters,
      }),
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
      const cut: PlasterRect = {
        startStationMeters: Math.max(bounds.startStationMeters, opening.roughStartAlongMeters),
        endStationMeters: Math.min(bounds.endStationMeters, opening.roughEndAlongMeters),
        bottomElevationMeters: Math.max(bounds.bottomElevationMeters, opening.roughBottomMeters),
        topElevationMeters: Math.min(bounds.topElevationMeters, opening.roughTopMeters),
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
