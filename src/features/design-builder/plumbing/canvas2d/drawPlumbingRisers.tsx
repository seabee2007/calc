import type { ReactNode } from 'react';
import type { PlumbingFixtureRoughInAssembly, PlumbingSystem } from '../plumbingTypes';
import type { PlumbingPlanProjector } from './drawPlumbingPlan';
import { drawPlumbingRoughInLabel } from './drawPlumbingRoughInLabels';

function markerStroke(system: PlumbingFixtureRoughInAssembly['system']): string {
  if (system === 'cold_water') return '#0284c7';
  if (system === 'hot_water') return '#dc2626';
  if (system === 'vent') return '#7c3aed';
  return '#111827';
}

function markerText(system: PlumbingFixtureRoughInAssembly['system']): string {
  if (system === 'cold_water') return 'CW';
  if (system === 'hot_water') return 'HW';
  if (system === 'vent') return 'V';
  return 'UP';
}

export function drawPlumbingRisers(params: {
  system: PlumbingSystem;
  project: PlumbingPlanProjector;
  selectedId?: string | null;
}): ReactNode[] {
  return (params.system.roughIns ?? []).flatMap((roughIn) => {
    const node = params.system.nodes.find((candidate) => candidate.id === roughIn.riserTopNodeId)
      ?? params.system.nodes.find((candidate) => candidate.id === roughIn.fixtureNodeId);
    if (!node) return [];
    const point = params.project(node.position);
    const stroke = markerStroke(roughIn.system);
    const selected = params.selectedId === roughIn.id;
    const radius = selected ? 7 : 5.5;
    return [
      <g
        key={`${roughIn.id}-marker`}
        pointerEvents="none"
        data-plumbing-rough-in-id={roughIn.id}
        data-plumbing-rough-in-system={roughIn.system}
        data-plumbing-rough-in-selected={selected ? 'true' : undefined}
      >
        <circle
          cx={point.sx}
          cy={point.sy}
          r={radius}
          fill={roughIn.system === 'sanitary' ? '#ffffff' : stroke}
          stroke={stroke}
          strokeWidth={selected ? 2.4 : 1.7}
        />
        {roughIn.system === 'sanitary' ? (
          <circle cx={point.sx} cy={point.sy} r={2.2} fill={stroke} />
        ) : (
          <text x={point.sx} y={point.sy + 2.5} textAnchor="middle" fill="#ffffff" fontSize={5.5} fontWeight={900}>
            {markerText(roughIn.system)}
          </text>
        )}
      </g>,
      drawPlumbingRoughInLabel({ roughIn, system: params.system, project: params.project }),
    ];
  });
}
