import { useCallback, useMemo, useRef, type PointerEvent } from 'react';
import type {
  CmuWallSystemParameters,
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  DesignWallLayoutParameters,
  ManualMasonryPlacementPreview,
  MasonryCourseRun,
  MasonryToolMode,
} from '../types';
import { screenPointerToPlanPoint } from '../domain/pointerPlanMapping';
import { ENDPOINT_SNAP_TOLERANCE_METERS } from '../domain/wallLayoutRules';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { unitModuleSpan } from '../domain/manualMasonryRules';

const PIXELS_PER_METER = 48;
const MIN_SEGMENT_LENGTH_METERS = 0.08;

interface DesignBuilderPlanCanvasProps {
  layout: DesignWallLayoutParameters;
  toolMode: DesignBuilderToolMode;
  draftEnd?: { x: number; z: number } | null;
  activeNodeId?: string | null;
  drawStartNodeId?: string | null;
  selectedSegmentId?: string | null;
  selectedNodeId?: string | null;
  manualMasonry?: {
    enabled: boolean;
    tool: MasonryToolMode;
    wall: CmuWallSystemParameters;
    runs: MasonryCourseRun[];
    preview: ManualMasonryPlacementPreview | null;
  };
  onInteraction: (event: DesignBuilderInteractionEvent) => void;
  onManualMasonryPointer?: (event: {
    kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo';
    planX?: number;
    planZ?: number;
  }) => void;
}

function toScreen(x: number, z: number, centerX: number, centerY: number) {
  return {
    sx: centerX + x * PIXELS_PER_METER,
    sy: centerY - z * PIXELS_PER_METER,
  };
}

export default function DesignBuilderPlanCanvas({
  layout,
  toolMode,
  draftEnd = null,
  activeNodeId = null,
  drawStartNodeId = null,
  selectedSegmentId = null,
  selectedNodeId = null,
  manualMasonry,
  onInteraction,
  onManualMasonryPointer,
}: DesignBuilderPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const manualDragActiveRef = useRef(false);

  const bounds = useMemo(() => {
    if (layout.nodes.length === 0) {
      return { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
    }
    const xs = layout.nodes.map((node) => node.x);
    const zs = layout.nodes.map((node) => node.z);
    return {
      minX: Math.min(...xs) - 1,
      maxX: Math.max(...xs) + 1,
      minZ: Math.min(...zs) - 1,
      maxZ: Math.max(...zs) + 1,
    };
  }, [layout.nodes]);

  const viewBox = useMemo(() => {
    const width = (bounds.maxX - bounds.minX) * PIXELS_PER_METER + 80;
    const height = (bounds.maxZ - bounds.minZ) * PIXELS_PER_METER + 80;
    return { width, height, centerX: width / 2, centerY: height / 2 };
  }, [bounds]);

  const screenFromEvent = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return null;
      return screenPointerToPlanPoint(event, svg, viewBox.centerX, viewBox.centerY, PIXELS_PER_METER);
    },
    [viewBox.centerX, viewBox.centerY],
  );

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const point = screenFromEvent(event);
    if (!point) return;
    if (manualMasonry?.enabled) {
      onManualMasonryPointer?.({
        kind: 'preview',
        planX: point.x,
        planZ: point.z,
      });
      return;
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
  };

  const handleContextMenu = (event: PointerEvent<SVGSVGElement>) => {
    if (manualMasonry?.enabled) {
      event.preventDefault();
      onManualMasonryPointer?.({ kind: 'undo' });
      return;
    }
    if (toolMode !== 'draw_wall') return;
    event.preventDefault();
    onInteraction({ kind: 'undo_last_segment', toolMode });
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const point = screenFromEvent(event);
    if (!point) return;
    if (manualMasonry?.enabled) {
      event.preventDefault();
      manualDragActiveRef.current = true;
      onManualMasonryPointer?.({ kind: 'start', planX: point.x, planZ: point.z });
      return;
    }
    if (toolMode === 'draw_wall') {
      onInteraction({
        kind: 'draw_point',
        toolMode,
        phase: event.detail === 2 ? 'commit' : 'commit',
        planX: point.x,
        planZ: point.z,
        nodeId: activeNodeId ?? undefined,
        shiftHeld: event.shiftKey,
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
      onInteraction({
        kind: 'segment_pick',
        toolMode,
        phase: 'preview',
        planX: point.x,
        planZ: point.z,
      });
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
    if (manualMasonry?.enabled && manualDragActiveRef.current) {
      manualDragActiveRef.current = false;
      const point = screenFromEvent(event);
      if (!point) return;
      onManualMasonryPointer?.({ kind: 'commit', planX: point.x, planZ: point.z });
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

  const gridLines = [];
  const gridStep = layout.gridSpacingMeters || 0.5;
  for (let x = Math.floor(bounds.minX); x <= Math.ceil(bounds.maxX); x += gridStep) {
    const start = toScreen(x, bounds.minZ, viewBox.centerX, viewBox.centerY);
    const end = toScreen(x, bounds.maxZ, viewBox.centerX, viewBox.centerY);
    gridLines.push(<line key={`gx-${x}`} x1={start.sx} y1={start.sy} x2={end.sx} y2={end.sy} stroke="currentColor" strokeOpacity={0.08} />);
  }
  for (let z = Math.floor(bounds.minZ); z <= Math.ceil(bounds.maxZ); z += gridStep) {
    const start = toScreen(bounds.minX, z, viewBox.centerX, viewBox.centerY);
    const end = toScreen(bounds.maxX, z, viewBox.centerX, viewBox.centerY);
    gridLines.push(<line key={`gz-${z}`} x1={start.sx} y1={start.sy} x2={end.sx} y2={end.sy} stroke="currentColor" strokeOpacity={0.08} />);
  }

  const activeNode = layout.nodes.find((node) => node.id === activeNodeId) ?? null;
  const firstNode = drawStartNodeId ? layout.nodes.find((node) => node.id === drawStartNodeId) ?? null : null;
  const previewLength = activeNode && draftEnd ? Math.hypot(draftEnd.x - activeNode.x, draftEnd.z - activeNode.z) : 0;
  const closesFootprint =
    Boolean(firstNode && draftEnd && layout.segments.length >= 2 && Math.hypot(draftEnd.x - firstNode.x, draftEnd.z - firstNode.z) <= Math.max(ENDPOINT_SNAP_TOLERANCE_METERS, layout.gridSpacingMeters));
  const invalidPreview = Boolean(activeNode && draftEnd && previewLength < MIN_SEGMENT_LENGTH_METERS && !closesFootprint);
  const previewMidpoint = activeNode && draftEnd ? toScreen((activeNode.x + draftEnd.x) / 2, (activeNode.z + draftEnd.z) / 2, viewBox.centerX, viewBox.centerY) : null;
  const snapMarker = draftEnd ? toScreen(draftEnd.x, draftEnd.z, viewBox.centerX, viewBox.centerY) : null;
  const manualModule = manualMasonry ? resolveCmuModuleConfig(manualMasonry.wall) : null;
  const manualModuleLength = manualModule?.moduleLengthMeters ?? manualMasonry?.wall.blockLengthMeters ?? 0.4;
  const manualModuleDepth = manualModule?.nominalDepthMeters ?? manualMasonry?.wall.wallThicknessMeters ?? 0.19;
  const manualRuns = manualMasonry?.runs ?? [];
  const manualPreview = manualMasonry?.preview ?? null;

  function manualRunRects(run: MasonryCourseRun | ManualMasonryPlacementPreview, keyPrefix: string, preview = false) {
    const span = unitModuleSpan(run.unitType);
    const unitLength = manualModuleLength * span;
    return Array.from({ length: run.count }, (_, index) => {
      const x = run.originX + index * unitLength;
      const z = run.originZ;
      const topLeft = toScreen(x, z + manualModuleDepth, viewBox.centerX, viewBox.centerY);
      const bottomRight = toScreen(x + unitLength, z, viewBox.centerX, viewBox.centerY);
      return (
        <rect
          key={`${keyPrefix}-${index}`}
          x={topLeft.sx}
          y={topLeft.sy}
          width={bottomRight.sx - topLeft.sx}
          height={bottomRight.sy - topLeft.sy}
          rx={3}
          fill={preview ? 'rgba(34,211,238,0.22)' : 'rgba(34,211,238,0.38)'}
          stroke={preview ? '#fbbf24' : '#22d3ee'}
          strokeWidth={preview ? 2 : 1.5}
          strokeDasharray={preview ? '6 4' : undefined}
          pointerEvents="none"
        />
      );
    });
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700">
      <div className="absolute left-3 top-3 rounded-full border border-cyan-700 bg-slate-900/90 px-3 py-1 text-xs font-medium text-cyan-200">
        Plan layout · {layout.dimensionBasis === 'outside_face' ? 'Outside face' : layout.dimensionBasis}
      </div>
      {layout.segments.length === 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
          Choose Draw Wall to begin.
        </div>
      ) : null}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="h-full w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        aria-label="Design Builder wall layout plan view"
      >
        <rect width={viewBox.width} height={viewBox.height} fill="#0f172a" />
        {gridLines}
        {manualRuns.flatMap((run) => manualRunRects(run, run.id))}
        {manualPreview ? manualRunRects(manualPreview, 'manual-preview', true) : null}
        {layout.segments.map((segment) => {
          const start = layout.nodes.find((node) => node.id === segment.startNodeId);
          const end = layout.nodes.find((node) => node.id === segment.endNodeId);
          if (!start || !end) return null;
          const a = toScreen(start.x, start.z, viewBox.centerX, viewBox.centerY);
          const b = toScreen(end.x, end.z, viewBox.centerX, viewBox.centerY);
          const selected = selectedSegmentId === segment.id;
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
                data-selectable="true"
                data-selectable-type="wall_segment"
                data-segment-id={segment.id}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  const point = screenFromEvent(event);
                  if (!point) return;
                  onInteraction({
                    kind: 'segment_pick',
                    toolMode,
                    phase: 'commit',
                    planX: point.x,
                    planZ: point.z,
                  });
                }}
              />
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={toolMode === 'delete' && selected ? '#f97316' : selected ? '#22d3ee' : '#94a3b8'}
                strokeWidth={selected ? 6 : 4}
                strokeLinecap="round"
                pointerEvents="none"
              />
            </g>
          );
        })}
        {activeNode && draftEnd ? (
          (() => {
            const a = toScreen(activeNode.x, activeNode.z, viewBox.centerX, viewBox.centerY);
            const b = toScreen(draftEnd.x, draftEnd.z, viewBox.centerX, viewBox.centerY);
            return (
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={invalidPreview ? '#fb7185' : closesFootprint ? '#34d399' : '#fbbf24'}
                strokeWidth={3}
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            );
          })()
        ) : null}
        {snapMarker ? (
          <circle
            cx={snapMarker.sx}
            cy={snapMarker.sy}
            r={closesFootprint ? 8 : 6}
            fill="none"
            stroke={invalidPreview ? '#fb7185' : closesFootprint ? '#22d3ee' : '#fbbf24'}
            strokeOpacity={0.95}
            strokeWidth={closesFootprint ? 3 : 2.5}
          />
        ) : null}
        {previewMidpoint && previewLength > 0 ? (
          <text
            x={previewMidpoint.sx + 8}
            y={previewMidpoint.sy - 8}
            fill={invalidPreview ? '#fecdd3' : '#fde68a'}
            fontSize={12}
            fontWeight={700}
            paintOrder="stroke"
            stroke="#0f172a"
            strokeWidth={4}
          >
            {previewLength.toFixed(2)} m
          </text>
        ) : null}
        {layout.nodes.map((node) => {
          const point = toScreen(node.x, node.z, viewBox.centerX, viewBox.centerY);
          const selected = selectedNodeId === node.id || activeNodeId === node.id;
          return (
            <circle
              key={node.id}
              cx={point.sx}
              cy={point.sy}
              r={selected ? 8 : node.id === firstNode?.id && toolMode === 'draw_wall' ? 7 : 5}
              fill={selected ? '#22d3ee' : node.id === firstNode?.id && toolMode === 'draw_wall' ? '#34d399' : '#e2e8f0'}
              stroke="#0f172a"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
