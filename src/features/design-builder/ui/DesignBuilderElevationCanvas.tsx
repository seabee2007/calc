import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type {
  DesignBuilderElevationViewState,
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  Design2dDrawingStyleMode,
  ElevationFace,
  IsolatedFooting,
  PlacedDesignComponent,
  ResolvedFloorTileLayout,
  ResolvedPlywoodCeilingLayout,
  ResolvedRoofSystem,
  RoofVec3,
  StructuralBeam,
  StructuralFrameSystemParameters,
  WallOpeningParameters,
} from '../types';
import type { DesignLayoutBounds } from '../domain/designLayoutBounds';
import type { HelperMeasurement } from '../domain/designComponentPlacement';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { ResolvedInteriorFloorSlab } from '../domain/interiorFloorSlab';
import { openingCenterStationFromStored } from '../domain/openingPlacementResolver';
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
import {
  renderDrawingPrimitive,
  resolve2dDrawingStyle,
  type DrawingPrimitive,
} from '../domain/design2dDrawingPrimitives';
import {
  PURLIN_PROFILE_DEPTH_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';
import type { MeasurementSystem } from '../../../utils/measurementPreferences';
import { formatDisplayLength } from '../../../utils/measurementDisplay';

const FALLBACK_SURFACE_SIZE = { width: 900, height: 520 };
const DEFAULT_ELEVATION_GRID_SPACING_METERS = 0.5;
const FRONT_ELEVATION_FACE: ElevationFace = 'north';
const SIDE_ELEVATION_FACE: ElevationFace = 'east';
const FLOOR_TILE_SURFACE_THICKNESS_METERS = 0.008;

interface DesignBuilderElevationCanvasProps {
  toolMode: DesignBuilderToolMode;
  elevationView: DesignBuilderElevationViewState;
  layoutBounds?: DesignLayoutBounds | null;
  viewCommand?: { id: number; action: 'fit' | 'reset' | 'grid_scale'; spacingMeters?: number } | null;
  frameSystem?: StructuralFrameSystemParameters;
  isolatedFootings?: readonly IsolatedFooting[];
  segmentFrames?: readonly SegmentFrame[];
  resolvedRoofSystem?: ResolvedRoofSystem | null;
  interiorFloorSlab?: ResolvedInteriorFloorSlab | null;
  floorTileLayout?: ResolvedFloorTileLayout | null;
  plywoodCeilingLayout?: ResolvedPlywoodCeilingLayout | null;
  openings?: readonly WallOpeningParameters[];
  placedComponents?: readonly PlacedDesignComponent[];
  componentPreview?: PlacedDesignComponent | null;
  designRenderModel?: DesignRenderModel;
  drawingStyleMode?: Design2dDrawingStyleMode;
  measurementSystem?: MeasurementSystem;
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

function sheetElevationTitle(face: ElevationFace): string {
  if (face === FRONT_ELEVATION_FACE) return 'Front Elevation';
  if (face === SIDE_ELEVATION_FACE) return 'Side Elevation';
  return faceLabel(face);
}

function numberValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function projectionAxisForFace(face: ElevationFace): 'x' | 'z' {
  return face === 'north' || face === 'south' ? 'x' : 'z';
}

function isBeamComponent(component: DesignRenderRcComponent): boolean {
  return component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam';
}

function renderWidthForComponentFace(component: DesignRenderRcComponent, face: ElevationFace): number {
  const axis = projectionAxisForFace(face);
  if (component.type === 'column') {
    return axis === 'x' ? component.dimensions.width : component.dimensions.depth;
  }
  if (component.type === 'footer') {
    return axis === 'x' ? component.dimensions.width : component.dimensions.length ?? component.dimensions.depth;
  }
  if (component.type === 'slab') {
    return axis === 'x' ? component.dimensions.length ?? component.dimensions.width : component.dimensions.width;
  }
  if (isBeamComponent(component)) {
    const length = component.dimensions.length ?? component.dimensions.width;
    const width = component.dimensions.width;
    const elevationFace = component.references.elevationFace;
    if (component.references.sourceView === 'elevation' && elevationFace) {
      const lengthAxis = projectionAxisForFace(elevationFace);
      return axis === lengthAxis ? length : width;
    }
    const rotation = component.sourceComponent.viewPlacement.plan?.rotationRadians ?? 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const xSpan = Math.abs(length * cos) + Math.abs(width * sin);
    const zSpan = Math.abs(length * sin) + Math.abs(width * cos);
    return axis === 'x' ? xSpan : zSpan;
  }
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

function segmentDirectionMatchesFace(frame: SegmentFrame, face: ElevationFace): boolean {
  const axis = projectionAxisForFace(face);
  return axis === 'x'
    ? Math.abs(frame.tangent.x) >= Math.abs(frame.tangent.z)
    : Math.abs(frame.tangent.z) > Math.abs(frame.tangent.x);
}

function openingProjectionForFace(
  opening: WallOpeningParameters,
  face: ElevationFace,
  frameBySegmentId: ReadonlyMap<string, SegmentFrame>,
): { station: number; widthMeters: number } | null {
  const frame = opening.wallSegmentId ? frameBySegmentId.get(opening.wallSegmentId) : null;
  if (frame) {
    if (opening.wallFace && opening.wallFace !== face) return null;
    if (!opening.wallFace && !segmentDirectionMatchesFace(frame, face)) return null;
    const centerStation = openingCenterStationFromStored(opening);
    const center = {
      x: frame.centerlineStart.x + frame.tangent.x * centerStation,
      z: frame.centerlineStart.z + frame.tangent.z * centerStation,
    };
    const widthScale = projectionAxisForFace(face) === 'x'
      ? Math.abs(frame.tangent.x)
      : Math.abs(frame.tangent.z);
    return {
      station: stationForFace(face, center),
      widthMeters: Math.max(0.01, opening.widthMeters * widthScale),
    };
  }

  if (opening.wallFace && opening.wallFace !== face) return null;
  if (!opening.wallFace && face !== FRONT_ELEVATION_FACE) return null;
  return {
    station: openingCenterStationFromStored(opening),
    widthMeters: opening.widthMeters,
  };
}

function buildElevationBounds(params: {
  face: ElevationFace;
  layoutBounds?: DesignLayoutBounds | null;
  frameSystem?: StructuralFrameSystemParameters;
  isolatedFootings: readonly IsolatedFooting[];
  openings: readonly WallOpeningParameters[];
  segmentFrames?: readonly SegmentFrame[];
  components: readonly DesignRenderRcComponent[];
  resolvedRoofSystem?: ResolvedRoofSystem | null;
  interiorFloorSlab?: ResolvedInteriorFloorSlab | null;
  floorTileLayout?: ResolvedFloorTileLayout | null;
  plywoodCeilingLayout?: ResolvedPlywoodCeilingLayout | null;
}): PlanViewportBounds {
  const stations: number[] = [];
  const elevations: number[] = [0];
  const frameBySegmentId = new Map((params.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]));

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
    const projection = openingProjectionForFace(opening, params.face, frameBySegmentId);
    if (!projection) return;
    const sill = numberValue(opening.sillHeightMeters, opening.type === 'door' ? 0 : 0.9);
    addSpan(stations, projection.station, projection.widthMeters);
    elevations.push(sill, sill + opening.heightMeters);
  });

  params.components.forEach((component) => {
    const station = stationForFace(params.face, component.position);
    addSpan(stations, station, renderWidthForComponentFace(component, params.face));
    elevations.push(component.elevations.base, component.elevations.top);
    if (component.footer) {
      addSpan(
        stations,
        station,
        projectionAxisForFace(params.face) === 'x'
          ? component.footer.widthMeters
          : component.footer.lengthMeters,
      );
      elevations.push(component.footer.bottomElevationMeters, component.footer.topElevationMeters);
    }
  });

  if (params.resolvedRoofSystem?.supported) {
    const roof = params.resolvedRoofSystem;
    const addRoofPoint = (point: RoofVec3) => {
      stations.push(stationForFace(params.face, point));
      elevations.push(point.y);
    };
    roof.roofSheetPerimeter.forEach(addRoofPoint);
    roof.claddingPerimeter.forEach(addRoofPoint);
    roof.roofTopPlanes.forEach((plane) => plane.corners.forEach(addRoofPoint));
    roof.claddingDisplayPlanes.forEach((plane) => plane.corners.forEach(addRoofPoint));
    if (roof.ridgeStart) addRoofPoint(roof.ridgeStart);
    if (roof.ridgeEnd) addRoofPoint(roof.ridgeEnd);
    roof.trussPlacements.forEach((truss) => {
      addRoofPoint(truss.bearingLeft);
      addRoofPoint(truss.bearingRight);
      addRoofPoint(truss.apex);
      truss.members.forEach((member) => {
        addRoofPoint(member.start);
        addRoofPoint(member.end);
      });
    });
    roof.hipFramingMembers.forEach((member) => {
      addRoofPoint(member.start);
      addRoofPoint(member.end);
    });
    roof.purlinPlacements.forEach((purlin) => {
      addRoofPoint(purlin.start);
      addRoofPoint(purlin.end);
    });
    roof.gableEndRoofingClosures.forEach((closure) => closure.corners.forEach(addRoofPoint));
  }

  if (params.interiorFloorSlab?.enabled) {
    elevations.push(params.interiorFloorSlab.bottomElevationMeters, params.interiorFloorSlab.topElevationMeters);
  }

  if (params.floorTileLayout?.enabled) {
    const slabTop = params.interiorFloorSlab?.topElevationMeters ?? 0;
    elevations.push(
      slabTop,
      slabTop + params.floorTileLayout.thinsetThicknessMeters,
      slabTop + params.floorTileLayout.thinsetThicknessMeters + FLOOR_TILE_SURFACE_THICKNESS_METERS,
    );
    params.floorTileLayout.placements.forEach((tile) => {
      const halfX = tile.renderWidthMeters / 2;
      const halfZ = tile.renderDepthMeters / 2;
      stations.push(
        stationForFace(params.face, { x: tile.renderCenter.x - halfX, z: tile.renderCenter.z - halfZ }),
        stationForFace(params.face, { x: tile.renderCenter.x + halfX, z: tile.renderCenter.z + halfZ }),
      );
    });
  }

  if (params.plywoodCeilingLayout?.enabled) {
    const ceiling = params.plywoodCeilingLayout;
    const addPoint = (point: { x: number; y: number; z: number }) => {
      stations.push(stationForFace(params.face, point));
      elevations.push(point.y);
    };
    elevations.push(
      ceiling.frameBottomElevationMeters,
      ceiling.frameBottomElevationMeters + ceiling.tubeSizeMeters,
      ceiling.ceilingHeightMeters - ceiling.sheetThicknessMeters,
      ceiling.ceilingHeightMeters,
    );
    ceiling.frameMembers.forEach((member) => {
      addPoint(member.start);
      addPoint(member.end);
    });
    ceiling.panelPlacements.forEach((panel) => {
      const halfX = panel.widthMeters / 2;
      const halfZ = panel.lengthMeters / 2;
      addPoint({ x: panel.center.x - halfX, y: panel.center.y, z: panel.center.z - halfZ });
      addPoint({ x: panel.center.x + halfX, y: panel.center.y, z: panel.center.z + halfZ });
    });
  }

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
  segmentFrames = [],
  resolvedRoofSystem = null,
  interiorFloorSlab = null,
  floorTileLayout = null,
  plywoodCeilingLayout = null,
  openings = [],
  placedComponents = [],
  componentPreview = null,
  designRenderModel,
  drawingStyleMode = 'architectural',
  measurementSystem = 'metric',
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
  const drawingStyle = useMemo(() => resolve2dDrawingStyle(drawingStyleMode), [drawingStyleMode]);
  const architecturalDrawing = drawingStyleMode === 'architectural';
  const sheetBackerFill = architecturalDrawing ? drawingStyle.sheetFill : drawingStyle.viewportFill;
  const referenceStroke = drawingStyle.referenceStroke;
  const permanentStroke = drawingStyle.lineStroke;
  const mutedStroke = drawingStyle.mutedStroke;
  const concreteFill = drawingStyle.concreteFill;
  const selectionStroke = drawingStyle.selectionStroke;
  const previewStroke = drawingStyle.previewStroke;
  const previewFill = drawingStyle.previewFill;

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

  const frontModelBounds = useMemo(
    () =>
      buildElevationBounds({
        face: FRONT_ELEVATION_FACE,
        layoutBounds,
        frameSystem,
        isolatedFootings,
        segmentFrames,
        openings,
        components: allRenderComponents,
        resolvedRoofSystem,
        interiorFloorSlab,
        floorTileLayout,
        plywoodCeilingLayout,
      }),
    [allRenderComponents, floorTileLayout, frameSystem, interiorFloorSlab, isolatedFootings, layoutBounds, openings, plywoodCeilingLayout, resolvedRoofSystem, segmentFrames],
  );
  const sideModelBounds = useMemo(
    () =>
      buildElevationBounds({
        face: SIDE_ELEVATION_FACE,
        layoutBounds,
        frameSystem,
        isolatedFootings,
        segmentFrames,
        openings,
        components: allRenderComponents,
        resolvedRoofSystem,
        interiorFloorSlab,
        floorTileLayout,
        plywoodCeilingLayout,
      }),
    [allRenderComponents, floorTileLayout, frameSystem, interiorFloorSlab, isolatedFootings, layoutBounds, openings, plywoodCeilingLayout, resolvedRoofSystem, segmentFrames],
  );
  const frameBySegmentId = useMemo(
    () => new Map(segmentFrames.map((frame) => [frame.segmentId, frame])),
    [segmentFrames],
  );
  const sideElevationStationOffsetMeters = useMemo(() => {
    const frontWidth = Math.max(1, frontModelBounds.maxX - frontModelBounds.minX);
    const gap = Math.max(1.6, frontWidth * 0.24);
    return frontModelBounds.maxX - sideModelBounds.minX + gap;
  }, [frontModelBounds.maxX, frontModelBounds.minX, sideModelBounds.minX]);
  const modelBounds = useMemo(
    () => ({
      minX: Math.min(frontModelBounds.minX, sideModelBounds.minX + sideElevationStationOffsetMeters),
      maxX: Math.max(frontModelBounds.maxX, sideModelBounds.maxX + sideElevationStationOffsetMeters),
      minZ: Math.min(frontModelBounds.minZ, sideModelBounds.minZ),
      maxZ: Math.max(frontModelBounds.maxZ, sideModelBounds.maxZ),
    }),
    [frontModelBounds, sideElevationStationOffsetMeters, sideModelBounds],
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
      'elevation-sheet',
      modelBounds.minX.toFixed(3),
      modelBounds.maxX.toFixed(3),
      modelBounds.minZ.toFixed(3),
      modelBounds.maxZ.toFixed(3),
      surfaceSize.width.toFixed(0),
      surfaceSize.height.toFixed(0),
    ].join(':');
    if (userAdjustedViewRef.current && lastAutoFitKeyRef.current?.startsWith('elevation-sheet:')) return;
    if (lastAutoFitKeyRef.current === key) return;
    lastAutoFitKeyRef.current = key;
    setViewport(fitPlanViewportToBounds(modelBounds, surfaceSize, 0.18));
  }, [modelBounds, surfaceSize]);

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
        stroke={major ? drawingStyle.gridMajorStroke : drawingStyle.gridStroke}
        strokeOpacity={architecturalDrawing ? (major ? 0.42 : 0.24) : (major ? 0.18 : 0.08)}
        strokeWidth={major ? drawingStyle.weights.reference + 0.3 : drawingStyle.weights.reference}
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
        stroke={Math.abs(z) < 0.001 ? permanentStroke : major ? drawingStyle.gridMajorStroke : drawingStyle.gridStroke}
        strokeOpacity={Math.abs(z) < 0.001 ? 0.82 : architecturalDrawing ? (major ? 0.42 : 0.24) : (major ? 0.18 : 0.08)}
        strokeWidth={Math.abs(z) < 0.001 ? drawingStyle.weights.medium : major ? drawingStyle.weights.reference + 0.3 : drawingStyle.weights.reference}
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
    stationOffsetMeters = 0,
  ) => {
    const top = worldToScreen({ xMeters: station + stationOffsetMeters, zMeters: topElevationMeters });
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

  const projectionWidthForColumn = (column: StructuralFrameSystemParameters['columns'][number], face: ElevationFace) =>
    face === 'north' || face === 'south' ? column.widthMeters : column.depthMeters;

  const projectionWidthForFooting = (footing: IsolatedFooting, face: ElevationFace) =>
    face === 'north' || face === 'south' ? footing.widthMeters : footing.lengthMeters;

  const wallTopElevationMeters = resolvedRoofSystem?.supported
    ? resolvedRoofSystem.roofBeamTopY
    : frameSystem?.beams
        .filter((beam) => beam.kind === 'roof_beam')
        .reduce((top, beam) => Math.max(top, beam.topElevationMeters), layoutBounds?.maxY ?? 3)
      ?? layoutBounds?.maxY
      ?? 3;
  const infillBaseElevationMeters = frameSystem?.beams
    .filter((beam) => beam.kind === 'plinth_beam')
    .reduce((top, beam) => Math.max(top, beam.topElevationMeters), 0)
    ?? 0;
  const infillTopElevationMeters = frameSystem?.beams
    .filter((beam) => beam.kind === 'roof_beam')
    .reduce((base, beam) => Math.min(base, beam.baseElevationMeters), wallTopElevationMeters)
    ?? wallTopElevationMeters;

  const renderInfillPanels = (
    face: ElevationFace,
    keyPrefix: string,
    stationOffsetMeters = 0,
  ) => {
    const columns = (frameSystem?.columns ?? [])
      .map((column) => {
        const station = stationForFace(face, column.position);
        const halfWidth = projectionWidthForColumn(column, face) / 2;
        return { column, station, halfWidth };
      })
      .sort((a, b) => a.station - b.station);
    if (columns.length < 2) return null;
    const panelBase = infillBaseElevationMeters;
    const panelTop = Math.max(panelBase + 0.1, infillTopElevationMeters);
    const panels = columns.slice(0, -1).map((left, index) => {
      const right = columns[index + 1]!;
      const panelStart = left.station + left.halfWidth;
      const panelEnd = right.station - right.halfWidth;
      if (panelEnd - panelStart < 0.12) return null;
      const topLeft = worldToScreen({ xMeters: panelStart + stationOffsetMeters, zMeters: panelTop });
      const bottomRight = worldToScreen({ xMeters: panelEnd + stationOffsetMeters, zMeters: panelBase });
      const width = Math.max(4, bottomRight.sx - topLeft.sx);
      const height = Math.max(6, bottomRight.sy - topLeft.sy);
      const courseLines = Array.from({ length: Math.max(0, Math.floor((panelTop - panelBase) / 0.2)) }, (_, courseIndex) => {
        const z = panelBase + (courseIndex + 1) * 0.2;
        const start = worldToScreen({ xMeters: panelStart + stationOffsetMeters, zMeters: z });
        const end = worldToScreen({ xMeters: panelEnd + stationOffsetMeters, zMeters: z });
        return (
          <line
            key={`${keyPrefix}-infill-${index}-course-${courseIndex}`}
            x1={start.sx}
            y1={start.sy}
            x2={end.sx}
            y2={end.sy}
            stroke={referenceStroke}
            strokeWidth={drawingStyle.weights.reference}
            strokeOpacity={0.22}
            data-elevation-wall-course="true"
          />
        );
      });
      return (
        <g key={`${keyPrefix}-infill-panel-${left.column.id}-${right.column.id}`} pointerEvents="none" data-elevation-infill-panel={keyPrefix}>
          <rect
            x={topLeft.sx}
            y={topLeft.sy}
            width={width}
            height={height}
            fill={architecturalDrawing ? '#ffffff' : '#33415555'}
            fillOpacity={architecturalDrawing ? 0.5 : 0.38}
            stroke={mutedStroke}
            strokeWidth={drawingStyle.weights.light + 0.2}
          />
          {courseLines}
        </g>
      );
    });
    return (
      <g key={`${keyPrefix}-infill-panels`} pointerEvents="none" data-elevation-wall-envelope={keyPrefix}>
        {panels}
      </g>
    );
  };

  const roofPointToScreen = (face: ElevationFace, point: RoofVec3, stationOffsetMeters = 0) =>
    worldToScreen({ xMeters: stationForFace(face, point) + stationOffsetMeters, zMeters: point.y });

  const modelPointToScreen = (face: ElevationFace, point: { x: number; y: number; z: number }, stationOffsetMeters = 0) =>
    worldToScreen({ xMeters: stationForFace(face, point) + stationOffsetMeters, zMeters: point.y });

  const renderProjectedRoofLine = (
    key: string,
    face: ElevationFace,
    startPoint: RoofVec3,
    endPoint: RoofVec3,
    stationOffsetMeters: number,
    options: {
      stroke?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      strokeDasharray?: string;
      data?: Record<string, string>;
    } = {},
  ) => {
    const start = roofPointToScreen(face, startPoint, stationOffsetMeters);
    const end = roofPointToScreen(face, endPoint, stationOffsetMeters);
    if (Math.hypot(end.sx - start.sx, end.sy - start.sy) < 2) return null;
    return (
      <line
        key={key}
        x1={start.sx}
        y1={start.sy}
        x2={end.sx}
        y2={end.sy}
        stroke={options.stroke ?? permanentStroke}
        strokeWidth={options.strokeWidth ?? drawingStyle.weights.medium}
        strokeOpacity={options.strokeOpacity ?? 1}
        strokeDasharray={options.strokeDasharray}
        pointerEvents="none"
        {...options.data}
      />
    );
  };

  const renderProjectedRoofMember = (
    key: string,
    face: ElevationFace,
    startPoint: RoofVec3,
    endPoint: RoofVec3,
    stationOffsetMeters: number,
    profileDepthMeters: number,
    options: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      data?: Record<string, string>;
    } = {},
  ) => {
    const start = roofPointToScreen(face, startPoint, stationOffsetMeters);
    const end = roofPointToScreen(face, endPoint, stationOffsetMeters);
    const dx = end.sx - start.sx;
    const dy = end.sy - start.sy;
    const length = Math.hypot(dx, dy);
    if (length < 2) return null;
    const half = Math.max(2, (profileDepthMeters * viewport.zoom) / 2);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    const points = [
      `${start.sx + nx},${start.sy + ny}`,
      `${end.sx + nx},${end.sy + ny}`,
      `${end.sx - nx},${end.sy - ny}`,
      `${start.sx - nx},${start.sy - ny}`,
    ].join(' ');
    return (
      <polygon
        key={key}
        points={points}
        fill={options.fill ?? (architecturalDrawing ? '#e5e7eb' : '#475569')}
        stroke={options.stroke ?? permanentStroke}
        strokeWidth={options.strokeWidth ?? drawingStyle.weights.light}
        opacity={options.opacity ?? 1}
        pointerEvents="none"
        {...options.data}
      />
    );
  };

  const renderProjectedModelMember = (
    key: string,
    face: ElevationFace,
    startPoint: { x: number; y: number; z: number },
    endPoint: { x: number; y: number; z: number },
    stationOffsetMeters: number,
    profileDepthMeters: number,
    options: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      data?: Record<string, string>;
    } = {},
  ) => {
    const start = modelPointToScreen(face, startPoint, stationOffsetMeters);
    const end = modelPointToScreen(face, endPoint, stationOffsetMeters);
    const dx = end.sx - start.sx;
    const dy = end.sy - start.sy;
    const length = Math.hypot(dx, dy);
    if (length < 2) return null;
    const half = Math.max(2, (profileDepthMeters * viewport.zoom) / 2);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    const points = [
      `${start.sx + nx},${start.sy + ny}`,
      `${end.sx + nx},${end.sy + ny}`,
      `${end.sx - nx},${end.sy - ny}`,
      `${start.sx - nx},${start.sy - ny}`,
    ].join(' ');
    return (
      <polygon
        key={key}
        points={points}
        fill={options.fill ?? (architecturalDrawing ? '#e5e7eb' : '#475569')}
        stroke={options.stroke ?? permanentStroke}
        strokeWidth={options.strokeWidth ?? drawingStyle.weights.light}
        opacity={options.opacity ?? 1}
        pointerEvents="none"
        {...options.data}
      />
    );
  };

  const floorFinishSpan = (face: ElevationFace): { center: number; width: number } | null => {
    const stations: number[] = [];
    floorTileLayout?.placements.forEach((tile) => {
      const halfX = tile.renderWidthMeters / 2;
      const halfZ = tile.renderDepthMeters / 2;
      stations.push(
        stationForFace(face, { x: tile.renderCenter.x - halfX, z: tile.renderCenter.z - halfZ }),
        stationForFace(face, { x: tile.renderCenter.x + halfX, z: tile.renderCenter.z + halfZ }),
      );
    });
    if (stations.length === 0 && layoutBounds) {
      stations.push(
        face === 'north' || face === 'south' ? layoutBounds.minX : layoutBounds.minZ,
        face === 'north' || face === 'south' ? layoutBounds.maxX : layoutBounds.maxZ,
      );
    }
    if (stations.length === 0) return null;
    const min = Math.min(...stations);
    const max = Math.max(...stations);
    return { center: (min + max) / 2, width: Math.max(0.05, max - min) };
  };

  const renderFloorFinishProjection = (
    face: ElevationFace,
    keyPrefix: string,
    stationOffsetMeters = 0,
  ) => {
    if (!floorTileLayout?.enabled) return null;
    const span = floorFinishSpan(face);
    if (!span) return null;
    const slabTop = interiorFloorSlab?.topElevationMeters ?? 0;
    const thinsetTop = slabTop + floorTileLayout.thinsetThicknessMeters;
    const tileTop = thinsetTop + FLOOR_TILE_SURFACE_THICKNESS_METERS;
    return (
      <g key={`${keyPrefix}-floor-finish`} pointerEvents="none" data-elevation-floor-finish={keyPrefix}>
        {renderRect(`${keyPrefix}-floor-thinset`, span.center, thinsetTop, span.width, floorTileLayout.thinsetThicknessMeters, {
          fill: architecturalDrawing ? '#d6c79f' : '#a16207',
          stroke: mutedStroke,
          strokeWidth: drawingStyle.weights.light,
          data: { 'data-elevation-floor-thinset': keyPrefix },
        }, stationOffsetMeters)}
        {floorTileLayout.placements.map((tile) => {
          const station = stationForFace(face, tile.renderCenter);
          const width = Math.max(0.01, face === 'north' || face === 'south' ? tile.renderWidthMeters : tile.renderDepthMeters);
          return renderRect(`${keyPrefix}-floor-tile-${tile.id}`, station, tileTop, width, FLOOR_TILE_SURFACE_THICKNESS_METERS, {
            fill: tile.kind === 'cut' ? (architecturalDrawing ? '#d7d2cb' : '#78716c') : (architecturalDrawing ? '#ece7df' : '#9a8f84'),
            stroke: referenceStroke,
            strokeWidth: drawingStyle.weights.reference,
            data: { 'data-elevation-floor-tile': tile.kind },
          }, stationOffsetMeters);
        })}
      </g>
    );
  };

  const renderPlywoodCeilingProjection = (
    face: ElevationFace,
    keyPrefix: string,
    stationOffsetMeters = 0,
  ) => {
    if (!plywoodCeilingLayout?.enabled) return null;
    return (
      <g key={`${keyPrefix}-plywood-ceiling`} pointerEvents="none" data-elevation-plywood-ceiling={keyPrefix}>
        {plywoodCeilingLayout.panelPlacements.map((panel) => {
          const station = stationForFace(face, panel.center);
          const width = Math.max(0.01, face === 'north' || face === 'south' ? panel.widthMeters : panel.lengthMeters);
          const top = panel.center.y + panel.thicknessMeters / 2;
          return renderRect(`${keyPrefix}-ceiling-plywood-${panel.id}`, station, top, width, panel.thicknessMeters, {
            fill: architecturalDrawing ? '#d7b98f' : plywoodCeilingLayout.plywoodColor,
            stroke: mutedStroke,
            strokeWidth: drawingStyle.weights.reference,
            data: { 'data-elevation-ceiling-plywood': panel.kind },
          }, stationOffsetMeters);
        })}
        {plywoodCeilingLayout.frameMembers.map((member) =>
          renderProjectedModelMember(`${keyPrefix}-ceiling-frame-${member.id}`, face, member.start, member.end, stationOffsetMeters, member.heightMeters, {
            fill: architecturalDrawing ? '#e5e7eb' : '#374151',
            stroke: permanentStroke,
            strokeWidth: drawingStyle.weights.light,
            opacity: 0.92,
            data: { 'data-elevation-ceiling-frame': member.kind },
          }),
        )}
      </g>
    );
  };

  const renderRoofProjection = (
    face: ElevationFace,
    keyPrefix: string,
    stationOffsetMeters = 0,
  ) => {
    if (!resolvedRoofSystem?.supported) return null;
    const roof = resolvedRoofSystem;
    const lineKey = (start: RoofVec3, end: RoofVec3) =>
      [
        stationForFace(face, start) + stationOffsetMeters,
        start.y,
        stationForFace(face, end) + stationOffsetMeters,
        end.y,
      ].map((value) => value.toFixed(3)).join(':');
    const projectedLineKeys = new Set<string>();
    const projectedMemberKeys = new Set<string>();
    const uniqueLine = (
      key: string,
      start: RoofVec3,
      end: RoofVec3,
      options: Parameters<typeof renderProjectedRoofLine>[5],
    ) => {
      const normalizedKey = lineKey(start, end);
      const reverseKey = lineKey(end, start);
      if (projectedLineKeys.has(normalizedKey) || projectedLineKeys.has(reverseKey)) return null;
      projectedLineKeys.add(normalizedKey);
      return renderProjectedRoofLine(key, face, start, end, stationOffsetMeters, options);
    };
    const uniqueMember = (
      key: string,
      start: RoofVec3,
      end: RoofVec3,
      profileDepthMeters: number,
      options: Parameters<typeof renderProjectedRoofMember>[6],
    ) => {
      const normalizedKey = lineKey(start, end);
      const reverseKey = lineKey(end, start);
      if (projectedMemberKeys.has(normalizedKey) || projectedMemberKeys.has(reverseKey)) return null;
      projectedMemberKeys.add(normalizedKey);
      return renderProjectedRoofMember(key, face, start, end, stationOffsetMeters, profileDepthMeters, options);
    };
    const planeSource = roof.claddingDisplayPlanes.length > 0 ? roof.claddingDisplayPlanes : roof.roofTopPlanes;
    return (
      <g key={`${keyPrefix}-roof-projection`} pointerEvents="none" data-elevation-roof-projection={keyPrefix}>
        {planeSource.flatMap((plane) =>
          plane.corners.map((corner, index) => {
            const next = plane.corners[(index + 1) % plane.corners.length];
            if (!next) return null;
            return uniqueLine(`${keyPrefix}-roof-plane-${plane.id}-${index}`, corner, next, {
              stroke: mutedStroke,
              strokeWidth: drawingStyle.weights.light + 0.4,
              strokeOpacity: 0.7,
              data: { 'data-elevation-roof-plane': plane.id },
            });
          }),
        )}
        {roof.gableEndRoofingClosures.flatMap((closure) =>
          closure.corners.map((corner, index) => {
            const next = closure.corners[(index + 1) % closure.corners.length];
            if (!next) return null;
            return uniqueLine(`${keyPrefix}-gable-closure-${closure.id}-${index}`, corner, next, {
              stroke: referenceStroke,
              strokeWidth: drawingStyle.weights.light,
              strokeOpacity: 0.72,
              data: { 'data-elevation-gable-closure': closure.id },
            });
          }),
        )}
        {roof.purlinPlacements.map((purlin) =>
          uniqueMember(`${keyPrefix}-purlin-${purlin.id}`, purlin.start, purlin.end, PURLIN_PROFILE_DEPTH_METERS, {
            fill: architecturalDrawing ? '#f1f5f9' : '#475569',
            stroke: mutedStroke,
            strokeWidth: drawingStyle.weights.light,
            opacity: 0.9,
            data: { 'data-elevation-roof-purlin': purlin.slopePlaneId },
          }),
        )}
        {roof.trussPlacements.flatMap((truss) =>
          truss.members.map((member) => {
            const isPrimary = member.memberKind === 'bottom_chord' || member.memberKind.startsWith('top_chord');
            return uniqueMember(`${keyPrefix}-truss-${truss.id}-${member.id}`, member.start, member.end, TRUSS_CHORD_PROFILE_METERS, {
              fill: isPrimary ? (architecturalDrawing ? '#e5e7eb' : '#334155') : (architecturalDrawing ? '#f8fafc' : '#475569'),
              stroke: isPrimary ? permanentStroke : mutedStroke,
              strokeWidth: isPrimary ? drawingStyle.weights.medium : drawingStyle.weights.light + 0.35,
              opacity: isPrimary ? 0.96 : 0.84,
              data: { 'data-elevation-roof-truss-member': member.memberKind, 'data-elevation-roof-truss-id': truss.id },
            });
          }),
        )}
        {roof.hipFramingMembers.map((member) => {
          const isPrimary = member.memberKind === 'ridge' || member.memberKind === 'hip';
          const isSupportFrame = member.memberKind.startsWith('ridge_end_frame') || member.memberKind === 'hip_corner_support';
          return renderProjectedRoofMember(`${keyPrefix}-hip-framing-${member.id}`, face, member.start, member.end, stationOffsetMeters, TRUSS_CHORD_PROFILE_METERS, {
            fill: isPrimary
              ? (architecturalDrawing ? '#e5e7eb' : '#334155')
              : (architecturalDrawing ? '#f8fafc' : '#475569'),
            stroke: isPrimary ? permanentStroke : mutedStroke,
            strokeWidth: isPrimary ? drawingStyle.weights.medium : drawingStyle.weights.light + 0.35,
            opacity: isPrimary ? 0.96 : isSupportFrame ? 0.78 : 0.86,
            data: {
              'data-elevation-roof-member': member.memberKind,
              'data-elevation-roof-hip-framing-member': member.memberKind,
              'data-elevation-roof-hip-framing-id': member.id,
              ...(member.slopePlaneId ? { 'data-elevation-roof-slope-plane': member.slopePlaneId } : {}),
            },
          });
        })}
        {roof.ridgeStart && roof.ridgeEnd
          ? renderProjectedRoofLine(`${keyPrefix}-roof-ridge`, face, roof.ridgeStart, roof.ridgeEnd, stationOffsetMeters, {
              stroke: permanentStroke,
              strokeWidth: drawingStyle.weights.heavy,
              data: { 'data-elevation-roof-ridge': 'true' },
            })
          : null}
      </g>
    );
  };

  const renderGeneratedBeam = (beam: StructuralBeam, face = FRONT_ELEVATION_FACE, keyPrefix = 'front', stationOffsetMeters = 0) => {
    const startStation = stationForFace(face, { x: beam.startPoint.x, z: beam.startPoint.z });
    const endStation = stationForFace(face, { x: beam.endPoint.x, z: beam.endPoint.z });
    const centerStation = (startStation + endStation) / 2;
    return renderRect(`${keyPrefix}-beam-${beam.id}`, centerStation, beam.topElevationMeters, Math.abs(endStation - startStation), beam.depthMeters, {
      fill: architecturalDrawing ? '#eef2f7' : '#94a3b866',
      stroke: architecturalDrawing ? mutedStroke : '#475569',
      strokeWidth: drawingStyle.weights.medium,
      data: { 'data-canvas-layer': 'beams-walls', 'data-beam-kind': beam.kind },
    }, stationOffsetMeters);
  };

  const renderGeneratedColumn = (
    column: StructuralFrameSystemParameters['columns'][number],
    face = FRONT_ELEVATION_FACE,
    keyPrefix = 'front',
    stationOffsetMeters = 0,
  ) => {
    const selected = false;
    const station = stationForFace(face, column.position);
    const center = worldToScreen({ xMeters: station + stationOffsetMeters, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 });
    const projectionWidth = projectionWidthForColumn(column, face);
    return (
      <g key={`${keyPrefix}-${column.id}`} pointerEvents="none" data-canvas-layer="columns">
        {renderRect(`${keyPrefix}-column-body-${column.id}`, station, column.topElevationMeters, projectionWidth, column.heightMeters, {
          fill: concreteFill,
          stroke: selected ? selectionStroke : permanentStroke,
          strokeWidth: selected ? drawingStyle.weights.selection : drawingStyle.weights.medium,
        }, stationOffsetMeters)}
        <line
          x1={worldToScreen({ xMeters: station + stationOffsetMeters - projectionWidth * 0.8, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sx}
          y1={center.sy}
          x2={worldToScreen({ xMeters: station + stationOffsetMeters + projectionWidth * 0.8, zMeters: (column.topElevationMeters + column.baseElevationMeters) / 2 }).sx}
          y2={center.sy}
          stroke={referenceStroke}
          strokeWidth={1}
          strokeOpacity={0.65}
        />
      </g>
    );
  };

  const renderComponent = (
    component: DesignRenderRcComponent,
    preview = false,
    face = FRONT_ELEVATION_FACE,
    keyPrefix = 'front',
    stationOffsetMeters = 0,
  ) => {
    const station = stationForFace(face, component.position);
    const widthMeters = renderWidthForComponentFace(component, face);
    const heightMeters = componentThicknessForElevation(component);
    const fill = preview ? previewFill : component.type === 'footer' ? (architecturalDrawing ? '#f1f5f9' : '#78716c66') : concreteFill;
    const stroke = preview ? previewStroke : component.type === 'footer' ? mutedStroke : permanentStroke;
    const top = component.type === 'footer' || component.type === 'slab'
      ? component.elevations.top
      : component.elevations.top;
    return renderRect(`${keyPrefix}-component-${component.id}-${preview ? 'preview' : 'placed'}`, station, top, widthMeters, heightMeters, {
      fill,
      stroke,
      strokeWidth: preview ? drawingStyle.weights.preview : drawingStyle.weights.medium,
      strokeDasharray: preview ? '6 4' : undefined,
      opacity: preview ? 0.82 : 1,
      data: {
        'data-component-id': component.id,
        'data-component-type': component.type,
        'data-component-system': component.system,
        'data-canvas-layer': preview ? 'active-placement-preview' : `component-${component.type}`,
        'data-elevation-projection': keyPrefix,
        'data-projected-width-meters': widthMeters.toFixed(3),
      },
    }, stationOffsetMeters);
  };

  const renderComponentFooter = (
    component: DesignRenderRcComponent,
    face = FRONT_ELEVATION_FACE,
    keyPrefix = 'front',
    stationOffsetMeters = 0,
  ) => {
    if (component.type !== 'column' || !component.footer) return null;
    const station = stationForFace(face, component.position);
    const projectedWidthMeters = projectionAxisForFace(face) === 'x'
      ? component.footer.widthMeters
      : component.footer.lengthMeters;
    return renderRect(`${keyPrefix}-component-footer-${component.id}`, station, component.footer.topElevationMeters, projectedWidthMeters, component.footer.thicknessMeters, {
      fill: architecturalDrawing ? '#f1f5f9' : '#78716c66',
      stroke: mutedStroke,
      strokeWidth: drawingStyle.weights.light,
      strokeDasharray: '6 4',
      data: {
        'data-canvas-layer': 'footers-foundations',
        'data-component-footer-for': component.id,
        'data-elevation-projection': keyPrefix,
        'data-projected-width-meters': projectedWidthMeters.toFixed(3),
      },
    }, stationOffsetMeters);
  };

  const helperAnchor = previewRenderModel.rcComponents[0]
    ? worldToScreen({
        xMeters: stationForFace(FRONT_ELEVATION_FACE, previewRenderModel.rcComponents[0].position),
        zMeters: previewRenderModel.rcComponents[0].elevations.top,
      })
    : null;
  const elevationAnnotationPrimitives: DrawingPrimitive[] = [];
  if (architecturalDrawing) {
    const frontGroundStart = worldToScreen({ xMeters: frontModelBounds.minX, zMeters: 0 });
    const frontGroundEnd = worldToScreen({ xMeters: frontModelBounds.maxX, zMeters: 0 });
    const frontTopLevel = worldToScreen({ xMeters: frontModelBounds.minX, zMeters: modelBounds.maxZ });
    const frontPlinthLevel = worldToScreen({ xMeters: frontModelBounds.minX, zMeters: 0 });
    const sideGroundStart = worldToScreen({ xMeters: sideModelBounds.minX + sideElevationStationOffsetMeters, zMeters: 0 });
    const sideGroundEnd = worldToScreen({ xMeters: sideModelBounds.maxX + sideElevationStationOffsetMeters, zMeters: 0 });
    const frontTitleX = (frontGroundStart.sx + frontGroundEnd.sx) / 2;
    const sideTitleX = (sideGroundStart.sx + sideGroundEnd.sx) / 2;
    const titleY = Math.max(34, Math.min(frontGroundStart.sy, sideGroundStart.sy) - Math.max(76, viewport.zoom * 0.65));
    elevationAnnotationPrimitives.push(
      {
        kind: 'text',
        key: 'elevation-title',
        x: surfaceSize.width / 2,
        y: 30,
        text: 'Elevation View',
        anchor: 'middle',
        size: 12,
        weight: 'bold',
        data: { 'data-drawing-annotation': 'elevation-title' },
      },
      {
        kind: 'text',
        key: 'front-elevation-title',
        x: frontTitleX,
        y: titleY,
        text: sheetElevationTitle(FRONT_ELEVATION_FACE),
        anchor: 'middle',
        size: 11,
        weight: 'bold',
        data: { 'data-drawing-annotation': 'front-elevation-title' },
      },
      {
        kind: 'text',
        key: 'side-elevation-title',
        x: sideTitleX,
        y: titleY,
        text: sheetElevationTitle(SIDE_ELEVATION_FACE),
        anchor: 'middle',
        size: 11,
        weight: 'bold',
        data: { 'data-drawing-annotation': 'side-elevation-title' },
      },
      {
        kind: 'line',
        key: 'front-elevation-ground',
        x1: frontGroundStart.sx - 24,
        y1: frontGroundStart.sy,
        x2: frontGroundEnd.sx + 24,
        y2: frontGroundEnd.sy,
        weight: 'heavy',
        data: { 'data-drawing-annotation': 'ground-line', 'data-elevation-projection': 'front' },
      },
      {
        kind: 'line',
        key: 'side-elevation-ground',
        x1: sideGroundStart.sx - 24,
        y1: sideGroundStart.sy,
        x2: sideGroundEnd.sx + 24,
        y2: sideGroundEnd.sy,
        weight: 'heavy',
        data: { 'data-drawing-annotation': 'ground-line', 'data-elevation-projection': 'side' },
      },
      {
        kind: 'levelMarker',
        key: 'level-000',
        x: frontPlinthLevel.sx - 56,
        y: frontPlinthLevel.sy,
        label: '+0.000',
        direction: 'right',
        data: { 'data-drawing-annotation': 'level-marker' },
      },
      {
        kind: 'levelMarker',
        key: 'level-top',
        x: frontTopLevel.sx - 56,
        y: frontTopLevel.sy,
        label: `+${formatDisplayLength(modelBounds.maxZ, measurementSystem)}`,
        direction: 'right',
        data: { 'data-drawing-annotation': 'level-marker' },
      },
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-700" data-drawing-style-mode={drawingStyleMode}>
      <div
        className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-full border border-cyan-700 bg-slate-900/90 px-3 py-1 text-xs font-medium text-cyan-200"
        data-view-grid-meters={gridState.displayMinorSpacingMeters}
      >
        <span>Front + Side Elevation | View grid {formatPlanGridSpacingMeters(gridState.displayMinorSpacingMeters, measurementSystem)}</span>
        <span className="sr-only">
          {faceLabel(elevationView.face)} · View grid {formatPlanGridSpacingMeters(gridState.displayMinorSpacingMeters, measurementSystem)}
        </span>
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
        <rect width={surfaceSize.width} height={surfaceSize.height} fill={drawingStyle.viewportFill} data-canvas-layer="background" />
        <rect
          x={architecturalDrawing ? 18 : 0}
          y={architecturalDrawing ? 18 : 0}
          width={architecturalDrawing ? Math.max(0, surfaceSize.width - 36) : surfaceSize.width}
          height={architecturalDrawing ? Math.max(0, surfaceSize.height - 36) : surfaceSize.height}
          fill={sheetBackerFill}
          stroke={architecturalDrawing ? drawingStyle.sheetStroke : 'none'}
          strokeWidth={architecturalDrawing ? 1 : 0}
          pointerEvents="none"
          data-canvas-layer="drawing-sheet"
        />
        <g data-canvas-layer="grid" className="text-slate-400">
          {gridLines}
        </g>
        <g data-canvas-layer="axes">
          <line x1={horizontalAxisStart.sx} y1={horizontalAxisStart.sy} x2={horizontalAxisEnd.sx} y2={horizontalAxisEnd.sy} stroke={referenceStroke} strokeWidth={1.2} strokeOpacity={0.7} pointerEvents="none" />
          <line x1={verticalAxisStart.sx} y1={verticalAxisStart.sy} x2={verticalAxisEnd.sx} y2={verticalAxisEnd.sy} stroke={referenceStroke} strokeWidth={1.2} strokeOpacity={0.7} pointerEvents="none" />
          <line x1={origin.sx - 10} y1={origin.sy} x2={origin.sx + 10} y2={origin.sy} stroke={referenceStroke} strokeWidth={1.4} pointerEvents="none" />
          <line x1={origin.sx} y1={origin.sy - 10} x2={origin.sx} y2={origin.sy + 10} stroke={referenceStroke} strokeWidth={1.4} pointerEvents="none" />
          <circle cx={origin.sx} cy={origin.sy} r={4} fill={referenceStroke} pointerEvents="none" />
          <text x={origin.sx + 8} y={origin.sy - 8} fill={drawingStyle.textFill} fontSize={10} fontWeight={700} pointerEvents="none">0,0</text>
          <text x={horizontalAxisEnd.sx - 6} y={origin.sy - 6} textAnchor="end" fill={mutedStroke} fontSize={10} fontWeight={600} pointerEvents="none">+Station</text>
          <text x={origin.sx + 6} y={verticalAxisEnd.sy + 14} fill={mutedStroke} fontSize={10} fontWeight={600} pointerEvents="none">+Z Height</text>
        </g>
        {elevationAnnotationPrimitives.map((primitive) => renderDrawingPrimitive(primitive, drawingStyle))}

        <g data-canvas-layer="walls">
          {renderInfillPanels(FRONT_ELEVATION_FACE, 'front')}
          {renderInfillPanels(SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters)}
        </g>
        <g data-canvas-layer="footers-foundations">
          {isolatedFootings.map((footing) => {
            const station = stationForFace(FRONT_ELEVATION_FACE, footing.position);
            return renderRect(`front-footing-${footing.id}`, station, footing.topElevationMeters, projectionWidthForFooting(footing, FRONT_ELEVATION_FACE), footing.thicknessMeters, {
              fill: architecturalDrawing ? '#f1f5f9' : '#78716c66',
              stroke: mutedStroke,
              strokeWidth: drawingStyle.weights.light,
              data: { 'data-elevation-footing': footing.id },
            });
          })}
          {isolatedFootings.map((footing) => {
            const station = stationForFace(SIDE_ELEVATION_FACE, footing.position);
            return renderRect(`side-footing-${footing.id}`, station, footing.topElevationMeters, projectionWidthForFooting(footing, SIDE_ELEVATION_FACE), footing.thicknessMeters, {
              fill: architecturalDrawing ? '#f1f5f9' : '#78716c66',
              stroke: mutedStroke,
              strokeWidth: drawingStyle.weights.light,
              data: { 'data-elevation-footing': footing.id },
            }, sideElevationStationOffsetMeters);
          })}
          {committedRenderModel.rcComponents.map((component) => renderComponentFooter(component, FRONT_ELEVATION_FACE, 'front'))}
          {committedRenderModel.rcComponents.map((component) => renderComponentFooter(component, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'footer').map((component) => renderComponent(component, false, FRONT_ELEVATION_FACE, 'front'))}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'footer').map((component) => renderComponent(component, false, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
        </g>
        <g data-canvas-layer="slabs">
          {committedRenderModel.rcComponents.filter((component) => component.type === 'slab').map((component) => renderComponent(component, false, FRONT_ELEVATION_FACE, 'front'))}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'slab').map((component) => renderComponent(component, false, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
        </g>
        <g data-canvas-layer="floor-finishes">
          {renderFloorFinishProjection(FRONT_ELEVATION_FACE, 'front')}
          {renderFloorFinishProjection(SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters)}
        </g>
        <g data-canvas-layer="ceiling-finishes">
          {renderPlywoodCeilingProjection(FRONT_ELEVATION_FACE, 'front')}
          {renderPlywoodCeilingProjection(SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters)}
        </g>
        <g data-canvas-layer="beams-walls">
          {frameSystem?.beams.map((beam) => renderGeneratedBeam(beam, FRONT_ELEVATION_FACE, 'front'))}
          {frameSystem?.beams.map((beam) => renderGeneratedBeam(beam, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
          {committedRenderModel.rcComponents
            .filter((component) => component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam')
            .map((component) => renderComponent(component, false, FRONT_ELEVATION_FACE, 'front'))}
          {committedRenderModel.rcComponents
            .filter((component) => component.type === 'tie_beam' || component.type === 'plinth_beam' || component.type === 'roof_beam')
            .map((component) => renderComponent(component, false, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
        </g>
        <g data-canvas-layer="columns">
          {frameSystem?.columns.map((column) => renderGeneratedColumn(column, FRONT_ELEVATION_FACE, 'front'))}
          {frameSystem?.columns.map((column) => renderGeneratedColumn(column, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'column').map((component) => renderComponent(component, false, FRONT_ELEVATION_FACE, 'front'))}
          {committedRenderModel.rcComponents.filter((component) => component.type === 'column').map((component) => renderComponent(component, false, SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters))}
        </g>
        <g data-canvas-layer="placed-openings">
          {[
            { face: FRONT_ELEVATION_FACE, keyPrefix: 'front', stationOffsetMeters: 0 },
            { face: SIDE_ELEVATION_FACE, keyPrefix: 'side', stationOffsetMeters: sideElevationStationOffsetMeters },
          ].flatMap(({ face, keyPrefix, stationOffsetMeters }) => openings.map((opening) => {
            const projection = openingProjectionForFace(opening, face, frameBySegmentId);
            if (!projection) return null;
            const sill = numberValue(opening.sillHeightMeters, opening.type === 'door' ? 0 : 0.9);
            const top = sill + opening.heightMeters;
            const point = worldToScreen({ xMeters: projection.station + stationOffsetMeters, zMeters: top });
            const width = Math.max(8, projection.widthMeters * viewport.zoom);
            const height = Math.max(8, opening.heightMeters * viewport.zoom);
            return (
              <g
                key={`${keyPrefix}-${opening.id}`}
                pointerEvents="none"
                data-opening-id={opening.id}
                data-opening-type={opening.type}
                data-elevation-projection={keyPrefix}
                data-opening-station-meters={projection.station.toFixed(3)}
                data-projected-width-meters={projection.widthMeters.toFixed(3)}
              >
                <rect
                  x={point.sx - width / 2}
                  y={point.sy}
                  width={width}
                  height={height}
                  fill={architecturalDrawing ? '#ffffff' : '#0f172a99'}
                  stroke={drawingStyle.openingStroke}
                  strokeWidth={1.5}
                />
                {opening.type === 'window' ? (
                  <line
                    x1={point.sx - width / 2 + 4}
                    y1={point.sy + height / 2}
                    x2={point.sx + width / 2 - 4}
                    y2={point.sy + height / 2}
                    stroke={drawingStyle.openingStroke}
                    strokeWidth={1}
                    strokeOpacity={0.85}
                  />
                ) : null}
              </g>
            );
          }))}
        </g>
        <g data-canvas-layer="roof-structure">
          {renderRoofProjection(FRONT_ELEVATION_FACE, 'front')}
          {renderRoofProjection(SIDE_ELEVATION_FACE, 'side', sideElevationStationOffsetMeters)}
        </g>
        <g data-canvas-layer="active-placement-preview">
          {previewRenderModel.rcComponents.map((component) => renderComponent(component, true, FRONT_ELEVATION_FACE, 'front'))}
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
          {coordinateLabelForElevationFace(elevationView.face)} {formatDisplayLength(cursor ? cursor.xMeters : (elevationView.cursorX ?? 0), measurementSystem)} /{' '}
          {formatDisplayLength(cursor ? cursor.zMeters : (elevationView.cursorZ ?? 0), measurementSystem)}
        </div>
        <div className="text-[10px] font-semibold text-slate-400">{faceLabel(elevationView.face)}</div>
      </div>
    </div>
  );
}
