import type { ReactNode } from 'react';
import {
  drawSepticTankTopView,
  formatPlumbingRunLabel,
  getPlumbingFixtureDefinition,
  type PlumbingFixture,
  type PlumbingEquipment,
  type PlumbingFitting,
  type PlumbingPoint3D,
  type PlumbingRun,
  type PlumbingRunDraft,
  type PlumbingSelection,
  type PlumbingSystem,
  type PlumbingValidationIssue,
  type SepticTankModel,
} from '..';
import { fittingDefinition } from '../domain/plumbingFittingCompatibility';
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
  equipmentPreview?: PlumbingEquipment | null;
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

function fittingSymbol(type: PlumbingFitting['type']): string {
  if (type.includes('wye')) return 'Y';
  if (type.includes('tee') || type === 'tee' || type === 'reducing_tee') return 'T';
  if (type.includes('elbow') || type === 'offset_bend') return 'L';
  if (type.includes('coupling') || type === 'union') return 'C';
  if (type.includes('valve')) return 'V';
  if (type.includes('cleanout')) return 'CO';
  if (type.includes('trap')) return 'P';
  if (type.includes('flange')) return 'CF';
  if (type.includes('sleeve')) return 'S';
  if (type === 'cap' || type === 'plug') return 'X';
  return 'F';
}

function renderFitting(
  fitting: PlumbingFitting,
  system: PlumbingSystem,
  project: PlumbingPlanProjector,
  selected: boolean,
): ReactNode {
  const node = system.nodes.find((candidate) => candidate.id === fitting.nodeId);
  if (!node) return null;
  const point = project(node.position);
  const label = fittingSymbol(fitting.type);
  const stroke = fitting.system === 'multi' ? '#0f172a' : pipeStroke(fitting.system);
  const definition = fittingDefinition(fitting.type);
  return (
    <g
      key={fitting.id}
      pointerEvents="none"
      data-plumbing-fitting-id={fitting.id}
      data-plumbing-fitting-type={fitting.type}
      data-plumbing-fitting-selected={selected ? 'true' : undefined}
    >
      <rect
        x={point.sx - (label.length > 1 ? 9 : 6)}
        y={point.sy - 6}
        width={label.length > 1 ? 18 : 12}
        height={12}
        rx={3}
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={selected ? 2.4 : 1.5}
      />
      <text x={point.sx} y={point.sy + 3} textAnchor="middle" fill={stroke} fontSize={label.length > 1 ? 6 : 8} fontWeight={900}>
        {label}
      </text>
      {fitting.labelVisible ? (
        <title>{definition?.label ?? fitting.type}</title>
      ) : null}
    </g>
  );
}

function equipmentStroke(equipmentType: PlumbingEquipment['equipmentType']): string {
  if (equipmentType === 'shutoff_valve' || equipmentType === 'meter' || equipmentType === 'main_service_point') return '#0284c7';
  if (equipmentType === 'vent_stack' || equipmentType === 'combined_stack' || equipmentType === 'roof_vent_termination') return '#7c3aed';
  return '#111827';
}

function renderEquipment(
  equipment: PlumbingEquipment,
  project: PlumbingPlanProjector,
  options: { selected?: boolean; preview?: boolean } = {},
): ReactNode {
  const point = project(equipment.position);
  const selectedEquipment = Boolean(options.selected);
  const stroke = options.preview ? '#0891b2' : equipmentStroke(equipment.equipmentType);
  const fill = options.preview ? '#cffafe' : '#ffffff';
  const label =
    equipment.equipmentType === 'shutoff_valve'
      ? 'V'
      : equipment.equipmentType.includes('stack')
        ? 'S'
        : equipment.label;
  return (
    <g
      key={equipment.id}
      pointerEvents="none"
      opacity={options.preview ? 0.72 : 1}
      data-plumbing-equipment-id={equipment.id}
      data-plumbing-equipment-type={equipment.equipmentType}
      data-plumbing-equipment-preview={options.preview ? 'true' : undefined}
    >
      {equipment.equipmentType === 'shutoff_valve' ? (
        <>
          <line x1={point.sx - 9} y1={point.sy} x2={point.sx + 9} y2={point.sy} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${point.sx - 7} ${point.sy - 6} L ${point.sx} ${point.sy} L ${point.sx - 7} ${point.sy + 6} Z`} fill={fill} stroke={stroke} strokeWidth={1.7} />
          <path d={`M ${point.sx + 7} ${point.sy - 6} L ${point.sx} ${point.sy} L ${point.sx + 7} ${point.sy + 6} Z`} fill={fill} stroke={stroke} strokeWidth={1.7} />
        </>
      ) : equipment.equipmentType.includes('stack') ? (
        <>
          <circle cx={point.sx} cy={point.sy} r={selectedEquipment ? 8 : 6.5} fill={fill} stroke={stroke} strokeWidth={selectedEquipment ? 2.4 : 1.8} />
          <line x1={point.sx} y1={point.sy - 10} x2={point.sx} y2={point.sy + 10} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <circle cx={point.sx} cy={point.sy} r={selectedEquipment ? 8 : 6} fill={fill} stroke={stroke} strokeWidth={selectedEquipment ? 2.4 : 1.8} />
      )}
      <text x={point.sx} y={point.sy + 3} textAnchor="middle" fill={stroke} fontSize={label.length > 1 ? 7 : 8} fontWeight={900}>
        {label}
      </text>
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
  equipmentPreview,
  septicTankPreview,
  runDraft,
  selected,
  validationIssues = [],
}: DrawPlumbingPlanProps) {
  const fittings = plumbingSystem.fittings ?? [];
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
      {fittings.map((fitting) => renderFitting(fitting, plumbingSystem, project, selected?.kind === 'fitting' && selected.id === fitting.id))}
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
      {plumbingSystem.equipment.map((equipment) =>
        renderEquipment(equipment, project, { selected: selected?.kind === 'equipment' && selected.id === equipment.id }),
      )}
      {equipmentPreview ? renderEquipment(equipmentPreview, project, { preview: true }) : null}
      {plumbingSystem.nodes.map((node) => {
        const point = project(node.position);
        const selectedNode = selected?.kind === 'node' && selected.id === node.id;
        const fittingLabel = fittings.some((fitting) => fitting.nodeId === node.id)
          ? null
          : node.kind === 'wye'
            ? 'Y'
            : node.kind === 'fitting'
              ? 'T'
              : null;
        return (
          <g key={node.id} pointerEvents="none" data-plumbing-node-id={node.id} data-plumbing-node-system={node.system} data-plumbing-node-kind={node.kind}>
            <circle
              cx={point.sx}
              cy={point.sy}
              r={selectedNode ? 5 : fittingLabel ? 5 : 3.5}
              fill={fittingLabel ? '#ffffff' : pipeStroke(node.system)}
              stroke={pipeStroke(node.system)}
              strokeWidth={selectedNode ? 2 : 1.4}
            />
            {fittingLabel ? (
              <text x={point.sx} y={point.sy + 3} textAnchor="middle" fill={pipeStroke(node.system)} fontSize={7} fontWeight={900}>
                {fittingLabel}
              </text>
            ) : null}
          </g>
        );
      })}
      {fixturePreview ? renderFixture(fixturePreview, project, zoom, { preview: true }) : null}
      {septicTankPreview ? renderSepticTank(septicTankPreview, project, false, true) : null}
    </g>
  );
}
