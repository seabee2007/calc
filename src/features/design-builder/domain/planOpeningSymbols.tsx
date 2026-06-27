import type { SegmentFrame } from '../geometry/designGeometry';
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

function screenSegment(start: ScreenPoint, end: ScreenPoint, stroke: string, strokeWidth: number, dash?: string) {
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
    />
  );
}

export function PlanOpeningSymbol({
  item,
  project,
  zoom,
}: {
  item: PlanOpeningRenderItem;
  project: (point: { x: number; z: number }) => ScreenPoint;
  zoom: number;
}) {
  const stroke = openingStrokeColor(item.colorState);
  const fill = openingFillColor(item.colorState, item.placing ? 0.24 : item.selected ? 0.22 : 0.14);
  const scale = openingMarkerScale(zoom);
  const roughA = project(item.geometry.roughStart);
  const roughB = project(item.geometry.roughEnd);
  const actualA = project(item.geometry.actualStart);
  const actualB = project(item.geometry.actualEnd);
  const center = project(item.geometry.center);
  const strokeWidth = (item.placing ? 4 : item.selected ? 3.5 : item.hovered ? 3 : 2.5) * scale;
  const actualStrokeWidth = (item.placing ? 3.5 : item.selected ? 3 : 2.5) * scale;
  const hingeMarkerRadius = Math.max(2, 2.5 * scale);

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

  const windowInset = item.openingType === 'window' ? 0.12 * scale : 0;
  const windowA = project({
    x: item.geometry.actualStart.x + item.geometry.inwardNormal.x * windowInset,
    z: item.geometry.actualStart.z + item.geometry.inwardNormal.z * windowInset,
  });
  const windowB = project({
    x: item.geometry.actualEnd.x + item.geometry.inwardNormal.x * windowInset,
    z: item.geometry.actualEnd.z + item.geometry.inwardNormal.z * windowInset,
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
      {screenSegment(roughA, roughB, stroke, strokeWidth * 0.85, '5 4')}
      <line
        x1={roughA.sx}
        y1={roughA.sy}
        x2={roughB.sx}
        y2={roughB.sy}
        stroke={stroke}
        strokeOpacity={0.35}
        strokeWidth={1.2 * scale}
        strokeDasharray="4 3"
        fill={fill}
        pointerEvents="none"
      />
      {item.openingType === 'door' && door && hingeScreen && closedLeafScreen ? (
        <>
          {screenSegment(hingeScreen, closedLeafScreen, stroke, actualStrokeWidth + 0.5)}
          {swingScreenPath ? (
            <path
              d={swingScreenPath}
              fill="none"
              stroke={stroke}
              strokeOpacity={0.85}
              strokeWidth={1.5 * scale}
              pointerEvents="none"
            />
          ) : null}
          <circle
            cx={hingeScreen.sx}
            cy={hingeScreen.sy}
            r={hingeMarkerRadius}
            fill={stroke}
            pointerEvents="none"
          />
        </>
      ) : null}
      {item.openingType === 'window' ? (
        <>
          {screenSegment(windowA, windowB, stroke, actualStrokeWidth + 0.5)}
          <line
            x1={(windowA.sx + windowB.sx) / 2}
            y1={(windowA.sy + windowB.sy) / 2 - 4 * scale}
            x2={(windowA.sx + windowB.sx) / 2}
            y2={(windowA.sy + windowB.sy) / 2 + 4 * scale}
            stroke={stroke}
            strokeWidth={1.5 * scale}
            pointerEvents="none"
          />
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
          stroke="#0f172a"
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
          stroke="#0f172a"
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
          stroke="#0f172a"
          strokeWidth={3 * scale}
          pointerEvents="none"
        >
          {formatRoughOpeningLabel(item.geometry.roughWidthMeters)}
        </text>
      ) : null}
    </g>
  );
}
