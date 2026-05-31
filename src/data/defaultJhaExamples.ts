import type { SafetyJhaRow } from '../types/fieldTools';
import { newRowId } from '../types/fieldTools';

export function createDefaultJhaExamples(): SafetyJhaRow[] {
  const rows: Omit<SafetyJhaRow, 'id'>[] = [
    {
      task: 'Concrete placement',
      hazards: 'Struck-by, pinch points, hose whipping, burns from fresh concrete',
      controls: 'Exclusion zone around pump hose, spotter for trucks, gloves and boots',
      ppe: 'Gloves, safety glasses, boots, hi-vis',
      responsible: 'Foreman',
    },
    {
      task: 'Rebar handling',
      hazards: 'Puncture, impalement, strains from lifting',
      controls: 'Cap protruding rebar, team lifts, clear walking paths',
      ppe: 'Gloves, safety glasses, hard hat',
      responsible: 'Rebar lead',
    },
    {
      task: 'Formwork',
      hazards: 'Falls, collapse, nail gun injuries, splinters',
      controls: 'Guardrails where required, inspect shores, sequential stripping plan',
      ppe: 'Hard hat, gloves, safety glasses',
      responsible: 'Carpenter lead',
    },
    {
      task: 'Pump truck operation',
      hazards: 'Hose whipping, overhead lines, pressure release',
      controls: 'Maintain exclusion zone, confirm line-of-pump, communicate with operator',
      ppe: 'Hard hat, gloves, hi-vis',
      responsible: 'Pump operator / foreman',
    },
    {
      task: 'Saw cutting',
      hazards: 'Silica dust, noise, cuts, flying debris',
      controls: 'Wet cutting when possible, ventilation, blade guard in place',
      ppe: 'Respirator if required, hearing protection, eye protection',
      responsible: 'Operator',
    },
    {
      task: 'Excavation',
      hazards: 'Cave-in, utilities, falls into open trench',
      controls: 'Call 811, sloping/shoring per competent person, barricades',
      ppe: 'Hard hat, boots, hi-vis',
      responsible: 'Competent person',
    },
    {
      task: 'Equipment operation',
      hazards: 'Struck-by, rollover, blind spots',
      controls: 'Spotters, seat belts, daily walk-around, no riders on equipment',
      ppe: 'Hard hat, hi-vis',
      responsible: 'Operator',
    },
    {
      task: 'Heat stress',
      hazards: 'Heat exhaustion, dehydration, sun exposure',
      controls: 'Water breaks, shade, adjust schedule, buddy system',
      ppe: 'Light clothing, sunscreen, hydration',
      responsible: 'Foreman',
    },
    {
      task: 'Slips, trips, and falls',
      hazards: 'Uneven surfaces, cords, mud, clutter',
      controls: 'Housekeeping, lighting, marked hazards, handrails',
      ppe: 'Boots with good tread',
      responsible: 'All crew',
    },
  ];
  return rows.map((r) => ({ ...r, id: newRowId() }));
}
