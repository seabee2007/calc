import { describe, expect, it } from 'vitest';
import {
  BIM_MODEL_LOAD_ERROR,
  formatBimViewerLoadError,
} from '../services/bimModelUploadValidation';

describe('BimViewer load errors', () => {
  it('shows a friendly missing-assets error instead of raw Three.js loader output', () => {
    expect(
      formatBimViewerLoadError(new Error('THREE.GLTFLoader: Failed to load buffer "scene.bin".')),
    ).toBe(BIM_MODEL_LOAD_ERROR);
    expect(BIM_MODEL_LOAD_ERROR).toContain('single-file .glb model');
  });
});
