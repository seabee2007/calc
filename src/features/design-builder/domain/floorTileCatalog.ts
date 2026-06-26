import type { FloorGroutJointWidth, FloorTileSizeKey, InteriorFloorTileSettings } from '../types';

export const DEFAULT_FLOOR_THINSET_THICKNESS_METERS = 0.0127;
export const DEFAULT_FLOOR_TILE_WASTE_FACTOR = 0.1;
export const DEFAULT_FLOOR_TILE_SIZE_KEY: FloorTileSizeKey = '600x600';
export const DEFAULT_FLOOR_GROUT_JOINT_WIDTH: FloorGroutJointWidth = '1/8';

export type FloorTileSizePreset = {
  key: FloorTileSizeKey;
  label: string;
  widthMeters: number;
  depthMeters: number;
  description: string;
};

export const FLOOR_TILE_SIZE_PRESETS: readonly FloorTileSizePreset[] = [
  {
    key: '300x300',
    label: '300 × 300 mm',
    widthMeters: 0.3,
    depthMeters: 0.3,
    description: 'Classic SE Asia residential',
  },
  {
    key: '400x400',
    label: '400 × 400 mm',
    widthMeters: 0.4,
    depthMeters: 0.4,
    description: 'Small rooms and bathrooms',
  },
  {
    key: '500x500',
    label: '500 × 500 mm',
    widthMeters: 0.5,
    depthMeters: 0.5,
    description: 'China / Asia mid-size',
  },
  {
    key: '600x600',
    label: '600 × 600 mm',
    widthMeters: 0.6,
    depthMeters: 0.6,
    description: 'Most common modern format',
  },
  {
    key: '800x800',
    label: '800 × 800 mm',
    widthMeters: 0.8,
    depthMeters: 0.8,
    description: 'Large-format China',
  },
  {
    key: '300x600',
    label: '300 × 600 mm',
    widthMeters: 0.3,
    depthMeters: 0.6,
    description: 'Rectangular floor tile',
  },
  {
    key: '600x1200',
    label: '600 × 1200 mm',
    widthMeters: 0.6,
    depthMeters: 1.2,
    description: 'Large porcelain slab',
  },
] as const;

export const FLOOR_GROUT_JOINT_OPTIONS: readonly {
  value: FloorGroutJointWidth;
  label: string;
}[] = [
  { value: 'none', label: 'No grout' },
  { value: '1/16', label: '1/16"' },
  { value: '1/8', label: '1/8"' },
  { value: '3/16', label: '3/16"' },
  { value: '1/4', label: '1/4"' },
];

const GROUT_WIDTH_METERS: Record<FloorGroutJointWidth, number> = {
  none: 0,
  '1/16': 0.0015875,
  '1/8': 0.003175,
  '3/16': 0.0047625,
  '1/4': 0.00635,
};

export function defaultInteriorFloorTileSettings(): InteriorFloorTileSettings {
  return {
    enabled: false,
    tileSizeKey: DEFAULT_FLOOR_TILE_SIZE_KEY,
    groutJointWidth: DEFAULT_FLOOR_GROUT_JOINT_WIDTH,
    thinsetThicknessMeters: DEFAULT_FLOOR_THINSET_THICKNESS_METERS,
    wasteFactor: DEFAULT_FLOOR_TILE_WASTE_FACTOR,
  };
}

export function resolveFloorTileSizePreset(key: FloorTileSizeKey): FloorTileSizePreset {
  return FLOOR_TILE_SIZE_PRESETS.find((preset) => preset.key === key) ?? FLOOR_TILE_SIZE_PRESETS[3]!;
}

export function groutJointWidthMeters(width: FloorGroutJointWidth): number {
  return GROUT_WIDTH_METERS[width] ?? 0;
}

export function resolveInteriorFloorTileSettings(
  partial: Partial<InteriorFloorTileSettings> | undefined,
): InteriorFloorTileSettings {
  const defaults = defaultInteriorFloorTileSettings();
  const tileSizeKey =
    FLOOR_TILE_SIZE_PRESETS.some((preset) => preset.key === partial?.tileSizeKey)
      ? partial!.tileSizeKey!
      : defaults.tileSizeKey;
  const groutJointWidth =
    partial?.groutJointWidth && partial.groutJointWidth in GROUT_WIDTH_METERS
      ? partial.groutJointWidth
      : defaults.groutJointWidth;
  return {
    enabled: partial?.enabled ?? defaults.enabled,
    tileSizeKey,
    groutJointWidth,
    thinsetThicknessMeters:
      partial?.thinsetThicknessMeters != null && partial.thinsetThicknessMeters > 0
        ? partial.thinsetThicknessMeters
        : defaults.thinsetThicknessMeters,
    wasteFactor:
      partial?.wasteFactor != null && partial.wasteFactor >= 0
        ? partial.wasteFactor
        : defaults.wasteFactor,
  };
}
