export type DesignMaterialCategory =
  | 'cmu'
  | 'mortar'
  | 'cast_concrete'
  | 'roof_sheet'
  | 'structural_steel'
  | 'site_ground';

export type DesignMaterialProjection = 'triplanar' | 'uv';

export type DesignMaterialTexturePaths = {
  color: string;
  normal?: string;
  roughness?: string;
  ao?: string;
  metalness?: string;
};

export type DesignMaterialOption = {
  id: string;
  category: DesignMaterialCategory;
  label: string;
  description?: string;
  swatchColor: string;
  texturePaths: DesignMaterialTexturePaths;
  projection: DesignMaterialProjection;
  tileSizeMeters?: number;
  uvRepeat?: number;
  roughness: number;
  metalness: number;
  supportsTint: boolean;
};

export type DesignMaterialTintPreset = {
  id: string;
  label: string;
  hex: string;
};

const MAP = {
  color: (folder: string, prefix: string) => `${folder}${prefix}_Color.jpg`,
  normal: (folder: string, prefix: string) => `${folder}${prefix}_NormalGL.jpg`,
  roughness: (folder: string, prefix: string) => `${folder}${prefix}_Roughness.jpg`,
  ao: (folder: string, prefix: string) => `${folder}${prefix}_AmbientOcclusion.jpg`,
  metalness: (folder: string, prefix: string) => `${folder}${prefix}_Metalness.jpg`,
} as const;

function packPaths(folder: string, prefix: string, maps: Array<keyof typeof MAP>): DesignMaterialTexturePaths {
  const paths: DesignMaterialTexturePaths = {
    color: MAP.color(folder, prefix),
  };
  if (maps.includes('normal')) paths.normal = MAP.normal(folder, prefix);
  if (maps.includes('roughness')) paths.roughness = MAP.roughness(folder, prefix);
  if (maps.includes('ao')) paths.ao = MAP.ao(folder, prefix);
  if (maps.includes('metalness')) paths.metalness = MAP.metalness(folder, prefix);
  return paths;
}

/** Registry built from textures present under public/textures/. */
export const DESIGN_MATERIAL_REGISTRY: readonly DesignMaterialOption[] = [
  {
    id: 'concrete-012',
    category: 'cmu',
    label: 'Concrete 012',
    description: 'Light smooth CMU block finish',
    swatchColor: '#e8e4df',
    texturePaths: packPaths('/textures/cmu/concrete-012/', 'Concrete012_1K-JPG', [
      'normal',
      'roughness',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 0.45,
    roughness: 0.88,
    metalness: 0.02,
    supportsTint: false,
  },
  {
    id: 'concrete-025',
    category: 'cmu',
    label: 'Concrete 025',
    description: 'Fine aggregate CMU finish',
    swatchColor: '#ddd8d2',
    texturePaths: packPaths('/textures/cmu/concrete-025/', 'Concrete025_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 0.45,
    roughness: 0.88,
    metalness: 0.02,
    supportsTint: false,
  },
  {
    id: 'concrete-032',
    category: 'mortar',
    label: 'Concrete 032',
    description: 'Smooth mortar joint finish',
    swatchColor: '#d8d4ce',
    texturePaths: packPaths('/textures/mortar/concrete-032/', 'Concrete032_1K-JPG', [
      'normal',
      'roughness',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 0.35,
    roughness: 0.96,
    metalness: 0.01,
    supportsTint: true,
  },
  {
    id: 'concrete-042a',
    category: 'cast_concrete',
    label: 'Concrete 042A',
    description: 'Cast-in-place structural concrete',
    swatchColor: '#8a8580',
    texturePaths: packPaths('/textures/concrete/concrete-042a/', 'Concrete042A_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 1.25,
    roughness: 0.92,
    metalness: 0.03,
    supportsTint: false,
  },
  {
    id: 'concrete-044d',
    category: 'cast_concrete',
    label: 'Concrete 044D',
    description: 'Heavier exposed aggregate cast concrete',
    swatchColor: '#94908a',
    texturePaths: packPaths('/textures/concrete/concrete-044d/', 'Concrete044D_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 1.25,
    roughness: 0.9,
    metalness: 0.03,
    supportsTint: false,
  },
  {
    id: 'concrete-017',
    category: 'cast_concrete',
    label: 'Concrete 017',
    description: 'Light weathered cast concrete',
    swatchColor: '#b8b3ac',
    texturePaths: packPaths('/textures/concrete/concrete-017/', 'Concrete017_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 1.25,
    roughness: 0.91,
    metalness: 0.03,
    supportsTint: false,
  },
  {
    id: 'concrete-031',
    category: 'cast_concrete',
    label: 'Concrete 031',
    description: 'Medium gray cast concrete with fine pitting',
    swatchColor: '#9a9590',
    texturePaths: packPaths('/textures/concrete/concrete-031/', 'Concrete031_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 1.25,
    roughness: 0.9,
    metalness: 0.03,
    supportsTint: false,
  },
  {
    id: 'concrete-048',
    category: 'cast_concrete',
    label: 'Concrete 048',
    description: 'Dark coarse aggregate cast concrete',
    swatchColor: '#7a7570',
    texturePaths: packPaths('/textures/concrete/concrete-048/', 'Concrete048_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'triplanar',
    tileSizeMeters: 1.25,
    roughness: 0.93,
    metalness: 0.03,
    supportsTint: false,
  },
  {
    id: 'corrugated-steel-009',
    category: 'roof_sheet',
    label: 'Corrugated Steel 009',
    description: 'Weathered corrugated roof metal',
    swatchColor: '#94a3b8',
    texturePaths: packPaths('/textures/roof/corrugated-steel-009/', 'CorrugatedSteel009_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.42,
    metalness: 0.78,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-001',
    category: 'roof_sheet',
    label: 'Corrugated Steel 001',
    description: 'Bright galvanized corrugated roof metal',
    swatchColor: '#b8c0c8',
    texturePaths: packPaths('/textures/roof/corrugated-steel-001/', 'CorrugatedSteel001_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.4,
    metalness: 0.8,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-002',
    category: 'roof_sheet',
    label: 'Corrugated Steel 002',
    description: 'Light weathered corrugated roof metal',
    swatchColor: '#a8b0b8',
    texturePaths: packPaths('/textures/roof/corrugated-steel-002/', 'CorrugatedSteel002_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.42,
    metalness: 0.78,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-004',
    category: 'roof_sheet',
    label: 'Corrugated Steel 004',
    description: 'Medium gray corrugated roof metal',
    swatchColor: '#8b939c',
    texturePaths: packPaths('/textures/roof/corrugated-steel-004/', 'CorrugatedSteel004_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.44,
    metalness: 0.76,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-006a',
    category: 'roof_sheet',
    label: 'Corrugated Steel 006A',
    description: 'Aged patina corrugated roof metal',
    swatchColor: '#7a848e',
    texturePaths: packPaths('/textures/roof/corrugated-steel-006a/', 'CorrugatedSteel006A_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.45,
    metalness: 0.75,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-007a',
    category: 'roof_sheet',
    label: 'Corrugated Steel 007A',
    description: 'Dark weathered corrugated roof metal',
    swatchColor: '#6b7280',
    texturePaths: packPaths('/textures/roof/corrugated-steel-007a/', 'CorrugatedSteel007A_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.46,
    metalness: 0.74,
    supportsTint: true,
  },
  {
    id: 'corrugated-steel-008c',
    category: 'roof_sheet',
    label: 'Corrugated Steel 008C',
    description: 'Rust-accent corrugated roof metal',
    swatchColor: '#8a6f5a',
    texturePaths: packPaths('/textures/roof/corrugated-steel-008c/', 'CorrugatedSteel008C_1K-JPG', [
      'normal',
      'roughness',
      'ao',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1,
    roughness: 0.48,
    metalness: 0.72,
    supportsTint: true,
  },
  {
    id: 'metal-021',
    category: 'structural_steel',
    label: 'Metal 021',
    description: 'Industrial structural steel finish',
    swatchColor: '#3d4852',
    texturePaths: packPaths('/textures/steel/metal-021/', 'Metal021_1K-JPG', [
      'normal',
      'roughness',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1.8,
    roughness: 0.36,
    metalness: 0.82,
    supportsTint: true,
  },
  {
    id: 'metal-037',
    category: 'structural_steel',
    label: 'Metal 037',
    description: 'Brushed structural steel with light oxidation',
    swatchColor: '#4b5563',
    texturePaths: packPaths('/textures/steel/metal-037/', 'Metal037_1K-JPG', [
      'normal',
      'roughness',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1.8,
    roughness: 0.38,
    metalness: 0.8,
    supportsTint: true,
  },
  {
    id: 'painted-metal-004',
    category: 'structural_steel',
    label: 'Painted Metal 004',
    description: 'Painted steel truss and connector finish',
    swatchColor: '#546e7a',
    texturePaths: packPaths('/textures/steel/painted-metal-004/', 'PaintedMetal004_1K-JPG', [
      'normal',
      'roughness',
      'metalness',
    ]),
    projection: 'uv',
    uvRepeat: 1.8,
    roughness: 0.36,
    metalness: 0.82,
    supportsTint: true,
  },
  {
    id: 'ground-003',
    category: 'site_ground',
    label: 'Ground 003',
    description: 'Compacted brown site soil',
    swatchColor: '#8a7358',
    texturePaths: packPaths('/textures/terrain/ground-003/', 'Ground003_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 2,
    roughness: 0.94,
    metalness: 0.01,
    supportsTint: false,
  },
  {
    id: 'ground-037',
    category: 'site_ground',
    label: 'Ground 037',
    description: 'Dry tan construction site ground',
    swatchColor: '#a89478',
    texturePaths: packPaths('/textures/terrain/ground-037/', 'Ground037_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 2,
    roughness: 0.93,
    metalness: 0.01,
    supportsTint: false,
  },
  {
    id: 'ground-075',
    category: 'site_ground',
    label: 'Ground 075',
    description: 'Dark gravel and dirt blend',
    swatchColor: '#6b6258',
    texturePaths: packPaths('/textures/terrain/ground-075/', 'Ground075_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 2,
    roughness: 0.95,
    metalness: 0.01,
    supportsTint: false,
  },
  {
    id: 'grass-004',
    category: 'site_ground',
    label: 'Grass 004',
    description: 'Short maintained turf grass',
    swatchColor: '#5f7a4a',
    texturePaths: packPaths('/textures/terrain/grass-004/', 'Grass004_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 1.5,
    roughness: 0.9,
    metalness: 0.01,
    supportsTint: false,
  },
  {
    id: 'grass-007',
    category: 'site_ground',
    label: 'Grass 007',
    description: 'Natural field grass cover',
    swatchColor: '#4d6b3c',
    texturePaths: packPaths('/textures/terrain/grass-007/', 'Grass007_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 1.5,
    roughness: 0.88,
    metalness: 0.01,
    supportsTint: false,
  },
  {
    id: 'snow-015',
    category: 'site_ground',
    label: 'Snow 015',
    description: 'Packed snow site surface',
    swatchColor: '#e8eef2',
    texturePaths: packPaths('/textures/terrain/snow-015/', 'Snow015_1K-JPG', [
      'normal',
      'roughness',
      'ao',
    ]),
    projection: 'uv',
    tileSizeMeters: 2.5,
    roughness: 0.82,
    metalness: 0.01,
    supportsTint: false,
  },
] as const;

export const MORTAR_TINT_PRESETS: readonly DesignMaterialTintPreset[] = [
  { id: 'light-gray', label: 'Light Gray', hex: '#d8d4ce' },
  { id: 'warm-gray', label: 'Warm Gray', hex: '#cfc8bf' },
  { id: 'medium-gray', label: 'Medium Gray', hex: '#b8b2a8' },
];

export const ROOF_SHEET_TINT_PRESETS: readonly DesignMaterialTintPreset[] = [
  { id: 'galvanized-gray', label: 'Galvanized Gray', hex: '#94a3b8' },
  { id: 'charcoal', label: 'Charcoal', hex: '#4b5563' },
  { id: 'dark-green', label: 'Dark Green', hex: '#3f5f4a' },
  { id: 'red-oxide', label: 'Red Oxide', hex: '#8b3a3a' },
  { id: 'white', label: 'White', hex: '#e5e7eb' },
];

export const STRUCTURAL_STEEL_TINT_PRESETS: readonly DesignMaterialTintPreset[] = [
  { id: 'dark-structural', label: 'Dark Structural Steel', hex: '#3d4852' },
  { id: 'black', label: 'Black', hex: '#1f2937' },
  { id: 'gray-primer', label: 'Gray Primer', hex: '#6b7280' },
  { id: 'painted-red', label: 'Painted Red', hex: '#9b2c2c' },
];

export function getMaterialOptionsForCategory(
  category: DesignMaterialCategory,
): readonly DesignMaterialOption[] {
  return DESIGN_MATERIAL_REGISTRY.filter((option) => option.category === category);
}

export function getMaterialOptionById(materialId: string): DesignMaterialOption | undefined {
  return DESIGN_MATERIAL_REGISTRY.find((option) => option.id === materialId);
}

export function getDefaultMaterialIdForCategory(category: DesignMaterialCategory): string {
  const options = getMaterialOptionsForCategory(category);
  return options[0]?.id ?? '';
}

export function getTintPresetById(
  presets: readonly DesignMaterialTintPreset[],
  presetId: string | undefined,
): DesignMaterialTintPreset | undefined {
  if (!presetId) return undefined;
  return presets.find((preset) => preset.id === presetId);
}
