import * as THREE from 'three';
import type { CastConcreteMaterialRole } from './designCastConcreteRoles';
import {
  CAST_CONCRETE_TEXTURE_TILE_METERS,
  CMU_TEXTURE_TILE_METERS,
  MORTAR_TEXTURE_TILE_METERS,
  createTriplanarStandardMaterial,
  getTextureProjectionDiagnostics,
  isTriplanarCheckerDebugEnabled,
  resetTriplanarMaterialCacheForTests,
  setTriplanarCheckerDebugEnabled,
} from './createTriplanarStandardMaterial';
import {
  getMaterialOptionById,
  getTintPresetById,
  MORTAR_TINT_PRESETS,
  ROOF_SHEET_TINT_PRESETS,
  STRUCTURAL_STEEL_TINT_PRESETS,
  type DesignMaterialOption,
} from './designMaterialRegistry';
import {
  DEFAULT_DESIGN_MATERIAL_SELECTION,
  normalizeDesignMaterialSelection,
  type DesignMaterialSelection,
} from './designMaterialSelections';

export type { TextureProjectionDiagnostics } from './createTriplanarStandardMaterial';
export {
  CAST_CONCRETE_TEXTURE_TILE_METERS,
  CMU_TEXTURE_TILE_METERS,
  getTextureProjectionDiagnostics,
  isTriplanarCheckerDebugEnabled,
  setTriplanarCheckerDebugEnabled,
};
export type { CastConcreteMaterialRole } from './designCastConcreteRoles';
export type { DesignMaterialSelection } from './designMaterialSelections';
export { DEFAULT_DESIGN_MATERIAL_SELECTION, normalizeDesignMaterialSelection, designMaterialSelectionsEqual } from './designMaterialSelections';
export {
  DESIGN_MATERIAL_REGISTRY,
  getMaterialOptionsForCategory,
  getMaterialOptionById,
  MORTAR_TINT_PRESETS,
  ROOF_SHEET_TINT_PRESETS,
  STRUCTURAL_STEEL_TINT_PRESETS,
  type DesignMaterialCategory,
  type DesignMaterialOption,
  type DesignMaterialTintPreset,
} from './designMaterialRegistry';

export type DesignVisualStyle = 'technical' | 'material_preview';

export type DesignMaterialLibrary = {
  cmuTechnical: THREE.MeshStandardMaterial;
  cmuPreview: THREE.MeshStandardMaterial;
  mortarTechnical: THREE.MeshStandardMaterial;
  mortarPreview: THREE.MeshStandardMaterial;
  castConcreteStructuralTechnical: THREE.MeshStandardMaterial;
  castConcreteStructuralPreview: THREE.MeshStandardMaterial;
  castConcreteBeamTechnical: THREE.MeshStandardMaterial;
  castConcreteBeamPreview: THREE.MeshStandardMaterial;
  roofMetalTechnical: THREE.MeshStandardMaterial;
  roofMetalPreview: THREE.MeshStandardMaterial;
  structuralSteelTechnical: THREE.MeshStandardMaterial;
  structuralSteelPreview: THREE.MeshStandardMaterial;

  siteGroundTechnical: THREE.MeshBasicMaterial;
  siteGroundPreview: THREE.MeshStandardMaterial;
};

export type MaterialPackStatus = 'technical_only' | 'loading' | 'loaded' | 'partial' | 'failed';

export type MaterialDiagnostics = {
  visualStyle: DesignVisualStyle;
  loadedTexturePacks: string[];
  cmuMaterialStatus: MaterialPackStatus;
  mortarMaterialStatus: MaterialPackStatus;
  concreteStructuralMaterialStatus: MaterialPackStatus;
  concreteBeamMaterialStatus: MaterialPackStatus;
  roofMaterialStatus: MaterialPackStatus;
  steelMaterialStatus: MaterialPackStatus;
  siteGroundMaterialStatus: MaterialPackStatus;
  textureResolution: string;
  activeTextureCount: number;
  materialInstanceCount: number;
  activeMaterialSelections: DesignMaterialSelection;
};

type TextureMapKind = 'Color' | 'NormalGL' | 'Roughness' | 'AmbientOcclusion' | 'Metalness';

type LoadedPackTextures = Partial<Record<TextureMapKind, THREE.Texture>>;

type LibraryState = {
  library: DesignMaterialLibrary | null;
  activeSelections: DesignMaterialSelection;
  textureCache: Map<string, LoadedPackTextures>;
  materialStatus: Map<string, MaterialPackStatus>;
  previewLoadPromise: Promise<void> | null;
  previewLoaded: boolean;
  textureCount: number;
  textureResolution: string;
  rendererAnisotropy: number;
  listeners: Set<() => void>;
};

const state: LibraryState = {
  library: null,
  activeSelections: normalizeDesignMaterialSelection(DEFAULT_DESIGN_MATERIAL_SELECTION),
  textureCache: new Map(),
  materialStatus: new Map(),
  previewLoadPromise: null,
  previewLoaded: false,
  textureCount: 0,
  textureResolution: 'not loaded',
  rendererAnisotropy: 1,
  listeners: new Set(),
};

const TECHNICAL_COLORS = {
  cmu: 0xd1d5db,
  mortar: 0xc4c0ba,
  castConcreteStructural: 0x78716c,
  castConcreteBeam: 0x6b7280,
  roofMetal: 0x64748b,
  structuralSteel: 0x546e7a,
  siteGround: 0xe2e8f0,
} as const;

const PREVIEW_FALLBACK_TINTS = {
  cmu: 0xe8e4df,
  mortar: 0xd8d4ce,
  castConcreteStructural: 0x8a8580,
  castConcreteBeam: 0x94908a,
  roofMetal: 0x94a3b8,
  structuralSteel: 0x3d4852,
  siteGround: 0xffffff,
} as const;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function resolveMortarTint(selection: DesignMaterialSelection): number {
  const preset = getTintPresetById(MORTAR_TINT_PRESETS, selection.mortarTintId);
  return hexToNumber(preset?.hex ?? MORTAR_TINT_PRESETS[0].hex);
}

function resolveRoofTint(selection: DesignMaterialSelection): number {
  const preset = getTintPresetById(ROOF_SHEET_TINT_PRESETS, selection.roofSheetTintId);
  return hexToNumber(preset?.hex ?? ROOF_SHEET_TINT_PRESETS[0].hex);
}

function resolveSteelTint(selection: DesignMaterialSelection): number {
  const preset = getTintPresetById(STRUCTURAL_STEEL_TINT_PRESETS, selection.structuralSteelTintId);
  return hexToNumber(preset?.hex ?? STRUCTURAL_STEEL_TINT_PRESETS[0].hex);
}

function createTechnicalMaterial(
  color: number,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.03,
    ...options,
  });
}

function createPreviewBaseMaterial(
  color: number,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.04,
    ...options,
  });
}

function ensureLibrary(): DesignMaterialLibrary {
  if (state.library) return state.library;

  state.library = {
    cmuTechnical: createTechnicalMaterial(TECHNICAL_COLORS.cmu, { roughness: 0.82, metalness: 0.02 }),
    cmuPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.cmu, { roughness: 0.84, metalness: 0.02 }),
    mortarTechnical: createTechnicalMaterial(TECHNICAL_COLORS.mortar, { roughness: 0.92, metalness: 0.01 }),
    mortarPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.mortar, { roughness: 0.94, metalness: 0.01 }),
    castConcreteStructuralTechnical: createTechnicalMaterial(TECHNICAL_COLORS.castConcreteStructural, {
      roughness: 0.88,
      metalness: 0.05,
    }),
    castConcreteStructuralPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.castConcreteStructural, {
      roughness: 0.9,
      metalness: 0.04,
    }),
    castConcreteBeamTechnical: createTechnicalMaterial(TECHNICAL_COLORS.castConcreteBeam, {
      roughness: 0.85,
      metalness: 0.05,
    }),
    castConcreteBeamPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.castConcreteBeam, {
      roughness: 0.88,
      metalness: 0.04,
    }),
    roofMetalTechnical: createTechnicalMaterial(TECHNICAL_COLORS.roofMetal, {
      roughness: 0.35,
      metalness: 0.65,
      side: THREE.DoubleSide,
    }),
    roofMetalPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.roofMetal, {
      roughness: 0.38,
      metalness: 0.72,
      side: THREE.DoubleSide,
    }),
    structuralSteelTechnical: createTechnicalMaterial(TECHNICAL_COLORS.structuralSteel, {
      roughness: 0.32,
      metalness: 0.78,
    }),
    structuralSteelPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.structuralSteel, {
      roughness: 0.34,
      metalness: 0.8,
    }),

    siteGroundTechnical: new THREE.MeshBasicMaterial({
      color: TECHNICAL_COLORS.siteGround,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
    siteGroundPreview: createPreviewBaseMaterial(PREVIEW_FALLBACK_TINTS.siteGround, {
      roughness: 0.92,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };

  return state.library;
}

function configureColorTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = state.rendererAnisotropy;
}

function configureDataTexture(texture: THREE.Texture): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = state.rendererAnisotropy;
}

function loadTexturePath(path: string, isColor: boolean): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      path,
      (texture) => {
        if (isColor) {
          configureColorTexture(texture);
        } else {
          configureDataTexture(texture);
        }
        if (state.textureResolution === 'not loaded' && texture.image) {
          const image = texture.image as { width?: number; height?: number };
          if (image.width && image.height) {
            state.textureResolution = `${image.width}x${image.height}`;
          }
        }
        resolve(texture);
      },
      undefined,
      () => {
        if (import.meta.env.DEV) {
          console.warn('[design-materials] texture failed to load', { path });
        }
        resolve(null);
      },
    );
  });
}

function resolvePackStatus(maps: LoadedPackTextures): MaterialPackStatus {
  if (!maps.Color) return 'failed';
  const loadedKinds = Object.keys(maps).length;
  if (loadedKinds >= 3) return 'loaded';
  return 'partial';
}

async function loadMaterialTextures(option: DesignMaterialOption): Promise<LoadedPackTextures> {
  const cached = state.textureCache.get(option.id);
  if (cached) return cached;

  const maps: LoadedPackTextures = {};
  const color = await loadTexturePath(option.texturePaths.color, true);
  if (color) maps.Color = color;

  if (option.texturePaths.normal) {
    const normal = await loadTexturePath(option.texturePaths.normal, false);
    if (normal) maps.NormalGL = normal;
  }
  if (option.texturePaths.roughness) {
    const roughness = await loadTexturePath(option.texturePaths.roughness, false);
    if (roughness) maps.Roughness = roughness;
  }
  if (option.texturePaths.ao) {
    const ao = await loadTexturePath(option.texturePaths.ao, false);
    if (ao) maps.AmbientOcclusion = ao;
  }
  if (option.texturePaths.metalness) {
    const metalness = await loadTexturePath(option.texturePaths.metalness, false);
    if (metalness) maps.Metalness = metalness;
  }

  state.textureCache.set(option.id, maps);
  state.materialStatus.set(option.id, resolvePackStatus(maps));
  return maps;
}

function applyMapsToMaterial(
  material: THREE.MeshStandardMaterial,
  maps: LoadedPackTextures,
  repeat: THREE.Vector2,
  options?: {
    forceColor?: number;
    albedoColor?: number;
    metalness?: number;
    roughness?: number;
  },
): void {
  if (maps.Color) {
    maps.Color.repeat.copy(repeat);
    material.map = maps.Color;
    material.color.setHex(options?.albedoColor ?? 0xffffff);
  } else if (options?.forceColor != null) {
    material.color.setHex(options.forceColor);
  }

  if (maps.NormalGL) {
    maps.NormalGL.repeat.copy(repeat);
    material.normalMap = maps.NormalGL;
    material.normalScale.set(0.65, 0.65);
  } else {
    material.normalMap = null;
  }

  if (maps.Roughness) {
    maps.Roughness.repeat.copy(repeat);
    material.roughnessMap = maps.Roughness;
    material.roughness = options?.roughness ?? material.roughness;
  } else {
    material.roughnessMap = null;
  }

  if (maps.AmbientOcclusion) {
    maps.AmbientOcclusion.repeat.copy(repeat);
    material.aoMap = maps.AmbientOcclusion;
    material.aoMapIntensity = 0.85;
  } else {
    material.aoMap = null;
  }

  if (maps.Metalness) {
    maps.Metalness.repeat.copy(repeat);
    material.metalnessMap = maps.Metalness;
    material.metalness = options?.metalness ?? material.metalness;
  } else {
    material.metalnessMap = null;
  }

  material.needsUpdate = true;
}

function buildTriplanarPreviewMaterial(
  maps: LoadedPackTextures,
  textureScaleMeters: number,
  fallbackTint: number,
  albedoTint: number,
  roughness: number,
  metalness: number,
): THREE.MeshStandardMaterial {
  return createTriplanarStandardMaterial({
    colorMap: maps.Color,
    roughnessMap: maps.Roughness,
    aoMap: maps.AmbientOcclusion,
    textureScaleMeters,
    baseColor: maps.Color ? albedoTint : fallbackTint,
    roughness,
    metalness,
    useCheckerMap: isTriplanarCheckerDebugEnabled(),
  });
}

function getCachedMaps(materialId: string, fallbackId: string): LoadedPackTextures {
  return state.textureCache.get(materialId) ?? state.textureCache.get(fallbackId) ?? {};
}

function statusForMaterialId(materialId: string, fallbackId: string): MaterialPackStatus {
  return state.materialStatus.get(materialId) ?? state.materialStatus.get(fallbackId) ?? 'failed';
}

function applyPreviewMaps(): void {
  const library = ensureLibrary();
  const selection = state.activeSelections;

  const cmuOption = getMaterialOptionById(selection.cmuMaterialId);
  const mortarOption = getMaterialOptionById(selection.mortarMaterialId);
  const concreteOption = getMaterialOptionById(selection.castConcreteMaterialId);
  const roofOption = getMaterialOptionById(selection.roofSheetMaterialId);
  const steelOption = getMaterialOptionById(selection.structuralSteelMaterialId);
  const siteGroundOption = getMaterialOptionById(selection.siteGroundMaterialId);

  if (cmuOption) {
    library.cmuPreview = buildTriplanarPreviewMaterial(
      getCachedMaps(cmuOption.id, 'concrete-012'),
      cmuOption.tileSizeMeters ?? CMU_TEXTURE_TILE_METERS,
      PREVIEW_FALLBACK_TINTS.cmu,
      0xffffff,
      cmuOption.roughness,
      cmuOption.metalness,
    );
  }

  if (mortarOption) {
    library.mortarPreview = buildTriplanarPreviewMaterial(
      getCachedMaps(mortarOption.id, 'concrete-032'),
      mortarOption.tileSizeMeters ?? MORTAR_TEXTURE_TILE_METERS,
      PREVIEW_FALLBACK_TINTS.mortar,
      resolveMortarTint(selection),
      mortarOption.roughness,
      mortarOption.metalness,
    );
  }

  if (concreteOption) {
    const concreteMaps = getCachedMaps(concreteOption.id, 'concrete-042a');
    library.castConcreteStructuralPreview = buildTriplanarPreviewMaterial(
      concreteMaps,
      concreteOption.tileSizeMeters ?? CAST_CONCRETE_TEXTURE_TILE_METERS,
      PREVIEW_FALLBACK_TINTS.castConcreteStructural,
      0xffffff,
      concreteOption.roughness,
      concreteOption.metalness,
    );
    library.castConcreteBeamPreview = buildTriplanarPreviewMaterial(
      concreteMaps,
      concreteOption.tileSizeMeters ?? CAST_CONCRETE_TEXTURE_TILE_METERS,
      PREVIEW_FALLBACK_TINTS.castConcreteBeam,
      0xffffff,
      concreteOption.roughness,
      concreteOption.metalness,
    );
  }

  if (roofOption) {
    applyMapsToMaterial(
      library.roofMetalPreview,
      getCachedMaps(roofOption.id, 'corrugated-steel-009'),
      new THREE.Vector2(roofOption.uvRepeat ?? 1, roofOption.uvRepeat ?? 1),
      {
        forceColor: PREVIEW_FALLBACK_TINTS.roofMetal,
        albedoColor: resolveRoofTint(selection),
        roughness: roofOption.roughness,
        metalness: roofOption.metalness,
      },
    );
  }

  if (steelOption) {
    applyMapsToMaterial(
      library.structuralSteelPreview,
      getCachedMaps(steelOption.id, 'metal-021'),
      new THREE.Vector2(steelOption.uvRepeat ?? 1.8, steelOption.uvRepeat ?? 1.8),
      {
        forceColor: PREVIEW_FALLBACK_TINTS.structuralSteel,
        albedoColor: resolveSteelTint(selection),
        roughness: steelOption.roughness,
        metalness: steelOption.metalness,
      },
    );
  }

  if (siteGroundOption) {
    applyMapsToMaterial(
      library.siteGroundPreview,
      getCachedMaps(siteGroundOption.id, 'ground-037'),
      new THREE.Vector2(1, 1),
      {
        forceColor: PREVIEW_FALLBACK_TINTS.siteGround,
        albedoColor: 0xffffff,
        roughness: siteGroundOption.roughness,
        metalness: siteGroundOption.metalness,
      },
    );
  }
}

function siteGroundUvRepeat(gridSizeMeters: number, materialId: string): number {
  const option = getMaterialOptionById(materialId);
  const tileSizeMeters = option?.tileSizeMeters ?? 2;
  return Math.max(1, gridSizeMeters / tileSizeMeters);
}

function uniqueMaterialIdsForSelections(selection: DesignMaterialSelection): string[] {
  return [
    selection.cmuMaterialId,
    selection.mortarMaterialId,
    selection.castConcreteMaterialId,
    selection.roofSheetMaterialId,
    selection.structuralSteelMaterialId,
    selection.siteGroundMaterialId,
  ].filter((id, index, array) => array.indexOf(id) === index);
}

async function loadPreviewTexturesInternal(renderer?: THREE.WebGLRenderer): Promise<void> {
  if (renderer) {
    state.rendererAnisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  ensureLibrary();
  const materialIds = uniqueMaterialIdsForSelections(state.activeSelections);
  let textureCount = 0;

  for (const materialId of materialIds) {
    const option = getMaterialOptionById(materialId);
    if (!option) continue;
    state.materialStatus.set(materialId, 'loading');
    const maps = await loadMaterialTextures(option);
    textureCount += Object.keys(maps).length;
  }

  state.textureCount = textureCount;
  applyPreviewMaps();
  state.previewLoaded = true;
  state.listeners.forEach((listener) => listener());
}

export function getActiveMaterialSelections(): DesignMaterialSelection {
  return normalizeDesignMaterialSelection(state.activeSelections);
}

export function setActiveMaterialSelections(selections: DesignMaterialSelection): Promise<void> {
  state.activeSelections = normalizeDesignMaterialSelection(selections);
  const materialIds = uniqueMaterialIdsForSelections(state.activeSelections);
  return (async () => {
    for (const materialId of materialIds) {
      const option = getMaterialOptionById(materialId);
      if (!option) continue;
      await loadMaterialTextures(option);
    }
    if (!state.previewLoaded) return;
    applyPreviewMaps();
    state.listeners.forEach((listener) => listener());
  })();
}

export function getDesignMaterialLibrary(): DesignMaterialLibrary {
  return ensureLibrary();
}

export function subscribeMaterialDiagnostics(listener: () => void): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

export function getMaterialDiagnostics(visualStyle: DesignVisualStyle): MaterialDiagnostics {
  ensureLibrary();
  const selection = getActiveMaterialSelections();
  const loadedTexturePacks = uniqueMaterialIdsForSelections(selection).filter((id) => {
    const status = state.materialStatus.get(id);
    return status === 'loaded' || status === 'partial';
  });

  return {
    visualStyle,
    loadedTexturePacks,
    cmuMaterialStatus:
      visualStyle === 'technical' ? 'technical_only' : statusForMaterialId(selection.cmuMaterialId, 'concrete-012'),
    mortarMaterialStatus:
      visualStyle === 'technical' ? 'technical_only' : statusForMaterialId(selection.mortarMaterialId, 'concrete-032'),
    concreteStructuralMaterialStatus:
      visualStyle === 'technical'
        ? 'technical_only'
        : statusForMaterialId(selection.castConcreteMaterialId, 'concrete-042a'),
    concreteBeamMaterialStatus:
      visualStyle === 'technical'
        ? 'technical_only'
        : statusForMaterialId(selection.castConcreteMaterialId, 'concrete-042a'),
    roofMaterialStatus:
      visualStyle === 'technical'
        ? 'technical_only'
        : statusForMaterialId(selection.roofSheetMaterialId, 'corrugated-steel-009'),
    steelMaterialStatus:
      visualStyle === 'technical'
        ? 'technical_only'
        : statusForMaterialId(selection.structuralSteelMaterialId, 'metal-021'),
    siteGroundMaterialStatus:
      visualStyle === 'technical'
        ? 'technical_only'
        : statusForMaterialId(selection.siteGroundMaterialId, 'ground-037'),
    textureResolution: state.textureResolution,
    activeTextureCount: visualStyle === 'technical' ? 0 : state.textureCount,
    materialInstanceCount: 14,
    activeMaterialSelections: selection,
  };
}

export function refreshTriplanarPreviewMaterials(): void {
  if (!state.previewLoaded) return;
  applyPreviewMaps();
  state.listeners.forEach((listener) => listener());
}

export function invalidatePreviewMaterialCache(): void {
  state.previewLoaded = false;
  state.previewLoadPromise = null;
  state.textureCount = 0;
  state.textureResolution = 'not loaded';
  resetTriplanarMaterialCacheForTests();
  state.textureCache.clear();
  state.materialStatus.clear();
  if (state.library) {
    state.library = null;
  }
}

export function ensurePreviewMaterialsLoaded(renderer?: THREE.WebGLRenderer): Promise<void> {
  if (state.previewLoaded) {
    return Promise.resolve();
  }
  if (state.previewLoadPromise) {
    return state.previewLoadPromise;
  }
  state.previewLoadPromise = loadPreviewTexturesInternal(renderer)
    .catch((error) => {
      console.warn('[design-materials] preview texture load failed', error);
    })
    .finally(() => {
      state.previewLoadPromise = null;
    });
  return state.previewLoadPromise;
}

export type ResolveDesignMaterialOptions = {
  visualStyle: DesignVisualStyle;
  selected: boolean;
  opacity?: number;
  transparent?: boolean;
};

export function resolveCmuMaterial(
  options: ResolveDesignMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const library = ensureLibrary();
  const base =
    options.visualStyle === 'material_preview' && state.previewLoaded
      ? library.cmuPreview
      : library.cmuTechnical;
  return finalizeMaterial(base, options, trackDisposable);
}

export function resolveMortarMaterial(
  options: ResolveDesignMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const library = ensureLibrary();
  const base =
    options.visualStyle === 'material_preview' && state.previewLoaded
      ? library.mortarPreview
      : library.mortarTechnical;
  return finalizeMaterial(base, options, trackDisposable);
}

export type ResolveCastConcreteMaterialOptions = ResolveDesignMaterialOptions & {
  role?: CastConcreteMaterialRole;
};

export function resolveCastConcreteMaterial(
  options: ResolveCastConcreteMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const library = ensureLibrary();
  const role = options.role ?? 'structural';
  const usePreview = options.visualStyle === 'material_preview' && state.previewLoaded;
  const base =
    role === 'beam'
      ? usePreview
        ? library.castConcreteBeamPreview
        : library.castConcreteBeamTechnical
      : usePreview
        ? library.castConcreteStructuralPreview
        : library.castConcreteStructuralTechnical;
  return finalizeMaterial(base, options, trackDisposable);
}

export function resolveRoofMetalMaterial(
  options: ResolveDesignMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const library = ensureLibrary();
  const base =
    options.visualStyle === 'material_preview' && state.previewLoaded
      ? library.roofMetalPreview
      : library.roofMetalTechnical;
  return finalizeMaterial(base, options, trackDisposable);
}

export function resolveStructuralSteelMaterial(
  options: ResolveDesignMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const library = ensureLibrary();
  const base =
    options.visualStyle === 'material_preview' && state.previewLoaded
      ? library.structuralSteelPreview
      : library.structuralSteelTechnical;
  return finalizeMaterial(base, options, trackDisposable);
}

export type ResolveSiteGroundMaterialOptions = ResolveDesignMaterialOptions & {
  gridSizeMeters?: number;
};

export function resolveSiteGroundMaterial(
  options: ResolveSiteGroundMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  const library = ensureLibrary();
  if (options.visualStyle !== 'material_preview' || !state.previewLoaded) {
    const material = library.siteGroundTechnical.clone();
    const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    material.color.setHex(dark ? 0x1e293b : 0xe2e8f0);
    trackDisposable(material);
    return material;
  }

  const material = library.siteGroundPreview.clone();
  const repeat = siteGroundUvRepeat(options.gridSizeMeters ?? 30, state.activeSelections.siteGroundMaterialId);
  if (material.map) {
    material.map = material.map.clone();
    material.map.repeat.set(repeat, repeat);
    material.map.needsUpdate = true;
  }
  if (material.normalMap) {
    material.normalMap = material.normalMap.clone();
    material.normalMap.repeat.set(repeat, repeat);
  }
  if (material.roughnessMap) {
    material.roughnessMap = material.roughnessMap.clone();
    material.roughnessMap.repeat.set(repeat, repeat);
  }
  if (material.aoMap) {
    material.aoMap = material.aoMap.clone();
    material.aoMap.repeat.set(repeat, repeat);
  }
  material.transparent = false;
  material.opacity = 1;
  material.needsUpdate = true;
  trackDisposable(material);
  return material;
}

function finalizeMaterial(
  base: THREE.MeshStandardMaterial,
  options: ResolveDesignMaterialOptions,
  trackDisposable: (material: THREE.Material) => void,
): THREE.MeshStandardMaterial {
  const needsCutawayClone =
    options.transparent === true && options.opacity != null && options.opacity < 0.99;
  const needsClone = options.selected || needsCutawayClone;

  if (!needsClone) {
    return base;
  }

  const material = base.clone();
  if (options.selected) {
    material.color.setHex(0x22d3ee);
    material.emissive.setHex(0x0e7490);
    material.emissiveIntensity = 0.22;
    material.transparent = true;
    material.opacity = 0.92;
    material.depthWrite = false;
  } else if (needsCutawayClone) {
    material.transparent = true;
    material.opacity = options.opacity ?? 0.35;
    material.depthWrite = false;
  }
  trackDisposable(material);
  return material;
}

/** Technical flat-color material matching legacy viewer behavior. */
export function createLegacyTechnicalMaterial(
  color: number,
  selected: boolean,
  trackDisposable: (material: THREE.Material) => void,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: selected ? 0x22d3ee : color,
    roughness: 0.78,
    metalness: 0.03,
    transparent: selected || options.transparent === true,
    opacity: selected ? 0.92 : (options.opacity ?? 1),
    emissive: selected ? 0x0e7490 : 0x000000,
    emissiveIntensity: selected ? 0.22 : 0,
    ...options,
  });
  trackDisposable(material);
  return material;
}

export function resetDesignMaterialLibraryForTests(): void {
  invalidatePreviewMaterialCache();
  state.library = null;
  state.activeSelections = normalizeDesignMaterialSelection(DEFAULT_DESIGN_MATERIAL_SELECTION);
  state.listeners.clear();
  resetTriplanarMaterialCacheForTests();
}

export function initializeMaterialSelectionsFromPersistence(
  partial?: Partial<DesignMaterialSelection> | null,
): DesignMaterialSelection {
  const normalized = normalizeDesignMaterialSelection(partial);
  state.activeSelections = normalized;
  return normalized;
}
