import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createMeterScaledBoxGeometry,
  createRoofCladdingGeometry,
  resolveRoofRidgeDirection,
} from '../rendering/materials/designRenderingUv';
import {
  CAST_CONCRETE_TEXTURE_TILE_METERS,
  CMU_TEXTURE_TILE_METERS,
  createTriplanarStandardMaterial,
  getTextureProjectionDiagnostics,
  resetTriplanarMaterialCacheForTests,
} from '../rendering/materials/createTriplanarStandardMaterial';
import {
  getDesignMaterialLibrary,
  getMaterialOptionsForCategory,
  getMaterialDiagnostics,
  resetDesignMaterialLibraryForTests,
  resolveCastConcreteMaterial,
} from '../rendering/materials/designMaterialLibrary';

describe('designMaterialLibrary', () => {
  beforeEach(() => {
    resetDesignMaterialLibraryForTests();
  });

  it('creates shared technical and preview material instances', () => {
    const library = getDesignMaterialLibrary();
    expect(library.cmuTechnical).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(library.cmuPreview).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(library.cmuTechnical).not.toBe(library.cmuPreview);
    expect(library.castConcreteStructuralPreview).not.toBe(library.castConcreteBeamPreview);
    expect(getDesignMaterialLibrary().cmuTechnical).toBe(library.cmuTechnical);
  });

  it('resolves distinct cast concrete roles before preview textures load', () => {
    const library = getDesignMaterialLibrary();
    const structural = resolveCastConcreteMaterial(
      { visualStyle: 'technical', selected: false, role: 'structural' },
      () => undefined,
    );
    const beam = resolveCastConcreteMaterial(
      { visualStyle: 'technical', selected: false, role: 'beam' },
      () => undefined,
    );
    expect(structural).toBe(library.castConcreteStructuralTechnical);
    expect(beam).toBe(library.castConcreteBeamTechnical);
    expect(structural).not.toBe(beam);
  });

  it('reports technical diagnostics before preview textures load', () => {
    const diagnostics = getMaterialDiagnostics('technical');
    expect(diagnostics.visualStyle).toBe('technical');
    expect(diagnostics.activeTextureCount).toBe(0);
    expect(diagnostics.materialInstanceCount).toBe(20);
    expect(diagnostics.concreteStructuralMaterialStatus).toBe('technical_only');
    expect(diagnostics.concreteBeamMaterialStatus).toBe('technical_only');
    expect(diagnostics.plasterMaterialStatus).toBe('technical_only');
  });

  it('registers non-corrugated plaster finish material options', () => {
    const options = getMaterialOptionsForCategory('plaster_finish');
    expect(options.map((option) => option.id)).toEqual([
      'textured-3-coat-plaster',
      'smooth-3-coat-plaster',
    ]);
    expect(options.every((option) => option.category === 'plaster_finish')).toBe(true);
    expect(options.every((option) => option.supportsTint)).toBe(true);
  });
});

describe('createTriplanarStandardMaterial', () => {
  beforeEach(() => {
    resetTriplanarMaterialCacheForTests();
  });

  it('creates a mesh standard material with triplanar shader hooks', () => {
    const material = createTriplanarStandardMaterial({
      textureScaleMeters: CMU_TEXTURE_TILE_METERS,
      baseColor: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    });
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.onBeforeCompile).toBeTypeOf('function');
    expect(material.customProgramCacheKey).toBeTypeOf('function');
    expect(getTextureProjectionDiagnostics().textureMaterialCacheCount).toBe(1);
  });

  it('uses stable world tile sizes for CMU and cast concrete', () => {
    expect(CMU_TEXTURE_TILE_METERS).toBe(0.45);
    expect(CAST_CONCRETE_TEXTURE_TILE_METERS).toBe(1.25);
    const diagnostics = getTextureProjectionDiagnostics();
    expect(diagnostics.cmuProjection).toBe('triplanar');
    expect(diagnostics.concreteProjection).toBe('triplanar');
  });
});

describe('designRenderingUv', () => {
  it('assigns meter-scaled UV spans on box geometry', () => {
    const geometry = createMeterScaledBoxGeometry(2, 0.4, 0.19);
    const uv = geometry.getAttribute('uv');
    expect(uv).toBeTruthy();
    let maxU = 0;
    for (let index = 0; index < uv.count; index += 1) {
      maxU = Math.max(maxU, uv.getX(index));
    }
    expect(maxU).toBeCloseTo(2, 1);
  });

  it('builds roof cladding UVs with slope-axis coverage', () => {
    const geometry = createRoofCladdingGeometry({
      corners: [
        { x: 0, y: 2, z: -2 },
        { x: 0, y: 2, z: 2 },
        { x: 4, y: 0, z: 2 },
        { x: 4, y: 0, z: -2 },
      ],
      slabTopMeters: 0.15,
      planeNormal: new THREE.Vector3(0, 0.894, 0.447).normalize(),
      ridgeDirection: resolveRoofRidgeDirection(
        [
          { x: 0, z: -2 },
          { x: 0, z: 2 },
        ],
        { x: 0, z: 4 },
      ),
    });
    const uv = geometry.getAttribute('uv');
    expect(uv.count).toBe(4);
    let maxU = 0;
    for (let index = 0; index < uv.count; index += 1) {
      maxU = Math.max(maxU, uv.getX(index));
    }
    expect(maxU).toBeGreaterThan(0);
  });

  it('uses the local eave edge for triangular hip cladding UVs', () => {
    const direction = resolveRoofRidgeDirection(
      [
        { x: -3, z: -2 },
        { x: -3, z: 2 },
        { x: 0, z: 0 },
      ],
      { x: 4, z: 0 },
    );

    expect(direction.x).toBeCloseTo(0, 6);
    expect(Math.abs(direction.z)).toBeCloseTo(1, 6);
  });

  it('maps triangular hip cladding corrugations down slope even with a bad ridge hint', () => {
    const geometry = createRoofCladdingGeometry({
      corners: [
        { x: 0, y: 2, z: 0 },
        { x: -3, y: 0, z: -2 },
        { x: -3, y: 0, z: 2 },
      ],
      slabTopMeters: 0.15,
      planeNormal: new THREE.Vector3(-0.55, 0.83, 0).normalize(),
      ridgeDirection: new THREE.Vector3(1, 0, 0),
    });

    const uv = geometry.getAttribute('uv');
    expect(uv.getX(1)).toBeCloseTo(uv.getX(2), 6);
    expect(Math.abs(uv.getY(1) - uv.getY(2))).toBeGreaterThan(3);
    expect(Math.abs(uv.getX(0) - uv.getX(1))).toBeGreaterThan(10);
  });

  it('can swap corrugation axis for ridge-to-eave profile materials', () => {
    const geometry = createRoofCladdingGeometry({
      corners: [
        { x: 0, y: 2, z: -2 },
        { x: 0, y: 2, z: 2 },
        { x: 4, y: 0, z: 2 },
        { x: 4, y: 0, z: -2 },
      ],
      slabTopMeters: 0.15,
      planeNormal: new THREE.Vector3(0, 0.894, 0.447).normalize(),
      ridgeDirection: resolveRoofRidgeDirection(
        [
          { x: 0, z: -2 },
          { x: 0, z: 2 },
        ],
        { x: 0, z: 4 },
      ),
      swapCorrugationAxis: true,
    });
    const defaultGeometry = createRoofCladdingGeometry({
      corners: [
        { x: 0, y: 2, z: -2 },
        { x: 0, y: 2, z: 2 },
        { x: 4, y: 0, z: 2 },
        { x: 4, y: 0, z: -2 },
      ],
      slabTopMeters: 0.15,
      planeNormal: new THREE.Vector3(0, 0.894, 0.447).normalize(),
      ridgeDirection: resolveRoofRidgeDirection(
        [
          { x: 0, z: -2 },
          { x: 0, z: 2 },
        ],
        { x: 0, z: 4 },
      ),
    });
    const swapped = geometry.getAttribute('uv');
    const normal = defaultGeometry.getAttribute('uv');
    expect(swapped.getX(0)).toBeCloseTo(normal.getY(0), 6);
    expect(swapped.getY(0)).toBeCloseTo(normal.getX(0), 6);
  });
});
