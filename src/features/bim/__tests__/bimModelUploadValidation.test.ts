import { describe, expect, it } from 'vitest';
import {
  BIM_MODEL_LOAD_ERROR,
  GLTF_EXTERNAL_REFERENCE_ERROR,
  IFC_IMPORT_FUTURE_ERROR,
  INVALID_BIM_FILE_ERROR,
  REVIT_SKETCHUP_EXPORT_ERROR,
  formatBimViewerLoadError,
  gltfJsonHasExternalReferences,
  isMissingAssetLoadError,
  validateBimModelFileForUpload,
} from '../services/bimModelUploadValidation';

describe('bimModelUploadValidation', () => {
  it('accepts .glb uploads', async () => {
    const file = new File(['binary'], 'model.glb', { type: 'model/gltf-binary' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(true);
  });

  it('rejects standalone .gltf with external scene.bin reference', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 100, uri: 'scene.bin' }],
    });
    const file = new File([gltf], 'scene.gltf', { type: 'model/gltf+json' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GLTF_EXTERNAL_REFERENCE_ERROR);
  });

  it('rejects standalone .gltf with external texture references', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      images: [{ uri: 'textures/door1_baseColor.jpeg' }],
    });
    const file = new File([gltf], 'scene.gltf', { type: 'model/gltf+json' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GLTF_EXTERNAL_REFERENCE_ERROR);
  });

  it('rejects embedded/base64 .gltf for the GLB-only MVP', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 4, uri: 'data:application/octet-stream;base64,AAAAAA==' }],
      images: [{ uri: 'data:image/png;base64,iVBORw0KGgo=' }],
    });
    const file = new File([gltf], 'embedded.gltf', { type: 'model/gltf+json' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GLTF_EXTERNAL_REFERENCE_ERROR);
  });

  it('detects external references in gltf json', () => {
    expect(
      gltfJsonHasExternalReferences({
        buffers: [{ uri: 'scene.bin' }],
      }),
    ).toBe(true);
    expect(
      gltfJsonHasExternalReferences({
        buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAA==' }],
      }),
    ).toBe(false);
  });

  it('rejects unsupported file extensions', async () => {
    const file = new File(['obj'], 'model.obj', { type: 'text/plain' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(INVALID_BIM_FILE_ERROR);
  });

  it('rejects IFC with future import guidance', async () => {
    const file = new File(['ifc'], 'model.ifc', { type: 'application/octet-stream' });
    const result = await validateBimModelFileForUpload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(IFC_IMPORT_FUTURE_ERROR);
  });

  it('rejects Revit and SketchUp with export guidance', async () => {
    const rvt = await validateBimModelFileForUpload(
      new File(['rvt'], 'model.rvt', { type: 'application/octet-stream' }),
    );
    const skp = await validateBimModelFileForUpload(
      new File(['skp'], 'model.skp', { type: 'application/octet-stream' }),
    );

    expect(rvt.error).toBe(REVIT_SKETCHUP_EXPORT_ERROR);
    expect(skp.error).toBe(REVIT_SKETCHUP_EXPORT_ERROR);
  });

  it('maps missing asset loader errors to a friendly viewer message', () => {
    expect(
      formatBimViewerLoadError(new Error('THREE.GLTFLoader: Failed to load buffer "scene.bin".')),
    ).toBe(BIM_MODEL_LOAD_ERROR);
    expect(
      formatBimViewerLoadError(
        new Error("THREE.GLTFLoader: Couldn't load texture textures/woodfloor_baseColor.jpeg"),
      ),
    ).toBe(BIM_MODEL_LOAD_ERROR);
  });

  it('flags supabase unsigned sign-path errors as missing asset failures', () => {
    expect(
      isMissingAssetLoadError('Http failure for /storage/v1/object/sign/bim-models/scene.bin'),
    ).toBe(true);
  });
});
