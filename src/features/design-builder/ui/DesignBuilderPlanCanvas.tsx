import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type {
  DesignBuilderInteractionEvent,
  DesignBuilderSnapMode,
  DesignBuilderToolMode,
  DesignWallLayoutParameters,
} from '../types';
import type { DesignSnapTarget } from '../domain/designSnapRules';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { ResolvedOpeningPlacement } from '../domain/openingPlacementResolver';
import {
  buildPlanDisplayNodeById,
  buildPlanOpeningGeometry,
  buildWallRunsExcludingRoughOpenings,
  hitTestPlanOpeningGeometry,
  resolvePlanWallRunEndpoints,
  resolveSegmentDisplayEndpoints,
} from '../domain/planOpeningGraphics';
import {
  PlanOpeningSymbol,
  buildPlanOpeningRenderItem,
} from '../domain/planOpeningSymbols';
import {
  DEFAULT_PLAN_VIEWPORT,
  createPlanCameraController,
  type PlanViewportState,
} from '../domain/pointerPlanMapping';
import {
  MIN_CELL_PX,
  computePlanGridState,
  formatPlanGridSpacingMeters,
  projectCellWidthPx,
} from '../domain/planGridState';
import { fitPlanToLayout, logDesignFramingDiagnostics, resetPlanView, type DesignLayoutBounds } from '../domain/designLayoutBounds';
import { listOrthogonalGuideDirections, resolveDrawWallGuidance, type OrthogonalClosureAssist } from '../domain/wallLayoutRules';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { DESIGN_BUILDER_COPY } from '../domain/designBuilderCopy';
import { formatDrawWallStatusChip } from '../domain/designDrawWallFeedback';

const MIN_SEGMENT_LENGTH_METERS = 0.08;
const FALLBACK_SURFACE_SIZE = { width: 900, height: 520 };
const PLAN_RULER_TICKS_METERS = [0, 5, 10, 50];

export type PlanOpeningCanvasItem = {
  openingId: string;
  openingType: 'door' | 'window';
  resolved: ResolvedOpeningPlacement;
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  swingDirection?: 'left' | 'right';
  swingType?: 'inswing' | 'outswing';
};

export type PlanOpeningCanvasPreview = {
  resolvedPlacement: ResolvedOpeningPlacement;
  openingType: 'door' | 'window';
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  swingDirection?: 'left' | 'right';
  swingType?: 'inswing' | 'outswing';
};

interface DesignBuilderPlanCanvasProps {
  layout: DesignWallLayoutParameters;
  toolMode: DesignBuilderToolMode;
  snapSpacingMeters?: number;
  snapMode?: DesignBuilderSnapMode;
  viewport?: PlanViewportState;
  layoutBounds?: DesignLayoutBounds | null;
  viewCommand?: { id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null;
  onViewportChange?: (viewport: PlanViewportState) => void;
  onUserViewportChange?: () => void;
  draftEnd?: { x: number; z: number } | null;
  activeNodeId?: string | null;
  drawStartNodeId?: string | null;
  selectedSegmentId?: string | null;
  selectedNodeId?: string | null;
  selectedOpeningId?: string | null;
  segmentFrames?: readonly SegmentFrame[];
  openingItems?: readonly PlanOpeningCanvasItem[];
  openingPreview?: PlanOpeningCanvasPreview | null;
  snapTarget?: DesignSnapTarget | null;
  shiftConstraintLabel?: string | null;
  previewMetrics?: { lengthMeters: number; angleDegrees: number } | null;
  orthogonalClosureAssist?: OrthogonalClosureAssist | null;
  closureCornerSnap?: { point: { x: number; z: number }; captured: boolean } | null;
  frameSystem?: import('../types').StructuralFrameSystemParameters;
  isolatedFootings?: readonly import('../types').IsolatedFooting[];
  resolvedRoofSystem?: import('../types').ResolvedRoofSystem | null;
  selectedObjectType?: import('../types').DesignBuilderObjectType | null;
  onInteraction: (event: DesignBuilderInteractionEvent) => void;
}

export default function DesignBuilderPlanCanvas({
  layout,
  toolMode,
  snapSpacingMeters,
  snapMode = 'grid',
  viewport = DEFAULT_PLAN_VIEWPORT,
  layoutBounds = null,
  viewCommand = null,
  onViewportChange,
  onUserViewportChange,
  draftEnd = null,
  activeNodeId = null,
  drawStartNodeId = null,
  selectedSegmentId = null,
  selectedNodeId = null,
  selectedOpeningId = null,
  segmentFrames = [],
  openingItems = [],
  openingPreview = null,
  snapTarget = null,
  shiftConstraintLabel = null,
  previewMetrics = null,
  orthogonalClosureAssist = null,
  closureCornerSnap = null,
  frameSystem,
  isolatedFootings = [],
  resolvedRoofSystem = null,
  selectedObjectType = null,
  onInteraction,
}: DesignBuilderPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const lastViewCommandIdRef = useRef<number | null>(null);
  const [surfaceSize, setSurfaceSize] = useState(FALLBACK_SURFACE_SIZE);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);

  const framesBySegmentId = useMemo(
    () => new Map(segmentFrames.map((frame) => [frame.segmentId, frame])),
    [segmentFrames],
  );

  const planDisplayNodeById = useMemo(
    () => buildPlanDisplayNodeById({ layout, framesBySegmentId }),
    [framesBySegmentId, layout],
  );

  const roughOpeningsBySegmentId = useMemo(() => {
    const bySegment = new Map<string, { roughOpeningStartMeters: number; roughOpeningEndMeters: number }[]>();
    openingItems.forEach((item) => {
      const list = bySegment.get(item.resolved.hostSegmentId) ?? [];
      list.push({
        roughOpeningStartMeters: item.resolved.roughOpeningStartMeters,
        roughOpeningEndMeters: item.resolved.roughOpeningEndMeters,
      });
      bySegment.set(item.resolved.hostSegmentId, list);
    });
    if (openingPreview?.resolvedPlacement) {
      const preview = openingPreview.resolvedPlacement;
      const list = bySegment.get(preview.hostSegmentId) ?? [];
      const alreadyListed = list.some(
        (gap) =>
          Math.abs(gap.roughOpeningStartMeters - preview.roughOpeningStartMeters) < 0.001 &&
          Math.abs(gap.roughOpeningEndMeters - preview.roughOpeningEndMeters) < 0.001,
      );
      if (!alreadyListed) {
        list.push({
          roughOpeningStartMeters: preview.roughOpeningStartMeters,
          roughOpeningEndMeters: preview.roughOpeningEndMeters,
        });
      }
      bySegment.set(preview.hostSegmentId, list);
    }
    return bySegment;
  }, [openingItems, openingPreview]);

  const openingRenderItems = useMemo(
    () =>
      openingItems.map((item) => {
        const frame = framesBySegmentId.get(item.resolved.hostSegmentId);
        if (!frame) return null;
        return buildPlanOpeningRenderItem({
          key: item.openingId,
          openingType: item.openingType,
          resolved: item.resolved,
          frame,
          isValid: item.isValid,
          statusKind: item.statusKind,
          selected: selectedOpeningId === item.openingId,
          hovered: hoveredOpeningId === item.openingId,
          placing: false,
          zoom: viewport.zoom,
          swingDirection: item.swingDirection,
          swingType: item.swingType,
        });
      }).filter((item): item is NonNullable<typeof item> => item != null),
    [framesBySegmentId, hoveredOpeningId, openingItems, selectedOpeningId, viewport.zoom],
  );

  const previewRenderItem = useMemo(() => {
    if (!openingPreview) return null;
    const frame = framesBySegmentId.get(openingPreview.resolvedPlacement.hostSegmentId);
    if (!frame) return null;
    return buildPlanOpeningRenderItem({
      key: 'placement-preview',
      openingType: openingPreview.openingType,
      resolved: openingPreview.resolvedPlacement,
      frame,
      isValid: openingPreview.isValid,
      statusKind: openingPreview.statusKind,
      selected: false,
      hovered: false,
      placing: true,
      zoom: viewport.zoom,
      swingDirection: openingPreview.swingDirection,
      swingType: openingPreview.swingType,
    });
  }, [framesBySegmentId, openingPreview, viewport.zoom]);

  const emitSegmentPick = useCallback(
    (phase: 'preview' | 'commit', point: { x: number; z: number }) => {
      onInteraction({
        kind: 'segment_pick',
        toolMode,
        phase,
        planX: point.x,
        planZ: point.z,
      });
    },
    [onInteraction, toolMode],
  );

  const updateHoveredOpening = useCallback(
    (point: { x: number; z: number } | null) => {
      if (!point || openingItems.length === 0) {
        setHoveredOpeningId(null);
        return;
      }
      let bestId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      openingItems.forEach((item) => {
        const frame = framesBySegmentId.get(item.resolved.hostSegmentId);
        if (!frame) return;
        const geometry = buildPlanOpeningGeometry(item.resolved, frame);
        if (!hitTestPlanOpeningGeometry({ planX: point.x, planZ: point.z, geometry })) return;
        const distance = Math.hypot(point.x - geometry.center.x, point.z - geometry.center.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = item.openingId;
        }
      });
      setHoveredOpeningId(bestId);
    },
    [framesBySegmentId, openingItems],
  );

  const contentBounds = useMemo(() => {
    if (layoutBounds) {
      return {
        minX: layoutBounds.minX,
        maxX: layoutBounds.maxX,
        minZ: layoutBounds.minZ,
        maxZ: layoutBounds.maxZ,
      };
    }
    if (layout.nodes.length === 0) return null;
    const xs = layout.nodes.map((node) => node.x);
    const zs = layout.nodes.map((node) => node.z);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
  }, [layout.nodes, layoutBounds]);

  const controller = useMemo(
    () => createPlanCameraController(viewport, surfaceSize),
    [surfaceSize, viewport],
  );

  const displayMinorRef = useRef<number | undefined>(undefined);
  const resolvedSnapSpacing = Math.max(0.001, snapSpacingMeters ?? layout.gridSpacingMeters);
  const planGridState = useMemo(() => {
    const next = computePlanGridState(viewport, surfaceSize, resolvedSnapSpacing, displayMinorRef.current);
    displayMinorRef.current = next.displayMinorSpacingMeters;
    return next;
  }, [resolvedSnapSpacing, surfaceSize, viewport]);

  const visibleBounds = controller.visibleWorldBounds();
  const minorGridStep = planGridState.displayMinorSpacingMeters;
  const majorGridStep = planGridState.displayMajorSpacingMeters;
  const minorCellPx = projectCellWidthPx(minorGridStep, viewport);
  const showMinorGrid = minorCellPx >= MIN_CELL_PX;

  const planToSurfacePoint = useCallback(
    (point: { x: number; z: number }) => {
      const screen = controller.planToScreenPoint(point);
      return { sx: screen.x, sy: screen.y };
    },
    [controller],
  );

  const screenFromEvent = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      if (eventSurfaceSize.width > 0 && eventSurfaceSize.height > 0) {
        setSurfaceSize((current) =>
          Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
            ? current
            : eventSurfaceSize,
        );
      }
      return createPlanCameraController(viewport, eventSurfaceSize).screenToPlanPoint(event.clientX, event.clientY, rect.left, rect.top);
    },
    [viewport],
  );

  const updateSurfaceSize = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    setSurfaceSize((current) =>
      Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5
        ? current
        : { width: rect.width, height: rect.height },
    );
  }, []);

  useEffect(() => {
    if (!viewCommand || lastViewCommandIdRef.current === viewCommand.id) return;
    lastViewCommandIdRef.current = viewCommand.id;
    if (viewCommand.action === 'reset') {
      onViewportChange?.(resetPlanView());
      return;
    }
    if (viewCommand.action === 'grid_scale') {
      return;
    }
    const nextViewport = fitPlanToLayout(layoutBounds, surfaceSize);
    logDesignFramingDiagnostics({
      mode: 'plan',
      bounds: layoutBounds,
      cameraTargetX: nextViewport.centerX,
      cameraTargetZ: nextViewport.centerZ,
    });
    onViewportChange?.(nextViewport);
  }, [layout.gridSpacingMeters, layoutBounds, onViewportChange, surfaceSize, viewCommand, viewport]);

  useEffect(() => {
    updateSurfaceSize();
    const svg = svgRef.current;
    if (!svg) return undefined;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSurfaceSize);
      return () => window.removeEventListener('resize', updateSurfaceSize);
    }
    const observer = new ResizeObserver(updateSurfaceSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [updateSurfaceSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const planSurface = svgRef.current;
    if (!planSurface) return undefined;
    const onPlanWheel = (event: WheelEvent) => {
      if (!planSurface.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = planSurface.getBoundingClientRect();
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      setSurfaceSize((current) =>
        Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
          ? current
          : eventSurfaceSize,
      );
      onUserViewportChange?.();
      onViewportChange?.(
        createPlanCameraController(viewport, eventSurfaceSize).zoomAtPointer(event.clientX, event.clientY, event.deltaY, rect.left, rect.top),
      );
    };
    planSurface.addEventListener('wheel', onPlanWheel, { passive: false });
    return () => planSurface.removeEventListener('wheel', onPlanWheel);
  }, [onUserViewportChange, onViewportChange, viewport]);


  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      const next = controller.panByPointerDelta(event.clientX - panDragRef.current.x, event.clientY - panDragRef.current.y);
      panDragRef.current = { x: event.clientX, y: event.clientY };
      onUserViewportChange?.();
      onViewportChange?.(next);
      return;
    }
    const point = screenFromEvent(event);
    if (!point) return;
    if (toolMode === 'select' || toolMode === 'move_opening') {
      updateHoveredOpening(point);
    } else {
      setHoveredOpeningId(null);
    }
    if (toolMode === 'draw_wall') {
      onInteraction({
        kind: 'draw_preview',
        toolMode,
        phase: 'preview',
        planX: point.x,
        planZ: point.z,
        nodeId: activeNodeId ?? undefined,
        shiftHeld: event.shiftKey,
        altHeld: event.altKey,
      });
    }
    if (toolMode === 'move_wall_node' && activeNodeId) {
      onInteraction({
        kind: 'move_node',
        toolMode,
        phase: 'preview',
        planX: point.x,
        planZ: point.z,
        nodeId: activeNodeId,
      });
    }
    if (toolMode === 'place_door' || toolMode === 'place_window' || (toolMode === 'move_opening' && selectedOpeningId)) {
      emitSegmentPick('preview', point);
    }
  };

  const handleContextMenu = (event: PointerEvent<SVGSVGElement>) => {
    if (toolMode !== 'draw_wall') return;
    event.preventDefault();
    onInteraction({ kind: 'undo_last_segment', toolMode });
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceHeldRef.current)) {
      event.preventDefault();
      panDragRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const point = screenFromEvent(event);
    if (!point) return;
    if (toolMode === 'draw_wall') {
      onInteraction({
        kind: 'draw_point',
        toolMode,
        phase: event.detail === 2 ? 'commit' : 'commit',
        planX: point.x,
        planZ: point.z,
        nodeId: activeNodeId ?? undefined,
        shiftHeld: event.shiftKey,
        altHeld: event.altKey,
      });
      return;
    }
    if (toolMode === 'move_wall_node') {
      const hitNode = layout.nodes.find((node) => Math.hypot(node.x - point.x, node.z - point.z) < 0.25);
      if (hitNode) {
        onInteraction({ kind: 'select_node', toolMode, nodeId: hitNode.id });
      }
      return;
    }
    if (toolMode === 'place_door' || toolMode === 'place_window') {
      emitSegmentPick('preview', point);
      return;
    }
    if (toolMode === 'move_opening' && selectedOpeningId) {
      emitSegmentPick('preview', point);
      return;
    }
    if (toolMode === 'select' || toolMode === 'delete') {
      const hitNode = layout.nodes.find((node) => Math.hypot(node.x - point.x, node.z - point.z) < 0.25);
      if (hitNode) {
        onInteraction({ kind: 'select_node', toolMode, nodeId: hitNode.id });
        return;
      }
      onInteraction({
        kind: 'segment_pick',
        toolMode,
        phase: 'commit',
        planX: point.x,
        planZ: point.z,
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      panDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (toolMode === 'place_door' || toolMode === 'place_window') {
      const point = screenFromEvent(event);
      if (!point) return;
      emitSegmentPick('commit', point);
      return;
    }
    if (toolMode === 'move_opening' && selectedOpeningId) {
      const point = screenFromEvent(event);
      if (!point) return;
      emitSegmentPick('commit', point);
      return;
    }
    if (toolMode !== 'move_wall_node' || !activeNodeId) return;
    const point = screenFromEvent(event);
    if (!point) return;
    onInteraction({
      kind: 'move_node',
      toolMode,
      phase: 'commit',
      planX: point.x,
      planZ: point.z,
      nodeId: activeNodeId,
    });
  };

  const isMajorGridLine = (value: number, majorStep: number) =>
    Math.abs(value / majorStep - Math.round(value / majorStep)) < Math.max(majorStep * 0.001, 0.0001);

  const gridLines = [];
  for (let x = Math.floor(visibleBounds.minX / minorGridStep) * minorGridStep; x <= visibleBounds.maxX; x += minorGridStep) {
    const major = isMajorGridLine(x, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = planToSurfacePoint({ x, z: visibleBounds.minZ });
    const end = planToSurfacePoint({ x, z: visibleBounds.maxZ });
    gridLines.push(
      <line
        key={`gx-${x}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke="currentColor"
        strokeOpacity={major ? 0.18 : 0.08}
        strokeWidth={major ? 1.25 : 1}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
        data-grid-spacing-meters={major ? majorGridStep : minorGridStep}
      />,
    );
  }
  for (let z = Math.floor(visibleBounds.minZ / minorGridStep) * minorGridStep; z <= visibleBounds.maxZ; z += minorGridStep) {
    const major = isMajorGridLine(z, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = planToSurfacePoint({ x: visibleBounds.minX, z });
    const end = planToSurfacePoint({ x: visibleBounds.maxX, z });
    gridLines.push(
      <line
        key={`gz-${z}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke="currentColor"
        strokeOpacity={major ? 0.18 : 0.08}
        strokeWidth={major ? 1.25 : 1}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
        data-grid-spacing-meters={major ? majorGridStep : minorGridStep}
      />,
    );
  }

  const activeNodeRaw = layout.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activeNode = activeNodeRaw
    ? (planDisplayNodeById.get(activeNodeRaw.id) ?? { x: activeNodeRaw.x, z: activeNodeRaw.z })
    : null;
  const drawGuidance = activeNode && draftEnd && toolMode === 'draw_wall' && layout.orthogonalLock
    ? resolveDrawWallGuidance({
        layout,
        activeNodeId: activeNode.id,
        rawPoint: draftEnd,
        orthogonalLock: true,
      })
    : null;
  const orthogonalGuideRays = useMemo(() => {
    if (!activeNode || toolMode !== 'draw_wall' || !layout.orthogonalLock) return [];
    const rayLength = Math.max(4, Math.max(surfaceSize.width, surfaceSize.height) / Math.max(1, viewport.zoom) * 0.35);
    const directions = listOrthogonalGuideDirections({
      layout,
      activeNodeId: activeNode.id,
    });
    return directions.map((candidate) => ({
      start: activeNode,
      end: {
        x: activeNode.x + candidate.direction.x * rayLength,
        z: activeNode.z + candidate.direction.z * rayLength,
      },
      label: candidate.label,
    }));
  }, [activeNode, layout, surfaceSize.height, surfaceSize.width, toolMode, viewport.zoom]);
  const previewLength = activeNode && draftEnd ? Math.hypot(draftEnd.x - activeNode.x, draftEnd.z - activeNode.z) : 0;
  const invalidPreview = Boolean(activeNode && draftEnd && previewLength < MIN_SEGMENT_LENGTH_METERS);
  const shiftConstrained = Boolean(shiftConstraintLabel);
  const previewMidpoint = activeNode && draftEnd ? planToSurfacePoint({ x: (activeNode.x + draftEnd.x) / 2, z: (activeNode.z + draftEnd.z) / 2 }) : null;
  const snapMarker = draftEnd ? planToSurfacePoint(draftEnd) : null;
  const closureAssistMarker = orthogonalClosureAssist?.isEligible
    ? planToSurfacePoint(orthogonalClosureAssist.candidatePoint)
    : null;
  const closureCornerMarker = closureCornerSnap ? planToSurfacePoint(closureCornerSnap.point) : null;
  const closureAssistMidpoint =
    orthogonalClosureAssist?.isEligible
      ? planToSurfacePoint({
          x: (orthogonalClosureAssist.candidatePoint.x + orthogonalClosureAssist.firstNode.x) / 2,
          z: (orthogonalClosureAssist.candidatePoint.z + orthogonalClosureAssist.firstNode.z) / 2,
        })
      : null;
  const snapCaptured = Boolean(snapTarget?.captured && snapTarget.type !== 'raw');
  const closureAssistActive = Boolean(orthogonalClosureAssist?.isEligible);
  const originPoint = planToSurfacePoint({ x: 0, z: 0 });
  const xAxisStart = planToSurfacePoint({ x: visibleBounds.minX, z: 0 });
  const xAxisEnd = planToSurfacePoint({ x: visibleBounds.maxX, z: 0 });
  const yAxisStart = planToSurfacePoint({ x: 0, z: visibleBounds.minZ });
  const yAxisEnd = planToSurfacePoint({ x: 0, z: visibleBounds.maxZ });

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700">
      <div
        className="absolute left-3 top-3 rounded-full border border-cyan-700 bg-slate-900/90 px-3 py-1 text-xs font-medium text-cyan-200"
        data-view-grid-meters={planGridState.displayMinorSpacingMeters}
        data-snap-spacing-meters={planGridState.snapSpacingMeters}
      >
        {toolMode === 'draw_wall'
          ? formatDrawWallStatusChip({
              snapMode,
              gridSpacingMeters: layout.gridSpacingMeters,
              orthogonalLock: layout.orthogonalLock,
              shiftConstraintLabel,
              snapTarget,
            })
          : (
            <>
              Plan layout · {layout.dimensionBasis === 'outside_face' ? 'Outside face' : layout.dimensionBasis} · View grid{' '}
              {formatPlanGridSpacingMeters(planGridState.displayMinorSpacingMeters)} · Snap{' '}
              {snapMode === 'off' ? 'off' : formatPlanGridSpacingMeters(planGridState.snapSpacingMeters)}
            </>
          )}
      </div>
      {layout.segments.length === 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
          {DESIGN_BUILDER_COPY.hints.blankPlan}
        </div>
      ) : null}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
        preserveAspectRatio="none"
        className="plan-surface h-full w-full overscroll-contain touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        aria-label="Design Builder wall layout plan view"
      >
        <rect width={surfaceSize.width} height={surfaceSize.height} fill="#0f172a" />
        {gridLines}
        <line x1={xAxisStart.sx} y1={xAxisStart.sy} x2={xAxisEnd.sx} y2={xAxisEnd.sy} stroke="#334155" strokeWidth={1.5} strokeOpacity={0.85} pointerEvents="none" data-axis="x" />
        <line x1={yAxisStart.sx} y1={yAxisStart.sy} x2={yAxisEnd.sx} y2={yAxisEnd.sy} stroke="#334155" strokeWidth={1.5} strokeOpacity={0.85} pointerEvents="none" data-axis="y" />
        <line x1={originPoint.sx - 10} y1={originPoint.sy} x2={originPoint.sx + 10} y2={originPoint.sy} stroke="#22d3ee" strokeWidth={2} pointerEvents="none" data-origin-crosshair="x" />
        <line x1={originPoint.sx} y1={originPoint.sy - 10} x2={originPoint.sx} y2={originPoint.sy + 10} stroke="#22d3ee" strokeWidth={2} pointerEvents="none" data-origin-crosshair="y" />
        <circle cx={originPoint.sx} cy={originPoint.sy} r={4} fill="#22d3ee" pointerEvents="none" data-origin-marker="true" />
        <text x={originPoint.sx + 8} y={originPoint.sy - 8} fill="#67e8f9" fontSize={10} fontWeight={700} pointerEvents="none">0,0</text>
        <text x={xAxisEnd.sx - 6} y={originPoint.sy - 6} textAnchor="end" fill="#64748b" fontSize={10} fontWeight={600} pointerEvents="none">+X East</text>
        <text x={originPoint.sx + 6} y={yAxisStart.sy + 14} fill="#64748b" fontSize={10} fontWeight={600} pointerEvents="none">+Y North</text>
        {PLAN_RULER_TICKS_METERS.flatMap((tick) => {
          const marks = [];
          if (tick >= visibleBounds.minX && tick <= visibleBounds.maxX) {
            const alongX = planToSurfacePoint({ x: tick, z: 0 });
            marks.push(
              <g key={`tick-x-${tick}`} pointerEvents="none">
                <line x1={alongX.sx} y1={originPoint.sy - 4} x2={alongX.sx} y2={originPoint.sy + 4} stroke="#475569" strokeWidth={1} />
                <text x={alongX.sx} y={originPoint.sy + 14} textAnchor="middle" fill="#64748b" fontSize={9}>{tick} m</text>
              </g>,
            );
          }
          if (tick !== 0 && tick >= visibleBounds.minZ && tick <= visibleBounds.maxZ) {
            const alongZ = planToSurfacePoint({ x: 0, z: tick });
            marks.push(
              <g key={`tick-z-${tick}`} pointerEvents="none">
                <line x1={originPoint.sx - 4} y1={alongZ.sy} x2={originPoint.sx + 4} y2={alongZ.sy} stroke="#475569" strokeWidth={1} />
                <text x={originPoint.sx - 8} y={alongZ.sy + 3} textAnchor="end" fill="#64748b" fontSize={9}>{tick} m</text>
              </g>,
            );
          }
          return marks;
        })}
        <text x={surfaceSize.width / 2} y={18} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={700} pointerEvents="none">North (+Y)</text>
        <text x={surfaceSize.width / 2} y={surfaceSize.height - 10} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={700} pointerEvents="none">South</text>
        <text x={surfaceSize.width - 12} y={surfaceSize.height / 2} textAnchor="end" fill="#64748b" fontSize={11} fontWeight={700} pointerEvents="none">East (+X)</text>
        <text x={12} y={surfaceSize.height / 2} textAnchor="start" fill="#64748b" fontSize={11} fontWeight={700} pointerEvents="none">West</text>
        {layout.segments.map((segment) => {
          const endpoints = resolveSegmentDisplayEndpoints({
            segment,
            layout,
            planDisplayNodeById,
          });
          if (!endpoints) return null;
          const { displayStart, displayEnd } = endpoints;
          const selected = selectedSegmentId === segment.id;
          const stroke = toolMode === 'delete' && selected ? '#f97316' : selected ? '#22d3ee' : '#94a3b8';
          const strokeWidth = selected ? 6 : 4;
          const frame = framesBySegmentId.get(segment.id);
          const roughOpenings = roughOpeningsBySegmentId.get(segment.id) ?? [];
          if (frame && roughOpenings.length > 0) {
            const runs = buildWallRunsExcludingRoughOpenings({
              segmentLengthMeters: frame.lengthMeters,
              roughOpenings,
            });
            return (
              <g key={segment.id}>
                {runs.map((run, index) => {
                  const runEndpoints = resolvePlanWallRunEndpoints({
                    frame,
                    run,
                    displayStart,
                    displayEnd,
                  });
                  const runStart = planToSurfacePoint(runEndpoints.start);
                  const runEnd = planToSurfacePoint(runEndpoints.end);
                  return (
                    <g key={`${segment.id}-run-${index}`}>
                      <line
                        x1={runStart.sx}
                        y1={runStart.sy}
                        x2={runEnd.sx}
                        y2={runEnd.sy}
                        stroke="transparent"
                        strokeWidth={18}
                        strokeLinecap="round"
                        pointerEvents="none"
                        data-selectable="true"
                        data-selectable-type="wall_segment"
                        data-segment-id={segment.id}
                      />
                      <line
                        x1={runStart.sx}
                        y1={runStart.sy}
                        x2={runEnd.sx}
                        y2={runEnd.sy}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        pointerEvents="none"
                        data-segment-id={segment.id}
                        data-wall-run="true"
                        data-plan-wall-visible="true"
                      />
                    </g>
                  );
                })}
              </g>
            );
          }
          const a = planToSurfacePoint(displayStart);
          const b = planToSurfacePoint(displayEnd);
          return (
            <g key={segment.id}>
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke="transparent"
                strokeWidth={18}
                strokeLinecap="round"
                pointerEvents="none"
                data-selectable="true"
                data-selectable-type="wall_segment"
                data-segment-id={segment.id}
              />
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                pointerEvents="none"
                data-plan-wall-visible="true"
              />
            </g>
          );
        })}
        {openingRenderItems.map((item) => (
          <PlanOpeningSymbol key={item.key} item={item} project={planToSurfacePoint} zoom={viewport.zoom} />
        ))}
        {previewRenderItem ? (
          <PlanOpeningSymbol item={previewRenderItem} project={planToSurfacePoint} zoom={viewport.zoom} />
        ) : null}
        {orthogonalGuideRays.map((guide, index) => {
          const start = planToSurfacePoint(guide.start);
          const end = planToSurfacePoint(guide.end);
          return (
            <line
              key={`perpendicular-guide-${index}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke="#22d3ee"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="6 6"
              pointerEvents="none"
            />
          );
        })}
        {drawGuidance?.guideLine && !shiftConstrained ? (
          (() => {
            const start = planToSurfacePoint(drawGuidance.guideLine.start);
            const end = planToSurfacePoint(drawGuidance.guideLine.end);
            return (
              <line
                x1={start.sx}
                y1={start.sy}
                x2={end.sx}
                y2={end.sy}
                stroke="#22d3ee"
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeDasharray="8 5"
                pointerEvents="none"
              />
            );
          })()
        ) : null}
        {orthogonalClosureAssist?.isEligible ? (
          (() => {
            const start = planToSurfacePoint(orthogonalClosureAssist.candidatePoint);
            const end = planToSurfacePoint(orthogonalClosureAssist.firstNode);
            return (
              <>
                <line
                  x1={start.sx}
                  y1={start.sy}
                  x2={end.sx}
                  y2={end.sy}
                  stroke="#67e8f9"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray="5 7"
                  strokeLinecap="round"
                  pointerEvents="none"
                  data-orthogonal-closure-assist="true"
                />
                {closureAssistMidpoint ? (
                  <text
                    x={closureAssistMidpoint.sx + 8}
                    y={closureAssistMidpoint.sy + 14}
                    fill="#7dd3fc"
                    fontSize={11}
                    fontWeight={600}
                    paintOrder="stroke"
                    stroke="#0f172a"
                    strokeWidth={3}
                    pointerEvents="none"
                    data-orthogonal-closure-label="true"
                  >
                    {`Final leg: ${orthogonalClosureAssist.closingLengthMeters.toFixed(2)} m · ${orthogonalClosureAssist.closingAngleDegrees}°`}
                  </text>
                ) : null}
              </>
            );
          })()
        ) : null}
        {activeNode && draftEnd ? (
          (() => {
            const a = planToSurfacePoint(activeNode);
            const b = planToSurfacePoint(draftEnd);
            return (
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={invalidPreview ? '#fb7185' : shiftConstrained ? '#22d3ee' : '#fbbf24'}
                strokeWidth={shiftConstrained ? 3 : 3}
                strokeDasharray={shiftConstrained ? undefined : '8 6'}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })()
        ) : null}
        {snapMarker ? (
          <circle
            cx={snapMarker.sx}
            cy={snapMarker.sy}
            r={snapCaptured || closureAssistActive ? 7 : 6}
            fill={snapCaptured ? '#22d3ee' : closureAssistActive ? 'none' : 'none'}
            stroke={invalidPreview ? '#fb7185' : snapCaptured ? '#22d3ee' : closureAssistActive ? '#22d3ee' : '#fbbf24'}
            strokeOpacity={closureAssistActive && !snapCaptured ? 0.85 : 0.95}
            strokeWidth={snapCaptured || closureAssistActive ? 2.5 : 2}
            pointerEvents="none"
            data-snap-captured={snapCaptured ? 'true' : 'false'}
            data-closure-assist-marker={closureAssistActive ? 'true' : 'false'}
          />
        ) : null}
        {closureCornerMarker && !closureAssistActive ? (
          <circle
            cx={closureCornerMarker.sx}
            cy={closureCornerMarker.sy}
            r={7}
            fill={closureCornerSnap?.captured ? '#22d3ee' : 'none'}
            stroke="#22d3ee"
            strokeOpacity={0.85}
            strokeWidth={2.5}
            pointerEvents="none"
            data-closure-corner-snap="true"
          />
        ) : null}
        {previewMidpoint && previewLength > 0 ? (
          <text
            x={previewMidpoint.sx + 8}
            y={previewMidpoint.sy - 8}
            fill={invalidPreview ? '#fecdd3' : shiftConstrained ? '#a5f3fc' : '#fde68a'}
            fontSize={12}
            fontWeight={700}
            paintOrder="stroke"
            stroke="#0f172a"
            strokeWidth={4}
            pointerEvents="none"
          >
            {`${(previewMetrics?.lengthMeters ?? previewLength).toFixed(2)} m · ${(previewMetrics?.angleDegrees ?? 0).toFixed(0)}°`}
          </text>
        ) : null}
        {(shiftConstraintLabel ?? drawGuidance?.label) && snapMarker ? (
          <text
            x={snapMarker.sx + 12}
            y={snapMarker.sy - 14}
            fill="#67e8f9"
            fontSize={12}
            fontWeight={800}
            paintOrder="stroke"
            stroke="#0f172a"
            strokeWidth={4}
            pointerEvents="none"
          >
            {shiftConstraintLabel ?? drawGuidance?.label}
          </text>
        ) : null}
        {resolvedRoofSystem?.supported && resolvedRoofSystem.eaveFootprint.length >= 3 ? (
          <>
            <polygon
              points={resolvedRoofSystem.eaveFootprint
                .map((point) => {
                  const surface = planToSurfacePoint({ x: point.x, z: point.z });
                  return `${surface.sx},${surface.sy}`;
                })
                .join(' ')}
              fill="none"
              stroke={
                selectedObjectType === 'gable_roof_system' || selectedObjectType === 'gable_end_system'
                  ? '#14b8a6'
                  : '#64748b'
              }
              strokeOpacity={selectedObjectType === 'gable_roof_system' ? 0.95 : 0.45}
              strokeWidth={selectedObjectType === 'gable_roof_system' ? 2 : 1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
            {resolvedRoofSystem.ridgeStart && resolvedRoofSystem.ridgeEnd ? (
              <line
                x1={planToSurfacePoint({
                  x: resolvedRoofSystem.ridgeStart.x,
                  z: resolvedRoofSystem.ridgeStart.z,
                }).sx}
                y1={planToSurfacePoint({
                  x: resolvedRoofSystem.ridgeStart.x,
                  z: resolvedRoofSystem.ridgeStart.z,
                }).sy}
                x2={planToSurfacePoint({
                  x: resolvedRoofSystem.ridgeEnd.x,
                  z: resolvedRoofSystem.ridgeEnd.z,
                }).sx}
                y2={planToSurfacePoint({
                  x: resolvedRoofSystem.ridgeEnd.x,
                  z: resolvedRoofSystem.ridgeEnd.z,
                }).sy}
                stroke={selectedObjectType === 'gable_roof_system' ? '#14b8a6' : '#94a3b8'}
                strokeOpacity={selectedObjectType === 'gable_roof_system' ? 0.95 : 0.55}
                strokeWidth={selectedObjectType === 'gable_roof_system' ? 2.5 : 1.5}
                pointerEvents="none"
              />
            ) : null}
            {resolvedRoofSystem.trussStations.length > 0 && resolvedRoofSystem.ridgeStart && resolvedRoofSystem.ridgeEnd
              ? resolvedRoofSystem.trussStations.map((station, index) => {
                  const ridgeAlongX =
                    Math.abs(resolvedRoofSystem.ridgeEnd!.x - resolvedRoofSystem.ridgeStart!.x) >
                    Math.abs(resolvedRoofSystem.ridgeEnd!.z - resolvedRoofSystem.ridgeStart!.z);
                  const bounds = resolvedRoofSystem.exteriorRoofBeamBounds;
                  const minX = Math.min(...bounds.footprint.map((point) => point.x));
                  const minZ = Math.min(...bounds.footprint.map((point) => point.z));
                  const maxZ = Math.max(...bounds.footprint.map((point) => point.z));
                  const maxX = Math.max(...bounds.footprint.map((point) => point.x));
                  const planPoint = ridgeAlongX
                    ? { x: minX + station, z: (minZ + maxZ) / 2 }
                    : { x: (minX + maxX) / 2, z: minZ + station };
                  const surface = planToSurfacePoint(planPoint);
                  return (
                    <line
                      key={`truss-station-${index}`}
                      x1={surface.sx - 4}
                      y1={surface.sy}
                      x2={surface.sx + 4}
                      y2={surface.sy}
                      stroke={selectedObjectType === 'gable_roof_system' ? '#14b8a6' : '#64748b'}
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  );
                })
              : null}
            {resolvedRoofSystem.gableEndSegmentIds.map((segmentId) => {
              const frame = framesBySegmentId.get(segmentId);
              if (!frame) return null;
              const midpoint = planToSurfacePoint({
                x: (frame.start.x + frame.end.x) / 2,
                z: (frame.start.z + frame.end.z) / 2,
              });
              return (
                <circle
                  key={`gable-end-${segmentId}`}
                  cx={midpoint.sx}
                  cy={midpoint.sy}
                  r={selectedObjectType === 'gable_end_system' ? 5 : 3}
                  fill={selectedObjectType === 'gable_end_system' ? '#14b8a6' : '#94a3b8'}
                  fillOpacity={0.85}
                  pointerEvents="none"
                />
              );
            })}
          </>
        ) : null}
        {frameSystem?.beams.map((beam) => {
            const start = planToSurfacePoint({ x: beam.startPoint.x, z: beam.startPoint.z });
            const end = planToSurfacePoint({ x: beam.endPoint.x, z: beam.endPoint.z });
            const stroke =
              beam.kind === 'plinth_beam' || beam.kind === 'grade_beam'
                ? '#57534e'
                : beam.kind === 'tie_beam'
                  ? '#44403c'
                  : beam.kind === 'roof_beam' || beam.kind === 'ring_beam'
                    ? '#6b7280'
                    : '#78716c';
            return (
              <line
                key={beam.id}
                x1={start.sx}
                y1={start.sy}
                x2={end.sx}
                y2={end.sy}
                stroke={stroke}
                strokeWidth={Math.max(4, beam.widthMeters * viewport.scale)}
                strokeLinecap="butt"
                pointerEvents="none"
              />
            );
          })}
        {isolatedFootings.map((footing) => {
          const center = planToSurfacePoint(footing.position);
          const halfW = (footing.widthMeters * viewport.scale) / 2;
          const halfL = (footing.lengthMeters * viewport.scale) / 2;
          return (
            <rect
              key={footing.id}
              x={center.sx - halfW}
              y={center.sy - halfL}
              width={halfW * 2}
              height={halfL * 2}
              fill="#78716c55"
              stroke="#57534e"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          );
        })}
        {frameSystem?.columns.map((column) => {
          const center = planToSurfacePoint(column.position);
          const halfW = (column.widthMeters * viewport.scale) / 2;
          const halfD = (column.depthMeters * viewport.scale) / 2;
          return (
            <rect
              key={column.id}
              x={center.sx - halfW}
              y={center.sy - halfD}
              width={halfW * 2}
              height={halfD * 2}
              fill="#9ca3af"
              stroke="#334155"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          );
        })}
        {layout.nodes.map((node) => {
          const displayPoint = planDisplayNodeById.get(node.id) ?? node;
          const point = planToSurfacePoint(displayPoint);
          const selected = selectedNodeId === node.id || activeNodeId === node.id;
          return (
            <circle
              key={node.id}
              cx={point.sx}
              cy={point.sy}
              r={selected ? 8 : 5}
              fill={selected ? '#22d3ee' : '#e2e8f0'}
              stroke="#0f172a"
              strokeWidth={2}
              pointerEvents="none"
              data-plan-node-id={node.id}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-[11px] font-bold text-slate-100 shadow-sm" aria-label="Plan orientation north up">
        <div className="flex items-center gap-2">
          <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden>
            <path d="M14 3 L22 17 H16 V31 H12 V17 H6 Z" fill="#22d3ee" />
            <path d="M14 31 H24" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div>N</div>
            <div className="text-[10px] font-semibold text-slate-400">North up</div>
          </div>
        </div>
      </div>
    </div>
  );
}
