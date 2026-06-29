import type { Design2dDrawingStyleMode, RoofVec3, SteelMemberSegment } from '../types';
import {
  formatMeters,
  formatPitchLabel,
  type TrussDesignSummary,
} from '../domain/trussDesignCalculations';
import {
  TrussReferenceSheetNotesPanel,
  type TrussReferenceSheetPanel,
} from './TrussReferenceSheetNotesPanel';

export type TrussReferenceSheetPlacement = {
  origin: { x: number; z: number };
  widthMeters: number;
  heightMeters: number;
  trussPanel: TrussReferenceSheetPanel;
  notesPanel: TrussReferenceSheetPanel;
};

type TrussReferenceSheetDrawingProps = {
  summary: TrussDesignSummary;
  placement: TrussReferenceSheetPlacement;
  drawingStyleMode?: Design2dDrawingStyleMode;
};

type ProjectedPoint = {
  x: number;
  y: number;
  station: number;
  elevation: number;
};

type NodePoint = ProjectedPoint & {
  key: string;
  label: string;
};

const NODE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SHEET_STROKE_METERS = 0.015;
const PANEL_STROKE_METERS = 0.01;
const HEAVY_STROKE_METERS = 0.025;
const LIGHT_STROKE_METERS = 0.012;
const TITLE_FONT_METERS = 0.16;
const BODY_FONT_METERS = 0.09;

export function TrussReferenceSheetDrawing({
  summary,
  placement,
  drawingStyleMode = 'architectural',
}: TrussReferenceSheetDrawingProps) {
  const textFill = drawingStyleMode === 'builder' ? '#0f172a' : '#111827';

  return (
    <g
      data-testid="truss-reference-sheet-drawing"
      data-reference-sheet-units="meters"
      data-sheet-width-meters={placement.widthMeters.toFixed(3)}
      data-sheet-height-meters={placement.heightMeters.toFixed(3)}
    >
      <rect
        x={0}
        y={0}
        width={placement.widthMeters}
        height={placement.heightMeters}
        fill="#ffffff"
        fillOpacity={0.96}
        stroke="#64748b"
        strokeWidth={SHEET_STROKE_METERS}
      />
      <text x={0.28} y={0.34} fill={textFill} fontSize={TITLE_FONT_METERS} fontWeight={700}>
        TRUSS DESIGN REFERENCE SHEET
      </text>
      <text x={0.28} y={0.56} fill="#475569" fontSize={BODY_FONT_METERS}>
        {summary.representativeProfileLabel ?? 'Conceptual truss'} | {summary.geometry ? `${summary.geometry.trussCount} trusses at ${formatMeters(summary.geometry.trussSpacingMeters)} o.c.` : 'No truss geometry'}
      </text>
      <line x1={0} y1={0.72} x2={placement.widthMeters} y2={0.72} stroke="#cbd5e1" strokeWidth={PANEL_STROKE_METERS} />
      {renderTrussPanel(summary, placement.trussPanel, textFill)}
      <TrussReferenceSheetNotesPanel summary={summary} panel={placement.notesPanel} />
    </g>
  );
}

function renderTrussPanel(summary: TrussDesignSummary, panel: TrussReferenceSheetPanel, textFill: string) {
  const truss = summary.representativeTruss;
  if (!summary.supported || !truss || !summary.geometry) {
    return (
      <g>
        <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="#ffffff" stroke="#94a3b8" strokeWidth={PANEL_STROKE_METERS} />
        <text
          x={panel.x + 0.24}
          y={panel.y + 0.36}
          fill="#334155"
          fontSize={0.12}
          fontWeight={700}
          data-testid="truss-design-unsupported-warning"
        >
          {summary.unsupportedReason ?? 'Truss design detail is not available for this roof.'}
        </text>
      </g>
    );
  }

  const projection = createTrussProjection({ truss, panel });
  if (!projection) {
    return (
      <g>
        <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="#ffffff" stroke="#94a3b8" strokeWidth={PANEL_STROKE_METERS} />
        <text x={panel.x + 0.24} y={panel.y + 0.36} fill="#334155" fontSize={0.12} fontWeight={700} data-testid="truss-design-unsupported-warning">
          Truss geometry could not be projected into elevation.
        </text>
      </g>
    );
  }

  const leftBearing = projection.projectPoint(truss.bearingLeft);
  const rightBearing = projection.projectPoint(truss.bearingRight);
  const apex = projection.projectPoint(truss.apex);
  const midSpanX = (leftBearing.x + rightBearing.x) / 2;
  const dimensionY = Math.min(panel.y + panel.height - 0.34, projection.bottomY + 0.42);
  const runDimensionY = Math.min(panel.y + panel.height - 0.58, projection.bottomY + 0.2);
  const riseDimensionX = Math.min(panel.x + panel.width - 0.35, rightBearing.x + 0.5);

  return (
    <g>
      <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="#ffffff" stroke="#94a3b8" strokeWidth={PANEL_STROKE_METERS} />
      <text x={panel.x + 0.2} y={panel.y + 0.28} fill={textFill} fontSize={0.13} fontWeight={700}>
        REPRESENTATIVE TRUSS ELEVATION
      </text>
      <text x={panel.x + 0.2} y={panel.y + 0.48} fill="#475569" fontSize={BODY_FONT_METERS}>
        {summary.representativeProfileLabel ?? truss.webProfileLabel ?? 'Conceptual truss'}
      </text>

      {truss.members.map((member) => renderMember(member, projection.projectPoint, textFill))}
      {renderBearingSymbol(leftBearing.x, leftBearing.y)}
      {renderBearingSymbol(rightBearing.x, rightBearing.y)}

      {projection.nodes.map((node) => (
        <g key={node.key}>
          <circle cx={node.x} cy={node.y} r={0.045} fill="#ffffff" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
          <text x={node.x + 0.07} y={node.y - 0.07} fill={textFill} fontSize={0.09} fontWeight={700}>
            {node.label}
          </text>
        </g>
      ))}

      {renderHorizontalDimension({
        x1: leftBearing.x,
        x2: rightBearing.x,
        y: dimensionY,
        label: `SPAN ${formatMeters(summary.geometry.spanMeters)} / ${summary.geometry.spanFeet.toFixed(2)} ft`,
        fontSize: 0.095,
      })}
      {renderHorizontalDimension({
        x1: leftBearing.x,
        x2: midSpanX,
        y: runDimensionY,
        label: `RUN ${formatMeters(summary.geometry.runMeters)}`,
        fontSize: 0.078,
      })}
      {renderHorizontalDimension({
        x1: midSpanX,
        x2: rightBearing.x,
        y: runDimensionY,
        label: `RUN ${formatMeters(summary.geometry.runMeters)}`,
        fontSize: 0.078,
      })}
      {renderVerticalDimension({
        x: riseDimensionX,
        y1: apex.y,
        y2: projection.bottomY,
        label: `RISE ${formatMeters(summary.geometry.riseMeters)}`,
      })}
      {renderPitchTriangle({
        x: Math.max(panel.x + 0.24, leftBearing.x + 0.26),
        y: Math.max(panel.y + 0.72, apex.y + 0.25),
        label: formatPitchLabel(summary.geometry.pitchRisePer12),
      })}
      <text x={panel.x + 0.2} y={panel.y + panel.height - 0.18} fill="#475569" fontSize={0.085}>
        {`Surface ${summary.geometry.roofSurfaceAreaSquareMeters.toFixed(2)} m2 | Ridge ${formatMeters(summary.geometry.ridgeLengthMeters)} | Top chord ${formatMeters(summary.geometry.topChordLengthMeters)}`}
      </text>
    </g>
  );
}

function renderMember(
  member: SteelMemberSegment,
  projectPoint: (point: RoofVec3) => ProjectedPoint,
  textFill: string,
) {
  const start = projectPoint(member.start);
  const end = projectPoint(member.end);
  const isPrimary = member.memberKind === 'bottom_chord' || member.memberKind.startsWith('top_chord');
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  return (
    <g key={member.id}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#111827"
        strokeWidth={isPrimary ? HEAVY_STROKE_METERS : LIGHT_STROKE_METERS}
        strokeLinecap="round"
      />
      <text
        x={midpoint.x + 0.055}
        y={midpoint.y - 0.045}
        fill={textFill}
        fontSize={0.07}
        paintOrder="stroke"
        stroke="#ffffff"
        strokeWidth={0.03}
      >
        {memberKindLabel(member.memberKind)}
      </text>
    </g>
  );
}

function createTrussProjection(params: {
  truss: NonNullable<TrussDesignSummary['representativeTruss']>;
  panel: TrussReferenceSheetPanel;
}): {
  bottomY: number;
  nodes: NodePoint[];
  projectPoint: (point: RoofVec3) => ProjectedPoint;
} | null {
  const bottomVector = {
    x: params.truss.bearingRight.x - params.truss.bearingLeft.x,
    z: params.truss.bearingRight.z - params.truss.bearingLeft.z,
  };
  const span = Math.hypot(bottomVector.x, bottomVector.z);
  if (!Number.isFinite(span) || span <= 0.001) return null;

  const unit = { x: bottomVector.x / span, z: bottomVector.z / span };
  const bearingElevation = (params.truss.bearingLeft.y + params.truss.bearingRight.y) / 2;
  const rawProject = (point: RoofVec3) => ({
    station: (point.x - params.truss.bearingLeft.x) * unit.x + (point.z - params.truss.bearingLeft.z) * unit.z,
    elevation: point.y - bearingElevation,
  });
  const rawPoints = [
    params.truss.bearingLeft,
    params.truss.bearingRight,
    params.truss.apex,
    ...params.truss.members.flatMap((member) => [member.start, member.end]),
  ].map(rawProject);
  const minStation = Math.min(...rawPoints.map((point) => point.station));
  const maxStation = Math.max(...rawPoints.map((point) => point.station));
  const minElevation = Math.min(0, ...rawPoints.map((point) => point.elevation));
  const maxElevation = Math.max(...rawPoints.map((point) => point.elevation));
  const stationRange = Math.max(0.001, maxStation - minStation);
  const elevationRange = Math.max(0.001, maxElevation - minElevation);
  const padX = params.panel.width * 0.08;
  const topPad = params.panel.height * 0.22;
  const bottomPad = params.panel.height * 0.22;
  const scale = Math.min(
    (params.panel.width - padX * 2) / stationRange,
    (params.panel.height - topPad - bottomPad) / elevationRange,
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const bottomY = params.panel.y + params.panel.height - bottomPad + minElevation * scale;
  const projectPoint = (point: RoofVec3): ProjectedPoint => {
    const raw = rawProject(point);
    return {
      station: raw.station,
      elevation: raw.elevation,
      x: params.panel.x + padX + (raw.station - minStation) * scale,
      y: bottomY - raw.elevation * scale,
    };
  };

  return {
    bottomY,
    nodes: buildNodePoints(params.truss.members, projectPoint),
    projectPoint,
  };
}

function buildNodePoints(
  members: readonly SteelMemberSegment[],
  projectPoint: (point: RoofVec3) => ProjectedPoint,
): NodePoint[] {
  const byKey = new Map<string, ProjectedPoint>();
  members.forEach((member) => {
    [member.start, member.end].forEach((point) => {
      const projected = projectPoint(point);
      byKey.set(`${projected.station.toFixed(3)}:${projected.elevation.toFixed(3)}`, projected);
    });
  });

  return [...byKey.entries()]
    .sort((a, b) => a[1].station - b[1].station || b[1].elevation - a[1].elevation)
    .map(([key, point], index) => ({
      ...point,
      key,
      label: NODE_LABELS[index] ?? `N${index + 1}`,
    }));
}

function renderBearingSymbol(x: number, y: number) {
  return (
    <g>
      <rect x={x - 0.11} y={y + 0.04} width={0.22} height={0.07} fill="#ffffff" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <path
        d={`M ${x - 0.15} ${y + 0.15} L ${x + 0.15} ${y + 0.15} M ${x - 0.13} ${y + 0.21} L ${x - 0.08} ${y + 0.15} M ${x - 0.03} ${y + 0.21} L ${x + 0.02} ${y + 0.15} M ${x + 0.07} ${y + 0.21} L ${x + 0.12} ${y + 0.15}`}
        stroke="#111827"
        strokeWidth={LIGHT_STROKE_METERS}
        fill="none"
      />
    </g>
  );
}

function renderHorizontalDimension(params: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  fontSize: number;
}) {
  const mid = (params.x1 + params.x2) / 2;
  return (
    <g>
      <line x1={params.x1} y1={params.y - 0.09} x2={params.x1} y2={params.y + 0.09} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <line x1={params.x2} y1={params.y - 0.09} x2={params.x2} y2={params.y + 0.09} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <line x1={params.x1} y1={params.y} x2={params.x2} y2={params.y} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <path d={`M ${params.x1 + 0.1} ${params.y - 0.06} L ${params.x1} ${params.y} L ${params.x1 + 0.1} ${params.y + 0.06}`} fill="none" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <path d={`M ${params.x2 - 0.1} ${params.y - 0.06} L ${params.x2} ${params.y} L ${params.x2 - 0.1} ${params.y + 0.06}`} fill="none" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <text x={mid} y={params.y - 0.07} textAnchor="middle" fill="#111827" fontSize={params.fontSize} fontWeight={700} paintOrder="stroke" stroke="#ffffff" strokeWidth={0.035}>
        {params.label}
      </text>
    </g>
  );
}

function renderVerticalDimension(params: {
  x: number;
  y1: number;
  y2: number;
  label: string;
}) {
  const mid = (params.y1 + params.y2) / 2;
  return (
    <g>
      <line x1={params.x - 0.09} y1={params.y1} x2={params.x + 0.09} y2={params.y1} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <line x1={params.x - 0.09} y1={params.y2} x2={params.x + 0.09} y2={params.y2} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <line x1={params.x} y1={params.y1} x2={params.x} y2={params.y2} stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <path d={`M ${params.x - 0.06} ${params.y1 + 0.1} L ${params.x} ${params.y1} L ${params.x + 0.06} ${params.y1 + 0.1}`} fill="none" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <path d={`M ${params.x - 0.06} ${params.y2 - 0.1} L ${params.x} ${params.y2} L ${params.x + 0.06} ${params.y2 - 0.1}`} fill="none" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <text x={params.x + 0.16} y={mid} fill="#111827" fontSize={0.09} fontWeight={700} dominantBaseline="middle">
        {params.label}
      </text>
    </g>
  );
}

function renderPitchTriangle(params: { x: number; y: number; label: string }) {
  const width = 0.62;
  const height = 0.3;
  return (
    <g>
      <path d={`M ${params.x} ${params.y + height} L ${params.x + width} ${params.y + height} L ${params.x + width} ${params.y} Z`} fill="none" stroke="#111827" strokeWidth={LIGHT_STROKE_METERS} />
      <text x={params.x + width + 0.08} y={params.y + height - 0.05} fill="#111827" fontSize={0.095} fontWeight={700}>
        {params.label}
      </text>
    </g>
  );
}

function memberKindLabel(kind: SteelMemberSegment['memberKind']): string {
  switch (kind) {
    case 'bottom_chord':
      return 'BC';
    case 'top_chord_left':
    case 'top_chord_right':
    case 'top_chord_left_eave_extension':
    case 'top_chord_right_eave_extension':
      return 'TC';
    case 'vertical_web':
      return 'VW';
    case 'diagonal_web':
      return 'DW';
    default:
      return kind;
  }
}
