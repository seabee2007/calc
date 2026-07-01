import type { SegmentFrame } from '../geometry/designGeometry';
import type { Drawing2dStyle } from './design2dDrawingPrimitives';
import type { ResolvedOpeningPlacement } from './openingPlacementResolver';
import {
  buildDoorSwingArcScreenPath,
  buildPlanDoorSymbolGeometry,
  DEFAULT_DOOR_SWING_DIRECTION,
  DEFAULT_DOOR_SWING_TYPE,
  formatDoorSwingLabel,
  type DoorSwingDirection,
  type DoorSwingType,
} from './planDoorSymbol';
import {
  buildPlanOpeningGeometry,
  formatOpeningWidthLabel,
  formatRoughOpeningLabel,
  openingFillColor,
  openingMarkerScale,
  openingStrokeColor,
  openingColorState,
  shouldShowOpeningLabel,
  type PlanOpeningColorState,
} from './planOpeningGraphics';

export type PlanOpeningRenderItem = {
  key: string;
  openingType: 'door' | 'window';
  geometry: ReturnType<typeof buildPlanOpeningGeometry>;
  colorState: PlanOpeningColorState;
  selected: boolean;
  hovered: boolean;
  placing: boolean;
  showRoughLabel?: boolean;
  label?: string;
  swingLabel?: string;
  doorSymbol?: ReturnType<typeof buildPlanDoorSymbolGeometry>;
};

export function buildPlanOpeningRenderItem(params: {
  key: string;
  openingType: 'door' | 'window';
  resolved: ResolvedOpeningPlacement;
  frame: SegmentFrame;
  isValid: boolean;
  statusKind?: 'clean' | 'half_block' | 'cut_block' | 'invalid';
  selected?: boolean;
  hovered?: boolean;
  placing?: boolean;
  zoom: number;
  swingDirection?: DoorSwingDirection;
  swingType?: DoorSwingType;
}): PlanOpeningRenderItem {
  const geometry = buildPlanOpeningGeometry(params.resolved, params.frame);
  const colorState = openingColorState({ isValid: params.isValid, statusKind: params.statusKind });
  const showLabel = shouldShowOpeningLabel({
    zoom: params.zoom,
    selected: params.selected ?? false,
    hovered: params.hovered ?? false,
    placing: params.placing ?? false,
  });
  const swingDirection = params.swingDirection ?? DEFAULT_DOOR_SWING_DIRECTION;
  const swingType = params.swingType ?? DEFAULT_DOOR_SWING_TYPE;
  const doorSymbol =
    params.openingType === 'door'
      ? buildPlanDoorSymbolGeometry({ geometry, swingDirection, swingType })
      : undefined;
  const widthLabel = formatOpeningWidthLabel(geometry.actualWidthMeters);
  const swingLabel = params.openingType === 'door' ? formatDoorSwingLabel(swingType, swingDirection) : undefined;

  return {
    key: params.key,
    openingType: params.openingType,
    geometry,
    colorState,
    selected: params.selected ?? false,
    hovered: params.hovered ?? false,
    placing: params.placing ?? false,
    showRoughLabel: params.placing && Math.abs(geometry.roughWidthMeters - geometry.actualWidthMeters) > 0.01,
    label: showLabel
      ? params.openingType === 'door'
        ? params.placing || params.selected
          ? `Door ${widthLabel}`
          : widthLabel
        : params.selected
          ? `Window ${widthLabel}`
          : widthLabel
      : undefined,
    swingLabel: showLabel && params.openingType === 'door' ? swingLabel : undefined,
    doorSymbol,
  };
}

type ScreenPoint = { sx: number; sy: number };

function screenSegment(
  start: ScreenPoint,
  end: ScreenPoint,
  stroke: string,
  strokeWidth: number,
  dash?: string,
  data?: Record<string, string>,
) {
  return (
    <line
      x1={start.sx}
      y1={start.sy}
      x2={end.sx}
      y2={end.sy}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={dash}
      pointerEvents="none"
      {...data}
    />
  );
}

export function PlanOpeningSymbol({
  item,
  project,
  zoom,
  drawingStyle,
}: {
  item: PlanOpeningRenderItem;
  project: (point: { x: number; z: number }) => ScreenPoint;
  zoom: number;
  drawingStyle?: Drawing2dStyle;
}) {
  const active = item.placing || item.selected || item.hovered || item.colorState === 'invalid';
  const neutralStroke = drawingStyle?.openingStroke ?? openingStrokeColor('valid');
  const activeStroke =
    item.colorState === 'invalid'
      ? openingStrokeColor(item.colorState)
      : item.placing
        ? drawingStyle?.previewStroke ?? openingStrokeColor(item.colorState)
        : item.selected || item.hovered
          ? drawingStyle?.selectionStroke ?? openingStrokeColor(item.colorState)
          : neutralStroke;
  const stroke = active ? activeStroke : neutralStroke;
  const fill = active && item.placing ? openingFillColor(item.colorState, 0.12) : 'transparent';
  const textBacker = drawingStyle?.sheetFill ?? '#0f172a';
  const scale = openingMarkerScale(zoom);
  const center = project(item.geometry.center);
  const strokeWidth = (item.placing ? 4 : item.selected ? 3.5 : item.hovered ? 3 : 2.5) * scale;
  const actualStrokeWidth = (item.placing ? 3.5 : item.selected ? 3 : 2.5) * scale;
  const symbolStrokeWidth = Math.max(1.3, (item.placing ? 2.2 : 1.55) * scale);
  const showRoughConstruction = item.placing || item.colorState === 'invalid';
  const roughOutlinePoints = item.geometry.roughOpeningPolygon
    .map((point) => {
      const screenPoint = project(point);
      return `${screenPoint.sx},${screenPoint.sy}`;
    })
    .join(' ');

  const door = item.doorSymbol;
  const hingeScreen = door ? project(door.hinge) : null;
  const closedLeafScreen = door ? project(door.closedLeafEnd) : null;
  const openLeafScreen = door ? project(door.openLeafEnd) : null;
  const swingScreenPath =
    door && hingeScreen && closedLeafScreen && openLeafScreen
      ? buildDoorSwingArcScreenPath({
          hinge: hingeScreen,
          closedLeafEnd: closedLeafScreen,
          openLeafEnd: openLeafScreen,
        })
      : null;

  const windowFaceRatios = item.openingType === 'window' ? [0.22, 0.5, 0.78] : [];

  const pointBetweenFaces = (pair: { exterior: { x: number; z: number }; interior: { x: number; z: number } }, ratio: number) => ({
    x: pair.exterior.x + (pair.interior.x - pair.exterior.x) * ratio,
    z: pair.exterior.z + (pair.interior.z - pair.exterior.z) * ratio,
  });

  return (
    <g
      data-plan-opening={item.openingType}
      data-plan-opening-key={item.key}
      data-plan-opening-state={item.colorState}
      data-canvas-layer={item.placing ? 'active-opening-preview' : 'placed-openings'}
      data-door-swing-direction={door?.swingDirection}
      data-door-swing-type={door?.swingType}
      pointerEvents="none"
    >
      {showRoughConstruction ? (
        <polygon
          points={roughOutlinePoints}
          fill={fill}
          fillOpacity={fill === 'transparent' ? undefined : 0.35}
          stroke={stroke}
          strokeWidth={strokeWidth * 0.55}
          strokeDasharray="5 4"
          pointerEvents="none"
          data-plan-opening-preview-outline="true"
        />
      ) : null}
      {item.openingType === 'door' && door && hingeScreen && openLeafScreen ? (
        <>
          {screenSegment(hingeScreen, openLeafScreen, stroke, actualStrokeWidth + 0.35, undefined, { 'data-plan-door-leaf': 'true' })}
          {swingScreenPath ? (
            <path
              d={swingScreenPath}
              fill="none"
              stroke={stroke}
              strokeOpacity={item.placing ? 0.92 : 0.76}
              strokeWidth={symbolStrokeWidth}
              pointerEvents="none"
              data-plan-door-swing-arc="true"
            />
          ) : null}
        </>
      ) : null}
      {item.openingType === 'window' ? (
        <>
          {windowFaceRatios.map((ratio, index) => {
            const windowA = project(pointBetweenFaces(item.geometry.actualStartJamb, ratio));
            const windowB = project(pointBetweenFaces(item.geometry.actualEndJamb, ratio));
            return (
              <g key={`window-sash-${index}`}>
                {screenSegment(
                  windowA,
                  windowB,
                  stroke,
                  index === 1 ? symbolStrokeWidth + 0.15 : symbolStrokeWidth,
                  undefined,
                  { 'data-plan-window-sash': 'true' },
                )}
              </g>
            );
          })}
        </>
      ) : null}
      {item.label ? (
        <text
          x={center.sx + 8 * scale}
          y={center.sy - 8 * scale}
          fill={stroke}
          fontSize={11 * scale}
          fontWeight={700}
          paintOrder="stroke"
          stroke={textBacker}
          strokeWidth={3 * scale}
          pointerEvents="none"
        >
          {item.label}
        </text>
      ) : null}
      {item.swingLabel ? (
        <text
          x={center.sx + 8 * scale}
          y={center.sy + (item.label ? 10 * scale : -8 * scale)}
          fill={stroke}
          fontSize={10 * scale}
          fontWeight={600}
          paintOrder="stroke"
          stroke={textBacker}
          strokeWidth={3 * scale}
          pointerEvents="none"
        >
          {item.swingLabel}
        </text>
      ) : null}
      {item.showRoughLabel ? (
        <text
          x={center.sx + 8 * scale}
          y={center.sy + (item.swingLabel ? 20 * scale : 10 * scale)}
          fill={stroke}
          fontSize={10 * scale}
          fontWeight={600}
          paintOrder="stroke"
          stroke={textBacker}
          strokeWidth={3 * scale}
          pointerEvents="none"
        >
          {formatRoughOpeningLabel(item.geometry.roughWidthMeters)}
        </text>
      ) : null}
    </g>
  );
}
