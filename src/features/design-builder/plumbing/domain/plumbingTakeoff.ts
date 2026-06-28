import type {
  PlumbingLegendItem,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSystem,
} from '../plumbingTypes';

const SYSTEM_LABELS: Record<PlumbingRunSystem, string> = {
  cold_water: 'CW',
  hot_water: 'HW',
  sanitary: 'Sanitary',
  vent: 'Vent',
};

const SYSTEM_SHORT_LABELS: Record<PlumbingRunSystem, string> = {
  cold_water: 'CW',
  hot_water: 'HW',
  sanitary: 'SS',
  vent: 'V',
};

export function formatPipeDiameter(diameterInches: number | null | undefined): string {
  if (diameterInches == null || !Number.isFinite(diameterInches)) return '';
  return Number.isInteger(diameterInches) ? `${diameterInches}"` : `${diameterInches}"`;
}

export function formatPlumbingRunLabel(run: PlumbingRun): string {
  const diameter = formatPipeDiameter(run.diameterInches);
  const system = SYSTEM_SHORT_LABELS[run.system];
  const slope =
    run.system === 'sanitary' && run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt)
      ? ` @ ${run.slopeInPerFt}"/FT`
      : '';
  return [diameter, system].filter(Boolean).join(' ') + slope;
}

export function buildPlumbingLegend(system: PlumbingSystem): PlumbingLegendItem[] {
  const items: PlumbingLegendItem[] = [];
  const systems = new Set<PlumbingRunSystem>();
  system.runs.forEach((run) => systems.add(run.system));
  system.nodes.forEach((node) => systems.add(node.system));
  (['cold_water', 'hot_water', 'sanitary', 'vent'] as PlumbingRunSystem[]).forEach((runSystem) => {
    if (systems.has(runSystem)) {
      items.push({
        key: runSystem,
        label: SYSTEM_LABELS[runSystem],
        system: runSystem,
      });
    }
  });
  if (system.nodes.some((node) => node.kind === 'cleanout') || system.equipment.some((item) => item.equipmentType === 'cleanout')) {
    items.push({ key: 'cleanout', label: 'CO/FCO', component: 'cleanout' });
  }
  if (system.nodes.some((node) => node.kind === 'valve') || system.equipment.some((item) => item.equipmentType === 'shutoff_valve')) {
    items.push({ key: 'valve', label: 'Valve', component: 'valve' });
  }
  if (system.nodes.some((node) => node.kind === 'stack') || system.equipment.some((item) => item.equipmentType.includes('stack'))) {
    items.push({ key: 'stack', label: 'Stack', component: 'stack' });
  }
  return items;
}

export function buildPlumbingFixtureScheduleRows(system: PlumbingSystem) {
  return system.fixtures
    .map((fixture) => ({
      fixtureId: fixture.id,
      mark: fixture.mark,
      fixtureType: fixture.fixtureType,
      displayName: fixture.displayName,
      coldWater: (fixture.connectionNodeIds.cold_water?.length ?? 0) > 0,
      hotWater: (fixture.connectionNodeIds.hot_water?.length ?? 0) > 0,
      sanitary: (fixture.connectionNodeIds.sanitary?.length ?? 0) > 0,
      vent: (fixture.connectionNodeIds.vent?.length ?? 0) > 0,
      xMeters: fixture.position.x,
      zMeters: fixture.position.z,
    }))
    .sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}
