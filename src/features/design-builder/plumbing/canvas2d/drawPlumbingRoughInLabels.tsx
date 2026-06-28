import type { ReactNode } from 'react';
import { formatPipeDiameter } from '../domain/plumbingTakeoff';
import type { PlumbingFixtureRoughInAssembly, PlumbingSystem } from '../plumbingTypes';
import type { PlumbingPlanProjector } from './drawPlumbingPlan';

function systemLabel(system: PlumbingFixtureRoughInAssembly['system']): string {
  if (system === 'cold_water') return 'CW';
  if (system === 'hot_water') return 'HW';
  if (system === 'vent') return 'V UP';
  return 'SAN UP';
}

export function formatRoughInPlanLabel(roughIn: PlumbingFixtureRoughInAssembly, system: PlumbingSystem): string {
  const fixture = system.fixtures.find((item) => item.id === roughIn.fixtureId);
  const diameter = formatPipeDiameter(roughIn.diameterInches);
  const primary = [diameter, systemLabel(roughIn.system)].filter(Boolean).join(' ');
  return fixture ? `${primary} / ${fixture.mark}` : primary;
}

export function drawPlumbingRoughInLabel(params: {
  roughIn: PlumbingFixtureRoughInAssembly;
  system: PlumbingSystem;
  project: PlumbingPlanProjector;
}): ReactNode {
  if (!params.roughIn.labelVisible) return null;
  const node = params.system.nodes.find((candidate) => candidate.id === params.roughIn.riserTopNodeId)
    ?? params.system.nodes.find((candidate) => candidate.id === params.roughIn.fixtureNodeId);
  if (!node) return null;
  const point = params.project(node.position);
  return (
    <text
      key={`${params.roughIn.id}-label`}
      x={point.sx + 10}
      y={point.sy - 10}
      fill={params.roughIn.system === 'hot_water' ? '#dc2626' : params.roughIn.system === 'cold_water' ? '#0284c7' : params.roughIn.system === 'vent' ? '#7c3aed' : '#111827'}
      fontSize={10}
      fontWeight={900}
      paintOrder="stroke"
      stroke="#ffffff"
      strokeWidth={3}
      data-plumbing-rough-in-label={params.roughIn.id}
    >
      {formatRoughInPlanLabel(params.roughIn, params.system)}
    </text>
  );
}
