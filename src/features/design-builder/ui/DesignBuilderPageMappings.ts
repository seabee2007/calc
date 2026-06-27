import type {
  CmuInfillPlasterSettings,
  DesignBuilderToolMode,
  DesignEstimatePreviewLine,
  DesignObjectType,
  ModuleFitStatus,
} from '../types';
import type { DesignMaterialSelection } from '../rendering/materials/designMaterialLibrary';

export const TOOL_MODE_OPTIONS: Array<{ mode: DesignBuilderToolMode; label: string }> = [
  { mode: 'select', label: 'Select' },
  { mode: 'place_dimension', label: 'Dimension' },
  { mode: 'draw_wall', label: 'Draw Wall' },
  { mode: 'move_wall_node', label: 'Move Node' },
  { mode: 'move_opening', label: 'Move Opening' },
  { mode: 'delete', label: 'Delete' },
];

export function plasterMaterialIdForFinish(finish: CmuInfillPlasterSettings['finish']): string {
  return finish === 'smooth' ? 'smooth-3-coat-plaster' : 'textured-3-coat-plaster';
}

export function finishForPlasterMaterialId(
  materialId: DesignMaterialSelection['plasterMaterialId'],
): CmuInfillPlasterSettings['finish'] | null {
  if (materialId === 'smooth-3-coat-plaster') return 'smooth';
  if (materialId === 'textured-3-coat-plaster') return 'textured';
  return null;
}

export type DesignBuilderObjectTreeItem = {
  id: string;
  objectType: DesignObjectType;
  label: string;
  description: string;
};

export const OBJECT_TREE_ITEMS: DesignBuilderObjectTreeItem[] = [
  { id: 'footprint', objectType: 'building_footprint', label: 'Nodes', description: '' },
  { id: 'segments', objectType: 'cmu_wall_system', label: 'Wall Segments', description: '' },
  { id: 'corners', objectType: 'cmu_wall_system', label: 'Corners', description: '' },
  { id: 'cmu', objectType: 'cmu_wall_system', label: 'CMU Walls', description: '' },
  { id: 'openings', objectType: 'door_opening', label: 'Openings', description: '' },
  { id: 'lintels', objectType: 'cmu_wall_system', label: 'Lintels', description: '' },
  { id: 'bond-beams', objectType: 'cmu_wall_system', label: 'Bond Beams', description: '' },
  { id: 'grout-rebar', objectType: 'cmu_wall_system', label: 'Grout/Rebar Cells', description: '' },
  { id: 'manual-runs', objectType: 'cmu_wall_system', label: 'Manual Runs', description: '' },
  { id: 'slab', objectType: 'thickened_edge_slab', label: 'Slab', description: '' },
  { id: 'roof-beams', objectType: 'structural_frame_system', label: 'Roof Beams', description: '' },
  { id: 'plinth-beams', objectType: 'structural_frame_system', label: 'Plinth Beams', description: '' },
  { id: 'tie-beams', objectType: 'structural_frame_system', label: 'Tie Beams', description: '' },
  { id: 'columns', objectType: 'structural_frame_system', label: 'Columns', description: '' },
  { id: 'isolated-footings', objectType: 'structural_frame_system', label: 'Isolated Footings', description: '' },
  { id: 'infill-panels', objectType: 'cmu_infill_system', label: 'CMU Infill Panels', description: '' },
  { id: 'roof-system', objectType: 'gable_roof_system', label: 'Roof System', description: '' },
  { id: 'ridge', objectType: 'gable_roof_system', label: 'Ridge', description: '' },
  { id: 'raked-caps', objectType: 'gable_end_system', label: 'Raked Concrete Caps', description: '' },
  { id: 'roof', objectType: 'gable_roof_system', label: 'Roof', description: '' },
  { id: 'gable-ends', objectType: 'gable_end_system', label: 'Gable Ends', description: '' },
  { id: 'trusses', objectType: 'steel_truss_system', label: 'Trusses', description: '' },
  { id: 'quantity-summary', objectType: 'cmu_wall_system', label: 'Quantity Summary', description: '' },
  { id: 'estimate-preview', objectType: 'cmu_wall_system', label: 'Estimate Preview', description: '' },
  { id: 'warnings', objectType: 'cmu_wall_system', label: 'Warnings', description: '' },
];

export const OBJECT_TREE_GROUPS: Array<{
  id: string;
  label: string;
  items: DesignBuilderObjectTreeItem[];
}> = [
  {
    id: 'layout',
    label: 'Layout',
    items: OBJECT_TREE_ITEMS.filter((item) => ['footprint', 'segments', 'corners', 'slab'].includes(item.id)),
  },
  {
    id: 'masonry',
    label: 'Masonry',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['cmu', 'infill-panels', 'lintels', 'bond-beams', 'grout-rebar', 'manual-runs'].includes(item.id),
    ),
  },
  {
    id: 'structure',
    label: 'Structure',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['roof-beams', 'plinth-beams', 'tie-beams', 'columns'].includes(item.id),
    ),
  },
  {
    id: 'foundation',
    label: 'Foundation',
    items: OBJECT_TREE_ITEMS.filter((item) => ['isolated-footings'].includes(item.id)),
  },
  {
    id: 'openings',
    label: 'Openings',
    items: OBJECT_TREE_ITEMS.filter((item) => ['openings'].includes(item.id)),
  },
  {
    id: 'roofGable',
    label: 'Roof',
    items: OBJECT_TREE_ITEMS.filter((item) =>
      ['roof-system', 'roof-beams', 'ridge', 'gable-ends', 'raked-caps', 'trusses'].includes(item.id),
    ),
  },
  {
    id: 'estimate',
    label: 'Estimate',
    items: OBJECT_TREE_ITEMS.filter((item) => ['quantity-summary', 'estimate-preview', 'warnings'].includes(item.id)),
  },
];

export function moduleFitStatusTone(status: ModuleFitStatus): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'fully_modular' || status === 'bond_modular') return 'success';
  if (status === 'cut_required' || status === 'opening_conflict') return 'warning';
  if (status === 'unresolved') return 'error';
  return 'info';
}

export function objectIdForType(
  objectType: DesignObjectType,
  objectIds: {
    slabObjectId: string;
    wallObjectId: string;
    roofObjectId: string;
    trussObjectId: string;
    frameObjectId: string;
    infillObjectId: string;
    gableEndObjectId: string;
  },
): string {
  if (objectType === 'thickened_edge_slab') return objectIds.slabObjectId;
  if (objectType === 'gable_roof_system') return objectIds.roofObjectId;
  if (objectType === 'steel_truss_system') return objectIds.trussObjectId;
  if (objectType === 'structural_frame_system') return objectIds.frameObjectId;
  if (objectType === 'cmu_infill_system') return objectIds.infillObjectId;
  if (objectType === 'gable_end_system') return objectIds.gableEndObjectId;
  return objectIds.wallObjectId;
}

export function objectTypeForPreviewLine(line: DesignEstimatePreviewLine): DesignObjectType {
  if (line.quantityType.includes('slab') || line.id.includes('slab')) return 'thickened_edge_slab';
  if (line.quantityType.includes('raked_concrete_cap') || line.quantityType.includes('gable_end')) {
    return 'gable_end_system';
  }
  if (line.quantityType.startsWith('rc_')) return 'structural_frame_system';
  if (line.quantityType.includes('infill') || line.id.startsWith('infill-')) return 'cmu_infill_system';
  if (line.quantityType.includes('truss') || line.id.includes('truss')) return 'steel_truss_system';
  if (
    line.quantityType.includes('roof') ||
    line.quantityType.includes('ridge') ||
    line.quantityType.includes('hip') ||
    line.quantityType.includes('corrugated')
  ) {
    return 'gable_roof_system';
  }
  return 'cmu_wall_system';
}
