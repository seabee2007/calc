import type { ReactNode } from 'react';
import {
  drawSepticTankTopView,
  formatPlumbingRunLabel,
  getPlumbingFixtureDefinition,
  type PlumbingFixture,
  type PlumbingPoint3D,
  type PlumbingRun,
  type PlumbingRunDraft,
  type PlumbingSelection,
  type PlumbingSystem,
  type PlumbingValidationIssue,
  type SepticTankModel,
} from '..';
import { resolveSegmentDisplayEndpoints } from '../../domain/planOpeningGraphics';
import type {
  DesignWallLayoutParameters,
  IsolatedFooting,
  StructuralBeam,
  StructuralFrameSystemParameters,
  WallFooting,
} from '../../types';

export type PlumbingPlanProjector = (point: { x: number; z: number }) => { sx: number; sy: number };

export type DrawPlumbingPlanProps = {
  layout: DesignWallLayoutParameters;
  planDisplayNodeById: Map<string, { x: number; z: number }>;
  project: PlumbingPlanProjector;
  zoom: number;
  plumbingSystem: PlumbingSystem;
  foundationPlanBeams: readonly StructuralBeam[];
  wallFootings: readonly WallFooting[];
  isolatedFootings: readonly IsolatedFooting[];
  frameSystem?: StructuralFrameSystemParameters;
  fixturePreview?: PlumbingFixture | null;
  septicTankPreview?: SepticTankModel | null;
  runDraft?: PlumbingRunDraft | null;
  selected?: PlumbingSelection | null;
  validationIssues?: readonly PlumbingValidationIssue[];
};

const FOUNDATION_STROKE = '#94a3b8';
const WALL_STROKE = '#0f172a';

function pipeStroke(runSystem: PlumbingRun['system']): string {
  if (runSystem === 'cold_water') return '#0284c7';
  if (runSystem === 'hot_water') return '#dc2626';
  if (runSystem === 'vent') return '#7c3aed';
  return '#111827';
}

function pointsToPolyline(points: readonly PlumbingPoint3D[], project: PlumbingPlanProjector): string {
  return points.map((point) => {
    const projected = project({ x: point.x, z: point.z });
    return `${projected.sx},${projected.sy}`;
  }).join(' ');
}

function renderStrip(params: {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  widthMeters: number;
  project: PlumbingPlanProjector;
  zoom: number;
  attrs?: Record<string, string>;
}): ReactNode {
  const start = params.project(params.start);
  const end = params.project(params.end);
  return (
    <line
      key={params.id}
      x1={start.sx}
      y1={start.sy}
      x2={end.sx}
      y2={end.sy}
      stroke={FOUNDATION_STROKE}
      strokeOpacity={0.48}
      strokeWidth={Math.max(1, params.widthMeters * params.zoom)}
      strokeDasharray="8 5"
      strokeLinecap="butt"
      pointerEvents="none"
      data-plumbing-foundation-overlay="true"
      {...params.attrs}
    />
  );
}

function renderFixture(
  fixture: PlumbingFixture,
  project: PlumbingPlanProjector,
  zoom: number,
  options: { preview?: boolean; selected?: boolean } = {},
): ReactNode {
  const definition = getPlumbingFixtureDefinition(fixture.fixtureType);
  const center = project({ x: fixture.position.x, z: fixture.position.z });
  const width = Math.max(18, definition.widthMeters * zoom);
  const depth = Math.max(18, definition.depthMeters * zoom);
  const stroke = options.preview ? '#0891b2' : options.selected ? '#0e7490' : '#0f172a';
  const fill = options.preview ? '#cffafe' : '#f8fafc';
  const strokeWidth = options.selected ? 2.8 : 2;
  const symbol =
    definition.planSymbol === 'drain' ? (
      <>
        <circle cx={0} cy={0} r={Math.max(7, width / 2)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <line x1={-7} y1={-7} x2={7} y2={7} stroke={stroke} strokeWidth={1.5} />
        <line x1={7} y1={-7} x2={-7} y2={7} stroke={stroke} strokeWidth={1.5} />
      </>
    ) : definition.planSymbol === 'wc' ? (
      <>
        <rect x={-width / 2} y={-depth / 2} width={width} height={depth * 0.5} rx={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <ellipse cx={0} cy={depth * 0.18} rx={width * 0.36} ry={depth * 0.25} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      </>
    ) : definition.planSymbol === 'heater' ? (
      <>
        <circle cx={0} cy={0} r={Math.max(width, depth) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <text x={0} y={4} textAnchor="middle" fill={stroke} fontSize={10} fontWeight={800}>WH</text>
      </>
    ) : (
      <>
        <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {definition.planSymbol === 'shower' ? (
          <>
            <line x1={-width / 2} y1={-depth / 2} x2={width / 2} y2={depth / 2} stroke={stroke} strokeWidth={1.2} />
            <line x1={width / 2} y1={-depth / 2} x2={-width / 2} y2={depth / 2} stroke={stroke} strokeWidth={1.2} />
          </>
        ) : (
          <ellipse cx={0} cy={0} rx={width * 0.3} ry={depth * 0.28} fill="none" stroke={stroke} strokeWidth={1.5} />
        )}
      </>
    );

  return (
    <g
      key={options.preview ? `preview-${fixture.id}` : fixture.id}
      pointerEvents="none"
      opacity={options.preview ? 0.72 : 1}
      data-plumbing-fixture-id={fixture.id}
      data-plumbing-fixture-type={fixture.fixtureType}
      data-plumbing-fixture-preview={options.preview ? 'true' : undefined}
      data-plumbing-fixture-selected={options.selected ? 'true' : undefined}
    >
      <g transform={`translate(${center.sx} ${center.sy}) rotate(${fixture.rotationRadians * 180 / Math.PI})`}>
        {symbol}
      </g>
      <text
        x={center.sx}
        y={center.sy + depth / 2 + 14}
        textAnchor="middle"
        fill="#111827"
        fontSize={11}
        fontWeight={800}
        paintOrder="stroke"
        stroke="#ffffff"
        strokeWidth={2}
        data-plumbing-fixture-mark="true"
      >
        {fixture.mark}
      </text>
    </g>
  );
}

function renderSepticTank(tank: SepticTankModel, project: PlumbingPlanProjector, selected: boolean, preview = false): ReactNode {
  return (
    <g key={preview ? `preview-${tank.id}` : tank.id} data-septic-tank-id={tank.id} data-septic-tank-preview={preview ? 'true' : undefined} pointerEvents="none" opacity={preview ? 0.72 : 1}>
      {drawSepticTankTopView(tank).map((primitive) => {
        if (primitive.kind === 'polygon') {
          const points = primitive.points.map((point) => {
            const projected = project(point);
            return `${projected.sx},${projected.sy}`;
          }).join(' ');
          const isOuter = primitive.id.includes(':outer');
          return (
            <polygon
              key={primitive.id}
              points={points}
              fill={isOuter ? (preview ? '#ccfbf1' : '#e2e8f0') : 'none'}
              stroke={preview ? '#0891b2' : selected ? '#0e7490' : '#334155'}
              strokeWidth={isOuter ? (selected ? 2.6 : 2) : 1.2}
              strokeDasharray={!isOuter || preview ? '5 3' : undefined}
              data-septic-primitive-id={primitive.id}
            />
          );
        }
        if (primitive.kind === 'line') {
          const start = project(primitive.start);
          const end = project(primitive.end);
          return (
            <line
              key={primitive.id}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={preview ? '#0891b2' : selected ? '#0e7490' : '#334155'}
              strokeWidth={primitive.id.includes('flow-arrow') ? 1.8 : 1.2}
              strokeDasharray={primitive.id.includes('flow-arrow') ? '6 4' : undefined}
              data-septic-primitive-id={primitive.id}
            />
          );
        }
        if (primitive.kind === 'point') {
          const point = project(primitive.point);
          return (
            <circle
              key={primitive.id}
              cx={point.sx}
              cy={point.sy}
              r={primitive.role === 'access' ? 5 : 4}
              fill={primitive.role === 'inlet' ? '#111827' : primitive.role === 'outlet' ? '#475569' : '#f8fafc'}
              stroke={preview ? '#0891b2' : '#334155'}
              strokeWidth={1.5}
              data-septic-point-role={primitive.role}
            />
          );
        }
        const point = project(primitive.point);
        return (
          <text key={primitive.id} x={point.sx} y={point.sy} textAnchor="middle" fill="#334155" fontSize={10} fontWeight={800} paintOrder="stroke" stroke="#ffffff" strokeWidth={2}>
            {primitive.text}
          </text>
        );
      })}
    </g>
  );
}

function renderRun(run: PlumbingRun, project: PlumbingPlanProjector, selected: boolean, issueRunIds: Set<string>): ReactNode {
  const labelPoint = run.path[Math.max(0, Math.floor(run.path.length / 2))];
  const projectedLabel = labelPoint ? project({ x: labelPoint.x, z: labelPoint.z }) : null;
  const stroke = pipeStroke(run.system);
  return (
    <g key={run.id} pointerEvents="none" data-plumbing-run-id={run.id} data-plumbing-run-system={run.system}>
      <polyline
        points={pointsToPolyline(run.path, project)}
        fill="none"
        stroke={issueRunIds.has(run.id) ? '#f97316' : stroke}
        strokeWidth={selected ? 4 : run.system === 'sanitary' ? 3.2 : 2.4}
        strokeDasharray={run.system === 'vent' ? '8 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {run.labelVisible && projectedLabel ? (
        <text
          x={projectedLabel.sx + 8}
          y={projectedLabel.sy - 8}
          fill={stroke}
          fontSize={11}
          fontWeight={800}
          paintOrder="stroke"
          stroke="#ffffff"
          strokeWidth={3}
          data-plumbing-run-label={run.id}
        >
          {formatPlumbingRunLabel(run)}
        </text>
      ) : null}
    </g>
  );
}

export function DrawPlumbingPlan({
  layout,
  planDisplayNodeById,
  project,
  zoom,
  plumbingSystem,
  foundationPlanBeams,
  wallFootings,
  isolatedFootings,
  frameSystem,
  fixturePreview,
  septicTankPreview,
  runDraft,
  selected,
  validationIssues = [],
}: DrawPlumbingPlanProps) {
  const issueRunIds = new Set(validationIssues.filter((issue) => issue.objectKind === 'run' && issue.objectId).map((issue) => issue.objectId!));
  const draftStart = runDraft ? plumbingSystem.nodes.find((node) => node.id === runDraft.startNodeId) : null;
  const draftPoints = draftStart
    ? [draftStart.position, ...runDraft!.routePoints, ...(runDraft!.previewPoint ? [runDraft!.previewPoint] : [])]
    : [];
  return (
    <g data-canvas-layer="plumbing-plan">
      <g data-canvas-layer="plumbing-foundation-overlay">
        {foundationPlanBeams.map((beam) =>
          renderStrip({
            id: beam.id,
            start: { x: beam.startPoint.x, z: beam.startPoint.z },
            end: { x: beam.endPoint.x, z: beam.endPoint.z },
            widthMeters: beam.widthMeters,
            project,
            zoom,
            attrs: { 'data-foundation-beam-id': beam.id, 'data-foundation-beam-kind': beam.kind },
          }),
        )}
        {wallFootings.map((footing) =>
          renderStrip({
            id: footing.id,
            start: footing.startPoint,
            end: footing.endPoint,
            widthMeters: footing.widthMeters,
            project,
            zoom,
            attrs: { 'data-foundation-wall-footing-id': footing.id },
          }),
        )}
        {isolatedFootings.map((footing) => {
          const center = project(footing.position);
          const halfW = (footing.widthMeters * zoom) / 2;
          const halfL = (footing.lengthMeters * zoom) / 2;
          return (
            <rect
              key={footing.id}
              x={center.sx - halfW}
              y={center.sy - halfL}
              width={halfW * 2}
              height={halfL * 2}
              fill="none"
              stroke={FOUNDATION_STROKE}
              strokeOpacity={0.48}
              strokeWidth={1.2}
              strokeDasharray="8 5"
              pointerEvents="none"
              data-plumbing-foundation-overlay="true"
              data-foundation-footing-id={footing.id}
            />
          );
        })}
        {frameSystem?.columns.map((column) => {
          const center = project(column.position);
          const halfW = (column.widthMeters * zoom) / 2;
          const halfD = (column.depthMeters * zoom) / 2;
          return (
            <rect
              key={column.id}
              x={center.sx - halfW}
              y={center.sy - halfD}
              width={halfW * 2}
              height={halfD * 2}
              fill="none"
              stroke={FOUNDATION_STROKE}
              strokeOpacity={0.52}
              strokeWidth={1.2}
              strokeDasharray="8 5"
              pointerEvents="none"
              data-plumbing-foundation-overlay="true"
              data-plumbing-rc-column-overlay={column.id}
            />
          );
        })}
      </g>
      <g data-canvas-layer="plumbing-walls">
        {layout.segments.map((segment) => {
          const endpoints = resolveSegmentDisplayEndpoints({ segment, layout, planDisplayNodeById });
          if (!endpoints) return null;
          const start = project(endpoints.displayStart);
          const end = project(endpoints.displayEnd);
          return (
            <line
              key={segment.id}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={WALL_STROKE}
              strokeWidth={3}
              strokeLinecap="round"
              pointerEvents="none"
              data-plumbing-wall-reference="true"
              data-segment-id={segment.id}
            />
          );
        })}
      </g>
      {plumbingSystem.septicTanks.map((tank) => renderSepticTank(tank, project, selected?.kind === 'septic-tank' && selected.id === tank.id))}
      {plumbingSystem.runs.map((run) => renderRun(run, project, selected?.kind === 'run' && selected.id === run.id, issueRunIds))}
      {draftPoints.length >= 2 ? (
        <polyline
          points={pointsToPolyline(draftPoints, project)}
          fill="none"
          stroke={pipeStroke(runDraft!.system)}
          strokeWidth={runDraft!.system === 'sanitary' ? 3 : 2.2}
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
          data-plumbing-run-draft="true"
        />
      ) : null}
      {plumbingSystem.fixtures.map((fixture) =>
        renderFixture(fixture, project, zoom, { selected: selected?.kind === 'fixture' && selected.id === fixture.id }),
      )}
      {plumbingSystem.equipment.map((equipment) => {
        const point = project(equipment.position);
        const selectedEquipment = selected?.kind === 'equipment' && selected.id === equipment.id;
        return (
          <g key={equipment.id} pointerEvents="none" data-plumbing-equipment-id={equipment.id} data-plumbing-equipment-type={equipment.equipmentType}>
            <circle cx={point.sx} cy={point.sy} r={selectedEquipment ? 8 : 6} fill="#ffffff" stroke="#0f172a" strokeWidth={selectedEquipment ? 2.4 : 1.8} />
            <text x={point.sx} y={point.sy + 3} textAnchor="middle" fill="#0f172a" fontSize={8} fontWeight={900}>{equipment.label}</text>
          </g>
        );
      })}
      {plumbingSystem.nodes.map((node) => {
        const point = project(node.position);
        const selectedNode = selected?.kind === 'node' && selected.id === node.id;
        return (
          <circle
            key={node.id}
            cx={point.sx}
            cy={point.sy}
            r={selectedNode ? 5 : 3.5}
            fill={pipeStroke(node.system)}
            stroke="#ffffff"
            strokeWidth={selectedNode ? 2 : 1.2}
            pointerEvents="none"
            data-plumbing-node-id={node.id}
            data-plumbing-node-system={node.system}
          />
        );
      })}
      {fixturePreview ? renderFixture(fixturePreview, project, zoom, { preview: true }) : null}
      {septicTankPreview ? renderSepticTank(septicTankPreview, project, false, true) : null}
    </g>
  );
}
