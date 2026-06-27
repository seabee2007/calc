import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type {
  DesignBuilderElevationViewState,
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  ElevationFace,
  IsolatedFooting,
  PlacedDesignComponent,
  StructuralBeam,
  StructuralFrameSystemParameters,
  WallOpeningParameters,
} from '../types';
import type { DesignLayoutBounds } from '../domain/designLayoutBounds';
import type { HelperMeasurement } from '../domain/designComponentPlacement';
import {
  buildDesignRenderModel,
  coordinateLabelForElevationFace,
  elevationStationForPoint,
  type DesignRenderModel,
  type DesignRenderRcComponent,
} from '../domain/designRenderModel';
import {
  DEFAULT_PLAN_VIEWPORT,
  createPlanCameraController,
  fitPlanViewportToBounds,
  type PlanViewportBounds,
  type PlanViewportState,
} from '../domain/pointerPlanMapping';
import {
  MIN_CELL_PX,
  computePlanGridState,
  formatPlanGridSpacingMeters,
  projectCellWidthPx,
} from '../domain/planGridState';

const FALLBACK_SURFACE_SIZE = { width: 900, height: 520 };
const DEFAULT_ELEVATION_GRID_SPACING_METERS = 0.5;

interface DesignBuilderElevationCanvasProps {
  toolMode: DesignBuilderToolMode;
  elevationView: DesignBuilderElevationViewState;
  layoutBounds?: DesignLayoutBounds | null;
  viewCommand?: { id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null;
  frameSystem?: StructuralFrameSystemParameters;
  isolatedFootings?: readonly IsolatedFooting[];
  openings?: readonly WallOpeningParameters[];
  placedComponents?: readonly PlacedDesignComponent[];
  componentPreview?: PlacedDesignComponent | null;
  designRenderModel?: DesignRenderModel;
  helperMeasurements?: readonly HelperMeasurement[];
  onElevationViewChange?: (view: DesignBuilderElevationViewState) => void;
  onComponentPointer?: (event: { phase: 'preview' | 'commit'; xMeters: number; zMeters: number }) => void;
  onInteraction: (event: DesignBuilderInteractionEvent) => void;
}

function stationForFace(face: ElevationFace, point: { x: number; z: number }): number {
  return elevationStationForPoint(face, point);
}

function faceLabel(face: ElevationFace): string {
  switch (face) {
    case 'east':
      return 'East Elevation';
    case 'south':
      return 'South Elevation';
    case 'west':
      return 'West Elevation';
    case 'north':
    default:
      return 'North Elevation';
  }
}

function numberValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function renderWidthForComponent(component: DesignRenderRcComponent): number {
  if (component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam') {
    return component.dimensions.length ?? component.dimensions.width;
  }
  if (component.type === 'slab') return component.dimensions.length ?? component.dimensions.width;
  if (component.type === 'footer') return component.dimensions.width;
  return component.dimensions.width;
}

function componentThicknessForElevation(component: DesignRenderRcComponent): number {
  if (component.type === 'footer' || component.type === 'slab') return component.dimensions.height;
  return Math.max(0.02, component.elevations.top - component.elevations.base);
}

function addSpan(values: number[], center: number, width: number): void {
  const half = Math.max(0.02, width) / 2;
  values.push(center - half, center + half);
}

function buildElevationBounds(params: {
  face: ElevationFace;
  layoutBounds?: DesignLayoutBounds | null;
  frameSystem?: StructuralFrameSystemParameters;
  isolatedFootings: readonly IsolatedFooting[];
  openings: readonly WallOpeningParameters[];
  components: readonly DesignRenderRcComponent[];
}): PlanViewportBounds {
  const stations: number[] = [];
  const elevations: number[] = [0];

  if (params.layoutBounds) {
    stations.push(
      params.face === 'north' || params.face === 'south' ? params.layoutBounds.minX : params.layoutBounds.minZ,
      params.face === 'north' || params.face === 'south' ? params.layoutBounds.maxX : params.layoutBounds.maxZ,
    );
    elevations.push(params.layoutBounds.minY, params.layoutBounds.maxY);
  }

  params.frameSystem?.columns.forEach((column) => {
    addSpan(stations, stationForFace(params.face, column.position), column.widthMeters);
    elevations.push(column.baseElevationMeters, column.topElevationMeters);
  });

  params.frameSystem?.beams.forEach((beam) => {
    stations.push(
      stationForFace(params.face, { x: beam.startPoint.x, z: beam.startPoint.z }),
      stationForFace(params.face, { x: beam.endPoint.x, z: beam.endPoint.z }),
    );
    elevations.push(beam.baseElevationMeters, beam.topElevationMeters);
  });

  params.isolatedFootings.forEach((footing) => {
    addSpan(stations, stationForFace(params.face, footing.position), footing.widthMeters);
    elevations.push(footing.bottomElevationMeters, footing.topElevationMeters);
  });

  params.openings.forEach((opening) => {
    const station = numberValue(opening.positionAlongSegment ?? opening.offsetMeters, 0);
    const sill = numberValue(opening.sillHeightMeters, opening.type === 'door' ? 0 : 0.9);
    addSpan(stations, station, opening.widthMeters);
    elevations.push(sill, sill + opening.heightMeters);
  });

  params.components.forEach((component) => {
    const station = stationForFace(params.face, component.position);
    addSpan(stations, station, renderWidthForComponent(component));
    elevations.push(component.elevations.base, component.elevations.top);
    if (component.footer) {
      addSpan(stations, station, component.footer.widthMeters);
      elevations.push(component.footer.bottomElevationMeters, component.footer.topElevationMeters);
    }
  });

  if (stations.length === 0) stations.push(-1, 8);
  return {
    minX: Math.min(...stations),
    maxX: Math.max(...stations),
    minZ: Math.min(-0.4, ...elevations),
    maxZ: Math.max(3.5, ...elevations),
  };
}

export default function DesignBuilderElevationCanvas({
  toolMode,
  elevationView,
  layoutBounds,
  viewCommand = null,
  frameSystem,
  isolatedFootings = [],
  openings = [],
  placedComponents = [],
  componentPreview = null,
  designRenderModel,
  helperMeasurements = [],
  onElevationViewChange,
  onComponentPointer,
  onInteraction,
}: DesignBuilderElevationCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);
  const componentPointerIdRef = useRef<number | null>(null);
  const displayMinorRef = useRef<number | undefined>(undefined);
  const lastAutoFitKeyRef = useRef<string | null>(null);
  const lastViewCommandIdRef = useRef<number | null>(null);
  const userAdjustedViewRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const [surfaceSize, setSurfaceSize] = useState(FALLBACK_SURFACE_SIZE);
  const [viewport, setViewport] = useState<PlanViewportState>(DEFAULT_PLAN_VIEWPORT);
  const [cursor, setCursor] = useState<{ xMeters: number; zMeters: number } | null>(null);

  const committedRenderModel = useMemo(
    () => designRenderModel ?? buildDesignRenderModel({ placedComponents, layoutBounds }),
    [designRenderModel, layoutBounds, placedComponents],
  );
  const previewRenderModel = useMemo(
    () => buildDesignRenderModel({ placedComponents: componentPreview ? [componentPreview] : [], layoutBounds }),
    [componentPreview, layoutBounds],
  );
  const allRenderComponents = useMemo(
    () => [...committedRenderModel.rcComponents, ...previewRenderModel.rcComponents],
    [committedRenderModel.rcComponents, previewRenderModel.rcComponents],
  );

  const modelBounds = useMemo(
    () =>
      buildElevationBounds({
        face: elevationView.face,
        layoutBounds,
        frameSystem,
        isolatedFootings,
        openings,
        components: allRenderComponents,
      }),
    [allRenderComponents, elevationView.face, frameSystem, isolatedFootings, layoutBounds, openings],
  );

  const controller = useMemo(
    () => createPlanCameraController(viewport, surfaceSize),
    [surfaceSize, viewport],
  );
  const visibleBounds = controller.visibleWorldBounds();
  const gridState = useMemo(() => {
    const next = computePlanGridState(
      viewport,
      surfaceSize,
      DEFAULT_ELEVATION_GRID_SPACING_METERS,
      displayMinorRef.current,
    );
    displayMinorRef.current = next.displayMinorSpacingMeters;
    return next;
  }, [surfaceSize, viewport]);
  const minorGridStep = gridState.displayMinorSpacingMeters;
  const majorGridStep = gridState.displayMajorSpacingMeters;
  const showMinorGrid = projectCellWidthPx(minorGridStep, viewport) >= MIN_CELL_PX;

  const worldToScreen = useCallback(
    (point: { xMeters: number; zMeters: number }) => {
      const screen = controller.planToScreenPoint({ x: point.xMeters, z: point.zMeters });
      return { sx: screen.x, sy: screen.y };
    },
    [controller],
  );

  const eventToWorld = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      if (eventSurfaceSize.width > 0 && eventSurfaceSize.height > 0) {
        setSurfaceSize((current) =>
          Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
            ? current
            : eventSurfaceSize,
        );
      }
      const point = createPlanCameraController(viewport, eventSurfaceSize).screenToPlanPoint(
        event.clientX,
        event.clientY,
        rect.left,
        rect.top,
      );
      return { xMeters: point.x, zMeters: point.z };
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
    const key = [
      elevationView.face,
      modelBounds.minX.toFixed(3),
      modelBounds.maxX.toFixed(3),
      modelBounds.minZ.toFixed(3),
      modelBounds.maxZ.toFixed(3),
      surfaceSize.width.toFixed(0),
      surfaceSize.height.toFixed(0),
    ].join(':');
    if (userAdjustedViewRef.current && lastAutoFitKeyRef.current?.startsWith(`${elevationView.face}:`)) return;
    if (lastAutoFitKeyRef.current === key) return;
    lastAutoFitKeyRef.current = key;
    setViewport(fitPlanViewportToBounds(modelBounds, surfaceSize, 0.18));
  }, [elevationView.face, modelBounds, surfaceSize]);

  useEffect(() => {
    if (!viewCommand || lastViewCommandIdRef.current === viewCommand.id) return;
    lastViewCommandIdRef.current = viewCommand.id;
    if (viewCommand.action === 'reset') {
      userAdjustedViewRef.current = false;
      setViewport(DEFAULT_PLAN_VIEWPORT);
      return;
    }
    if (viewCommand.action !== 'fit') return;
    userAdjustedViewRef.current = false;
    lastAutoFitKeyRef.current = null;
    setViewport(fitPlanViewportToBounds(modelBounds, surfaceSize, 0.18));
  }, [modelBounds, surfaceSize, viewCommand]);

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
    const surface = svgRef.current;
    if (!surface) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!surface.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = surface.getBoundingClientRect();
      const eventSurfaceSize = { width: rect.width, height: rect.height };
      setSurfaceSize((current) =>
        Math.abs(current.width - eventSurfaceSize.width) < 0.5 && Math.abs(current.height - eventSurfaceSize.height) < 0.5
          ? current
          : eventSurfaceSize,
      );
      userAdjustedViewRef.current = true;
      setViewport(
        createPlanCameraController(viewport, eventSurfaceSize).zoomAtPointer(
          event.clientX,
          event.clientY,
          event.deltaY,
          rect.left,
          rect.top,
        ),
      );
    };
    surface.addEventListener('wheel', onWheel, { passive: false });
    return () => surface.removeEventListener('wheel', onWheel);
  }, [viewport]);

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      userAdjustedViewRef.current = true;
      setViewport(controller.panByPointerDelta(event.clientX - panDragRef.current.x, event.clientY - panDragRef.current.y));
      panDragRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    const point = eventToWorld(event);
    if (!point) return;
    setCursor(point);
    onElevationViewChange?.({ ...elevationView, cursorX: point.xMeters, cursorZ: point.zMeters });
    if (toolMode === 'place_component') {
      onComponentPointer?.({ phase: 'preview', xMeters: point.xMeters, zMeters: point.zMeters });
    }
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceHeldRef.current)) {
      event.preventDefault();
      panDragRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0 || toolMode !== 'place_component') return;
    const point = eventToWorld(event);
    if (!point) return;
    componentPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCursor(point);
    onComponentPointer?.({ phase: 'preview', xMeters: point.xMeters, zMeters: point.zMeters });
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      panDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (toolMode !== 'place_component') return;
    const point = eventToWorld(event);
    if (componentPointerIdRef.current === event.pointerId) {
      componentPointerIdRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    if (!point) return;
    setCursor(point);
    onComponentPointer?.({ phase: 'commit', xMeters: point.xMeters, zMeters: point.zMeters });
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      panDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    if (componentPointerIdRef.current === event.pointerId) {
      componentPointerIdRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handleContextMenu = (event: MouseEvent<SVGSVGElement>) => {
    if (toolMode !== 'place_component') return;
    event.preventDefault();
    onInteraction({ kind: 'cancel', toolMode });
  };

  const isMajorGridLine = (value: number, majorStep: number) =>
    Math.abs(value / majorStep - Math.round(value / majorStep)) < Math.max(majorStep * 0.001, 0.0001);

  const gridLines = [];
  for (let x = Math.floor(visibleBounds.minX / minorGridStep) * minorGridStep; x <= visibleBounds.maxX; x += minorGridStep) {
    const major = isMajorGridLine(x, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = worldToScreen({ xMeters: x, zMeters: visibleBounds.minZ });
    const end = worldToScreen({ xMeters: x, zMeters: visibleBounds.maxZ });
    gridLines.push(
      <line
        key={`ex-${x}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke="currentColor"
        strokeOpacity={major ? 0.18 : 0.08}
        strokeWidth={major ? 1.25 : 1}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
      />,
    );
  }
  for (let z = Math.floor(visibleBounds.minZ / minorGridStep) * minorGridStep; z <= visibleBounds.maxZ; z += minorGridStep) {
    const major = isMajorGridLine(z, majorGridStep);
    if (!showMinorGrid && !major) continue;
    const start = worldToScreen({ xMeters: visibleBounds.minX, zMeters: z });
    const end = worldToScreen({ xMeters: visibleBounds.maxX, zMeters: z });
    gridLines.push(
      <line
        key={`ez-${z}`}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke="currentColor"
        strokeOpacity={Math.abs(z) < 0.001 ? 0.82 : major ? 0.18 : 0.08}
        strokeWidth={Math.abs(z) < 0.001 ? 1.6 : major ? 1.25 : 1}
        pointerEvents="none"
        data-grid-kind={major ? 'major' : 'minor'}
      />,
    );
  }

  const origin = worldToScreen({ xMeters: 0, zMeters: 0 });
  const horizontalAxisStart = worldToScreen({ xMeters: visibleBounds.minX, zMeters: 0 });
  const horizontalAxisEnd = worldToScreen({ xMeters: visibleBounds.maxX, zMeters: 0 });
  const verticalAxisStart = worldToScreen({ xMeters: 0, zMeters: visibleBounds.minZ });
  const verticalAxisEnd = worldToScreen({ xMeters: 0, zMeters: visibleBounds.maxZ });
  const horizontalAxisName = elevationView.face === 'north' || elevationView.face === 'south' ? 'X' : 'Y';

  const renderRect = (
    key: string,
    station: number,
    topElevationMeters: number,
    widthMeters: number,
    heightMeters: number,
    options: {
      fill: string;
      stroke: string;
      strokeWidth?: number;
      strokeDasharray?: string;
      opacity?: number;
      data?: Record<string, string>;
    },
  ) => {
    const top = worldToScreen({ xMeters: station, zMeters: topElevationMeters });
    const width = Math.max(8, widthMeters * viewport.zoom);
    const height = Math.max(6, heightMeters * viewport.zoom);
    return (
      <rect
        key={key}
        x={top.sx - width / 2}
        y={top.sy}
        width={width}
        height={height}
        fill={options.fill}
        stroke={options.stroke}
        strokeWidth={options.strokeWidth ?? 1.5}
        strokeDasharray={options.strokeDasharray}
        opacity={options.opacity}
        pointerEvents="none"
        {...options.data}
      />
    );
  };

  const renderGeneratedBeam = (beam: StructuralBeam) => {
    const startStation = stationForFace(elevationView.face, { x: beam.startPoint.x, z: beam.startPoint.z });
    const endStation = stationForFace(elevationView.face, { x: beam.endPoint.x, z: beam.endPoint.z });
    const centerStation = (startStation + endStation) / 2;
    return renderRect(`beam-${beam.id}`, centerStation, beam.topElevationMeters, Math.abs(endStation - startStation), beam.depthMeters, {
      fill: '#94a3b866',
      stroke: '#475569',
      strokeWidth: 1.4,
      data: { 'data-canvas-layer': 'beams-walls', 'data-beam-kind': beam.kind },
    });
  };

  const renderGeneratedColumn = (column: StructuralFrameSystemParameters['columns'][number]) => {
    const selected = false;
    const station = stationForFace(elevationView.face, column.position);
    return (
      <g key={column.id} pointerEvents="none" data-canvas-layer="columns">
        {renderRect(`column-body-${column.id}`, station, column.topElevationMeters, column.widthMeters, column.heightMeters, {
          fill: '#cbd5e1',
          stroke: selected ? '#22d3ee' : '#475569',
          strokeWidth: selected ? 2.2 : 1.6,
        })}
        <line
          x1={worldToScreen({ xMeters: station - column.widthMeters * 0.8, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sx}
          y1={worldToScreen({ xMeters: station, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sy}
          x2={worldToScreen({ xMeters: station + column.widthMeters * 0.8, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sx}
          y2={worldToScreen({ xMeters: station, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sy}
          stroke="#64748b"
          strokeWidth={1}
          strokeOpacity={0.65}
        />
      </g>
    );
  };

  const renderComponent = (component: DesignRenderRcComponent, preview = false) => {
    const station = stationForFace(elevationView.face, component.position);
    const widthMeters = renderWidthForComponent(component);
    const heightMeters = componentThicknessForElevation(component);
    const fill = preview ? '#22d3ee33' : component.type === 'footer' ? '#78716c66' : '#cbd5e1';
    const stroke = preview ? '#67e8f9' : component.type === 'footer' ? '#78716c' : '#475569';
    const top = component.type === 'footer' || component.type === 'slab'
      ? component.elevations.top
      : component.elevations.top;
    return renderRect(`component-${component.id}-${preview ? 'preview' : 'placed'}`, station, top, widthMeters, heightMeters, {
      fill,
      stroke,
      strokeWidth: preview ? 2 : 1.5,
      strokeDasharray: preview ? '6 4' : undefined,
      opacity: preview ? 0.82 : 1,
      data: {
        'data-component-id': component.id,
        'data-component-type': component.type,
        'data-component-system': component.system,
        'data-canvas-layer': preview ? 'active-placement-preview' : `component-${component.type}`,
      },
    });
  };

  const renderComponentFooter = (component: DesignRenderRcComponent) => {
    if (component.type !== 'column' || !component.footer) return null;
    const station = stationForFace(elevationView.face, component.position);
    return renderRect(`component-footer-${component.id}`, station, component.footer.topElevationMeters, component.footer.widthMeters, component.footer.thicknessMeters, {
      fill: '#78716c66',
      stroke: '#78716c',
      strokeWidth: 1.4,
      strokeDasharray: '6 4',
      data: { 'data-canvas-layer': 'footers-foundations', 'data-component-footer-for': component.id },
    });
  };

  const helperAnchor = previewRenderModel.rcComponents[0]
    ? worldToScreen({
        xMeters: stationForFace(elevationView.face, previewRenderModel.rcComponents[0].position),
        zMeters: previewRenderModel.rcComponents[0].elevations.top,
      })
    : null;

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700">
      <div
        className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-full border border-cyan-700 bg-slate-900/90 px-3 py-1 text-xs font-medium text-cyan-200"
        data-view-grid-meters={gridState.displayMinorSpacingMeters}
      >
        <span>
          {faceLabel(elevationView.face)} · View grid {formatPlanGridSpacingMeters(gridState.displayMinorSpacingMeters)}
        </span>
        <span className="text-slate-500">|</span>
        {(['north', 'east', 'south', 'west'] as ElevationFace[]).map((face) => (
          <button
            key={face}
            type="button"
            onClick={() => {
              userAdjustedViewRef.current = false;
              lastAutoFitKeyRef.current = null;
              onElevationViewChange?.({ ...elevationView, face });
            }}
            className={`rounded-md px-2 py-0.5 text-[11px] uppercase ${
              elevationView.face === face ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {face}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${surfaceSize.width} ${surfaceSize.height}`}
        preserveAspectRatio="none"
        className="plan-surface h-full w-full overscroll-contain touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        aria-label="Design Builder elevation view"
      >
        <rect width={surfaceSize.width} height={surfaceSize.height} fill="#0f172a" data-canvas-layer="background" />
        <g data-canvas-layer="grid" className="text-slate-400">
          {gridLines}
        </g>
        <g data-canvas-layer="axes">
          <line x1={horizontalAxisStart.sx} y1={horizontalAxisStart.sy} x2={horizontalAxisEnd.sx} y2={horizontalAxisEnd.sy} stroke="#334155" strokeWidth={1.5} strokeOpacity={0.85} pointerEvents="none" />
          <line x1={verticalAxisStart.sx} y1={verticalAxisStart.sy} x2={verticalAxisEnd.sx} y2={verticalAxisEnd.sy} stroke="#334155" strokeWidth={1.5} strokeOpacity={0.85} pointerEvents="none" />
          <line x1={origin.sx - 10} y1={origin.sy} x2={origin.sx + 10} y2={origin.sy} stroke="#22d3ee" strokeWidth={2} pointerEvents="none" />
          <line x1={origin.sx} y1={origin.sy - 10} x2={origin.sx} y2={origin.sy + 10} stroke="#22d3ee" strokeWidth={2} pointerEvents="none" />
          <circle cx={origin.sx} cy={origin.sy} r={4} fill="#22d3ee" pointerEvents="none" />
          <text x={origin.sx + 8} y={origin.sy - 8} fill="#67e8f9" fontSize={10} fontWeight={700} pointerEvents="none">0,0</text>
          <text x={horizontalAxisEnd.sx - 6} y={origin.sy - 6} textAnchor="end" fill="#64748b" fontSize={10} fontWeight={600} pointerEvents="none">{`+${horizontalAxisName} Station`}</text>
          <text x={origin.sx + 6} y={verticalAxisEnd.sy + 14} fill="#64748b" fontSize={10} fontWeight={600} pointerEvents="none">+Z Height</text>
        </g>
        <text x={surfaceSize.width / 2} y={18} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={700} pointerEvents="none">{faceLabel(elevationView.face)}</text>

        <g data-canvas-layer="footers-foundations">
          {isolatedFootings.map((footing) => {
            const station = stationForFace(elevationView.face, footing.position);
            return renderRect(`footing-${footing.id}`, station, footing.topElevationMeters, footing.widthMeters, footing.thicknessMeters, {
              fill: '#78716c66',
              stroke: '#78716c',
              strokeWidth: 1.4,
            });
          })}
          {committedRenderModel.rcComponents.map(renderComponentFooter)}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'footer').map((component) => renderComponent(component))}
        </g>
        <g data-canvas-layer="slabs">
          {committedRenderModel.rcComponents.filter((component) => component.type === 'slab').map((component) => renderComponent(component))}
        </g>
        <g data-canvas-layer="beams-walls">
          {frameSystem?.beams.map(renderGeneratedBeam)}
          {committedRenderModel.rcComponents
            .filter((component) => component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam')
            .map((component) => renderComponent(component))}
        </g>
        <g data-canvas-layer="columns">
          {frameSystem?.columns.map(renderGeneratedColumn)}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'column').map((component) => renderComponent(component))}
        </g>
        <g data-canvas-layer="placed-openings">
          {openings.map((opening) => {
            const station = numberValue(opening.positionAlongSegment ?? opening.offsetMeters, 0);
            const sill = numberValue(opening.sillHeightMeters, opening.type === 'door' ? 0 : 0.9);
            const top = sill + opening.heightMeters;
            const point = worldToScreen({ xMeters: station, zMeters: top });
            const width = Math.max(8, opening.widthMeters * viewport.zoom);
            const height = Math.max(8, opening.heightMeters * viewport.zoom);
            return (
              <g key={opening.id} pointerEvents="none" data-opening-type={opening.type}>
                <rect
                  x={point.sx - width / 2}
                  y={point.sy}
                  width={width}
                  height={height}
                  fill="#0f172a99"
                  stroke="#67e8f9"
                  strokeWidth={1.5}
                />
                {opening.type === 'window' ? (
                  <line
                    x1={point.sx - width / 2 + 4}
                    y1={point.sy + height / 2}
                    x2={point.sx + width / 2 - 4}
                    y2={point.sy + height / 2}
                    stroke="#67e8f9"
                    strokeWidth={1}
                    strokeOpacity={0.85}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
        <g data-canvas-layer="active-placement-preview">
          {previewRenderModel.rcComponents.map((component) => renderComponent(component, true))}
        </g>
        {helperAnchor && helperMeasurements.length > 0 ? (
          <g pointerEvents="none" data-canvas-layer="helper-measurements">
            <rect
              x={helperAnchor.sx + 14}
              y={helperAnchor.sy - 10}
              width={190}
              height={Math.max(34, helperMeasurements.length * 18 + 12)}
              rx={8}
              fill="#020617"
              fillOpacity={0.86}
              stroke="#155e75"
            />
            {helperMeasurements.map((measurement, index) => (
              <text
                key={measurement.id}
                x={helperAnchor.sx + 24}
                y={helperAnchor.sy + 12 + index * 18}
                fill={index === 0 ? '#67e8f9' : '#cbd5e1'}
                fontSize={11}
                fontWeight={index === 0 ? 800 : 600}
                paintOrder="stroke"
                stroke="#020617"
                strokeWidth={3}
              >
                {`${measurement.label}: ${measurement.value}`}
              </text>
            ))}
          </g>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-[11px] font-bold text-slate-100 shadow-sm" aria-label="Elevation coordinate widget">
        <div className="text-cyan-200">Elevation Coordinates</div>
        <div className="font-mono text-slate-200">
          {coordinateLabelForElevationFace(elevationView.face)} {cursor ? cursor.xMeters.toFixed(2) : (elevationView.cursorX ?? 0).toFixed(2)} m /{' '}
          {cursor ? cursor.zMeters.toFixed(2) : (elevationView.cursorZ ?? 0).toFixed(2)} m
        </div>
        <div className="text-[10px] font-semibold text-slate-400">{faceLabel(elevationView.face)}</div>
      </div>
    </div>
  );
}
